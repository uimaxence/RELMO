"use client";

import { useState, useTransition } from "react";

import { cn } from "@/lib/utils";
import { setTacheStatut } from "@/app/actions/taches";
import { TacheCard, type TacheCardData } from "@/components/taches/tache-card";
import type { ClientRef } from "@/components/taches/mention";

export type KanbanCard = { tache: TacheCardData; client: ClientRef | null };

const COLUMNS = [
  { key: "a_faire", label: "À faire" },
  { key: "en_cours", label: "En cours" },
  { key: "fait", label: "Fait" },
] as const;

// Statut « reporté » rangé avec « à faire ».
function bucket(statut: string): string {
  return statut === "en_cours" || statut === "fait" ? statut : "a_faire";
}

export function Kanban({ cards }: { cards: KanbanCard[] }) {
  const [pending, startTransition] = useTransition();
  const [over, setOver] = useState<string | null>(null);

  function drop(col: string) {
    return (e: React.DragEvent) => {
      e.preventDefault();
      setOver(null);
      const id = e.dataTransfer.getData("text/plain");
      if (!id) return;
      const card = cards.find((c) => c.tache.id === id);
      if (!card || bucket(card.tache.statut) === col) return;
      startTransition(() => setTacheStatut(id, col).then(() => {}));
    };
  }

  return (
    <div className="grid gap-4 md:grid-cols-3">
      {COLUMNS.map((col) => {
        const colCards = cards.filter((c) => bucket(c.tache.statut) === col.key);
        return (
          <div
            key={col.key}
            onDragOver={(e) => {
              e.preventDefault();
              setOver(col.key);
            }}
            onDragLeave={() => setOver((o) => (o === col.key ? null : o))}
            onDrop={drop(col.key)}
            className={cn(
              "flex flex-col gap-2 rounded-xl border bg-muted/40 p-2.5 transition-colors",
              over === col.key && "border-brand bg-brand/5",
              pending && "opacity-90",
            )}
          >
            <div className="flex items-center justify-between px-1 pb-1">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {col.label}
              </span>
              <span className="font-mono text-xs tabular-nums text-muted-foreground">
                {colCards.length}
              </span>
            </div>

            {colCards.length === 0 ? (
              <p className="rounded-lg border border-dashed py-6 text-center text-xs text-muted-foreground">
                Déposer ici
              </p>
            ) : (
              colCards.map((c) => (
                <TacheCard key={c.tache.id} tache={c.tache} client={c.client} />
              ))
            )}
          </div>
        );
      })}
    </div>
  );
}
