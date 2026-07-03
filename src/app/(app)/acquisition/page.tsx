import { BarChart3, Send, MessageSquare, BellRing } from "lucide-react";

import { prisma } from "@/lib/db";
import { PageHeader } from "@/components/page-header";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { KpiCard } from "@/components/dashboard/kpi-card";
import { ensureReglage } from "@/lib/wishlist";
import { euros } from "@/lib/format";
import {
  labelOf,
  SOURCES,
  FORMULES,
  PROSPECTION_OBJECTIF_MENSUEL,
} from "@/lib/constants";

export const dynamic = "force-dynamic";

type Agg = {
  total: number;
  signes: number;
  perdus: number;
  enCours: number;
  mrrSigne: number;
};

function emptyAgg(): Agg {
  return { total: 0, signes: 0, perdus: 0, enCours: 0, mrrSigne: 0 };
}

type DevisLite = {
  statut: string;
  montantMensuelPropose: number;
  montantCreation?: number;
};

function accumulate(agg: Agg, d: DevisLite) {
  agg.total++;
  if (d.statut === "accepte") {
    agg.signes++;
    agg.mrrSigne += d.montantMensuelPropose;
  } else if (d.statut === "refuse" || d.statut === "expire") {
    agg.perdus++;
  } else {
    agg.enCours++;
  }
}

function rowsFrom(map: Map<string, Agg>, label: (key: string) => string) {
  return [...map.entries()]
    .map(([key, a]) => {
      const decided = a.signes + a.perdus;
      return {
        key,
        label: label(key),
        ...a,
        taux: decided > 0 ? Math.round((a.signes / decided) * 100) : null,
        ticket: a.signes > 0 ? a.mrrSigne / a.signes : 0,
      };
    })
    .sort((x, y) => y.total - x.total);
}

export default async function AcquisitionPage() {
  const now = new Date();
  const debutMois = new Date(now.getFullYear(), now.getMonth(), 1);

  const [devis, reglage, premiersContactsMois, relancesFaitesMois, contactesTotal, reponduTotal] =
    await Promise.all([
      prisma.devis.findMany({
        select: {
          statut: true,
          montantMensuelPropose: true,
          formule: true,
          motifPerte: true,
          client: { select: { source: true, secteur: true } },
        },
      }),
      ensureReglage(),
      prisma.prospect.count({ where: { contacteLe: { gte: debutMois } } }),
      prisma.prospect.count({ where: { relanceFaiteLe: { gte: debutMois } } }),
      prisma.prospect.count({ where: { contacteLe: { not: null } } }),
      prisma.prospect.count({ where: { reponduLe: { not: null } } }),
    ]);

  const parSource = new Map<string, Agg>();
  const parNiche = new Map<string, Agg>();
  const parFormule = new Map<string, Agg>();
  const motifs = new Map<string, number>();
  const global = emptyAgg();

  for (const d of devis) {
    accumulate(global, d);

    const src = d.client.source ?? "non_precise";
    if (!parSource.has(src)) parSource.set(src, emptyAgg());
    accumulate(parSource.get(src)!, d);

    const niche = (d.client.secteur ?? "").trim() || "non_precise";
    if (!parNiche.has(niche)) parNiche.set(niche, emptyAgg());
    accumulate(parNiche.get(niche)!, d);

    const formule = d.formule ?? "non_precise";
    if (!parFormule.has(formule)) parFormule.set(formule, emptyAgg());
    accumulate(parFormule.get(formule)!, d);

    if ((d.statut === "refuse" || d.statut === "expire") && d.motifPerte?.trim()) {
      const m = d.motifPerte.trim();
      motifs.set(m, (motifs.get(m) ?? 0) + 1);
    }
  }

  const sourceRows = rowsFrom(parSource, (k) =>
    k === "non_precise" ? "Non précisé" : labelOf(SOURCES, k),
  );
  const nicheRows = rowsFrom(parNiche, (k) =>
    k === "non_precise" ? "Non précisé" : k,
  );
  const formuleRows = rowsFrom(parFormule, (k) =>
    k === "non_precise" ? "Non précisé" : labelOf(FORMULES, k),
  );
  const motifRows = [...motifs.entries()].sort((a, b) => b[1] - a[1]);

  const envoisMois = premiersContactsMois + relancesFaitesMois;
  const tauxReponse =
    contactesTotal > 0 ? Math.round((reponduTotal / contactesTotal) * 100) : null;

  const decidedGlobal = global.signes + global.perdus;
  const tauxGlobal =
    decidedGlobal > 0 ? Math.round((global.signes / decidedGlobal) * 100) : null;
  const ticketGlobal =
    global.signes > 0 ? global.mrrSigne / global.signes : 0;

  const kpis = [
    { label: "Devis émis", value: global.total, hint: "Toutes périodes" },
    {
      label: "Signés",
      value: global.signes,
      hint: `${global.enCours} en cours · ${global.perdus} perdus`,
    },
    {
      label: "Taux de signature",
      value: tauxGlobal !== null ? `${tauxGlobal}%` : "—",
      hint: "Signés / décidés",
    },
    {
      label: "Ticket moyen signé",
      value: ticketGlobal > 0 ? `${euros(ticketGlobal)}/mois` : "—",
      hint: `Suivi cible ${euros(reglage.tarifSuivi)}/mois`,
    },
  ];

  const renderTable = (
    rows: ReturnType<typeof rowsFrom>,
    head: string,
  ) => (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="pl-6">{head}</TableHead>
          <TableHead className="text-center">Devis</TableHead>
          <TableHead className="text-center">Signés</TableHead>
          <TableHead className="text-center">Taux</TableHead>
          <TableHead className="pr-6 text-right">Ticket moyen</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((r) => (
          <TableRow key={r.key}>
            <TableCell className="pl-6 font-medium">{r.label}</TableCell>
            <TableCell className="text-center font-mono tabular-nums">
              {r.total}
            </TableCell>
            <TableCell className="text-center font-mono tabular-nums">
              {r.signes}
            </TableCell>
            <TableCell className="text-center font-mono tabular-nums text-muted-foreground">
              {r.taux !== null ? `${r.taux}%` : "—"}
            </TableCell>
            <TableCell className="pr-6 text-right font-mono tabular-nums">
              {r.ticket > 0 ? `${euros(r.ticket)}` : "—"}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Acquisition"
        description="Où se signent les devis : par canal et par niche, pour concentrer l'effort là où ça convertit."
      />

      {/* Machine de prospection (brief §2) : volume + réponse. */}
      <section className="space-y-2">
        <h2 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Prospection sortante · ce mois
        </h2>
        <div className="grid gap-4 sm:grid-cols-3">
          <KpiCard
            label="Envois ce mois"
            value={`${envoisMois} / ${PROSPECTION_OBJECTIF_MENSUEL}`}
            icon={Send}
            hint={`${premiersContactsMois} 1ers contacts · ${relancesFaitesMois} relances`}
          />
          <KpiCard
            label="Taux de réponse"
            value={tauxReponse !== null ? `${tauxReponse}%` : "—"}
            icon={MessageSquare}
            hint={`${reponduTotal} / ${contactesTotal} contactés`}
          />
          <KpiCard
            label="Contactés (total)"
            value={contactesTotal}
            icon={BellRing}
            hint="Prospects entrés dans le pipeline"
          />
        </div>
      </section>

      {global.total === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <BarChart3 className="size-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              Pas encore de devis à analyser. Crée des devis dans le pipeline.
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {kpis.map((k) => (
              <KpiCard key={k.label} label={k.label} value={k.value} hint={k.hint} />
            ))}
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Par source d&apos;acquisition</CardTitle>
              <CardDescription>
                Quel canal transforme le mieux ses devis en clients.
              </CardDescription>
            </CardHeader>
            <CardContent className="px-0">{renderTable(sourceRows, "Source")}</CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Par niche / secteur</CardTitle>
              <CardDescription>
                Quels secteurs signent — et à quel ticket moyen.
              </CardDescription>
            </CardHeader>
            <CardContent className="px-0">{renderTable(nicheRows, "Niche")}</CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Par formule</CardTitle>
              <CardDescription>
                Ce qui se signe à quel palier — pour caler la montée des prix.
              </CardDescription>
            </CardHeader>
            <CardContent className="px-0">{renderTable(formuleRows, "Formule")}</CardContent>
          </Card>

          {motifRows.length > 0 ? (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Motifs de perte</CardTitle>
                <CardDescription>
                  Pourquoi les devis tombent — pour corriger l&apos;offre ou le ciblage.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="divide-y">
                  {motifRows.map(([motif, n]) => (
                    <li
                      key={motif}
                      className="flex items-center justify-between gap-3 py-2 text-sm"
                    >
                      <span className="min-w-0 truncate">{motif}</span>
                      <span className="shrink-0 font-mono tabular-nums text-muted-foreground">
                        ×{n}
                      </span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          ) : null}
        </>
      )}
    </div>
  );
}
