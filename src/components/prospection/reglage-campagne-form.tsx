"use client";

import { useActionState, useState } from "react";
import { ChevronDown, Settings2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
import { updateReglageCampagne } from "@/app/actions/envies";
import { initialFormState, type FormState } from "@/lib/form";
import { DEFAUT_OPT_OUT } from "@/lib/constants";
import { MODELES_REMU, modeleRemuValide } from "@/lib/prospection/metiers-partenaires";

// Contenus injectés dans chaque mail : signature, opt-out, lien de réalisation
// (remplace le placeholder [lien d'une réalisation]) + modèle de rémunération
// des pitchs partenaires. Repliable.
export function ReglageCampagneForm({
  signatureEmail,
  optOutTexte,
  lienRealisation,
  modeleRemu,
  relanceAutoActive,
  prospectionAutoActive,
}: {
  signatureEmail: string | null;
  optOutTexte: string | null;
  lienRealisation: string | null;
  modeleRemu: string;
  relanceAutoActive: boolean;
  prospectionAutoActive: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(
    async (prev: FormState, formData: FormData) => {
      const res = await updateReglageCampagne(prev, formData);
      if (res?.ok) toast.success(res.message);
      else if (res) toast.error(res.message ?? "Erreur.");
      return res;
    },
    initialFormState,
  );

  return (
    <Card>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-2 px-4 py-3 text-left text-sm font-medium"
      >
        <Settings2 className="size-4 text-muted-foreground" />
        Réglages de campagne (signature, opt-out, lien de réalisation)
        <ChevronDown
          className={`ml-auto size-4 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>
      {open ? (
        <CardContent className="pt-0">
          <form action={formAction} className="space-y-4">
            <Field
              label="Signature"
              htmlFor="signatureEmail"
              hint="Ajoutée en pied de chaque mail."
              error={state?.fieldErrors?.signatureEmail}
            >
              <Textarea
                id="signatureEmail"
                name="signatureEmail"
                defaultValue={signatureEmail ?? ""}
                placeholder={"Maxence Cailleau\nDesigner web · Angers\nhttps://…"}
                className="min-h-[90px]"
              />
            </Field>
            <Field
              label="Lien de réalisation"
              htmlFor="lienRealisation"
              hint="Remplace automatiquement [lien d'une réalisation] dans les mails."
              error={state?.fieldErrors?.lienRealisation}
            >
              <Input
                id="lienRealisation"
                name="lienRealisation"
                type="url"
                defaultValue={lienRealisation ?? ""}
                placeholder="https://ton-site.fr/realisations/…"
              />
            </Field>
            <Field
              label="Rémunération proposée aux partenaires"
              htmlFor="modeleRemu"
              hint="Adapte les pitchs « apporteurs d'affaires ». Toujours réciprocité pour les experts-comptables (déontologie)."
            >
              <Select name="modeleRemu" defaultValue={modeleRemuValide(modeleRemu)}>
                <SelectTrigger id="modeleRemu" className="w-full sm:max-w-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MODELES_REMU.map((m) => (
                    <SelectItem key={m.value} value={m.value}>
                      {m.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field
              label="Mention opt-out (RGPD)"
              htmlFor="optOutTexte"
              hint="Obligatoire en prospection B2B. Laisse vide pour le texte par défaut."
              error={state?.fieldErrors?.optOutTexte}
            >
              <Textarea
                id="optOutTexte"
                name="optOutTexte"
                defaultValue={optOutTexte ?? ""}
                placeholder={DEFAUT_OPT_OUT}
                className="min-h-[70px]"
              />
            </Field>
            <div className="rounded-md border border-border bg-muted/30 p-3">
              <label htmlFor="relanceAutoActive" className="flex items-start gap-3 text-sm">
                <input
                  id="relanceAutoActive"
                  name="relanceAutoActive"
                  type="checkbox"
                  defaultChecked={relanceAutoActive}
                  className="mt-0.5 size-4 shrink-0 accent-primary"
                />
                <span>
                  <span className="font-medium">Relances automatiques</span>
                  <span className="mt-0.5 block text-muted-foreground">
                    Un cron quotidien relance les prospects sans réponse (2 relances max, espacées
                    de 5 jours). Les réponses et les « STOP » sont détectés automatiquement
                    (IMAP) pour ne jamais relancer quelqu&apos;un qui a répondu. Nécessite IMAP + CRON_SECRET.
                  </span>
                </span>
              </label>
            </div>
            <div className="rounded-md border border-border bg-muted/30 p-3">
              <label htmlFor="prospectionAutoActive" className="flex items-start gap-3 text-sm">
                <input
                  id="prospectionAutoActive"
                  name="prospectionAutoActive"
                  type="checkbox"
                  defaultChecked={prospectionAutoActive}
                  className="mt-0.5 size-4 shrink-0 accent-primary"
                />
                <span>
                  <span className="font-medium">Prospection automatique</span>
                  <span className="mt-0.5 block text-muted-foreground">
                    Deux fois par jour, découvre et audite de nouveaux prospects (4 secteurs,
                    Pays de la Loire) et les met dans la file d&apos;envoi. Ceux avec email sont
                    prêts à envoyer en 1 clic ; ceux sans email restent « à traiter » (tu complètes
                    l&apos;adresse). Aucun envoi automatique. Nécessite GOOGLE_PLACES_API_KEY (et GEMINI_API_KEY).
                  </span>
                </span>
              </label>
            </div>
            <Button type="submit" disabled={pending}>
              {pending ? "Enregistrement…" : "Enregistrer"}
            </Button>
          </form>
        </CardContent>
      ) : null}
    </Card>
  );
}
