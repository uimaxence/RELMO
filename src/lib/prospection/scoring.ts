// Filtre en or — score un prospect (cible=client) sur sa probabilité de signer un
// contrat MRR-compatible, PAS sur « son site est-il moche ». Cf.
// RELMO-scoring-filtre-en-or.md. 5 signaux, le besoin en GATE amont.
//
// Discipline non négociable (garde-fou de crédibilité) : chaque sous-score est
// FACTUEL et trace ses raisons. Jamais de jugement subjectif, jamais un problème
// non vérifié. Ces fonctions sont pures → testables et rejouables hors DB/IA.

import type { Signaux } from "./audit";

export type SousScore = {
  score: number; // 0 | 1 | 2
  raisons: string[]; // pourquoi ce score (traçabilité)
};

export type Tier = "chaud" | "tiede" | "drop";

export const TIER_LABEL: Record<Tier, string> = {
  chaud: "Chaud",
  tiede: "Tiède",
  drop: "À écarter",
};

// --- 1. POTENTIEL ÉCONOMIQUE (poids fort) ------------------------------------
// La boîte peut-elle payer un récurrent ? Meilleur proxy solo-friendly : effectif.
// À défaut d'effectif, le volume d'avis Google approxime l'activité réelle.
export function scorePotentiel(input: {
  effectif?: number | null;
  nbAvis?: number | null;
}): SousScore {
  const { effectif, nbAvis } = input;
  if (effectif != null && effectif > 0) {
    if (effectif >= 50)
      return { score: 1, raisons: [`${effectif} salariés (> 50 : accès plus dur, cycles longs → capé)`] };
    if (effectif >= 10) return { score: 2, raisons: [`${effectif} salariés (10-49 : cible idéale)`] };
    if (effectif >= 3) return { score: 1, raisons: [`${effectif} salariés (3-9)`] };
    return { score: 0, raisons: [`${effectif} personne(s) (solo / démarrage : risque de blocage au prix)`] };
  }
  if (nbAvis != null) {
    if (nbAvis >= 30) return { score: 2, raisons: [`${nbAvis} avis Google (proxy : activité soutenue)`] };
    if (nbAvis >= 8) return { score: 1, raisons: [`${nbAvis} avis Google (proxy : activité modérée)`] };
    return { score: 0, raisons: [`${nbAvis} avis Google (proxy : faible activité)`] };
  }
  return { score: 0, raisons: ["Potentiel inconnu (ni effectif ni avis)"] };
}

// --- 3. PROBLÈME (poids moyen — RELMO le fait déjà) --------------------------
// Défaut FACTUEL et concret qu'on peut régler. Jamais « moche ». Un problème
// majeur = responsive cassé, HTTPS absent, invisible en local.
export function scoreProbleme(
  s: Partial<Signaux>,
  opts: { villeDansTitre?: boolean | null; statut: string },
): SousScore {
  if (opts.statut === "aucun_site") {
    return { score: 2, raisons: ["Aucun site en ligne (invisible sur le web)"] };
  }
  const annee = new Date().getFullYear();
  const majeurs: string[] = [];
  const mineurs: string[] = [];

  if (s.viewport === false) majeurs.push("Pas adapté au mobile (viewport absent)");
  if (s.https === false) majeurs.push("HTTPS absent (connexion non sécurisée)");
  if (opts.villeDansTitre === false)
    majeurs.push("Ville absente du title (invisible en recherche locale)");

  const derniereAnnee = s.anneeCopyright ?? s.derniereAnneeVisible ?? null;
  if (derniereAnnee != null && derniereAnnee <= annee - 3)
    mineurs.push(`Site pas mis à jour depuis ${derniereAnnee}`);
  if (s.structuredData === false)
    mineurs.push("Pas de données structurées (infos/avis non affichés par Google)");
  if (s.jquery) mineurs.push(`jQuery ${s.jquery} (techno vieillissante)`);
  if (s.metaDescription === null) mineurs.push("Meta description absente");
  if (s.h1Count === 0) mineurs.push("Aucun H1 (structure SEO faible)");
  if (s.imgCount && s.imgSansAlt && s.imgSansAlt / s.imgCount > 0.5)
    mineurs.push("Majorité d'images sans alt (SEO images)");

  const raisons = [...majeurs, ...mineurs];
  const total = raisons.length;
  if (total >= 3 && majeurs.length >= 1) return { score: 2, raisons };
  if (total >= 1) return { score: 1, raisons };
  return { score: 0, raisons: ["Site propre, rien de factuel à redire"] };
}

// --- 4. ENVIE DE CROISSANCE (poids moyen) ------------------------------------
// Une boîte qui ne veut pas grossir n'investit pas. Signaux détectés en amont
// (recrutement, effectif/CA en hausse, levée, nouveaux locaux).
export function scoreCroissance(signaux: string[]): SousScore {
  const s = [...new Set(signaux.map((x) => x.trim()).filter(Boolean))];
  if (s.length >= 2) return { score: 2, raisons: s };
  if (s.length === 1) return { score: 1, raisons: s };
  return { score: 0, raisons: ["Aucun signal de croissance détecté"] };
}

// --- 5. ACCÈS (poids moyen, gate soft) ---------------------------------------
// Peux-tu joindre le DÉCIDEUR ? Un formulaire/adresse générique pénalise fort.
const EMAIL_GENERIQUE =
  /^(contact|info|bonjour|hello|accueil|commercial|secretariat|secrétariat|direction|agence|cabinet)@/i;

export function scoreAcces(input: {
  bestEmail?: string | null;
  linkedin?: string | null;
  dirigeant?: string | null;
  telephone?: string | null;
}): SousScore {
  const email = (input.bestEmail ?? "").trim();
  const emailPerso = !!email && !EMAIL_GENERIQUE.test(email); // prénom.nom@ = décideur probable
  const hasLinkedin = !!input.linkedin;
  const hasPhone = !!input.telephone;

  const raisons: string[] = [];
  if (emailPerso) raisons.push(`Email nominatif (${email})`);
  else if (email) raisons.push(`Email générique (${email})`);
  if (hasLinkedin) raisons.push("LinkedIn du décideur");
  if (input.dirigeant && !hasLinkedin) raisons.push("Dirigeant identifié");
  if (hasPhone) raisons.push("Téléphone direct");

  const canauxDecideur = (emailPerso ? 1 : 0) + (hasLinkedin ? 1 : 0);
  if (canauxDecideur >= 2) return { score: 2, raisons };
  if (canauxDecideur === 1) return { score: 1, raisons };
  if (email && hasPhone) return { score: 1, raisons }; // deux canaux, même génériques
  if (raisons.length === 0) raisons.push("Aucun contact direct (formulaire générique seul)");
  return { score: 0, raisons };
}

// --- AGRÉGATION --------------------------------------------------------------
// Besoin en GATE amont : niche faible → drop immédiat. Sinon somme des 4 autres
// signaux sur 8. Seuils : ≥ 7 chaud, 5-6 tiède, < 5 drop.
export type FiltreResultat = {
  besoin: boolean;
  potentiel: SousScore;
  probleme: SousScore;
  croissance: SousScore;
  acces: SousScore;
  total: number; // 0-8 (hors besoin, en gate)
  tier: Tier;
  trace: string; // toutes les raisons, jointes par " • " (garde-fou de crédibilité)
};

export function computeFiltre(input: {
  besoin: boolean;
  potentiel: SousScore;
  probleme: SousScore;
  croissance: SousScore;
  acces: SousScore;
}): FiltreResultat {
  const { besoin, potentiel, probleme, croissance, acces } = input;
  const total = potentiel.score + probleme.score + croissance.score + acces.score;

  let tier: Tier;
  if (!besoin) tier = "drop";
  else if (total >= 7) tier = "chaud";
  else if (total >= 5) tier = "tiede";
  else tier = "drop";

  const trace = [
    `Besoin niche : ${besoin ? "fort" : "faible → drop"}`,
    `Potentiel ${potentiel.score}/2 (${potentiel.raisons.join(", ")})`,
    `Problème ${probleme.score}/2 (${probleme.raisons.join(", ")})`,
    `Croissance ${croissance.score}/2 (${croissance.raisons.join(", ")})`,
    `Accès ${acces.score}/2 (${acces.raisons.join(", ")})`,
  ].join(" • ");

  return { besoin, potentiel, probleme, croissance, acces, total, tier, trace };
}
