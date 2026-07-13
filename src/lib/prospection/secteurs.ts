// Secteurs → mots-clés Google Maps. Les favoris ⭐ combinent budget réel, besoin
// web évident, densité locale et décideur joignable (cf. PROJET.md prospection).

export type Secteur = {
  cle: string;
  label: string;
  favori: boolean;
  // Gate « besoin » du filtre en or (RELMO-scoring-filtre-en-or.md §2) : le besoin
  // web se score par NICHE, pas par prospect. « fort » = clientèle qui compare
  // avant d'acheter, panier moyen élevé. « faible » = commerce de passage. Une
  // niche « faible » fait sortir le prospect quel que soit le reste du score.
  besoin: "fort" | "faible";
  note: string;
  keywords: string[];
};

export const SECTEURS: Secteur[] = [
  {
    cle: "habitat",
    label: "Habitat / rénovation",
    favori: true,
    besoin: "fort",
    note: "Devis à 5 chiffres → un site à 4 chiffres est une évidence comptable, et ils ont besoin de leads.",
    keywords: [
      "menuisier", "menuiserie", "véranda", "pisciniste", "paysagiste",
      "cuisiniste", "charpentier", "couvreur", "rénovation énergétique",
      "architecte d'intérieur", "store et fermeture", "agencement intérieur",
      "escalier sur mesure", "carreleur", "plaquiste",
    ],
  },
  {
    cle: "sante",
    label: "Santé / paramédical",
    favori: true,
    besoin: "fort",
    note: "Densité énorme, décideur unique, SEO local vital (« ostéopathe Angers »). Éviter médecins/avocats/notaires (com. réglementée).",
    // Les experts-comptables ont quitté cette liste : ce sont désormais des
    // cibles « partenaires » (apporteurs d'affaires), cf. metiers-partenaires.ts.
    keywords: [
      "ostéopathe", "kinesithérapeute", "vétérinaire", "chirurgien-dentiste",
      "orthophoniste", "podologue", "sophrologue", "naturopathe", "diététicien",
    ],
  },
  {
    cle: "tourisme",
    label: "Tourisme / réception",
    favori: false,
    besoin: "fort",
    note: "Beaux projets, cashflow saisonnier.",
    keywords: [
      "domaine viticole", "gîte", "chambre d'hôtes", "salle de réception",
      "lieu de mariage", "hôtel", "camping", "restaurant gastronomique",
    ],
  },
  {
    cle: "vegetal",
    label: "Végétal / paysage",
    favori: false,
    besoin: "fort",
    note: "Positionnement « capitale du végétal » en Anjou.",
    keywords: ["paysagiste", "pépiniériste", "jardinerie", "élagueur", "entreprise espaces verts"],
  },
];

export const SECTEUR_DEFAUT = "habitat";

export function secteurByCle(cle: string): Secteur | undefined {
  return SECTEURS.find((s) => s.cle === cle);
}

export const SECTEUR_OPTIONS = SECTEURS.map((s) => ({
  value: s.cle,
  label: `${s.favori ? "⭐ " : ""}${s.label}`,
}));

// Gate « besoin » du filtre en or. Secteur inconnu → on ne bloque pas (prudence :
// mieux vaut scorer que jeter par défaut), le besoin reste considéré fort.
export function besoinFortDuSecteur(cle: string | null | undefined): boolean {
  const s = cle ? secteurByCle(cle) : undefined;
  return s ? s.besoin === "fort" : true;
}
