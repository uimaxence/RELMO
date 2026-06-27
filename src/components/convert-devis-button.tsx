"use client";

import { useTransition } from "react";
import { ArrowRightLeft } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { convertDevisToContrat } from "@/app/actions/devis";

export function ConvertDevisButton({ id }: { id: string }) {
  const [pending, startTransition] = useTransition();

  function onClick() {
    startTransition(async () => {
      const res = await convertDevisToContrat(id);
      if (res?.ok) toast.success(res.message);
      else toast.error(res?.message ?? "Conversion impossible.");
    });
  }

  return (
    <Button size="sm" variant="outline" onClick={onClick} disabled={pending}>
      <ArrowRightLeft /> {pending ? "Conversion…" : "Convertir en contrat"}
    </Button>
  );
}
