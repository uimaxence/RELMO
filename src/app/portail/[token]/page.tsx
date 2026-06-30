import { notFound } from "next/navigation";
import { Globe, Images, Check, FileText, FileSignature } from "lucide-react";

import { prisma } from "@/lib/db";
import { totalStockage } from "@/app/actions/photos";
import { PortailUpload } from "@/components/portail/portail-upload";
import {
  PortailGallery,
  type GalleryGroup,
} from "@/components/portail/portail-gallery";
import { AccepterDevisButton } from "@/components/portail/accepter-devis-button";
import { Badge } from "@/components/ui/badge";
import { currentPeriode, periodeLabel } from "@/lib/periode";
import { euros, dateFr } from "@/lib/format";
import { labelOf, FACTURE_STATUTS } from "@/lib/constants";

export const dynamic = "force-dynamic";

export default async function PortailPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const periode = currentPeriode();
  const now = new Date();

  const client = await prisma.client.findFirst({
    where: { portailToken: token, portailActif: true },
    include: {
      sites: {
        where: { statut: { not: "archive" } },
        orderBy: { nom: "asc" },
        include: {
          contrats: {
            include: {
              engagements: {
                include: {
                  livrables: { where: { periode, visibleClient: true } },
                },
              },
            },
          },
        },
      },
      photos: { orderBy: { createdAt: "desc" } },
      factures: { orderBy: { dateEmission: "desc" } },
      devis: {
        where: { statut: { in: ["envoye", "en_nego"] } },
        include: { contrat: { select: { id: true } } },
      },
    },
  });

  if (!client) notFound();

  const used = await totalStockage();

  // Abonnement mensuel (contrats actifs démarrés).
  const mrr = client.sites
    .flatMap((s) => s.contrats)
    .filter((ct) => ct.statut === "actif" && ct.dateDebut <= now)
    .reduce((s, ct) => s + ct.montantMensuel, 0);

  // Récap vendu vs livré du mois (livrables visibles client).
  const recap = client.sites
    .map((site) => ({
      nom: site.nom,
      engagements: site.contrats
        .flatMap((ct) => ct.engagements)
        .map((e) => ({
          libelle: e.libelle,
          vendu: e.livrables.length,
          livre: e.livrables.filter((l) => l.statut === "fait").length,
        }))
        .filter((e) => e.vendu > 0),
    }))
    .filter((s) => s.engagements.length > 0);

  const devisEnAttente = client.devis.filter((d) => !d.contrat);

  // Photos groupées par mois.
  const byDossier = new Map<string, GalleryGroup["photos"]>();
  for (const p of client.photos) {
    const arr = byDossier.get(p.dossier) ?? [];
    arr.push({ id: p.id, url: p.url, nom: p.nom });
    byDossier.set(p.dossier, arr);
  }
  const groups: GalleryGroup[] = [...byDossier.entries()]
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([dossier, photos]) => ({ dossier, label: periodeLabel(dossier), photos }));

  return (
    <div className="min-h-screen bg-muted/30">
      <header className="border-b bg-background">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-brand">
              Relmo
            </p>
            <h1 className="text-lg font-semibold">Espace de {client.nom}</h1>
          </div>
          <span className="inline-flex items-center gap-1.5 text-sm text-muted-foreground">
            <Images className="size-4" /> {client.photos.length} photo
            {client.photos.length > 1 ? "s" : ""}
          </span>
        </div>
      </header>

      <main className="mx-auto max-w-5xl space-y-8 px-4 py-8">
        {client.sites.length > 0 ? (
          <section className="flex flex-wrap gap-x-6 gap-y-1 text-sm text-muted-foreground">
            {client.sites.map((s) => (
              <span key={s.id} className="inline-flex items-center gap-1.5">
                <Globe className="size-3.5" />
                {s.url ? (
                  <a href={s.url} target="_blank" rel="noreferrer" className="hover:underline">
                    {s.nom}
                  </a>
                ) : (
                  s.nom
                )}
              </span>
            ))}
          </section>
        ) : null}

        {/* Devis en attente d'acceptation */}
        {devisEnAttente.length > 0 ? (
          <section className="rounded-2xl border bg-background p-5">
            <h2 className="mb-1 flex items-center gap-2 text-base font-semibold">
              <FileSignature className="size-4 text-brand" /> Proposition
              {devisEnAttente.length > 1 ? "s" : ""} en attente
            </h2>
            <p className="mb-4 text-sm text-muted-foreground">
              Validez en un clic — votre prestation démarre aussitôt.
            </p>
            <ul className="space-y-3">
              {devisEnAttente.map((d) => (
                <li
                  key={d.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-xl border p-3"
                >
                  <div className="min-w-0">
                    <p className="font-medium">{d.libelle}</p>
                    <p className="font-mono text-sm tabular-nums text-muted-foreground">
                      {euros(d.montantMensuelPropose)}/mois
                      {d.montantCreation > 0
                        ? ` · ${euros(d.montantCreation)} à la création`
                        : ""}
                    </p>
                  </div>
                  <AccepterDevisButton token={token} devisId={d.id} />
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {/* Abonnement & livré ce mois */}
        {mrr > 0 || recap.length > 0 ? (
          <section className="rounded-2xl border bg-background p-5">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-base font-semibold capitalize">
                Votre suivi · {periodeLabel(periode)}
              </h2>
              {mrr > 0 ? (
                <span className="font-mono text-sm tabular-nums text-muted-foreground">
                  Abonnement {euros(mrr)}/mois
                </span>
              ) : null}
            </div>
            {recap.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Le détail des prestations du mois s&apos;affichera ici.
              </p>
            ) : (
              <div className="space-y-4">
                {recap.map((site) => (
                  <div key={site.nom}>
                    <h3 className="mb-1 text-sm font-medium">{site.nom}</h3>
                    <ul className="space-y-1">
                      {site.engagements.map((e, i) => {
                        const done = e.livre >= e.vendu;
                        return (
                          <li
                            key={i}
                            className="flex items-center justify-between gap-2 text-sm"
                          >
                            <span className="inline-flex items-center gap-2 text-muted-foreground">
                              <Check
                                className={`size-3.5 ${done ? "text-positive" : "text-muted-foreground/40"}`}
                              />
                              {e.libelle}
                            </span>
                            <span className="font-mono tabular-nums text-muted-foreground">
                              {e.livre}/{e.vendu}
                            </span>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                ))}
              </div>
            )}
          </section>
        ) : null}

        {/* Factures */}
        {client.factures.length > 0 ? (
          <section className="rounded-2xl border bg-background p-5">
            <h2 className="mb-4 flex items-center gap-2 text-base font-semibold">
              <FileText className="size-4 text-brand" /> Factures
            </h2>
            <ul className="divide-y">
              {client.factures.map((f) => (
                <li key={f.id} className="flex items-center justify-between gap-3 py-2.5">
                  <div className="min-w-0">
                    <p className="text-sm font-medium">
                      {f.numero}{" "}
                      <span className="font-normal text-muted-foreground">· {f.periode}</span>
                    </p>
                    <p className="font-mono text-xs tabular-nums text-muted-foreground">
                      {euros(f.montant)}
                      {f.dateEcheance ? ` · échéance ${dateFr(f.dateEcheance)}` : ""}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <Badge variant={f.statut === "payee" ? "secondary" : "outline"}>
                      {labelOf(FACTURE_STATUTS, f.statut)}
                    </Badge>
                    {f.pdfUrl ? (
                      <a
                        href={f.pdfUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-sm text-brand hover:underline"
                      >
                        PDF
                      </a>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {/* Dépôt photos */}
        <section className="rounded-2xl border bg-background p-5">
          <h2 className="mb-1 text-base font-semibold">Déposer des photos</h2>
          <p className="mb-4 text-sm text-muted-foreground">
            Partagez vos visuels (logo, photos de vos produits, de votre équipe…).
            Ils sont rangés automatiquement par mois.
          </p>
          <PortailUpload token={token} used={used} />
        </section>

        <section>
          <PortailGallery token={token} groups={groups} />
        </section>
      </main>
    </div>
  );
}
