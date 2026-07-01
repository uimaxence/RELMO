import { prisma } from "@/lib/db";
import { currentPeriode } from "@/lib/periode";

// Capture (upsert) la photo MRR de la période. Appelée au chargement du
// dashboard : le mois courant est toujours à jour, l'historique s'accumule.
export async function captureSnapshot(periode = currentPeriode()) {
  const now = new Date();
  const [mrrAgg, potentielAgg, nbClients, nbContrats] = await Promise.all([
    prisma.contrat.aggregate({
      _sum: { montantMensuel: true },
      where: { statut: "actif", dateDebut: { lte: now }, facturationDemarree: true },
    }),
    prisma.devis.aggregate({
      _sum: { montantMensuelPropose: true },
      where: { statut: "en_nego" },
    }),
    prisma.client.count(),
    prisma.contrat.count({ where: { statut: "actif" } }),
  ]);

  const mrr = mrrAgg._sum.montantMensuel ?? 0;
  const potentiel = potentielAgg._sum.montantMensuelPropose ?? 0;

  await prisma.mrrSnapshot.upsert({
    where: { periode },
    create: { periode, mrr, potentiel, nbClients, nbContrats },
    update: { mrr, potentiel, nbClients, nbContrats, capturedAt: now },
  });
}

export function getSnapshots() {
  return prisma.mrrSnapshot.findMany({ orderBy: { periode: "asc" } });
}
