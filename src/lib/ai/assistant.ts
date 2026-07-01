import { prisma } from "@/lib/db";
import { chat, type AiMessage, type AiResult } from "@/lib/ai/client";
import { ensureObjectif, computeObjectif } from "@/lib/objectif";
import { euros } from "@/lib/format";
import { labelOf, SOURCES, CANAUX, DEVIS_STATUTS } from "@/lib/constants";
import { currentPeriode } from "@/lib/periode";
import { currentWeek } from "@/lib/semaine";

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
    where: { statut: "actif", dateDebut: { lte: new Date() }, facturationDemarree: true },
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

// --- Suggestions de tâches par l'IA, à partir de TOUT le profil (DeepSeek) ---
export type TacheSuggeree = {
  libelle: string;
  categorie: string; // prospection | brand | perso | admin | technique | autre
  priorite: string; // basse | normale | haute
  pourquoi?: string;
};

export async function suggererTaches(): Promise<
  { ok: true; taches: TacheSuggeree[] } | { ok: false; error: string }
> {
  const periode = currentPeriode();
  const semaine = currentWeek();

  const [objectif, mrrAgg, devisOuverts, devisDecided, prospects, livrablesRetard, dejaFait] =
    await Promise.all([
      ensureObjectif(),
      prisma.contrat.aggregate({
        _sum: { montantMensuel: true },
        where: { statut: "actif", dateDebut: { lte: new Date() }, facturationDemarree: true },
      }),
      prisma.devis.findMany({
        where: { statut: { in: ["brouillon", "envoye", "en_nego"] } },
        include: { client: { select: { nom: true } } },
        orderBy: { updatedAt: "desc" },
        take: 12,
      }),
      prisma.devis.findMany({
        where: { statut: { in: ["accepte", "refuse", "expire"] } },
        select: { statut: true },
      }),
      prisma.client.count({ where: { statut: "prospect" } }),
      prisma.livrable.count({ where: { periode, statut: "a_faire" } }),
      prisma.tache.findMany({ where: { semaine }, select: { libelle: true } }),
    ]);

  const mrr = mrrAgg._sum.montantMensuel ?? 0;
  const c = computeObjectif(objectif, mrr);
  const gagnes = devisDecided.filter((d) => d.statut === "accepte").length;
  const perdus = devisDecided.length - gagnes;
  const tauxSignature =
    gagnes + perdus > 0 ? Math.round((gagnes / (gagnes + perdus)) * 100) : null;

  const pipeline = devisOuverts.length
    ? devisOuverts
        .map(
          (d) =>
            `- ${d.client.nom} · ${d.libelle} · ${euros(d.montantMensuelPropose)}/mois · ${labelOf(DEVIS_STATUTS, d.statut)}${d.dateRelance ? ` · relance ${d.dateRelance.toISOString().slice(0, 10)}` : ""}`,
        )
        .join("\n")
    : "aucun devis ouvert";

  const contexte = [
    `MRR actuel : ${euros(mrr)} / cible ${euros(objectif.montantCible)} (${c.statutLabel}, ${c.moisRestants} mois restants).`,
    `Rythme requis : +${Math.round(c.rythmeRequis)} €/mois.`,
    `Prospects actifs : ${prospects}. Taux de signature : ${tauxSignature !== null ? tauxSignature + "%" : "n/d"} (${gagnes} gagnés, ${perdus} perdus).`,
    `Livrables à faire ce mois : ${livrablesRetard}.`,
    `Pipeline (devis ouverts) :\n${pipeline}`,
    `Déjà dans ma to-do cette semaine :\n${dejaFait.map((t) => `- ${t.libelle}`).join("\n") || "(vide)"}`,
  ].join("\n");

  const messages: AiMessage[] = [
    {
      role: "system",
      content:
        VOIX +
        " Tu es le coach business de ce freelance : tu transformes sa situation en actions concrètes du jour.",
    },
    {
      role: "user",
      content:
        `À partir de mon profil ci-dessous, propose 4 à 6 tâches CONCRÈTES et actionnables pour cette semaine, ` +
        `priorisées sur l'écart à mon objectif de MRR. Réponds UNIQUEMENT en JSON : ` +
        `{"taches":[{"libelle":"...","categorie":"prospection|brand|perso|admin|technique|autre","priorite":"basse|normale|haute","pourquoi":"1 phrase"}]}. ` +
        `Sois spécifique à MA situation (cite des montants, des noms de prospects/devis quand c'est pertinent). ` +
        `Ne répète pas ce qui est déjà dans ma to-do. Varie les catégories (prospection, image de marque, perso, admin…).\n\n` +
        `Mon profil :\n${contexte}`,
    },
  ];

  const res = await chat({
    provider: "deepseek",
    jsonMode: true,
    temperature: 0.6,
    maxTokens: 900,
    messages,
  });
  if (!res.ok) return res;

  try {
    const raw = JSON.parse(res.text);
    const arr = Array.isArray(raw?.taches) ? raw.taches : [];
    const taches: TacheSuggeree[] = arr
      .filter((t: unknown): t is Record<string, unknown> => !!t && typeof t === "object")
      .map((t: Record<string, unknown>) => ({
        libelle: String(t.libelle ?? "").trim(),
        categorie: String(t.categorie ?? "autre"),
        priorite: String(t.priorite ?? "normale"),
        pourquoi: t.pourquoi ? String(t.pourquoi) : undefined,
      }))
      .filter((t: TacheSuggeree) => t.libelle.length > 0);
    return { ok: true, taches };
  } catch {
    return { ok: false, error: "Réponse IA illisible (JSON invalide)." };
  }
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

// --- Audit commercial d'un prospect (DeepSeek, mode JSON) ---
// À partir des signaux techniques bruts d'un site, produit un score + des accroches.
// Réutilise le socle chat() ; dégrade proprement sans clé DeepSeek.
export type ProspectAudit = {
  score: number | null;
  design: string;
  anciennete: string;
  pointsFaibles: string[];
  accrocheEmail: string;
  accrocheLinkedin: string;
};

const SYS_AUDIT =
  "Tu es l'assistant de prospection d'un développeur web freelance basé à Angers (49). " +
  "Il crée des sites modernes (Next.js, SEO local, performance) pour des entreprises locales. " +
  "À partir des signaux techniques bruts d'un site prospect, tu produis une évaluation commerciale et deux accroches.\n" +
  "Règles :\n" +
  "- Réponds UNIQUEMENT en JSON valide.\n" +
  "- Français, ton naturel, professionnel et chaleureux, JAMAIS de flatterie générique.\n" +
  "- Accroches COURTES (2-4 phrases), centrées sur 1-2 problèmes concrets repérés + le bénéfice. Pas de jargon.\n" +
  "- Termine par une question légère ou une proposition simple (audit offert, échange de 15 min).\n" +
  "- Si pas de site : angle « vous n'apparaissez pas en ligne / pas de site = clients perdus ».\n" +
  "- ANGLE PRIORITAIRE = modernisation / design daté. Tu ne vois PAS de capture d'écran : " +
  "déduis l'obsolescence des signaux et NOMME-la explicitement dans l'accroche quand ils l'indiquent :\n" +
  "  · `derniereAnneeVisible` ancienne (≤ année en cours - 2) → « votre site date visiblement de {année}, il a besoin d'un coup de neuf ».\n" +
  "  · `viewport` absent → le site n'est PAS adapté au mobile (argument fort : la majorité des visiteurs sont sur téléphone).\n" +
  "  · `jquery` présent ou `generator` daté (vieux WordPress/Wix, etc.) → techno vieillissante, design et performance à la traîne.\n" +
  "  · beaucoup d'`imgSansAlt`, `poidsHtmlKo` élevé, pas de `structuredData`/`ogTags` → SEO et image de marque en souffrance.\n" +
  "  Quand plusieurs de ces signaux sont présents, l'accroche DOIT mener avec « site daté / à moderniser côté design et mobile », " +
  "c'est l'argument n°1. Reste honnête : parle des signaux, ne prétends pas avoir vu le rendu visuel.\n" +
  'Schéma : {"score":<0-100>,"design":"<1 phrase>","anciennete":"<1 phrase>","points_faibles":["..."],"accroche_email":"...","accroche_linkedin":"..."}';

export async function auditerProspect(input: {
  nom: string;
  ville?: string | null;
  activite?: string | null;
  statutSite: string;
  signaux: unknown;
  stylesUtilisateur?: string[]; // messages déjà envoyés par l'user → imiter son style
}): Promise<{ ok: true; data: ProspectAudit } | { ok: false; error: string }> {
  // Si l'utilisateur a déjà envoyé des messages, on les donne en exemples de
  // style pour que les accroches sonnent comme lui (cf. apprentissage du ton).
  const styleBloc =
    input.stylesUtilisateur && input.stylesUtilisateur.length
      ? "\n\nVoici des messages que l'utilisateur a RÉELLEMENT envoyés — imite son ton, " +
        "son vocabulaire et sa longueur, sans recopier :\n" +
        input.stylesUtilisateur.map((m, i) => `Exemple ${i + 1} : « ${m} »`).join("\n")
      : "";

  const res = await chat({
    provider: "deepseek",
    jsonMode: true,
    temperature: 0.5,
    maxTokens: 700,
    messages: [
      { role: "system", content: SYS_AUDIT + styleBloc },
      {
        role: "user",
        content:
          "Signaux du prospect :\n" +
          JSON.stringify(
            {
              entreprise: input.nom,
              ville: input.ville ?? "",
              activite: input.activite ?? "",
              statut_site: input.statutSite,
              signaux: input.signaux,
            },
            null,
            2,
          ),
      },
    ],
  });
  if (!res.ok) return res;

  try {
    const raw = JSON.parse(res.text);
    const score = Number(raw.score);
    return {
      ok: true,
      data: {
        score: Number.isFinite(score) ? Math.max(0, Math.min(100, Math.round(score))) : null,
        design: typeof raw.design === "string" ? raw.design.trim() : "",
        anciennete: typeof raw.anciennete === "string" ? raw.anciennete.trim() : "",
        pointsFaibles: Array.isArray(raw.points_faibles)
          ? raw.points_faibles.map((p: unknown) => String(p)).filter(Boolean)
          : [],
        accrocheEmail: typeof raw.accroche_email === "string" ? raw.accroche_email.trim() : "",
        accrocheLinkedin: typeof raw.accroche_linkedin === "string" ? raw.accroche_linkedin.trim() : "",
      },
    };
  } catch {
    return { ok: false, error: "Réponse IA illisible (JSON invalide)." };
  }
}

// --- Enrichissement dirigeant + LinkedIn (Perplexity, optionnel) ---
export async function enrichirDirigeant(input: {
  nom: string;
  ville?: string | null;
  activite?: string | null;
}): Promise<{ dirigeant: string; linkedin: string }> {
  const q =
    `Qui dirige l'entreprise "${input.nom}"${input.ville ? " à " + input.ville : ""} ` +
    `(${input.activite ?? ""}) ? Donne uniquement : nom complet du dirigeant et l'URL de son ` +
    `profil LinkedIn s'il existe. Si tu ne sais pas, dis-le.`;
  const res = await chat({
    provider: "perplexity",
    temperature: 0.2,
    maxTokens: 300,
    messages: [{ role: "user", content: q }],
  });
  if (!res.ok) return { dirigeant: "", linkedin: "" };
  const linkedin = (res.text.match(/https?:\/\/(?:[a-z]{2,3}\.)?linkedin\.com\/[^\s)"]+/i) ?? [])[0] ?? "";
  return { dirigeant: res.text.split("\n")[0].slice(0, 120), linkedin };
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
