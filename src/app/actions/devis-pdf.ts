"use server";

import { randomUUID } from "node:crypto";

import { put } from "@vercel/blob";

import { prisma } from "@/lib/db";
import {
  extraireDevisDepuisTexte,
  type DevisExtraction,
} from "@/lib/ai/assistant";

// Client détecté dans le PDF : soit déjà en base (existantId), soit nouveau
// (le dialog propose alors de le créer en 1 clic).
export type ClientDetecte = {
  nom: string;
  email?: string;
  telephone?: string;
  existantId?: string;
  existantNom?: string;
};

export type PdfAnalyseResult =
  | {
      ok: true;
      data: DevisExtraction;
      pdfUrl: string;
      clientDetecte: ClientDetecte | null;
    }
  | { ok: false; error: string };

const MAX_BYTES = 10 * 1024 * 1024; // 10 Mo

// Reçoit un PDF déposé sur un devis : le stocke sur Vercel Blob, en
// extrait le texte, puis demande à DeepSeek de structurer les champs du devis.
export async function analyserPdfDevis(
  formData: FormData,
): Promise<PdfAnalyseResult> {
  if (!process.env.BLOB_READ_WRITE_TOKEN)
    return { ok: false, error: "Stockage non configuré (BLOB_READ_WRITE_TOKEN)." };

  const file = formData.get("file");
  if (!(file instanceof File)) return { ok: false, error: "Aucun fichier reçu." };
  if (file.type && file.type !== "application/pdf")
    return { ok: false, error: "Seuls les PDF sont acceptés." };
  if (file.size > MAX_BYTES)
    return { ok: false, error: "PDF trop volumineux (max 10 Mo)." };

  const bytes = new Uint8Array(await file.arrayBuffer());

  // 1) Stockage sur Vercel Blob. Le PDF reste rattaché au devis.
  let pdfUrl: string;
  try {
    const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-60);
    const blob = await put(`devis/${randomUUID()}-${safe}`, file, {
      access: "public",
      contentType: "application/pdf",
    });
    pdfUrl = blob.url;
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

  // 4) Le client du devis existe-t-il déjà en base ? (nom, insensible à la casse)
  let clientDetecte: ClientDetecte | null = null;
  const nom = extraction.data.clientNom;
  if (nom) {
    const existant = await prisma.client.findFirst({
      where: { nom: { equals: nom, mode: "insensitive" } },
      select: { id: true, nom: true },
    });
    clientDetecte = {
      nom,
      email: extraction.data.clientEmail,
      telephone: extraction.data.clientTelephone,
      existantId: existant?.id,
      existantNom: existant?.nom,
    };
  }

  return { ok: true, data: extraction.data, pdfUrl, clientDetecte };
}
