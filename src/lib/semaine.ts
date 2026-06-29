// Gestion des semaines. Une semaine est identifiée par la date de son LUNDI au
// format "AAAA-MM-JJ" (plus simple et sans ambiguïté que le numéro ISO).

import { periodeBounds } from "@/lib/periode";

function pad(n: number) {
  return String(n).padStart(2, "0");
}

function fmt(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function parse(key: string): Date {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d);
}

// Lundi de la semaine contenant `d`.
export function mondayOf(d: Date): Date {
  const date = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const day = date.getDay(); // 0 = dimanche … 6 = samedi
  date.setDate(date.getDate() + (day === 0 ? -6 : 1 - day));
  return date;
}

export function weekKey(d: Date = new Date()): string {
  return fmt(mondayOf(d));
}

export function currentWeek(now: Date = new Date()): string {
  return weekKey(now);
}

export function isWeekKey(v: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(v);
}

export function shiftWeek(key: string, n: number): string {
  const d = parse(key);
  d.setDate(d.getDate() + n * 7);
  return fmt(d);
}

// Bornes : lundi 00:00 (inclus) → dimanche 23:59:59 (inclus).
export function weekBounds(key: string): { start: Date; end: Date } {
  const start = parse(key);
  const end = new Date(start);
  end.setDate(end.getDate() + 6);
  end.setHours(23, 59, 59, 999);
  return { start, end };
}

export function weekLabel(key: string): string {
  const { start, end } = weekBounds(key);
  const jourMois = (d: Date) =>
    d.toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
  return `Semaine du ${jourMois(start)} → ${end.toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "short",
    year: "numeric",
  })}`;
}

// Mois « dominant » d'une semaine (convention ISO : le mois du jeudi) → "AAAA-MM".
export function periodeOfWeek(key: string): string {
  const thursday = parse(key);
  thursday.setDate(thursday.getDate() + 3);
  return `${thursday.getFullYear()}-${pad(thursday.getMonth() + 1)}`;
}

// Toutes les semaines (clés lundi) qui chevauchent un mois "AAAA-MM".
export function weeksInPeriode(periode: string): string[] {
  const { start, nextStart } = periodeBounds(periode);
  const lastDay = new Date(nextStart.getTime() - 86_400_000);
  const keys: string[] = [];
  let m = mondayOf(start);
  while (m <= lastDay) {
    keys.push(fmt(m));
    m = new Date(m);
    m.setDate(m.getDate() + 7);
  }
  return keys;
}

// Semaine contenant le 1er du mois (pour y afficher les livrables mensuels).
export function firstWeekOfPeriode(periode: string): string {
  return weekKey(periodeBounds(periode).start);
}
