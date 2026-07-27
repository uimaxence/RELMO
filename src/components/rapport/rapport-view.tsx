"use client";

import { useRef, useState, useTransition } from "react";
import {
  Sparkles,
  RefreshCw,
  Send,
  ArrowUp,
  ArrowDown,
  Minus,
  Check,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { PositionsChart } from "@/components/rapport/positions-chart";
import { euros, dateFr } from "@/lib/format";
import type { RapportData } from "@/lib/rapport";
import { updateRapport, envoyerRapport } from "@/app/actions/rapports";
import { actionIntroRapport, actionSyntheseSeo } from "@/app/actions/ai";

// Corps éditable du rapport mensuel : intro + synthèse SEO (pré-remplissables par
// IA), tableau de positions + courbe, livrables, commentaire et actions. Un seul
// formulaire, deux boutons : « Enregistrer » (brouillon) et « Envoyer au client »
// (enregistre puis publie sur le portail + email). Cf. src/app/actions/rapports.ts.
export function RapportView({ data }: { data: RapportData }) {
  const formRef = useRef<HTMLFormElement>(null);
  const [pending, start] = useTransition();
  const [action, setAction] = useState<"save" | "send" | null>(null);

  const [intro, setIntro] = useState(data.rapport?.intro ?? "");
  const [syntheseSeo, setSyntheseSeo] = useState(data.rapport?.syntheseSeo ?? "");
  const [commentaire, setCommentaire] = useState(data.rapport?.commentaire ?? "");
  const [actions, setActions] = useState(data.rapport?.actions ?? "");
  const [aiIntro, setAiIntro] = useState(false);
  const [aiSeo, setAiSeo] = useState(false);

  const { seo } = data;

  function submit(kind: "save" | "send") {
    const fd = new FormData(formRef.current ?? undefined);
    fd.set("origin", window.location.origin);
    setAction(kind);
    start(async () => {
      const res = await (kind === "save" ? updateRapport : envoyerRapport)(null, fd);
      setAction(null);
      if (res?.ok) toast.success(res.message);
      else toast.error(res?.message ?? "Une erreur est survenue.");
    });
  }

  async function genIntro() {
    setAiIntro(true);
    const res = await actionIntroRapport(data.client.id, data.periode, data.livres);
    setAiIntro(false);
    if (res.ok) setIntro(res.text);
    else toast.error(res.error);
  }

  async function genSeo() {
    setAiSeo(true);
    const res = await actionSyntheseSeo(
      data.client.id,
      data.periode,
      seo.motsCles.map((m) => ({
        texte: m.texte,
        position: m.position,
        positionPrec: m.positionPrec,
        volume: m.volume,
      })),
      seo.visibilite,
    );
    setAiSeo(false);
    if (res.ok) setSyntheseSeo(res.text);
    else toast.error(res.error);
  }

  const envoi = data.rapport;

  return (
    <form ref={formRef} className="space-y-5">
      <input type="hidden" name="clientId" value={data.client.id} />
      <input type="hidden" name="periode" value={data.periode} />

      {/* Intro */}
      <section className="border-b pb-5">
        <p className="hidden whitespace-pre-wrap text-sm leading-relaxed print:block">
          {intro}
        </p>
        <div className="print-hide space-y-2">
          <Textarea
            name="intro"
            value={intro}
            onChange={(e) => setIntro(e.target.value)}
            placeholder="Introduction du rapport (ou générez-la avec l'IA)…"
            className="min-h-[90px] text-sm leading-relaxed"
          />
          <Button type="button" variant="ghost" size="sm" onClick={genIntro} disabled={aiIntro}>
            {intro ? (
              <RefreshCw className={aiIntro ? "animate-spin" : ""} />
            ) : (
              <Sparkles className="text-brand" />
            )}
            {intro ? "Régénérer l'intro" : "Générer l'intro (IA)"}
          </Button>
        </div>
      </section>

      {/* Chiffres clés */}
      <section className="grid grid-cols-3 gap-4 border-b pb-5">
        <Stat label="Abonnement" value={`${euros(data.mrr)}/mois`} />
        <Stat label="Livrables réalisés" value={`${data.totalLivre}/${data.totalVendu}`} />
        <Stat
          label="Taux de réalisation"
          value={data.tauxRealisation != null ? `${data.tauxRealisation}%` : "—"}
        />
      </section>

      {/* SEO */}
      {seo.suivi ? (
        <section className="space-y-4 border-b pb-5">
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
                  seo.visibilite.traficEstime != null
                    ? String(seo.visibilite.traficEstime)
                    : "—"
                }
              />
            </div>
          ) : null}

          {seo.historique.some((h) => h.positionMoyenne != null) ? (
            <div className="print-hide">
              <PositionsChart
                data={seo.historique.map((h) => ({
                  label: h.label,
                  position: h.positionMoyenne,
                }))}
              />
              <p className="mt-1 text-center text-xs text-muted-foreground">
                Position moyenne sur les mots-clés suivis (plus haut = mieux).
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
                  <th className="py-2 text-right font-medium">Volume</th>
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
                      <DeltaBadge delta={m.delta} nouveau={m.positionPrec == null && m.position != null} />
                    </td>
                    <td className="py-2 text-right font-mono tabular-nums text-muted-foreground">
                      {m.volume != null ? m.volume : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : null}

          {/* Synthèse SEO éditable */}
          <div>
            <p className="hidden whitespace-pre-wrap text-sm leading-relaxed print:block">
              {syntheseSeo}
            </p>
            <div className="print-hide space-y-2">
              <Textarea
                name="syntheseSeo"
                value={syntheseSeo}
                onChange={(e) => setSyntheseSeo(e.target.value)}
                placeholder="Synthèse de l'évolution SEO (ou générez-la avec l'IA)…"
                className="min-h-[80px] text-sm leading-relaxed"
              />
              <Button type="button" variant="ghost" size="sm" onClick={genSeo} disabled={aiSeo}>
                {syntheseSeo ? (
                  <RefreshCw className={aiSeo ? "animate-spin" : ""} />
                ) : (
                  <Sparkles className="text-brand" />
                )}
                {syntheseSeo ? "Régénérer la synthèse" : "Générer la synthèse (IA)"}
              </Button>
            </div>
          </div>
        </section>
      ) : (
        <input type="hidden" name="syntheseSeo" value={syntheseSeo} />
      )}

      {/* Livrables du mois */}
      <section className="space-y-6 border-b pb-5">
        <h2 className="text-sm font-medium uppercase tracking-wider text-muted-foreground">
          Travail livré
        </h2>
        {data.sites.length === 0 ? (
          <p className="text-sm text-muted-foreground">Aucun livrable prévu sur cette période.</p>
        ) : (
          data.sites.map((site) => (
            <div key={site.nom}>
              <h3 className="mb-2 text-base font-semibold">{site.nom}</h3>
              <ul className="space-y-3">
                {site.engagements.map((e, i) => (
                  <li key={i}>
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium">{e.libelle}</span>
                      <span className="font-mono tabular-nums text-muted-foreground">
                        {e.livre}/{e.vendu} livré{e.livre > 1 ? "s" : ""}
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
          ))
        )}
      </section>

      {/* Commentaire + actions à faire */}
      <section className="grid gap-4 md:grid-cols-2">
        <EditableBloc
          title="Mon commentaire"
          name="commentaire"
          value={commentaire}
          onChange={setCommentaire}
          placeholder="Un mot pour le client ce mois-ci…"
        />
        <EditableBloc
          title="La suite (actions à faire)"
          name="actions"
          value={actions}
          onChange={setActions}
          placeholder="Ce qui est prévu le mois prochain…"
        />
      </section>

      {/* Barre d'actions (non imprimée) */}
      <div className="print-hide flex flex-wrap items-center gap-3 border-t pt-4">
        <Button
          type="button"
          variant="outline"
          onClick={() => submit("save")}
          disabled={pending}
        >
          {pending && action === "save" ? "Enregistrement…" : "Enregistrer le brouillon"}
        </Button>
        <Button
          type="button"
          onClick={() => submit("send")}
          disabled={pending || !data.client.email}
        >
          <Send />
          {pending && action === "send" ? "Envoi…" : "Envoyer au client"}
        </Button>
        {!data.client.email ? (
          <span className="text-xs text-muted-foreground">Aucun email client renseigné.</span>
        ) : envoi?.envoyeLe ? (
          <span className="text-xs text-muted-foreground">
            Déjà envoyé le {dateFr(envoi.envoyeLe)}.
          </span>
        ) : null}
      </div>
    </form>
  );
}

function DeltaBadge({ delta, nouveau }: { delta: number | null; nouveau: boolean }) {
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

function EditableBloc({
  title,
  name,
  value,
  onChange,
  placeholder,
}: {
  title: string;
  name: string;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
}) {
  return (
    <div>
      <h2 className="mb-2 text-sm font-medium uppercase tracking-wider text-muted-foreground">
        {title}
      </h2>
      <p className="hidden whitespace-pre-wrap text-sm leading-relaxed print:block">{value}</p>
      <Textarea
        name={name}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="print-hide min-h-[90px] text-sm leading-relaxed"
      />
    </div>
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
