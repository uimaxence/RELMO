"use client";

import { useActionState, useState } from "react";
import { MessageSquarePlus } from "lucide-react";
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
import { createInteraction } from "@/app/actions/interactions";
import { initialFormState, type FormState } from "@/lib/form";
import { CANAUX, DIRECTIONS } from "@/lib/constants";
import { toDateInput } from "@/lib/format";

// Saisie rapide d'un échange de négo (doit prendre ~15 s).
export function InteractionFormDialog({ clientId }: { clientId: string }) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(
    async (prev: FormState, formData: FormData) => {
      const res = await createInteraction(prev, formData);
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
        <Button variant="outline" size="sm">
          <MessageSquarePlus /> Journaliser un échange
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Journaliser un échange</DialogTitle>
          <DialogDescription>
            Un résumé suffit. WhatsApp/mail/tél restent en saisie manuelle.
          </DialogDescription>
        </DialogHeader>
        <form action={formAction} className="space-y-4">
          <input type="hidden" name="clientId" value={clientId} />
          <div className="grid grid-cols-3 gap-4">
            <Field label="Canal" error={state?.fieldErrors?.canal}>
              <Select name="canal" defaultValue="whatsapp">
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CANAUX.map((c) => (
                    <SelectItem key={c.value} value={c.value}>
                      {c.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Sens" error={state?.fieldErrors?.direction}>
              <Select name="direction" defaultValue="sortant">
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DIRECTIONS.map((d) => (
                    <SelectItem key={d.value} value={d.value}>
                      {d.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Date" htmlFor="date" error={state?.fieldErrors?.date}>
              <Input
                id="date"
                name="date"
                type="date"
                defaultValue={toDateInput(new Date())}
              />
            </Field>
          </div>
          <Field
            label="Résumé"
            htmlFor="resume"
            required
            error={state?.fieldErrors?.resume}
          >
            <Input
              id="resume"
              name="resume"
              placeholder="Ex. Relancé pour le devis, attend le retour de son associé"
              autoFocus
            />
          </Field>
          <Field label="Détail (optionnel)" htmlFor="contenu">
            <Textarea id="contenu" name="contenu" />
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
