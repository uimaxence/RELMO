"use server";

import { revalidatePath } from "next/cache";

import { prisma } from "@/lib/db";
import { isPeriode, contratActifSurPeriode } from "@/lib/periode";
import { weeksInPeriode, weekLabel } from "@/lib/semaine";

const STATUTS = ["a_faire", "fait", "non_applicable"] as const;
type Statut = (typeof STATUTS)[number];

function revalidateLivrables() {
  revalidatePath("/livrables");
  revalidatePath("/");
}

// Génère (top-up idempotent) les livrables d'une période à partir des
// engagements dont le contrat est actif sur cette période.
// Pour chaque engagement : on complète jusqu'à quantiteParMois.
export async function generateLivrables(
  periode: string,
): Promise<{ created: number }> {
  if (!isPeriode(periode)) return { created: 0 };

  const engagements = await prisma.engagement.findMany({
    include: { contrat: true },
  });

  let created = 0;
  for (const e of engagements) {
    if (!contratActifSurPeriode(e.contrat, periode)) continue;

    if (e.recurrence === "a_la_demande") continue; // jamais auto-généré

    if (e.recurrence === "hebdomadaire") {
      // Cadence hebdo : un livrable daté par semaine du mois (idempotent).
      for (const semaine of weeksInPeriode(periode)) {
        const exists = await prisma.livrable.count({
          where: { engagementId: e.id, periode, semaine },
        });
        if (exists > 0) continue;
        await prisma.livrable.create({
          data: {
            engagementId: e.id,
            periode,
            semaine,
            libelle: `${e.libelle} · ${weekLabel(semaine).replace("Semaine du ", "sem. ")}`,
            statut: "a_faire",
            source: "manuel",
          },
        });
        created++;
      }
      continue;
    }

    // Cadence mensuelle : on complète jusqu'à quantiteParMois (semaine = null).
    const existing = await prisma.livrable.count({
      where: { engagementId: e.id, periode, semaine: null },
    });
    const manquants = e.quantiteParMois - existing;
    if (manquants <= 0) continue;

    for (let i = 0; i < manquants; i++) {
      await prisma.livrable.create({
        data: {
          engagementId: e.id,
          periode,
          libelle:
            e.quantiteParMois > 1
              ? `${e.libelle} (${existing + i + 1}/${e.quantiteParMois})`
              : e.libelle,
          statut: "a_faire",
          source: "manuel",
        },
      });
      created++;
    }
  }

  revalidateLivrables();
  return { created };
}

export async function setLivrableStatut(
  id: string,
  statut: string,
): Promise<void> {
  if (!STATUTS.includes(statut as Statut)) return;
  await prisma.livrable.update({
    where: { id },
    data: {
      statut,
      faitLe: statut === "fait" ? new Date() : null,
    },
  });
  revalidateLivrables();
}

// Ajoute un livrable supplémentaire à un engagement (ex. podcast à la demande).
export async function addLivrable(
  engagementId: string,
  periode: string,
  libelle: string,
): Promise<void> {
  if (!isPeriode(periode)) return;
  await prisma.livrable.create({
    data: {
      engagementId,
      periode,
      libelle: libelle.trim() || "Livrable",
      statut: "a_faire",
      source: "manuel",
    },
  });
  revalidateLivrables();
}

export async function deleteLivrable(id: string): Promise<void> {
  await prisma.livrable.delete({ where: { id } });
  revalidateLivrables();
}
