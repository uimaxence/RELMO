import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";

export default function MrrPage() {
  return (
    <div>
      <PageHeader
        title="MRR"
        description="Revenu récurrent mensuel consolidé (F3) : total, par client, évolution."
      />
      <Card>
        <CardContent className="py-10 text-center text-sm text-muted-foreground">
          Bientôt : MRR total et ventilation par client à partir des contrats
          actifs.
        </CardContent>
      </Card>
    </div>
  );
}
