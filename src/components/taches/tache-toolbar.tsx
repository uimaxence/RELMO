"use client";

import { useRef, useState, useTransition } from "react";
import { RefreshCw, Plus, AtSign } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { generateTachesAction, addTache } from "@/app/actions/taches";

export type ClientMention = { id: string; nom: string };

export function GenerateTachesButton({ semaine }: { semaine: string }) {
  const [pending, startTransition] = useTransition();
  return (
    <Button
      variant="outline"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const { created } = await generateTachesAction(semaine);
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

// Token @mention sous le curseur : « …texte @requ| » → "requ". Le token court
// jusqu'au caret et s'arrête à un @ (pour ne pas capter une adresse e-mail entière).
const MENTION_RE = /@([^@\n]*)$/;

export function AddTacheForm({
  semaine,
  clients,
}: {
  semaine: string;
  clients: ClientMention[];
}) {
  const [libelle, setLibelle] = useState("");
  // Clients tagués (un @nom inséré). Sert à lier la tâche à la fiche.
  const [tags, setTags] = useState<ClientMention[]>([]);
  const [query, setQuery] = useState<string | null>(null);
  const [active, setActive] = useState(0);
  const [pending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);

  // Suggestions : ouvertes seulement s'il y a un token @ ET des résultats.
  const suggestions =
    query === null
      ? []
      : clients
          .filter((c) =>
            c.nom.toLowerCase().includes(query.trim().toLowerCase()),
          )
          .slice(0, 6);
  const menuOpen = query !== null && suggestions.length > 0;

  function refreshQuery(value: string, caret: number) {
    const m = value.slice(0, caret).match(MENTION_RE);
    setQuery(m ? m[1] : null);
    setActive(0);
  }

  function onChange(e: React.ChangeEvent<HTMLInputElement>) {
    const value = e.target.value;
    setLibelle(value);
    refreshQuery(value, e.target.selectionStart ?? value.length);
  }

  function pick(client: ClientMention) {
    const el = inputRef.current;
    const caret = el?.selectionStart ?? libelle.length;
    const before = libelle.slice(0, caret).replace(MENTION_RE, "");
    const after = libelle.slice(caret);
    const next = `${before}@${client.nom} ${after}`;
    setLibelle(next);
    setTags((prev) =>
      prev.some((t) => t.id === client.id) ? prev : [...prev, client],
    );
    setQuery(null);
    // Replace le caret juste après le @mention inséré.
    const pos = before.length + client.nom.length + 2;
    requestAnimationFrame(() => {
      el?.focus();
      el?.setSelectionRange(pos, pos);
    });
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!menuOpen) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((i) => (i + 1) % suggestions.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => (i - 1 + suggestions.length) % suggestions.length);
    } else if (e.key === "Enter" || e.key === "Tab") {
      e.preventDefault();
      pick(suggestions[active]);
    } else if (e.key === "Escape") {
      setQuery(null);
    }
  }

  function submit() {
    if (!libelle.trim()) return;
    // On ne lie que les clients dont le @mention est encore dans le texte.
    const linked = tags.find((t) => libelle.includes(`@${t.nom}`));
    startTransition(async () => {
      await addTache(semaine, libelle, linked?.id);
      setLibelle("");
      setTags([]);
      setQuery(null);
    });
  }

  return (
    <form
      action={submit}
      className="relative flex gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      <div className="relative flex-1">
        <Input
          ref={inputRef}
          value={libelle}
          onChange={onChange}
          onKeyDown={onKeyDown}
          onBlur={() => setTimeout(() => setQuery(null), 120)}
          placeholder="Ajouter une tâche…  (tape @ pour taguer un client)"
          autoComplete="off"
        />
        {menuOpen ? (
          <ul className="absolute bottom-full z-20 mb-1 max-h-60 w-full overflow-y-auto rounded-lg border bg-popover p-1 shadow-md">
            {suggestions.map((c, i) => (
              <li key={c.id}>
                <button
                  type="button"
                  // onMouseDown : se déclenche avant le blur de l'input.
                  onMouseDown={(e) => {
                    e.preventDefault();
                    pick(c);
                  }}
                  className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm ${
                    i === active ? "bg-accent" : "hover:bg-accent"
                  }`}
                >
                  <AtSign className="size-3.5 text-brand" />
                  {c.nom}
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
      <Button type="submit" variant="outline" disabled={pending || !libelle.trim()}>
        <Plus /> Ajouter
      </Button>
    </form>
  );
}
