"use client";

import { useState, useTransition } from "react";
import { Plus } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/forms/form-ui";
import { addLivrable } from "@/app/actions/livrables";

// Ajoute un livrable ponctuel à un engagement (ex. un épisode de podcast).
export function AddLivrableDialog({
  engagementId,
  periode,
  defaultLibelle,
}: {
  engagementId: string;
  periode: string;
  defaultLibelle: string;
}) {
  const [open, setOpen] = useState(false);
  const [libelle, setLibelle] = useState(defaultLibelle);
  const [pending, startTransition] = useTransition();

  function onSubmit() {
    startTransition(async () => {
      await addLivrable(engagementId, periode, libelle);
      toast.success("Livrable ajouté.");
      setOpen(false);
      setLibelle(defaultLibelle);
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm">
          <Plus /> Ajouter
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Ajouter un livrable</DialogTitle>
          <DialogDescription>
            Un livrable ponctuel pour cette période (en plus de ceux générés).
          </DialogDescription>
        </DialogHeader>
        <Field label="Libellé" htmlFor="libelle" required>
          <Input
            id="libelle"
            value={libelle}
            onChange={(e) => setLibelle(e.target.value)}
            autoFocus
          />
        </Field>
        <DialogFooter>
          <Button onClick={onSubmit} disabled={pending || !libelle.trim()}>
            {pending ? "Ajout…" : "Ajouter"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
