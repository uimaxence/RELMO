"use client";

import { useActionState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { updateReglage } from "@/app/actions/envies";
import { initialFormState, type FormState } from "@/lib/form";

// Réglage du seuil d'abordabilité (% du MRR). Inline, sans dialog.
export function ReglageForm({ pourcentage }: { pourcentage: number }) {
  const [state, formAction, pending] = useActionState(
    async (prev: FormState, formData: FormData) => {
      const res = await updateReglage(prev, formData);
      if (res?.ok) toast.success(res.message);
      else if (res) toast.error(res.message ?? "Erreur.");
      return res;
    },
    initialFormState,
  );

  return (
    <form action={formAction} className="flex items-center gap-2 text-sm">
      <span className="text-muted-foreground">Abordable si prix ≤</span>
      <Input
        name="pourcentagePlafond"
        type="number"
        min="1"
        max="100"
        step="1"
        defaultValue={pourcentage}
        className="h-8 w-16"
        aria-label="Pourcentage du MRR"
      />
      <span className="text-muted-foreground">% du MRR/mois</span>
      <Button type="submit" size="sm" variant="outline" disabled={pending}>
        {pending ? "…" : "OK"}
      </Button>
      {state?.fieldErrors?.pourcentagePlafond ? (
        <span className="text-destructive">
          {state.fieldErrors.pourcentagePlafond}
        </span>
      ) : null}
    </form>
  );
}
