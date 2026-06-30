import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { prisma } from "@/lib/db";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Kanban, type KanbanCard } from "@/components/taches/kanban";
import {
  GenerateTachesButton,
  AddTacheForm,
} from "@/components/taches/tache-toolbar";
import { AiGenerateDialog } from "@/components/ai/ai-generate-dialog";
import { SuggestionsIA } from "@/components/taches/suggestions-ia";
import { actionAccrochesProspection } from "@/app/actions/ai";
import {
  currentWeek,
  shiftWeek,
  weekLabel,
  isWeekKey,
} from "@/lib/semaine";
import { ensureTachesSemaine } from "@/lib/taches";

export const dynamic = "force-dynamic";

export default async function SemainePage({
  searchParams,
}: {
  searchParams: Promise<{ s?: string }>;
}) {
  const sp = await searchParams;
  const semaine = sp.s && isWeekKey(sp.s) ? sp.s : currentWeek();

  // Première visite de la semaine : on amorce la to-do.
  await ensureTachesSemaine(semaine);

  const [taches, clients] = await Promise.all([
    prisma.tache.findMany({ where: { semaine } }),
    prisma.client.findMany({
      orderBy: { nom: "asc" },
      select: { id: true, nom: true },
    }),
  ]);
  const clientsById = new Map(clients.map((c) => [c.id, c]));

  const cards: KanbanCard[] = taches
    .sort((a, b) => {
      const prio: Record<string, number> = { haute: 0, normale: 1, basse: 2 };
      const pa = prio[a.priorite] ?? 1;
      const pb = prio[b.priorite] ?? 1;
      if (pa !== pb) return pa - pb;
      return a.createdAt.getTime() - b.createdAt.getTime();
    })
    .map((t) => ({
      tache: {
        id: t.id,
        libelle: t.libelle,
        note: t.note,
        type: t.type,
        priorite: t.priorite,
        statut: t.statut,
        refType: t.refType,
      },
      client:
        t.refType === "client" && t.refId
          ? clientsById.get(t.refId) ?? null
          : null,
    }));

  const faits = taches.filter((t) => t.statut === "fait").length;
  const total = taches.length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="To-do de la semaine"
        description="Ce qu'il faut livrer, relancer et avancer cette semaine. Glisse les cartes, clique pour éditer."
      >
        <SuggestionsIA semaine={semaine} />
        <AiGenerateDialog
          action={actionAccrochesProspection}
          title="Accroches de prospection"
          description="Plan de prospection calibré sur ton écart à l'objectif MRR."
          providerLabel="DeepSeek"
        />
        <GenerateTachesButton semaine={semaine} />
      </PageHeader>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Button asChild variant="outline" size="icon" aria-label="Semaine précédente">
            <Link href={`/semaine?s=${shiftWeek(semaine, -1)}`}>
              <ChevronLeft />
            </Link>
          </Button>
          <span className="min-w-[230px] text-center font-medium capitalize">
            {weekLabel(semaine)}
          </span>
          <Button asChild variant="outline" size="icon" aria-label="Semaine suivante">
            <Link href={`/semaine?s=${shiftWeek(semaine, 1)}`}>
              <ChevronRight />
            </Link>
          </Button>
          {semaine !== currentWeek() ? (
            <Button asChild variant="ghost" size="sm">
              <Link href="/semaine">Cette semaine</Link>
            </Button>
          ) : null}
        </div>
        {total > 0 ? (
          <span className="text-sm text-muted-foreground">
            <span className="font-mono font-medium text-foreground tabular-nums">
              {faits}/{total}
            </span>{" "}
            fait{faits > 1 ? "s" : ""}
          </span>
        ) : null}
      </div>

      <Kanban cards={cards} />

      <AddTacheForm semaine={semaine} clients={clients} />
    </div>
  );
}
