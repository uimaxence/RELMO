import { prisma } from "@/lib/db";
import { ensureObjectif, computeObjectif } from "@/lib/objectif";

function pad(n: number) {
  return String(n).padStart(2, "0");
}

export function todayKey(d: Date = new Date()) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function shiftDay(dateKey: string, n: number) {
  const [y, m, d] = dateKey.split("-").map(Number);
  return todayKey(new Date(y, m - 1, d + n));
}

export function dayLabel(dateKey: string) {
  const [y, m, d] = dateKey.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

export function isDayKey(v: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(v);
}

async function exists(date: string, refType: string, refId: string) {
  return (await prisma.tache.count({ where: { date, refType, refId } })) > 0;
}

// Génère (top-up idempotent) la to-do d'un jour à partir du réel (F12).
export async function generateTaches(date: string) {
  let created = 0;
  const periode = date.slice(0, 7);

  // 1) Livrables restants du mois.
  const livrables = await prisma.livrable.findMany({
    where: { periode, statut: "a_faire" },
    include: {
      engagement: { include: { contrat: { include: { site: true } } } },
    },
  });
  for (const l of livrables) {
    if (await exists(date, "livrable", l.id)) continue;
    await prisma.tache.create({
      data: {
        date,
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

  // 2) Devis à relancer (relance due, négo ouverte).
  const fin = new Date(`${date}T23:59:59`);
  const devis = await prisma.devis.findMany({
    where: { statut: { in: ["envoye", "en_nego"] }, dateRelance: { lte: fin } },
    include: { client: true },
  });
  for (const d of devis) {
    if (await exists(date, "devis", d.id)) continue;
    await prisma.tache.create({
      data: {
        date,
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
    where: { statut: "actif", dateDebut: { lte: new Date() } },
  });
  const c = computeObjectif(objectif, mrrAgg._sum.montantMensuel ?? 0);
  const prospExiste =
    (await prisma.tache.count({ where: { date, type: "prospection" } })) > 0;
  if (!c.atteint && !prospExiste) {
    await prisma.tache.create({
      data: {
        date,
        libelle: `Prospection : viser +${Math.round(c.rythmeRequis)} €/mois ce mois pour rester dans les temps. Vends un palier, pas du 60 €.`,
        type: "prospection",
        priorite: "haute",
        genereAuto: true,
      },
    });
    created++;
  }

  return { created };
}

// Première visite du jour : on amorce la liste. Les jours suivants ne ré-ajoutent
// pas ce que l'utilisateur a supprimé (bouton « Régénérer » pour compléter).
export async function ensureTachesDuJour(date: string) {
  const count = await prisma.tache.count({ where: { date } });
  if (count === 0) await generateTaches(date);
}
