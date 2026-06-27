import type { LucideIcon } from "lucide-react";

import { Delta, DeltaIcon, DeltaValue } from "@/components/delta";

// Carte KPI au format style-guide.html : cadre creux (sunken) + carte surface,
// label en capitales, métrique en mono, pied avec delta/hint.
export function KpiCard({
  label,
  value,
  hint,
  delta,
  icon: Icon,
}: {
  label: string;
  value: string | number;
  hint?: string;
  delta?: number; // variation (si dispo) — sinon hint seul
  icon?: LucideIcon;
}) {
  return (
    <div className="rounded-xl bg-muted p-[5px]">
      <div className="rounded-[10px] border bg-card p-4">
        <div className="flex items-start justify-between gap-2">
          <div>
            <div className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
              {label}
            </div>
            <div className="mt-2 font-mono text-2xl font-medium tabular-nums tracking-tight">
              {value}
            </div>
          </div>
          {Icon ? <Icon className="size-4 text-muted-foreground" /> : null}
        </div>
      </div>
      <div className="flex items-center gap-2 px-2.5 pt-2 pb-1 text-xs">
        {typeof delta === "number" ? (
          <Delta value={delta} variant="default">
            <DeltaIcon />
            <DeltaValue />
          </Delta>
        ) : null}
        {hint ? <span className="text-muted-foreground">{hint}</span> : null}
      </div>
    </div>
  );
}
