"use client";

import { useActionState, useRef, useState } from "react";
import { Plus, UploadCloud, FileText, Loader2 } from "lucide-react";
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
import { createFacture, updateFacture, uploadFacturePdf } from "@/app/actions/factures";
import { initialFormState, type FormState } from "@/lib/form";
import { FACTURE_STATUTS } from "@/lib/constants";
import { currentPeriode } from "@/lib/periode";
import { toDateInput } from "@/lib/format";
import { cn } from "@/lib/utils";

type SiteOpt = { id: string; nom: string };

type FactureLite = {
  id: string;
  siteId: string | null;
  numero: string;
  periode: string;
  montant: number;
  statut: string;
  dateEmission: Date | string;
  dateEcheance: Date | string | null;
  pdfUrl: string | null;
  pathnamePdf: string | null;
};

export function FactureFormDialog({
  clientId,
  sites,
  facture,
  trigger,
}: {
  clientId: string;
  sites: SiteOpt[];
  facture?: FactureLite;
  trigger?: React.ReactNode;
}) {
  const editing = Boolean(facture);
  const [open, setOpen] = useState(false);
  const [pdfUrl, setPdfUrl] = useState(facture?.pdfUrl ?? "");
  const [pathnamePdf, setPathnamePdf] = useState(facture?.pathnamePdf ?? "");
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const [state, formAction, pending] = useActionState(
    async (prev: FormState, formData: FormData) => {
      const res = facture
        ? await updateFacture(facture.id, prev, formData)
        : await createFacture(prev, formData);
      if (res?.ok) {
        toast.success(res.message);
        setOpen(false);
      }
      return res;
    },
    initialFormState,
  );

  async function upload(file: File) {
    setUploading(true);
    const fd = new FormData();
    fd.append("file", file);
    const res = await uploadFacturePdf(fd);
    setUploading(false);
    if (res.ok) {
      setPdfUrl(res.pdfUrl);
      setPathnamePdf(res.pathnamePdf);
      toast.success("PDF rattaché.");
    } else toast.error(res.error);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button size="sm" variant="outline">
            <Plus /> Facture
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{editing ? "Modifier la facture" : "Nouvelle facture"}</DialogTitle>
          <DialogDescription>
            Visible par le client dans son portail. PDF optionnel.
          </DialogDescription>
        </DialogHeader>
        <form action={formAction} className="space-y-5">
          <input type="hidden" name="clientId" value={clientId} />
          <input type="hidden" name="pdfUrl" value={pdfUrl} />
          <input type="hidden" name="pathnamePdf" value={pathnamePdf} />

          <div className="grid grid-cols-2 gap-4">
            <Field label="Numéro" htmlFor="numero" required error={state?.fieldErrors?.numero}>
              <Input
                id="numero"
                name="numero"
                defaultValue={facture?.numero ?? ""}
                placeholder="2026-001"
              />
            </Field>
            <Field label="Période" htmlFor="periode" required error={state?.fieldErrors?.periode}>
              <Input
                id="periode"
                name="periode"
                type="month"
                defaultValue={facture?.periode ?? currentPeriode()}
              />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Montant (€)" htmlFor="montant" required error={state?.fieldErrors?.montant}>
              <Input
                id="montant"
                name="montant"
                type="number"
                min="0"
                step="any"
                defaultValue={facture?.montant ?? 0}
              />
            </Field>
            <Field label="Statut" error={state?.fieldErrors?.statut}>
              <Select name="statut" defaultValue={facture?.statut ?? "emise"}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {FACTURE_STATUTS.map((s) => (
                    <SelectItem key={s.value} value={s.value}>
                      {s.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Émise le" htmlFor="dateEmission" error={state?.fieldErrors?.dateEmission}>
              <Input
                id="dateEmission"
                name="dateEmission"
                type="date"
                defaultValue={toDateInput(facture?.dateEmission ?? new Date())}
              />
            </Field>
            <Field label="Échéance" htmlFor="dateEcheance" error={state?.fieldErrors?.dateEcheance}>
              <Input
                id="dateEcheance"
                name="dateEcheance"
                type="date"
                defaultValue={toDateInput(facture?.dateEcheance)}
              />
            </Field>
          </div>

          {sites.length > 0 ? (
            <Field label="Site (optionnel)" error={state?.fieldErrors?.siteId}>
              <Select name="siteId" defaultValue={facture?.siteId ?? "none"}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Aucun</SelectItem>
                  {sites.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.nom}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          ) : null}

          <div
            onClick={() => fileRef.current?.click()}
            className={cn(
              "flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed px-4 py-3 text-sm hover:border-foreground/30",
            )}
          >
            {uploading ? (
              <>
                <Loader2 className="size-4 animate-spin text-brand" /> Envoi…
              </>
            ) : pdfUrl ? (
              <>
                <FileText className="size-4 text-brand" /> PDF rattaché — cliquer pour
                remplacer
              </>
            ) : (
              <>
                <UploadCloud className="size-4 text-muted-foreground" /> Joindre le PDF
                (optionnel)
              </>
            )}
            <input
              ref={fileRef}
              type="file"
              accept="application/pdf"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void upload(f);
                e.target.value = "";
              }}
            />
          </div>

          <DialogFooter>
            <Button type="submit" disabled={pending || uploading}>
              {pending ? "Enregistrement…" : "Enregistrer"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
