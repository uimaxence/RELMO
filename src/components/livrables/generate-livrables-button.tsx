"use client";

import { useTransition } from "react";
import { RefreshCw } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { generateLivrables } from "@/app/actions/livrables";

export function GenerateLivrablesButton({
  periode,
  label = "Générer les livrables",
}: {
  periode: string;
  label?: string;
}) {
  const [pending, startTransition] = useTransition();

  function onClick() {
    startTransition(async () => {
      const { created } = await generateLivrables(periode);
      if (created > 0) {
        toast.success(
          `${created} livrable${created > 1 ? "s" : ""} généré${created > 1 ? "s" : ""}.`,
        );
      } else {
        toast.info("Aucun livrable à générer (déjà à jour).");
      }
    });
  }

  return (
    <Button onClick={onClick} disabled={pending} variant="outline">
      <RefreshCw className={pending ? "animate-spin" : undefined} />
      {pending ? "Génération…" : label}
    </Button>
  );
}
