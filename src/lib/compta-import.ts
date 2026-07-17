import Papa from "papaparse";

import { categorieParDefaut, typeDeCategorie } from "@/lib/compta";

// Parseur du journal comptable Indy (export CSV, partie double, séparateur « ; »,
// décimales à la virgule). Chaque opération = 2 lignes : le compte « Banque »
// (512xxx) et sa contrepartie qui porte la catégorie. On ne garde QUE la
// contrepartie (le sens du flux se déduit de son débit/crédit) — la ligne banque
// est le miroir redondant.

export type EcritureImportee = {
  date: Date;
  libelle: string;
  compte: string;
  libelleCompte: string;
  montant: number;
  sens: "entree" | "sortie";
  type: string;
  categorie: string;
  periode: string;
  hash: string;
};

// "18/12/2025" (JJ/MM/AAAA) → Date en UTC (évite les décalages de fuseau).
function parseDateFr(s: string): Date | null {
  const m = s.trim().match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!m) return null;
  const [, jj, mm, aaaa] = m;
  const d = new Date(Date.UTC(Number(aaaa), Number(mm) - 1, Number(jj)));
  return Number.isNaN(d.getTime()) ? null : d;
}

// "1 234,56" → 1234.56
function parseMontant(s: string): number {
  const n = parseFloat(String(s).replace(/\s/g, "").replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}

// Retrouve une colonne quel que soit l'accent/casse de l'en-tête (le CSV Indy
// peut arriver en Latin-1 → en-têtes légèrement abîmés).
function pick(row: Record<string, string>, ...noms: string[]): string {
  const keys = Object.keys(row);
  for (const nom of noms) {
    const k = keys.find((k) => k.toLowerCase().includes(nom.toLowerCase()));
    if (k) return row[k] ?? "";
  }
  return "";
}

export type ResultatParse = {
  ecritures: EcritureImportee[];
  lignesLues: number;
  ignoreesFormat: number; // lignes non exploitables (date/montant illisibles)
};

export function parserJournalIndy(csv: string): ResultatParse {
  const parsed = Papa.parse<Record<string, string>>(csv, {
    header: true,
    delimiter: ";",
    skipEmptyLines: true,
    transformHeader: (h) => h.trim(),
  });

  const rows = parsed.data ?? [];
  const ecritures: EcritureImportee[] = [];
  const occurrences = new Map<string, number>();
  let lignesLues = 0;
  let ignoreesFormat = 0;

  for (const row of rows) {
    const compte = pick(row, "Compte").trim();
    // La ligne « Compte » manquante = ligne parasite.
    if (!compte) continue;
    lignesLues += 1;
    // On saute la ligne miroir « Banque » (512xxx) : c'est le double de l'opé.
    if (compte.startsWith("512")) continue;

    const dateStr = pick(row, "Date");
    const date = parseDateFr(dateStr);
    const debit = parseMontant(pick(row, "Debit", "Débit"));
    const credit = parseMontant(pick(row, "Credit", "Crédit"));
    const montant = debit > 0 ? debit : credit;
    if (!date || montant <= 0) {
      ignoreesFormat += 1;
      continue;
    }

    const libelle = pick(row, "Libelle du compte", "Libelle", "Libellé").trim();
    // Attention : deux colonnes contiennent « Libelle » → on récupère les deux.
    const libelleOp = pick(row, "Libelle", "Libellé").trim();
    const libelleCompte = pick(row, "Libelle du compte").trim() || libelle;

    // Contrepartie au débit → l'argent SORT du compte pro ; au crédit → il RENTRE.
    const sens: "entree" | "sortie" = debit > 0 ? "sortie" : "entree";
    const categorie = categorieParDefaut(compte, libelleCompte);
    const type = typeDeCategorie(categorie);
    const periode = date.toISOString().slice(0, 7); // AAAA-MM

    // Clé de dédup : contenu + rang d'occurrence (des opés identiques le même jour
    // existent, ex. deux « Merchant payment » de 4,92 € — il faut les garder).
    const contenu = `${date.toISOString().slice(0, 10)}|${libelleOp}|${compte}|${debit}|${credit}`;
    const rang = occurrences.get(contenu) ?? 0;
    occurrences.set(contenu, rang + 1);
    const hash = `${contenu}#${rang}`;

    ecritures.push({
      date,
      libelle: libelleOp,
      compte,
      libelleCompte,
      montant,
      sens,
      type,
      categorie,
      periode,
      hash,
    });
  }

  return { ecritures, lignesLues, ignoreesFormat };
}
