import { Card, CardContent } from "@/components/ui/card";
import { StatusBadge } from "@/components/status-badge";
import { euros } from "@/lib/format";
import { periodeLabel } from "@/lib/periode";

const SEGMENTS = 40;

// Carte « Objectif MRR » : avancement du récurrent vers la cible (cf. style-guide).
export function ObjectifMrr({
  current,
  cible,
  ciblePeriode,
  now = new Date(),
}: {
  current: number;
  cible: number;
  ciblePeriode: string;
  now?: Date;
}) {
  const ratio = cible > 0 ? current / cible : 0;
  const pct = Math.min(100, Math.round(ratio * 100));
  const filled = current > 0 ? Math.max(1, Math.round(SEGMENTS * Math.min(ratio, 1))) : 0;

  const [ty, tm] = ciblePeriode.split("-").map(Number);
  const monthsRemaining = Math.max(
    1,
    (ty - now.getFullYear()) * 12 + (tm - 1 - now.getMonth()),
  );
  const rythme = Math.max(0, (cible - current) / monthsRemaining);
  const atteint = current >= cible;

  return (
    <Card>
      <CardContent className="space-y-4 pt-6">
        <div className="flex items-center justify-between gap-3">
          <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Objectif MRR · cap {euros(cible)}
          </span>
          <StatusBadge variant={atteint ? "ok" : "warn"}>
            {atteint ? "Atteint" : "À surveiller"}
          </StatusBadge>
        </div>

        <div className="flex flex-wrap items-baseline gap-x-2">
          <span className="font-mono text-3xl font-medium tabular-nums">
            {euros(current)}
          </span>
          <span className="text-sm text-muted-foreground">
            / {euros(cible)} · cible {periodeLabel(ciblePeriode)}
          </span>
        </div>

        <div className="flex gap-[3px]" aria-hidden>
          {Array.from({ length: SEGMENTS }).map((_, i) => (
            <span
              key={i}
              className={`h-5 flex-1 rounded-[3px] ${
                i < filled ? "bg-foreground" : "bg-muted"
              }`}
            />
          ))}
        </div>

        <div className="flex flex-wrap gap-x-8 gap-y-1 text-sm text-muted-foreground">
          <span>
            Avancement{" "}
            <span className="font-mono font-medium text-foreground tabular-nums">
              {pct}%
            </span>
          </span>
          {!atteint ? (
            <span>
              Rythme requis{" "}
              <span className="font-mono font-medium text-foreground tabular-nums">
                +{euros(rythme)}/mois
              </span>{" "}
              sur {monthsRemaining} mois
            </span>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}
