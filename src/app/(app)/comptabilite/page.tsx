import {
  Wallet,
  TrendingUp,
  TrendingDown,
  PiggyBank,
  Landmark,
  Sparkles,
} from "lucide-react";

import { prisma } from "@/lib/db";
import { PageHeader } from "@/components/page-header";
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
import { Button } from "@/components/ui/button";
import { AiGenerateDialog } from "@/components/ai/ai-generate-dialog";
import { actionAnalyseCompta } from "@/app/actions/ai";
import { ImportComptaDialog } from "@/components/compta/import-dialog";
import { PeriodeFilter } from "@/components/compta/periode-filter";
import { DepensesCategories } from "@/components/compta/depenses-categories";
import {
  EcrituresTable,
  type EcritureRow,
} from "@/components/compta/ecritures-table";
import { euros } from "@/lib/format";
import { periodeLabel } from "@/lib/periode";
import {
  agreger,
  depensesParCategorieDetaille,
  trimestreDe,
  trimestreLabel,
} from "@/lib/compta";

export const dynamic = "force-dynamic";

function signeClasse(n: number): string {
  if (n > 0.005) return "text-positive-ink";
  if (n < -0.005) return "text-negative-ink";
  return "";
}

export default async function ComptabilitePage({
  searchParams,
}: {
  searchParams: Promise<{ p?: string }>;
}) {
  const sp = await searchParams;
  const ecritures = await prisma.ecritureCompta.findMany({
    orderBy: [{ date: "desc" }, { createdAt: "desc" }],
  });

  // Périodes disponibles pour le filtre (récentes en premier).
  const moisDispo = [...new Set(ecritures.map((e) => e.periode))].sort((a, b) =>
    b.localeCompare(a),
  );
  const trimDispo = [
    ...new Set(ecritures.map((e) => trimestreDe(e.periode))),
  ].sort((a, b) => b.localeCompare(a));

  // Résolution du scope demandé (?p=tout | AAAA-MM | AAAA-TN).
  const p = sp.p ?? "tout";
  const estMois = /^\d{4}-\d{2}$/.test(p) && moisDispo.includes(p);
  const estTrim = /^\d{4}-T[1-4]$/.test(p) && trimDispo.includes(p);
  const scope: "tout" | "mois" | "trimestre" = estMois
    ? "mois"
    : estTrim
      ? "trimestre"
      : "tout";
  const valeurFiltre = scope === "tout" ? "tout" : p;

  const scoped =
    scope === "mois"
      ? ecritures.filter((e) => e.periode === p)
      : scope === "trimestre"
        ? ecritures.filter((e) => trimestreDe(e.periode) === p)
        : ecritures;

  const a = agreger(scoped);

  // Trésorerie = solde du compte à la fin de la période sélectionnée (cumulée).
  const treasuryMax =
    scope === "mois"
      ? p
      : scope === "trimestre"
        ? `${p.slice(0, 4)}-${String(Number(p.slice(6)) * 3).padStart(2, "0")}`
        : null;
  const tresorerie = treasuryMax
    ? agreger(ecritures.filter((e) => e.periode <= treasuryMax)).tresorerie
    : a.tresorerie;

  const scopeLabel =
    scope === "mois"
      ? periodeLabel(p)
      : scope === "trimestre"
        ? trimestreLabel(p)
        : "depuis le début";

  const parCat = depensesParCategorieDetaille(scoped);

  // Agrégats par mois (dans le scope), récents en premier.
  const parMois = new Map<string, typeof ecritures>();
  for (const e of scoped) {
    const arr = parMois.get(e.periode) ?? [];
    arr.push(e);
    parMois.set(e.periode, arr);
  }
  const moisRows = [...parMois.entries()]
    .sort((x, y) => y[0].localeCompare(x[0]))
    .map(([periode, lignes]) => ({ periode, ...agreger(lignes) }));

  const rows: EcritureRow[] = scoped.map((e) => ({
    id: e.id,
    date: e.date.toISOString(),
    libelle: e.libelle,
    categorie: e.categorie,
    type: e.type,
    sens: e.sens,
    montant: e.montant,
  }));

  const surLaPeriode = scope === "tout" ? "depuis le début" : `sur ${scopeLabel}`;
  const kpis = [
    {
      label: "Trésorerie",
      value: euros(tresorerie),
      icon: Wallet,
      hint:
        scope === "tout"
          ? "Ce qu'il reste sur le compte pro"
          : `Solde du compte à fin ${scopeLabel}`,
      classe: signeClasse(tresorerie),
    },
    {
      label: "Recettes",
      value: euros(a.recettes),
      icon: TrendingUp,
      hint: `Encaissé ${surLaPeriode}`,
      classe: "",
    },
    {
      label: "Dépenses pro",
      value: euros(a.depenses),
      icon: TrendingDown,
      hint: `Charges ${surLaPeriode}`,
      classe: "",
    },
    {
      label: "Résultat",
      value: euros(a.resultatPro),
      icon: Landmark,
      hint: a.resultatPro >= 0 ? "Bénéfice (recettes − dépenses)" : "Perte (recettes − dépenses)",
      classe: signeClasse(a.resultatPro),
    },
    {
      label: "Rémunération",
      value: euros(a.remuneration),
      icon: PiggyBank,
      hint: "Le salaire que tu t'es versé",
      classe: "",
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Comptabilité"
        description="Importe ton relevé Indy : recettes, dépenses, trésorerie et pistes d'optimisation, au même endroit."
      >
        {ecritures.length > 0 ? (
          <>
            <PeriodeFilter
              value={valeurFiltre}
              mois={moisDispo}
              trimestres={trimDispo}
            />
            <AiGenerateDialog
              action={actionAnalyseCompta}
              title="Analyser mes dépenses"
              description="L'IA passe en revue tes dépenses pour repérer doublons, abonnements dormants et postes optimisables. Brouillon, rien n'est modifié."
              providerLabel="DeepSeek"
              trigger={
                <Button variant="outline">
                  <Sparkles className="text-brand" /> Analyser mes dépenses
                </Button>
              }
            />
          </>
        ) : null}
        <ImportComptaDialog />
      </PageHeader>

      {ecritures.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
            <Wallet className="size-8 text-muted-foreground" />
            <div className="space-y-1">
              <p className="font-medium">Aucune écriture pour l&apos;instant</p>
              <p className="text-sm text-muted-foreground">
                Exporte le journal comptable depuis Indy (CSV) et importe-le.
                Tu pourras le ré-envoyer chaque semaine sans créer de doublon.
              </p>
            </div>
            <ImportComptaDialog />
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            {kpis.map((k) => (
              <Card key={k.label}>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    {k.label}
                  </CardTitle>
                  <k.icon className="size-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div
                    className={`font-mono text-2xl font-medium tabular-nums tracking-tight ${k.classe}`}
                  >
                    {k.value}
                  </div>
                  <CardDescription className="mt-1">{k.hint}</CardDescription>
                </CardContent>
              </Card>
            ))}
          </div>

          {a.aCategoriser > 0 ? (
            <p className="rounded-lg bg-warning-bg px-4 py-2.5 text-sm text-warning-ink">
              {a.aCategoriser} écriture{a.aCategoriser > 1 ? "s" : ""} encore « à
              catégoriser »{scope === "tout" ? "" : ` sur ${scopeLabel}`}. Range-les
              dans le tableau du bas (ou laisse l&apos;IA proposer) pour fiabiliser le
              résultat.
            </p>
          ) : null}

          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Par mois</CardTitle>
                <CardDescription>
                  Recettes, dépenses et résultat mois par mois.
                </CardDescription>
              </CardHeader>
              <CardContent className="px-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="pl-6">Mois</TableHead>
                      <TableHead className="text-right">Recettes</TableHead>
                      <TableHead className="text-right">Dépenses</TableHead>
                      <TableHead className="pr-6 text-right">Résultat</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {moisRows.map((m) => (
                      <TableRow key={m.periode}>
                        <TableCell className="pl-6 font-medium capitalize">
                          {periodeLabel(m.periode)}
                        </TableCell>
                        <TableCell className="text-right font-mono tabular-nums text-positive-ink">
                          {euros(m.recettes)}
                        </TableCell>
                        <TableCell className="text-right font-mono tabular-nums text-muted-foreground">
                          {euros(m.depenses)}
                        </TableCell>
                        <TableCell
                          className={`pr-6 text-right font-mono font-medium tabular-nums ${signeClasse(m.resultatPro)}`}
                        >
                          {euros(m.resultatPro)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Dépenses par catégorie</CardTitle>
                <CardDescription>
                  Clique une ligne pour voir le détail par fournisseur ({scopeLabel}).
                </CardDescription>
              </CardHeader>
              <CardContent className="px-0">
                <DepensesCategories categories={parCat} />
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                {scope === "tout" ? "Toutes les écritures" : `Écritures · ${scopeLabel}`}
              </CardTitle>
              <CardDescription>
                Change une catégorie à la volée : le résultat et les totaux se
                recalculent. Les entrées sont en vert, les sorties en rouge.
              </CardDescription>
            </CardHeader>
            <CardContent className="px-0">
              <EcrituresTable ecritures={rows} />
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
