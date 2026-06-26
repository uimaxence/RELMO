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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Field } from "@/components/forms/form-ui";
import { createEngagement, updateEngagement } from "@/app/actions/engagements";
import { initialFormState, type FormState } from "@/lib/form";
import { RECURRENCES } from "@/lib/constants";

type EngagementLite = {
  id: string;
  contratId: string;
  type: string;
  libelle: string;
  quantiteParMois: number;
  recurrence: string;
};

export function EngagementFormDialog({
  contratId,
  siteId,
  engagement,
  trigger,
}: {
  contratId: string;
  siteId: string;
  engagement?: EngagementLite;
  trigger?: React.ReactNode;
}) {
  const editing = Boolean(engagement);
  const [open, setOpen] = useState(false);
  const baseAction = engagement
    ? updateEngagement.bind(null, engagement.id, siteId)
    : createEngagement.bind(null, siteId);
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
          <Button size="sm" variant="outline">
            <Plus /> Engagement
          </Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {editing ? "Modifier l'engagement" : "Nouvel engagement"}
          </DialogTitle>
          <DialogDescription>
            Ce qui est vendu de façon récurrente. Génère les livrables du mois.
          </DialogDescription>
        </DialogHeader>
        <form action={formAction} className="space-y-4">
          <input type="hidden" name="contratId" value={contratId} />
          <Field
            label="Libellé"
            htmlFor="libelle"
            required
            error={state?.fieldErrors?.libelle}
          >
            <Input
              id="libelle"
              name="libelle"
              defaultValue={engagement?.libelle ?? ""}
              placeholder="Ex. Article SEO hebdomadaire"
              autoFocus
            />
          </Field>
          <Field
            label="Type"
            htmlFor="type"
            required
            hint="Identifiant court (sert au rapprochement git plus tard). Ex. article_seo"
            error={state?.fieldErrors?.type}
          >
            <Input
              id="type"
              name="type"
              defaultValue={engagement?.type ?? ""}
              placeholder="article_seo"
            />
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field
              label="Quantité / mois"
              htmlFor="quantiteParMois"
              required
              error={state?.fieldErrors?.quantiteParMois}
            >
              <Input
                id="quantiteParMois"
                name="quantiteParMois"
                type="number"
                min="0"
                step="1"
                defaultValue={engagement?.quantiteParMois ?? 1}
              />
            </Field>
            <Field label="Récurrence" error={state?.fieldErrors?.recurrence}>
              <Select
                name="recurrence"
                defaultValue={engagement?.recurrence ?? "mensuelle"}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {RECURRENCES.map((r) => (
                    <SelectItem key={r.value} value={r.value}>
                      {r.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
