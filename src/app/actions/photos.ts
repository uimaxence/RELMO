"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { put, del } from "@vercel/blob";

import { prisma } from "@/lib/db";
import { QUOTA_BYTES } from "@/lib/photos";

export type UploadResult = { ok: boolean; error?: string };

// Résout un client depuis son token de portail (cloisonnement serveur).
async function clientFromToken(token: string) {
  if (!token) return null;
  return prisma.client.findFirst({
    where: { portailToken: token, portailActif: true },
  });
}

function moisDe(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

// Total d'octets stockés (tous clients) — pour le quota global.
export async function totalStockage(): Promise<number> {
  const agg = await prisma.photo.aggregate({ _sum: { taille: true } });
  return agg._sum.taille ?? 0;
}

export async function uploadPhoto(
  token: string,
  formData: FormData,
): Promise<UploadResult> {
  const client = await clientFromToken(token);
  if (!client) return { ok: false, error: "Accès invalide." };

  if (!process.env.BLOB_READ_WRITE_TOKEN)
    return {
      ok: false,
      error: "Stockage non configuré (BLOB_READ_WRITE_TOKEN absent).",
    };

  const file = formData.get("file");
  if (!(file instanceof File)) return { ok: false, error: "Aucun fichier." };
  if (!file.type.startsWith("image/"))
    return { ok: false, error: "Seules les images sont acceptées." };

  // Quota global 5 Go.
  const used = await totalStockage();
  if (used + file.size > QUOTA_BYTES)
    return { ok: false, error: "Quota de 5 Go atteint." };

  const bytes = new Uint8Array(await file.arrayBuffer());

  // Tri par date : EXIF (date de prise) sinon date d'upload.
  let prisLe: Date | null = null;
  try {
    const exifr = (await import("exifr")).default;
    const exif = await exifr.parse(bytes, ["DateTimeOriginal", "CreateDate"]);
    const d = exif?.DateTimeOriginal ?? exif?.CreateDate;
    if (d instanceof Date && !isNaN(d.getTime())) prisLe = d;
  } catch {
    // pas d'EXIF : on retombe sur la date d'upload
  }
  const dossier = moisDe(prisLe ?? new Date());

  // Stockage Vercel Blob.
  const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-60);
  const pathname = `portail/${client.id}/${randomUUID()}-${safe}`;
  let url: string;
  try {
    const blob = await put(pathname, file, {
      access: "public",
      contentType: file.type,
    });
    url = blob.url;
  } catch {
    return { ok: false, error: "Échec de l'envoi du fichier." };
  }

  await prisma.photo.create({
    data: {
      clientId: client.id,
      dossier,
      nom: file.name.slice(0, 120),
      url,
      pathname,
      taille: file.size,
      prisLe,
    },
  });

  revalidatePath(`/portail/${token}`);
  revalidatePath(`/clients/${client.id}`);
  return { ok: true };
}

export async function deletePhoto(
  token: string,
  photoId: string,
): Promise<UploadResult> {
  const client = await clientFromToken(token);
  if (!client) return { ok: false, error: "Accès invalide." };

  const photo = await prisma.photo.findUnique({ where: { id: photoId } });
  if (!photo || photo.clientId !== client.id)
    return { ok: false, error: "Photo introuvable." };

  try {
    await del(photo.url);
  } catch {
    // si le blob a déjà disparu, on supprime quand même la métadonnée
  }
  await prisma.photo.delete({ where: { id: photoId } });

  revalidatePath(`/portail/${token}`);
  revalidatePath(`/clients/${client.id}`);
  return { ok: true };
}
