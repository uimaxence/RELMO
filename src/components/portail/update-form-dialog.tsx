"use client";

import { useActionState, useState } from "react";
import { Megaphone } from "lucide-react";
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
import { Label } from "@/components/ui/label";
import { Field } from "@/components/forms/form-ui";
import { publierUpdate } from "@/app/actions/portail";
import { initialFormState, type FormState } from "@/lib/form";

// Publication d'une actu d'avancement dans l'espace projet du client,
// avec notification email optionnelle (cochée par défaut si email connu).
export function UpdateFormDialog({
  clientId,
  clientEmail,
}: {
  clientId: string;
  clientEmail: string | null;
}) {
  const [open, setOpen] = useState(false);
  // Lu une seule fois au montage côté client (même pattern que PortailControl).
  const [origin] = useState(() =>
    typeof window !== "undefined" ? window.location.origin : "",
  );
  const [state, formAction, pending] = useActionState(
    async (prev: FormState, formData: FormData) => {
      const res = await publierUpdate(prev, formData);
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
          <Megaphone /> Publier une actu
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Publier une actu d&apos;avancement</DialogTitle>
          <DialogDescription>
            Visible sur l&apos;espace projet du client. Parlez bénéfice, pas
            technique.
          </DialogDescription>
        </DialogHeader>
        <form action={formAction} className="space-y-5">
          <input type="hidden" name="clientId" value={clientId} />
          <input type="hidden" name="origin" value={origin} />
          <Field
            label="Titre"
            htmlFor="titre"
            required
            error={state?.fieldErrors?.titre}
          >
            <Input
              id="titre"
              name="titre"
              placeholder="Ex. La page d'accueil est en ligne"
              autoFocus
            />
          </Field>
          <Field label="Détail (optionnel)" htmlFor="contenu">
            <Textarea
              id="contenu"
              name="contenu"
              placeholder="Ex. Vous pouvez la découvrir dès maintenant, vos photos sont intégrées. Prochaine étape : la page contact."
            />
          </Field>
          <div className="flex items-start gap-2">
            <input
              type="checkbox"
              id="envoyerEmail"
              name="envoyerEmail"
              defaultChecked={Boolean(clientEmail)}
              disabled={!clientEmail}
              className="mt-0.5 size-4"
            />
            <Label htmlFor="envoyerEmail" className="font-normal">
              {clientEmail
                ? `Prévenir par email (${clientEmail})`
                : "Prévenir par email (aucun email renseigné pour ce client)"}
            </Label>
          </div>
          <DialogFooter>
            <Button type="submit" disabled={pending}>
              {pending ? "Publication…" : "Publier"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
