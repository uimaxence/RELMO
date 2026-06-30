import Link from "next/link";
import { ArrowRight } from "lucide-react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { StatusBadge } from "@/components/status-badge";

export type VenduItem = {
  label: string;
  site: string;
  client: string;
  siteId: string;
  vendu: number;
  livre: number;
};

// Récap « ce qui est prévu au contrat ce mois » vs « ce qui est déjà livré »,
// par engagement. Source des livrables qui alimentent la to-do de la semaine.
export function VenduVsLivre({
  items,
  periode,
}: {
  items: VenduItem[];
  periode: string;
}) {
  const incomplets = items.filter((i) => i.livre < i.vendu).length;
  // Les plus en retard d'abord, terminés en bas.
  const sorted = [...items].sort(
    (a, b) => b.vendu - b.livre - (a.vendu - a.livre),
  );

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between space-y-0">
        <div>
          <CardTitle className="text-base">Livrables du mois · {periode}</CardTitle>
          <CardDescription>
            Prévu au contrat vs déjà livré, par prestation.
          </CardDescription>
        </div>
        {items.length > 0 ? (
          incomplets > 0 ? (
            <StatusBadge variant="warn">
              {incomplets} à finir
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
            <Link href="/livrables" className="text-sm text-brand hover:underline">
              Générer les livrables →
            </Link>
          </div>
        ) : (
          <>
            <ul className="divide-y">
              {sorted.map((it, idx) => {
                const reste = it.vendu - it.livre;
                const done = reste <= 0;
                const shown = Math.min(it.vendu, 12);
                const filled =
                  it.vendu <= 12
                    ? it.livre
                    : Math.round((it.livre / it.vendu) * 12);
                return (
                  <li
                    key={idx}
                    className="flex items-center justify-between gap-3 py-2.5"
                  >
                    <div className="min-w-0">
                      <Link
                        href={`/sites/${it.siteId}`}
                        className="truncate text-sm font-medium hover:underline"
                      >
                        {it.label}
                      </Link>
                      <p className="truncate text-xs text-muted-foreground">
                        {it.client} · {it.site}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-3">
                      <div className="flex gap-[3px]" aria-hidden>
                        {Array.from({ length: shown }).map((_, r) => (
                          <span
                            key={r}
                            className={`size-2.5 rounded-[3px] ${
                              r < filled
                                ? done
                                  ? "bg-foreground"
                                  : "bg-warning"
                                : "bg-muted"
                            }`}
                          />
                        ))}
                      </div>
                      <span className="w-10 text-right font-mono text-xs tabular-nums">
                        <span className={done ? "text-foreground" : "text-warning-ink"}>
                          {it.livre}
                        </span>
                        <span className="text-muted-foreground">/{it.vendu}</span>
                      </span>
                    </div>
                  </li>
                );
              })}
            </ul>

            <div className="mt-3 flex items-center justify-between border-t pt-3 text-sm">
              <Link
                href="/livrables"
                className="inline-flex items-center gap-1 text-brand hover:underline"
              >
                Gérer les livrables <ArrowRight className="size-3.5" />
              </Link>
              <Link
                href="/semaine"
                className="text-muted-foreground hover:underline"
              >
                À faire cette semaine →
              </Link>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
