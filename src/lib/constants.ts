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

export function labelOf(options: Option[], value: string): string {
  return options.find((o) => o.value === value)?.label ?? value;
}
