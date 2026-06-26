import Link from "next/link";
import { notFound } from "next/navigation";
import { Pencil } from "lucide-react";

import { prisma } from "@/lib/db";
import { PageHeader } from "@/components/page-header";
import { SiteFormDialog } from "@/components/forms/site-form-dialog";
import { ContratFormDialog } from "@/components/forms/contrat-form-dialog";
import { EngagementFormDialog } from "@/components/forms/engagement-form-dialog";
import { ConfirmDelete } from "@/components/forms/confirm-delete";
import { deleteSite } from "@/app/actions/sites";
import { deleteContrat } from "@/app/actions/contrats";
import { deleteEngagement } from "@/app/actions/engagements";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { euros, dateFr } from "@/lib/format";
import {
  labelOf,
  SITE_STATUTS,
  CONTRAT_STATUTS,
  RECURRENCES,
} from "@/lib/constants";

export const dynamic = "force-dynamic";

export default async function SiteDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const site = await prisma.site.findUnique({
    where: { id },
    include: {
      client: true,
      contrats: {
        orderBy: { dateDebut: "desc" },
        include: { engagements: { orderBy: { libelle: "asc" } } },
      },
    },
  });

  if (!site) notFound();

  const meta = [
    site.stack ? { label: "Stack", value: site.stack } : null,
    site.hebergeur ? { label: "Hébergeur", value: site.hebergeur } : null,
    site.dateMiseEnLigne
      ? { label: "En ligne depuis", value: dateFr(site.dateMiseEnLigne) }
      : null,
  ].filter(Boolean) as { label: string; value: string }[];

  return (
    <div className="space-y-6">
      <div>
        <Link
          href={`/clients/${site.clientId}`}
          className="mb-2 inline-block text-sm text-muted-foreground hover:underline"
        >
          ← {site.client.nom}
        </Link>
        <PageHeader title={site.nom}>
          <Badge
            variant={site.statut === "actif" ? "default" : "secondary"}
            className="mr-1"
          >
            {labelOf(SITE_STATUTS, site.statut)}
          </Badge>
          <SiteFormDialog
            clientId={site.clientId}
            site={site}
            trigger={
              <Button variant="outline">
                <Pencil /> Modifier
              </Button>
            }
          />
          <ConfirmDelete
            action={deleteSite.bind(null, site.id, site.clientId)}
            description={`Supprimer le site « ${site.nom} » et ses contrats ?`}
            trigger={<Button variant="outline">Supprimer</Button>}
          />
        </PageHeader>

        <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm text-muted-foreground">
          {site.url ? (
            <a
              href={site.url}
              target="_blank"
              rel="noreferrer"
              className="hover:underline"
            >
              {site.url}
            </a>
          ) : null}
          {site.repoGitUrl ? (
            <a
              href={site.repoGitUrl}
              target="_blank"
              rel="noreferrer"
              className="hover:underline"
            >
              Repo Git
            </a>
          ) : null}
          {meta.map((m) => (
            <span key={m.label}>
              <span className="font-medium text-foreground">{m.value}</span>{" "}
              {m.label.toLowerCase()}
            </span>
          ))}
        </div>
        {site.notes ? (
          <p className="mt-3 whitespace-pre-wrap text-sm">{site.notes}</p>
        ) : null}
      </div>

      <div>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold">
            Contrats ({site.contrats.length})
          </h2>
          <ContratFormDialog siteId={site.id} />
        </div>

        {site.contrats.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center gap-4 py-10 text-center">
              <p className="text-sm text-muted-foreground">
                Aucun contrat sur ce site.
              </p>
              <ContratFormDialog siteId={site.id} />
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {site.contrats.map((contrat) => (
              <Card key={contrat.id}>
                <CardHeader>
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="space-y-1">
                      <CardTitle className="flex items-center gap-2">
                        {contrat.libelle}
                        <Badge
                          variant={
                            contrat.statut === "actif" ? "default" : "secondary"
                          }
                        >
                          {labelOf(CONTRAT_STATUTS, contrat.statut)}
                        </Badge>
                      </CardTitle>
                      <p className="text-sm text-muted-foreground">
                        <span className="font-semibold text-foreground">
                          {euros(contrat.montantMensuel)}/mois
                        </span>{" "}
                        · depuis le {dateFr(contrat.dateDebut)}
                        {contrat.dateFin
                          ? ` · jusqu'au ${dateFr(contrat.dateFin)}`
                          : ""}
                      </p>
                    </div>
                    <div className="flex gap-1">
                      <ContratFormDialog
                        siteId={site.id}
                        contrat={contrat}
                        trigger={
                          <Button variant="ghost" size="icon" aria-label="Modifier">
                            <Pencil />
                          </Button>
                        }
                      />
                      <ConfirmDelete
                        action={deleteContrat.bind(null, contrat.id, site.id)}
                        description={`Supprimer le contrat « ${contrat.libelle} » et ses engagements ?`}
                      />
                    </div>
                  </div>
                  {contrat.note ? (
                    <p className="rounded-md bg-muted px-3 py-2 text-sm text-muted-foreground">
                      {contrat.note}
                    </p>
                  ) : null}
                </CardHeader>
                <CardContent>
                  <Separator className="mb-3" />
                  <div className="mb-2 flex items-center justify-between">
                    <h3 className="text-sm font-medium">
                      Engagements ({contrat.engagements.length})
                    </h3>
                    <EngagementFormDialog
                      contratId={contrat.id}
                      siteId={site.id}
                    />
                  </div>
                  {contrat.engagements.length === 0 ? (
                    <p className="py-2 text-sm text-muted-foreground">
                      Aucun engagement récurrent. Ajoute ce qui est vendu chaque
                      mois (articles, maj…).
                    </p>
                  ) : (
                    <ul className="divide-y">
                      {contrat.engagements.map((e) => (
                        <li
                          key={e.id}
                          className="flex items-center justify-between gap-2 py-2"
                        >
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium">
                              {e.libelle}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {e.quantiteParMois}/mois ·{" "}
                              {labelOf(RECURRENCES, e.recurrence)} ·{" "}
                              <code className="text-xs">{e.type}</code>
                            </p>
                          </div>
                          <div className="flex shrink-0 gap-1">
                            <EngagementFormDialog
                              contratId={contrat.id}
                              siteId={site.id}
                              engagement={e}
                              trigger={
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  aria-label="Modifier"
                                >
                                  <Pencil />
                                </Button>
                              }
                            />
                            <ConfirmDelete
                              action={deleteEngagement.bind(null, e.id, site.id)}
                              description={`Supprimer l'engagement « ${e.libelle} » ?`}
                            />
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
