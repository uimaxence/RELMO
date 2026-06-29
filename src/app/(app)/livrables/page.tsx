import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { prisma } from "@/lib/db";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { GenerateLivrablesButton } from "@/components/livrables/generate-livrables-button";
import { AddLivrableDialog } from "@/components/livrables/add-livrable-dialog";
import { DeleteLivrableButton } from "@/components/livrables/delete-livrable-button";
import { LivrableStatutControl } from "@/components/livrables/livrable-statut-control";
import {
  currentPeriode,
  isPeriode,
  periodeLabel,
  shiftPeriode,
} from "@/lib/periode";

export const dynamic = "force-dynamic";

type LivrableRow = {
  id: string;
  libelle: string;
  statut: string;
};

type EngagementGroup = {
  id: string;
  libelle: string;
  livrables: LivrableRow[];
};

type SiteGroup = {
  siteId: string;
  siteNom: string;
  clientNom: string;
  engagements: Map<string, EngagementGroup>;
};

export default async function LivrablesPage({
  searchParams,
}: {
  searchParams: Promise<{ periode?: string }>;
}) {
  const sp = await searchParams;
  const periode = sp.periode && isPeriode(sp.periode) ? sp.periode : currentPeriode();

  const livrables = await prisma.livrable.findMany({
    where: { periode },
    orderBy: { libelle: "asc" },
    include: {
      engagement: {
        include: {
          contrat: { include: { site: { include: { client: true } } } },
        },
      },
    },
  });

  // Regroupement site -> engagement -> livrables.
  const sites = new Map<string, SiteGroup>();
  for (const l of livrables) {
    const site = l.engagement.contrat.site;
    let sg = sites.get(site.id);
    if (!sg) {
      sg = {
        siteId: site.id,
        siteNom: site.nom,
        clientNom: site.client.nom,
        engagements: new Map(),
      };
      sites.set(site.id, sg);
    }
    let eg = sg.engagements.get(l.engagement.id);
    if (!eg) {
      eg = { id: l.engagement.id, libelle: l.engagement.libelle, livrables: [] };
      sg.engagements.set(l.engagement.id, eg);
    }
    eg.livrables.push({ id: l.id, libelle: l.libelle, statut: l.statut });
  }

  const total = livrables.length;
  const faits = livrables.filter((l) => l.statut === "fait").length;
  const restants = livrables.filter((l) => l.statut === "a_faire").length;
  const pct = total > 0 ? Math.round((faits / total) * 100) : 0;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Livrables du mois"
        description="Ce qui est vendu, instancié par mois. Coche ce qui est livré."
      >
        <GenerateLivrablesButton periode={periode} />
      </PageHeader>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Button asChild variant="outline" size="icon" aria-label="Mois précédent">
            <Link href={`/livrables?periode=${shiftPeriode(periode, -1)}`}>
              <ChevronLeft />
            </Link>
          </Button>
          <span className="min-w-[160px] text-center font-medium capitalize">
            {periodeLabel(periode)}
          </span>
          <Button asChild variant="outline" size="icon" aria-label="Mois suivant">
            <Link href={`/livrables?periode=${shiftPeriode(periode, 1)}`}>
              <ChevronRight />
            </Link>
          </Button>
        </div>
        {total > 0 ? (
          <div className="flex items-center gap-3 text-sm">
            <span className="text-muted-foreground">
              {faits}/{total} fait{faits > 1 ? "s" : ""} · {restants} restant
              {restants > 1 ? "s" : ""}
            </span>
            <div className="h-2 w-32 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-emerald-500 transition-all"
                style={{ width: `${pct}%` }}
              />
            </div>
            <span className="w-9 text-right font-medium">{pct}%</span>
          </div>
        ) : null}
      </div>

      {sites.size === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-4 py-12 text-center">
            <p className="text-sm text-muted-foreground">
              Aucun livrable pour {periodeLabel(periode)}.
            </p>
            <GenerateLivrablesButton
              periode={periode}
              label={`Générer les livrables de ${periodeLabel(periode)}`}
            />
            <p className="max-w-md text-xs text-muted-foreground">
              La génération crée une checklist à partir des engagements des contrats
              actifs sur cette période (quantité/mois).
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {[...sites.values()].map((sg) => (
            <Card key={sg.siteId}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Link href={`/sites/${sg.siteId}`} className="hover:underline">
                    {sg.siteNom}
                  </Link>
                  <span className="text-sm font-normal text-muted-foreground">
                    {sg.clientNom}
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {[...sg.engagements.values()].map((eg) => {
                  const egFaits = eg.livrables.filter(
                    (l) => l.statut === "fait",
                  ).length;
                  return (
                    <div key={eg.id}>
                      <div className="mb-1.5 flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium">{eg.libelle}</span>
                          <Badge variant="secondary">
                            {egFaits}/{eg.livrables.length}
                          </Badge>
                        </div>
                        <AddLivrableDialog
                          engagementId={eg.id}
                          periode={periode}
                          defaultLibelle={eg.libelle}
                        />
                      </div>
                      <ul className="divide-y rounded-md border">
                        {eg.livrables.map((l) => (
                          <li
                            key={l.id}
                            className="flex items-center justify-between gap-2 px-3 py-2"
                          >
                            <span className="min-w-0 truncate text-sm">
                              {l.libelle}
                            </span>
                            <div className="flex shrink-0 items-center gap-1">
                              <LivrableStatutControl id={l.id} statut={l.statut} />
                              <DeleteLivrableButton id={l.id} />
                            </div>
                          </li>
                        ))}
                      </ul>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
