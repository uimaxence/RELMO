"use client";

import { useActionState, useState } from "react";
import { Check, CheckCircle2, PencilLine, ArrowLeft, ArrowRight } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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

const NB_ETAPES = 4;

// Pastille de choix unique (façon onboarding) : grande, arrondie, coche visible.
function Pastille({
  actif,
  onClick,
  children,
  disabled,
}: {
  actif: boolean;
  onClick: () => void;
  children: React.ReactNode;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={actif}
      className={cn(
        "inline-flex items-center gap-2 rounded-full border px-4 py-2.5 text-sm transition-colors sm:text-base",
        actif
          ? "border-brand bg-brand/5 font-medium"
          : "hover:border-foreground/40",
        disabled && !actif && "opacity-40",
      )}
    >
      {actif ? (
        <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-brand text-white">
          <Check className="size-3" strokeWidth={3} />
        </span>
      ) : null}
      {children}
    </button>
  );
}

// Intitulé de question, volontairement grand et lisible (pas un label technique).
function Question({
  titre,
  aide,
  children,
}: {
  titre: string;
  aide?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-3">
      <div>
        <p className="text-base font-medium sm:text-lg">{titre}</p>
        {aide ? (
          <p className="mt-0.5 text-sm text-muted-foreground">{aide}</p>
        ) : null}
      </div>
      {children}
    </div>
  );
}

// Le questionnaire de démarrage rempli par le client dans son portail (~5 min).
// Parcours en 4 étapes façon onboarding : une thématique par écran, pastilles,
// barre de progression. Tous les champs restent montés (cachés en CSS) pour que
// le FormData final contienne toutes les réponses. Déjà rempli → résumé replié.
export function BriefForm({
  token,
  brief,
}: {
  token: string;
  brief: BriefValues;
}) {
  const dejaRempli = Boolean(brief?.rempliLe);
  const [editing, setEditing] = useState(!dejaRempli);
  const [etape, setEtape] = useState(0);
  const [da, setDa] = useState(brief?.daExistante ?? "");
  const [charte, setCharte] = useState(brief?.charteExistante ?? "");
  // Pastilles d'univers visuel : au plus BRIEF_UNIVERS_MAX choix. Séparateur
  // « · » : les libellés eux-mêmes contiennent des virgules.
  const [univers, setUnivers] = useState<string[]>(() =>
    (brief?.daUnivers ?? "").split(" · ").filter(Boolean),
  );
  const [state, formAction, pending] = useActionState(
    async (prev: FormState, formData: FormData) => {
      const res = await enregistrerBriefPortail(token, prev, formData);
      if (res?.ok) {
        toast.success(res.message);
        setEditing(false);
        setEtape(0);
      }
      return res;
    },
    initialFormState,
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

  const derniere = etape === NB_ETAPES - 1;

  return (
    <form
      action={formAction}
      onKeyDown={(e) => {
        // Entrée dans un champ texte = étape suivante, pas d'envoi prématuré.
        if (
          e.key === "Enter" &&
          !derniere &&
          !(e.target instanceof HTMLTextAreaElement)
        ) {
          e.preventDefault();
          setEtape((s) => Math.min(s + 1, NB_ETAPES - 1));
        }
      }}
      className="space-y-8"
    >
      {/* Progression */}
      <div className="space-y-2">
        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Étape {etape + 1} sur {NB_ETAPES}
        </p>
        <div className="h-1.5 overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-brand transition-all duration-300"
            style={{ width: `${((etape + 1) / NB_ETAPES) * 100}%` }}
          />
        </div>
      </div>

      {state?.message && !state.ok ? (
        <p className="rounded-lg bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {state.message}
        </p>
      ) : null}

      {/* Étape 1 : votre image aujourd'hui */}
      <div className={cn("space-y-8", etape !== 0 && "hidden")}>
        <input type="hidden" name="daExistante" value={da} />
        <input type="hidden" name="charteExistante" value={charte} />
        <Question titre="Avez-vous déjà une direction artistique ?">
          <div className="flex flex-wrap gap-2.5">
            {[
              ["oui", "Oui, elle est définie"],
              ["partiel", "En partie, quelques idées"],
              ["non", "Non, tout est à imaginer"],
            ].map(([v, label]) => (
              <Pastille
                key={v}
                actif={da === v}
                onClick={() => setDa(da === v ? "" : v)}
              >
                {label}
              </Pastille>
            ))}
          </div>
        </Question>
        <Question titre="Avez-vous une charte graphique ou un logo ?">
          <div className="flex flex-wrap gap-2.5">
            {[
              ["oui", "Oui"],
              ["non", "Non"],
            ].map(([v, label]) => (
              <Pastille
                key={v}
                actif={charte === v}
                onClick={() => setCharte(charte === v ? "" : v)}
              >
                {label}
              </Pastille>
            ))}
          </div>
        </Question>
      </div>

      {/* Étape 2 : l'univers qui vous ressemble */}
      <div className={cn("space-y-8", etape !== 1 && "hidden")}>
        <input type="hidden" name="daUnivers" value={univers.join(" · ")} />
        <Question
          titre="Quel univers vous ressemble ?"
          aide={`Choisissez jusqu'à ${BRIEF_UNIVERS_MAX} ambiances, au feeling (${univers.length}/${BRIEF_UNIVERS_MAX}).`}
        >
          <div className="flex flex-wrap gap-2.5">
            {UNIVERS_VISUELS.map((u) => (
              <Pastille
                key={u}
                actif={univers.includes(u)}
                onClick={() => toggleUnivers(u)}
                disabled={univers.length >= BRIEF_UNIVERS_MAX}
              >
                {u}
              </Pastille>
            ))}
          </div>
        </Question>
        <Question
          titre="Envie de préciser ?"
          aide="Couleurs, ambiance, un détail qui compte pour vous. Facultatif."
        >
          <Input
            name="daDetail"
            defaultValue={brief?.daDetail ?? ""}
            placeholder="Ex. tons naturels, ambiance chaleureuse, pas trop chargé"
            className="h-11 rounded-xl text-base"
          />
        </Question>
      </div>

      {/* Étape 3 : vos inspirations */}
      <div className={cn("space-y-8", etape !== 2 && "hidden")}>
        <Question
          titre="Des sites que vous aimez ?"
          aide="Concurrents ou non : collez les liens et dites en un mot ce qui vous plaît."
        >
          <Textarea
            name="sitesAimes"
            defaultValue={brief?.sitesAimes ?? ""}
            placeholder={"Ex. https://exemple.fr : j'aime la page d'accueil, très claire"}
            className="min-h-28 rounded-xl text-base"
          />
        </Question>
        <Question
          titre="Un lien vers vos fichiers ?"
          aide="Drive, Dropbox, WeTransfer… si vos éléments sont déjà en ligne. Vous pourrez aussi déposer logo et visuels juste en dessous du questionnaire."
        >
          <Input
            name="charteDetail"
            defaultValue={brief?.charteDetail ?? ""}
            placeholder="Ex. https://drive.google.com/..."
            className="h-11 rounded-xl text-base"
          />
        </Question>
      </div>

      {/* Étape 4 : vos envies */}
      <div className={cn("space-y-8", etape !== 3 && "hidden")}>
        <Question titre="Qu'aimeriez-vous voir sur votre site ?">
          <Textarea
            name="souhaits"
            defaultValue={brief?.souhaits ?? ""}
            placeholder="Ex. mettre en avant les avis clients, une galerie de réalisations, un formulaire de contact simple"
            className="min-h-28 rounded-xl text-base"
          />
        </Question>
        <Question titre="Et ce que vous ne voulez surtout pas ?">
          <Textarea
            name="aEviter"
            defaultValue={brief?.aEviter ?? ""}
            placeholder="Ex. pas de fond sombre, pas de photos génériques de banque d'images"
            className="min-h-28 rounded-xl text-base"
          />
        </Question>
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-between gap-2 pt-1">
        {etape > 0 ? (
          <Button
            type="button"
            variant="ghost"
            size="lg"
            onClick={() => setEtape((s) => s - 1)}
            disabled={pending}
          >
            <ArrowLeft /> Retour
          </Button>
        ) : dejaRempli ? (
          <Button
            type="button"
            variant="ghost"
            size="lg"
            onClick={() => setEditing(false)}
            disabled={pending}
          >
            Annuler
          </Button>
        ) : (
          <span />
        )}
        {derniere ? (
          // key distincte : sans elle React MUTE le bouton « Suivant » en
          // type=submit sur le même nœud DOM et le clic en cours soumet le form.
          <Button key="envoyer" type="submit" size="lg" disabled={pending}>
            {pending ? "Envoi…" : "Envoyer mes réponses"}
          </Button>
        ) : (
          <Button
            key="suivant"
            type="button"
            size="lg"
            onClick={() => setEtape((s) => s + 1)}
          >
            Suivant <ArrowRight />
          </Button>
        )}
      </div>
    </form>
  );
}
