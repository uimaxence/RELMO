"use client";

import { useActionState, useState } from "react";
import { CheckCircle2, PencilLine } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Field } from "@/components/forms/form-ui";
import { enregistrerBriefPortail } from "@/app/actions/portail";
import { initialFormState, type FormState } from "@/lib/form";
import { UNIVERS_VISUELS, BRIEF_UNIVERS_MAX } from "@/lib/constants";
import { cn } from "@/lib/utils";

// Réponses existantes (sous-ensemble sérialisable du modèle Brief).
export type BriefValues = {
  daExistante: string | null;
  daUnivers: string | null;
  daDetail: string | null;
  charteExistante: string | null;
  charteDetail: string | null;
  sitesAimes: string | null;
  souhaits: string | null;
  aEviter: string | null;
  rempliLe: Date | null;
} | null;

// Le questionnaire de démarrage rempli par le client dans son portail (~5 min).
// Déjà rempli → résumé replié + bouton « Modifier mes réponses ».
export function BriefForm({
  token,
  brief,
}: {
  token: string;
  brief: BriefValues;
}) {
  const dejaRempli = Boolean(brief?.rempliLe);
  const [editing, setEditing] = useState(!dejaRempli);
  // Pastilles d'univers visuel : au plus BRIEF_UNIVERS_MAX choix.
  const [univers, setUnivers] = useState<string[]>(() =>
    (brief?.daUnivers ?? "").split(", ").filter(Boolean),
  );

  function toggleUnivers(u: string) {
    setUnivers((prev) =>
      prev.includes(u)
        ? prev.filter((x) => x !== u)
        : prev.length >= BRIEF_UNIVERS_MAX
          ? prev
          : [...prev, u],
    );
  }
  const [state, formAction, pending] = useActionState(
    async (prev: FormState, formData: FormData) => {
      const res = await enregistrerBriefPortail(token, prev, formData);
      if (res?.ok) {
        toast.success(res.message);
        setEditing(false);
      }
      return res;
    },
    initialFormState,
  );

  if (!editing) {
    return (
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="inline-flex items-center gap-2 text-sm text-muted-foreground">
          <CheckCircle2 className="size-4 text-positive" />
          Merci, vos réponses sont enregistrées. Vous pouvez les compléter à tout
          moment.
        </span>
        <Button size="sm" variant="outline" onClick={() => setEditing(true)}>
          <PencilLine /> Modifier mes réponses
        </Button>
      </div>
    );
  }

  return (
    <form action={formAction} className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label="Avez-vous déjà une direction artistique ?"
          error={state?.fieldErrors?.daExistante}
        >
          <Select name="daExistante" defaultValue={brief?.daExistante ?? undefined}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Choisir…" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="oui">Oui, elle est définie</SelectItem>
              <SelectItem value="partiel">En partie (quelques idées)</SelectItem>
              <SelectItem value="non">Non, tout est à imaginer</SelectItem>
            </SelectContent>
          </Select>
        </Field>
        <Field
          label="Avez-vous une charte graphique ou un logo ?"
          error={state?.fieldErrors?.charteExistante}
        >
          <Select
            name="charteExistante"
            defaultValue={brief?.charteExistante ?? undefined}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Choisir…" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="oui">Oui</SelectItem>
              <SelectItem value="non">Non</SelectItem>
            </SelectContent>
          </Select>
        </Field>
      </div>
      <div className="space-y-1.5">
        <p className="text-sm font-medium">
          L&apos;univers visuel qui vous parle{" "}
          <span className="font-normal text-muted-foreground">
            ({univers.length}/{BRIEF_UNIVERS_MAX} choix)
          </span>
        </p>
        <input type="hidden" name="daUnivers" value={univers.join(", ")} />
        <div className="flex flex-wrap gap-2">
          {UNIVERS_VISUELS.map((u) => {
            const actif = univers.includes(u);
            const plein = !actif && univers.length >= BRIEF_UNIVERS_MAX;
            return (
              <button
                key={u}
                type="button"
                onClick={() => toggleUnivers(u)}
                aria-pressed={actif}
                className={cn(
                  "rounded-full border px-3 py-1.5 text-sm transition-colors",
                  actif
                    ? "border-foreground bg-foreground text-background"
                    : "hover:border-foreground/40",
                  plein && "opacity-40",
                )}
              >
                {u}
              </button>
            );
          })}
        </div>
        <p className="text-xs text-muted-foreground">
          Choisissez jusqu&apos;à {BRIEF_UNIVERS_MAX} ambiances, au feeling.
        </p>
      </div>
      <Field
        label="Précisions sur l'univers visuel (optionnel)"
        htmlFor="daDetail"
        hint="Couleurs, ambiance, style : moderne, sobre, coloré, artisanal…"
      >
        <Input
          id="daDetail"
          name="daDetail"
          defaultValue={brief?.daDetail ?? ""}
          placeholder="Ex. tons naturels, ambiance chaleureuse, pas trop chargé"
        />
      </Field>
      <Field
        label="Un lien vers vos fichiers (optionnel)"
        htmlFor="charteDetail"
        hint="Drive, Dropbox, WeTransfer… si vos éléments sont déjà en ligne. Sinon, déposez logo et visuels juste en dessous du formulaire."
      >
        <Input
          id="charteDetail"
          name="charteDetail"
          defaultValue={brief?.charteDetail ?? ""}
          placeholder="Ex. https://drive.google.com/..."
        />
      </Field>
      <Field
        label="Des sites que vous aimez"
        htmlFor="sitesAimes"
        hint="Concurrents ou non : collez les liens et dites en un mot ce qui vous plaît."
      >
        <Textarea
          id="sitesAimes"
          name="sitesAimes"
          defaultValue={brief?.sitesAimes ?? ""}
          placeholder={"Ex. https://exemple.fr : j'aime la page d'accueil, très claire"}
        />
      </Field>
      <Field label="Ce que vous aimeriez voir sur votre site" htmlFor="souhaits">
        <Textarea
          id="souhaits"
          name="souhaits"
          defaultValue={brief?.souhaits ?? ""}
          placeholder="Ex. mettre en avant les avis clients, une galerie de réalisations, un formulaire de contact simple"
        />
      </Field>
      <Field label="Ce que vous ne voulez surtout pas" htmlFor="aEviter">
        <Textarea
          id="aEviter"
          name="aEviter"
          defaultValue={brief?.aEviter ?? ""}
          placeholder="Ex. pas de fond sombre, pas de photos génériques de banque d'images"
        />
      </Field>
      <div className="flex items-center justify-end gap-2">
        {dejaRempli ? (
          <Button
            type="button"
            variant="ghost"
            onClick={() => setEditing(false)}
            disabled={pending}
          >
            Annuler
          </Button>
        ) : null}
        <Button type="submit" disabled={pending}>
          {pending ? "Envoi…" : "Envoyer mes réponses"}
        </Button>
      </div>
    </form>
  );
}
