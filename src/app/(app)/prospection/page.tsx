import Link from "next/link";
import { Target, Users, Euro, BellRing, Flame, Sparkles, ChevronRight, Search } from "lucide-react";

import { prisma } from "@/lib/db";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { KpiCard } from "@/components/dashboard/kpi-card";
import { DevisStatusBadge } from "@/components/status-badge";
import { InteractionFormDialog } from "@/components/forms/interaction-form-dialog";
import { DevisFormDialog } from "@/components/forms/devis-form-dialog";
import { AiGenerateDialog } from "@/components/ai/ai-generate-dialog";
import {
  actionMessageProspection,
  actionRelanceNego,
  actionAccrochesProspection,
} from "@/app/actions/ai";
import { ensureObjectif, computeObjectif } from "@/lib/objectif";
import { euros, dateFr } from "@/lib/format";
import { labelOf, SOURCES } from "@/lib/constants";

export const dynamic = "force-dynamic";

// Ancienneté du dernier contact (null = jamais).
function joursDepuis(d: Date | null, now: Date): number | null {
  if (!d) return null;
  return Math.floor((now.getTime() - new Date(d).getTime()) / 86_400_000);
}

function froideur(jours: number | null): { label: string; cold: boolean } {
  if (jours === null) return { label: "Jamais contacté", cold: true };
  if (jours === 0) return { label: "Aujourd'hui", cold: false };
  if (jours === 1) return { label: "Hier", cold: false };
  return { label: `Il y a ${jours} j`, cold: jours >= 14 };
}

export default async function ProspectionPage() {
  const now = new Date();
  const finJour = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
    23,
    59,
    59,
  );

  const [
    prospects,
    relances,
    potentielAgg,
    objectif,
    mrrAgg,
    clients,
    sites,
    prospectsDecouverts,
    prospectsChauds,
  ] = await Promise.all([
      prisma.client.findMany({
        where: { statut: "prospect" },
        include: {
          interactions: { orderBy: { date: "desc" }, take: 1 },
          devis: { select: { statut: true } },
        },
      }),
      prisma.devis.findMany({
        where: {
          statut: { in: ["envoye", "en_nego"] },
          dateRelance: { lte: finJour },
        },
        orderBy: { dateRelance: "asc" },
        include: { client: { select: { nom: true } } },
      }),
      prisma.devis.aggregate({
        _sum: { montantMensuelPropose: true },
        where: { statut: "en_nego" },
      }),
      ensureObjectif(),
      prisma.contrat.aggregate({
        _sum: { montantMensuel: true },
        where: { statut: "actif", dateDebut: { lte: now }, facturationDemarree: true },
      }),
      prisma.client.findMany({
        orderBy: { nom: "asc" },
        select: { id: true, nom: true },
      }),
      prisma.site.findMany({
        orderBy: { nom: "asc" },
        select: { id: true, nom: true, client: { select: { nom: true } } },
      }),
      // Prospects découverts (moteur de recherche) non encore convertis/écartés.
      prisma.prospect.count({ where: { statut: { in: ["nouveau", "a_contacter"] } } }),
      prisma.prospect.count({
        where: { statut: { in: ["nouveau", "a_contacter"] }, score: { gte: 65 } },
      }),
    ]);

  const siteOpts = sites.map((s) => ({
    id: s.id,
    nom: s.nom,
    clientNom: s.client.nom,
  }));

  const potentiel = potentielAgg._sum.montantMensuelPropose ?? 0;
  const mrr = mrrAgg._sum.montantMensuel ?? 0;
  const c = computeObjectif(objectif, mrr);

  // Tri : les plus froids d'abord (jamais contacté en tête).
  const rows = prospects
    .map((p) => {
      const last = p.interactions[0]?.date ?? null;
      const jours = joursDepuis(last, now);
      return { ...p, jours, ageTri: jours ?? Number.MAX_SAFE_INTEGER };
    })
    .sort((a, b) => b.ageTri - a.ageTri);

  const kpis = [
    { label: "Prospects", value: rows.length, icon: Users, hint: "À activer" },
    {
      label: "Relances dues",
      value: relances.length,
      icon: BellRing,
      hint: "Devis ouverts à relancer",
    },
    {
      label: "MRR potentiel",
      value: euros(potentiel),
      icon: Euro,
      hint: "Devis en négo",
    },
    {
      label: "Rythme requis",
      value: `+${euros(Math.round(c.rythmeRequis))}`,
      icon: Target,
      hint: `/mois · ${c.statutLabel}`,
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Prospection"
        description="Qui contacter et relancer aujourd'hui pour décrocher le prochain client."
      >
        <Button asChild variant="outline">
          <Link href="/prospection/recherche">
            <Search /> Recherche de prospects
            {prospectsDecouverts > 0 ? (
              <Badge variant="secondary" className="ml-1 font-mono tabular-nums">
                {prospectsDecouverts}
              </Badge>
            ) : null}
          </Link>
        </Button>
        <DevisFormDialog clients={clients} sites={siteOpts} />
      </PageHeader>

      {/* Bandeau : les prospects découverts vivent sur /prospection/recherche.
          On les rappelle ici pour ne jamais les « perdre » en navigant. */}
      {prospectsDecouverts > 0 ? (
        <Link
          href="/prospection/recherche"
          className="flex flex-wrap items-center gap-3 rounded-xl border bg-card px-4 py-3 transition-colors hover:bg-muted/50"
        >
          <Search className="size-4 shrink-0 text-brand" />
          <span className="min-w-0 flex-1 text-sm">
            <span className="font-medium">{prospectsDecouverts} prospect{prospectsDecouverts > 1 ? "s" : ""} découvert{prospectsDecouverts > 1 ? "s" : ""}</span>
            {prospectsChauds > 0 ? (
              <span className="text-muted-foreground">
                {" "}· {prospectsChauds} à fort potentiel (score ≥ 65)
              </span>
            ) : null}
            <span className="text-muted-foreground"> — messages prêts à copier.</span>
          </span>
          <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
        </Link>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {kpis.map((k) => (
          <KpiCard
            key={k.label}
            label={k.label}
            value={k.value}
            hint={k.hint}
            icon={k.icon}
          />
        ))}
      </div>

      {/* Nudge calibré sur l'écart à l'objectif. */}
      <div className="flex flex-wrap items-center gap-3 rounded-xl bg-muted px-4 py-3">
        <Target className="size-4 shrink-0 text-brand" />
        <span className="min-w-0 flex-1 text-sm">
          {c.atteint
            ? "Objectif atteint — chaque nouveau client est du bonus."
            : `Pour rester dans les temps : vise +${euros(Math.round(c.rythmeRequis))}/mois ce mois. Un palier (~120 €/mois) vaut deux abonnements à 60 €.`}
        </span>
        <AiGenerateDialog
          action={actionAccrochesProspection}
          title="Accroches du jour"
          description="Plan de prospection calibré sur ton objectif."
          providerLabel="DeepSeek"
          trigger={
            <Button variant="outline" size="sm">
              <Sparkles className="text-brand" /> Accroches IA
            </Button>
          }
        />
      </div>

      {/* Relances dues */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold">
          Relances dues{" "}
          <span className="font-mono tabular-nums text-muted-foreground">
            {relances.length}
          </span>
        </h2>
        {relances.length === 0 ? (
          <Card>
            <CardContent className="py-6 text-center text-sm text-muted-foreground">
              Aucune relance due aujourd&apos;hui. 🎯
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {relances.map((d) => (
              <Card key={d.id}>
                <CardContent className="flex items-start justify-between gap-3 pt-5">
                  <div className="min-w-0 space-y-1">
                    <p className="font-medium">{d.client.nom}</p>
                    <p className="truncate text-sm text-muted-foreground">
                      {d.libelle} · {euros(d.montantMensuelPropose)}/mois
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Relance prévue le {dateFr(d.dateRelance)}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <DevisStatusBadge statut={d.statut} />
                    <AiGenerateDialog
                      action={actionRelanceNego.bind(null, d.id)}
                      title="Relance de négo"
                      description={`Message pour relancer ${d.client.nom} sans casser le prix.`}
                      providerLabel="DeepSeek"
                      trigger={
                        <Button variant="ghost" size="sm">
                          <Sparkles className="text-brand" /> Relance IA
                        </Button>
                      }
                    />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>

      {/* Prospects à activer */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold">
          Prospects à activer{" "}
          <span className="font-mono tabular-nums text-muted-foreground">
            {rows.length}
          </span>
        </h2>
        {rows.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-sm text-muted-foreground">
              Aucun prospect. Ajoute un client au statut « prospect » pour le
              suivre ici.
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {rows.map((p) => {
              const f = froideur(p.jours);
              const enNego = p.devis.some((d) =>
                ["envoye", "en_nego"].includes(d.statut),
              );
              return (
                <Card key={p.id}>
                  <CardHeader className="flex flex-row items-start justify-between space-y-0">
                    <CardTitle className="text-base">
                      <Link
                        href={`/clients/${p.id}`}
                        className="inline-flex items-center gap-1 hover:underline"
                      >
                        {p.nom}
                        <ChevronRight className="size-4 text-muted-foreground" />
                      </Link>
                    </CardTitle>
                    <span className="inline-flex items-center gap-1.5 text-xs">
                      {f.cold ? (
                        <Flame className="size-3.5 text-amber-600" />
                      ) : null}
                      <span
                        className={
                          f.cold
                            ? "font-medium text-amber-600"
                            : "text-muted-foreground"
                        }
                      >
                        {f.label}
                      </span>
                    </span>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                      {enNego ? (
                        <Badge variant="secondary">Devis en cours</Badge>
                      ) : null}
                      {p.secteur ? (
                        <Badge variant="secondary" className="font-normal">
                          {p.secteur}
                        </Badge>
                      ) : null}
                      {p.source ? (
                        <span>Source : {labelOf(SOURCES, p.source)}</span>
                      ) : null}
                    </div>

                    <div className="flex flex-wrap items-center gap-1">
                      <AiGenerateDialog
                        action={actionMessageProspection.bind(null, p.id)}
                        title="Message de prospection"
                        description={`Accroche personnalisée pour ${p.nom}. Relis avant d'envoyer.`}
                        providerLabel="Perplexity"
                        trigger={
                          <Button variant="outline" size="sm">
                            <Sparkles className="text-brand" /> Prospection
                          </Button>
                        }
                      />
                      <InteractionFormDialog clientId={p.id} />
                      <DevisFormDialog
                        clients={clients}
                        sites={siteOpts}
                        defaultClientId={p.id}
                        trigger={
                          <Button variant="ghost" size="sm">
                            Devis
                          </Button>
                        }
                      />
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
