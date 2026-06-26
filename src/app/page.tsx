import Link from "next/link";
import {
  Users,
  Globe,
  ListChecks,
  Euro,
  AlertTriangle,
  Clock,
  ArrowRight,
} from "lucide-react";

import { prisma } from "@/lib/db";
import { PageHeader } from "@/components/page-header";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { euros, dateFr } from "@/lib/format";
import { currentPeriode, periodeLabel } from "@/lib/periode";

// Lit la DB : on veut les chiffres en direct, pas un snapshot de build.
export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const periode = currentPeriode();
  const now = new Date();

  const [clients, sites, contratsActifs, mrrAgg, aVenirAgg, livrables, upcoming] =
    await Promise.all([
      prisma.client.count(),
      prisma.site.count(),
      prisma.contrat.count({ where: { statut: "actif" } }),
      prisma.contrat.aggregate({
        _sum: { montantMensuel: true },
        where: { statut: "actif", dateDebut: { lte: now } },
      }),
      prisma.contrat.aggregate({
        _sum: { montantMensuel: true },
        where: { statut: "actif", dateDebut: { gt: now } },
      }),
      prisma.livrable.findMany({
        where: { periode },
        include: {
          engagement: {
            include: { contrat: { include: { site: true } } },
          },
        },
      }),
      prisma.contrat.findMany({
        where: { statut: "actif", dateDebut: { gt: now } },
        orderBy: { dateDebut: "asc" },
        include: { site: { include: { client: true } } },
      }),
    ]);

  const mrr = mrrAgg._sum.montantMensuel ?? 0;
  const aVenir = aVenirAgg._sum.montantMensuel ?? 0;

  // Progression des livrables par site sur la période courante.
  const parSite = new Map<
    string,
    { siteId: string; nom: string; total: number; faits: number }
  >();
  for (const l of livrables) {
    const site = l.engagement.contrat.site;
    const g =
      parSite.get(site.id) ??
      { siteId: site.id, nom: site.nom, total: 0, faits: 0 };
    g.total++;
    if (l.statut === "fait") g.faits++;
    parSite.set(site.id, g);
  }
  const sitesLivrables = [...parSite.values()].sort((a, b) => {
    const ra = a.total - a.faits;
    const rb = b.total - b.faits;
    return rb - ra; // les plus en retard d'abord
  });
  const restantsTotal = livrables.filter((l) => l.statut === "a_faire").length;

  const enRetard = sitesLivrables.filter((s) => s.faits < s.total);

  const kpis = [
    {
      label: "MRR facturé",
      value: euros(mrr),
      icon: Euro,
      hint: aVenir > 0 ? `+ ${euros(aVenir)} à venir` : "Contrats démarrés",
    },
    {
      label: "Clients",
      value: clients,
      icon: Users,
      hint: `${sites} site${sites > 1 ? "s" : ""}`,
    },
    {
      label: "Contrats actifs",
      value: contratsActifs,
      icon: Globe,
      hint: "Signés (démarrés ou à venir)",
    },
    {
      label: "Livrables à faire",
      value: restantsTotal,
      icon: ListChecks,
      hint: periodeLabel(periode),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Tableau de bord"
        description="Ce qui est vendu, ce qui reste à livrer ce mois-ci, et le récurrent facturé."
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

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Livrables du mois par site */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <div>
              <CardTitle className="text-base">
                Livrables — <span className="capitalize">{periodeLabel(periode)}</span>
              </CardTitle>
              <CardDescription>Avancement par site.</CardDescription>
            </div>
            <Button asChild variant="ghost" size="sm">
              <Link href="/livrables">
                Tout voir <ArrowRight />
              </Link>
            </Button>
          </CardHeader>
          <CardContent>
            {sitesLivrables.length === 0 ? (
              <div className="py-6 text-center">
                <p className="text-sm text-muted-foreground">
                  Aucun livrable généré pour ce mois.
                </p>
                <Button asChild variant="outline" size="sm" className="mt-3">
                  <Link href="/livrables">Générer les livrables</Link>
                </Button>
              </div>
            ) : (
              <ul className="space-y-3">
                {sitesLivrables.map((s) => {
                  const pct = Math.round((s.faits / s.total) * 100);
                  return (
                    <li key={s.siteId} className="space-y-1.5">
                      <div className="flex items-center justify-between text-sm">
                        <Link
                          href={`/sites/${s.siteId}`}
                          className="font-medium hover:underline"
                        >
                          {s.nom}
                        </Link>
                        <span className="text-muted-foreground">
                          {s.faits}/{s.total}
                        </span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-muted">
                        <div
                          className="h-full rounded-full bg-emerald-500 transition-all"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>

        {/* À surveiller */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">À surveiller</CardTitle>
            <CardDescription>
              Livrables en retard et contrats à venir.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {enRetard.length === 0 && upcoming.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                Rien à signaler. 🎉
              </p>
            ) : null}

            {enRetard.length > 0 ? (
              <div className="space-y-2">
                {enRetard.map((s) => (
                  <Link
                    key={s.siteId}
                    href="/livrables"
                    className="flex items-center justify-between gap-2 rounded-md border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-sm hover:bg-amber-500/10"
                  >
                    <span className="inline-flex items-center gap-2">
                      <AlertTriangle className="size-4 text-amber-600" />
                      <span className="font-medium">{s.nom}</span>
                    </span>
                    <span className="text-muted-foreground">
                      {s.total - s.faits} restant
                      {s.total - s.faits > 1 ? "s" : ""}
                    </span>
                  </Link>
                ))}
              </div>
            ) : null}

            {upcoming.length > 0 ? (
              <div className="space-y-2">
                {upcoming.map((ct) => (
                  <Link
                    key={ct.id}
                    href={`/sites/${ct.siteId}`}
                    className="flex items-center justify-between gap-2 rounded-md border px-3 py-2 text-sm hover:bg-muted/50"
                  >
                    <span className="inline-flex min-w-0 items-center gap-2">
                      <Clock className="size-4 shrink-0 text-muted-foreground" />
                      <span className="truncate">
                        <span className="font-medium">{ct.site.nom}</span>{" "}
                        <span className="text-muted-foreground">
                          · {euros(ct.montantMensuel)}/mois
                        </span>
                      </span>
                    </span>
                    <Badge variant="secondary" className="shrink-0">
                      {dateFr(ct.dateDebut)}
                    </Badge>
                  </Link>
                ))}
              </div>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
