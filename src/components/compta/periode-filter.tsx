"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { CalendarRange } from "lucide-react";

import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { periodeLabel } from "@/lib/periode";
import { trimestreLabel } from "@/lib/compta";

// Filtre de période global : tout / par mois / par trimestre. Navigue via le
// query param `?p=` — la page (server) recalcule tout selon ce paramètre.
export function PeriodeFilter({
  value,
  mois,
  trimestres,
}: {
  value: string;
  mois: string[];
  trimestres: string[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();

  function onChange(next: string) {
    start(() => {
      router.push(next === "tout" ? "/comptabilite" : `/comptabilite?p=${next}`);
    });
  }

  return (
    <Select value={value} onValueChange={onChange} disabled={pending}>
      <SelectTrigger className="w-[190px]">
        <CalendarRange className="size-4 text-muted-foreground" />
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="tout">Depuis le début</SelectItem>
        {trimestres.length > 0 ? (
          <SelectGroup>
            <SelectLabel>Par trimestre</SelectLabel>
            {trimestres.map((t) => (
              <SelectItem key={t} value={t}>
                {trimestreLabel(t)}
              </SelectItem>
            ))}
          </SelectGroup>
        ) : null}
        {mois.length > 0 ? (
          <SelectGroup>
            <SelectLabel>Par mois</SelectLabel>
            {mois.map((m) => (
              <SelectItem key={m} value={m} className="capitalize">
                {periodeLabel(m)}
              </SelectItem>
            ))}
          </SelectGroup>
        ) : null}
      </SelectContent>
    </Select>
  );
}
