"use client";

import { useState, useTransition } from "react";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { LIVRABLE_STATUTS } from "@/lib/constants";
import { setLivrableStatut } from "@/app/actions/livrables";

const TRIGGER_STYLE: Record<string, string> = {
  fait: "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
  a_faire: "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-400",
  non_applicable: "text-muted-foreground",
};

export function LivrableStatutControl({
  id,
  statut,
}: {
  id: string;
  statut: string;
}) {
  const [value, setValue] = useState(statut);
  const [pending, startTransition] = useTransition();

  function onChange(next: string) {
    setValue(next);
    startTransition(async () => {
      await setLivrableStatut(id, next);
    });
  }

  return (
    <Select value={value} onValueChange={onChange} disabled={pending}>
      <SelectTrigger size="sm" className={cn("w-[150px]", TRIGGER_STYLE[value])}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {LIVRABLE_STATUTS.map((s) => (
          <SelectItem key={s.value} value={s.value}>
            {s.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
