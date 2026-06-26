import Link from "next/link";
import { ChevronRight, Pencil } from "lucide-react";

import { prisma } from "@/lib/db";
import { PageHeader } from "@/components/page-header";
import { ClientFormDialog } from "@/components/forms/client-form-dialog";
import { ConfirmDelete } from "@/components/forms/confirm-delete";
import { deleteClient } from "@/app/actions/clients";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { euros } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function ClientsPage() {
  const now = new Date();
  const clients = await prisma.client.findMany({
    orderBy: { nom: "asc" },
    include: { sites: { include: { contrats: true } } },
  });

  const rows = clients.map((c) => {
    const contrats = c.sites.flatMap((s) => s.contrats);
    const mrr = contrats
      .filter((ct) => ct.statut === "actif" && ct.dateDebut <= now)
      .reduce((sum, ct) => sum + ct.montantMensuel, 0);
    return { ...c, nbSites: c.sites.length, mrr };
  });

  return (
    <div>
      <PageHeader
        title="Clients & sites"
        description="Annuaire des clients et des sites gérés."
      >
        <ClientFormDialog />
      </PageHeader>

      {rows.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-4 py-12 text-center">
            <p className="text-sm text-muted-foreground">
              Aucun client pour l&apos;instant.
            </p>
            <ClientFormDialog />
          </CardContent>
        </Card>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Client</TableHead>
                <TableHead>Email</TableHead>
                <TableHead className="text-center">Sites</TableHead>
                <TableHead className="text-right">MRR facturé</TableHead>
                <TableHead className="w-[120px]" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="font-medium">
                    <Link
                      href={`/clients/${c.id}`}
                      className="inline-flex items-center gap-1 hover:underline"
                    >
                      {c.nom}
                      <ChevronRight className="size-4 text-muted-foreground" />
                    </Link>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {c.email ?? "—"}
                  </TableCell>
                  <TableCell className="text-center">{c.nbSites}</TableCell>
                  <TableCell className="text-right font-medium">
                    {euros(c.mrr)}
                  </TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-1">
                      <ClientFormDialog
                        client={c}
                        trigger={
                          <Button variant="ghost" size="icon" aria-label="Modifier">
                            <Pencil />
                          </Button>
                        }
                      />
                      <ConfirmDelete
                        action={deleteClient.bind(null, c.id)}
                        description={`Supprimer « ${c.nom} » et tous ses sites, contrats et livrables ? Cette action est irréversible.`}
                      />
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  );
}
