// Comptabilité — logique pure (sans dépendance serveur, réutilisable côté client).
// Le parseur du CSV Indy vit à part dans src/lib/compta-import.ts (papaparse).

// --- Catégories éditables ---
// Chaque écriture porte une `categorie` (clé stable) qui détermine son `type`
// comptable. Le `type` pilote les agrégats (résultat, rémunération, trésorerie).

export type TypeCompta =
  | "recette"
  | "depense"
  | "remuneration"
  | "apport"
  | "a_categoriser";

export type CategorieCompta = {
  value: string;
  label: string;
  type: TypeCompta;
};

export const CATEGORIES_COMPTA: CategorieCompta[] = [
  // Recettes (argent qui rentre, produit de l'activité)
  { value: "prestations", label: "Prestations clients", type: "recette" },
  { value: "autres_produits", label: "Autres produits (cashback, gains)", type: "recette" },
  // Dépenses professionnelles
  { value: "abonnements", label: "Abonnements & logiciels", type: "depense" },
  { value: "hebergement", label: "Hébergement & noms de domaine", type: "depense" },
  { value: "urssaf", label: "Cotisations URSSAF", type: "depense" },
  { value: "comptabilite", label: "Comptabilité & administratif", type: "depense" },
  { value: "repas", label: "Repas & déplacements", type: "depense" },
  { value: "frais_bancaires", label: "Frais bancaires", type: "depense" },
  { value: "autre_depense", label: "Autre dépense pro", type: "depense" },
  // Mouvements personnels (le « salaire » que tu te verses / tes apports)
  { value: "remuneration", label: "Rémunération (perso)", type: "remuneration" },
  { value: "apport", label: "Apport personnel", type: "apport" },
  // À trancher
  { value: "a_categoriser", label: "À catégoriser", type: "a_categoriser" },
];

const CAT_MAP = new Map(CATEGORIES_COMPTA.map((c) => [c.value, c]));

export function labelCategorie(value: string): string {
  return CAT_MAP.get(value)?.label ?? value;
}

export function typeDeCategorie(value: string): TypeCompta {
  return CAT_MAP.get(value)?.type ?? "a_categoriser";
}

// Libellés & couleurs des types (pour les badges / KPIs).
export const TYPE_LABEL: Record<TypeCompta, string> = {
  recette: "Recette",
  depense: "Dépense",
  remuneration: "Rémunération",
  apport: "Apport",
  a_categoriser: "À catégoriser",
};

// --- Classification par défaut à l'import (depuis le plan comptable Indy) ---
// On mappe le code du compte de contrepartie vers une catégorie de départ.
// L'utilisateur (ou l'IA) affine ensuite les « à catégoriser ».
export function categorieParDefaut(compte: string, libelleCompte: string): string {
  const c = compte.trim();
  const l = libelleCompte.toLowerCase();
  if (c.startsWith("706")) return "prestations";
  if (c.startsWith("7")) return "autres_produits"; // 71x, 77x… produits divers
  if (c === "108900") return "apport";
  if (c.startsWith("108")) return "remuneration"; // 108100 prélèvements perso
  if (c.startsWith("613")) {
    if (l.includes("indy")) return "comptabilite";
    return "abonnements";
  }
  if (c.startsWith("646") || c.startsWith("645")) return "urssaf";
  if (c.startsWith("625")) return "repas";
  if (c.startsWith("627")) return "frais_bancaires";
  if (c.startsWith("471")) return "a_categoriser"; // « À catégoriser » Indy
  if (c.startsWith("6")) return "autre_depense";
  return "a_categoriser";
}

// --- Agrégation ---
// Une écriture minimale pour les calculs (compatible avec le modèle Prisma).
export type EcritureCalc = {
  montant: number;
  sens: string; // "entree" | "sortie"
  type: string;
};

export type Agregats = {
  recettes: number;
  depenses: number;
  remuneration: number; // net : prélèvements − apports
  tresorerie: number; // ce qu'il reste sur le compte pro (Σ entrées − Σ sorties)
  resultatPro: number; // recettes − dépenses (marge de l'activité)
  resteApresRemu: number; // résultat pro − rémunération nette
  aCategoriser: number; // nb d'écritures encore « à catégoriser »
};

// Montant signé selon le flux : + si l'argent rentre, − s'il sort.
function signe(e: EcritureCalc): number {
  return e.sens === "entree" ? e.montant : -e.montant;
}

export function agreger(ecritures: EcritureCalc[]): Agregats {
  let recettes = 0;
  let depenses = 0;
  let remuneration = 0;
  let entrees = 0;
  let sorties = 0;
  let aCategoriser = 0;

  for (const e of ecritures) {
    const s = signe(e);
    if (e.sens === "entree") entrees += e.montant;
    else sorties += e.montant;

    switch (e.type) {
      case "recette":
        recettes += s; // un remboursement de recette (rare) se soustrait
        break;
      case "depense":
        depenses += -s; // sortie → +dépense ; remboursement (entrée) → −dépense
        break;
      case "remuneration":
        remuneration += -s; // prélèvement (sortie) → +rémunération
        break;
      case "apport":
        remuneration += -s; // apport (entrée) → −rémunération nette
        break;
      case "a_categoriser":
      default:
        aCategoriser += 1;
        // Compté prudemment côté dépense tant que non tranché (si c'est une sortie).
        if (e.sens === "sortie") depenses += e.montant;
        else recettes += e.montant;
        break;
    }
  }

  const tresorerie = entrees - sorties;
  const resultatPro = recettes - depenses;
  return {
    recettes,
    depenses,
    remuneration,
    tresorerie,
    resultatPro,
    resteApresRemu: resultatPro - remuneration,
    aCategoriser,
  };
}

// Regroupe des dépenses par catégorie (montant net, pour la répartition).
export function depensesParCategorie(
  ecritures: (EcritureCalc & { categorie: string })[],
): { categorie: string; label: string; montant: number }[] {
  const m = new Map<string, number>();
  for (const e of ecritures) {
    if (e.type !== "depense" && e.type !== "a_categoriser") continue;
    const s = e.sens === "entree" ? -e.montant : e.montant;
    m.set(e.categorie, (m.get(e.categorie) ?? 0) + s);
  }
  return [...m.entries()]
    .map(([categorie, montant]) => ({
      categorie,
      label: labelCategorie(categorie),
      montant,
    }))
    .filter((r) => Math.abs(r.montant) > 0.005)
    .sort((a, b) => b.montant - a.montant);
}
