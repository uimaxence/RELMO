"use client";

import { useState, useTransition } from "react";
import { Upload, Loader2 } from "lucide-react";
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
import { Textarea } from "@/components/ui/textarea";
import { importerCsvCompta } from "@/app/actions/comptabilite";

export function ImportComptaDialog() {
  const [open, setOpen] = useState(false);
  const [csv, setCsv] = useState("");
  const [pending, start] = useTransition();

  function importer() {
    start(async () => {
      const res = await importerCsvCompta(csv);
      if (res.ok) {
        const restant =
          res.aCategoriser > 0 ? ` · ${res.aCategoriser} à catégoriser` : "";
        toast.success(
          res.importees > 0
            ? `${res.importees} écriture(s) importée(s)${res.ignorees > 0 ? `, ${res.ignorees} déjà présentes` : ""}${restant}.`
            : "Rien de neuf : tout était déjà importé.",
        );
        setOpen(false);
        setCsv("");
      } else {
        toast.error(res.error);
      }
    });
  }

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) setCsv(await file.text());
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Upload /> Importer le relevé Indy
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Importer le journal Indy</DialogTitle>
          <DialogDescription>
            Dépose l&apos;export CSV « journal » d&apos;Indy (colonnes
            Date, Libellé, Compte, Débit, Crédit). L&apos;import est
            réversible et sans doublon : tu peux ré-envoyer chaque semaine, seules
            les nouvelles opérations sont ajoutées.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <input
            type="file"
            accept=".csv,text/csv"
            onChange={onFile}
            className="block w-full text-sm text-muted-foreground file:mr-3 file:rounded-md file:border-0 file:bg-muted file:px-3 file:py-1.5 file:text-sm"
          />
          <Textarea
            value={csv}
            onChange={(e) => setCsv(e.target.value)}
            placeholder="…ou colle le contenu du CSV ici"
            className="min-h-[160px] font-mono text-xs"
          />
        </div>

        <DialogFooter>
          <Button onClick={importer} disabled={pending || !csv.trim()}>
            {pending ? <Loader2 className="animate-spin" /> : <Upload />} Importer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
