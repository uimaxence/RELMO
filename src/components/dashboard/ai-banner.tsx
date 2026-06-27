import { Sparkles, ChevronRight } from "lucide-react";

import { StatusBadge } from "@/components/status-badge";

// Bandeau « Analyse IA » (cf. style-guide.html). Marque la future F14.
export function AiBanner() {
  return (
    <div className="flex items-center gap-3 rounded-xl bg-muted px-4 py-3">
      <Sparkles className="size-4 shrink-0 animate-pulse text-brand" />
      <span className="min-w-0 flex-1 text-sm">
        Analyse IA · quels leviers actionner ce mois pour rester dans les temps
      </span>
      <StatusBadge variant="neutral">Bientôt</StatusBadge>
      <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
    </div>
  );
}
