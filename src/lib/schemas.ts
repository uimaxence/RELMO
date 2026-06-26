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
  notes: optionalString,
});

export const siteSchema = z.object({
  clientId: z.string().min(1, requis),
  nom: z.string().trim().min(1, requis),
  url: optionalString,
  repoGitUrl: optionalString,
  hebergeur: optionalString,
  stack: optionalString,
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
  note: optionalString,
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
