import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";

export default function LivrablesPage() {
  return (
    <div>
      <PageHeader
        title="Livrables du mois"
        description="Le cœur (F4) : checklist mensuelle générée depuis les engagements des contrats."
      />
      <Card>
        <CardContent className="py-10 text-center text-sm text-muted-foreground">
          Bientôt : pour chaque site, ce qui reste à livrer ce mois-ci, coché à la
          main puis (phase 2) depuis le git.
        </CardContent>
      </Card>
    </div>
  );
}
