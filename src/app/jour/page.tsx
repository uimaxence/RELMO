import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { prisma } from "@/lib/db";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { TacheItem } from "@/components/taches/tache-item";
import {
  GenerateTachesButton,
  AddTacheForm,
} from "@/components/taches/tache-toolbar";
import {
  todayKey,
  shiftDay,
  dayLabel,
  isDayKey,
  ensureTachesDuJour,
} from "@/lib/taches";

export const dynamic = "force-dynamic";

const PRIO: Record<string, number> = { haute: 0, normale: 1, basse: 2 };

export default async function JourPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  const sp = await searchParams;
  const date = sp.date && isDayKey(sp.date) ? sp.date : todayKey();

  // Première visite du jour : on amorce la to-do.
  await ensureTachesDuJour(date);

  const taches = await prisma.tache.findMany({ where: { date } });
  taches.sort((a, b) => {
    const fa = a.statut === "fait" ? 1 : 0;
    const fb = b.statut === "fait" ? 1 : 0;
    if (fa !== fb) return fa - fb; // faites en bas
    const pa = PRIO[a.priorite] ?? 1;
    const pb = PRIO[b.priorite] ?? 1;
    if (pa !== pb) return pa - pb; // priorité haute en haut
    return a.createdAt.getTime() - b.createdAt.getTime();
  });

  const faits = taches.filter((t) => t.statut === "fait").length;
  const total = taches.length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="To-do du jour"
        description="Ce qu'il faut faire aujourd'hui pour livrer, relancer et avancer vers l'objectif."
      >
        <GenerateTachesButton date={date} />
      </PageHeader>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Button asChild variant="outline" size="icon" aria-label="Jour précédent">
            <Link href={`/jour?date=${shiftDay(date, -1)}`}>
              <ChevronLeft />
            </Link>
          </Button>
          <span className="min-w-[200px] text-center font-medium capitalize">
            {dayLabel(date)}
          </span>
          <Button asChild variant="outline" size="icon" aria-label="Jour suivant">
            <Link href={`/jour?date=${shiftDay(date, 1)}`}>
              <ChevronRight />
            </Link>
          </Button>
          {date !== todayKey() ? (
            <Button asChild variant="ghost" size="sm">
              <Link href="/jour">Aujourd&apos;hui</Link>
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

      <Card>
        {taches.length === 0 ? (
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            Rien pour ce jour. Ajoute une tâche ou régénère depuis le réel.
          </CardContent>
        ) : (
          <ul className="divide-y">
            {taches.map((t) => (
              <TacheItem key={t.id} tache={t} />
            ))}
          </ul>
        )}
      </Card>

      <AddTacheForm date={date} />
    </div>
  );
}
