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
import {
  EcrituresTable,
  type EcritureRow,
} from "@/components/compta/ecritures-table";
import { euros } from "@/lib/format";
import { agreger, depensesParCategorie } from "@/lib/compta";

export const dynamic = "force-dynamic";

// "2026-07" → "juil. 2026"
function moisLabel(periode: string): string {
  const d = new Date(`${periode}-01T00:00:00Z`);
  return d.toLocaleDateString("fr-FR", {
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

function signeClasse(n: number): string {
  if (n > 0.005) return "text-positive-ink";
  if (n < -0.005) return "text-negative-ink";
  return "";
}

export default async function ComptabilitePage() {
  const ecritures = await prisma.ecritureCompta.findMany({
    orderBy: [{ date: "desc" }, { createdAt: "desc" }],
  });

  const a = agreger(ecritures);
  const parCat = depensesParCategorie(ecritures);
  const totalDepensesCat = parCat.reduce((s, r) => s + r.montant, 0);

  // Agrégats par mois (récents en premier).
  const parMois = new Map<string, typeof ecritures>();
  for (const e of ecritures) {
    const arr = parMois.get(e.periode) ?? [];
    arr.push(e);
    parMois.set(e.periode, arr);
  }
  const moisRows = [...parMois.entries()]
    .sort((x, y) => y[0].localeCompare(x[0]))
    .map(([periode, lignes]) => ({ periode, ...agreger(lignes) }));

  const rows: EcritureRow[] = ecritures.map((e) => ({
    id: e.id,
    date: e.date.toISOString(),
    libelle: e.libelle,
    categorie: e.categorie,
    type: e.type,
    sens: e.sens,
    montant: e.montant,
  }));

  const kpis = [
    {
      label: "Trésorerie",
      value: euros(a.tresorerie),
      icon: Wallet,
      hint: "Ce qu'il reste sur le compte pro",
      classe: signeClasse(a.tresorerie),
    },
    {
      label: "Recettes",
      value: euros(a.recettes),
      icon: TrendingUp,
      hint: "Encaissé depuis le début",
      classe: "",
    },
    {
      label: "Dépenses pro",
      value: euros(a.depenses),
      icon: TrendingDown,
      hint: "Charges de l'activité",
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
              catégoriser ». Range-les dans le tableau du bas (ou laisse l&apos;IA
              proposer) pour fiabiliser le résultat.
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
                          {moisLabel(m.periode)}
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
                <CardDescription>Où part l&apos;argent, depuis le début.</CardDescription>
              </CardHeader>
              <CardContent className="px-0">
                {parCat.length === 0 ? (
                  <p className="px-6 py-4 text-sm text-muted-foreground">
                    Aucune dépense enregistrée.
                  </p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="pl-6">Catégorie</TableHead>
                        <TableHead className="text-right">Part</TableHead>
                        <TableHead className="pr-6 text-right">Montant</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {parCat.map((r) => (
                        <TableRow key={r.categorie}>
                          <TableCell className="pl-6 font-medium">{r.label}</TableCell>
                          <TableCell className="text-right font-mono tabular-nums text-muted-foreground">
                            {totalDepensesCat > 0
                              ? `${Math.round((r.montant / totalDepensesCat) * 100)}%`
                              : "—"}
                          </TableCell>
                          <TableCell className="pr-6 text-right font-mono font-medium tabular-nums">
                            {euros(r.montant)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Toutes les écritures</CardTitle>
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
