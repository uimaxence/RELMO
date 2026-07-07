import { z } from "zod";
import { optionalString, optionalDate } from "@/lib/form";

const requis = "Ce champ est requis.";

export const clientSchema = z.object({
  nom: z.string().trim().min(1, requis),
  email: z.preprocess(
    (v) => (v === "" || v === null ? undefined : v),
    z.email("Email invalide.").optional(),
  ),
  telephone: optionalString,
  statut: z.enum(["prospect", "actif", "ancien"]),
  source: z.preprocess(
    (v) => (v === "" || v === "none" || v === null ? undefined : v),
    z.string().optional(),
  ),
  sourceDetail: optionalString,
  secteur: optionalString,
  notes: optionalString,
});

export const siteSchema = z.object({
  clientId: z.string().min(1, requis),
  nom: z.string().trim().min(1, requis),
  url: optionalString,
  repoGitUrl: optionalString,
  hebergeur: optionalString,
  stack: optionalString,
  contact: optionalString,
  statut: z.enum(["actif", "en_pause", "archive"]),
  dateMiseEnLigne: optionalDate,
  notes: optionalString,
});

export const contratSchema = z.object({
  siteId: z.string().min(1, requis),
  libelle: z.string().trim().min(1, requis),
  montantMensuel: z.coerce
    .number({ message: "Montant invalide." })
    .min(0, "Le montant doit être positif."),
  dateDebut: z.coerce.date({ message: "Date de début invalide." }),
  dateFin: optionalDate,
  statut: z.enum(["actif", "en_pause", "resilie"]),
  // "true" | "false" venant d'un <select> → booléen. Défaut : facturation démarrée.
  facturationDemarree: z.preprocess(
    (v) => v !== "false" && v !== false,
    z.boolean(),
  ),
  note: optionalString,
  motifResiliation: optionalString,
});

export const engagementSchema = z.object({
  contratId: z.string().min(1, requis),
  type: z.string().trim().min(1, requis),
  libelle: z.string().trim().min(1, requis),
  quantiteParMois: z.coerce
    .number({ message: "Quantité invalide." })
    .int("Nombre entier attendu.")
    .min(0, "La quantité doit être positive."),
  recurrence: z.enum(["mensuelle", "hebdomadaire", "a_la_demande"]),
});

const montant = (msg: string) =>
  z.coerce.number({ message: msg }).min(0, "Doit être positif.");

export const devisSchema = z.object({
  clientId: z.string().min(1, requis),
  siteId: z.preprocess(
    (v) => (v === "" || v === "none" || v === null ? undefined : v),
    z.string().optional(),
  ),
  libelle: z.string().trim().min(1, requis),
  montantCreation: montant("Montant de création invalide."),
  montantMensuelPropose: montant("Montant mensuel invalide."),
  formule: z.preprocess(
    (v) => (v === "" || v === "none" || v === null ? undefined : v),
    z.enum(["essentiel", "pro", "suivi", "sur_mesure"]).optional(),
  ),
  statut: z.enum([
    "brouillon",
    "envoye",
    "en_nego",
    "accepte",
    "refuse",
    "expire",
  ]),
  dateEnvoi: optionalDate,
  dateRelance: optionalDate,
  note: optionalString,
  motifPerte: optionalString,
  pdfUrl: optionalString,
});

export const interactionSchema = z.object({
  clientId: z.string().min(1, requis),
  devisId: optionalString,
  canal: z.enum(["whatsapp", "email", "tel", "autre"]),
  direction: z.enum(["entrant", "sortant"]),
  date: z.coerce.date({ message: "Date invalide." }),
  resume: z.string().trim().min(1, requis),
  contenu: optionalString,
});

export const factureSchema = z.object({
  clientId: z.string().min(1, requis),
  siteId: z.preprocess(
    (v) => (v === "" || v === "none" || v === null ? undefined : v),
    z.string().optional(),
  ),
  numero: z.string().trim().min(1, requis),
  periode: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, "Période AAAA-MM attendue."),
  montant: montant("Montant invalide."),
  statut: z.enum(["emise", "payee", "en_retard"]),
  dateEmission: z.coerce.date({ message: "Date d'émission invalide." }),
  dateEcheance: optionalDate,
  pdfUrl: optionalString,
  pathnamePdf: optionalString,
});

export const envieSchema = z.object({
  libelle: z.string().trim().min(1, requis),
  prix: montant("Prix invalide."),
  url: optionalString,
  categorie: z.preprocess(
    (v) => (v === "" || v === "none" || v === null ? undefined : v),
    z.string().optional(),
  ),
  note: optionalString,
});

export const reglageSchema = z.object({
  pourcentagePlafond: z.coerce
    .number({ message: "Pourcentage invalide." })
    .min(1, "Au moins 1 %.")
    .max(100, "Au plus 100 %."),
});

// Paliers de prix courants (grille publique — cf. brief §4).
export const paliersSchema = z.object({
  palierEssentiel: montant("Prix Essentiel invalide."),
  palierPro: montant("Prix Pro invalide."),
  tarifSuivi: montant("Tarif Suivi invalide."),
});

// Texte optionnel qui peut être VIDÉ (→ null) — contrairement à optionalString
// (undefined) qui laisse la valeur inchangée en base.
const nullableText = z.preprocess(
  (v) => (v === "" || v === null || v === undefined ? null : String(v).trim()),
  z.string().nullable(),
);

// Réglages de campagne (contenus injectés dans les mails).
export const reglageCampagneSchema = z.object({
  signatureEmail: nullableText,
  optOutTexte: nullableText,
  lienRealisation: nullableText,
  // Pitch partenaire : rémunération proposée (réciprocité forcée pour les comptables).
  modeleRemu: z.enum(["commission", "reciprocite", "les_deux"]).catch("reciprocite"),
  // Interrupteur des relances automatiques (checkbox : "on" si cochée, absente sinon).
  relanceAutoActive: z.preprocess((v) => v === "on" || v === "true" || v === true, z.boolean()),
});

export const objectifSchema = z.object({
  montantCible: montant("Cible invalide."),
  mrrDepart: montant("MRR de départ invalide."),
  dateDebut: z.coerce.date({ message: "Date de début invalide." }),
  dateCible: z.coerce.date({ message: "Date cible invalide." }),
});
