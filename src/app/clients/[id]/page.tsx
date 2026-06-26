import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronRight, Pencil, Globe, Mail, Phone } from "lucide-react";

import { prisma } from "@/lib/db";
import { PageHeader } from "@/components/page-header";
import { ClientFormDialog } from "@/components/forms/client-form-dialog";
import { SiteFormDialog } from "@/components/forms/site-form-dialog";
import { ConfirmDelete } from "@/components/forms/confirm-delete";
import { deleteClient } from "@/app/actions/clients";
import { deleteSite } from "@/app/actions/sites";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { euros } from "@/lib/format";
import { labelOf, SITE_STATUTS } from "@/lib/constants";

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
    },
  });

  if (!client) notFound();

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
        </div>
        {client.notes ? (
          <p className="mt-3 whitespace-pre-wrap text-sm">{client.notes}</p>
        ) : null}
      </div>

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
                .filter((ct) => ct.statut === "actif" && ct.dateDebut <= now)
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
                    <Badge variant={site.statut === "actif" ? "default" : "secondary"}>
                      {labelOf(SITE_STATUTS, site.statut)}
                    </Badge>
                  </CardHeader>
                  <CardContent className="flex items-center justify-between">
                    <div className="text-sm text-muted-foreground">
                      {site.contrats.length} contrat
                      {site.contrats.length > 1 ? "s" : ""} · {euros(mrr)}/mois
                    </div>
                    <div className="flex gap-1">
                      <SiteFormDialog
                        clientId={client.id}
                        site={site}
                        trigger={
                          <Button variant="ghost" size="icon" aria-label="Modifier">
                            <Pencil />
                          </Button>
                        }
                      />
                      <ConfirmDelete
                        action={deleteSite.bind(null, site.id, client.id)}
                        description={`Supprimer le site « ${site.nom} » et ses contrats ?`}
                      />
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
