"use server";

import { revalidatePath } from "next/cache";
import Papa from "papaparse";

import { prisma } from "@/lib/db";
import { collecter, domaineDe, placesConfigured, type LeadBrut } from "@/lib/prospection/places";
import { analyzeSite, type Contacts } from "@/lib/prospection/audit";
import { analyseVisuelle } from "@/lib/prospection/visuel";
import {
  auditerProspect,
  auditerProspectPro,
  auditerPartenaire,
  enrichirDirigeant,
} from "@/lib/ai/assistant";
import { REGIONS, REGION_DEFAUT } from "@/lib/prospection/regions";
import { secteurByCle, besoinFortDuSecteur } from "@/lib/prospection/secteurs";
import {
  scorePotentiel,
  scoreProbleme,
  scoreCroissance,
  scoreAcces,
  computeFiltre,
} from "@/lib/prospection/scoring";
import {
  scorePotentielPro,
  besoinFortPro,
  scoreOpportunitePro,
  computeFiltrePro,
} from "@/lib/prospection/scoring-pro";
import { metierByCle, modeleRemuValide } from "@/lib/prospection/metiers-partenaires";
import { prochaineRelance } from "@/lib/constants";
import {
  sendMail,
  verifierSmtp,
  smtpConfigured,
  emailValide,
} from "@/lib/mailer";
import { construireEmail } from "@/lib/prospection/email";
import { ensureReglage } from "@/lib/wishlist";

export { smtpConfigured };

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
// par Prisma + revalidatePath("/prospection"). Dédup : domaine (site)
// et placeId (Google) sont @unique.

const PAGE = "/prospection";
const LIMITE_PAR_RECHERCHE = 15; // on ne garde que les 15 meilleurs par lancement
// L'audit inclut désormais une analyse visuelle (capture + vision) ~15-20 s/prospect.
// Pour tenir sous la limite serverless (60 s), on audite par PETITS LOTS enchaînés
// côté client (boucle jusqu'à épuisement), au lieu d'un gros batch bloquant.
const AUDIT_CONCURRENCE = 4; // audits menés en parallèle dans un lot
const AUDIT_LOT = 4; // taille d'un lot d'audit par appel (tient sous 60 s)
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
  lead: LeadBrut & {
    region?: string;
    secteur?: string;
    campagne?: string;
    cible?: string;
    metier?: string;
    segment?: string;
  },
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
    cible: lead.cible === "partenaire" ? "partenaire" : "client",
    // Le segment « pro » ne s'applique qu'à une cible client (angle ROI).
    segment: lead.cible !== "partenaire" && lead.segment === "pro" ? "pro" : "classique",
    metier: lead.metier || null,
    nbAvis: lead.nbAvis ?? null,
    noteGoogle: lead.noteGoogle ?? null,
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

// (A) Scraping Google Places — région + villes choisies. Deux modes :
// cible « client » (défaut) → secteur V1 ; cible « partenaire » → métier V2.
export async function collecterProspects(input: {
  region: string;
  secteur: string;
  villes: string[];
  keywords?: string[];
  pages?: number;
  campagne?: string;
  cible?: string; // client | partenaire
  metier?: string; // requis si cible = partenaire
  segment?: string; // classique | pro (cible client uniquement)
}): Promise<{
  ok: boolean;
  ajoutes?: number;
  total?: number;
  audites?: number;
  error?: string;
}> {
  const region = REGIONS[input.region] ? input.region : REGION_DEFAUT;
  const cible = input.cible === "partenaire" ? "partenaire" : "client";
  const met = cible === "partenaire" ? metierByCle(input.metier ?? "") : undefined;
  const sect = cible === "client" ? secteurByCle(input.secteur) : undefined;
  if (cible === "client" && !sect) return { ok: false, error: "Secteur inconnu." };
  if (cible === "partenaire" && !met) return { ok: false, error: "Métier partenaire inconnu." };

  const villesRegion = REGIONS[region];
  let villes = (input.villes ?? []).filter((v) => villesRegion.includes(v));
  if (!villes.length) villes = [villesRegion[0]];

  const keywords =
    input.keywords && input.keywords.length
      ? input.keywords.map((k) => k.trim()).filter(Boolean)
      : (sect?.keywords ?? met?.keywords ?? []);

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
      secteur: sect ? input.secteur : undefined,
      campagne: input.campagne,
      cible,
      metier: met?.cle,
      segment: input.segment,
    });
    if (id) createdIds.push(id);
  }
  revalidatePath(PAGE); // les 15 apparaissent tout de suite (audit lancé ensuite, en lots)
  return { ok: true, ajoutes: createdIds.length, total: res.leads.length };
}

// (B) Import CSV — colonnes nom,site,ville,activite,telephone (mêmes que collect).
export async function importerProspectsCsv(
  csv: string,
  opts?: { secteur?: string; campagne?: string; cible?: string; metier?: string; segment?: string },
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
      nbAvis: null,
      noteGoogle: null,
      secteur: opts?.secteur,
      campagne: opts?.campagne,
      cible: opts?.cible,
      metier: opts?.metier,
      segment: opts?.segment,
    });
    if (id) createdIds.push(id);
  }
  revalidatePath(PAGE);
  return { ok: true, ajoutes: createdIds.length, total: data.length };
}

// Contacts extraits du site → champs de la fiche (jamais écraser une saisie user).
function contactsData(p: { email: string | null; telephone: string | null }, contacts: Contacts) {
  return {
    email: contacts.bestEmail || p.email,
    emailsTous: contacts.emails.join(" ") || null,
    telephone: p.telephone || contacts.phones[0] || null,
    siret: contacts.siret,
  };
}

// Audit « partenaire » (cible V2) : flags décidés en code (détection déterministe
// prioritaire), pitch DeepSeek seulement pour les fiches éligibles. Concurrent = stop.
async function auditerProspectPartenaire(p: {
  id: string;
  nom: string;
  ville: string | null;
  activite: string | null;
  site: string | null;
  metier: string | null;
  email: string | null;
  telephone: string | null;
  nbAvis: number | null;
  noteGoogle: number | null;
  dirigeant: string | null;
  linkedin: string | null;
}): Promise<{ ok: boolean; score?: number | null; error?: string }> {
  const met = metierByCle(p.metier ?? "");
  const { statut, signals, contacts, offreWeb } = await analyzeSite(p.site);
  const contact = contactsData(p, contacts);

  // Agence web (ou métier inconnu) : jamais de pitch automatique → « à qualifier ».
  if (!met || !met.autoPitch) {
    await prisma.prospect.update({
      where: { id: p.id },
      data: {
        statutAudit: statut,
        flagAQualifier: true,
        score: null,
        atouts: null,
        accrocheEmail: null,
        accrocheLinkedin: null,
        note:
          "À qualifier manuellement : gros comptes qui délaissent les petits projets, " +
          "ou spécialisation sur une autre techno ?" +
          (offreWeb.termes.length ? ` Offre web détectée : ${offreWeb.termes.join(", ")}.` : ""),
        ...contact,
      },
    });
    revalidatePath(PAGE);
    return { ok: true, score: null };
  }

  // Concurrent détecté sur SON site (source de vérité déterministe) : stop.
  if (met.concurrencePossible && offreWeb.detectee) {
    await prisma.prospect.update({
      where: { id: p.id },
      data: {
        statutAudit: statut,
        flagConcurrent: true,
        score: 0,
        atouts: null,
        accrocheEmail: null,
        accrocheLinkedin: null,
        note: `Concurrent : propose lui-même du web (${offreWeb.termes.join(", ")}).`,
        ...contact,
      },
    });
    revalidatePath(PAGE);
    return { ok: true, score: 0 };
  }

  // Éligible au pitch : analyse visuelle (réceptivité au web, signal positif ici)
  // puis scoring + accroches DeepSeek.
  const visuel = await analyseVisuelle(p.site);
  const reglage = await ensureReglage();
  const ia = await auditerPartenaire({
    nom: p.nom,
    ville: p.ville,
    metier: met.cle,
    activite: p.activite,
    statutSite: statut,
    signaux: signals,
    offreWebTermes: offreWeb.termes,
    nbAvis: p.nbAvis,
    noteGoogle: p.noteGoogle,
    visuel,
    modeleRemu: modeleRemuValide(reglage.modeleRemu),
    stylesUtilisateur: await stylesUtilisateur(),
  });
  if (!ia.ok) {
    await prisma.prospect.update({
      where: { id: p.id },
      data: { statutAudit: "erreur", note: ia.error?.slice(0, 300) ?? null },
    });
    return { ok: false, error: ia.error };
  }

  // Ceinture + bretelles : si l'IA a repéré une offre web dans les signaux
  // (title, meta, visuel), on flague aussi. Ses accroches sont déjà vidées.
  const concurrent = ia.data.alerteConcurrence;

  let dirigeant = "";
  let linkedin = "";
  if (!concurrent && ENRICH && (ia.data.score ?? 0) >= SCORE_ENRICH_MIN) {
    const e = await enrichirDirigeant({ nom: p.nom, ville: p.ville, activite: met.label });
    dirigeant = e.dirigeant;
    linkedin = e.linkedin;
  }

  await prisma.prospect.update({
    where: { id: p.id },
    data: {
      statutAudit: statut,
      flagConcurrent: concurrent,
      score: concurrent ? 0 : ia.data.score,
      design: visuel ? `[${visuel.modernite}] ${visuel.constat}` : null,
      atouts: concurrent ? null : ia.data.atouts.join(" • ") || null,
      pointsFaibles: ia.data.pointsAttention.join(" • ") || null,
      accrocheEmail: ia.data.accrocheEmail || null,
      accrocheLinkedin: ia.data.accrocheLinkedin || null,
      note: concurrent ? "Concurrent repéré par l'analyse IA (signaux du site)." : undefined,
      dirigeant: dirigeant || p.dirigeant,
      linkedin: linkedin || p.linkedin,
      ...contact,
    },
  });

  revalidatePath(PAGE);
  return { ok: true, score: concurrent ? 0 : ia.data.score };
}

// Audit « RELMO Pro » (segment=pro) : angle opportunité de performance (pas défauts),
// scoring recalibré (besoin ROI en gate, croissance centrale). Cf.
// RELMO-Pro-prospects-haut-de-gamme.md.
async function auditerProspectProInterne(p: {
  id: string;
  nom: string;
  ville: string | null;
  activite: string | null;
  site: string | null;
  secteur: string | null;
  email: string | null;
  telephone: string | null;
  nbAvis: number | null;
  dirigeant: string | null;
  linkedin: string | null;
  effectif: number | null;
}): Promise<{ ok: boolean; score?: number | null; error?: string }> {
  const { statut, signals, contacts } = await analyzeSite(p.site);
  const visuel = await analyseVisuelle(p.site);
  const villeDansTitre =
    p.ville && signals.title ? signals.title.toLowerCase().includes(p.ville.toLowerCase()) : null;

  const ia = await auditerProspectPro({
    nom: p.nom,
    ville: p.ville,
    activite: p.activite,
    statutSite: statut,
    signaux: { ...signals, villeDansTitre },
    visuel,
    stylesUtilisateur: await stylesUtilisateur(),
  });
  if (!ia.ok) {
    await prisma.prospect.update({
      where: { id: p.id },
      data: { statutAudit: "erreur", note: ia.error?.slice(0, 300) ?? null },
    });
    return { ok: false, error: ia.error };
  }

  let dirigeant = "";
  let linkedin = "";
  let effectif: number | null = null;
  let signauxCroissance: string[] = [];
  if (ENRICH && (ia.data.score ?? 0) >= SCORE_ENRICH_MIN) {
    const e = await enrichirDirigeant({ nom: p.nom, ville: p.ville, activite: p.activite });
    dirigeant = e.dirigeant;
    linkedin = e.linkedin;
    effectif = e.effectif;
    signauxCroissance = e.signauxCroissance;
  }

  const telephoneFinal = p.telephone || contacts.phones[0] || null;
  const filtre = computeFiltrePro({
    besoin: besoinFortPro({
      pixelPublicitaire: signals.pixelPublicitaire,
      produitComplexe: ia.data.produitComplexe,
      concurrenceForte: ia.data.concurrenceForte,
    }),
    potentiel: scorePotentielPro({
      effectif: effectif ?? p.effectif,
      leveeDeFonds: signauxCroissance.includes("Levée de fonds"),
      caCroissance: signauxCroissance.includes("CA en croissance"),
      nbAvis: p.nbAvis,
    }),
    opportunite: scoreOpportunitePro(signals, ia.data.opportunites),
    croissance: scoreCroissance(signauxCroissance),
    acces: scoreAcces({
      bestEmail: contacts.bestEmail || p.email,
      linkedin: linkedin || p.linkedin,
      dirigeant: dirigeant || p.dirigeant,
      telephone: telephoneFinal,
    }),
  });

  await prisma.prospect.update({
    where: { id: p.id },
    data: {
      statutAudit: statut,
      score: ia.data.score,
      design: visuel ? `[${visuel.modernite}] ${visuel.constat}` : null,
      pointsFaibles: ia.data.opportunites.join(" • ") || null,
      accrocheEmail: ia.data.accrocheEmail || null,
      accrocheLinkedin: ia.data.accrocheLinkedin || null,
      email: contacts.bestEmail || p.email,
      emailsTous: contacts.emails.join(" ") || null,
      telephone: telephoneFinal,
      siret: contacts.siret,
      dirigeant: dirigeant || p.dirigeant,
      linkedin: linkedin || p.linkedin,
      effectif: effectif ?? p.effectif,
      signauxCroissance: signauxCroissance.join(" • ") || null,
      filtreBesoin: filtre.besoin,
      filtrePotentiel: filtre.potentiel.score,
      filtreProbleme: filtre.opportunite.score, // colonne réutilisée : « opportunité » en mode Pro
      filtreCroissance: filtre.croissance.score,
      filtreAcces: filtre.acces.score,
      filtreTotal: filtre.total,
      filtreTier: filtre.tier,
      filtreTrace: filtre.trace,
    },
  });

  revalidatePath(PAGE);
  return { ok: true, score: ia.data.score };
}

// Bascule un prospect entre segment « classique » et « pro » et le remet à auditer
// (le scoring et l'angle d'accroche diffèrent) → prochaine ouverture propose l'audit.
export async function basculerSegmentProspect(
  id: string,
): Promise<{ ok: boolean; segment?: string; error?: string }> {
  const p = await prisma.prospect.findUnique({ where: { id }, select: { segment: true, cible: true } });
  if (!p) return { ok: false, error: "Prospect introuvable." };
  if (p.cible === "partenaire") return { ok: false, error: "Segment inapplicable à un partenaire." };
  const segment = p.segment === "pro" ? "classique" : "pro";
  await prisma.prospect.update({
    where: { id },
    data: {
      segment,
      // On repart d'un audit neuf : les sous-scores changent de sémantique.
      statutAudit: "a_auditer",
      filtreTier: null,
      filtreTotal: null,
      filtreBesoin: null,
      filtrePotentiel: null,
      filtreProbleme: null,
      filtreCroissance: null,
      filtreAcces: null,
      filtreTrace: null,
    },
  });
  revalidatePath(PAGE);
  return { ok: true, segment };
}

// Audit d'un prospect : analyse site + DeepSeek (score + accroches) + enrichissement
// optionnel (Perplexity). Met à jour la ligne en base. Route vers le chemin
// « partenaire » (V2) ou « pro » (haut de gamme) selon la fiche.
export async function auditerUnProspect(
  id: string,
): Promise<{ ok: boolean; score?: number | null; error?: string }> {
  const p = await prisma.prospect.findUnique({ where: { id } });
  if (!p) return { ok: false, error: "Prospect introuvable." };

  if (p.cible === "partenaire") return auditerProspectPartenaire(p);
  if (p.segment === "pro") return auditerProspectProInterne(p);

  const { statut, signals, contacts } = await analyzeSite(p.site);
  // Analyse VISUELLE (capture + Gemini) : null si pas de clé/échec → l'accroche
  // retombe alors sur le « design couvert ». Sinon elle peut affirmer le design.
  const visuel = await analyseVisuelle(p.site);
  // SEO local : la ville du prospect apparaît-elle dans le title ? (sinon, levier)
  const villeDansTitre =
    p.ville && signals.title
      ? signals.title.toLowerCase().includes(p.ville.toLowerCase())
      : null;
  const ia = await auditerProspect({
    nom: p.nom,
    ville: p.ville,
    activite: p.activite,
    statutSite: statut,
    signaux: { ...signals, villeDansTitre },
    visuel,
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
  let effectif: number | null = null;
  let signauxCroissance: string[] = [];
  if (ENRICH && (ia.data.score ?? 0) >= SCORE_ENRICH_MIN) {
    const e = await enrichirDirigeant({ nom: p.nom, ville: p.ville, activite: p.activite });
    dirigeant = e.dirigeant;
    linkedin = e.linkedin;
    effectif = e.effectif;
    signauxCroissance = e.signauxCroissance;
  }

  // Filtre en or : score structuré (probabilité de signer un récurrent), calculé
  // à partir des signaux déterministes + de l'enrichissement quand il a tourné.
  // Besoin en GATE (niche) ; les autres sous-scores dégradent proprement (potentiel
  // retombe sur le nombre d'avis, croissance à 0 sans enrichissement).
  const telephoneFinal = p.telephone || contacts.phones[0] || null;
  const filtre = computeFiltre({
    besoin: besoinFortDuSecteur(p.secteur),
    potentiel: scorePotentiel({ effectif: effectif ?? p.effectif, nbAvis: p.nbAvis }),
    probleme: scoreProbleme(signals, { villeDansTitre, statut }),
    croissance: scoreCroissance(signauxCroissance),
    acces: scoreAcces({
      bestEmail: contacts.bestEmail || p.email,
      linkedin: linkedin || p.linkedin,
      dirigeant: dirigeant || p.dirigeant,
      telephone: telephoneFinal,
    }),
  });

  await prisma.prospect.update({
    where: { id },
    data: {
      statutAudit: statut,
      score: ia.data.score,
      // Verdict visuel réel prioritaire sur l'hypothèse déduite des signaux.
      design: (visuel ? `[${visuel.modernite}] ${visuel.constat}` : ia.data.design) || null,
      anciennete: ia.data.anciennete || null,
      pointsFaibles: ia.data.pointsFaibles.join(" • ") || null,
      accrocheEmail: ia.data.accrocheEmail || null,
      accrocheLinkedin: ia.data.accrocheLinkedin || null,
      email: contacts.bestEmail || p.email,
      emailsTous: contacts.emails.join(" ") || null,
      telephone: telephoneFinal,
      siret: contacts.siret,
      dirigeant: dirigeant || p.dirigeant,
      linkedin: linkedin || p.linkedin,
      effectif: effectif ?? p.effectif,
      signauxCroissance: signauxCroissance.join(" • ") || null,
      filtreBesoin: filtre.besoin,
      filtrePotentiel: filtre.potentiel.score,
      filtreProbleme: filtre.probleme.score,
      filtreCroissance: filtre.croissance.score,
      filtreAcces: filtre.acces.score,
      filtreTotal: filtre.total,
      filtreTier: filtre.tier,
      filtreTrace: filtre.trace,
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
    take: AUDIT_LOT,
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
    p.cible === "partenaire"
      ? `Partenaire (apporteur d'affaires)${p.metier ? ` : ${metierByCle(p.metier)?.label ?? p.metier}` : ""}`
      : null,
    p.score != null ? `Score prospection : ${p.score}/100` : null,
    p.atouts ? `Atouts partenariat : ${p.atouts}` : null,
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
  revalidatePath("/prospection");
}

// « Mail envoyé » : entre dans le pipeline. Enregistre le message RÉELLEMENT
// envoyé (édité par l'user, défaut = accroche) → DeepSeek apprend son style.
// Planifie une relance à +5 jours.
export async function marquerContacte(
  id: string,
  message?: string,
  canal: string = "email",
): Promise<{ ok: boolean; error?: string }> {
  const now = new Date();
  const relance = prochaineRelance(now);
  await prisma.prospect.update({
    where: { id },
    data: {
      statut: "contacte",
      canalContact: canal,
      contacteLe: now,
      relanceLe: relance,
      relanceFaiteLe: null,
      messageEnvoye: message?.trim() ? message.trim() : undefined,
    },
  });
  revalidatePath(PAGE);
  revalidatePath("/prospection");
  return { ok: true };
}

// « Relance faite » : reconduit la relance à +5 jours et incrémente le compteur.
export async function marquerRelanceFaite(id: string): Promise<void> {
  const now = new Date();
  const relance = prochaineRelance(now);
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

// --- Envoi de campagne (SMTP) ---

// Corrige/renseigne l'email d'un prospect (saisie inline avant campagne).
export async function updateEmailProspect(
  id: string,
  email: string,
): Promise<{ ok: boolean; error?: string }> {
  const clean = email.trim();
  if (clean && !emailValide(clean)) return { ok: false, error: "Email invalide." };
  await prisma.prospect.update({ where: { id }, data: { email: clean || null } });
  revalidatePath(PAGE);
  return { ok: true };
}

// Teste la connexion SMTP (bouton dédié).
export async function testerConnexionSmtp(): Promise<{ ok: boolean; error?: string }> {
  return verifierSmtp();
}

// Envoie un mail de test (format + délivrabilité) sans rien marquer en base.
export async function envoyerMailTest(
  destinataire?: string,
): Promise<{ ok: boolean; error?: string }> {
  const to = destinataire?.trim() || process.env.SMTP_USER || "";
  if (!emailValide(to)) return { ok: false, error: "Destinataire de test invalide." };
  const reglage = await ensureReglage();
  const accroche =
    "Objet : Test d'envoi Relmo\n\nBonjour, ceci est un test d'envoi depuis Relmo. " +
    "Si tu lis ce message, la configuration SMTP fonctionne. Le lien [lien d'une réalisation] " +
    "sera remplacé automatiquement si tu l'as renseigné.";
  const { objet, corps } = construireEmail(accroche, reglage);
  return sendMail({ to, subject: `[TEST] ${objet}`, text: corps });
}

// Envoie le mail d'un prospect et le fait entrer dans le pipeline. Appelé une fois
// par prospect par l'orchestrateur client (throttle côté UI → pas de timeout
// serverless). `accrocheOverride` = message édité dans l'UI (sinon accrocheEmail).
export async function envoyerMailProspect(
  id: string,
  accrocheOverride?: string,
): Promise<{ ok: boolean; error?: string }> {
  if (!smtpConfigured()) {
    return { ok: false, error: "SMTP non configuré (renseigne SMTP_* dans .env)." };
  }
  const p = await prisma.prospect.findUnique({ where: { id } });
  if (!p) return { ok: false, error: "Prospect introuvable." };
  // Garde-fou serveur (pas seulement UI) : concurrent = stop, agence = manuel.
  if (p.flagConcurrent) {
    return { ok: false, error: "Fiche flaggée concurrent : aucun envoi automatique." };
  }
  if (p.flagAQualifier) {
    return { ok: false, error: "Fiche « à qualifier manuellement » : pas d'envoi automatique." };
  }
  if (!emailValide(p.email)) return { ok: false, error: "EMAIL_INVALIDE" };

  const accroche = accrocheOverride?.trim() || p.accrocheEmail || "";
  if (!accroche) return { ok: false, error: "Pas de message (audite d'abord le prospect)." };

  const reglage = await ensureReglage();
  const { objet, corps } = construireEmail(accroche, reglage);
  if (!objet) {
    return { ok: false, error: "Objet manquant (le message doit commencer par « Objet : … »)." };
  }

  const res = await sendMail({ to: p.email!, subject: objet, text: corps });
  if (!res.ok) return res;

  const now = new Date();
  const relance = prochaineRelance(now);
  await prisma.prospect.update({
    where: { id },
    data: {
      statut: "contacte",
      canalContact: "email",
      contacteLe: now,
      relanceLe: relance,
      relanceFaiteLe: null,
      messageEnvoye: corps,
      dernierMessageId: res.messageId ?? undefined,
      dernierObjet: objet,
    },
  });
  revalidatePath(PAGE);
  revalidatePath("/prospection");
  return { ok: true };
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
    Cible: p.cible === "partenaire" ? "Partenaire" : "Client",
    Métier: p.metier ? (metierByCle(p.metier)?.label ?? p.metier) : "",
    Activité: p.activite ?? "",
    Secteur: secteurByCle(p.secteur ?? "")?.label ?? p.secteur ?? "",
    Ville: p.ville ?? "",
    Région: p.region ?? "",
    Score: p.score ?? "",
    Flags: [p.flagConcurrent ? "concurrent" : "", p.flagAQualifier ? "à qualifier" : ""]
      .filter(Boolean)
      .join(" + "),
    Atouts: p.atouts ?? "",
    Nb_avis_Google: p.nbAvis ?? "",
    Constat_design: p.design ?? "",
    Ancienneté: p.anciennete ?? "",
    Points_faibles: p.pointsFaibles ?? "",
    Email: p.email ?? "",
    Téléphone: p.telephone ?? "",
    Site: p.site ?? "",
    Campagne: p.campagne ?? "",
    Statut: p.statut,
    Canal: p.canalContact ?? "",
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
