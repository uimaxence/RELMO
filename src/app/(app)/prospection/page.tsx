import Link from "next/link";
import { Sparkles, Search, Mails } from "lucide-react";

import { prisma } from "@/lib/db";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AiGenerateDialog } from "@/components/ai/ai-generate-dialog";
import { actionAccrochesProspection } from "@/app/actions/ai";
import { VueProspecter } from "@/components/prospection/vue-prospecter";
import { VueEnvoyer } from "@/components/prospection/vue-envoyer";

export const dynamic = "force-dynamic";
// La collecte + audit de 15 prospects (server action de cette route) peut durer
// ~40 s ; on relève le plafond. Les prospects sont persistés avant l'audit.
export const maxDuration = 60;

// Écran unique de prospection sortante, deux modes : « Prospecter » (découverte,
// audit, pipeline froid) et « Envoyer » (file d'envoi). Les deals chauds (clients
// au statut « prospect ») et les relances de devis vivent désormais sur /pipeline.
export default async function ProspectionPage({
  searchParams,
}: {
  searchParams: Promise<{ vue?: string }>;
}) {
  const { vue } = await searchParams;
  const mode = vue === "envoyer" ? "envoyer" : "prospecter";

  const nbEnFile = await prisma.prospect.count({ where: { statut: "a_contacter" } });

  const onglets = [
    { cle: "prospecter", label: "Prospecter", icon: Search, href: "/prospection" },
    { cle: "envoyer", label: "Envoyer", icon: Mails, href: "/prospection?vue=envoyer", badge: nbEnFile },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Prospection"
        description="Trouver, auditer et scorer des prospects, puis les contacter depuis ta boîte."
      >
        <AiGenerateDialog
          action={actionAccrochesProspection}
          title="Accroches du jour"
          description="Plan de prospection calibré sur ton objectif."
          providerLabel="DeepSeek"
          trigger={
            <Button variant="outline" size="sm">
              <Sparkles className="text-brand" /> Accroches IA
            </Button>
          }
        />
      </PageHeader>

      {/* Onglets Prospecter / Envoyer */}
      <div className="flex gap-1 border-b">
        {onglets.map((o) => {
          const actif = o.cle === mode;
          return (
            <Link
              key={o.cle}
              href={o.href}
              className={`-mb-px inline-flex items-center gap-1.5 border-b-2 px-3 py-2 text-sm font-medium transition-colors ${
                actif
                  ? "border-brand text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              <o.icon className="size-4" />
              {o.label}
              {o.badge ? (
                <Badge variant="secondary" className="ml-0.5 font-mono tabular-nums">
                  {o.badge}
                </Badge>
              ) : null}
            </Link>
          );
        })}
      </div>

      {mode === "envoyer" ? <VueEnvoyer /> : <VueProspecter />}
    </div>
  );
}
