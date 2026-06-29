"use client";

import { useState, useTransition } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  useDraggable,
  useDroppable,
  type DragStartEvent,
  type DragEndEvent,
} from "@dnd-kit/core";

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

function DraggableCard({ card }: { card: KanbanCard }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({ id: card.tache.id });
  const style = transform
    ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` }
    : undefined;
  return (
    <div ref={setNodeRef} style={style} className={isDragging ? "opacity-40" : ""}>
      <TacheCard
        tache={card.tache}
        client={card.client}
        handleProps={{ ...attributes, ...listeners }}
      />
    </div>
  );
}

function Column({
  col,
  cards,
}: {
  col: { key: string; label: string };
  cards: KanbanCard[];
}) {
  const { setNodeRef, isOver } = useDroppable({ id: col.key });
  return (
    <div
      ref={setNodeRef}
      className={cn(
        "flex flex-col gap-2 rounded-xl border bg-muted/40 p-2.5 transition-colors",
        isOver && "border-brand bg-brand/5",
      )}
    >
      <div className="flex items-center justify-between px-1 pb-1">
        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          {col.label}
        </span>
        <span className="font-mono text-xs tabular-nums text-muted-foreground">
          {cards.length}
        </span>
      </div>
      {cards.length === 0 ? (
        <p className="rounded-lg border border-dashed py-6 text-center text-xs text-muted-foreground">
          Déposer ici
        </p>
      ) : (
        cards.map((c) => <DraggableCard key={c.tache.id} card={c} />)
      )}
    </div>
  );
}

export function Kanban({ cards }: { cards: KanbanCard[] }) {
  const [, startTransition] = useTransition();
  const [items, setItems] = useState(cards);
  const [activeId, setActiveId] = useState<string | null>(null);

  // Resync quand le serveur renvoie de nouvelles données (après revalidate) —
  // « ajuster l'état pendant le rendu » plutôt qu'un effet. La signature ne
  // change que sur une vraie modif serveur (statut, libellé…), pas à chaque
  // rendu, donc le déplacement optimiste tient jusqu'à confirmation.
  const signature = JSON.stringify(
    cards.map((c) => [
      c.tache.id,
      c.tache.statut,
      c.tache.libelle,
      c.tache.priorite,
      c.tache.type,
      c.tache.note,
    ]),
  );
  const [prevSig, setPrevSig] = useState(signature);
  if (signature !== prevSig) {
    setPrevSig(signature);
    setItems(cards);
  }

  // Petite distance avant de déclencher le drag → le clic (édition) reste fluide.
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  );

  function onDragStart(e: DragStartEvent) {
    setActiveId(String(e.active.id));
  }

  function onDragEnd(e: DragEndEvent) {
    setActiveId(null);
    const id = String(e.active.id);
    const col = e.over ? String(e.over.id) : null;
    if (!col) return;
    const card = items.find((c) => c.tache.id === id);
    if (!card || bucket(card.tache.statut) === col) return;

    // Optimiste : on déplace tout de suite, le serveur confirmera.
    setItems((prev) =>
      prev.map((c) =>
        c.tache.id === id ? { ...c, tache: { ...c.tache, statut: col } } : c,
      ),
    );
    startTransition(() => setTacheStatut(id, col).then(() => {}));
  }

  const active = activeId
    ? items.find((c) => c.tache.id === activeId) ?? null
    : null;

  return (
    <DndContext
      sensors={sensors}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onDragCancel={() => setActiveId(null)}
    >
      <div className="grid gap-4 md:grid-cols-3">
        {COLUMNS.map((col) => (
          <Column
            key={col.key}
            col={col}
            cards={items.filter((c) => bucket(c.tache.statut) === col.key)}
          />
        ))}
      </div>
      <DragOverlay>
        {active ? (
          <div className="rotate-1 cursor-grabbing">
            <TacheCard tache={active.tache} client={active.client} />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
