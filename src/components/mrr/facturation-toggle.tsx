"use client";

import { useTransition } from "react";
import { CheckCircle2, Clock, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { marquerFacturationDemarree } from "@/app/actions/contrats";

// Bascule l'état de facturation d'un contrat démarré, directement depuis la
// page MRR. `facturee=false` → bouton « Marquer facturé » ; sinon « En attente ».
export function FacturationToggle({
  contratId,
  facturee,
}: {
  contratId: string;
  facturee: boolean;
}) {
  const [pending, start] = useTransition();

  function toggle() {
    start(async () => {
      await marquerFacturationDemarree(contratId, !facturee);
      toast.success(
        facturee
          ? "Repassé en attente de facturation — retiré du MRR."
          : "Marqué comme facturé — compté dans le MRR.",
      );
    });
  }

  return (
    <Button size="sm" variant={facturee ? "ghost" : "outline"} onClick={toggle} disabled={pending}>
      {pending ? (
        <Loader2 className="animate-spin" />
      ) : facturee ? (
        <Clock />
      ) : (
        <CheckCircle2 className="text-brand" />
      )}
      {facturee ? "Repasser en attente" : "Marquer facturé"}
    </Button>
  );
}
