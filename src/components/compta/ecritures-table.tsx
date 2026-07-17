"use client";

import { useState, useTransition } from "react";
import { Sparkles, Loader2, ArrowDownLeft, ArrowUpRight } from "lucide-react";
import { toast } from "sonner";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { ConfirmDelete } from "@/components/forms/confirm-delete";
import { euros, dateFr } from "@/lib/format";
import { CATEGORIES_COMPTA } from "@/lib/compta";
import {
  recategoriserEcriture,
  supprimerEcriture,
  categoriserAvecIA,
} from "@/app/actions/comptabilite";

export type EcritureRow = {
  id: string;
  date: string;
  libelle: string;
  categorie: string;
  type: string;
  sens: string;
  montant: number;
};

function LigneCategorie({ id, categorie }: { id: string; categorie: string }) {
  const [pending, start] = useTransition();
  const [valeur, setValeur] = useState(categorie);

  function onChange(next: string) {
    setValeur(next);
    start(async () => {
      const res = await recategoriserEcriture(id, next);
      if (!res.ok) {
        toast.error(res.error ?? "Changement impossible.");
        setValeur(categorie);
      }
    });
  }

  return (
    <Select value={valeur} onValueChange={onChange} disabled={pending}>
      <SelectTrigger
        size="sm"
        className={valeur === "a_categoriser" ? "border-warning-ink/40 text-warning-ink" : ""}
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {CATEGORIES_COMPTA.map((c) => (
          <SelectItem key={c.value} value={c.value}>
            {c.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export function EcrituresTable({ ecritures }: { ecritures: EcritureRow[] }) {
  const [filtre, setFiltre] = useState<"tous" | "a_categoriser">("tous");
  const [pendingIA, startIA] = useTransition();

  const nbACategoriser = ecritures.filter((e) => e.type === "a_categoriser").length;
  const rows =
    filtre === "a_categoriser"
      ? ecritures.filter((e) => e.type === "a_categoriser")
      : ecritures;

  function lancerIA() {
    startIA(async () => {
      const res = await categoriserAvecIA();
      if (res.ok) {
        toast.success(
          res.traitees > 0
            ? `${res.traitees} écriture(s) catégorisée(s) par l'IA. Vérifie et ajuste si besoin.`
            : "Rien à catégoriser, ou l'IA n'a pas su trancher.",
        );
      } else {
        toast.error(res.error);
      }
    });
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2 px-6">
        <div className="flex items-center gap-1">
          <Button
            variant={filtre === "tous" ? "secondary" : "ghost"}
            size="sm"
            onClick={() => setFiltre("tous")}
          >
            Tout ({ecritures.length})
          </Button>
          <Button
            variant={filtre === "a_categoriser" ? "secondary" : "ghost"}
            size="sm"
            onClick={() => setFiltre("a_categoriser")}
          >
            À catégoriser ({nbACategoriser})
          </Button>
        </div>
        {nbACategoriser > 0 ? (
          <Button variant="outline" size="sm" onClick={lancerIA} disabled={pendingIA}>
            {pendingIA ? (
              <Loader2 className="animate-spin" />
            ) : (
              <Sparkles className="text-brand" />
            )}
            Catégoriser avec l&apos;IA
          </Button>
        ) : null}
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="pl-6">Date</TableHead>
            <TableHead>Opération</TableHead>
            <TableHead className="w-[220px]">Catégorie</TableHead>
            <TableHead className="pr-6 text-right">Montant</TableHead>
            <TableHead className="w-10" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.length === 0 ? (
            <TableRow>
              <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
                Aucune écriture.
              </TableCell>
            </TableRow>
          ) : (
            rows.map((e) => {
              const entree = e.sens === "entree";
              return (
                <TableRow key={e.id}>
                  <TableCell className="pl-6 whitespace-nowrap text-muted-foreground">
                    {dateFr(e.date)}
                  </TableCell>
                  <TableCell className="max-w-[280px] truncate" title={e.libelle}>
                    {e.libelle}
                  </TableCell>
                  <TableCell>
                    <LigneCategorie id={e.id} categorie={e.categorie} />
                  </TableCell>
                  <TableCell className="pr-6 text-right">
                    <span
                      className={`inline-flex items-center gap-1 font-mono font-medium tabular-nums ${
                        entree ? "text-positive-ink" : "text-negative-ink"
                      }`}
                    >
                      {entree ? (
                        <ArrowDownLeft className="size-3.5" />
                      ) : (
                        <ArrowUpRight className="size-3.5" />
                      )}
                      {entree ? "+" : "−"}
                      {euros(e.montant)}
                    </span>
                  </TableCell>
                  <TableCell>
                    <ConfirmDelete
                      action={supprimerEcriture.bind(null, e.id)}
                      description="Supprimer cette écriture ? Elle sera réimportée si tu réenvoies le même relevé."
                      successMessage="Écriture supprimée."
                    />
                  </TableCell>
                </TableRow>
              );
            })
          )}
        </TableBody>
      </Table>
    </div>
  );
}
