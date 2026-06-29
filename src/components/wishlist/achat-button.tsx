"use client";

import { useTransition } from "react";
import { Check, RotateCcw } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { toggleEnvieAchat } from "@/app/actions/envies";

// Marque une envie débloquée comme « offerte » (ou annule l'achat).
export function AchatButton({
  id,
  achete,
}: {
  id: string;
  achete: boolean;
}) {
  const [pending, startTransition] = useTransition();

  function onClick() {
    startTransition(async () => {
      await toggleEnvieAchat(id);
      toast.success(achete ? "Achat annulé." : "Récompense débloquée 🎉");
    });
  }

  return achete ? (
    <Button size="sm" variant="ghost" onClick={onClick} disabled={pending}>
      <RotateCcw /> Annuler
    </Button>
  ) : (
    <Button size="sm" onClick={onClick} disabled={pending}>
      <Check /> Je me l&apos;offre
    </Button>
  );
}
