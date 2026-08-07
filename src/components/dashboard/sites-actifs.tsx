import Link from "next/link";
import { ArrowRight } from "lucide-react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { StatusBadge, type StatusVariant } from "@/components/status-badge";
import { euros, dateFr } from "@/lib/format";

export type SiteActif = {
  id: string;
  nom: string;
  clientId: string;
  clientNom: string;
  mrrFacture: number;
  mrrEnAttente: number;
  /** Livrables de la période courante (0 si rien n'a encore été généré). */
  prevus: number;
  faits: number;
  /** Engagements récurrents portés par les contrats actifs du site. */
  engagements: number;
  /** Dernier livrable fait, toutes périodes confondues. */
  derniereAction: Date | string | null;
};

type Etat = {
  variant: StatusVariant;
  label: string;
  /** Rang de tri : plus c'est bas, plus ça remonte dans la liste. */
  rang: number;
};

// L'état du mois répond à « est-ce que j'ai fait quelque chose ici ? ». On
// distingue le rien-fait du rien-à-faire : un site facturé sans engagement ni
// livrable généré n'est pas en règle, il est juste invisible du suivi.
function etatDuMois(s: SiteActif): Etat {
  if (s.engagements === 0)
    return { variant: "neutral", label: "Aucun engagement", rang: 1 };
  if (s.prevus === 0)
    return { variant: "warn", label: "Livrables à générer", rang: 0 };
  if (s.faits === 0)
    return { variant: "bad", label: `Rien fait · 0/${s.prevus}`, rang: 0 };
  if (s.faits < s.prevus)
    return { variant: "warn", label: `En cours · ${s.faits}/${s.prevus}`, rang: 2 };
  return { variant: "ok", label: `À jour · ${s.faits}/${s.prevus}`, rang: 3 };
}

// Vue portefeuille : un site par ligne, ce qu'il rapporte et ce qui a été livré
// ce mois-ci. Les sites qui réclament une action remontent en haut.
export function SitesActifs({
  sites,
  periode,
}: {
  sites: SiteActif[];
  periode: string;
}) {
  const rows = sites
    .map((s) => ({ ...s, etat: etatDuMois(s) }))
    .sort(
      (a, b) =>
        a.etat.rang - b.etat.rang ||
        b.mrrFacture - a.mrrFacture ||
        a.nom.localeCompare(b.nom),
    );

  const mrrTotal = rows.reduce((sum, r) => sum + r.mrrFacture, 0);
  const sansAction = rows.filter((r) => r.faits === 0).length;

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between space-y-0">
        <div>
          <CardTitle className="text-base">
            Sites actifs · {periode}
          </CardTitle>
          <CardDescription>
            Ce que rapporte chaque site et ce qui y a été livré ce mois-ci.
          </CardDescription>
        </div>
        {rows.length > 0 ? (
          sansAction > 0 ? (
            <StatusBadge variant="warn">
              {sansAction} sans action
            </StatusBadge>
          ) : (
            <StatusBadge variant="ok">Tous servis</StatusBadge>
          )
        ) : null}
      </CardHeader>
      <CardContent className="px-0">
        {rows.length === 0 ? (
          <div className="py-8 text-center">
            <p className="text-sm text-muted-foreground">
              Aucun site actif pour l&apos;instant.
            </p>
            <Link
              href="/clients"
              className="mt-2 inline-flex items-center gap-1 text-sm text-brand hover:underline"
            >
              Ajouter un client <ArrowRight className="size-3.5" />
            </Link>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-6">Site</TableHead>
                <TableHead className="text-right">MRR facturé</TableHead>
                <TableHead>Ce mois-ci</TableHead>
                <TableHead className="pr-6 text-right">
                  Dernière action
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((s) => (
                <TableRow key={s.id}>
                  <TableCell className="pl-6">
                    <Link
                      href={`/sites/${s.id}`}
                      className="font-medium hover:underline"
                    >
                      {s.nom}
                    </Link>
                    {s.clientNom !== s.nom ? (
                      <p className="text-xs text-muted-foreground">
                        {s.clientNom}
                      </p>
                    ) : null}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="font-mono font-medium tabular-nums">
                      {euros(s.mrrFacture)}
                    </div>
                    {s.mrrEnAttente > 0 ? (
                      <div className="font-mono text-xs tabular-nums text-warning-ink">
                        {euros(s.mrrEnAttente)} en attente
                      </div>
                    ) : null}
                  </TableCell>
                  <TableCell>
                    {s.etat.variant === "warn" && s.prevus === 0 ? (
                      <Link href="/livrables">
                        <StatusBadge variant={s.etat.variant}>
                          {s.etat.label}
                        </StatusBadge>
                      </Link>
                    ) : (
                      <StatusBadge variant={s.etat.variant}>
                        {s.etat.label}
                      </StatusBadge>
                    )}
                  </TableCell>
                  <TableCell className="pr-6 text-right text-sm text-muted-foreground">
                    {s.derniereAction ? dateFr(s.derniereAction) : "Jamais"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
      {rows.length > 0 ? (
        <div className="flex items-center justify-between border-t px-6 pt-4 text-sm">
          <span className="text-muted-foreground">
            {rows.length} site{rows.length > 1 ? "s" : ""} actif
            {rows.length > 1 ? "s" : ""}
          </span>
          <span className="font-mono font-medium tabular-nums">
            {euros(mrrTotal)}/mois
          </span>
        </div>
      ) : null}
    </Card>
  );
}
