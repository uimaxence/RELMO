"use client";

import { useTransition } from "react";
import { Download, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { exporterProspectionCsv } from "@/app/actions/prospection";

// Télécharge un CSV propre des fiches de prospection (contexte + message généré vs
// envoyé + réponse) pour l'analyser hors-app. Deux portées.
export function ExportProspectsButton() {
  const [pending, start] = useTransition();

  function exporter(scope: "contactes" | "tous") {
    start(async () => {
      const res = await exporterProspectionCsv(scope);
      if (!res.ok || !res.csv) {
        toast.error(res.error ?? "Export impossible.");
        return;
      }
      const blob = new Blob([res.csv], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = res.filename ?? "prospection.csv";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast.success(`${res.count} fiche${(res.count ?? 0) > 1 ? "s" : ""} exportée${(res.count ?? 0) > 1 ? "s" : ""}.`);
    });
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" disabled={pending}>
          {pending ? <Loader2 className="animate-spin" /> : <Download />} Exporter CSV
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>Export CSV</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => exporter("contactes")}>
          Contactés — message + réponse
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => exporter("tous")}>
          Tous les prospects
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
