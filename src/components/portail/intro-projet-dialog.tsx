"use client";

import { useActionState, useState } from "react";
import { Sparkles, RefreshCw, PencilLine } from "lucide-react";
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
import { actionIntroPortail } from "@/app/actions/ai";
import { enregistrerIntroPortail } from "@/app/actions/portail";
import { initialFormState, type FormState } from "@/lib/form";

// Édition du texte d'accueil de l'espace projet : brouillon DeepSeek à la
// demande, toujours relu/édité avant publication (rien d'automatique).
export function IntroProjetDialog({
  clientId,
  intro,
}: {
  clientId: string;
  intro: string | null;
}) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState(intro ?? "");
  const [generating, setGenerating] = useState(false);
  const [state, formAction, pending] = useActionState(
    async (prev: FormState, formData: FormData) => {
      const res = await enregistrerIntroPortail(clientId, prev, formData);
      if (res?.ok) {
        toast.success(res.message);
        setOpen(false);
      }
      return res;
    },
    initialFormState,
  );

  async function generate() {
    setGenerating(true);
    const res = await actionIntroPortail(clientId);
    if (res.ok) setText(res.text);
    else toast.error(res.error);
    setGenerating(false);
  }

  function onOpenChange(next: boolean) {
    setOpen(next);
    if (next) setText(intro ?? "");
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          {intro ? <PencilLine /> : <Sparkles className="text-brand" />}
          {intro ? "Modifier l'accueil" : "Rédiger l'accueil"}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Accueil de l&apos;espace projet
            <Badge variant="secondary" className="ml-1 font-normal">
              DeepSeek
            </Badge>
          </DialogTitle>
          <DialogDescription>
            Le texte affiché en haut du portail du client : bienvenue, objectifs,
            ce qu&apos;on va faire. Généré à partir du devis, relis avant de
            publier.
          </DialogDescription>
        </DialogHeader>
        {state?.message && !state.ok ? (
          <p className="rounded-lg bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {state.message}
          </p>
        ) : null}
        <form action={formAction} className="space-y-4">
          <Textarea
            name="portailIntro"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={
              generating
                ? "Génération en cours…"
                : "Bienvenue dans votre espace… (ou cliquez sur Générer un brouillon)"
            }
            className="min-h-[220px] text-sm leading-relaxed"
            disabled={generating}
          />
          <DialogFooter className="sm:justify-between">
            <Button
              type="button"
              variant="ghost"
              onClick={generate}
              disabled={generating || pending}
            >
              <RefreshCw className={generating ? "animate-spin" : ""} />
              {generating ? "Génération…" : "Générer un brouillon"}
            </Button>
            <Button type="submit" disabled={pending || generating}>
              {pending ? "Publication…" : "Publier sur l'espace"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
