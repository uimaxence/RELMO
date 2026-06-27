"use client";

import { useState, useTransition } from "react";
import { RefreshCw, Plus } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { generateTachesAction, addTache } from "@/app/actions/taches";

export function GenerateTachesButton({ date }: { date: string }) {
  const [pending, startTransition] = useTransition();
  return (
    <Button
      variant="outline"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const { created } = await generateTachesAction(date);
          toast[created > 0 ? "success" : "info"](
            created > 0
              ? `${created} tâche${created > 1 ? "s" : ""} ajoutée${created > 1 ? "s" : ""}.`
              : "Rien de nouveau à générer.",
          );
        })
      }
    >
      <RefreshCw className={pending ? "animate-spin" : undefined} />
      Régénérer
    </Button>
  );
}

export function AddTacheForm({ date }: { date: string }) {
  const [libelle, setLibelle] = useState("");
  const [pending, startTransition] = useTransition();

  function submit() {
    if (!libelle.trim()) return;
    startTransition(async () => {
      await addTache(date, libelle);
      setLibelle("");
    });
  }

  return (
    <form
      action={submit}
      className="flex gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      <Input
        value={libelle}
        onChange={(e) => setLibelle(e.target.value)}
        placeholder="Ajouter une tâche…"
      />
      <Button type="submit" variant="outline" disabled={pending || !libelle.trim()}>
        <Plus /> Ajouter
      </Button>
    </form>
  );
}
