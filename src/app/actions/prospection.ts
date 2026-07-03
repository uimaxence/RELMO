"use server";

import { revalidatePath } from "next/cache";
import Papa from "papaparse";

import { prisma } from "@/lib/db";
import { collecter, domaineDe, placesConfigured, type LeadBrut } from "@/lib/prospection/places";
import { analyzeSite } from "@/lib/prospection/audit";
import { auditerProspect, enrichirDirigeant } from "@/lib/ai/assistant";
import { REGIONS, REGION_DEFAUT } from "@/lib/prospection/regions";
import { secteurByCle } from "@/lib/prospection/secteurs";
import { PROSPECT_RELANCE_JOURS } from "@/lib/constants";

// Récupère quelques messages réellement envoyés par l'utilisateur → sert
// d'exemples de style pour que DeepSeek imite sa façon d'écrire.
async function stylesUtilisateur(): Promise<string[]> {
  const rows = await prisma.prospect.findMany({
    where: { messageEnvoye: { not: null } },
    orderBy: { contacteLe: "desc" },
    take: 3,
    select: { messageEnvoye: true },
  });
  return rows.map((r) => r.messageEnvoye!).filter(Boolean);
}

// Frontière "use server" du moteur de prospection. Toutes les écritures passent
// par Prisma + revalidatePath("/prospection/recherche"). Dédup : domaine (site)
// et placeId (Google) sont @unique.

const PAGE = "/prospection/recherche";
const LIMITE_PAR_RECHERCHE = 15; // on ne garde/audite que les 15 meilleurs par lancement
const AUDIT_CONCURRENCE = 6; // audits menés en parallèle (borne le temps total)
const ENRICH = String(process.env.ENRICH).toLowerCase() === "true";
const SCORE_ENRICH_MIN = Number(process.env.SCORE_ENRICH_MIN || 65);

export { placesConfigured };

// Exécute `fn` sur `items` avec une concurrence limitée (borne le temps total
// sans saturer DeepSeek ni le réseau). Les erreurs individuelles sont avalées.
async function mapLimit<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>,
): Promise<(R | null)[]> {
  const results: (R | null)[] = new Array(items.length).fill(null);
  let cursor = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (cursor < items.length) {
      const i = cursor++;
      try {
        results[i] = await fn(items[i]);
      } catch {
        results[i] = null;
      }
    }
  });
  await Promise.all(workers);
  return results;
}

// Insère un lead en dédupliquant. Renvoie l'id créé, ou null si doublon/ignoré.
async function upsertLead(
  lead: LeadBrut & { region?: string; secteur?: string; campagne?: string },
): Promise<string | null> {
  const nom = lead.nom.trim();
  if (!nom) return null;
  const domaine = domaineDe(lead.site) || null;
  const placeId = lead.placeId?.trim() || null;

  const base = {
    nom,
    site: lead.site || null,
    ville: lead.ville || null,
    activite: lead.activite || null,
    telephone: lead.telephone || null,
    region: lead.region || null,
    secteur: lead.secteur || null,
    campagne: lead.campagne?.trim() || null,
  };

  // Clé de dédup : domaine en priorité, sinon placeId.
  if (domaine) {
    const existing = await prisma.prospect.findUnique({ where: { domaine } });
    if (existing) return null;
  }
  if (placeId) {
    const existing = await prisma.prospect.findUnique({ where: { placeId } });
    if (existing) return null;
  }
  // Sans site ni placeId : dédup souple sur nom + ville.
  if (!domaine && !placeId) {
    const dup = await prisma.prospect.findFirst({
      where: { nom, ville: base.ville },
    });
    if (dup) return null;
  }

  const created = await prisma.prospect.create({
    data: { ...base, domaine, placeId },
    select: { id: true },
  });
  return created.id;
}

// (A) Scraping Google Places — région + secteur + villes choisies.
export async function collecterProspects(input: {
  region: string;
  secteur: string;
  villes: string[];
  keywords?: string[];
  pages?: number;
  campagne?: string;
}): Promise<{
  ok: boolean;
  ajoutes?: number;
  total?: number;
  audites?: number;
  error?: string;
}> {
  const region = REGIONS[input.region] ? input.region : REGION_DEFAUT;
  const sect = secteurByCle(input.secteur);
  if (!sect) return { ok: false, error: "Secteur inconnu." };

  const villesRegion = REGIONS[region];
  let villes = (input.villes ?? []).filter((v) => villesRegion.includes(v));
  if (!villes.length) villes = [villesRegion[0]];

  const keywords =
    input.keywords && input.keywords.length
      ? input.keywords.map((k) => k.trim()).filter(Boolean)
      : sect.keywords;

  // Garde-fou temps : on plafonne le nombre de requêtes par lancement.
  const MAX_REQUETES = 60;
  if (villes.length * keywords.length > MAX_REQUETES) {
    villes = villes.slice(0, Math.max(1, Math.floor(MAX_REQUETES / keywords.length)));
  }

  const res = await collecter({
    villes,
    keywords,
    pagesParRequete: input.pages,
  });
  if (!res.ok) return { ok: false, error: res.error };

  // On répartit sur les mots-clés (variété) puis on ne garde que les 15 premiers
  // NOUVEAUX (dédup). Les prospects sont créés AVANT l'audit → persistés même si
  // l'audit est interrompu (fermeture d'onglet), et rattrapables par le batch.
  const leads = [...res.leads].sort((a, b) => a.activite.localeCompare(b.activite));
  const step = Math.max(1, Math.floor(leads.length / LIMITE_PAR_RECHERCHE));
  const echantillon = leads.filter((_, i) => i % step === 0).concat(leads);

  const createdIds: string[] = [];
  for (const lead of echantillon) {
    if (createdIds.length >= LIMITE_PAR_RECHERCHE) break;
    const id = await upsertLead({
      ...lead,
      region,
      secteur: input.secteur,
      campagne: input.campagne,
    });
    if (id) createdIds.push(id);
  }
  revalidatePath(PAGE); // les 15 apparaissent tout de suite (avant scoring)

  // Audit DeepSeek en parallèle borné ; chaque résultat est commité individuellement.
  const audits = await mapLimit(createdIds, AUDIT_CONCURRENCE, (id) => auditerUnProspect(id));
  const audites = audits.filter((a) => a && a.ok).length;

  revalidatePath(PAGE);
  return { ok: true, ajoutes: createdIds.length, total: res.leads.length, audites };
}

// (B) Import CSV — colonnes nom,site,ville,activite,telephone (mêmes que collect).
export async function importerProspectsCsv(
  csv: string,
  secteur?: string,
  campagne?: string,
): Promise<{
  ok: boolean;
  ajoutes?: number;
  total?: number;
  audites?: number;
  error?: string;
}> {
  if (!csv.trim()) return { ok: false, error: "Fichier vide." };

  const { data, errors } = Papa.parse<Record<string, string>>(csv, {
    header: true,
    skipEmptyLines: true,
  });
  if (errors.length && !data.length) {
    return { ok: false, error: `CSV illisible : ${errors[0]?.message ?? "format invalide"}` };
  }

  const createdIds: string[] = [];
  for (const row of data) {
    const nom = (row.nom ?? row.Nom ?? "").trim();
    if (!nom) continue;
    const id = await upsertLead({
      nom,
      site: (row.site ?? row.Site ?? "").trim(),
      ville: (row.ville ?? row.Ville ?? "").trim(),
      activite: (row.activite ?? row.Activite ?? "").trim(),
      telephone: (row.telephone ?? row.Telephone ?? row.tel ?? "").trim(),
      placeId: "",
      secteur,
      campagne,
    });
    if (id) createdIds.push(id);
  }
  revalidatePath(PAGE);

  // Audit auto des importés, borné à LIMITE_PAR_RECHERCHE (les autres via le batch).
  const aAuditer = createdIds.slice(0, LIMITE_PAR_RECHERCHE);
  const audits = await mapLimit(aAuditer, AUDIT_CONCURRENCE, (id) => auditerUnProspect(id));
  const audites = audits.filter((a) => a && a.ok).length;

  revalidatePath(PAGE);
  return { ok: true, ajoutes: createdIds.length, total: data.length, audites };
}

// Audit d'un prospect : analyse site + DeepSeek (score + accroches) + enrichissement
// optionnel (Perplexity). Met à jour la ligne en base.
export async function auditerUnProspect(
  id: string,
): Promise<{ ok: boolean; score?: number | null; error?: string }> {
  const p = await prisma.prospect.findUnique({ where: { id } });
  if (!p) return { ok: false, error: "Prospect introuvable." };

  const { statut, signals, contacts } = await analyzeSite(p.site);
  const ia = await auditerProspect({
    nom: p.nom,
    ville: p.ville,
    activite: p.activite,
    statutSite: statut,
    signaux: signals,
    stylesUtilisateur: await stylesUtilisateur(),
  });
  if (!ia.ok) {
    // On garde l'erreur exacte (clé absente, 401, timeout…) pour la débuggabilité.
    await prisma.prospect.update({
      where: { id },
      data: { statutAudit: "erreur", note: ia.error?.slice(0, 300) ?? null },
    });
    return { ok: false, error: ia.error };
  }

  let dirigeant = "";
  let linkedin = "";
  if (ENRICH && (ia.data.score ?? 0) >= SCORE_ENRICH_MIN) {
    const e = await enrichirDirigeant({ nom: p.nom, ville: p.ville, activite: p.activite });
    dirigeant = e.dirigeant;
    linkedin = e.linkedin;
  }

  await prisma.prospect.update({
    where: { id },
    data: {
      statutAudit: statut,
      score: ia.data.score,
      design: ia.data.design || null,
      anciennete: ia.data.anciennete || null,
      pointsFaibles: ia.data.pointsFaibles.join(" • ") || null,
      accrocheEmail: ia.data.accrocheEmail || null,
      accrocheLinkedin: ia.data.accrocheLinkedin || null,
      email: contacts.bestEmail || p.email,
      emailsTous: contacts.emails.join(" ") || null,
      telephone: p.telephone || contacts.phones[0] || null,
      siret: contacts.siret,
      dirigeant: dirigeant || p.dirigeant,
      linkedin: linkedin || p.linkedin,
    },
  });

  revalidatePath(PAGE);
  return { ok: true, score: ia.data.score };
}

// Audit en lot des prospects non encore audités (plafonné pour tenir le temps).
export async function auditerNonAudites(): Promise<{
  ok: boolean;
  audites?: number;
  restants?: number;
  error?: string;
}> {
  const aFaire = await prisma.prospect.findMany({
    where: { statutAudit: "a_auditer", statut: { not: "ecarte" } },
    orderBy: { createdAt: "asc" },
    take: LIMITE_PAR_RECHERCHE,
    select: { id: true },
  });
  const audits = await mapLimit(
    aFaire.map((p) => p.id),
    AUDIT_CONCURRENCE,
    (id) => auditerUnProspect(id),
  );
  const audites = audits.filter((a) => a && a.ok).length;
  const restants = await prisma.prospect.count({
    where: { statutAudit: "a_auditer", statut: { not: "ecarte" } },
  });
  revalidatePath(PAGE);
  return { ok: true, audites, restants };
}

// Convertit un prospect en Client (statut prospect) + Site si une URL existe.
export async function convertirEnClient(
  id: string,
): Promise<{ ok: boolean; clientId?: string; error?: string }> {
  const p = await prisma.prospect.findUnique({ where: { id } });
  if (!p) return { ok: false, error: "Prospect introuvable." };
  if (p.statut === "converti" && p.clientId) {
    return { ok: false, error: "Déjà converti en client." };
  }

  const notes = [
    p.score != null ? `Score prospection : ${p.score}/100` : null,
    p.pointsFaibles ? `Points faibles : ${p.pointsFaibles}` : null,
    p.dirigeant ? `Dirigeant : ${p.dirigeant}` : null,
    p.linkedin ? `LinkedIn : ${p.linkedin}` : null,
    p.activite ? `Découvert via : ${p.activite} (${p.ville ?? ""})` : null,
  ]
    .filter(Boolean)
    .join("\n");

  const client = await prisma.client.create({
    data: {
      nom: p.nom,
      email: p.email || null,
      telephone: p.telephone || null,
      statut: "prospect",
      source: "prospection",
      secteur: p.activite || secteurByCle(p.secteur ?? "")?.label || null,
      notes: notes || null,
      sites: p.site
        ? {
            create: {
              nom: p.nom,
              url: p.site,
              statut: "actif",
            },
          }
        : undefined,
    },
  });

  await prisma.prospect.update({
    where: { id },
    data: { statut: "converti", clientId: client.id },
  });

  revalidatePath(PAGE);
  revalidatePath("/clients");
  revalidatePath("/prospection");
  return { ok: true, clientId: client.id };
}

// Change le statut de suivi (à contacter / écarté / nouveau).
export async function changerStatutProspect(
  id: string,
  statut: string,
): Promise<void> {
  await prisma.prospect.update({ where: { id }, data: { statut } });
  revalidatePath(PAGE);
}

// « Mail envoyé » : entre dans le pipeline. Enregistre le message RÉELLEMENT
// envoyé (édité par l'user, défaut = accroche) → DeepSeek apprend son style.
// Planifie une relance à +5 jours.
export async function marquerContacte(
  id: string,
  message?: string,
): Promise<{ ok: boolean; error?: string }> {
  const now = new Date();
  const relance = new Date(now.getTime() + PROSPECT_RELANCE_JOURS * 86_400_000);
  await prisma.prospect.update({
    where: { id },
    data: {
      statut: "contacte",
      contacteLe: now,
      relanceLe: relance,
      relanceFaiteLe: null,
      messageEnvoye: message?.trim() ? message.trim() : undefined,
    },
  });
  revalidatePath(PAGE);
  return { ok: true };
}

// « Relance faite » : reconduit la relance à +5 jours et incrémente le compteur.
export async function marquerRelanceFaite(id: string): Promise<void> {
  const now = new Date();
  const relance = new Date(now.getTime() + PROSPECT_RELANCE_JOURS * 86_400_000);
  const p = await prisma.prospect.findUnique({
    where: { id },
    select: { nbRelances: true },
  });
  await prisma.prospect.update({
    where: { id },
    data: {
      relanceFaiteLe: now,
      relanceLe: relance,
      nbRelances: (p?.nbRelances ?? 0) + 1,
    },
  });
  revalidatePath(PAGE);
}

// « Réponse reçue » : horodate la 1re réponse (bascule si déjà marqué). Sert de
// dénominateur au taux de réponse (cf. brief §2 : ajuster si < 2% après 150 envois).
export async function marquerReponse(id: string): Promise<void> {
  const p = await prisma.prospect.findUnique({
    where: { id },
    select: { reponduLe: true },
  });
  await prisma.prospect.update({
    where: { id },
    data: { reponduLe: p?.reponduLe ? null : new Date() },
  });
  revalidatePath(PAGE);
  revalidatePath("/acquisition");
}

// « Annuler la fiche » : suppression définitive. La raison (facultative) n'est pas
// conservée en base (la fiche disparaît) mais est tracée dans les logs serveur.
export async function annulerProspect(id: string, raison?: string): Promise<void> {
  const p = await prisma.prospect.delete({
    where: { id },
    select: { nom: true },
  });
  if (raison?.trim()) {
    console.info(`[prospect annulé] ${p.nom} (${id}) — ${raison.trim()}`);
  }
  revalidatePath(PAGE);
}

export async function supprimerProspect(id: string): Promise<void> {
  await prisma.prospect.delete({ where: { id } });
  revalidatePath(PAGE);
}

// Export CSV « propre » des fiches de prospection — pour analyser hors-app (Claude)
// pourquoi ça ne répond pas : message généré par défaut vs message réellement envoyé,
// croisé avec le score / les points faibles / la réponse. Deux portées :
//   - "contactes" : uniquement les prospects réellement contactés (message envoyé).
//   - "tous"      : toute la base de prospection.
export async function exporterProspectionCsv(
  scope: "contactes" | "tous" = "contactes",
): Promise<{ ok: boolean; csv?: string; filename?: string; count?: number; error?: string }> {
  const where =
    scope === "contactes" ? { contacteLe: { not: null } } : {};

  const prospects = await prisma.prospect.findMany({
    where,
    orderBy: [{ contacteLe: "desc" }, { createdAt: "desc" }],
  });

  if (prospects.length === 0) {
    return {
      ok: false,
      error:
        scope === "contactes"
          ? "Aucun prospect contacté à exporter pour l'instant."
          : "Aucun prospect à exporter.",
    };
  }

  const iso = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : "");

  // Ordre pensé pour l'analyse : contexte → contact → réponse → messages en dernier
  // (les 2 dernières colonnes = « généré par défaut » vs « réellement envoyé »).
  const rows = prospects.map((p) => ({
    Nom: p.nom,
    Activité: p.activite ?? "",
    Secteur: secteurByCle(p.secteur ?? "")?.label ?? p.secteur ?? "",
    Ville: p.ville ?? "",
    Région: p.region ?? "",
    Score: p.score ?? "",
    Constat_design: p.design ?? "",
    Ancienneté: p.anciennete ?? "",
    Points_faibles: p.pointsFaibles ?? "",
    Email: p.email ?? "",
    Téléphone: p.telephone ?? "",
    Site: p.site ?? "",
    Campagne: p.campagne ?? "",
    Statut: p.statut,
    Contacté_le: iso(p.contacteLe),
    Nb_relances: p.nbRelances,
    Relance_faite_le: iso(p.relanceFaiteLe),
    A_répondu: p.reponduLe ? "Oui" : "Non",
    Répondu_le: iso(p.reponduLe),
    Accroche_générée_email: p.accrocheEmail ?? "",
    Message_envoyé: p.messageEnvoye ?? "",
  }));

  // Papa.unparse gère l'échappement (guillemets, retours à la ligne dans les
  // messages). BOM pour qu'Excel lise correctement les accents.
  const csv = "﻿" + Papa.unparse(rows);
  const filename = `prospection-${scope}-${iso(new Date())}.csv`;
  return { ok: true, csv, filename, count: prospects.length };
}

// Purge les prospects non audités et non convertis (nettoyage d'anciennes collectes).
export async function supprimerNonAudites(): Promise<{ ok: boolean; supprimes: number }> {
  const { count } = await prisma.prospect.deleteMany({
    where: { statutAudit: "a_auditer", statut: { notIn: ["converti", "a_contacter"] } },
  });
  revalidatePath(PAGE);
  return { ok: true, supprimes: count };
}
