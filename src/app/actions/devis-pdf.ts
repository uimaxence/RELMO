"use server";

import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { randomUUID } from "node:crypto";

import {
  extraireDevisDepuisTexte,
  type DevisExtraction,
} from "@/lib/ai/assistant";

export type PdfAnalyseResult =
  | { ok: true; data: DevisExtraction; pdfUrl: string }
  | { ok: false; error: string };

const MAX_BYTES = 10 * 1024 * 1024; // 10 Mo

// Reçoit un PDF déposé sur un devis : le stocke (public/uploads/devis), en
// extrait le texte, puis demande à DeepSeek de structurer les champs du devis.
export async function analyserPdfDevis(
  formData: FormData,
): Promise<PdfAnalyseResult> {
  const file = formData.get("file");
  if (!(file instanceof File)) return { ok: false, error: "Aucun fichier reçu." };
  if (file.type && file.type !== "application/pdf")
    return { ok: false, error: "Seuls les PDF sont acceptés." };
  if (file.size > MAX_BYTES)
    return { ok: false, error: "PDF trop volumineux (max 10 Mo)." };

  const bytes = new Uint8Array(await file.arrayBuffer());

  // 1) Stockage local (mono-utilisateur). Le PDF reste rattaché au devis.
  let pdfUrl: string;
  try {
    const dir = join(process.cwd(), "public", "uploads", "devis");
    await mkdir(dir, { recursive: true });
    const name = `${randomUUID()}.pdf`;
    await writeFile(join(dir, name), bytes);
    pdfUrl = `/uploads/devis/${name}`;
  } catch {
    return { ok: false, error: "Impossible d'enregistrer le PDF." };
  }

  // 2) Extraction du texte (unpdf, pur JS).
  let texte = "";
  try {
    const { extractText, getDocumentProxy } = await import("unpdf");
    const pdf = await getDocumentProxy(bytes);
    const res = await extractText(pdf, { mergePages: true });
    texte = Array.isArray(res.text) ? res.text.join("\n") : res.text;
  } catch {
    return { ok: false, error: "Lecture du PDF impossible (format non géré)." };
  }

  // 3) Structuration via DeepSeek.
  const extraction = await extraireDevisDepuisTexte(texte);
  if (!extraction.ok) return { ok: false, error: extraction.error };

  return { ok: true, data: extraction.data, pdfUrl };
}
