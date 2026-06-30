"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { accepterDevisPortail } from "@/app/actions/portail";

export function AccepterDevisButton({
  token,
  devisId,
}: {
  token: string;
  devisId: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function accept() {
    startTransition(async () => {
      const res = await accepterDevisPortail(token, devisId);
      if (res.ok) {
        toast.success("Devis accepté — merci !");
        router.refresh();
      } else {
        toast.error(res.error ?? "Action impossible.");
      }
    });
  }

  return (
    <Button size="sm" onClick={accept} disabled={pending}>
      <Check /> {pending ? "…" : "Accepter ce devis"}
    </Button>
  );
}
