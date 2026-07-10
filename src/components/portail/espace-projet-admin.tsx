import { Mail, MailX, ClipboardList, Megaphone, Sparkles, Paperclip } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ConfirmDelete } from "@/components/forms/confirm-delete";
import { IntroProjetDialog } from "@/components/portail/intro-projet-dialog";
import { UpdateFormDialog } from "@/components/portail/update-form-dialog";
import { supprimerUpdate } from "@/app/actions/portail";
import { dateFr } from "@/lib/format";
import { labelOf, CIBLES_SITE, OBJECTIFS_SITE } from "@/lib/constants";
import type { Brief, PortailUpdate } from "@/generated/prisma/client";

const DA_LABELS: Record<string, string> = {
  oui: "Oui, définie",
  partiel: "En partie",
  non: "Tout à imaginer",
};

// Pilotage de l'espace projet du portail, côté admin (fiche client) :
// accueil rédigé/généré, brief rempli par le client, journal d'actus.
export function EspaceProjetAdmin({
  clientId,
  clientEmail,
  intro,
  brief,
  briefFiles,
  updates,
}: {
  clientId: string;
  clientEmail: string | null;
  intro: string | null;
  brief: Brief | null;
  briefFiles: Array<{ id: string; url: string; nom: string }>;
  updates: PortailUpdate[];
}) {
  const reponses: Array<{ label: string; value: string | null }> = brief
    ? [
        {
          label: "S'adresse à",
          value: brief.ciblePublic
            ? `${labelOf(CIBLES_SITE, brief.ciblePublic)}${brief.cibleDetail ? ` · ${brief.cibleDetail}` : ""}`
            : brief.cibleDetail,
        },
        {
          label: "Objectif n°1",
          value: brief.objectifSite ? labelOf(OBJECTIFS_SITE, brief.objectifSite) : null,
        },
        {
          label: "Direction artistique",
          value: brief.daExistante ? DA_LABELS[brief.daExistante] ?? brief.daExistante : null,
        },
        { label: "Univers choisis", value: brief.daUnivers },
        { label: "Précisions visuelles", value: brief.daDetail },
        {
          label: "Charte / logo",
          value: brief.charteExistante
            ? `${brief.charteExistante === "oui" ? "Oui" : "Non"}${brief.charteDetail ? ` · ${brief.charteDetail}` : ""}`
            : brief.charteDetail,
        },
        { label: "Sites aimés", value: brief.sitesAimes },
        { label: "Aimerait voir", value: brief.souhaits },
        { label: "À éviter", value: brief.aEviter },
      ].filter((r) => r.value)
    : [];

  return (
    <div>
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="text-lg font-semibold">Espace projet (portail)</h2>
        <div className="flex gap-2">
          <IntroProjetDialog clientId={clientId} intro={intro} />
          <UpdateFormDialog clientId={clientId} clientEmail={clientEmail} />
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <ClipboardList className="size-4 text-brand" /> Brief du client
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {!brief?.rempliLe ? (
              <p className="text-sm text-muted-foreground">
                Pas encore rempli. Le questionnaire (goûts, références, charte)
                est proposé au client sur son portail.
              </p>
            ) : (
              <dl className="space-y-2.5">
                <p className="text-xs text-muted-foreground">
                  Rempli le {dateFr(brief.rempliLe)}
                </p>
                {reponses.map((r) => (
                  <div key={r.label}>
                    <dt className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                      {r.label}
                    </dt>
                    <dd className="whitespace-pre-wrap text-sm">{r.value}</dd>
                  </div>
                ))}
              </dl>
            )}
            {briefFiles.length > 0 ? (
              <div>
                <p className="mb-1.5 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Fichiers déposés
                </p>
                <ul className="space-y-1">
                  {briefFiles.map((f) => (
                    <li key={f.id}>
                      <a
                        href={f.url}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1.5 text-sm hover:underline"
                      >
                        <Paperclip className="size-3.5 text-muted-foreground" />
                        {f.nom}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Megaphone className="size-4 text-brand" /> Journal d&apos;avancement
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {!intro ? (
              <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Sparkles className="size-3.5" /> Astuce : rédige l&apos;accueil de
                l&apos;espace (bienvenue + objectifs) avant d&apos;envoyer le lien.
              </p>
            ) : null}
            {updates.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Aucune actu publiée. Chaque actu apparaît sur l&apos;espace du
                client (et peut lui être envoyée par mail).
              </p>
            ) : (
              <ul className="divide-y">
                {updates.map((u) => (
                  <li
                    key={u.id}
                    className="flex items-start justify-between gap-3 py-2.5 first:pt-0 last:pb-0"
                  >
                    <div className="min-w-0 space-y-0.5">
                      <p className="text-sm font-medium">{u.titre}</p>
                      {u.contenu ? (
                        <p className="line-clamp-2 whitespace-pre-wrap text-sm text-muted-foreground">
                          {u.contenu}
                        </p>
                      ) : null}
                      <p className="text-xs text-muted-foreground">
                        {dateFr(u.createdAt)}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      <Badge variant="outline" className="gap-1 font-normal">
                        {u.emailEnvoyeLe ? (
                          <>
                            <Mail className="size-3" /> mail envoyé
                          </>
                        ) : (
                          <>
                            <MailX className="size-3" /> sans mail
                          </>
                        )}
                      </Badge>
                      <ConfirmDelete
                        action={supprimerUpdate.bind(null, u.id, clientId)}
                        description={`Supprimer l'actu « ${u.titre} » de l'espace client ?`}
                      />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
