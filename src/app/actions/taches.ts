"use server";

import { revalidatePath } from "next/cache";

import { prisma } from "@/lib/db";
import { generateTaches, isDayKey } from "@/lib/taches";

const STATUTS = ["a_faire", "fait", "reporte"] as const;

export async function generateTachesAction(
  date: string,
): Promise<{ created: number }> {
  if (!isDayKey(date)) return { created: 0 };
  const r = await generateTaches(date);
  revalidatePath("/jour");
  revalidatePath("/");
  return r;
}

export async function setTacheStatut(id: string, statut: string): Promise<void> {
  if (!STATUTS.includes(statut as (typeof STATUTS)[number])) return;
  await prisma.tache.update({ where: { id }, data: { statut } });
  revalidatePath("/jour");
  revalidatePath("/");
}

export async function addTache(date: string, libelle: string): Promise<void> {
  if (!isDayKey(date) || !libelle.trim()) return;
  await prisma.tache.create({
    data: { date, libelle: libelle.trim(), type: "autre", genereAuto: false },
  });
  revalidatePath("/jour");
}

export async function deleteTache(id: string): Promise<void> {
  await prisma.tache.delete({ where: { id } });
  revalidatePath("/jour");
  revalidatePath("/");
}
