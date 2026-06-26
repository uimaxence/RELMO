import { Users, Globe, ListChecks, Euro } from "lucide-react";

import { prisma } from "@/lib/db";

// Lit la DB : on veut les chiffres en direct, pas un snapshot de build.
export const dynamic = "force-dynamic";
import { PageHeader } from "@/components/page-header";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

function currentPeriod() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

export default async function DashboardPage() {
  const periode = currentPeriod();
  const now = new Date();

  const [clients, sites, contrats, livrablesAFaire, mrrAgg, aVenirAgg] =
    await Promise.all([
      prisma.client.count(),
      prisma.site.count(),
      prisma.contrat.count({ where: { statut: "actif" } }),
      prisma.livrable.count({ where: { periode, statut: "a_faire" } }),
      // MRR facturé : contrats actifs déjà démarrés.
      prisma.contrat.aggregate({
        _sum: { montantMensuel: true },
        where: { statut: "actif", dateDebut: { lte: now } },
      }),
      // Contrats actifs pas encore démarrés (ex. mois offert).
      prisma.contrat.aggregate({
        _sum: { montantMensuel: true },
        where: { statut: "actif", dateDebut: { gt: now } },
      }),
    ]);

  const mrr = mrrAgg._sum.montantMensuel ?? 0;
  const aVenir = aVenirAgg._sum.montantMensuel ?? 0;

  const kpis = [
    {
      label: "MRR facturé",
      value: `${mrr.toLocaleString("fr-FR")} €`,
      icon: Euro,
      hint:
        aVenir > 0
          ? `+ ${aVenir.toLocaleString("fr-FR")} € à venir (mois offert)`
          : "Contrats actifs déjà démarrés",
    },
    {
      label: "Clients",
      value: clients,
      icon: Users,
      hint: `${sites} site${sites > 1 ? "s" : ""} géré${sites > 1 ? "s" : ""}`,
    },
    {
      label: "Sites",
      value: sites,
      icon: Globe,
      hint: `${contrats} contrat${contrats > 1 ? "s" : ""} actif${contrats > 1 ? "s" : ""}`,
    },
    {
      label: "Livrables à faire",
      value: livrablesAFaire,
      icon: ListChecks,
      hint: `Période ${periode}`,
    },
  ];

  return (
    <div>
      <PageHeader
        title="Tableau de bord"
        description="Vue consolidée : ce qui est vendu, ce qui reste à livrer ce mois-ci, et le récurrent facturé."
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {kpis.map((kpi) => (
          <Card key={kpi.label}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {kpi.label}
              </CardTitle>
              <kpi.icon className="size-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{kpi.value}</div>
              <CardDescription className="mt-1">{kpi.hint}</CardDescription>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Prochaine étape</CardTitle>
          <CardDescription>
            Le socle est en place. Sprint 1 : CRUD clients → sites → contrats →
            engagements.
          </CardDescription>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Ajoute un premier client depuis{" "}
          <span className="font-medium text-foreground">Clients &amp; sites</span>,
          puis ses sites et contrats. Les livrables du mois se généreront à partir
          des engagements récurrents.
        </CardContent>
      </Card>
    </div>
  );
}
