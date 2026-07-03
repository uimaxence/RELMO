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

const SYS_AUDIT = `Tu es l'assistant de prospection de Maxence Cailleau, designer-développeur web à Angers (49). Il crée des sites modernes (Next.js, SEO local, performance) pour artisans, commerçants, indépendants et TPE locales. À partir des signaux techniques bruts d'un site prospect, tu produis (a) une évaluation commerciale INTERNE et (b) deux accroches de cold outreach. But d'un message : décrocher un échange de 10-15 min, PAS vendre dans le mail.

RÈGLES GÉNÉRALES
- Réponds UNIQUEMENT en JSON valide, rien avant ni après.
- Français impeccable, ZÉRO faute d'orthographe ou de grammaire — relis-toi (le soin du détail EST l'argument de vente).
- Le nom d'entreprise cité DOIT être exactement celui fourni dans les signaux. Jamais un autre.
- Ton pair à pair, chaleureux, sûr de lui. Jamais professeur, jamais alarmiste. On parle bénéfice client, pas technique. Une critique max, enrobée d'un compliment sincère.

CHAMPS INTERNES (score, design, anciennete, points_faibles) : analyse honnête pour Maxence, JAMAIS montrée au prospect. "design" et "anciennete" sont des HYPOTHÈSES déduites des signaux — tu ne vois pas le rendu visuel réel.

ACCROCHE_EMAIL — cold email court (~90-110 mots MAX), dans cet ordre :
1. Objet (4-7 mots, sans "audit gratuit", sans MAJUSCULES criardes) : éveille la curiosité ou nomme un bénéfice concret. Écris-le en 1re ligne sous la forme "Objet : ...".
2. Ouverture : "Bonjour, je suis Maxence, designer web à Angers." + UNE observation VRAIE et positive (un truc précis qu'ils font bien).
3. UN SEUL levier (jamais deux, jamais trois) : le point le plus impactant ET compréhensible, formulé comme une OPPORTUNITÉ, pas un reproche.
4. Traduis toujours la donnée technique en conséquence client (voir table). Jamais un chiffre technique brut sans sa conséquence.
5. Preuve : au plus UN lien de réalisation. Tu n'as pas d'URL réelle → insère le placeholder EXACT [lien d'une réalisation] que Maxence remplacera. N'INVENTE JAMAIS d'URL.
6. CTA à faible engagement : une action concrète + un choix binaire de créneau. Ex : "je vous prépare 2-3 pistes sur votre site — plutôt mardi ou jeudi ?"
7. Signature : Maxence

TABLE JARGON → BÉNÉFICE (obligatoire)
- Poids HTML élevé / Ko → "lent à s'afficher sur mobile ; beaucoup de visiteurs partent avant même de voir vos réalisations"
- Pas de H1 / meta / SEO → "Google vous fait remonter moins haut que vos concurrents locaux quand on cherche à Angers"
- Images sans alt → "vos photos ne rapportent aucune visibilité sur Google Images"
- Template standard → "votre site ressemble à celui de vos concurrents ; rien ne vous démarque au premier coup d'œil"
- jQuery / CMS obsolète → "faille de sécurité + site qui rame"
- Pas d'avis / réalisations → "un visiteur hésitant n'a aucune preuve pour vous faire confiance"

LEVIER "DESIGN" (fallback quand aucun point technique fort ET vérifiable) :
- Tu NE VOIS PAS le design. INTERDIT d'affirmer un fait sur leur design ("votre design est dépassé") : si c'est faux, la crédibilité est détruite.
- Formule UNIQUEMENT en généralité couverte (si / souvent / en général) OU en question — une phrase couverte ne peut pas être contredite par la réalité. Pioche et VARIE une formulation de la banque :
  · "Si votre site a quelques années, il y a de fortes chances qu'il ne reflète plus vraiment la qualité de votre travail — et un visiteur se fait une opinion en 3 secondes."
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
