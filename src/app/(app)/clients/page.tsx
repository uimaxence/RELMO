import { prisma } from "@/lib/db";
import { PageHeader } from "@/components/page-header";
import { ClientFormDialog } from "@/components/forms/client-form-dialog";
import { ClientsTable } from "@/components/clients/clients-table";
import type { PanelClient } from "@/components/clients/client-panel";
import { Card, CardContent } from "@/components/ui/card";

export const dynamic = "force-dynamic";

export default async function ClientsPage() {
  const now = new Date();
  const clients = await prisma.client.findMany({
    orderBy: { nom: "asc" },
    include: {
      sites: {
        orderBy: { nom: "asc" },
        include: { contrats: { orderBy: { dateDebut: "desc" } } },
      },
      factures: { orderBy: { dateEmission: "desc" } },
      devis: { orderBy: { updatedAt: "desc" } },
    },
  });

  const rows: PanelClient[] = clients.map((c) => {
    const sites = c.sites.map((s) => ({
      ...s,
      contrats: s.contrats.map((ct) => ({ ...ct, demarre: ct.dateDebut <= now })),
    }));
    const contrats = sites.flatMap((s) => s.contrats);
    const actifs = contrats.filter((ct) => ct.statut === "actif");
    const somme = (list: typeof contrats) =>
      list.reduce((sum, ct) => sum + ct.montantMensuel, 0);

    return {
      ...c,
      sites,
      mrrFacture: somme(
        actifs.filter((ct) => ct.demarre && ct.facturationDemarree),
      ),
      mrrEnAttente: somme(
        actifs.filter((ct) => ct.demarre && !ct.facturationDemarree),
      ),
      mrrAVenir: somme(actifs.filter((ct) => !ct.demarre)),
    };
  });

  return (
    <div>
      <PageHeader
        title="Clients & sites"
        description="Clique une ligne pour ouvrir la fiche : sites, contrats, factures et devis au même endroit."
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
          <ClientsTable clients={rows} />
        </Card>
      )}
    </div>
  );
}
