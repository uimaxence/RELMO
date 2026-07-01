import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ChevronRight,
  Pencil,
  Plus,
  Globe,
  Mail,
  Phone,
  X,
  Sparkles,
  FileText,
  CheckCircle2,
  Circle,
} from "lucide-react";

import { prisma } from "@/lib/db";
import { PageHeader } from "@/components/page-header";
import { ClientFormDialog } from "@/components/forms/client-form-dialog";
import { SiteFormDialog } from "@/components/forms/site-form-dialog";
import { ContratFormDialog } from "@/components/forms/contrat-form-dialog";
import { InteractionFormDialog } from "@/components/forms/interaction-form-dialog";
import { ConfirmDelete } from "@/components/forms/confirm-delete";
import { AiGenerateDialog } from "@/components/ai/ai-generate-dialog";
import { PortailControl } from "@/components/portail/portail-control";
import { FactureFormDialog } from "@/components/forms/facture-form-dialog";
import { deleteFacture } from "@/app/actions/factures";
import { Badge } from "@/components/ui/badge";
import {
  actionMessageProspection,
  actionDevisBrouillon,
} from "@/app/actions/ai";
import { deleteClient } from "@/app/actions/clients";
import { deleteSite } from "@/app/actions/sites";
import { deleteInteraction } from "@/app/actions/interactions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  SiteStatusBadge,
  ClientStatusBadge,
  DevisStatusBadge,
  ContratStatusBadge,
} from "@/components/status-badge";
import { deleteContrat } from "@/app/actions/contrats";
import { euros, dateFr } from "@/lib/format";
import { labelOf, CANAUX, SOURCES, TACHE_TYPES, FACTURE_STATUTS } from "@/lib/constants";
import { currentPeriode } from "@/lib/periode";

export const dynamic = "force-dynamic";

export default async function ClientDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const now = new Date();

  const client = await prisma.client.findUnique({
    where: { id },
    include: {
      sites: {
        orderBy: { nom: "asc" },
        include: { contrats: true },
      },
      devis: { orderBy: { updatedAt: "desc" } },
      factures: { orderBy: { dateEmission: "desc" } },
      interactions: { orderBy: { date: "desc" } },
      _count: { select: { photos: true } },
    },
  });

  if (!client) notFound();

  // Tâches taguées sur ce client (reverse-link de l'@mention de la to-do).
  const taches = await prisma.tache.findMany({
    where: { refType: "client", refId: id },
    orderBy: [{ statut: "asc" }, { createdAt: "desc" }],
  });

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/clients"
          className="mb-2 inline-block text-sm text-muted-foreground hover:underline"
        >
          ← Clients
        </Link>
        <PageHeader title={client.nom}>
          <ClientStatusBadge statut={client.statut} />
          <AiGenerateDialog
            action={actionMessageProspection.bind(null, client.id)}
            title="Message de prospection"
            description="Accroche personnalisée pour décrocher un échange. Relis et édite avant d'envoyer."
            providerLabel="Perplexity"
            trigger={
              <Button variant="outline">
                <Sparkles className="text-brand" /> Prospection
              </Button>
            }
          />
          <AiGenerateDialog
            action={actionDevisBrouillon.bind(null, client.id)}
            title="Brouillon de devis"
            description="Proposition commerciale indicative (montants à ajuster). Privilégie un palier, pas du 60 €."
            providerLabel="DeepSeek"
            trigger={
              <Button variant="outline">
                <Sparkles className="text-brand" /> Devis
              </Button>
            }
          />
          <InteractionFormDialog clientId={client.id} />
          <Button asChild variant="outline">
            <Link href={`/clients/${client.id}/rapport?periode=${currentPeriode()}`}>
              <FileText /> Rapport
            </Link>
          </Button>
          <ClientFormDialog
            client={client}
            trigger={
              <Button variant="outline">
                <Pencil /> Modifier
              </Button>
            }
          />
          <ConfirmDelete
            action={deleteClient.bind(null, client.id)}
            description={`Supprimer « ${client.nom} » et tout son contenu ? Irréversible.`}
            trigger={<Button variant="outline">Supprimer</Button>}
          />
        </PageHeader>

        <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm text-muted-foreground">
          {client.email ? (
            <span className="inline-flex items-center gap-1.5">
              <Mail className="size-4" /> {client.email}
            </span>
          ) : null}
          {client.telephone ? (
            <span className="inline-flex items-center gap-1.5">
              <Phone className="size-4" /> {client.telephone}
            </span>
          ) : null}
          {client.source ? (
            <span>
              Source :{" "}
              <span className="font-medium text-foreground">
                {labelOf(SOURCES, client.source)}
              </span>
              {client.sourceDetail ? ` · ${client.sourceDetail}` : ""}
            </span>
          ) : null}
          {client.secteur ? (
            <span>
              Secteur :{" "}
              <span className="font-medium text-foreground">
                {client.secteur}
              </span>
            </span>
          ) : null}
        </div>
        {client.notes ? (
          <p className="mt-3 whitespace-pre-wrap text-sm">{client.notes}</p>
        ) : null}
      </div>

      <PortailControl
        clientId={client.id}
        actif={client.portailActif}
        token={client.portailToken}
        nbPhotos={client._count.photos}
      />

      <div>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Sites ({client.sites.length})</h2>
          <SiteFormDialog clientId={client.id} />
        </div>

        {client.sites.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center gap-4 py-10 text-center">
              <p className="text-sm text-muted-foreground">
                Aucun site pour ce client.
              </p>
              <SiteFormDialog clientId={client.id} />
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {client.sites.map((site) => {
              const mrr = site.contrats
                .filter((ct) => ct.statut === "actif" && ct.dateDebut <= now && ct.facturationDemarree)
                .reduce((s, ct) => s + ct.montantMensuel, 0);
              return (
                <Card key={site.id}>
                  <CardHeader className="flex flex-row items-start justify-between space-y-0">
                    <div className="space-y-1">
                      <CardTitle className="flex items-center gap-2">
                        <Link
                          href={`/sites/${site.id}`}
                          className="inline-flex items-center gap-1 hover:underline"
                        >
                          {site.nom}
                          <ChevronRight className="size-4 text-muted-foreground" />
                        </Link>
                      </CardTitle>
                      {site.url ? (
                        <a
                          href={site.url}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:underline"
                        >
                          <Globe className="size-3" /> {site.url}
                        </a>
                      ) : null}
                    </div>
                    <SiteStatusBadge statut={site.statut} />
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="text-sm">
                        <span className="font-medium">{euros(mrr)}/mois</span>
                        <span className="text-muted-foreground">
                          {" "}
                          · {site.contrats.length} contrat
                          {site.contrats.length > 1 ? "s" : ""}
                        </span>
                      </div>
                      <div className="flex gap-1">
                        <SiteFormDialog
                          clientId={client.id}
                          site={site}
                          trigger={
                            <Button variant="ghost" size="icon" aria-label="Modifier le site">
                              <Pencil />
                            </Button>
                          }
                        />
                        <ConfirmDelete
                          action={deleteSite.bind(null, site.id, client.id)}
                          description={`Supprimer le site « ${site.nom} » et ses contrats ?`}
                        />
                      </div>
                    </div>

                    {site.contrats.length === 0 ? (
                      <div className="flex items-center justify-between gap-2 rounded-md border border-dashed px-3 py-2">
                        <span className="text-sm text-muted-foreground">
                          Aucun contrat — MRR à définir
                        </span>
                        <ContratFormDialog
                          siteId={site.id}
                          trigger={
                            <Button size="sm">
                              <Plus /> Contrat
                            </Button>
                          }
                        />
                      </div>
                    ) : (
                      <ul className="divide-y rounded-md border">
                        {site.contrats.map((ct) => (
                          <li
                            key={ct.id}
                            className="flex items-center justify-between gap-2 px-3 py-2"
                          >
                            <div className="min-w-0">
                              <p className="truncate text-sm">{ct.libelle}</p>
                              <p className="font-mono text-xs tabular-nums text-muted-foreground">
                                {euros(ct.montantMensuel)}/mois
                                {!ct.facturationDemarree
                                  ? " · en attente de facturation"
                                  : ""}
                              </p>
                            </div>
                            <div className="flex shrink-0 items-center gap-1">
                              <ContratStatusBadge statut={ct.statut} />
                              <ContratFormDialog
                                siteId={site.id}
                                contrat={ct}
                                trigger={
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    aria-label="Modifier le contrat"
                                  >
                                    <Pencil />
                                  </Button>
                                }
                              />
                              <ConfirmDelete
                                action={deleteContrat.bind(null, ct.id, site.id)}
                                description={`Supprimer le contrat « ${ct.libelle} » et ses engagements ?`}
                              />
                            </div>
                          </li>
                        ))}
                        <li className="px-3 py-1.5">
                          <ContratFormDialog
                            siteId={site.id}
                            trigger={
                              <Button variant="ghost" size="sm">
                                <Plus /> Ajouter un contrat
                              </Button>
                            }
                          />
                        </li>
                      </ul>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {client.devis.length > 0 ? (
        <div>
          <h2 className="mb-3 text-lg font-semibold">
            Devis ({client.devis.length})
          </h2>
          <Card>
            <ul className="divide-y">
              {client.devis.map((d) => (
                <li
                  key={d.id}
                  className="flex items-center justify-between gap-3 px-4 py-3"
                >
                  <div className="min-w-0">
                    <Link
                      href="/pipeline"
                      className="text-sm font-medium hover:underline"
                    >
                      {d.libelle}
                    </Link>
                    <p className="font-mono text-xs tabular-nums text-muted-foreground">
                      {euros(d.montantMensuelPropose)}/mois
                      {d.montantCreation > 0
                        ? ` · ${euros(d.montantCreation)} création`
                        : ""}
                      {d.dateRelance
                        ? ` · relance ${dateFr(d.dateRelance)}`
                        : ""}
                    </p>
                  </div>
                  <DevisStatusBadge statut={d.statut} />
                </li>
              ))}
            </ul>
          </Card>
        </div>
      ) : null}

      <div>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold">
            Factures ({client.factures.length})
          </h2>
          <FactureFormDialog
            clientId={client.id}
            sites={client.sites.map((s) => ({ id: s.id, nom: s.nom }))}
          />
        </div>
        {client.factures.length === 0 ? (
          <Card>
            <CardContent className="py-6 text-center text-sm text-muted-foreground">
              Aucune facture. Visibles par le client dans son portail.
            </CardContent>
          </Card>
        ) : (
          <Card>
            <ul className="divide-y">
              {client.factures.map((f) => (
                <li
                  key={f.id}
                  className="flex items-center justify-between gap-3 px-4 py-3"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium">
                      {f.numero}{" "}
                      <span className="font-normal text-muted-foreground">
                        · {f.periode}
                      </span>
                    </p>
                    <p className="font-mono text-xs tabular-nums text-muted-foreground">
                      {euros(f.montant)}
                      {f.dateEcheance ? ` · échéance ${dateFr(f.dateEcheance)}` : ""}
                      {f.pdfUrl ? (
                        <>
                          {" · "}
                          <a
                            href={f.pdfUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="text-brand hover:underline"
                          >
                            PDF
                          </a>
                        </>
                      ) : ""}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <Badge
                      variant={f.statut === "payee" ? "secondary" : "outline"}
                      className={f.statut === "en_retard" ? "text-negative" : ""}
                    >
                      {labelOf(FACTURE_STATUTS, f.statut)}
                    </Badge>
                    <FactureFormDialog
                      clientId={client.id}
                      sites={client.sites.map((s) => ({ id: s.id, nom: s.nom }))}
                      facture={f}
                      trigger={
                        <Button variant="ghost" size="icon" aria-label="Modifier">
                          <Pencil />
                        </Button>
                      }
                    />
                    <ConfirmDelete
                      action={deleteFacture.bind(null, f.id, client.id)}
                      description={`Supprimer la facture ${f.numero} ?`}
                    />
                  </div>
                </li>
              ))}
            </ul>
          </Card>
        )}
      </div>

      {taches.length > 0 ? (
        <div>
          <h2 className="mb-3 text-lg font-semibold">
            Tâches taguées ({taches.length})
          </h2>
          <Card>
            <ul className="divide-y">
              {taches.map((t) => (
                <li
                  key={t.id}
                  className="flex items-center justify-between gap-3 px-4 py-2.5"
                >
                  <span className="inline-flex min-w-0 items-center gap-2 text-sm">
                    {t.statut === "fait" ? (
                      <CheckCircle2 className="size-4 shrink-0 text-positive" />
                    ) : (
                      <Circle className="size-4 shrink-0 text-muted-foreground" />
                    )}
                    <span
                      className={
                        t.statut === "fait"
                          ? "truncate text-muted-foreground line-through"
                          : "truncate"
                      }
                    >
                      {t.libelle}
                    </span>
                  </span>
                  <Link
                    href={t.semaine ? `/semaine?s=${t.semaine}` : "/semaine"}
                    className="shrink-0 text-xs text-muted-foreground hover:underline"
                  >
                    {labelOf(TACHE_TYPES, t.type)} ›
                  </Link>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      ) : null}

      <div>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold">
            Échanges ({client.interactions.length})
          </h2>
          <InteractionFormDialog clientId={client.id} />
        </div>
        {client.interactions.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-sm text-muted-foreground">
              Aucun échange journalisé. Note tes négos (WhatsApp, mail, tél) ici.
            </CardContent>
          </Card>
        ) : (
          <Card>
            <ul className="divide-y">
              {client.interactions.map((it) => (
                <li
                  key={it.id}
                  className="flex items-start justify-between gap-3 px-4 py-3"
                >
                  <div className="min-w-0 space-y-0.5">
                    <p className="text-sm">{it.resume}</p>
                    <p className="text-xs text-muted-foreground">
                      {dateFr(it.date)} · {labelOf(CANAUX, it.canal)} ·{" "}
                      {it.direction === "entrant" ? "reçu" : "envoyé"}
                    </p>
                    {it.contenu ? (
                      <p className="whitespace-pre-wrap pt-1 text-sm text-muted-foreground">
                        {it.contenu}
                      </p>
                    ) : null}
                  </div>
                  <ConfirmDelete
                    action={deleteInteraction.bind(null, it.id, client.id)}
                    description="Supprimer cet échange ?"
                    trigger={
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label="Supprimer l'échange"
                      >
                        <X className="text-muted-foreground" />
                      </Button>
                    }
                  />
                </li>
              ))}
            </ul>
          </Card>
        )}
      </div>
    </div>
  );
}
