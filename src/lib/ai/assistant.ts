import { prisma } from "@/lib/db";
import { chat, type AiMessage, type AiResult } from "@/lib/ai/client";
import { ensureObjectif, computeObjectif } from "@/lib/objectif";
import { euros } from "@/lib/format";
import { labelOf, SOURCES, CANAUX } from "@/lib/constants";

// Couche métier de l'assistant (cf. docs/IA.md §5). Chaque fonction charge le
// contexte structuré depuis la DB, construit le prompt, et route vers le bon
// provider : Perplexity pour la recherche, DeepSeek pour la rédaction.

const VOIX =
  "Tu écris en français pour un développeur web freelance qui gère des sites en " +
  "abonnement récurrent (création ponctuelle ~800 €, maintenance/SEO ~60–150 €/mois). " +
  "Ton : direct, professionnel, chaleureux, sans jargon ni flatterie excessive. " +
  "Pas d'emoji. Concis. Renvoie uniquement le texte demandé, prêt à copier-coller, " +
  "sans préambule ni commentaire de ta part.";

// MRR actif courant (même définition que partout : contrats actifs démarrés).
async function mrrActuel(): Promise<number> {
  const agg = await prisma.contrat.aggregate({
    _sum: { montantMensuel: true },
    where: { statut: "actif", dateDebut: { lte: new Date() } },
  });
  return agg._sum.montantMensuel ?? 0;
}

// Contexte commun à un client/prospect (typé, pas du texte libre).
async function contexteClient(clientId: string) {
  return prisma.client.findUnique({
    where: { id: clientId },
    include: {
      sites: true,
      interactions: { orderBy: { date: "desc" }, take: 5 },
    },
  });
}

function decritClient(c: NonNullable<Awaited<ReturnType<typeof contexteClient>>>) {
  const lignes = [
    `Nom : ${c.nom}`,
    c.secteur ? `Secteur : ${c.secteur}` : null,
    `Statut : ${c.statut}`,
    c.source ? `Acquis via : ${labelOf(SOURCES, c.source)}` : null,
    c.sites.length
      ? `Sites : ${c.sites
          .map((s) => `${s.nom}${s.url ? ` (${s.url})` : ""}`)
          .join(", ")}`
      : "Aucun site enregistré",
    c.notes ? `Notes : ${c.notes}` : null,
  ].filter(Boolean);
  return lignes.join("\n");
}

// --- Prospection : recherche web (Perplexity) ---
export async function genererMessageProspection(
  clientId: string,
): Promise<AiResult> {
  const c = await contexteClient(clientId);
  if (!c) return { ok: false, error: "Client introuvable." };

  const site = c.sites.find((s) => s.url)?.url;
  const messages: AiMessage[] = [
    { role: "system", content: VOIX },
    {
      role: "user",
      content:
        `Rédige un court message de prospection (4–6 phrases) pour ce prospect. ` +
        `${
          site
            ? `Regarde son site (${site}) et son secteur pour personnaliser l'accroche avec un détail concret et juste. `
            : `Appuie-toi sur son secteur pour personnaliser l'accroche. `
        }` +
        `Objectif : décrocher un échange, pas vendre frontalement. Propose de la valeur ` +
        `(suivi/SEO/maintenance d'un site qui performe), finis par une question ouverte simple.\n\n` +
        `Prospect :\n${decritClient(c)}`,
    },
  ];

  return chat({ provider: "perplexity", messages, temperature: 0.6 });
}

// --- Brouillon de devis (DeepSeek) ---
export async function genererDevisBrouillon(
  clientId: string,
): Promise<AiResult> {
  const c = await contexteClient(clientId);
  if (!c) return { ok: false, error: "Client introuvable." };

  // Repère de pricing : moyenne des contrats actifs (pour rester cohérent).
  const contrats = await prisma.contrat.findMany({
    where: { statut: "actif", montantMensuel: { gt: 0 } },
    select: { montantMensuel: true },
  });
  const moyenne = contrats.length
    ? contrats.reduce((s, ct) => s + ct.montantMensuel, 0) / contrats.length
    : 0;

  const messages: AiMessage[] = [
    { role: "system", content: VOIX },
    {
      role: "user",
      content:
        `Rédige un brouillon de proposition commerciale (devis) pour ce client. Structure :\n` +
        `1) une phrase de contexte,\n` +
        `2) ce qui est inclus (création éventuelle + abonnement mensuel : contenu/SEO, maj sécurité, reporting),\n` +
        `3) une suggestion de montants : création ponctuelle et abonnement mensuel.\n\n` +
        `Stratégie tarifaire : privilégie un PALIER (offre à plus forte valeur, vise ~120 €/mois) ` +
        `plutôt qu'un abonnement plancher à 60 €.${
          moyenne ? ` Repère interne : abonnement moyen actuel ≈ ${euros(moyenne)}/mois.` : ""
        } ` +
        `Reste réaliste et justifie brièvement la valeur. Marque les montants comme indicatifs.\n\n` +
        `Client :\n${decritClient(c)}`,
    },
  ];

  return chat({ provider: "deepseek", messages, temperature: 0.4 });
}

// --- Relance de négo (DeepSeek), contextualisée par l'historique du devis ---
export async function genererRelanceNego(devisId: string): Promise<AiResult> {
  const devis = await prisma.devis.findUnique({
    where: { id: devisId },
    include: {
      client: true,
      interactions: { orderBy: { date: "desc" }, take: 5 },
    },
  });
  if (!devis) return { ok: false, error: "Devis introuvable." };

  const historique = devis.interactions.length
    ? devis.interactions
        .map(
          (it) =>
            `- ${labelOf(CANAUX, it.canal)} (${
              it.direction === "entrant" ? "reçu" : "envoyé"
            }) : ${it.resume}`,
        )
        .join("\n")
    : "Aucun échange journalisé.";

  const messages: AiMessage[] = [
    { role: "system", content: VOIX },
    {
      role: "user",
      content:
        `Rédige un message de relance court et non insistant pour faire avancer cette négo. ` +
        `Rappelle la valeur sans baisser le prix d'emblée, lève une objection probable, ` +
        `et propose une prochaine étape concrète (appel, réponse à une question).` +
        `${devis.motifPerte ? ` Frein identifié : « ${devis.motifPerte} » — adresse-le avec tact.` : ""}\n\n` +
        `Client : ${devis.client.nom}\n` +
        `Proposition : ${devis.libelle} — création ${euros(devis.montantCreation)}, ` +
        `mensuel ${euros(devis.montantMensuelPropose)}\n` +
        `Statut : ${devis.statut}\n` +
        `Derniers échanges :\n${historique}`,
    },
  ];

  return chat({ provider: "deepseek", messages, temperature: 0.5 });
}

// --- Intro de rapport mensuel client (DeepSeek), à partir du livré du mois ---
export async function genererIntroRapport(
  clientId: string,
  periode: string,
  livres: string[],
): Promise<AiResult> {
  const c = await prisma.client.findUnique({ where: { id: clientId } });
  if (!c) return { ok: false, error: "Client introuvable." };

  const liste = livres.length
    ? livres.map((l) => `- ${l}`).join("\n")
    : "Aucun livrable marqué fait sur la période.";

  const messages: AiMessage[] = [
    { role: "system", content: VOIX },
    {
      role: "user",
      content:
        `Rédige un court paragraphe d'introduction (3–4 phrases) pour le rapport mensuel ` +
        `destiné au client « ${c.nom} » (période ${periode}). Ton chaleureux et factuel, ` +
        `à la 1re personne (mon agence/moi → "nous" ou "je"), qui valorise le travail réalisé ` +
        `et rassure sur la valeur de l'abonnement. Appuie-toi sur ce qui a été livré :\n${liste}`,
    },
  ];

  return chat({ provider: "deepseek", messages, temperature: 0.5, maxTokens: 400 });
}

// --- Extraction d'un devis depuis le texte d'un PDF (DeepSeek, mode JSON) ---
export type DevisExtraction = {
  libelle?: string;
  montantCreation?: number;
  montantMensuelPropose?: number;
  note?: string;
};

function nombre(v: unknown): number | undefined {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") {
    const n = parseFloat(v.replace(/[^0-9.,]/g, "").replace(",", "."));
    return Number.isFinite(n) ? n : undefined;
  }
  return undefined;
}

export async function extraireDevisDepuisTexte(
  texte: string,
): Promise<
  { ok: true; data: DevisExtraction } | { ok: false; error: string }
> {
  if (!texte.trim()) return { ok: false, error: "PDF vide ou illisible." };

  const res = await chat({
    provider: "deepseek",
    jsonMode: true,
    temperature: 0,
    maxTokens: 600,
    messages: [
      {
        role: "system",
        content:
          "Tu extrais des données structurées d'un devis de prestation web. Réponds UNIQUEMENT en JSON valide.",
      },
      {
        role: "user",
        content:
          `Extrais de ce devis un objet JSON avec exactement ces clés :\n` +
          `- "libelle" : intitulé court de la prestation (string)\n` +
          `- "montantCreation" : montant € one-shot de création/setup (number, 0 si absent)\n` +
          `- "montantMensuelPropose" : montant € de l'abonnement mensuel (number, 0 si absent)\n` +
          `- "note" : points clés / ce qui est inclus (string court)\n` +
          `Montants en nombre, sans symbole ni séparateur de milliers. Texte du devis :\n\n${texte.slice(0, 6000)}`,
      },
    ],
  });

  if (!res.ok) return res;

  try {
    const raw = JSON.parse(res.text);
    return {
      ok: true,
      data: {
        libelle:
          typeof raw.libelle === "string" ? raw.libelle.trim() : undefined,
        montantCreation: nombre(raw.montantCreation),
        montantMensuelPropose: nombre(raw.montantMensuelPropose),
        note: typeof raw.note === "string" ? raw.note.trim() : undefined,
      },
    };
  } catch {
    return { ok: false, error: "Réponse IA illisible (JSON invalide)." };
  }
}

// --- Accroches de prospection pour la to-do du jour (DeepSeek) ---
// Calibrées sur l'écart à l'objectif MRR (cf. PROJET.md §11.2b).
export async function genererAccrochesProspection(): Promise<AiResult> {
  const [objectif, mrr] = await Promise.all([ensureObjectif(), mrrActuel()]);
  const c = computeObjectif(objectif, mrr);

  const messages: AiMessage[] = [
    { role: "system", content: VOIX },
    {
      role: "user",
      content:
        `Je dois prospecter aujourd'hui pour rester dans les temps vers mon objectif de MRR. ` +
        `Donne-moi un plan d'action prospection ultra-concret pour la journée :\n` +
        `1) un rappel d'1 phrase de l'enjeu chiffré,\n` +
        `2) 2 accroches courtes prêtes à envoyer (LinkedIn / mail), génériques mais incisives,\n` +
        `3) un rappel : viser un palier (~120 €/mois), pas du 60 €.\n\n` +
        `Chiffres : MRR actuel ${euros(mrr)} / cible ${euros(objectif.montantCible)}. ` +
        `Statut : ${c.statutLabel}. Rythme requis : +${Math.round(c.rythmeRequis)} €/mois sur ${c.moisRestants} mois.`,
    },
  ];

  return chat({ provider: "deepseek", messages, temperature: 0.6 });
}
