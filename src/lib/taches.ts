import { prisma } from "@/lib/db";
import { ensureObjectif, computeObjectif } from "@/lib/objectif";
import {
  weekBounds,
  weekLabel,
  periodeOfWeek,
  firstWeekOfPeriode,
} from "@/lib/semaine";

function pad(n: number) {
  return String(n).padStart(2, "0");
}

export function dayKey(d: Date = new Date()) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

async function exists(semaine: string, refType: string, refId: string) {
  return (
    (await prisma.tache.count({ where: { semaine, refType, refId } })) > 0
  );
}

// Génère (top-up idempotent) la to-do d'une SEMAINE à partir du réel (F12).
export async function generateTachesSemaine(semaine: string) {
  let created = 0;
  const periode = periodeOfWeek(semaine);
  const { start, end } = weekBounds(semaine);
  const lundi = dayKey(start);

  // 1a) Livrables datés sur cette semaine (cadence hebdo).
  const livrablesHebdo = await prisma.livrable.findMany({
    where: { semaine, statut: "a_faire" },
    include: {
      engagement: { include: { contrat: { include: { site: true } } } },
    },
  });

  // 1b) Livrables mensuels (non datés) : affichés sur la 1re semaine du mois.
  const livrablesMensuels =
    semaine === firstWeekOfPeriode(periode)
      ? await prisma.livrable.findMany({
          where: { periode, semaine: null, statut: "a_faire" },
          include: {
            engagement: { include: { contrat: { include: { site: true } } } },
          },
        })
      : [];

  for (const l of [...livrablesHebdo, ...livrablesMensuels]) {
    if (await exists(semaine, "livrable", l.id)) continue;
    await prisma.tache.create({
      data: {
        date: lundi,
        semaine,
        libelle: `Livrer : ${l.libelle} · ${l.engagement.contrat.site.nom}`,
        type: "livrable",
        refType: "livrable",
        refId: l.id,
        priorite: "normale",
        genereAuto: true,
      },
    });
    created++;
  }

  // 2) Devis à relancer dans la semaine.
  const devis = await prisma.devis.findMany({
    where: {
      statut: { in: ["envoye", "en_nego"] },
      dateRelance: { gte: start, lte: end },
    },
    include: { client: true },
  });
  for (const d of devis) {
    if (await exists(semaine, "devis", d.id)) continue;
    await prisma.tache.create({
      data: {
        date: lundi,
        semaine,
        libelle: `Relancer : ${d.client.nom} · ${d.libelle}`,
        type: "relance_devis",
        refType: "devis",
        refId: d.id,
        priorite: "haute",
        genereAuto: true,
      },
    });
    created++;
  }

  // 3) Nudge prospection, calibré sur l'écart à l'objectif (cf. §11.2b).
  const objectif = await ensureObjectif();
  const mrrAgg = await prisma.contrat.aggregate({
    _sum: { montantMensuel: true },
    where: { statut: "actif", dateDebut: { lte: new Date() }, facturationDemarree: true },
  });
  const c = computeObjectif(objectif, mrrAgg._sum.montantMensuel ?? 0);
  const prospExiste =
    (await prisma.tache.count({ where: { semaine, type: "prospection" } })) > 0;
  if (!c.atteint && !prospExiste) {
    await prisma.tache.create({
      data: {
        date: lundi,
        semaine,
        libelle: `Prospection (${weekLabel(semaine).replace("Semaine du ", "")}) : viser +${Math.round(c.rythmeRequis)} €/mois. Vends un palier, pas du 60 €.`,
        type: "prospection",
        priorite: "haute",
        genereAuto: true,
      },
    });
    created++;
  }

  return { created };
}

// Première visite de la semaine : on amorce la liste. Les semaines suivantes ne
// ré-ajoutent pas ce qui a été supprimé (bouton « Régénérer » pour compléter).
export async function ensureTachesSemaine(semaine: string) {
  const count = await prisma.tache.count({ where: { semaine } });
  if (count === 0) await generateTachesSemaine(semaine);
}
