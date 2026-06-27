import { Card, CardContent } from "@/components/ui/card";
import { StatusBadge } from "@/components/status-badge";
import { ObjectifFormDialog } from "@/components/forms/objectif-form-dialog";
import { euros } from "@/lib/format";
import { periodeLabel } from "@/lib/periode";
import { computeObjectif } from "@/lib/objectif";

const SEGMENTS = 40;

type Objectif = {
  id: string;
  montantCible: number;
  mrrDepart: number;
  dateDebut: Date;
  dateCible: Date;
};

// Carte « Objectif MRR » (F11) : avancement réel + overlay pipeline (devis en négo).
export function ObjectifMrr({
  objectif,
  current,
  potentiel,
  now = new Date(),
}: {
  objectif: Objectif;
  current: number;
  potentiel: number; // MRR potentiel en pipeline
  now?: Date;
}) {
  const c = computeObjectif(objectif, current, now);
  const cibleLabel = `${objectif.dateCible.getFullYear()}-${String(objectif.dateCible.getMonth() + 1).padStart(2, "0")}`;

  // Segments : encre = réalisé, teal pâle = pipeline potentiel, sinon vide.
  const span = Math.max(1, objectif.montantCible - objectif.mrrDepart);
  const fillCurrent = Math.round(
    SEGMENTS * Math.max(0, Math.min(1, (current - objectif.mrrDepart) / span)),
  );
  const fillPotentiel = Math.round(
    SEGMENTS *
      Math.max(
        0,
        Math.min(1, (current + potentiel - objectif.mrrDepart) / span),
      ),
  );

  return (
    <Card>
      <CardContent className="space-y-4 pt-6">
        <div className="flex items-center justify-between gap-3">
          <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Objectif MRR · cap {euros(objectif.montantCible)}
          </span>
          <div className="flex items-center gap-1">
            <StatusBadge variant={c.statut}>{c.statutLabel}</StatusBadge>
            <ObjectifFormDialog objectif={objectif} />
          </div>
        </div>

        <div className="flex flex-wrap items-baseline gap-x-2">
          <span className="font-mono text-3xl font-medium tabular-nums">
            {euros(current)}
          </span>
          <span className="text-sm text-muted-foreground">
            / {euros(objectif.montantCible)} · cible {periodeLabel(cibleLabel)}
          </span>
        </div>

        <div className="flex gap-[3px]" aria-hidden>
          {Array.from({ length: SEGMENTS }).map((_, i) => (
            <span
              key={i}
              className={`h-5 flex-1 rounded-[3px] ${
                i < fillCurrent
                  ? "bg-foreground"
                  : i < fillPotentiel
                    ? "bg-brand/30"
                    : "bg-muted"
              }`}
            />
          ))}
        </div>

        <div className="flex flex-wrap gap-x-8 gap-y-1 text-sm text-muted-foreground">
          <span>
            Avancement{" "}
            <span className="font-mono font-medium text-foreground tabular-nums">
              {c.pct}%
            </span>
          </span>
          {!c.atteint ? (
            <span>
              Rythme requis{" "}
              <span className="font-mono font-medium text-foreground tabular-nums">
                +{euros(c.rythmeRequis)}/mois
              </span>{" "}
              sur {c.moisRestants} mois
            </span>
          ) : null}
          {potentiel > 0 ? (
            <span>
              Pipeline{" "}
              <span className="font-mono font-medium text-brand tabular-nums">
                +{euros(potentiel)}
              </span>{" "}
              si tout signe
            </span>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}
