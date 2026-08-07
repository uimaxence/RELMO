"use client";

import Link from "next/link";
import {
  ArrowUpRight,
  Globe,
  Mail,
  Pencil,
  Phone,
  Plus,
  TriangleAlert,
} from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ClientStatusBadge,
  ContratStatusBadge,
  DevisStatusBadge,
  SiteStatusBadge,
} from "@/components/status-badge";
import { ClientFormDialog } from "@/components/forms/client-form-dialog";
import { SiteFormDialog } from "@/components/forms/site-form-dialog";
import { ContratFormDialog } from "@/components/forms/contrat-form-dialog";
import { FactureFormDialog } from "@/components/forms/facture-form-dialog";
import { DevisFormDialog } from "@/components/forms/devis-form-dialog";
import { ConfirmDelete } from "@/components/forms/confirm-delete";
import { FacturationToggle } from "@/components/mrr/facturation-toggle";
import { deleteSite } from "@/app/actions/sites";
import { deleteContrat } from "@/app/actions/contrats";
import { deleteFacture } from "@/app/actions/factures";
import { deleteDevis } from "@/app/actions/devis";
import { euros, dateFr } from "@/lib/format";
import { labelOf, FACTURE_STATUTS, SOURCES } from "@/lib/constants";

// `demarre` est calculé côté serveur (dateDebut <= aujourd'hui) : le client ne
// recalcule pas de date, sinon rendu serveur et rendu navigateur divergent.
export type PanelContrat = {
  id: string;
  siteId: string;
  libelle: string;
  montantMensuel: number;
  dateDebut: Date | string;
  dateFin: Date | string | null;
  statut: string;
  facturationDemarree: boolean;
  note: string | null;
  motifResiliation: string | null;
  demarre: boolean;
};

export type PanelSite = {
  id: string;
  clientId: string;
  nom: string;
  url: string | null;
  repoGitUrl: string | null;
  hebergeur: string | null;
  stack: string | null;
  contact: string | null;
  statut: string;
  dateMiseEnLigne: Date | string | null;
  notes: string | null;
  contrats: PanelContrat[];
};

export type PanelFacture = {
  id: string;
  siteId: string | null;
  numero: string;
  periode: string;
  montant: number;
  statut: string;
  dateEmission: Date | string;
  dateEcheance: Date | string | null;
  pdfUrl: string | null;
  pathnamePdf: string | null;
};

export type PanelDevis = {
  id: string;
  clientId: string;
  siteId: string | null;
  libelle: string;
  montantCreation: number;
  montantMensuelPropose: number;
  formule: string | null;
  statut: string;
  dateEnvoi: Date | string | null;
  dateRelance: Date | string | null;
  note: string | null;
  motifPerte: string | null;
  pdfUrl: string | null;
};

export type PanelClient = {
  id: string;
  nom: string;
  email: string | null;
  telephone: string | null;
  statut: string;
  source: string | null;
  sourceDetail: string | null;
  secteur: string | null;
  notes: string | null;
  sites: PanelSite[];
  factures: PanelFacture[];
  devis: PanelDevis[];
  mrrFacture: number;
  mrrEnAttente: number;
  mrrAVenir: number;
};

function iconBtn(label: string) {
  return (
    <Button variant="ghost" size="icon" aria-label={label}>
      <Pencil />
    </Button>
  );
}

function Kpi({
  label,
  value,
  tone,
  hint,
}: {
  label: string;
  value: number;
  tone?: "warning" | "muted";
  hint: string;
}) {
  const color =
    tone === "warning"
      ? "text-warning-ink"
      : tone === "muted"
        ? "text-muted-foreground"
        : "text-foreground";
  return (
    <div className="rounded-lg border px-3 py-2">
      <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      <p className={`font-mono text-lg font-medium tabular-nums ${color}`}>
        {euros(value)}
      </p>
      <p className="text-xs text-muted-foreground">{hint}</p>
    </div>
  );
}

// Fiche client consolidée : coordonnées, sites, contrats, factures et devis au
// même endroit, tous éditables sans quitter la liste.
export function ClientPanel({
  client,
  open,
  onOpenChange,
}: {
  client: PanelClient | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  if (!client) return null;

  const sitesOpt = client.sites.map((s) => ({ id: s.id, nom: s.nom }));
  const contact = [
    client.secteur,
    client.source ? labelOf(SOURCES, client.source) : null,
  ].filter(Boolean);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] gap-4 overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex flex-wrap items-center gap-2 pr-8 text-lg">
            {client.nom}
            <ClientStatusBadge statut={client.statut} />
          </DialogTitle>
          <DialogDescription className="flex flex-wrap items-center gap-x-4 gap-y-1">
            {client.email ? (
              <span className="inline-flex items-center gap-1.5">
                <Mail className="size-3.5" /> {client.email}
              </span>
            ) : null}
            {client.telephone ? (
              <span className="inline-flex items-center gap-1.5">
                <Phone className="size-3.5" /> {client.telephone}
              </span>
            ) : null}
            {contact.length > 0 ? <span>{contact.join(" · ")}</span> : null}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-3 sm:grid-cols-3">
          <Kpi
            label="MRR facturé"
            value={client.mrrFacture}
            hint="Compté dans le MRR"
          />
          <Kpi
            label="En attente"
            value={client.mrrEnAttente}
            tone="warning"
            hint="Démarré, pas facturé"
          />
          <Kpi
            label="À venir"
            value={client.mrrAVenir}
            tone="muted"
            hint="Signé, pas démarré"
          />
        </div>

        {client.mrrEnAttente > 0 ? (
          <div className="flex items-start gap-2 rounded-lg bg-warning-bg px-3 py-2 text-sm text-warning-ink">
            <TriangleAlert className="mt-0.5 size-4 shrink-0" />
            <p>
              {euros(client.mrrEnAttente)}/mois sont exclus du MRR facturé : le
              contrat a démarré mais sa facturation n&apos;est pas marquée comme
              lancée. Corrige-le avec «&nbsp;Marquer facturé&nbsp;» dans
              l&apos;onglet Sites &amp; contrats.
            </p>
          </div>
        ) : null}

        <div className="flex flex-wrap items-center gap-2">
          <ClientFormDialog
            client={client}
            trigger={
              <Button variant="outline" size="sm">
                <Pencil /> Modifier la fiche
              </Button>
            }
          />
          <SiteFormDialog
            clientId={client.id}
            trigger={
              <Button variant="outline" size="sm">
                <Plus /> Site
              </Button>
            }
          />
          <Button asChild variant="ghost" size="sm" className="ml-auto">
            <Link href={`/clients/${client.id}`}>
              Fiche complète <ArrowUpRight />
            </Link>
          </Button>
        </div>

        <Tabs defaultValue="sites">
          <TabsList className="w-full">
            <TabsTrigger value="sites">
              Sites &amp; contrats ({client.sites.length})
            </TabsTrigger>
            <TabsTrigger value="factures">
              Factures ({client.factures.length})
            </TabsTrigger>
            <TabsTrigger value="devis">Devis ({client.devis.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="sites" className="pt-2">
            {client.sites.length === 0 ? (
              <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed py-8 text-center">
                <p className="text-sm text-muted-foreground">
                  Aucun site pour ce client.
                </p>
                <SiteFormDialog clientId={client.id} />
              </div>
            ) : (
              <div className="space-y-3">
                {client.sites.map((site) => {
                  const demarres = site.contrats.filter(
                    (ct) => ct.statut === "actif" && ct.demarre,
                  );
                  const facture = demarres
                    .filter((ct) => ct.facturationDemarree)
                    .reduce((s, ct) => s + ct.montantMensuel, 0);
                  const attente = demarres
                    .filter((ct) => !ct.facturationDemarree)
                    .reduce((s, ct) => s + ct.montantMensuel, 0);
                  return (
                    <div key={site.id} className="rounded-lg border">
                      <div className="flex flex-wrap items-start justify-between gap-2 border-b bg-muted/40 px-3 py-2">
                        <div className="min-w-0 space-y-0.5">
                          <div className="flex items-center gap-2">
                            <Link
                              href={`/sites/${site.id}`}
                              className="font-medium hover:underline"
                            >
                              {site.nom}
                            </Link>
                            <SiteStatusBadge statut={site.statut} />
                          </div>
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
                        <div className="flex shrink-0 items-center gap-1">
                          <span className="text-right">
                            <span className="block font-mono text-sm font-medium tabular-nums">
                              {euros(facture)}/mois
                            </span>
                            {attente > 0 ? (
                              <span className="block font-mono text-xs tabular-nums text-warning-ink">
                                {euros(attente)} en attente
                              </span>
                            ) : null}
                          </span>
                          <SiteFormDialog
                            clientId={client.id}
                            site={site}
                            trigger={iconBtn("Modifier le site")}
                          />
                          <ConfirmDelete
                            action={deleteSite.bind(null, site.id, client.id)}
                            description={`Supprimer le site « ${site.nom} » et ses contrats ?`}
                          />
                        </div>
                      </div>

                      <ul className="divide-y">
                        {site.contrats.map((ct) => {
                          const enAttente =
                            ct.statut === "actif" &&
                            ct.demarre &&
                            !ct.facturationDemarree;
                          return (
                            <li
                              key={ct.id}
                              className="flex flex-wrap items-center justify-between gap-2 px-3 py-2"
                            >
                              <div className="min-w-0">
                                <p className="truncate text-sm font-medium">
                                  {ct.libelle}
                                </p>
                                <p className="font-mono text-xs tabular-nums text-muted-foreground">
                                  {euros(ct.montantMensuel)}/mois · depuis le{" "}
                                  {dateFr(ct.dateDebut)}
                                </p>
                                {enAttente ? (
                                  <p className="text-xs text-warning-ink">
                                    En attente de facturation, hors MRR.
                                  </p>
                                ) : null}
                                {ct.statut === "actif" && !ct.demarre ? (
                                  <p className="text-xs text-muted-foreground">
                                    Démarrage prévu, pas encore compté.
                                  </p>
                                ) : null}
                              </div>
                              <div className="flex shrink-0 items-center gap-1">
                                <ContratStatusBadge statut={ct.statut} />
                                {enAttente ? (
                                  <FacturationToggle
                                    contratId={ct.id}
                                    facturee={false}
                                  />
                                ) : null}
                                <ContratFormDialog
                                  siteId={site.id}
                                  contrat={ct}
                                  trigger={iconBtn("Modifier le contrat")}
                                />
                                <ConfirmDelete
                                  action={deleteContrat.bind(null, ct.id, site.id)}
                                  description={`Supprimer le contrat « ${ct.libelle} » et ses engagements ?`}
                                />
                              </div>
                            </li>
                          );
                        })}
                        <li className="px-3 py-1.5">
                          <ContratFormDialog
                            siteId={site.id}
                            trigger={
                              <Button variant="ghost" size="sm">
                                <Plus />{" "}
                                {site.contrats.length === 0
                                  ? "Ajouter un contrat (MRR à définir)"
                                  : "Ajouter un contrat"}
                              </Button>
                            }
                          />
                        </li>
                      </ul>
                    </div>
                  );
                })}
              </div>
            )}
          </TabsContent>

          <TabsContent value="factures" className="space-y-2 pt-2">
            <div className="flex justify-end">
              <FactureFormDialog
                clientId={client.id}
                sites={sitesOpt}
                trigger={
                  <Button variant="outline" size="sm">
                    <Plus /> Facture
                  </Button>
                }
              />
            </div>
            {client.factures.length === 0 ? (
              <p className="rounded-lg border border-dashed py-8 text-center text-sm text-muted-foreground">
                Aucune facture. Elles sont visibles par le client dans son portail.
              </p>
            ) : (
              <ul className="divide-y rounded-lg border">
                {client.factures.map((f) => (
                  <li
                    key={f.id}
                    className="flex items-center justify-between gap-3 px-3 py-2"
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
                        {f.dateEcheance
                          ? ` · échéance ${dateFr(f.dateEcheance)}`
                          : ""}
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
                        ) : (
                          ""
                        )}
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
                        sites={sitesOpt}
                        facture={f}
                        trigger={iconBtn("Modifier la facture")}
                      />
                      <ConfirmDelete
                        action={deleteFacture.bind(null, f.id, client.id)}
                        description={`Supprimer la facture ${f.numero} ?`}
                      />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </TabsContent>

          <TabsContent value="devis" className="space-y-2 pt-2">
            <div className="flex justify-end">
              <DevisFormDialog
                clients={[{ id: client.id, nom: client.nom }]}
                sites={client.sites.map((s) => ({
                  id: s.id,
                  nom: s.nom,
                  clientNom: client.nom,
                }))}
                defaultClientId={client.id}
                trigger={
                  <Button variant="outline" size="sm">
                    <Plus /> Devis
                  </Button>
                }
              />
            </div>
            {client.devis.length === 0 ? (
              <p className="rounded-lg border border-dashed py-8 text-center text-sm text-muted-foreground">
                Aucun devis pour ce client.
              </p>
            ) : (
              <ul className="divide-y rounded-lg border">
                {client.devis.map((d) => (
                  <li
                    key={d.id}
                    className="flex items-center justify-between gap-3 px-3 py-2"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{d.libelle}</p>
                      <p className="font-mono text-xs tabular-nums text-muted-foreground">
                        {euros(d.montantMensuelPropose)}/mois
                        {d.montantCreation > 0
                          ? ` · ${euros(d.montantCreation)} création`
                          : ""}
                        {d.dateRelance ? ` · relance ${dateFr(d.dateRelance)}` : ""}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      <DevisStatusBadge statut={d.statut} />
                      <DevisFormDialog
                        clients={[{ id: client.id, nom: client.nom }]}
                        sites={client.sites.map((s) => ({
                          id: s.id,
                          nom: s.nom,
                          clientNom: client.nom,
                        }))}
                        devis={d}
                        trigger={iconBtn("Modifier le devis")}
                      />
                      <ConfirmDelete
                        action={deleteDevis.bind(null, d.id)}
                        description={`Supprimer le devis « ${d.libelle} » ?`}
                      />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </TabsContent>
        </Tabs>

        {client.notes ? (
          <p className="whitespace-pre-wrap rounded-lg bg-muted px-3 py-2 text-sm text-muted-foreground">
            {client.notes}
          </p>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
