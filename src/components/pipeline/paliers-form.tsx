"use client";

import { useActionState, useState } from "react";
import { SlidersHorizontal } from "lucide-react";
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
import { updatePaliers } from "@/app/actions/envies";
import { initialFormState, type FormState } from "@/lib/form";

// Édite les paliers de prix courants (grille publique — cf. brief §4). On monte
// l'Essentiel de ~100-150 € à chaque nouveau client signé, jusqu'au premier « non ».
export function PaliersForm({
  palierEssentiel,
  palierPro,
  tarifSuivi,
}: {
  palierEssentiel: number;
  palierPro: number;
  tarifSuivi: number;
}) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(
    async (prev: FormState, formData: FormData) => {
      const res = await updatePaliers(prev, formData);
      if (res?.ok) {
        toast.success(res.message);
        setOpen(false);
      } else if (res) {
        toast.error(res.message ?? "Erreur.");
      }
      return res;
    },
    initialFormState,
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm">
          <SlidersHorizontal /> Ajuster les paliers
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Paliers de prix</DialogTitle>
          <DialogDescription>
            Les tarifs « à partir de » affichés et pré-remplis sur les devis. Fais
            monter l&apos;Essentiel dès qu&apos;une nouvelle référence te le permet.
          </DialogDescription>
        </DialogHeader>
        <form action={formAction} className="space-y-4">
          <Field
            label="Essentiel — création (€)"
            htmlFor="palierEssentiel"
            error={state?.fieldErrors?.palierEssentiel}
          >
            <Input
              id="palierEssentiel"
              name="palierEssentiel"
              type="number"
              min="0"
              step="any"
              defaultValue={palierEssentiel}
            />
          </Field>
          <Field
            label="Pro — création (€)"
            htmlFor="palierPro"
            hint="Sert d'ancrage : à côté du Pro, l'Essentiel paraît raisonnable."
            error={state?.fieldErrors?.palierPro}
          >
            <Input
              id="palierPro"
              name="palierPro"
              type="number"
              min="0"
              step="any"
              defaultValue={palierPro}
            />
          </Field>
          <Field
            label="Suivi & SEO (€/mois)"
            htmlFor="tarifSuivi"
            error={state?.fieldErrors?.tarifSuivi}
          >
            <Input
              id="tarifSuivi"
              name="tarifSuivi"
              type="number"
              min="0"
              step="any"
              defaultValue={tarifSuivi}
            />
          </Field>
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
