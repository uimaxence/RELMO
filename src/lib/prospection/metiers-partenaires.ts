// Métiers cibles du mode « partenaires » (apporteurs d'affaires) → mots-clés
// Google Maps. On ne cherche plus la faiblesse d'un site mais l'alignement :
// complémentarité, non-concurrence, accès aux TPE/artisans locaux (cf. V2).

export type MetierPartenaire = {
  cle: string; // stocké dans Prospect.metier
  label: string;
  favori: boolean;
  note: string;
  // false = jamais de pitch automatique (agences web → qualification manuelle).
  autoPitch: boolean;
  // true = la détection « offre web » sur son site le disqualifie (concurrent).
  concurrencePossible: boolean;
  keywords: string[];
};

export const METIERS_PARTENAIRES: MetierPartenaire[] = [
  {
    cle: "comptable",
    label: "Expert-comptable",
    favori: true,
    note:
      "Meilleure cible : non-concurrence garantie, portefeuille de TPE, on devient " +
      "« sa » réponse à « tu connais quelqu'un pour mon site ? ». Rémunération : " +
      "réciprocité uniquement (la commission d'apporteur est déontologiquement sensible).",
    autoPitch: true,
    concurrencePossible: false,
    keywords: [
      "expert-comptable",
      "cabinet d'expertise comptable",
      "cabinet comptable",
    ],
  },
  {
    cle: "graphiste",
    label: "Graphiste / studio (branding)",
    favori: true,
    note:
      "Excellent si branding/print/identité UNIQUEMENT. S'il vend aussi du web, " +
      "c'est un concurrent : la détection « offre web » le flague automatiquement.",
    autoPitch: true,
    concurrencePossible: true,
    keywords: [
      "graphiste",
      "studio graphique",
      "graphiste indépendant",
      "designer graphique",
      "studio de création graphique",
      "identité visuelle",
    ],
  },
  {
    cle: "agence_web",
    label: "Agence web (à qualifier)",
    favori: false,
    note:
      "Concurrent par défaut. Les deux sous-cas intéressants (gros comptes qui " +
      "délaissent les petits projets, spécialisation autre techno) sont indétectables " +
      "au scrape → liste « à qualifier manuellement », jamais de pitch automatique.",
    autoPitch: false,
    concurrencePossible: true,
    keywords: ["agence web", "agence digitale", "agence de communication"],
  },
  {
    cle: "adjacent",
    label: "Adjacents (photo, print, CM, coach)",
    favori: false,
    note:
      "Cibles secondaires : clientèles qui se recoupent, jeu de réciprocité de " +
      "recommandations. Poids plus faible mais coût d'approche quasi nul.",
    autoPitch: true,
    concurrencePossible: true,
    keywords: [
      "photographe corporate",
      "photographe professionnel",
      "imprimerie",
      "community manager",
      "coach d'entreprise",
      "consultant en création d'entreprise",
    ],
  },
];

export const METIER_DEFAUT = "comptable";

export function metierByCle(cle: string): MetierPartenaire | undefined {
  return METIERS_PARTENAIRES.find((m) => m.cle === cle);
}

export const METIER_OPTIONS = METIERS_PARTENAIRES.map((m) => ({
  value: m.cle,
  label: `${m.favori ? "⭐ " : ""}${m.label}`,
}));

// Modèles de rémunération proposables dans un pitch partenaire.
export const MODELES_REMU = [
  { value: "reciprocite", label: "Réciprocité (échange de recommandations)" },
  { value: "commission", label: "Commission d'apport" },
  { value: "les_deux", label: "Les deux (au choix du partenaire)" },
] as const;

export type ModeleRemu = (typeof MODELES_REMU)[number]["value"];

export function modeleRemuValide(v: string | null | undefined): ModeleRemu {
  return MODELES_REMU.some((m) => m.value === v) ? (v as ModeleRemu) : "reciprocite";
}
