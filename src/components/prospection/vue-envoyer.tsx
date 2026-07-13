import { Send } from "lucide-react";

import { prisma } from "@/lib/db";
import { SmtpStatus } from "@/components/prospection/smtp-status";
import { ReglageCampagneForm } from "@/components/prospection/reglage-campagne-form";
import { CampagneRunner, type CampagneRow } from "@/components/prospection/campagne-runner";
import { smtpConfigured } from "@/app/actions/prospection";
import { ensureReglage } from "@/lib/wishlist";
import { CAMPAGNE_DELAI_SEC, CAMPAGNE_PLAFOND } from "@/lib/constants";

// Vue « Envoyer » : la file d'envoi (prospects « à contacter » avec accroche prête),
// le garde-fou de volume quotidien et les réglages de campagne.
export async function VueEnvoyer() {
  const now = new Date();
  const startJourUTC = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );
  const [reglage, prospects, premiersContactsAuj, relancesAuj] = await Promise.all([
    ensureReglage(),
    prisma.prospect.findMany({
      where: {
        statut: "a_contacter",
        statutAudit: { in: ["ok", "aucun_site"] },
        accrocheEmail: { not: null },
        flagConcurrent: false,
        flagAQualifier: false,
      },
      orderBy: [{ score: "desc" }, { createdAt: "desc" }],
      take: 300,
    }),
    prisma.prospect.count({ where: { contacteLe: { gte: startJourUTC } } }),
    prisma.prospect.count({ where: { relanceFaiteLe: { gte: startJourUTC } } }),
  ]);
  const envoisAuj = premiersContactsAuj + relancesAuj;

  const configured = smtpConfigured();
  const expediteur = process.env.SMTP_FROM || process.env.SMTP_USER || "ta boîte mail";

  const rows: CampagneRow[] = prospects.map((p) => ({
    id: p.id,
    nom: p.nom,
    meta: [p.activite, p.ville].filter(Boolean).join(" · ") || "—",
    email: p.email ?? "",
    accroche: p.accrocheEmail ?? "",
  }));

  return (
    <div className="space-y-5">
      {/* Garde-fou Gmail perso : rester sous ~30 envois/jour pour la délivrabilité. */}
      <div
        className={`flex flex-wrap items-center gap-2 rounded-xl border px-4 py-3 text-sm ${
          envoisAuj >= 30 ? "border-warning-ink/30 bg-warning-bg text-warning-ink" : "bg-muted"
        }`}
      >
        <Send className="size-4 shrink-0" />
        <span>
          <span className="font-mono font-medium tabular-nums">{envoisAuj}</span> mail
          {envoisAuj > 1 ? "s" : ""} envoyé{envoisAuj > 1 ? "s" : ""} aujourd&apos;hui (
          {premiersContactsAuj} 1ers contacts · {relancesAuj} relances)
          {envoisAuj >= 30
            ? " — prudence, tu montes haut pour un Gmail perso."
            : " — reste sous ~30/jour pour préserver ta délivrabilité."}
        </span>
      </div>

      <SmtpStatus configured={configured} expediteur={expediteur} />
      <ReglageCampagneForm
        signatureEmail={reglage.signatureEmail}
        optOutTexte={reglage.optOutTexte}
        lienRealisation={reglage.lienRealisation}
        modeleRemu={reglage.modeleRemu}
        relanceAutoActive={reglage.relanceAutoActive}
        prospectionAutoActive={reglage.prospectionAutoActive}
      />

      {!reglage.lienRealisation ? (
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Send className="size-3.5" /> Astuce : renseigne un « lien de réalisation » ci-dessus pour
          remplir automatiquement le placeholder dans chaque mail.
        </p>
      ) : null}

      <CampagneRunner
        prospects={rows}
        configured={configured}
        delaiSec={CAMPAGNE_DELAI_SEC}
        plafond={CAMPAGNE_PLAFOND}
        expediteur={expediteur}
      />
    </div>
  );
}
