import Link from "next/link";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/status-badge";

export type VenduItem = { label: string; vendu: number; livre: number };

// Signature §9 : densité par petits carrés (jamais de bloc plein).
// Livré = encre (ambre si incomplet), reste vendu = fantôme.
export function VenduVsLivre({
  items,
  periode,
}: {
  items: VenduItem[];
  periode: string;
}) {
  const incomplets = items.filter((i) => i.livre < i.vendu).length;
  const maxV = Math.max(1, ...items.map((i) => i.vendu));
  const rows = Math.min(8, maxV);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle className="text-base">Vendu vs livré · {periode}</CardTitle>
        {items.length > 0 ? (
          incomplets > 0 ? (
            <StatusBadge variant="warn">
              {incomplets} incomplet{incomplets > 1 ? "s" : ""}
            </StatusBadge>
          ) : (
            <StatusBadge variant="ok">À jour</StatusBadge>
          )
        ) : null}
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <div className="py-6 text-center">
            <p className="text-sm text-muted-foreground">
              Aucun livrable généré ce mois.
            </p>
            <Link
              href="/livrables"
              className="text-sm text-brand hover:underline"
            >
              Générer les livrables →
            </Link>
          </div>
        ) : (
          <div className="flex items-end justify-around gap-3 pt-2">
            {items.map((it, idx) => {
              const vR = Math.max(1, Math.round((it.vendu / maxV) * rows));
              const dR = Math.round((it.livre / maxV) * rows);
              const behind = it.livre < it.vendu;
              return (
                <div
                  key={idx}
                  className="flex flex-1 flex-col items-center gap-2"
                >
                  <div className="flex w-full max-w-[26px] flex-col-reverse gap-[3px]">
                    {Array.from({ length: rows }).map((_, r) => (
                      <span
                        key={r}
                        className={`aspect-square w-full rounded-[3px] ${
                          r < dR
                            ? behind
                              ? "bg-warning"
                              : "bg-foreground"
                            : r < vR
                              ? "bg-muted"
                              : "bg-transparent"
                        }`}
                      />
                    ))}
                  </div>
                  <div
                    className="max-w-[80px] truncate text-center text-[11px] text-muted-foreground"
                    title={it.label}
                  >
                    {it.label}{" "}
                    <span className="font-mono tabular-nums text-foreground">
                      {it.livre}/{it.vendu}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
