"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Sparkles, RefreshCw, Plus, Check } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { labelOf, TACHE_TYPES } from "@/lib/constants";
import { actionSuggererTaches } from "@/app/actions/ai";
import { ajouterTacheSuggeree } from "@/app/actions/taches";
import type { TacheSuggeree } from "@/lib/ai/assistant";

export function SuggestionsIA({ semaine }: { semaine: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [taches, setTaches] = useState<TacheSuggeree[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [added, setAdded] = useState<Set<number>>(new Set());

  async function generate() {
    setPending(true);
    setError(null);
    setAdded(new Set());
    const res = await actionSuggererTaches();
    setPending(false);
    if (res.ok) setTaches(res.taches);
    else setError(res.error);
  }

  function onOpenChange(next: boolean) {
    setOpen(next);
    if (next && taches.length === 0 && !pending) void generate();
    if (!next) {
      setTaches([]);
      setError(null);
      setAdded(new Set());
    }
  }

  async function add(t: TacheSuggeree, i: number) {
    await ajouterTacheSuggeree(semaine, t.libelle, t.categorie, t.priorite);
    setAdded((prev) => new Set(prev).add(i));
    toast.success("Ajoutée à la semaine.");
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <Sparkles className="text-brand" /> Suggestions IA
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="size-4 text-brand" /> Tâches suggérées
          </DialogTitle>
          <DialogDescription>
            À partir de ton objectif, ton pipeline, ton acquisition et ta to-do.
            Ajoute celles qui te parlent.
          </DialogDescription>
        </DialogHeader>

        {error ? (
          <p className="rounded-lg bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {error}
          </p>
        ) : null}

        {pending ? (
          <p className="py-10 text-center text-sm text-muted-foreground">
            Analyse de ton profil…
          </p>
        ) : (
          <ul className="space-y-2">
            {taches.map((t, i) => {
              const isAdded = added.has(i);
              return (
                <li
                  key={i}
                  className="flex items-start justify-between gap-3 rounded-lg border p-3"
                >
                  <div className="min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-medium">{t.libelle}</span>
                      <Badge variant="secondary" className="font-normal">
                        {labelOf(TACHE_TYPES, t.categorie)}
                      </Badge>
                      {t.priorite === "haute" ? (
                        <span className="inline-flex items-center gap-1 text-xs text-negative">
                          <span className="size-1.5 rounded-full bg-negative" />
                          haute
                        </span>
                      ) : null}
                    </div>
                    {t.pourquoi ? (
                      <p className="text-xs text-muted-foreground">{t.pourquoi}</p>
                    ) : null}
                  </div>
                  <Button
                    size="sm"
                    variant={isAdded ? "ghost" : "outline"}
                    disabled={isAdded}
                    onClick={() => add(t, i)}
                    className="shrink-0"
                  >
                    {isAdded ? <Check /> : <Plus />}
                    {isAdded ? "Ajoutée" : "Ajouter"}
                  </Button>
                </li>
              );
            })}
          </ul>
        )}

        <div className="flex justify-end pt-1">
          <Button variant="ghost" size="sm" onClick={generate} disabled={pending}>
            <RefreshCw className={pending ? "animate-spin" : ""} /> Régénérer
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
