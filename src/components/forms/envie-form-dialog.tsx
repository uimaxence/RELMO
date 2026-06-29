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
import { createEnvie, updateEnvie } from "@/app/actions/envies";
import { initialFormState, type FormState } from "@/lib/form";
import { ENVIE_CATEGORIES } from "@/lib/constants";

type EnvieLite = {
  id: string;
  libelle: string;
  prix: number;
  url: string | null;
  categorie: string | null;
  note: string | null;
};

export function EnvieFormDialog({
  envie,
  trigger,
}: {
  envie?: EnvieLite;
  trigger?: React.ReactNode;
}) {
  const editing = Boolean(envie);
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(
    async (prev: FormState, formData: FormData) => {
      const res = envie
        ? await updateEnvie(envie.id, prev, formData)
        : await createEnvie(prev, formData);
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
            <Plus /> Nouvelle envie
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{editing ? "Modifier l'envie" : "Nouvelle envie"}</DialogTitle>
          <DialogDescription>
            Une chose que tu t&apos;offriras quand ton MRR la rendra abordable.
          </DialogDescription>
        </DialogHeader>
        <form action={formAction} className="space-y-5">
          <Field
            label="Quoi"
            htmlFor="libelle"
            required
            error={state?.fieldErrors?.libelle}
          >
            <Input
              id="libelle"
              name="libelle"
              defaultValue={envie?.libelle ?? ""}
              placeholder="Ex. Tiroir pour organiser le bureau"
            />
          </Field>

          <div className="grid grid-cols-2 gap-4">
            <Field
              label="Prix (€)"
              htmlFor="prix"
              required
              error={state?.fieldErrors?.prix}
            >
              <Input
                id="prix"
                name="prix"
                type="number"
                min="0"
                step="5"
                defaultValue={envie?.prix ?? 0}
              />
            </Field>
            <Field label="Catégorie" error={state?.fieldErrors?.categorie}>
              <Select name="categorie" defaultValue={envie?.categorie ?? "none"}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">—</SelectItem>
                  {ENVIE_CATEGORIES.map((c) => (
                    <SelectItem key={c.value} value={c.value}>
                      {c.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </div>

          <Field label="Lien (optionnel)" htmlFor="url" error={state?.fieldErrors?.url}>
            <Input
              id="url"
              name="url"
              defaultValue={envie?.url ?? ""}
              placeholder="https://…"
            />
          </Field>

          <Field label="Note" htmlFor="note" error={state?.fieldErrors?.note}>
            <Textarea id="note" name="note" defaultValue={envie?.note ?? ""} />
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
