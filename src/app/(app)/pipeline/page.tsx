import Link from "next/link";
import { Pencil, Sparkles, Flame, ChevronRight } from "lucide-react";

import { prisma } from "@/lib/db";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DevisFormDialog } from "@/components/forms/devis-form-dialog";
import { InteractionFormDialog } from "@/components/forms/interaction-form-dialog";
import { GrilleTarifaire } from "@/components/pipeline/grille-tarifaire";
import { ConfirmDelete } from "@/components/forms/confirm-delete";
import { ConvertDevisButton } from "@/components/convert-devis-button";
import { AiGenerateDialog } from "@/components/ai/ai-generate-dialog";
import { actionRelanceNego, actionMessageProspection } from "@/app/actions/ai";
import { DevisStatusBadge } from "@/components/status-badge";
import { deleteDevis } from "@/app/actions/devis";
import { ensureReglage } from "@/lib/wishlist";
import { euros, dateFr } from "@/lib/format";
import { DEVIS_STATUTS, labelOf, FORMULES, SOURCES } from "@/lib/constants";

// Ancienneté du dernier contact d'un client à approcher (null = jamais).
function froideur(d: Date | null, now: Date): { label: string; cold: boolean } {
  if (!d) return { label: "Jamais contacté", cold: true };
  const jours = Math.floor((now.getTime() - new Date(d).getTime()) / 86_400_000);
  if (jours === 0) return { label: "Aujourd'hui", cold: false };
  if (jours === 1) return { label: "Hier", cold: false };
  return { label: `Il y a ${jours} j`, cold: jours >= 14 };
}

export const dynamic = "force-dynamic";

export default async function PipelinePage() {
  const now = new Date();
  const [devisList, clients, sites, reglage, aApprocher] = await Promise.all([
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
    ensureReglage(),
    // Clients au statut « prospect » (deals chauds à approcher, en amont du devis).
    // Ancienne section « Prospects à activer » du dashboard prospection.
    prisma.client.findMany({
      where: { statut: "prospect" },
      include: {
        interactions: { orderBy: { date: "desc" }, take: 1 },
        devis: { select: { statut: true } },
      },
    }),
  ]);

  // Tri des clients à approcher : les plus froids d'abord.
  const approcher = aApprocher
    .map((p) => {
      const last = p.interactions[0]?.date ?? null;
      const f = froideur(last, now);
      return { ...p, f, ageTri: last ? now.getTime() - last.getTime() : Number.MAX_SAFE_INTEGER };
    })
    .sort((a, b) => b.ageTri - a.ageTri);

  const siteOpts = sites.map((s) => ({
    id: s.id,
    nom: s.nom,
    clientNom: s.client.nom,
  }));

  const paliers = {
    palierEssentiel: reglage.palierEssentiel,
    palierPro: reglage.palierPro,
    tarifSuivi: reglage.tarifSuivi,
  };

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
        <DevisFormDialog clients={clients} sites={siteOpts} paliers={paliers} />
      </PageHeader>

      <GrilleTarifaire {...paliers} />

      {/* Clients à approcher (statut « prospect ») : le haut du pipeline, avant devis. */}
      {approcher.length > 0 ? (
        <section className="space-y-3">
          <h2 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Clients à approcher · {approcher.length}
          </h2>
          <div className="grid gap-3 md:grid-cols-2">
            {approcher.map((p) => {
              const enNego = p.devis.some((d) => ["envoye", "en_nego"].includes(d.statut));
              return (
                <Card key={p.id}>
                  <CardHeader className="flex flex-row items-start justify-between space-y-0">
                    <CardTitle className="text-base">
                      <Link href={`/clients/${p.id}`} className="inline-flex items-center gap-1 hover:underline">
                        {p.nom}
                        <ChevronRight className="size-4 text-muted-foreground" />
                      </Link>
                    </CardTitle>
                    <span className="inline-flex items-center gap-1.5 text-xs">
                      {p.f.cold ? <Flame className="size-3.5 text-amber-600" /> : null}
                      <span className={p.f.cold ? "font-medium text-amber-600" : "text-muted-foreground"}>
                        {p.f.label}
                      </span>
                    </span>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                      {enNego ? <Badge variant="secondary">Devis en cours</Badge> : null}
                      {p.secteur ? (
                        <Badge variant="secondary" className="font-normal">
                          {p.secteur}
                        </Badge>
                      ) : null}
                      {p.source ? <span>Source : {labelOf(SOURCES, p.source)}</span> : null}
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
                        paliers={paliers}
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
        </section>
      ) : null}

      {devisList.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-4 py-12 text-center">
            <p className="text-sm text-muted-foreground">
              Aucun devis pour l&apos;instant.
            </p>
            <DevisFormDialog clients={clients} sites={siteOpts} paliers={paliers} />
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
                        <div className="flex shrink-0 flex-col items-end gap-1">
                          <DevisStatusBadge statut={d.statut} />
                          {d.formule ? (
                            <span className="text-[11px] font-medium uppercase tracking-wide text-accent-brand">
                              {labelOf(FORMULES, d.formule)}
                            </span>
                          ) : null}
                        </div>
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
                            paliers={paliers}
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
