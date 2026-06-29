"use client";

import { useActionState, useState } from "react";
import { Pencil } from "lucide-react";
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
import { updateObjectif } from "@/app/actions/objectif";
import { initialFormState, type FormState } from "@/lib/form";
import { toDateInput } from "@/lib/format";

type ObjectifLite = {
  id: string;
  montantCible: number;
  mrrDepart: number;
  dateDebut: Date | string;
  dateCible: Date | string;
};

export function ObjectifFormDialog({ objectif }: { objectif: ObjectifLite }) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(
    async (prev: FormState, formData: FormData) => {
      const res = await updateObjectif(objectif.id, prev, formData);
      if (res?.ok) {
        toast.success(res.message);
        setOpen(false);
      }
      return res;
    },
    initialFormState,
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Modifier l'objectif">
          <Pencil />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Objectif MRR</DialogTitle>
          <DialogDescription>
            La cible, le point de départ et l&apos;échéance pilotent le curseur.
          </DialogDescription>
        </DialogHeader>
        <form action={formAction} className="space-y-5">
          <div className="grid grid-cols-2 gap-4">
            <Field
              label="Cible (€/mois)"
              htmlFor="montantCible"
              required
              error={state?.fieldErrors?.montantCible}
            >
              <Input
                id="montantCible"
                name="montantCible"
                type="number"
                min="0"
                step="any"
                defaultValue={objectif.montantCible}
                autoFocus
              />
            </Field>
            <Field
              label="MRR de départ (€)"
              htmlFor="mrrDepart"
              required
              error={state?.fieldErrors?.mrrDepart}
            >
              <Input
                id="mrrDepart"
                name="mrrDepart"
                type="number"
                min="0"
                step="any"
                defaultValue={objectif.mrrDepart}
              />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Field
              label="Date de début"
              htmlFor="dateDebut"
              required
              error={state?.fieldErrors?.dateDebut}
            >
              <Input
                id="dateDebut"
                name="dateDebut"
                type="date"
                defaultValue={toDateInput(objectif.dateDebut)}
              />
            </Field>
            <Field
              label="Échéance"
              htmlFor="dateCible"
              required
              error={state?.fieldErrors?.dateCible}
            >
              <Input
                id="dateCible"
                name="dateCible"
                type="date"
                defaultValue={toDateInput(objectif.dateCible)}
              />
            </Field>
          </div>
          <DialogFooter>
            <Button type="submit" disabled={pending}>
              {pending ? "Enregistrement…" : "Enregistrer"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
