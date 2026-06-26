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
import { Field } from "@/components/forms/form-ui";
import { createClient, updateClient } from "@/app/actions/clients";
import { initialFormState, type FormState } from "@/lib/form";

type ClientLite = {
  id: string;
  nom: string;
  email: string | null;
  telephone: string | null;
  notes: string | null;
};

export function ClientFormDialog({
  client,
  trigger,
}: {
  client?: ClientLite;
  trigger?: React.ReactNode;
}) {
  const editing = Boolean(client);
  const [open, setOpen] = useState(false);
  const baseAction = client ? updateClient.bind(null, client.id) : createClient;
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
            <Plus /> Nouveau client
          </Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {editing ? "Modifier le client" : "Nouveau client"}
          </DialogTitle>
          <DialogDescription>
            Coordonnées du client. Les sites se gèrent depuis sa fiche.
          </DialogDescription>
        </DialogHeader>
        <form action={formAction} className="space-y-4">
          <Field label="Nom" htmlFor="nom" required error={state?.fieldErrors?.nom}>
            <Input
              id="nom"
              name="nom"
              defaultValue={client?.nom ?? ""}
              placeholder="Ex. Fenêtres sur Loir"
              autoFocus
            />
          </Field>
          <Field label="Email" htmlFor="email" error={state?.fieldErrors?.email}>
            <Input
              id="email"
              name="email"
              type="email"
              defaultValue={client?.email ?? ""}
              placeholder="contact@exemple.fr"
            />
          </Field>
          <Field
            label="Téléphone"
            htmlFor="telephone"
            error={state?.fieldErrors?.telephone}
          >
            <Input
              id="telephone"
              name="telephone"
              defaultValue={client?.telephone ?? ""}
            />
          </Field>
          <Field label="Notes" htmlFor="notes" error={state?.fieldErrors?.notes}>
            <Textarea id="notes" name="notes" defaultValue={client?.notes ?? ""} />
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
