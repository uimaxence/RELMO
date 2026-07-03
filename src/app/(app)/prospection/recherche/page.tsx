import Link from "next/link";
import { ArrowLeft, Users, Send, BellRing, Target } from "lucide-react";

import { prisma } from "@/lib/db";
import { PageHeader } from "@/components/page-header";
import { KpiCard } from "@/components/dashboard/kpi-card";
import { RechercheToolbar } from "@/components/prospection/recherche-toolbar";
import { ProspectTable, type ProspectRow } from "@/components/prospection/prospect-table";
import { ExportProspectsButton } from "@/components/prospection/export-prospects-button";
import { placesConfigured } from "@/app/actions/prospection";
import { dateFr } from "@/lib/format";

export const dynamic = "force-dynamic";
// Collecte + audit DeepSeek de 15 prospects peut durer ~40 s : on relève le
// plafond des server actions de cette route. 60 s tient sur tous les plans Vercel ;
// si le délai est dépassé, les prospects sont déjà persistés (audit rattrapable
// via « Auditer les non-audités »).
export const maxDuration = 60;

export default async function RechercheProspectsPage() {
  const now = new Date();
  const [prospects, nbAAuditer, nbContactes, nbScore] = await Promise.all([
    prisma.prospect.findMany({
      orderBy: [{ statut: "asc" }, { score: "desc" }, { createdAt: "desc" }],
      take: 300,
    }),
    prisma.prospect.count({
      where: { statutAudit: "a_auditer", statut: { not: "ecarte" } },
    }),
    prisma.prospect.count({ where: { statut: "contacte" } }),
    prisma.prospect.count({ where: { score: { gte: 65 }, statut: { notIn: ["ecarte", "converti"] } } }),
  ]);

  const relanceDue = (p: (typeof prospects)[number]) =>
    p.statut === "contacte" && !!p.relanceLe && p.relanceLe <= now;

  const nbRelancesDues = prospects.filter(relanceDue).length;

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
      design: p.design,
      anciennete: p.anciennete,
      pointsFaibles: p.pointsFaibles,
      accrocheEmail: p.accrocheEmail,
      accrocheLinkedin: p.accrocheLinkedin,
      dirigeant: p.dirigeant,
      linkedin: p.linkedin,
      note: p.note,
      statut: p.statut,
      campagne: p.campagne,
      messageEnvoye: p.messageEnvoye,
      contacteLeFr: p.contacteLe ? dateFr(p.contacteLe) : null,
      relanceLeFr: p.relanceLe ? dateFr(p.relanceLe) : null,
      relanceDue: relanceDue(p),
      nbRelances: p.nbRelances,
      reponduLeFr: p.reponduLe ? dateFr(p.reponduLe) : null,
    }));

  const kpis = [
    { label: "Prospects", value: prospects.length, icon: Users, hint: "En base" },
    { label: "Score ≥ 65", value: nbScore, icon: Target, hint: "À attaquer en priorité" },
    { label: "Contactés", value: nbContactes, icon: Send, hint: "Dans le pipeline" },
    {
      label: "Relances dues",
      value: nbRelancesDues,
      icon: BellRing,
      hint: "À relancer aujourd'hui",
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Recherche de prospects"
        description="Trouver, auditer et scorer des entreprises locales à démarcher, puis les convertir en clients."
      >
        <ExportProspectsButton />
        <Link
          href="/prospection"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" /> Prospection
        </Link>
      </PageHeader>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {kpis.map((k) => (
          <KpiCard key={k.label} label={k.label} value={k.value} hint={k.hint} icon={k.icon} />
        ))}
      </div>

      <RechercheToolbar placesActif={placesConfigured()} nbAAuditer={nbAAuditer} />

      <ProspectTable prospects={rows} />
    </div>
  );
}
