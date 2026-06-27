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
import { createDevis, updateDevis } from "@/app/actions/devis";
import { initialFormState, type FormState } from "@/lib/form";
import { DEVIS_STATUTS } from "@/lib/constants";
import { toDateInput } from "@/lib/format";

type ClientOpt = { id: string; nom: string };
type SiteOpt = { id: string; nom: string; clientNom: string };

type DevisLite = {
  id: string;
  clientId: string;
  siteId: string | null;
  libelle: string;
  montantCreation: number;
  montantMensuelPropose: number;
  statut: string;
  dateEnvoi: Date | string | null;
  dateRelance: Date | string | null;
  note: string | null;
  motifPerte: string | null;
};

export function DevisFormDialog({
  clients,
  sites,
  devis,
  defaultClientId,
  trigger,
}: {
  clients: ClientOpt[];
  sites: SiteOpt[];
  devis?: DevisLite;
  defaultClientId?: string;
  trigger?: React.ReactNode;
}) {
  const editing = Boolean(devis);
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(
    async (prev: FormState, formData: FormData) => {
      const res = devis
        ? await updateDevis(devis.id, prev, formData)
        : await createDevis(prev, formData);
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
            <Plus /> Nouveau devis
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editing ? "Modifier le devis" : "Nouveau devis"}</DialogTitle>
          <DialogDescription>
            Une proposition commerciale. Une fois acceptée, on la convertit en
            contrat.
          </DialogDescription>
        </DialogHeader>
        <form action={formAction} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Field label="Client" required error={state?.fieldErrors?.clientId}>
              <Select
                name="clientId"
                defaultValue={devis?.clientId ?? defaultClientId}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Choisir…" />
                </SelectTrigger>
                <SelectContent>
                  {clients.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.nom}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Site (optionnel)" error={state?.fieldErrors?.siteId}>
              <Select name="siteId" defaultValue={devis?.siteId ?? "none"}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Aucun</SelectItem>
                  {sites.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.clientNom} · {s.nom}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </div>

          <Field
            label="Libellé"
            htmlFor="libelle"
            required
            error={state?.fieldErrors?.libelle}
          >
            <Input
              id="libelle"
              name="libelle"
              defaultValue={devis?.libelle ?? ""}
              placeholder="Ex. Site vitrine + suivi SEO"
            />
          </Field>

          <div className="grid grid-cols-2 gap-4">
            <Field
              label="Création (€)"
              htmlFor="montantCreation"
              error={state?.fieldErrors?.montantCreation}
            >
              <Input
                id="montantCreation"
                name="montantCreation"
                type="number"
                min="0"
                step="50"
                defaultValue={devis?.montantCreation ?? 0}
              />
            </Field>
            <Field
              label="Mensuel proposé (€)"
              htmlFor="montantMensuelPropose"
              error={state?.fieldErrors?.montantMensuelPropose}
            >
              <Input
                id="montantMensuelPropose"
                name="montantMensuelPropose"
                type="number"
                min="0"
                step="10"
                defaultValue={devis?.montantMensuelPropose ?? 0}
              />
            </Field>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <Field label="Statut" error={state?.fieldErrors?.statut}>
              <Select name="statut" defaultValue={devis?.statut ?? "brouillon"}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DEVIS_STATUTS.map((s) => (
                    <SelectItem key={s.value} value={s.value}>
                      {s.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field
              label="Envoyé le"
              htmlFor="dateEnvoi"
              error={state?.fieldErrors?.dateEnvoi}
            >
              <Input
                id="dateEnvoi"
                name="dateEnvoi"
                type="date"
                defaultValue={toDateInput(devis?.dateEnvoi)}
              />
            </Field>
            <Field
              label="Relance le"
              htmlFor="dateRelance"
              error={state?.fieldErrors?.dateRelance}
            >
              <Input
                id="dateRelance"
                name="dateRelance"
                type="date"
                defaultValue={toDateInput(devis?.dateRelance)}
              />
            </Field>
          </div>

          <Field label="Note" htmlFor="note" error={state?.fieldErrors?.note}>
            <Textarea id="note" name="note" defaultValue={devis?.note ?? ""} />
          </Field>

          <Field
            label="Motif de perte"
            htmlFor="motifPerte"
            hint="Si refusé / expiré : pourquoi (prix, timing, concurrent, sans réponse…)"
            error={state?.fieldErrors?.motifPerte}
          >
            <Input
              id="motifPerte"
              name="motifPerte"
              defaultValue={devis?.motifPerte ?? ""}
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
