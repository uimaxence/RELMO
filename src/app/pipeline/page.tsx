import Link from "next/link";
import { Pencil, Sparkles } from "lucide-react";

import { prisma } from "@/lib/db";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { DevisFormDialog } from "@/components/forms/devis-form-dialog";
import { ConfirmDelete } from "@/components/forms/confirm-delete";
import { ConvertDevisButton } from "@/components/convert-devis-button";
import { AiGenerateDialog } from "@/components/ai/ai-generate-dialog";
import { actionRelanceNego } from "@/app/actions/ai";
import { DevisStatusBadge } from "@/components/status-badge";
import { deleteDevis } from "@/app/actions/devis";
import { euros, dateFr } from "@/lib/format";
import { DEVIS_STATUTS } from "@/lib/constants";

export const dynamic = "force-dynamic";

export default async function PipelinePage() {
  const [devisList, clients, sites] = await Promise.all([
    prisma.devis.findMany({
      orderBy: { updatedAt: "desc" },
      include: {
        client: { select: { nom: true } },
        site: { select: { id: true, nom: true } },
        contrat: { select: { id: true } },
      },
    }),
    prisma.client.findMany({
      orderBy: { nom: "asc" },
      select: { id: true, nom: true },
    }),
    prisma.site.findMany({
      orderBy: { nom: "asc" },
      select: { id: true, nom: true, client: { select: { nom: true } } },
    }),
  ]);

  const siteOpts = sites.map((s) => ({
    id: s.id,
    nom: s.nom,
    clientNom: s.client.nom,
  }));

  const potentielNego = devisList
    .filter((d) => d.statut === "en_nego")
    .reduce((s, d) => s + d.montantMensuelPropose, 0);
  const ouverts = devisList.filter((d) =>
    ["brouillon", "envoye", "en_nego"].includes(d.statut),
  ).length;

  // Regroupe par statut, dans l'ordre du pipeline.
  const groups = DEVIS_STATUTS.map((s) => ({
    ...s,
    devis: devisList.filter((d) => d.statut === s.value),
  })).filter((g) => g.devis.length > 0);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Pipeline & devis"
        description="Les négos et propositions, de l'idée au contrat signé."
      >
        <DevisFormDialog clients={clients} sites={siteOpts} />
      </PageHeader>

      {devisList.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-4 py-12 text-center">
            <p className="text-sm text-muted-foreground">
              Aucun devis pour l&apos;instant.
            </p>
            <DevisFormDialog clients={clients} sites={siteOpts} />
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="flex flex-wrap gap-x-8 gap-y-1 text-sm">
            <span className="text-muted-foreground">
              Devis ouverts{" "}
              <span className="font-mono font-medium text-foreground tabular-nums">
                {ouverts}
              </span>
            </span>
            <span className="text-muted-foreground">
              MRR potentiel (en négo){" "}
              <span className="font-mono font-medium text-brand tabular-nums">
                {euros(potentielNego)}/mois
              </span>
            </span>
          </div>

          {groups.map((g) => (
            <section key={g.value} className="space-y-2">
              <h2 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                {g.label} · {g.devis.length}
              </h2>
              <div className="grid gap-3 md:grid-cols-2">
                {g.devis.map((d) => (
                  <Card key={d.id}>
                    <CardContent className="space-y-2 pt-5">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="font-medium">{d.libelle}</p>
                          <p className="text-sm text-muted-foreground">
                            {d.client.nom}
                            {d.site ? (
                              <>
                                {" · "}
                                <Link
                                  href={`/sites/${d.site.id}`}
                                  className="hover:underline"
                                >
                                  {d.site.nom}
                                </Link>
                              </>
                            ) : null}
                          </p>
                        </div>
                        <DevisStatusBadge statut={d.statut} />
                      </div>

                      <p className="font-mono text-sm tabular-nums">
                        <span className="font-medium">
                          {euros(d.montantMensuelPropose)}/mois
                        </span>
                        {d.montantCreation > 0 ? (
                          <span className="text-muted-foreground">
                            {" "}
                            · {euros(d.montantCreation)} création
                          </span>
                        ) : null}
                      </p>

                      {d.dateRelance ? (
                        <p className="text-xs text-muted-foreground">
                          Relance le {dateFr(d.dateRelance)}
                        </p>
                      ) : null}

                      <div className="flex flex-wrap items-center gap-1 pt-1">
                        {d.contrat ? (
                          <span className="text-xs text-positive-ink">
                            ✓ Converti en contrat
                          </span>
                        ) : ["en_nego", "accepte"].includes(d.statut) ? (
                          <ConvertDevisButton id={d.id} />
                        ) : null}
                        <div className="ml-auto flex gap-1">
                          {["envoye", "en_nego"].includes(d.statut) ? (
                            <AiGenerateDialog
                              action={actionRelanceNego.bind(null, d.id)}
                              title="Relance de négo"
                              description={`Message pour faire avancer la négo avec ${d.client.nom}, sans casser le prix.`}
                              providerLabel="DeepSeek"
                              trigger={
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  aria-label="Relance IA"
                                >
                                  <Sparkles className="text-brand" />
                                </Button>
                              }
                            />
                          ) : null}
                          <DevisFormDialog
                            clients={clients}
                            sites={siteOpts}
                            devis={d}
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
                            action={deleteDevis.bind(null, d.id)}
                            description={`Supprimer le devis « ${d.libelle} » ?`}
                          />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </section>
          ))}
        </>
      )}
    </div>
  );
}
