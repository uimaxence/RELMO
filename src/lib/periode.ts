// Gestion des périodes mensuelles au format "AAAA-MM".

export function currentPeriode(now: Date = new Date()): string {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

export function isPeriode(value: string): boolean {
  return /^\d{4}-(0[1-9]|1[0-2])$/.test(value);
}

// Bornes de la période : start inclus, nextStart exclu.
export function periodeBounds(periode: string): { start: Date; nextStart: Date } {
  const [y, m] = periode.split("-").map(Number);
  return { start: new Date(y, m - 1, 1), nextStart: new Date(y, m, 1) };
}

// Décale d'un nombre de mois (négatif = passé).
export function shiftPeriode(periode: string, delta: number): string {
  const [y, m] = periode.split("-").map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

// Libellé FR, ex. "juin 2026".
export function periodeLabel(periode: string): string {
  const [y, m] = periode.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString("fr-FR", {
    month: "long",
    year: "numeric",
  });
}

// Un contrat est-il actif sur la période (démarré, non résilié/terminé) ?
export function contratActifSurPeriode(
  contrat: { statut: string; dateDebut: Date; dateFin: Date | null },
  periode: string,
): boolean {
  if (contrat.statut !== "actif") return false;
  const { start, nextStart } = periodeBounds(periode);
  if (contrat.dateDebut >= nextStart) return false; // pas encore démarré
  if (contrat.dateFin && contrat.dateFin < start) return false; // terminé
  return true;
}
