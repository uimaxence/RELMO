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
import { analyserPdfDevis } from "@/app/actions/devis-pdf";
import { initialFormState, type FormState } from "@/lib/form";
import { DEVIS_STATUTS } from "@/lib/constants";
import { toDateInput } from "@/lib/format";
import { cn } from "@/lib/utils";

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
  pdfUrl?: string | null;
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

  // Champs pré-remplissables par l'analyse PDF → contrôlés.
  const [libelle, setLibelle] = useState(devis?.libelle ?? "");
  const [creation, setCreation] = useState(String(devis?.montantCreation ?? 0));
  const [mensuel, setMensuel] = useState(
    String(devis?.montantMensuelPropose ?? 0),
  );
  const [note, setNote] = useState(devis?.note ?? "");
  const [pdfUrl, setPdfUrl] = useState(devis?.pdfUrl ?? "");

  const [analyse, setAnalyse] = useState(false);
  const [dragging, setDragging] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

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

  async function analyser(file: File) {
    if (file.type && file.type !== "application/pdf") {
      toast.error("Seuls les PDF sont acceptés.");
      return;
    }
    setAnalyse(true);
    const fd = new FormData();
    fd.append("file", file);
    const res = await analyserPdfDevis(fd);
    setAnalyse(false);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    const d = res.data;
    if (d.libelle) setLibelle(d.libelle);
    if (typeof d.montantCreation === "number") setCreation(String(d.montantCreation));
    if (typeof d.montantMensuelPropose === "number")
      setMensuel(String(d.montantMensuelPropose));
    if (d.note) setNote(d.note);
    setPdfUrl(res.pdfUrl);
    toast.success("Devis analysé — vérifie les champs avant d'enregistrer.");
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button>
            <Plus /> Nouveau devis
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{editing ? "Modifier le devis" : "Nouveau devis"}</DialogTitle>
          <DialogDescription>
            Une proposition commerciale. Une fois acceptée, on la convertit en
            contrat.
          </DialogDescription>
        </DialogHeader>

        {/* Zone de dépôt PDF → analyse DeepSeek */}
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            const file = e.dataTransfer.files?.[0];
            if (file) void analyser(file);
          }}
          onClick={() => fileRef.current?.click()}
          className={cn(
            "flex cursor-pointer flex-col items-center gap-1 rounded-xl border border-dashed px-4 py-5 text-center text-sm transition-colors",
            dragging ? "border-brand bg-brand/5" : "hover:border-foreground/30",
          )}
        >
          {analyse ? (
            <>
              <Loader2 className="size-5 animate-spin text-brand" />
              <span className="text-muted-foreground">Analyse du PDF…</span>
            </>
          ) : (
            <>
              <UploadCloud className="size-5 text-muted-foreground" />
              <span>
                Glisse un <span className="font-medium">PDF de devis</span> ici —
                DeepSeek pré-remplit les champs.
              </span>
              {pdfUrl ? (
                <a
                  href={pdfUrl}
                  target="_blank"
                  rel="noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="inline-flex items-center gap-1 text-xs text-brand hover:underline"
                >
                  <FileText className="size-3" /> PDF rattaché
                </a>
              ) : null}
            </>
          )}
          <input
            ref={fileRef}
            type="file"
            accept="application/pdf"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void analyser(file);
              e.target.value = "";
            }}
          />
        </div>

        <form action={formAction} className="space-y-5">
          <input type="hidden" name="pdfUrl" value={pdfUrl} />
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
              value={libelle}
              onChange={(e) => setLibelle(e.target.value)}
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
                value={creation}
                onChange={(e) => setCreation(e.target.value)}
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
                value={mensuel}
                onChange={(e) => setMensuel(e.target.value)}
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
            <Textarea
              id="note"
              name="note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
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
            <Button type="submit" disabled={pending || analyse}>
              {pending ? "Enregistrement…" : "Enregistrer"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
