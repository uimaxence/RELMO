"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { Plus, X, RefreshCw, TrendingUp } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/forms/form-ui";
import { initialFormState } from "@/lib/form";
import { periodeLabel } from "@/lib/periode";
import { updateSiteSeo, addMotCle, deleteMotCle, releverMaintenant } from "@/app/actions/seo";

type MotCle = {
  id: string;
  texte: string;
  dernierePosition: number | null;
  dernierePeriode: string | null;
};

type SiteSeo = {
  id: string;
  domaine: string | null;
  url: string | null;
  seoLocation: string | null;
  seoLangue: string;
};

export function SeoCard({
  site,
  motsCles,
  configured,
}: {
  site: SiteSeo;
  motsCles: MotCle[];
  configured: boolean;
}) {
  const [cibleState, cibleAction, ciblePending] = useActionState(updateSiteSeo, initialFormState);
  const [motState, motAction] = useActionState(addMotCle, initialFormState);
  const [relevePending, startReleve] = useTransition();
  const [deletePending, startDelete] = useTransition();
  const addFormRef = useRef<HTMLFormElement>(null);
  const [flashCible, setFlashCible] = useState(false);

  // Toast + reset du champ après ajout d'un mot-clé.
  const prevMot = useRef(motState);
  useEffect(() => {
    if (motState !== prevMot.current) {
      prevMot.current = motState;
      if (motState?.ok) {
        toast.success(motState.message);
        addFormRef.current?.reset();
      } else if (motState?.message) {
        toast.error(motState.message);
      }
    }
  }, [motState]);

  const prevCible = useRef(cibleState);
  useEffect(() => {
    if (cibleState !== prevCible.current) {
      prevCible.current = cibleState;
      if (cibleState?.ok) toast.success(cibleState.message);
      else if (cibleState?.message) toast.error(cibleState.message);
    }
  }, [cibleState]);

  function relever() {
    const fd = new FormData();
    fd.set("siteId", site.id);
    startReleve(async () => {
      const res = await releverMaintenant(null, fd);
      if (res?.ok) toast.success(res.message);
      else toast.error(res?.message ?? "Relevé impossible.");
    });
  }

  function supprimer(id: string) {
    startDelete(async () => {
      await deleteMotCle(id, site.id);
    });
  }

  const cibleRenseignee = Boolean(site.domaine || site.url);

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="size-4 text-brand" /> Suivi SEO
          </CardTitle>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={relever}
            disabled={relevePending || !configured || !cibleRenseignee || motsCles.length === 0}
          >
            <RefreshCw className={relevePending ? "animate-spin" : ""} />
            {relevePending ? "Relevé…" : "Relever maintenant"}
          </Button>
        </div>
        {!configured ? (
          <p className="text-xs text-muted-foreground">
            Identifiants DataForSEO absents : ajoute DATAFORSEO_LOGIN et DATAFORSEO_PASSWORD dans
            .env pour relever les positions.
          </p>
        ) : null}
      </CardHeader>
      <CardContent className="space-y-5">
        {/* Cible de relevé */}
        <form action={cibleAction} className="space-y-3">
          <input type="hidden" name="siteId" value={site.id} />
          <div className="grid gap-3 sm:grid-cols-3">
            <Field
              label="Domaine"
              htmlFor="domaine"
              error={cibleState?.fieldErrors?.domaine}
              hint="sans http ni www"
            >
              <Input
                id="domaine"
                name="domaine"
                defaultValue={site.domaine ?? ""}
                placeholder={site.url ? "(URL du site par défaut)" : "exemple.fr"}
                onChange={() => setFlashCible(true)}
              />
            </Field>
            <Field label="Localisation" htmlFor="seoLocation" hint="ex. France, Lyon,France">
              <Input
                id="seoLocation"
                name="seoLocation"
                defaultValue={site.seoLocation ?? ""}
                placeholder="France"
                onChange={() => setFlashCible(true)}
              />
            </Field>
            <Field label="Langue" htmlFor="seoLangue">
              <Input
                id="seoLangue"
                name="seoLangue"
                defaultValue={site.seoLangue}
                placeholder="fr"
                onChange={() => setFlashCible(true)}
              />
            </Field>
          </div>
          {flashCible ? (
            <Button type="submit" variant="outline" size="sm" disabled={ciblePending}>
              {ciblePending ? "Enregistrement…" : "Enregistrer la cible"}
            </Button>
          ) : null}
        </form>

        {/* Mots-clés suivis */}
        <div>
          <h3 className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Mots-clés suivis ({motsCles.length})
          </h3>
          {motsCles.length === 0 ? (
            <p className="mb-2 text-sm text-muted-foreground">
              Aucun mot-clé. Ajoute ceux qui comptent pour ce client.
            </p>
          ) : (
            <ul className="mb-3 divide-y">
              {motsCles.map((m) => (
                <li key={m.id} className="flex items-center justify-between gap-2 py-2">
                  <span className="min-w-0 truncate text-sm">{m.texte}</span>
                  <div className="flex shrink-0 items-center gap-3">
                    <span className="font-mono text-sm tabular-nums text-muted-foreground">
                      {m.dernierePosition != null
                        ? `#${m.dernierePosition}`
                        : m.dernierePeriode
                          ? ">100"
                          : "—"}
                      {m.dernierePeriode ? (
                        <span className="ml-1 text-xs">
                          ({periodeLabel(m.dernierePeriode).replace(/ \d{4}$/, "")})
                        </span>
                      ) : null}
                    </span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label="Retirer"
                      onClick={() => supprimer(m.id)}
                      disabled={deletePending}
                    >
                      <X />
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}

          <form ref={addFormRef} action={motAction} className="flex items-start gap-2">
            <input type="hidden" name="siteId" value={site.id} />
            <div className="flex-1">
              <Input
                name="texte"
                placeholder="ex. plombier Lyon"
                aria-label="Nouveau mot-clé"
              />
            </div>
            <Button type="submit" variant="outline">
              <Plus /> Ajouter
            </Button>
          </form>
        </div>
      </CardContent>
    </Card>
  );
}
