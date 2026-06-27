// Référentiels partagés (libellés FR ↔ valeurs stockées en base).

export type Option = { value: string; label: string };

export const SITE_STATUTS: Option[] = [
  { value: "actif", label: "Actif" },
  { value: "en_pause", label: "En pause" },
  { value: "archive", label: "Archivé" },
];

export const CONTRAT_STATUTS: Option[] = [
  { value: "actif", label: "Actif" },
  { value: "en_pause", label: "En pause" },
  { value: "resilie", label: "Résilié" },
];

export const RECURRENCES: Option[] = [
  { value: "mensuelle", label: "Mensuelle" },
  { value: "hebdomadaire", label: "Hebdomadaire" },
  { value: "a_la_demande", label: "À la demande" },
];

export const LIVRABLE_STATUTS: Option[] = [
  { value: "a_faire", label: "À faire" },
  { value: "fait", label: "Fait" },
  { value: "non_applicable", label: "Non applicable" },
];

export const CLIENT_STATUTS: Option[] = [
  { value: "prospect", label: "Prospect" },
  { value: "actif", label: "Actif" },
  { value: "ancien", label: "Ancien" },
];

// Ordre = progression du pipeline (F10).
export const DEVIS_STATUTS: Option[] = [
  { value: "brouillon", label: "Brouillon" },
  { value: "envoye", label: "Envoyé" },
  { value: "en_nego", label: "En négo" },
  { value: "accepte", label: "Accepté" },
  { value: "refuse", label: "Refusé" },
  { value: "expire", label: "Expiré" },
];

// Canal d'acquisition d'un client (marketing / F14).
export const SOURCES: Option[] = [
  { value: "bouche_a_oreille", label: "Bouche-à-oreille" },
  { value: "reseau", label: "Réseau perso" },
  { value: "linkedin", label: "LinkedIn" },
  { value: "instagram", label: "Instagram" },
  { value: "inbound", label: "Site / inbound" },
  { value: "prospection", label: "Prospection sortante" },
  { value: "event", label: "Événement / salon" },
  { value: "ancien_client", label: "Ré-engagement" },
  { value: "autre", label: "Autre" },
];

export const CANAUX: Option[] = [
  { value: "whatsapp", label: "WhatsApp" },
  { value: "email", label: "E-mail" },
  { value: "tel", label: "Téléphone" },
  { value: "autre", label: "Autre" },
];

export const DIRECTIONS: Option[] = [
  { value: "sortant", label: "Sortant" },
  { value: "entrant", label: "Entrant" },
];

export function labelOf(options: Option[], value: string): string {
  return options.find((o) => o.value === value)?.label ?? value;
}
