"use client";

import { useActionState, useState } from "react";
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
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Field } from "@/components/forms/form-ui";
import { createContrat, updateContrat } from "@/app/actions/contrats";
import { initialFormState, type FormState } from "@/lib/form";
import { CONTRAT_STATUTS } from "@/lib/constants";
import { toDateInput } from "@/lib/format";

type ContratLite = {
  id: string;
  siteId: string;
  libelle: string;
  montantMensuel: number;
  dateDebut: Date | string;
  dateFin: Date | string | null;
  statut: string;
  note: string | null;
};

export function ContratFormDialog({
  siteId,
  contrat,
  trigger,
}: {
  siteId: string;
  contrat?: ContratLite;
  trigger?: React.ReactNode;
}) {
  const editing = Boolean(contrat);
  const [open, setOpen] = useState(false);
  const baseAction = contrat
    ? updateContrat.bind(null, contrat.id)
    : createContrat;
  const [state, formAction, pending] = useActionState(
    async (prev: FormState, formData: FormData) => {
      const res = await baseAction(prev, formData);
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
        {trigger ?? (
          <Button>
            <Plus /> Nouveau contrat
          </Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {editing ? "Modifier le contrat" : "Nouveau contrat"}
          </DialogTitle>
          <DialogDescription>
            Le récurrent vendu sur ce site. Les engagements (livrables mensuels) se
            définissent ensuite sur le contrat.
          </DialogDescription>
        </DialogHeader>
        <form action={formAction} className="space-y-4">
          <input type="hidden" name="siteId" value={siteId} />
          <Field
            label="Libellé"
            htmlFor="libelle"
            required
            error={state?.fieldErrors?.libelle}
          >
            <Input
              id="libelle"
              name="libelle"
              defaultValue={contrat?.libelle ?? ""}
              placeholder="Ex. Suivi éditorial SEO"
              autoFocus
            />
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field
              label="Montant mensuel (€)"
              htmlFor="montantMensuel"
              required
              error={state?.fieldErrors?.montantMensuel}
            >
              <Input
                id="montantMensuel"
                name="montantMensuel"
                type="number"
                min="0"
                step="1"
                defaultValue={contrat?.montantMensuel ?? ""}
              />
            </Field>
            <Field label="Statut" error={state?.fieldErrors?.statut}>
              <Select name="statut" defaultValue={contrat?.statut ?? "actif"}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CONTRAT_STATUTS.map((s) => (
                    <SelectItem key={s.value} value={s.value}>
                      {s.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
                defaultValue={toDateInput(contrat?.dateDebut) || toDateInput(new Date())}
              />
            </Field>
            <Field
              label="Date de fin"
              htmlFor="dateFin"
              error={state?.fieldErrors?.dateFin}
            >
              <Input
                id="dateFin"
                name="dateFin"
                type="date"
                defaultValue={toDateInput(contrat?.dateFin)}
              />
            </Field>
          </div>
          <Field
            label="Note"
            htmlFor="note"
            hint="Ex. mois offert, conditions particulières…"
            error={state?.fieldErrors?.note}
          >
            <Textarea id="note" name="note" defaultValue={contrat?.note ?? ""} />
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
