import { Users, Send, BellRing, Target, Flame } from "lucide-react";

import { prisma } from "@/lib/db";
import { KpiCard } from "@/components/dashboard/kpi-card";
import { RechercheToolbar } from "@/components/prospection/recherche-toolbar";
import { ProspectTable, type ProspectRow } from "@/components/prospection/prospect-table";
import { ExportProspectsButton } from "@/components/prospection/export-prospects-button";
import { placesConfigured } from "@/app/actions/prospection";
import { dateFr } from "@/lib/format";
import { PROSPECTION_OBJECTIF_MENSUEL, PROSPECTION_TAUX_REPONSE_MIN } from "@/lib/constants";

// Vue « Prospecter » : découverte + audit + pipeline froid (table des Prospects
// scrapés). Le bandeau mensuel « machine » (volume + taux de réponse) remplace
// l'ancien dashboard /prospection, désormais fusionné ici.
export async function VueProspecter() {
  const now = new Date();
  const debutMois = new Date(now.getFullYear(), now.getMonth(), 1);

  const [
    prospects,
    nbAAuditer,
    nbContactes,
    nbChauds,
    premiersContactsMois,
    relancesFaitesMois,
    contactesTotal,
    reponduTotal,
  ] = await Promise.all([
    prisma.prospect.findMany({
      orderBy: [{ statut: "asc" }, { score: "desc" }, { createdAt: "desc" }],
      take: 300,
    }),
    prisma.prospect.count({ where: { statutAudit: "a_auditer", statut: { not: "ecarte" } } }),
    prisma.prospect.count({ where: { statut: "contacte" } }),
    prisma.prospect.count({ where: { filtreTier: "chaud", statut: { notIn: ["ecarte", "converti"] } } }),
    prisma.prospect.count({ where: { contacteLe: { gte: debutMois } } }),
    prisma.prospect.count({ where: { relanceFaiteLe: { gte: debutMois } } }),
    prisma.prospect.count({ where: { contacteLe: { not: null } } }),
    prisma.prospect.count({ where: { reponduLe: { not: null } } }),
  ]);

  const relanceDue = (p: (typeof prospects)[number]) =>
    p.statut === "contacte" && !!p.relanceLe && p.relanceLe <= now;
  const nbRelancesDues = prospects.filter(relanceDue).length;

  const envoisMois = premiersContactsMois + relancesFaitesMois;
  const tauxReponse = contactesTotal > 0 ? Math.round((reponduTotal / contactesTotal) * 100) : null;
  const alerteReponse =
    contactesTotal >= 150 && tauxReponse !== null && tauxReponse < PROSPECTION_TAUX_REPONSE_MIN;

  // Tri : relances dues en tête, puis écartés en bas, puis meilleur score.
  const rows: ProspectRow[] = [...prospects]
    .sort((a, b) => {
      const rd = Number(relanceDue(b)) - Number(relanceDue(a));
      if (rd !== 0) return rd;
      const ec = Number(a.statut === "ecarte") - Number(b.statut === "ecarte");
      if (ec !== 0) return ec;
      return (b.score ?? -1) - (a.score ?? -1);
    })
    .map((p) => ({
      id: p.id,
      nom: p.nom,
      site: p.site,
      ville: p.ville,
      activite: p.activite,
      telephone: p.telephone,
      email: p.email,
      statutAudit: p.statutAudit,
      score: p.score,
      filtreTier: p.filtreTier,
      filtreTotal: p.filtreTotal,
      filtreBesoin: p.filtreBesoin,
      filtrePotentiel: p.filtrePotentiel,
      filtreProbleme: p.filtreProbleme,
      filtreCroissance: p.filtreCroissance,
      filtreAcces: p.filtreAcces,
      filtreTrace: p.filtreTrace,
      effectif: p.effectif,
      signauxCroissance: p.signauxCroissance,
      design: p.design,
      anciennete: p.anciennete,
      pointsFaibles: p.pointsFaibles,
      cible: p.cible,
      segment: p.segment,
      metier: p.metier,
      flagConcurrent: p.flagConcurrent,
      flagAQualifier: p.flagAQualifier,
      atouts: p.atouts,
      nbAvis: p.nbAvis,
      accrocheEmail: p.accrocheEmail,
      accrocheLinkedin: p.accrocheLinkedin,
      dirigeant: p.dirigeant,
      linkedin: p.linkedin,
      note: p.note,
      statut: p.statut,
      campagne: p.campagne,
      canalContact: p.canalContact,
      messageEnvoye: p.messageEnvoye,
      contacteLeFr: p.contacteLe ? dateFr(p.contacteLe) : null,
      relanceLeFr: p.relanceLe ? dateFr(p.relanceLe) : null,
      relanceDue: relanceDue(p),
      nbRelances: p.nbRelances,
      reponduLeFr: p.reponduLe ? dateFr(p.reponduLe) : null,
    }));

  const kpis = [
    { label: "Prospects", value: prospects.length, icon: Users, hint: "En base" },
    { label: "Prospects chauds", value: nbChauds, icon: Target, hint: "Filtre en or ≥ 7/8" },
    { label: "Contactés", value: nbContactes, icon: Send, hint: "Dans le pipeline" },
    { label: "Relances dues", value: nbRelancesDues, icon: BellRing, hint: "À relancer aujourd'hui" },
  ];

  return (
    <div className="space-y-5">
      <div className="flex justify-end">
        <ExportProspectsButton />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {kpis.map((k) => (
          <KpiCard key={k.label} label={k.label} value={k.value} hint={k.hint} icon={k.icon} />
        ))}
      </div>

      {/* Machine de prospection (brief §2) : volume + taux de réponse, ce mois. */}
      <div className="flex flex-wrap items-center gap-x-6 gap-y-1 rounded-lg bg-muted px-4 py-2.5 text-sm">
        <span className="text-muted-foreground">
          Envois ce mois{" "}
          <span className="font-mono font-medium text-foreground tabular-nums">
            {envoisMois} / {PROSPECTION_OBJECTIF_MENSUEL}
          </span>
        </span>
        <span className="text-muted-foreground">
          Taux de réponse{" "}
          <span className="font-mono font-medium text-foreground tabular-nums">
            {tauxReponse !== null ? `${tauxReponse}%` : "—"}
          </span>{" "}
          ({reponduTotal}/{contactesTotal})
        </span>
      </div>
      {alerteReponse ? (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-warning-ink/30 bg-warning-bg px-4 py-2.5 text-sm text-warning-ink">
          <Flame className="size-4 shrink-0" />
          <span>
            Taux de réponse sous {PROSPECTION_TAUX_REPONSE_MIN}% après {contactesTotal} envois, ajuste
            l&apos;accroche ou la cible sans abandonner le canal.
          </span>
        </div>
      ) : null}

      <RechercheToolbar placesActif={placesConfigured()} nbAAuditer={nbAAuditer} />

      <ProspectTable prospects={rows} />
    </div>
  );
}
