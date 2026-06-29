"use server";

import { revalidatePath } from "next/cache";

import { prisma } from "@/lib/db";
import { generateTachesSemaine, dayKey } from "@/lib/taches";
import { isWeekKey } from "@/lib/semaine";

const STATUTS = ["a_faire", "en_cours", "fait", "reporte"] as const;
type Statut = (typeof STATUTS)[number];

const PRIORITES = ["basse", "normale", "haute"] as const;

function revalidateTaches() {
  revalidatePath("/semaine");
  revalidatePath("/");
}

export async function generateTachesAction(
  semaine: string,
): Promise<{ created: number }> {
  if (!isWeekKey(semaine)) return { created: 0 };
  const r = await generateTachesSemaine(semaine);
  revalidateTaches();
  return r;
}

// Change le statut d'une tâche. Si elle est liée à un livrable, on synchronise
// l'état du livrable (fait/à faire) — la to-do pilote le livré.
export async function setTacheStatut(id: string, statut: string): Promise<void> {
  if (!STATUTS.includes(statut as Statut)) return;
  const tache = await prisma.tache.update({ where: { id }, data: { statut } });

  if (tache.refType === "livrable" && tache.refId) {
    if (statut === "fait") {
      await prisma.livrable.update({
        where: { id: tache.refId },
        data: { statut: "fait", faitLe: new Date() },
      });
      revalidatePath("/livrables");
    } else if (statut === "a_faire") {
      await prisma.livrable.update({
        where: { id: tache.refId },
        data: { statut: "a_faire", faitLe: null },
      });
      revalidatePath("/livrables");
    }
  }
  revalidateTaches();
}

export async function addTache(
  semaine: string,
  libelle: string,
  clientId?: string,
): Promise<void> {
  if (!isWeekKey(semaine) || !libelle.trim()) return;

  // Si un client est tagué (@), on lie la tâche à sa fiche (refType/refId).
  let ref: { refType: string; refId: string } | undefined;
  if (clientId) {
    const ok = await prisma.client.count({ where: { id: clientId } });
    if (ok) ref = { refType: "client", refId: clientId };
  }

  await prisma.tache.create({
    data: {
      date: dayKey(),
      semaine,
      libelle: libelle.trim(),
      type: "autre",
      genereAuto: false,
      ...ref,
    },
  });
  revalidateTaches();
  if (ref) revalidatePath(`/clients/${ref.refId}`);
}

// Édition d'une carte (façon Notion) : libellé, note, priorité, type.
export async function updateTache(
  id: string,
  data: { libelle?: string; note?: string; priorite?: string; type?: string },
): Promise<void> {
  const patch: Record<string, string | null> = {};
  if (typeof data.libelle === "string" && data.libelle.trim())
    patch.libelle = data.libelle.trim();
  if (typeof data.note === "string")
    patch.note = data.note.trim() || null;
  if (data.priorite && PRIORITES.includes(data.priorite as (typeof PRIORITES)[number]))
    patch.priorite = data.priorite;
  if (data.type) patch.type = data.type;
  if (Object.keys(patch).length === 0) return;

  await prisma.tache.update({ where: { id }, data: patch });
  revalidateTaches();
}

export async function deleteTache(id: string): Promise<void> {
  await prisma.tache.delete({ where: { id } });
  revalidateTaches();
}
