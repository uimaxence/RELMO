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
import { createSite, updateSite } from "@/app/actions/sites";
import { initialFormState, type FormState } from "@/lib/form";
import { SITE_STATUTS } from "@/lib/constants";
import { toDateInput } from "@/lib/format";

type SiteLite = {
  id: string;
  clientId: string;
  nom: string;
  url: string | null;
  repoGitUrl: string | null;
  hebergeur: string | null;
  stack: string | null;
  contact: string | null;
  statut: string;
  dateMiseEnLigne: Date | string | null;
  notes: string | null;
};

export function SiteFormDialog({
  clientId,
  site,
  trigger,
}: {
  clientId: string;
  site?: SiteLite;
  trigger?: React.ReactNode;
}) {
  const editing = Boolean(site);
  const [open, setOpen] = useState(false);
  const baseAction = site ? updateSite.bind(null, site.id) : createSite;
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
            <Plus /> Nouveau site
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editing ? "Modifier le site" : "Nouveau site"}</DialogTitle>
          <DialogDescription>
            Site géré pour ce client. Les contrats se gèrent depuis sa fiche.
          </DialogDescription>
        </DialogHeader>
        <form action={formAction} className="space-y-4">
          <input type="hidden" name="clientId" value={clientId} />
          <Field label="Nom" htmlFor="nom" required error={state?.fieldErrors?.nom}>
            <Input id="nom" name="nom" defaultValue={site?.nom ?? ""} autoFocus />
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="URL" htmlFor="url" error={state?.fieldErrors?.url}>
              <Input
                id="url"
                name="url"
                defaultValue={site?.url ?? ""}
                placeholder="https://…"
              />
            </Field>
            <Field label="Stack" htmlFor="stack" error={state?.fieldErrors?.stack}>
              <Input
                id="stack"
                name="stack"
                defaultValue={site?.stack ?? ""}
                placeholder="Next.js"
              />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Field
              label="Repo Git"
              htmlFor="repoGitUrl"
              error={state?.fieldErrors?.repoGitUrl}
            >
              <Input
                id="repoGitUrl"
                name="repoGitUrl"
                defaultValue={site?.repoGitUrl ?? ""}
              />
            </Field>
            <Field
              label="Hébergeur"
              htmlFor="hebergeur"
              error={state?.fieldErrors?.hebergeur}
            >
              <Input
                id="hebergeur"
                name="hebergeur"
                defaultValue={site?.hebergeur ?? ""}
                placeholder="Vercel"
              />
            </Field>
          </div>
          <Field
            label="Contact"
            htmlFor="contact"
            hint="Interlocuteur côté client (ex. qui fournit le contenu)."
            error={state?.fieldErrors?.contact}
          >
            <Input
              id="contact"
              name="contact"
              defaultValue={site?.contact ?? ""}
              placeholder="Ex. Elisa Chéné"
            />
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Statut" error={state?.fieldErrors?.statut}>
              <Select name="statut" defaultValue={site?.statut ?? "actif"}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SITE_STATUTS.map((s) => (
                    <SelectItem key={s.value} value={s.value}>
                      {s.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field
              label="Mise en ligne"
              htmlFor="dateMiseEnLigne"
              error={state?.fieldErrors?.dateMiseEnLigne}
            >
              <Input
                id="dateMiseEnLigne"
                name="dateMiseEnLigne"
                type="date"
                defaultValue={toDateInput(site?.dateMiseEnLigne)}
              />
            </Field>
          </div>
          <Field label="Notes" htmlFor="notes" error={state?.fieldErrors?.notes}>
            <Textarea id="notes" name="notes" defaultValue={site?.notes ?? ""} />
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
