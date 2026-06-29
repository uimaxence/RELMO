"use client";

import { useState } from "react";
import { Sparkles, Copy, RefreshCw, Check } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import type { AiResult } from "@/lib/ai/client";

// Dialog réutilisable de génération IA (cf. docs/IA.md §4) : génère à la demande,
// le texte atterrit dans un champ ÉDITABLE avec copier / régénérer. Rien n'est
// envoyé ni enregistré automatiquement — c'est un brouillon.
export function AiGenerateDialog({
  action,
  title,
  description,
  providerLabel,
  trigger,
}: {
  action: () => Promise<AiResult>;
  title: string;
  description: string;
  providerLabel: string;
  trigger?: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  async function generate() {
    setPending(true);
    setError(null);
    const res = await action();
    if (res.ok) {
      setText(res.text);
    } else {
      setError(res.error);
    }
    setPending(false);
  }

  function onOpenChange(next: boolean) {
    setOpen(next);
    if (next && !text && !pending) void generate();
    if (!next) {
      // Réinitialise pour la prochaine ouverture.
      setText("");
      setError(null);
      setCopied(false);
    }
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      toast.success("Copié dans le presse-papier.");
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error("Copie impossible.");
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button variant="outline">
            <Sparkles className="text-brand" /> {title}
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="size-4 text-brand" /> {title}
            <Badge variant="secondary" className="ml-1 font-normal">
              {providerLabel}
            </Badge>
          </DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        {error ? (
          <p className="rounded-lg bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {error}
          </p>
        ) : null}

        <Textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={pending ? "Génération en cours…" : "Le brouillon apparaîtra ici."}
          className="min-h-[260px] text-sm leading-relaxed"
          disabled={pending}
        />

        <DialogFooter className="sm:justify-between">
          <Button
            type="button"
            variant="ghost"
            onClick={generate}
            disabled={pending}
          >
            <RefreshCw className={pending ? "animate-spin" : ""} />
            {pending ? "Génération…" : text || error ? "Régénérer" : "Générer"}
          </Button>
          <Button type="button" onClick={copy} disabled={!text || pending}>
            {copied ? <Check /> : <Copy />} Copier
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
