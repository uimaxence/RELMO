"use client";

import { useState, useTransition } from "react";
import { Check, GripVertical, StickyNote, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Field } from "@/components/forms/form-ui";
import { cn } from "@/lib/utils";
import { TACHE_TYPES, TACHE_PRIORITES, labelOf } from "@/lib/constants";
import { setTacheStatut, updateTache, deleteTache } from "@/app/actions/taches";
import { renderLibelle, type ClientRef } from "@/components/taches/mention";

export type TacheCardData = {
  id: string;
  libelle: string;
  note: string | null;
  type: string;
  priorite: string;
  statut: string;
  refType: string | null;
};

export function TacheCard({
  tache,
  client,
}: {
  tache: TacheCardData;
  client?: ClientRef | null;
}) {
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [libelle, setLibelle] = useState(tache.libelle);
  const [note, setNote] = useState(tache.note ?? "");
  const [priorite, setPriorite] = useState(tache.priorite);
  const [type, setType] = useState(tache.type);

  const fait = tache.statut === "fait";

  function toggleFait(e: React.MouseEvent) {
    e.stopPropagation();
    startTransition(() =>
      setTacheStatut(tache.id, fait ? "a_faire" : "fait").then(() => {}),
    );
  }

  function save() {
    startTransition(async () => {
      await updateTache(tache.id, { libelle, note, priorite, type });
      toast.success("Tâche mise à jour.");
      setOpen(false);
    });
  }

  function remove() {
    startTransition(async () => {
      await deleteTache(tache.id);
      setOpen(false);
    });
  }

  return (
    <>
      <div
        draggable
        onDragStart={(e) => {
          e.dataTransfer.setData("text/plain", tache.id);
          e.dataTransfer.effectAllowed = "move";
        }}
        onClick={() => setOpen(true)}
        className={cn(
          "group cursor-pointer rounded-lg border bg-card p-2.5 shadow-xs transition-colors hover:border-foreground/30",
          pending && "opacity-60",
        )}
      >
        <div className="flex items-start gap-2">
          <button
            type="button"
            onClick={toggleFait}
            disabled={pending}
            aria-label={fait ? "Marquer à faire" : "Marquer fait"}
            className={cn(
              "mt-0.5 flex size-4 shrink-0 items-center justify-center rounded border transition-colors",
              fait
                ? "border-foreground bg-foreground text-background"
                : "border-border-strong hover:border-foreground",
            )}
          >
            {fait ? <Check className="size-3" /> : null}
          </button>
          <span
            className={cn(
              "min-w-0 flex-1 text-sm",
              fait && "text-muted-foreground line-through",
            )}
          >
            {renderLibelle(tache.libelle, client)}
          </span>
          <GripVertical className="size-4 shrink-0 text-muted-foreground/40 group-hover:text-muted-foreground" />
        </div>
        <div className="mt-1.5 flex items-center gap-2 pl-6 text-xs text-muted-foreground">
          {tache.priorite === "haute" ? (
            <span className="size-1.5 rounded-full bg-negative" />
          ) : null}
          <span>{labelOf(TACHE_TYPES, tache.type)}</span>
          {tache.note ? <StickyNote className="size-3" /> : null}
        </div>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Modifier la tâche</DialogTitle>
            <DialogDescription>
              Affine le libellé, ajoute une note, ajuste la priorité.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-5">
            <Field label="Libellé" htmlFor="t-libelle">
              <Input
                id="t-libelle"
                value={libelle}
                onChange={(e) => setLibelle(e.target.value)}
              />
            </Field>
            <Field label="Note" htmlFor="t-note">
              <Textarea
                id="t-note"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Détail, contexte, sous-étapes…"
                className="min-h-[100px]"
              />
            </Field>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Priorité">
                <Select value={priorite} onValueChange={setPriorite}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TACHE_PRIORITES.map((p) => (
                      <SelectItem key={p.value} value={p.value}>
                        {p.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Type">
                <Select value={type} onValueChange={setType}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TACHE_TYPES.map((t) => (
                      <SelectItem key={t.value} value={t.value}>
                        {t.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            </div>
          </div>
          <DialogFooter className="sm:justify-between">
            <Button
              type="button"
              variant="ghost"
              onClick={remove}
              disabled={pending}
              className="text-destructive hover:text-destructive"
            >
              <Trash2 /> Supprimer
            </Button>
            <Button type="button" onClick={save} disabled={pending}>
              {pending ? "Enregistrement…" : "Enregistrer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
