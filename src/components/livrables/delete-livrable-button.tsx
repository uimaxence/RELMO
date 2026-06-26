"use client";

import { useTransition } from "react";
import { X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { deleteLivrable } from "@/app/actions/livrables";

export function DeleteLivrableButton({ id }: { id: string }) {
  const [pending, startTransition] = useTransition();

  return (
    <Button
      variant="ghost"
      size="icon"
      aria-label="Supprimer le livrable"
      disabled={pending}
      onClick={() => startTransition(async () => void deleteLivrable(id))}
    >
      <X className="text-muted-foreground" />
    </Button>
  );
}
