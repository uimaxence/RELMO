// Filtre en or — variante RELMO Pro (cf. RELMO-Pro-prospects-haut-de-gamme.md).
// Le filtre reste la charpente, mais RECALIBRÉ : on ne cherche pas un site cassé,
// on cherche des écarts de performance et de conversion sur une boîte qui raisonne
// ROI. Le signal s'inverse (un site propre est normal), le seuil éco est relevé, la
// croissance devient le signal moteur, le besoin se redéfinit (paie du trafic /
// produit à expliquer).
//
// On réutilise croissance et accès du filtre classique (même logique), et on
// stocke les résultats dans les mêmes colonnes filtre* (un prospect est classique
// OU pro) — le champ `segment` dit comment les lire.

import type { Signaux } from "./audit";
import { scoreCroissance, scoreAcces, type SousScore, type Tier } from "./scoring";

export { scoreCroissance, scoreAcces };

// --- 1. POTENTIEL ÉCONOMIQUE — seuil relevé ----------------------------------
// Signal ROI le plus fort : une levée (série A/B) = budget confirmé + urgence de
// croissance. Sinon effectif d'une scale-up (pas de pénalité au-delà de 50, à la
// différence du classique) et CA en forte croissance.
export function scorePotentielPro(input: {
  effectif?: number | null;
  leveeDeFonds?: boolean;
  caCroissance?: boolean;
  nbAvis?: number | null;
}): SousScore {
  const { effectif, leveeDeFonds, caCroissance } = input;
  const raisons: string[] = [];
  let score = 0;

  if (effectif != null && effectif > 0) {
    if (effectif >= 20) {
      score = 2;
      raisons.push(`${effectif} salariés (structure financée)`);
    } else if (effectif >= 8) {
      score = 1;
      raisons.push(`${effectif} salariés`);
    } else {
      raisons.push(`${effectif} salariés (petite structure : budget à confirmer)`);
    }
  }

  if (leveeDeFonds) {
    score = 2;
    raisons.push("Levée de fonds (budget confirmé, urgence de croissance)");
  }
  if (caCroissance && score < 2) {
    score += 1;
    raisons.push("CA en forte croissance");
  }

  if (raisons.length === 0) raisons.push("Potentiel inconnu (ni effectif ni levée)");
  return { score: Math.min(2, score), raisons };
}

// --- 2. BESOIN — redéfini, en GATE -------------------------------------------
// Pas « sa clientèle compare avant d'acheter » mais : la boîte paie déjà du trafic
// (pixel publicitaire présent = double signal maturité + trafic à mieux convertir),
// doit expliquer un concept complexe, ou se différencier d'une concurrence forte.
export function besoinFortPro(input: {
  pixelPublicitaire?: boolean;
  produitComplexe?: boolean;
  concurrenceForte?: boolean;
}): { besoin: boolean; raisons: string[] } {
  const raisons: string[] = [];
  if (input.pixelPublicitaire) raisons.push("Paie du trafic (pixel publicitaire détecté)");
  if (input.produitComplexe) raisons.push("Produit / concept à expliquer");
  if (input.concurrenceForte) raisons.push("Concurrence forte à départager");
  const besoin = raisons.length > 0;
  if (!besoin) raisons.push("Aucun besoin ROI clair (ni trafic payé, ni produit complexe)");
  return { besoin, raisons };
}

// --- 3. OPPORTUNITÉ DE PERFORMANCE (ex-« problème ») -------------------------
// Le vrai changement d'audit : pas « ton site est cassé » mais des angles factuels
// de sous-performance. Signaux déterministes + opportunités repérées par l'IA
// (hero flou, proposition de valeur, etc.), dédupliqués.
export function scoreOpportunitePro(
  s: Partial<Signaux>,
  opportunitesIA: string[] = [],
): SousScore {
  const opp: string[] = [];

  if (s.pixelPublicitaire && !s.analytics)
    opp.push("Trafic payé sans mesure fiable (tracking à cadrer)");
  if (s.ctaFort === false) opp.push("Pas de call-to-action magnétique");
  if (s.captureEmail === false) opp.push("Pas de lead magnet / capture d'e-mail");
  if (s.viewport === false) opp.push("Mobile non travaillé (B2B à 50-60 % mobile)");
  if ((s.poidsHtmlKo ?? 0) > 600) opp.push("Page lourde (temps de chargement mobile dégradé)");
  if (s.structuredData === false) opp.push("SEO / GEO exploitable non exploité");

  const all = [...new Set([...opp, ...opportunitesIA.map((o) => o.trim()).filter(Boolean)])];
  if (all.length >= 3) return { score: 2, raisons: all };
  if (all.length >= 1) return { score: 1, raisons: all };
  return { score: 0, raisons: ["Site déjà bien optimisé (peu d'angle de performance)"] };
}

// --- AGRÉGATION Pro ----------------------------------------------------------
// Besoin ROI en gate. Croissance CENTRALE : une boîte sans aucun signal de
// croissance ne peut pas être « chaude » (plafonnée à tiède), même bien scorée
// ailleurs. Sinon mêmes seuils que le classique (≥ 7 chaud, 5-6 tiède, < 5 drop).
export type FiltreProResultat = {
  besoin: boolean;
  potentiel: SousScore;
  opportunite: SousScore;
  croissance: SousScore;
  acces: SousScore;
  total: number; // 0-8
  tier: Tier;
  trace: string;
};

export function computeFiltrePro(input: {
  besoin: { besoin: boolean; raisons: string[] };
  potentiel: SousScore;
  opportunite: SousScore;
  croissance: SousScore;
  acces: SousScore;
}): FiltreProResultat {
  const { besoin, potentiel, opportunite, croissance, acces } = input;
  const total = potentiel.score + opportunite.score + croissance.score + acces.score;

  let tier: Tier;
  if (!besoin.besoin) tier = "drop";
  else if (total >= 7) tier = "chaud";
  else if (total >= 5) tier = "tiede";
  else tier = "drop";
  // Croissance centrale : pas de « chaud » sans le moindre signal de croissance.
  if (tier === "chaud" && croissance.score === 0) tier = "tiede";

  const trace = [
    `Besoin ROI : ${besoin.besoin ? "oui" : "non → drop"} (${besoin.raisons.join(", ")})`,
    `Potentiel ${potentiel.score}/2 (${potentiel.raisons.join(", ")})`,
    `Opportunité ${opportunite.score}/2 (${opportunite.raisons.join(", ")})`,
    `Croissance ${croissance.score}/2 (${croissance.raisons.join(", ")})`,
    `Accès ${acces.score}/2 (${acces.raisons.join(", ")})`,
  ].join(" • ");

  return { besoin: besoin.besoin, potentiel, opportunite, croissance, acces, total, tier, trace };
}
