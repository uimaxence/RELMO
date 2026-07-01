import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, ChevronRight, Check } from "lucide-react";

import { prisma } from "@/lib/db";
import { Button } from "@/components/ui/button";
import { PrintButton } from "@/components/rapport/print-button";
import { RapportIntro } from "@/components/rapport/rapport-intro";
import { euros, dateFr } from "@/lib/format";
import {
  currentPeriode,
  isPeriode,
  periodeLabel,
  shiftPeriode,
} from "@/lib/periode";

export const dynamic = "force-dynamic";

export default async function RapportPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ periode?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const periode = sp.periode && isPeriode(sp.periode) ? sp.periode : currentPeriode();
  const now = new Date();

  const client = await prisma.client.findUnique({
    where: { id },
    include: {
      sites: {
        orderBy: { nom: "asc" },
        include: {
          contrats: {
            include: {
              engagements: {
                include: { livrables: { where: { periode } } },
              },
            },
          },
        },
      },
    },
  });

  if (!client) notFound();

  const mrr = client.sites
    .flatMap((s) => s.contrats)
    .filter((ct) => ct.statut === "actif" && ct.dateDebut <= now && ct.facturationDemarree)
    .reduce((s, ct) => s + ct.montantMensuel, 0);

  // Construit, par site, la liste vendu/livré du mois.
  const sites = client.sites
    .map((site) => {
      const engagements = site.contrats
        .flatMap((ct) => ct.engagements)
        .map((e) => ({
          libelle: e.libelle,
          vendu: e.livrables.length,
          livre: e.livrables.filter((l) => l.statut === "fait").length,
          items: e.livrables
            .filter((l) => l.statut === "fait")
            .map((l) => ({ libelle: l.libelle, faitLe: l.faitLe })),
        }))
        .filter((e) => e.vendu > 0);
      return { nom: site.nom, engagements };
    })
    .filter((s) => s.engagements.length > 0);

  const totalVendu = sites.reduce(
    (s, si) => s + si.engagements.reduce((a, e) => a + e.vendu, 0),
    0,
  );
  const totalLivre = sites.reduce(
    (s, si) => s + si.engagements.reduce((a, e) => a + e.livre, 0),
    0,
  );
  const livres = sites.flatMap((s) =>
    s.engagements.flatMap((e) => e.items.map((i) => i.libelle)),
  );

  return (
    <div className="space-y-4">
      {/* Barre de contrôle — non imprimée. */}
      <div className="print-hide flex flex-wrap items-center justify-between gap-3">
        <Link
          href={`/clients/${client.id}`}
          className="text-sm text-muted-foreground hover:underline"
        >
          ← {client.nom}
        </Link>
        <div className="flex items-center gap-2">
          <Button asChild variant="outline" size="icon" aria-label="Mois précédent">
            <Link href={`/clients/${client.id}/rapport?periode=${shiftPeriode(periode, -1)}`}>
              <ChevronLeft />
            </Link>
          </Button>
          <span className="min-w-[140px] text-center text-sm font-medium capitalize">
            {periodeLabel(periode)}
          </span>
          <Button asChild variant="outline" size="icon" aria-label="Mois suivant">
            <Link href={`/clients/${client.id}/rapport?periode=${shiftPeriode(periode, 1)}`}>
              <ChevronRight />
            </Link>
          </Button>
          <PrintButton />
        </div>
      </div>

      {/* Le rapport. */}
      <div className="mx-auto max-w-3xl rounded-xl border bg-card p-8 print:max-w-none print:rounded-none print:border-0 print:p-0">
        <header className="flex items-start justify-between border-b pb-5">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-brand">
              Relmo
            </p>
            <h1 className="mt-1 text-2xl font-semibold">Rapport mensuel</h1>
            <p className="mt-1 capitalize text-muted-foreground">
              {client.nom} · {periodeLabel(periode)}
            </p>
          </div>
          <p className="text-right text-xs text-muted-foreground">
            Édité le {dateFr(now)}
          </p>
        </header>

        <section className="py-5">
          <RapportIntro clientId={client.id} periode={periode} livres={livres} />
        </section>

        <section className="grid grid-cols-3 gap-4 border-y py-5">
          <Stat label="Abonnement" value={`${euros(mrr)}/mois`} />
          <Stat label="Livrables réalisés" value={`${totalLivre}/${totalVendu}`} />
          <Stat
            label="Taux de réalisation"
            value={totalVendu > 0 ? `${Math.round((totalLivre / totalVendu) * 100)}%` : "—"}
          />
        </section>

        <section className="space-y-6 pt-5">
          {sites.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Aucun livrable prévu sur cette période.
            </p>
          ) : (
            sites.map((site) => (
              <div key={site.nom}>
                <h2 className="mb-2 text-base font-semibold">{site.nom}</h2>
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
                              {it.faitLe ? (
                                <span className="text-xs">· {dateFr(it.faitLe)}</span>
                              ) : null}
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

        <footer className="mt-8 border-t pt-4 text-xs text-muted-foreground">
          Rapport généré automatiquement — récapitulatif du travail livré sur la
          période. Pour toute question, répondez simplement à ce message.
        </footer>
      </div>
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
