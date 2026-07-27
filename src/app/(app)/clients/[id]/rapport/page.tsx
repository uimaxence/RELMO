import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import { PrintButton } from "@/components/rapport/print-button";
import { RapportView } from "@/components/rapport/rapport-view";
import { dateFr } from "@/lib/format";
import { getRapportData } from "@/lib/rapport";
import { currentPeriode, isPeriode, periodeLabel, shiftPeriode } from "@/lib/periode";

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

  const data = await getRapportData(id, periode);
  if (!data) notFound();

  return (
    <div className="space-y-4">
      {/* Barre de contrôle — non imprimée. */}
      <div className="print-hide flex flex-wrap items-center justify-between gap-3">
        <Link
          href={`/clients/${data.client.id}`}
          className="text-sm text-muted-foreground hover:underline"
        >
          ← {data.client.nom}
        </Link>
        <div className="flex items-center gap-2">
          <Button asChild variant="outline" size="icon" aria-label="Mois précédent">
            <Link href={`/clients/${data.client.id}/rapport?periode=${shiftPeriode(periode, -1)}`}>
              <ChevronLeft />
            </Link>
          </Button>
          <span className="min-w-[140px] text-center text-sm font-medium capitalize">
            {periodeLabel(periode)}
          </span>
          <Button asChild variant="outline" size="icon" aria-label="Mois suivant">
            <Link href={`/clients/${data.client.id}/rapport?periode=${shiftPeriode(periode, 1)}`}>
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
            <p className="text-xs font-semibold uppercase tracking-widest text-brand">Relmo</p>
            <h1 className="mt-1 text-2xl font-semibold">Rapport mensuel</h1>
            <p className="mt-1 capitalize text-muted-foreground">
              {data.client.nom} · {periodeLabel(periode)}
            </p>
          </div>
          <p className="text-right text-xs text-muted-foreground">Édité le {dateFr(now)}</p>
        </header>

        <div className="pt-5">
          <RapportView data={data} />
        </div>

        <footer className="mt-8 border-t pt-4 text-xs text-muted-foreground">
          Rapport de suivi mensuel. Pour toute question, répondez simplement à ce message.
        </footer>
      </div>
    </div>
  );
}
