"use client";

import { useTransition } from "react";
import { Check, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { setTacheStatut, deleteTache } from "@/app/actions/taches";

const TYPE_LABEL: Record<string, string> = {
  livrable: "Livrable",
  relance_devis: "Relance",
  prospection: "Prospection",
  technique: "Technique",
  autre: "",
};

type Tache = {
  id: string;
  libelle: string;
  type: string;
  priorite: string;
  statut: string;
};

export function TacheItem({ tache }: { tache: Tache }) {
  const [pending, startTransition] = useTransition();
  const fait = tache.statut === "fait";

  function toggle() {
    startTransition(async () => {
      await setTacheStatut(tache.id, fait ? "a_faire" : "fait");
    });
  }

  return (
    <li className="flex items-center gap-3 px-4 py-2.5">
      <button
        type="button"
        onClick={toggle}
        disabled={pending}
        aria-label={fait ? "Marquer à faire" : "Marquer fait"}
        className={cn(
          "flex size-5 shrink-0 items-center justify-center rounded-md border transition-colors",
          fait
            ? "border-foreground bg-foreground text-background"
            : "border-border-strong hover:border-foreground",
        )}
      >
        {fait ? <Check className="size-3.5" /> : null}
      </button>

      <div className="min-w-0 flex-1">
        <span
          className={cn(
            "text-sm",
            fait && "text-muted-foreground line-through",
          )}
        >
          {tache.libelle}
        </span>
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          {tache.priorite === "haute" ? (
            <span className="size-1.5 rounded-full bg-negative" />
          ) : null}
          {TYPE_LABEL[tache.type] ? <span>{TYPE_LABEL[tache.type]}</span> : null}
        </div>
      </div>

      <Button
        variant="ghost"
        size="icon"
        aria-label="Supprimer la tâche"
        disabled={pending}
        onClick={() => startTransition(async () => void deleteTache(tache.id))}
      >
        <X className="text-muted-foreground" />
      </Button>
    </li>
  );
}
