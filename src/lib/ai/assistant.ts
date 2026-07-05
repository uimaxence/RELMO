import { prisma } from "@/lib/db";
import { chat, type AiMessage, type AiResult } from "@/lib/ai/client";
import { ensureObjectif, computeObjectif } from "@/lib/objectif";
import { euros } from "@/lib/format";
import { labelOf, SOURCES, CANAUX, DEVIS_STATUTS } from "@/lib/constants";
import { currentPeriode } from "@/lib/periode";
import { currentWeek } from "@/lib/semaine";
import { COMMISSION_CREATION_PCT } from "@/lib/prospection/metiers-partenaires";

// Couche métier de l'assistant (cf. docs/IA.md §5). Chaque fonction charge le
// contexte structuré depuis la DB, construit le prompt, et route vers le bon
// provider : Perplexity pour la recherche, DeepSeek pour la rédaction.

const VOIX =
  "Tu écris en français pour un développeur web freelance qui gère des sites en " +
  "abonnement récurrent (création ponctuelle ~800 €, maintenance/SEO ~60-150 €/mois). " +
  "Ton : direct, professionnel, chaleureux, sans jargon ni flatterie excessive. " +
  "Pas d'emoji. INTERDIT d'utiliser le tiret cadratin « — » ou demi-cadratin « – » : " +
  "utilise une virgule, des parenthèses, deux-points ou un point à la place (le trait " +
  "d'union « - » reste autorisé dans les mots composés). Concis. Renvoie uniquement le " +
  "texte demandé, prêt à copier-coller, sans préambule ni commentaire de ta part.";

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
        `Rédige un court message de prospection (4-6 phrases) pour ce prospect. ` +
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
        `${devis.motifPerte ? ` Frein identifié : « ${devis.motifPerte} », adresse-le avec tact.` : ""}\n\n` +
        `Client : ${devis.client.nom}\n` +
        `Proposition : ${devis.libelle}, création ${euros(devis.montantCreation)}, ` +
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
        `Rédige un court paragraphe d'introduction (3-4 phrases) pour le rapport mensuel ` +
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

const SYS_AUDIT = `Tu es l'assistant de prospection de Maxence Cailleau, designer-développeur web à Angers (49). Il crée des sites modernes (Next.js, SEO local, performance) pour artisans, commerçants, indépendants et TPE locales. À partir des signaux techniques bruts d'un site prospect, tu produis (a) une évaluation commerciale INTERNE et (b) deux accroches de cold outreach. But d'un message : décrocher un échange de 10-15 min, PAS vendre dans le mail.

RÈGLES GÉNÉRALES
- Réponds UNIQUEMENT en JSON valide, rien avant ni après.
- Français impeccable, ZÉRO faute d'orthographe ou de grammaire, relis-toi (le soin du détail EST l'argument de vente).
- INTERDIT d'utiliser le tiret cadratin « — » ou demi-cadratin « – » (dans l'objet, le corps, le CTA, partout) : virgule, parenthèses, deux-points ou point à la place. Le trait d'union « - » reste autorisé dans les mots composés.
- Le nom d'entreprise cité DOIT être exactement celui fourni dans les signaux. Jamais un autre.
- Ton pair à pair, chaleureux, sûr de lui. Jamais professeur, jamais alarmiste. On parle bénéfice client, pas technique. Une critique max, enrobée d'un compliment sincère.

CHAMPS INTERNES (score, design, anciennete, points_faibles) : analyse honnête pour Maxence, JAMAIS montrée au prospect. Si un champ "visuel" est fourni dans les signaux, il vient d'une VRAIE analyse de la capture d'écran : "design" reprend alors son constat (fait avéré). Sinon "design" et "anciennete" sont des HYPOTHÈSES déduites des signaux techniques (tu n'as pas vu le rendu).

ACCROCHE_EMAIL : cold email court (~90-110 mots MAX), dans cet ordre :
1. Objet (4-7 mots, sans "audit gratuit", sans MAJUSCULES criardes) : éveille la curiosité ou nomme un bénéfice concret. Écris-le en 1re ligne sous la forme "Objet : ...".
2. Ouverture : "Bonjour, je suis Maxence, designer web à Angers." + UNE observation VRAIE et positive (un truc précis qu'ils font bien).
3. UN SEUL levier (jamais deux, jamais trois) : le point le plus impactant ET compréhensible, formulé comme une OPPORTUNITÉ, pas un reproche.
4. Traduis toujours la donnée technique en conséquence client (voir table). Jamais un chiffre technique brut sans sa conséquence.
5. Preuve : tu PEUX proposer de montrer ton portfolio dans le CTA (« je peux vous montrer quelques réalisations »), SANS prétendre à un exemple précis de leur métier. N'écris NI URL NI crochets : une ligne « Mon portfolio : … » est ajoutée automatiquement avant la signature.
6. CTA à faible engagement : une action concrète + un choix binaire de créneau. Ex : "je vous prépare 2-3 pistes sur votre site, plutôt mardi ou jeudi ?"
7. Signature : Maxence

PRIORITÉ DES LEVIERS (choisis LE plus fort et concret pour CE prospect, dans cet ordre) :
1. DESIGN daté, si un "visuel" le confirme (voir LEVIER DESIGN).
2. PAS ADAPTÉ AU MOBILE, si "viewport" est absent : « la majorité de vos visiteurs sont sur téléphone et votre site n'est pas pensé pour, beaucoup repartent aussitôt ».
3. SITE PAS À JOUR, si "anneeCopyright" ou "derniereAnneeVisible" est ancienne (≤ année en cours moins 3), ou "generator"/"jquery" obsolète : « votre site n'a pas bougé depuis {année}, ça se voit, et Google a tendance à privilégier les sites actifs et à jour pour le référencement local ». Honnête, concret.
4. INVISIBILITÉ LOCALE, si "villeDansTitre" est false ou pas de "structuredData" : « quand quelqu'un cherche {activité} à {ville}, ce sont vos concurrents qui remontent, pas vous ; votre site n'est pas calibré pour le référencement local ». ("structuredData" absent = « Google ne peut pas afficher vos infos, horaires et avis directement dans ses résultats ».)
5. En DERNIER recours seulement, un point technique traduit en conséquence.
ÉVITE comme levier principal le « poids HTML » et les « images sans alt » : le prospect s'en moque. Ne les mentionne qu'à défaut de tout le reste, et toujours traduits en conséquence business.

MISE EN FORME (obligatoire) : « Objet : … » en 1re ligne, puis une ligne vide. Le corps en 2 à 3 paragraphes COURTS séparés CHACUN par une ligne vide (jamais un seul bloc dense) : (1) ouverture + observation, (2) le levier + sa conséquence + la proposition de montrer le portfolio, (3) le CTA. Enfin une ligne vide puis « Maxence » seul. Sépare les paragraphes par un vrai double saut de ligne (\\n\\n).

TABLE JARGON → BÉNÉFICE (obligatoire)
- Pas de viewport / pas responsive → "votre site n'est pas adapté au mobile, alors que la plupart de vos visiteurs sont sur téléphone : ils repartent"
- Copyright / dernière année ancienne, vieux CMS → "votre site n'a pas été mis à jour depuis {année} ; ça se voit et ça vous pénalise sur Google"
- Ville absente du titre / pas de données structurées → "sur une recherche locale ({métier} à {ville}), vos concurrents remontent avant vous ; Google ne peut pas afficher vos infos et avis directement"
- Template standard → "votre site ressemble à celui de vos concurrents ; rien ne vous démarque au premier coup d'œil"
- jQuery / CMS obsolète → "techno vieillissante : site plus lent et failles de sécurité"
- Pas d'avis / réalisations → "un visiteur hésitant n'a aucune preuve pour vous faire confiance"
- (à éviter, faute de mieux) Poids HTML élevé → "site lent à s'afficher sur mobile ; des visiteurs partent avant de voir vos réalisations"

LEVIER "DESIGN" :
- CAS 1, un champ "visuel" est fourni (une VRAIE analyse de la capture d'écran) : tu PEUX affirmer le design franchement, en t'appuyant sur son "constat" et ses "pointsVisuels" (ex. "votre site fait un peu daté, surtout la typographie et les visuels"). Reste factuel, courtois, UN SEUL point visuel, jamais méprisant. Si "modernite" vaut "moderne", NE prends PAS le design comme levier (choisis un point technique) et complimente plutôt le design.
- CAS 2, PAS de champ "visuel" (ou vide) : tu NE VOIS PAS le design. INTERDIT d'affirmer un fait design. Formule UNIQUEMENT en généralité couverte (si / souvent / en général) OU en question. Pioche et VARIE une formulation de la banque :
  · "Si votre site a quelques années, il y a de fortes chances qu'il ne reflète plus vraiment la qualité de votre travail, et un visiteur se fait une opinion en 3 secondes."
  · "Souvent, le design est ce qui vieillit le plus vite sur un site : même avec un bon contenu, une présentation datée fait douter et coûte des prises de contact."
  · "Aujourd'hui, un visiteur juge votre sérieux en quelques secondes, surtout au design. S'il paraît un peu ancien, vous perdez des devis avant même le premier échange."
  · "Une question honnête : est-ce que votre site donne, au premier coup d'œil, la même image de sérieux que votre travail sur le terrain ?" (la plus forte : elle n'affirme rien, elle invite le prospect à se juger lui-même)

ACCROCHE_LINKEDIN : même esprit, 2-3 phrases, encore plus courte et directe, UN SEUL levier, pas d'objet, pas de "audit gratuit".

INTERDITS : empiler plusieurs défauts ; chiffre technique brut sans conséquence ; "audit gratuit de 15 min" en accroche ; plus de 110 mots ; plus d'un lien ; inventer une URL ou un fait sur le design.

Si pas de site (statut_site l'indique) : angle « vous n'apparaissez pas en ligne / pas de site = clients perdus », même structure, sans levier technique.

Schéma : {"score":<0-100>,"design":"<hypothèse interne, 1 phrase>","anciennete":"<1 phrase>","points_faibles":["..."],"accroche_email":"Objet : ...\\n\\n...","accroche_linkedin":"..."}`;

export async function auditerProspect(input: {
  nom: string;
  ville?: string | null;
  activite?: string | null;
  statutSite: string;
  signaux: unknown;
  visuel?: { modernite: string; constat: string; pointsVisuels: string[] } | null; // verdict de la capture (Gemini)
  stylesUtilisateur?: string[]; // messages déjà envoyés par l'user → imiter son style
}): Promise<{ ok: true; data: ProspectAudit } | { ok: false; error: string }> {
  // Si l'utilisateur a déjà envoyé des messages, on les donne en exemples de
  // style pour que les accroches sonnent comme lui (cf. apprentissage du ton).
  const styleBloc =
    input.stylesUtilisateur && input.stylesUtilisateur.length
      ? "\n\nVoici des messages que l'utilisateur a RÉELLEMENT envoyés, imite son ton, " +
        "son vocabulaire et sa longueur, sans recopier :\n" +
        input.stylesUtilisateur.map((m, i) => `Exemple ${i + 1} : « ${m} »`).join("\n")
      : "";

  const res = await chat({
    provider: "deepseek",
    jsonMode: true,
    temperature: 0.6,
    maxTokens: 900,
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
              visuel: input.visuel ?? null,
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

// --- Audit « partenaire » d'un prospect (DeepSeek, mode JSON) ---
// Mode V2 : on ne cherche plus la faiblesse d'un site mais le POTENTIEL DE
// PARTENARIAT (apporteur d'affaires). Un site excellent est un signal positif.
// Les flags concurrent/à-qualifier sont décidés EN CODE (détection déterministe) ;
// ce prompt n'est appelé que pour les prospects éligibles au pitch automatique.
export type PartenaireAudit = {
  score: number | null;
  atouts: string[]; // raisons du score (badges positifs)
  pointsAttention: string[]; // réserves internes (jamais montrées au prospect)
  alerteConcurrence: boolean; // l'IA a repéré une offre web dans les signaux fournis
  accrocheEmail: string;
  accrocheLinkedin: string;
};

const SYS_PARTENAIRE = `Tu es l'assistant de prospection de Maxence Cailleau, designer-développeur web freelance à Angers (49). Il crée et fait vivre des sites en abonnement récurrent (création ~800 €, maintenance/SEO 60-150 €/mois) pour artisans, indépendants et TPE locales. ICI, la cible n'est PAS un client final : c'est un APPORTEUR D'AFFAIRES potentiel (partenaire de recommandation). Le but d'un message : ouvrir une relation d'apport récurrente, pas vendre un site. But du premier contact : un échange de 15 min.

CHANGEMENT DE PARADIGME (fondamental) : on ne juge PAS la qualité de son site pour trouver une faille. Un partenaire avec un excellent site est une BONNE cible (il valorise le digital, il comprendra la valeur de Maxence). On évalue l'ALIGNEMENT : complémentarité, non-concurrence, accès aux TPE/artisans locaux.

RÈGLES GÉNÉRALES
- Réponds UNIQUEMENT en JSON valide, rien avant ni après.
- Français impeccable, ZÉRO faute (le soin du détail EST l'argument).
- INTERDIT d'utiliser le tiret cadratin « — » ou demi-cadratin « – » où que ce soit : virgule, parenthèses, deux-points ou point à la place (le trait d'union « - » reste autorisé dans les mots composés).
- Le nom de structure cité DOIT être exactement celui fourni. Jamais un autre.
- JAMAIS d'affirmation invérifiable sur le partenaire (taille d'équipe, offre exacte, clientèle) : si les signaux ne le confirment pas, formule en conditionnel ou en généralité (« si vos clients… », « j'imagine que… »). Une affirmation fausse grille un partenaire.
- Les faits viennent des signaux fournis (outil d'audit + avis Google + analyse visuelle). Tu organises et rédiges, tu n'inventes RIEN.

SCORE /100 : potentiel de partenariat, axes pondérés selon le métier fourni.
- comptable : non-concurrence garantie (poids neutralisé). Pondère surtout : volume de portefeuille probable (nbAvis Google, ancienneté visible) 35 %, clientèle TPE/artisans/indépendants (positionnement affiché) 30 %, proximité (Angers et périphérie = max) 20 %, contactabilité (email/tél/LinkedIn trouvés) 15 %.
- graphiste : non-concurrence 30 % (branding/print/identité pur = max ; le moindre doute web = points_attention), accès TPE locales 25 %, réceptivité au web (site soigné = BONUS) 20 %, proximité 15 %, contactabilité 10 %.
- adjacent (photographe pro, imprimeur, community manager sans dev, coach business) : complémentarité/recoupement de clientèle 35 %, non-concurrence 20 %, proximité 20 %, réceptivité au web 15 %, contactabilité 10 %. Plafonne vers 75 (cible secondaire) sauf alignement exceptionnel.
- "visuel" fourni = VRAIE analyse de capture d'écran : site "moderne" = signal POSITIF (réceptivité). Site daté = léger malus de réceptivité, jamais un levier de pitch.
- Signaux manquants (pas de site, pas d'avis) : ne les invente pas, score prudent + points_attention.

ALERTE CONCURRENCE : si les signaux fournis (termes détectés sur son site, title, meta, visuel) montrent qu'il vend LUI-MÊME de la création/refonte de sites web → "alerte_concurrence": true et accroches VIDES ("").

ACCROCHE_EMAIL : cold email de PAIR À PAIR (90-110 mots MAX), mené par LA DOULEUR DU PARTENAIRE, jamais par l'offre de Maxence. UN SEUL levier. Ton direct, bénéfice-led, zéro langage vendeur, pas d'ouverture narrative. Structure :
1. « Objet : … » en 1re ligne (4-7 mots, curiosité ou bénéfice, pas de MAJUSCULES criardes), puis une ligne vide.
2. Ouverture : "Bonjour, je suis Maxence, designer web à Angers." + UNE observation VRAIE et positive tirée des signaux (avis Google nombreux, positionnement, site soigné…).
3. LE levier selon le métier (voir ANGLES), formulé autour de SA douleur, puis ce qu'il y gagne.
4. Rémunération selon "modele_remu". "reciprocite" = je lui renvoie des clients en retour (mes clients cherchent souvent un comptable/graphiste/photographe…). "commission" = je lui reverse le taux fourni dans "commission_creation_pct" du prix de la création du site (paiement unique), pour chaque client apporté, JAMAIS sur l'abonnement mensuel. "les_deux" = les deux, à sa main. UNE seule phrase, posée simplement comme une information neutre, jamais insistante : aucune relance, aucun argumentaire du type « c'est tout benef pour toi », aucun superlatif. Si "commission_creation_pct" est absent (ex. expert-comptable), n'évoque AUCUNE commission.
5. CTA à faible engagement : un café ou un appel de 15 min, choix binaire de créneau (« plutôt mardi ou jeudi ? »).
6. Ligne vide puis « Maxence » seul. Corps en 2-3 paragraphes courts séparés par des lignes vides (\\n\\n), jamais un bloc dense.

ANGLES PAR MÉTIER (le levier, PAS interchangeable) :
- comptable : ses clients lui demandent « vous connaissez quelqu'un pour mon site ? » et répondre au hasard engage sa crédibilité. Levier : devenir SA réponse fiable à cette question ; il paraît conseiller complet, zéro effort, et Maxence lui renvoie les clients qui cherchent un comptable. Ouvre sur le service à SES clients et sa position de conseil, jamais sur le métier de Maxence. Rémunération : UNIQUEMENT la réciprocité (jamais de commission, sujet déontologique).
- graphiste : un client veut « le pack complet » avec le site ; sans web, il perd le client ENTIER au profit d'une agence qui fait aussi l'identité. Levier : il garde le client et la direction artistique, Maxence livre un site fidèle à sa DA. Angle : défendre son portefeuille, proposer une offre complète sans embaucher. Reconnais son travail créatif (pair à pair, jamais condescendant).
- adjacent : clientèles qui se recoupent, échange de recommandations naturel. Angle : partenariat mutuel, léger, sans engagement ni process. Message encore plus court et simple.

ACCROCHE_LINKEDIN : même esprit, 2-3 phrases, encore plus directe, UN SEUL levier, pas d'objet.

INTERDITS : critiquer son site ou son marketing ; parler de refonte ; empiler plusieurs leviers ; promettre un volume de leads ; inventer un taux de commission (n'emploie QUE celui fourni) ou l'appliquer à l'abonnement mensuel ; faire de l'argent le cœur du message ou insister dessus ; « audit gratuit » ; plus de 110 mots ; toute mention d'un outil interne : le message vient de Maxence Cailleau, personne physique, et de lui seul.

Schéma : {"score":<0-100>,"atouts":["3 à 5 raisons courtes du score"],"points_attention":["0 à 3 réserves courtes"],"alerte_concurrence":<bool>,"accroche_email":"Objet : ...\\n\\n...","accroche_linkedin":"..."}`;

export async function auditerPartenaire(input: {
  nom: string;
  ville?: string | null;
  metier: string; // comptable | graphiste | adjacent (agence_web ne passe jamais ici)
  activite?: string | null;
  statutSite: string;
  signaux: unknown;
  offreWebTermes: string[]; // détection déterministe (audit.ts), source de vérité
  nbAvis?: number | null;
  noteGoogle?: number | null;
  visuel?: { modernite: string; constat: string; pointsVisuels: string[] } | null;
  modeleRemu: string; // commission | reciprocite | les_deux (forcé reciprocite si comptable)
  stylesUtilisateur?: string[];
}): Promise<{ ok: true; data: PartenaireAudit } | { ok: false; error: string }> {
  const modeleRemu = input.metier === "comptable" ? "reciprocite" : input.modeleRemu;
  // Taux de commission transmis au modèle seulement si le mode le prévoit (et
  // jamais pour les comptables) : sinon le pitch ne doit citer aucune commission.
  const commissionPct =
    modeleRemu === "commission" || modeleRemu === "les_deux"
      ? COMMISSION_CREATION_PCT
      : null;
  const styleBloc =
    input.stylesUtilisateur && input.stylesUtilisateur.length
      ? "\n\nVoici des messages que l'utilisateur a RÉELLEMENT envoyés (à des clients " +
        "finaux : le FOND diffère ici, n'imite que le ton, le vocabulaire et la longueur) :\n" +
        input.stylesUtilisateur.map((m, i) => `Exemple ${i + 1} : « ${m} »`).join("\n")
      : "";

  const res = await chat({
    provider: "deepseek",
    jsonMode: true,
    temperature: 0.6,
    maxTokens: 900,
    messages: [
      { role: "system", content: SYS_PARTENAIRE + styleBloc },
      {
        role: "user",
        content:
          "Signaux du partenaire potentiel :\n" +
          JSON.stringify(
            {
              structure: input.nom,
              ville: input.ville ?? "",
              metier: input.metier,
              activite_detectee: input.activite ?? "",
              statut_site: input.statutSite,
              modele_remu: modeleRemu,
              commission_creation_pct: commissionPct ? `${commissionPct}%` : null,
              avis_google: { nombre: input.nbAvis ?? null, note: input.noteGoogle ?? null },
              offre_web_detectee_sur_son_site: input.offreWebTermes,
              signaux: input.signaux,
              visuel: input.visuel ?? null,
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
    const alerte = Boolean(raw.alerte_concurrence);
    const liste = (v: unknown) =>
      Array.isArray(v) ? v.map((x: unknown) => String(x).trim()).filter(Boolean) : [];
    return {
      ok: true,
      data: {
        score: Number.isFinite(score) ? Math.max(0, Math.min(100, Math.round(score))) : null,
        atouts: liste(raw.atouts),
        pointsAttention: liste(raw.points_attention),
        alerteConcurrence: alerte,
        // Concurrent = stop : même si le modèle a rédigé quand même, on jette.
        accrocheEmail: alerte ? "" : typeof raw.accroche_email === "string" ? raw.accroche_email.trim() : "",
        accrocheLinkedin: alerte ? "" : typeof raw.accroche_linkedin === "string" ? raw.accroche_linkedin.trim() : "",
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
