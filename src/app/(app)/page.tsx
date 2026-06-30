import Link from "next/link";
import { Users, Globe, ListChecks, Euro, AlertTriangle, Clock } from "lucide-react";

import { prisma } from "@/lib/db";
import { PageHeader } from "@/components/page-header";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ObjectifMrr } from "@/components/objectif-mrr";
import { KpiCard } from "@/components/dashboard/kpi-card";
import { VenduVsLivre, type VenduItem } from "@/components/dashboard/vendu-vs-livre";
import { AiBanner } from "@/components/dashboard/ai-banner";
import { MrrEvolutionChart } from "@/components/dashboard/mrr-evolution";
import { euros, dateFr } from "@/lib/format";
import { currentPeriode, periodeLabel, shiftPeriode } from "@/lib/periode";
import { ensureObjectif } from "@/lib/objectif";
import { captureSnapshot, getSnapshots } from "@/lib/mrr-snapshot";

// Lit la DB : on veut les chiffres en direct, pas un snapshot de build.
export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const periode = currentPeriode();
  const now = new Date();

  const [
    clients,
    sites,
    contratsActifs,
    mrrAgg,
    aVenirAgg,
    livrables,
    upcoming,
    potentielAgg,
  ] = await Promise.all([
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
            include: {
              contrat: {
                include: {
                  site: { include: { client: { select: { nom: true } } } },
                },
              },
            },
          },
        },
      }),
      prisma.contrat.findMany({
        where: { statut: "actif", dateDebut: { gt: now } },
        orderBy: { dateDebut: "asc" },
        include: { site: { include: { client: true } } },
      }),
      // MRR potentiel : devis en négociation.
      prisma.devis.aggregate({
        _sum: { montantMensuelPropose: true },
        where: { statut: "en_nego" },
      }),
    ]);

  const mrr = mrrAgg._sum.montantMensuel ?? 0;
  const aVenir = aVenirAgg._sum.montantMensuel ?? 0;
  const potentiel = potentielAgg._sum.montantMensuelPropose ?? 0;
  const objectif = await ensureObjectif();

  // Historique MRR : on enregistre le mois courant, puis on lit la série.
  await captureSnapshot(periode);
  const snapshots = await getSnapshots();
  const prevSnap = snapshots.find((s) => s.periode === shiftPeriode(periode, -1));
  const mrrDelta =
    prevSnap && prevSnap.mrr > 0
      ? Math.round(((mrr - prevSnap.mrr) / prevSnap.mrr) * 1000) / 10
      : undefined;
  const evolutionData = snapshots.map((s) => ({
    label: periodeLabel(s.periode).split(" ")[0],
    mrr: s.mrr,
  }));

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

  // Vendu vs livré : par engagement (vendu = livrables prévus, livré = faits).
  const parEng = new Map<string, VenduItem>();
  for (const l of livrables) {
    const site = l.engagement.contrat.site;
    const g =
      parEng.get(l.engagement.id) ??
      {
        label: l.engagement.libelle,
        site: site.nom,
        client: site.client.nom,
        siteId: site.id,
        vendu: 0,
        livre: 0,
      };
    g.vendu++;
    if (l.statut === "fait") g.livre++;
    parEng.set(l.engagement.id, g);
  }
  const venduItems = [...parEng.values()];

  const kpis = [
    {
      label: "MRR facturé",
      value: euros(mrr),
      icon: Euro,
      delta: mrrDelta,
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
          <KpiCard
            key={kpi.label}
            label={kpi.label}
            value={kpi.value}
            hint={kpi.hint}
            icon={kpi.icon}
            delta={(kpi as { delta?: number }).delta}
          />
        ))}
      </div>

      <ObjectifMrr objectif={objectif} current={mrr} potentiel={potentiel} />

      <Card>
        <CardHeader className="flex flex-row items-end justify-between space-y-0">
          <div>
            <CardTitle className="text-base">Évolution du MRR</CardTitle>
            <CardDescription>MRR facturé, mois après mois.</CardDescription>
          </div>
          <span className="font-mono text-2xl font-medium tabular-nums">
            {euros(mrr)}
          </span>
        </CardHeader>
        <CardContent>
          {evolutionData.length >= 2 ? (
            <MrrEvolutionChart data={evolutionData} />
          ) : (
            <p className="py-8 text-center text-sm text-muted-foreground">
              L&apos;historique se construit mois après mois — la courbe
              apparaîtra dès le 2ᵉ mois enregistré.
            </p>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <VenduVsLivre items={venduItems} periode={periodeLabel(periode)} />

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

      <AiBanner />
    </div>
  );
}
