import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { prisma } from "@/lib/db";
import { RapportReadonly } from "@/components/rapport/rapport-readonly";
import { getRapportData } from "@/lib/rapport";
import { currentPeriode, isPeriode, periodeLabel } from "@/lib/periode";

export const dynamic = "force-dynamic";

// Espace client : rapport mensuel en lecture seule. Cible du lien envoyé par email.
// Un rapport n'est visible que s'il a été ENVOYÉ (statut = envoye).
export default async function PortailRapportPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ periode?: string }>;
}) {
  const { token } = await params;
  const sp = await searchParams;
  const periode = sp.periode && isPeriode(sp.periode) ? sp.periode : currentPeriode();

  const client = await prisma.client.findFirst({
    where: { portailToken: token, portailActif: true },
    select: { id: true, nom: true },
  });
  if (!client) notFound();

  const rapport = await prisma.rapportMensuel.findUnique({
    where: { clientId_periode: { clientId: client.id, periode } },
    select: { statut: true },
  });
  if (!rapport || rapport.statut !== "envoye") notFound();

  const data = await getRapportData(client.id, periode);
  if (!data) notFound();

  return (
    <div className="min-h-screen bg-muted/30">
      <header className="border-b bg-background">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-brand">Relmo</p>
            <h1 className="text-lg font-semibold capitalize">
              Rapport · {periodeLabel(periode)}
            </h1>
          </div>
          <Link
            href={`/portail/${token}`}
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:underline"
          >
            <ArrowLeft className="size-4" /> Mon espace
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-8">
        <div className="rounded-2xl border bg-background p-6 sm:p-8">
          <div className="mb-5 border-b pb-4">
            <h2 className="text-xl font-semibold">{client.nom}</h2>
            <p className="capitalize text-muted-foreground">{periodeLabel(periode)}</p>
          </div>
          <RapportReadonly data={data} />
        </div>
      </main>
    </div>
  );
}
