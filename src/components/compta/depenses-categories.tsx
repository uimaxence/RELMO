"use client";

import { Fragment, useState } from "react";
import { ChevronRight } from "lucide-react";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { euros } from "@/lib/format";
import type { CategorieDetail } from "@/lib/compta";

// Répartition des dépenses par catégorie, chaque ligne dépliable pour voir le
// détail par fournisseur (« c'est quoi les abonnements qui partent »).
export function DepensesCategories({ categories }: { categories: CategorieDetail[] }) {
  const [ouvertes, setOuvertes] = useState<Set<string>>(new Set());
  const total = categories.reduce((s, c) => s + c.montant, 0);

  function toggle(cat: string) {
    setOuvertes((prev) => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat);
      else next.add(cat);
      return next;
    });
  }

  if (categories.length === 0) {
    return (
      <p className="px-6 py-4 text-sm text-muted-foreground">
        Aucune dépense sur cette période.
      </p>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="pl-6">Catégorie</TableHead>
          <TableHead className="text-right">Part</TableHead>
          <TableHead className="pr-6 text-right">Montant</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {categories.map((c) => {
          const ouverte = ouvertes.has(c.categorie);
          return (
            <Fragment key={c.categorie}>
              <TableRow
                className="cursor-pointer"
                onClick={() => toggle(c.categorie)}
              >
                <TableCell className="pl-6 font-medium">
                  <span className="flex items-center gap-1.5">
                    <ChevronRight
                      className={`size-4 text-muted-foreground transition-transform ${ouverte ? "rotate-90" : ""}`}
                    />
                    {c.label}
                    <span className="text-xs font-normal text-muted-foreground">
                      ({c.fournisseurs.length})
                    </span>
                  </span>
                </TableCell>
                <TableCell className="text-right font-mono tabular-nums text-muted-foreground">
                  {total > 0 ? `${Math.round((c.montant / total) * 100)}%` : "—"}
                </TableCell>
                <TableCell className="pr-6 text-right font-mono font-medium tabular-nums">
                  {euros(c.montant)}
                </TableCell>
              </TableRow>
              {ouverte
                ? c.fournisseurs.map((f, i) => (
                    <TableRow key={`${c.categorie}-${i}`} className="bg-muted/30">
                      <TableCell className="py-1.5 pl-12 text-sm text-muted-foreground">
                        {f.nom}
                        {f.occurrences > 1 ? (
                          <span className="ml-1.5 text-xs">×{f.occurrences}</span>
                        ) : null}
                      </TableCell>
                      <TableCell />
                      <TableCell className="py-1.5 pr-6 text-right font-mono text-sm tabular-nums text-muted-foreground">
                        {euros(f.montant)}
                      </TableCell>
                    </TableRow>
                  ))
                : null}
            </Fragment>
          );
        })}
      </TableBody>
    </Table>
  );
}
