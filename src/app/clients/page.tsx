import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";

export default function ClientsPage() {
  return (
    <div>
      <PageHeader
        title="Clients & sites"
        description="Annuaire des clients et des sites gérés (F1). CRUD à venir au Sprint 1."
      />
      <Card>
        <CardContent className="py-10 text-center text-sm text-muted-foreground">
          Bientôt : liste des clients, ajout d&apos;un client, de ses sites et
          contrats.
        </CardContent>
      </Card>
    </div>
  );
}
