"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { put, del } from "@vercel/blob";

import { prisma } from "@/lib/db";
import { factureSchema } from "@/lib/schemas";
import { parseForm, type FormState } from "@/lib/form";

function revalidateFacture(clientId: string) {
  revalidatePath(`/clients/${clientId}`);
}

export async function createFacture(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const parsed = parseForm(factureSchema, formData);
  if (!parsed.ok) return parsed.state;

  await prisma.facture.create({ data: parsed.data });
  revalidateFacture(parsed.data.clientId);
  return { ok: true, message: "Facture ajoutée." };
}

export async function updateFacture(
  id: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const parsed = parseForm(factureSchema, formData);
  if (!parsed.ok) return parsed.state;

  await prisma.facture.update({ where: { id }, data: parsed.data });
  revalidateFacture(parsed.data.clientId);
  return { ok: true, message: "Facture mise à jour." };
}

export async function deleteFacture(
  id: string,
  clientId: string,
): Promise<void> {
  const facture = await prisma.facture.findUnique({ where: { id } });
  if (facture?.pdfUrl) {
    try {
      await del(facture.pdfUrl);
    } catch {
      // blob déjà absent : on supprime quand même la facture
    }
  }
  await prisma.facture.delete({ where: { id } });
  revalidateFacture(clientId);
}

export type FacturePdfResult =
  | { ok: true; pdfUrl: string; pathnamePdf: string }
  | { ok: false; error: string };

// Upload du PDF de la facture sur Vercel Blob.
export async function uploadFacturePdf(
  formData: FormData,
): Promise<FacturePdfResult> {
  if (!process.env.BLOB_READ_WRITE_TOKEN)
    return { ok: false, error: "Stockage non configuré (BLOB_READ_WRITE_TOKEN)." };

  const file = formData.get("file");
  if (!(file instanceof File)) return { ok: false, error: "Aucun fichier." };
  if (file.type && file.type !== "application/pdf")
    return { ok: false, error: "Seuls les PDF sont acceptés." };

  const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-60);
  const pathname = `factures/${randomUUID()}-${safe}`;
  try {
    const blob = await put(pathname, file, {
      access: "public",
      contentType: "application/pdf",
    });
    return { ok: true, pdfUrl: blob.url, pathnamePdf: pathname };
  } catch {
    return { ok: false, error: "Échec de l'envoi du PDF." };
  }
}
