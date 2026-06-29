import { Gift, Lock, ExternalLink, Pencil } from "lucide-react";

import { prisma } from "@/lib/db";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EnvieFormDialog } from "@/components/forms/envie-form-dialog";
import { ConfirmDelete } from "@/components/forms/confirm-delete";
import { AchatButton } from "@/components/wishlist/achat-button";
import { ReglageForm } from "@/components/wishlist/reglage-form";
import { deleteEnvie } from "@/app/actions/envies";
import { ensureReglage, envieStatut } from "@/lib/wishlist";
import { euros, dateFr } from "@/lib/format";
import { labelOf, ENVIE_CATEGORIES } from "@/lib/constants";

export const dynamic = "force-dynamic";

export default async function WishlistPage() {
  const now = new Date();
  const [reglage, envies, mrrAgg] = await Promise.all([
    ensureReglage(),
    prisma.envie.findMany({ orderBy: { createdAt: "desc" } }),
    prisma.contrat.aggregate({
      _sum: { montantMensuel: true },
      where: { statut: "actif", dateDebut: { lte: now } },
    }),
  ]);

  const mrr = mrrAgg._sum.montantMensuel ?? 0;
  const pourcentage = reglage.pourcentagePlafond;

  // Statut + tri : débloquées non offertes d'abord (récompense à portée),
  // puis verrouillées (les plus proches en haut), puis offertes en bas.
  const items = envies
    .map((e) => ({ envie: e, statut: envieStatut(e.prix, mrr, pourcentage) }))
    .sort((a, b) => {
      const rank = (x: typeof a) =>
        x.envie.achete ? 2 : x.statut.debloque ? 0 : 1;
      const ra = rank(a);
      const rb = rank(b);
      if (ra !== rb) return ra - rb;
      if (ra === 1) return b.statut.progression - a.statut.progression; // verrouillées : plus proches d'abord
      return 0;
    });

  const debloquees = items.filter(
    (i) => i.statut.debloque && !i.envie.achete,
  ).length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Wish-list"
        description="Tes envies se débloquent à mesure que le MRR grimpe. Une raison de plus de signer le prochain client."
      >
        <EnvieFormDialog />
      </PageHeader>

      <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl bg-muted px-4 py-3">
        <div className="flex flex-wrap items-center gap-x-8 gap-y-1 text-sm">
          <span className="text-muted-foreground">
            MRR actuel{" "}
            <span className="font-mono font-medium text-brand tabular-nums">
              {euros(mrr)}/mois
            </span>
          </span>
          <span className="text-muted-foreground">
            À portée{" "}
            <span className="font-mono font-medium text-foreground tabular-nums">
              {debloquees}
            </span>
          </span>
        </div>
        <ReglageForm pourcentage={pourcentage} />
      </div>

      {items.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-4 py-12 text-center">
            <Gift className="size-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              Aucune envie pour l&apos;instant. Note ce que tu t&apos;offriras en
              grandissant.
            </p>
            <EnvieFormDialog />
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {items.map(({ envie, statut }) => {
            const offert = envie.achete;
            const debloque = statut.debloque;
            return (
              <Card
                key={envie.id}
                className={offert ? "opacity-60" : undefined}
              >
                <CardContent className="space-y-3 pt-5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="flex items-center gap-2 font-medium">
                        {!debloque && !offert ? (
                          <Lock className="size-3.5 shrink-0 text-muted-foreground" />
                        ) : null}
                        <span className={offert ? "line-through" : undefined}>
                          {envie.libelle}
                        </span>
                      </p>
                      <p className="mt-0.5 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                        <span className="font-mono tabular-nums">
                          {euros(envie.prix)}
                        </span>
                        {envie.categorie ? (
                          <Badge variant="secondary" className="font-normal">
                            {labelOf(ENVIE_CATEGORIES, envie.categorie)}
                          </Badge>
                        ) : null}
                        {envie.url ? (
                          <a
                            href={envie.url}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 hover:underline"
                          >
                            <ExternalLink className="size-3" /> Lien
                          </a>
                        ) : null}
                      </p>
                    </div>
                    {offert ? (
                      <Badge variant="secondary">Offert · {dateFr(envie.acheteLe)}</Badge>
                    ) : debloque ? (
                      <Badge className="bg-brand text-brand-foreground">
                        Débloqué
                      </Badge>
                    ) : null}
                  </div>

                  {!offert ? (
                    <div className="space-y-1">
                      <div className="h-2 overflow-hidden rounded-full bg-muted">
                        <div
                          className={`h-full rounded-full ${debloque ? "bg-brand" : "bg-foreground/30"}`}
                          style={{ width: `${Math.round(statut.progression * 100)}%` }}
                        />
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {debloque ? (
                          <>Abordable depuis {euros(statut.seuil)}/mois de MRR.</>
                        ) : (
                          <>
                            Se débloque à{" "}
                            <span className="font-medium text-foreground">
                              {euros(statut.seuil)}/mois
                            </span>{" "}
                            · encore {euros(statut.reste)}/mois
                          </>
                        )}
                      </p>
                    </div>
                  ) : null}

                  <div className="flex flex-wrap items-center gap-1 pt-1">
                    {debloque || offert ? (
                      <AchatButton id={envie.id} achete={offert} />
                    ) : null}
                    <div className="ml-auto flex gap-1">
                      <EnvieFormDialog
                        envie={envie}
                        trigger={
                          <Button variant="ghost" size="icon" aria-label="Modifier">
                            <Pencil />
                          </Button>
                        }
                      />
                      <ConfirmDelete
                        action={deleteEnvie.bind(null, envie.id)}
                        description={`Supprimer « ${envie.libelle} » de la wish-list ?`}
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
