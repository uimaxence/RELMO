import { prisma } from "@/lib/db";
import { chat, type AiMessage, type AiResult } from "@/lib/ai/client";
import { ensureObjectif, computeObjectif } from "@/lib/objectif";
import { euros } from "@/lib/format";
import {
  labelOf,
  SOURCES,
  CANAUX,
  DEVIS_STATUTS,
  CIBLES_SITE,
  OBJECTIFS_SITE,
} from "@/lib/constants";
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

// --- Relance de prospection à froid (DeepSeek) ---
// Génère le message des relances automatiques (cron). Court, non insistant,
// cohérent avec le 1er mail. Commence par « Objet : … » pour être assemblé par
// construireEmail (signature + opt-out ajoutés ensuite, comme pour le 1er envoi).
export async function genererRelanceProspect(input: {
  nom: string;
  ville?: string | null;
  activite?: string | null;
  messagePrecedent?: string | null; // le 1er mail réellement envoyé
  numero: number; // 1 = 1re relance, 2 = 2e (et dernière)
}): Promise<AiResult> {
  const derniere = input.numero >= 2;
  const messages: AiMessage[] = [
    { role: "system", content: VOIX },
    {
      role: "user",
      content:
        `Rédige la ${derniere ? "deuxième et DERNIÈRE" : "première"} relance d'une prospection à froid, ` +
        `TRÈS courte (40 à 60 mots MAX), pour un prospect qui n'a pas répondu à un premier mail.\n` +
        `Règles :\n` +
        `- 1re ligne « Objet : ... » (4 à 6 mots, sans le mot « relance », un « Re : ... » léger convient).\n` +
        `- Rappelle en une phrase l'idée du 1er message, sans le recopier.\n` +
        `- UN SEUL angle neuf ou une question ouverte simple. Jamais insistant ni culpabilisant.\n` +
        (derniere
          ? `- Dernière relance : indique avec tact que tu n'insisteras plus, laisse la porte ouverte.\n`
          : `- Propose une prochaine étape à très faible engagement (un créneau, une réponse d'un mot).\n`) +
        `- Ni lien ni signature (ajoutés automatiquement). Deux courts paragraphes séparés par une ligne vide.\n\n` +
        `Prospect : ${input.nom}${input.ville ? `, ${input.ville}` : ""}${input.activite ? ` (${input.activite})` : ""}\n` +
        `Premier message envoyé :\n« ${(input.messagePrecedent ?? "").slice(0, 800)} »`,
    },
  ];
  return chat({ provider: "deepseek", messages, temperature: 0.6, maxTokens: 400 });
}

// --- Accueil de l'espace projet du portail client (DeepSeek) ---
// Rédige le texte d'accueil personnalisé affiché en haut du portail : qui est le
// client, l'objectif du projet, ce qu'on va faire. Brouillon édité par l'admin
// avant publication (jamais montré au client sans relecture).
export async function genererIntroPortail(clientId: string): Promise<AiResult> {
  const c = await prisma.client.findUnique({
    where: { id: clientId },
    include: {
      sites: true,
      interactions: { orderBy: { date: "desc" }, take: 5 },
      devis: {
        where: { statut: { in: ["envoye", "en_nego", "accepte"] } },
        orderBy: { updatedAt: "desc" },
        take: 3,
      },
      brief: true,
    },
  });
  if (!c) return { ok: false, error: "Client introuvable." };

  const devisBloc = c.devis.length
    ? c.devis
        .map(
          (d) =>
            `- ${d.libelle} (${labelOf(DEVIS_STATUTS, d.statut)}) : création ${euros(d.montantCreation)}, abonnement ${euros(d.montantMensuelPropose)}/mois${d.note ? `. Contenu : ${d.note}` : ""}`,
        )
        .join("\n")
    : "Aucun devis enregistré.";

  const briefBloc = c.brief?.rempliLe
    ? [
        c.brief.ciblePublic
          ? `Cible : ${labelOf(CIBLES_SITE, c.brief.ciblePublic)}${c.brief.cibleDetail ? ` (${c.brief.cibleDetail})` : ""}`
          : c.brief.cibleDetail
            ? `Cible : ${c.brief.cibleDetail}`
            : null,
        c.brief.objectifSite
          ? `Objectif n°1 du site : ${labelOf(OBJECTIFS_SITE, c.brief.objectifSite)}`
          : null,
        c.brief.daUnivers ? `Univers visuels choisis : ${c.brief.daUnivers}` : null,
        c.brief.daDetail ? `Direction artistique : ${c.brief.daDetail}` : null,
        c.brief.souhaits ? `Souhaits : ${c.brief.souhaits}` : null,
        c.brief.aEviter ? `À éviter : ${c.brief.aEviter}` : null,
      ]
        .filter(Boolean)
        .join("\n")
    : "";

  const messages: AiMessage[] = [
    { role: "system", content: VOIX },
    {
      role: "user",
      content:
        `Rédige le court texte d'accueil (4-6 phrases, un ou deux paragraphes) de l'espace ` +
        `projet en ligne du client « ${c.nom} ». Ce texte s'affiche en haut de son espace ` +
        `privé : adresse-toi directement à lui (vouvoiement), à la 1re personne (je = Maxence, ` +
        `son designer web). Contenu : souhaite-lui la bienvenue dans son espace, résume ` +
        `l'objectif du projet et ce qu'on va faire concrètement (sans jargon, sans montants), ` +
        `et invite-le à remplir le petit questionnaire de démarrage (5 minutes) plus bas sur ` +
        `la page s'il ne l'a pas déjà fait. Ton chaleureux, léger, rassurant. Pas de titre, ` +
        `pas de "Objet :", juste le texte.\n\n` +
        `Client :\n${decritClient(c)}\n\nDevis / prestation prévue :\n${devisBloc}` +
        (briefBloc ? `\n\nBrief déjà rempli par le client :\n${briefBloc}` : ""),
    },
  ];

  return chat({ provider: "deepseek", messages, temperature: 0.5, maxTokens: 500 });
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
  clientNom?: string;
  clientEmail?: string;
  clientTelephone?: string;
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
          `- "clientNom" : nom du client destinataire du devis, entreprise ou personne (string, "" si absent). Attention : PAS l'émetteur du devis (Maxence Cailleau), le DESTINATAIRE.\n` +
          `- "clientEmail" : email du client destinataire (string, "" si absent)\n` +
          `- "clientTelephone" : téléphone du client destinataire (string, "" si absent)\n` +
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
        clientNom:
          typeof raw.clientNom === "string" && raw.clientNom.trim()
            ? raw.clientNom.trim()
            : undefined,
        clientEmail:
          typeof raw.clientEmail === "string" && raw.clientEmail.trim()
            ? raw.clientEmail.trim()
            : undefined,
        clientTelephone:
          typeof raw.clientTelephone === "string" && raw.clientTelephone.trim()
            ? raw.clientTelephone.trim()
            : undefined,
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

// --- Audit « RELMO Pro » d'un prospect (DeepSeek, mode JSON) ---
// Cible haut de gamme (startup / scale-up / SaaS / PME tech). L'angle s'inverse :
// pas « ton site est cassé » mais « voici où tu sous-convertis le trafic que tu
// paies déjà, et l'angle stratégique que tu n'as pas exploité ». Performance, pas
// réparation. Cf. RELMO-Pro-prospects-haut-de-gamme.md.
export type ProAudit = {
  score: number | null; // 0-100 interne (potentiel commercial estimé)
  produitComplexe: boolean; // produit / concept à expliquer (signal besoin ROI)
  concurrenceForte: boolean; // marché dense à départager (signal besoin ROI)
  opportunites: string[]; // angles de SOUS-PERFORMANCE (pas des défauts)
  accrocheEmail: string;
  accrocheLinkedin: string;
};

const SYS_PRO = `Tu es l'assistant de prospection de Maxence Cailleau, designer-développeur web freelance à Angers. ICI la cible n'est PAS un artisan local : c'est une STARTUP, une scale-up, un SaaS ou une PME tech (a souvent levé des fonds, fait déjà de la publicité). Elle n'a pas un site cassé : elle a un site correct mais SOUS-OPTIMISÉ. Elle raisonne ROI, pas réparation. Tu ne remues pas une douleur, tu apportes une lecture business qu'elle n'avait pas. Ta valeur est dans la VISION (big picture), pas l'exécution : c'est ce qui te distingue du dev offshore avec qui elle ne veut pas bosser. But d'un message : décrocher un échange de 15 min, PAS vendre.

RÈGLES GÉNÉRALES
- Réponds UNIQUEMENT en JSON valide, rien avant ni après.
- Français impeccable, ZÉRO faute, relis-toi.
- INTERDIT du tiret cadratin « — » ou demi-cadratin « – » partout : virgule, parenthèses, deux-points ou point à la place. Le trait d'union « - » reste autorisé dans les mots composés.
- Le nom d'entreprise cité DOIT être exactement celui fourni. Ton pair à pair, sûr de lui, jamais professeur, jamais alarmiste. On parle croissance et conversion, pas technique.

CHAMPS INTERNES (score, produit_complexe, concurrence_forte, opportunites) : analyse pour Maxence, JAMAIS montrée au prospect.
- produit_complexe : true si le produit/service demande d'être expliqué (SaaS, techno, offre B2B non triviale).
- concurrence_forte : true si le marché est dense et qu'il faut se différencier.
- opportunites : 2 à 4 angles FACTUELS de SOUS-PERFORMANCE (pas des défauts techniques). Formule côté business : « proposition de valeur floue dans le hero », « aucun call-to-action magnétique », « pas de capture d'e-mail / lead magnet », « mobile pas travaillé à part alors que le B2B est à 50-60 % mobile », « trafic payant mal converti », « SEO/GEO exploitable non exploité ». Appuie-toi sur les signaux et, s'il est fourni, le "visuel" (vraie analyse de la capture). N'invente pas un fait que les signaux ne montrent pas.

ACCROCHE_EMAIL : cold email court (~90-110 mots MAX), angle ROI/performance :
1. Objet (4-7 mots) : nomme un bénéfice de conversion/croissance, jamais « audit gratuit ». 1re ligne « Objet : ... ».
2. Ouverture : « Bonjour, je suis Maxence, designer web à Angers. » + UNE observation VRAIE et positive (ce qu'ils font bien).
3. UN SEUL angle stratégique (le plus fort), formulé comme une OPPORTUNITÉ de mieux convertir un trafic qu'ils paient déjà ou un levier de croissance qu'ils n'ont pas exploité. Jamais un reproche, jamais « votre site est cassé ».
4. Preuve légère : tu PEUX proposer de montrer des réalisations (« je peux vous montrer quelques exemples »), sans prétendre à un cas précis de leur secteur. N'écris NI URL NI crochets : une ligne « Mon portfolio : … » est ajoutée automatiquement.
5. CTA à faible engagement : proposer une lecture stratégique de leur site / 2-3 pistes concrètes, avec un choix binaire de créneau. Jamais « audit gratuit de 15 min », jamais « demandez un devis ».
6. Signature : Maxence.

MISE EN FORME : « Objet : … » en 1re ligne, ligne vide, puis 2-3 paragraphes COURTS séparés par une ligne vide (\\n\\n), puis « Maxence » seul.

ACCROCHE_LINKEDIN : même esprit, 2-3 phrases, encore plus direct, UN SEUL angle, pas d'objet.

INTERDITS : « votre site est moche / cassé / obsolète » ; empiler les angles ; ton alarmiste ; chiffre technique brut sans conséquence business ; « audit gratuit » ; plus de 110 mots ; inventer un fait.

Schéma : {"score":<0-100>,"produit_complexe":<bool>,"concurrence_forte":<bool>,"opportunites":["..."],"accroche_email":"Objet : ...\\n\\n...","accroche_linkedin":"..."}`;

export async function auditerProspectPro(input: {
  nom: string;
  ville?: string | null;
  activite?: string | null;
  statutSite: string;
  signaux: unknown;
  visuel?: { modernite: string; constat: string; pointsVisuels: string[] } | null;
  stylesUtilisateur?: string[];
}): Promise<{ ok: true; data: ProAudit } | { ok: false; error: string }> {
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
      { role: "system", content: SYS_PRO + styleBloc },
      {
        role: "user",
        content:
          "Signaux du prospect Pro :\n" +
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
        produitComplexe: raw.produit_complexe === true,
        concurrenceForte: raw.concurrence_forte === true,
        opportunites: Array.isArray(raw.opportunites)
          ? raw.opportunites.map((o: unknown) => String(o)).filter(Boolean)
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
4. Rémunération : "modele_remu" indique ce qui est AUTORISÉ, PAS une obligation. À TOI de juger si en parler sert le message pour CE partenaire précis.
- "reciprocite" : appuie sur le fait que je lui renvoie des clients (mes clients cherchent souvent un comptable/graphiste/photographe…). Aucune commission.
- "commission" : une commission du taux fourni dans "commission_creation_pct", sur le prix de la création du site (paiement unique, JAMAIS l'abonnement mensuel), est POSSIBLE. Ne la cite QUE si c'est pertinent ici. Si l'angle partenariat/confiance est plus fort, ou si parler d'argent d'emblée risque de dévaloriser l'approche (studio haut de gamme, relation encore à construire), n'en parle PAS et laisse ça pour un échange de vive voix.
- "les_deux" : réciprocité et/ou commission disponibles ; choisis le levier le plus juste, ou aucun des deux si le partenariat se suffit.
Quand tu l'évoques : UNE seule phrase neutre, posée comme une info, jamais insistante, aucun superlatif, l'argent n'est jamais le cœur du message. Si "commission_creation_pct" est absent (ex. expert-comptable), n'évoque AUCUNE commission.
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
// Signaux de croissance reconnus (filtre en or §4) → libellés normalisés.
const SIGNAUX_CROISSANCE: { re: RegExp; label: string }[] = [
  { re: /recrut|embauch|on\s+recrute|offres?\s+d'emploi|nous\s+cherchons/i, label: "Recrutement en cours" },
  { re: /lev[ée]e?\s+de\s+fonds|a\s+lev[ée]|série\s+[ab]|seed/i, label: "Levée de fonds" },
  { re: /effectif\s+en\s+hausse|équipe\s+(s'agrandit|grandit)|croissance\s+de\s+l'équipe/i, label: "Effectif en hausse" },
  { re: /nouveaux?\s+locaux|déménage|agrandi|nouvelle\s+agence|ouverture/i, label: "Nouveaux locaux / ouverture" },
  { re: /chiffre\s+d'affaires?\s+en\s+(hausse|croissance)|CA\s+en\s+(hausse|croissance)|forte\s+croissance/i, label: "CA en croissance" },
];

export type EnrichissementProspect = {
  dirigeant: string;
  linkedin: string;
  effectif: number | null; // salariés estimés (proxy potentiel économique)
  signauxCroissance: string[]; // libellés normalisés (filtre en or §4)
};

// Enrichissement Perplexity (recherche web réelle) : dirigeant + LinkedIn, plus
// deux signaux du filtre en or difficiles à obtenir sans API payante — l'effectif
// (potentiel économique) et les signaux de croissance. Grounded sur des sources
// réelles ; dégrade proprement (tout à vide) sans clé ou en cas d'échec.
export async function enrichirDirigeant(input: {
  nom: string;
  ville?: string | null;
  activite?: string | null;
}): Promise<EnrichissementProspect> {
  const vide: EnrichissementProspect = { dirigeant: "", linkedin: "", effectif: null, signauxCroissance: [] };
  const q =
    `À propos de l'entreprise "${input.nom}"${input.ville ? " à " + input.ville : ""} ` +
    `(${input.activite ?? ""}), réponds de façon factuelle et concise, une ligne par point, ` +
    `en te basant sur des sources réelles (n'invente rien, écris "inconnu" si tu ne sais pas) :\n` +
    `DIRIGEANT : nom complet du dirigeant ou gérant\n` +
    `LINKEDIN : URL du profil LinkedIn du dirigeant\n` +
    `EFFECTIF : nombre approximatif de salariés (un chiffre)\n` +
    `CROISSANCE : signaux récents parmi recrutement, levée de fonds, effectif en hausse, ` +
    `nouveaux locaux, CA en croissance (ou "aucun")`;
  const res = await chat({
    provider: "perplexity",
    temperature: 0.2,
    maxTokens: 400,
    messages: [{ role: "user", content: q }],
  });
  if (!res.ok) return vide;

  const txt = res.text;
  const ligne = (label: RegExp): string => (txt.match(label)?.[1] ?? "").trim();

  const dirigeantLigne = ligne(/DIRIGEANT\s*:?\s*(.+)/i);
  const dirigeant = /inconnu/i.test(dirigeantLigne) ? "" : dirigeantLigne.slice(0, 120);
  const linkedin = (txt.match(/https?:\/\/(?:[a-z]{2,3}\.)?linkedin\.com\/[^\s)"]+/i) ?? [])[0] ?? "";

  const effectifLigne = ligne(/EFFECTIF\s*:?\s*(.+)/i);
  const effectifNum = Number((effectifLigne.match(/\d[\d\s.]*/)?.[0] ?? "").replace(/[\s.]/g, ""));
  const effectif = Number.isFinite(effectifNum) && effectifNum > 0 ? effectifNum : null;

  const croissanceLigne = ligne(/CROISSANCE\s*:?\s*(.+)/i);
  const signauxCroissance = /aucun/i.test(croissanceLigne)
    ? []
    : [...new Set(SIGNAUX_CROISSANCE.filter((s) => s.re.test(croissanceLigne)).map((s) => s.label))];

  return { dirigeant, linkedin, effectif, signauxCroissance };
}

// --- Sourcing de startups « Pro » (Perplexity, recherche web réelle) ---
// Google Places ne trouve que du commerce local ; pour la gamme Pro (petits SaaS,
// startups early-stage), on demande à Perplexity de LIRE de vraies sources
// (annuaires d'incubateurs, Product Hunt, French Tech) plutôt que d'inventer une
// liste. Chaque candidat passe ensuite par l'audit (le fetch du site élimine les
// URLs mortes/fausses) puis le scoring Pro. On ne fait donc jamais confiance à la
// liste brute : c'est de l'assistance au sourcing, pas une vérité.
export type StartupCandidate = { nom: string; site: string };

export async function sourcerStartupsPro(input: {
  angle: string;
  region?: string | null;
  max?: number;
}): Promise<{ ok: true; data: StartupCandidate[] } | { ok: false; error: string }> {
  const max = Math.min(Math.max(input.max ?? 15, 1), 25);
  const geo = input.region
    ? ` Concentre-toi si possible sur la région « ${input.region} » ou la France.`
    : " Priorité aux entreprises françaises.";
  const q =
    `Tu es un assistant de sourcing de prospects pour un designer web freelance. Trouve jusqu'à ${max} ` +
    `TRÈS PETITES entreprises RÉELLES correspondant à : « ${input.angle} ».${geo}\n\n` +
    `PROFIL RECHERCHÉ (impératif) :\n` +
    `- Micro-structures : équipe de MOINS DE ~20 personnes, en amorçage (pre-seed / seed) ou bootstrappées, ` +
    `souvent peu connues. Le genre de boîte qui n'a PAS encore d'agence ni d'équipe design interne, où l'on ` +
    `peut joindre le fondateur.\n` +
    `- EXCLUS FORMELLEMENT toute entreprise connue, toute licorne, toute scale-up ayant levé une série A ou plus, ` +
    `tout ce qui dépasse ~50 salariés. Par exemple, des boîtes comme Qonto, Alan, Swile, Spendesk, Agicap, Sellsy, ` +
    `Payfit sont TROP GROSSES : ne les cite pas, ni rien à leur échelle.\n` +
    `- Privilégie des noms obscurs, indie, micro-SaaS, lancements récents sur Product Hunt / BetaList / Indie Hackers, ` +
    `ou membres de petits incubateurs. Si un nom est célèbre, c'est qu'il est trop gros : écarte-le.\n\n` +
    `RÈGLES :\n` +
    `- Uniquement des entreprises vérifiables sur des sources réelles. N'INVENTE aucun nom ni aucune URL.\n` +
    `- Chaque entreprise doit avoir un site web officiel.\n\n` +
    `FORMAT : une entreprise par ligne, exactement « Nom | https://site-officiel ». Rien d'autre : pas de ` +
    `numérotation, pas de commentaire, pas de texte avant ou après. Si tu n'es pas sûr de l'URL, n'inclus pas la ligne.`;

  const res = await chat({
    provider: "perplexity",
    // « sonar » (défaut) refuse ce sourcing (recherche trop superficielle) ; il faut
    // « sonar-pro », dont la recherche web ancrée ramène de vraies entreprises.
    model: "sonar-pro",
    temperature: 0.3,
    maxTokens: 900,
    messages: [{ role: "user", content: q }],
  });
  if (!res.ok) return res;

  const seen = new Set<string>();
  const data: StartupCandidate[] = [];
  for (const raw of res.text.split("\n")) {
    const line = raw.trim().replace(/^[-*•\d.)\s]+/, ""); // enlève puces / numéros
    const url = (line.match(/https?:\/\/[^\s|)>\]]+/i) ?? [])[0];
    if (!url) continue;
    let host: string;
    try {
      host = new URL(url).host.replace(/^www\./, "");
    } catch {
      continue;
    }
    if (seen.has(host)) continue;
    // Nom = ce qui précède l'URL, sans séparateur ni guillemets ; sinon dérivé du domaine.
    let nom = line
      .slice(0, line.indexOf(url))
      .replace(/[|:–—-]\s*$/, "")
      .replace(/["'«»()]/g, "")
      .trim();
    if (!nom) nom = host.split(".")[0].replace(/^\w/, (c) => c.toUpperCase());
    if (nom.length < 2) continue;
    seen.add(host);
    data.push({ nom: nom.slice(0, 120), site: url });
    if (data.length >= max) break;
  }
  if (!data.length) {
    return {
      ok: false,
      error: "Aucune startup exploitable trouvée pour cet angle. Reformule (plus précis, ou nomme un incubateur).",
    };
  }
  return { ok: true, data };
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
