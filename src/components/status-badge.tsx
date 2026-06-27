import { cn } from "@/lib/utils";
import { labelOf, SITE_STATUTS, CONTRAT_STATUTS } from "@/lib/constants";

export type StatusVariant = "ok" | "warn" | "bad" | "neutral";

// Badge de statut « pastille + libellé » (cf. DESIGN_SYSTEM.md §1.1 / style-guide).
// Tokens sémantiques exacts de la spec, dark-mode-safe.
const VARIANT: Record<StatusVariant, { wrap: string; dot: string }> = {
  ok: { wrap: "bg-positive-bg text-positive-ink", dot: "bg-positive" },
  warn: { wrap: "bg-warning-bg text-warning-ink", dot: "bg-warning" },
  bad: { wrap: "bg-negative-bg text-negative-ink", dot: "bg-negative" },
  neutral: { wrap: "bg-neutral-bg text-neutral-ink", dot: "bg-neutral-ink" },
};

export function StatusBadge({
  variant,
  children,
  className,
}: {
  variant: StatusVariant;
  children: React.ReactNode;
  className?: string;
}) {
  const v = VARIANT[variant];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap",
        v.wrap,
        className,
      )}
    >
      <span className={cn("size-1.5 rounded-full", v.dot)} />
      {children}
    </span>
  );
}

// --- Mappings statut métier -> variante + libellé FR ---

const SITE_VARIANT: Record<string, StatusVariant> = {
  actif: "ok",
  en_pause: "warn",
  archive: "neutral",
};

const CONTRAT_VARIANT: Record<string, StatusVariant> = {
  actif: "ok",
  en_pause: "warn",
  resilie: "bad",
};

export function SiteStatusBadge({ statut }: { statut: string }) {
  return (
    <StatusBadge variant={SITE_VARIANT[statut] ?? "neutral"}>
      {labelOf(SITE_STATUTS, statut)}
    </StatusBadge>
  );
}

export function ContratStatusBadge({ statut }: { statut: string }) {
  return (
    <StatusBadge variant={CONTRAT_VARIANT[statut] ?? "neutral"}>
      {labelOf(CONTRAT_STATUTS, statut)}
    </StatusBadge>
  );
}
