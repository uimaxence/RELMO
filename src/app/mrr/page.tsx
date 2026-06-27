import Link from "next/link";
import { Euro, TrendingUp, Clock } from "lucide-react";

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
import { Badge } from "@/components/ui/badge";
import { euros, dateFr } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function MrrPage() {
  const now = new Date();

  const clients = await prisma.client.findMany({
    orderBy: { nom: "asc" },
    include: { sites: { include: { contrats: true } } },
  });

  const rows = clients.map((c) => {
    const contrats = c.sites.flatMap((s) => s.contrats);
    const actifs = contrats.filter((ct) => ct.statut === "actif");
    const facture = actifs
      .filter((ct) => ct.dateDebut <= now)
      .reduce((s, ct) => s + ct.montantMensuel, 0);
    const aVenir = actifs
      .filter((ct) => ct.dateDebut > now)
      .reduce((s, ct) => s + ct.montantMensuel, 0);
    return {
      id: c.id,
      nom: c.nom,
      nbSites: c.sites.length,
      nbContratsActifs: actifs.length,
      facture,
      aVenir,
    };
  });

  const mrrFacture = rows.reduce((s, r) => s + r.facture, 0);
  const mrrAVenir = rows.reduce((s, r) => s + r.aVenir, 0);
  const contratsActifs = rows.reduce((s, r) => s + r.nbContratsActifs, 0);

  // Contrats actifs pas encore démarrés (détail du « à venir »).
  const aVenirDetail = clients
    .flatMap((c) =>
      c.sites.flatMap((s) =>
        s.contrats
          .filter((ct) => ct.statut === "actif" && ct.dateDebut > now)
          .map((ct) => ({
            client: c.nom,
            site: s.nom,
            siteId: s.id,
            libelle: ct.libelle,
            montant: ct.montantMensuel,
            dateDebut: ct.dateDebut,
          })),
      ),
    )
    .sort((a, b) => a.dateDebut.getTime() - b.dateDebut.getTime());

  const kpis = [
    {
      label: "MRR facturé",
      value: euros(mrrFacture),
      icon: Euro,
      hint: `${contratsActifs} contrat${contratsActifs > 1 ? "s" : ""} actif${contratsActifs > 1 ? "s" : ""}`,
    },
    {
      label: "À venir",
      value: euros(mrrAVenir),
      icon: Clock,
      hint: "Contrats actifs non démarrés",
    },
    {
      label: "MRR potentiel",
      value: euros(mrrFacture + mrrAVenir),
      icon: TrendingUp,
      hint: "Facturé + à venir",
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="MRR"
        description="Revenu récurrent mensuel : ce qui est facturé aujourd'hui et ce qui arrive."
      />

      <div className="grid gap-4 sm:grid-cols-3">
        {kpis.map((k) => (
          <Card key={k.label}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {k.label}
              </CardTitle>
              <k.icon className="size-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="font-mono text-2xl font-medium tabular-nums tracking-tight">
                {k.value}
              </div>
              <CardDescription className="mt-1">{k.hint}</CardDescription>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Par client</CardTitle>
        </CardHeader>
        <CardContent className="px-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-6">Client</TableHead>
                <TableHead className="text-center">Sites</TableHead>
                <TableHead className="text-center">Contrats actifs</TableHead>
                <TableHead className="text-right">À venir</TableHead>
                <TableHead className="pr-6 text-right">MRR facturé</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="pl-6 font-medium">
                    <Link href={`/clients/${r.id}`} className="hover:underline">
                      {r.nom}
                    </Link>
                  </TableCell>
                  <TableCell className="text-center">{r.nbSites}</TableCell>
                  <TableCell className="text-center">{r.nbContratsActifs}</TableCell>
                  <TableCell className="text-right font-mono tabular-nums text-muted-foreground">
                    {r.aVenir > 0 ? euros(r.aVenir) : "—"}
                  </TableCell>
                  <TableCell className="pr-6 text-right font-mono font-medium tabular-nums">
                    {euros(r.facture)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {aVenirDetail.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Démarrages à venir</CardTitle>
            <CardDescription>
              Contrats signés dont la facturation n&apos;a pas encore commencé.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="divide-y">
              {aVenirDetail.map((d, i) => (
                <li
                  key={i}
                  className="flex items-center justify-between gap-2 py-2 text-sm"
                >
                  <div className="min-w-0">
                    <Link
                      href={`/sites/${d.siteId}`}
                      className="font-medium hover:underline"
                    >
                      {d.site}
                    </Link>{" "}
                    <span className="text-muted-foreground">
                      · {d.client} · {d.libelle}
                    </span>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <Badge variant="secondary">{dateFr(d.dateDebut)}</Badge>
                    <span className="font-medium">{euros(d.montant)}/mois</span>
                  </div>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ) : null}

      <p className="text-xs text-muted-foreground">
        Le suivi de l&apos;évolution du MRR dans le temps nécessitera un historique
        mensuel (snapshots) — à ajouter quand l&apos;outil aura tourné quelques mois.
      </p>
    </div>
  );
}
