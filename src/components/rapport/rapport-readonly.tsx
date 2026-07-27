import { Check, ArrowUp, ArrowDown, Minus } from "lucide-react";

import { PositionsChart } from "@/components/rapport/positions-chart";
import { euros, dateFr } from "@/lib/format";
import type { RapportData } from "@/lib/rapport";

// Rendu en LECTURE SEULE du rapport mensuel (espace client / portail). Reprend le
// contenu de RapportData sans aucune commande d'édition.
export function RapportReadonly({ data }: { data: RapportData }) {
  const { seo, rapport } = data;

  return (
    <div className="space-y-6">
      {rapport?.intro ? (
        <p className="whitespace-pre-wrap text-sm leading-relaxed">{rapport.intro}</p>
      ) : null}

      <div className="grid grid-cols-3 gap-4 border-y py-5">
        <Stat label="Abonnement" value={`${euros(data.mrr)}/mois`} />
        <Stat label="Livrables réalisés" value={`${data.totalLivre}/${data.totalVendu}`} />
        <Stat
          label="Taux de réalisation"
          value={data.tauxRealisation != null ? `${data.tauxRealisation}%` : "—"}
        />
      </div>

      {seo.suivi ? (
        <section className="space-y-4">
          <h2 className="text-sm font-medium uppercase tracking-wider text-muted-foreground">
            Visibilité Google
          </h2>

          {seo.visibilite ? (
            <div className="grid grid-cols-2 gap-4">
              <Stat
                label="Mots-clés positionnés"
                value={seo.visibilite.nbMotsCles != null ? String(seo.visibilite.nbMotsCles) : "—"}
              />
              <Stat
                label="Visites/mois estimées"
                value={
                  seo.visibilite.traficEstime != null ? String(seo.visibilite.traficEstime) : "—"
                }
              />
            </div>
          ) : null}

          {seo.historique.some((h) => h.positionMoyenne != null) ? (
            <div>
              <PositionsChart
                data={seo.historique.map((h) => ({ label: h.label, position: h.positionMoyenne }))}
              />
              <p className="mt-1 text-center text-xs text-muted-foreground">
                Position moyenne sur vos mots-clés (plus haut = mieux).
              </p>
            </div>
          ) : null}

          {seo.motsCles.length ? (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs uppercase tracking-wider text-muted-foreground">
                  <th className="py-2 font-medium">Mot-clé</th>
                  <th className="py-2 text-right font-medium">Position</th>
                  <th className="py-2 text-right font-medium">Évolution</th>
                </tr>
              </thead>
              <tbody>
                {seo.motsCles.map((m, i) => (
                  <tr key={i} className="border-b last:border-0">
                    <td className="py-2">{m.texte}</td>
                    <td className="py-2 text-right font-mono tabular-nums">
                      {m.position != null ? m.position : <span className="text-muted-foreground">&gt;100</span>}
                    </td>
                    <td className="py-2 text-right">
                      <Delta delta={m.delta} nouveau={m.positionPrec == null && m.position != null} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : null}

          {rapport?.syntheseSeo ? (
            <p className="whitespace-pre-wrap text-sm leading-relaxed">{rapport.syntheseSeo}</p>
          ) : null}
        </section>
      ) : null}

      {data.sites.length > 0 ? (
        <section className="space-y-4">
          <h2 className="text-sm font-medium uppercase tracking-wider text-muted-foreground">
            Travail livré
          </h2>
          {data.sites.map((site) => (
            <div key={site.nom}>
              <h3 className="mb-1 text-base font-semibold">{site.nom}</h3>
              <ul className="space-y-2">
                {site.engagements.map((e, i) => (
                  <li key={i}>
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium">{e.libelle}</span>
                      <span className="font-mono tabular-nums text-muted-foreground">
                        {e.livre}/{e.vendu}
                      </span>
                    </div>
                    {e.items.length > 0 ? (
                      <ul className="mt-1 space-y-0.5 pl-1">
                        {e.items.map((it, j) => (
                          <li
                            key={j}
                            className="flex items-center gap-2 text-sm text-muted-foreground"
                          >
                            <Check className="size-3.5 shrink-0 text-positive" />
                            <span>{it.libelle}</span>
                            {it.faitLe ? <span className="text-xs">· {dateFr(it.faitLe)}</span> : null}
                          </li>
                        ))}
                      </ul>
                    ) : null}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </section>
      ) : null}

      {rapport?.commentaire ? (
        <section>
          <h2 className="mb-1 text-sm font-medium uppercase tracking-wider text-muted-foreground">
            Le mot du mois
          </h2>
          <p className="whitespace-pre-wrap text-sm leading-relaxed">{rapport.commentaire}</p>
        </section>
      ) : null}

      {rapport?.actions ? (
        <section>
          <h2 className="mb-1 text-sm font-medium uppercase tracking-wider text-muted-foreground">
            La suite
          </h2>
          <p className="whitespace-pre-wrap text-sm leading-relaxed">{rapport.actions}</p>
        </section>
      ) : null}
    </div>
  );
}

function Delta({ delta, nouveau }: { delta: number | null; nouveau: boolean }) {
  if (nouveau) return <span className="text-xs text-muted-foreground">nouveau</span>;
  if (delta == null) return <span className="text-muted-foreground">—</span>;
  if (delta === 0)
    return (
      <span className="inline-flex items-center gap-1 text-muted-foreground">
        <Minus className="size-3.5" /> 0
      </span>
    );
  const gagne = delta > 0;
  return (
    <span
      className={`inline-flex items-center gap-1 font-mono tabular-nums ${
        gagne ? "text-positive" : "text-muted-foreground"
      }`}
    >
      {gagne ? <ArrowUp className="size-3.5" /> : <ArrowDown className="size-3.5" />}
      {Math.abs(delta)}
    </span>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
      <div className="mt-1 font-mono text-lg font-medium tabular-nums">{value}</div>
    </div>
  );
}
