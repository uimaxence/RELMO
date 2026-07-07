import Link from "next/link";
import { ArrowLeft, Send } from "lucide-react";

import { prisma } from "@/lib/db";
import { PageHeader } from "@/components/page-header";
import { SmtpStatus } from "@/components/prospection/smtp-status";
import { ReglageCampagneForm } from "@/components/prospection/reglage-campagne-form";
import {
  CampagneRunner,
  type CampagneRow,
} from "@/components/prospection/campagne-runner";
import { smtpConfigured } from "@/app/actions/prospection";
import { ensureReglage } from "@/lib/wishlist";
import { CAMPAGNE_DELAI_SEC, CAMPAGNE_PLAFOND } from "@/lib/constants";

export const dynamic = "force-dynamic";

export default async function CampagnePage() {
  const [reglage, prospects] = await Promise.all([
    ensureReglage(),
    // File d'envoi : prospects mis en file (statut « à contacter ») avec accroche
    // prête. Les fiches « concurrent » ou « à qualifier » n'y entrent JAMAIS.
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
  ]);

  const configured = smtpConfigured();
  const expediteur =
    process.env.SMTP_FROM || process.env.SMTP_USER || "ta boîte mail";

  const rows: CampagneRow[] = prospects.map((p) => ({
    id: p.id,
    nom: p.nom,
    meta: [p.activite, p.ville].filter(Boolean).join(" · ") || "—",
    email: p.email ?? "",
    accroche: p.accrocheEmail ?? "",
  }));

  return (
    <div className="space-y-5">
      <PageHeader
        title="File d'envoi"
        description="Les prospects mis en file d'envoi. Vérifie chaque message, puis envoie tout depuis ta boîte."
      >
        <Link
          href="/prospection/recherche"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" /> Recherche
        </Link>
      </PageHeader>

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
          <Send className="size-3.5" /> Astuce : renseigne un « lien de réalisation »
          ci-dessus pour remplir automatiquement le placeholder dans chaque mail.
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
