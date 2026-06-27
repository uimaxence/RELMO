import { cn } from "@/lib/utils";
import { labelOf, SITE_STATUTS, CONTRAT_STATUTS } from "@/lib/constants";

export type StatusVariant = "ok" | "warn" | "bad" | "neutral";

// Badge de statut « pastille + libellé » (cf. style-guide.html).
// Teintes sémantiques, dark-mode-safe.
const VARIANT: Record<StatusVariant, { wrap: string; dot: string }> = {
  ok: {
    wrap: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
    dot: "bg-emerald-500",
  },
  warn: {
    wrap: "bg-amber-500/10 text-amber-700 dark:text-amber-400",
    dot: "bg-amber-500",
  },
  bad: {
    wrap: "bg-red-500/10 text-red-700 dark:text-red-400",
    dot: "bg-red-500",
  },
  neutral: {
    wrap: "bg-muted text-muted-foreground",
    dot: "bg-muted-foreground",
  },
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
