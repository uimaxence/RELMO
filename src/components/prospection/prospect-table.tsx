"use client";

import { useMemo, useState } from "react";
import { ChevronRight, AlertTriangle, Flame, Search as SearchIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { ProspectRow } from "./prospect-row";
import { Avatar, TierBadge, ScorePill, StatutTags } from "./prospect-shared";
import { ProspectSheet } from "./prospect-sheet";

export type { ProspectRow } from "./prospect-row";

// Filtres à DEUX dimensions (au lieu d'une liste plate de 12) : l'étape du
// pipeline d'un côté, le segment de l'autre, plus un raccourci « Chauds ».
type FiltreDef = { value: string; label: string; test: (p: ProspectRow) => boolean };

const ETAPES: FiltreDef[] = [
  {
    value: "a_traiter",
    label: "À traiter",
    // Actionnable maintenant : pas clos ni concurrent, et soit pas encore contacté,
    // soit contacté mais relance due.
    test: (p) =>
      !["ecarte", "converti"].includes(p.statut) &&
      !p.flagConcurrent &&
      (p.statut !== "contacte" || p.relanceDue),
  },
  { value: "en_file", label: "En file", test: (p) => p.statut === "a_contacter" },
  { value: "contacte", label: "Contactés", test: (p) => p.statut === "contacte" },
  { value: "converti", label: "Convertis", test: (p) => p.statut === "converti" },
  { value: "ecarte", label: "Écartés", test: (p) => p.statut === "ecarte" },
  { value: "tous", label: "Tous", test: () => true },
];

const SEGMENTS: FiltreDef[] = [
  { value: "tous", label: "Tous", test: () => true },
  { value: "classique", label: "Classique", test: (p) => p.cible !== "partenaire" && p.segment !== "pro" },
  { value: "pro", label: "Pro", test: (p) => p.cible !== "partenaire" && p.segment === "pro" },
  { value: "partenaires", label: "Partenaires", test: (p) => p.cible === "partenaire" },
];

export function ProspectTable({ prospects }: { prospects: ProspectRow[] }) {
  const [etape, setEtape] = useState("a_traiter");
  const [segment, setSegment] = useState("tous");
  const [chaudsOnly, setChaudsOnly] = useState(false);
  const [campagne, setCampagne] = useState("toutes");
  const [q, setQ] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const campagnes = useMemo(
    () => [...new Set(prospects.map((p) => p.campagne).filter(Boolean) as string[])].sort(),
    [prospects],
  );

  const testEtape = ETAPES.find((f) => f.value === etape)?.test ?? (() => true);
  const testSegment = SEGMENTS.find((f) => f.value === segment)?.test ?? (() => true);
  const estChaud = (p: ProspectRow) => p.filtreTier === "chaud";

  const filtered = useMemo(() => {
    const ql = q.trim().toLowerCase();
    return prospects.filter(
      (p) =>
        testEtape(p) &&
        testSegment(p) &&
        (!chaudsOnly || estChaud(p)) &&
        (campagne === "toutes" || p.campagne === campagne) &&
        (!ql || p.nom.toLowerCase().includes(ql) || (p.ville ?? "").toLowerCase().includes(ql)),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prospects, etape, segment, chaudsOnly, campagne, q]);

  // Compteur d'une puce : nb de prospects visibles si on la choisit, en gardant
  // l'autre dimension + le raccourci « Chauds » actifs.
  const compter = (test: (p: ProspectRow) => boolean, dim: "etape" | "segment") =>
    prospects.filter(
      (p) => test(p) && (dim === "etape" ? testSegment(p) : testEtape(p)) && (!chaudsOnly || estChaud(p)),
    ).length;

  const selected = prospects.find((p) => p.id === selectedId) ?? null;

  return (
    <div className="space-y-4">
      {/* Barre de filtres à deux dimensions */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex flex-wrap gap-1 rounded-lg bg-muted p-1">
          {ETAPES.map((f) => (
            <button
              key={f.value}
              onClick={() => setEtape(f.value)}
              className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                etape === f.value ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {f.label}
              <span className="font-mono tabular-nums opacity-60">{compter(f.test, "etape")}</span>
            </button>
          ))}
        </div>

        <div className="flex flex-wrap gap-1 rounded-lg bg-muted p-1">
          {SEGMENTS.map((f) => (
            <button
              key={f.value}
              onClick={() => setSegment(f.value)}
              className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                segment === f.value ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {f.label}
              <span className="font-mono tabular-nums opacity-60">{compter(f.test, "segment")}</span>
            </button>
          ))}
        </div>

        <button
          onClick={() => setChaudsOnly((v) => !v)}
          className={`inline-flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors ${
            chaudsOnly ? "border-positive-ink/30 bg-positive-bg text-positive-ink" : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <Flame className="size-3.5" /> Chauds
        </button>

        <div className="ml-auto flex items-center gap-2">
          {campagnes.length > 0 ? (
            <Select value={campagne} onValueChange={setCampagne}>
              <SelectTrigger className="h-8 w-[180px] text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="toutes">Toutes les campagnes</SelectItem>
                {campagnes.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : null}
          <div className="relative">
            <SearchIcon className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Rechercher…"
              className="h-8 w-[160px] pl-8 text-xs"
            />
          </div>
        </div>
      </div>

      {/* Tableau */}
      {filtered.length === 0 ? (
        <Card className="py-12 text-center text-sm text-muted-foreground">Aucun prospect dans ce filtre.</Card>
      ) : (
        <Card className="overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Entreprise</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead>Campagne</TableHead>
                <TableHead className="text-center">Qualif.</TableHead>
                <TableHead className="w-8" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((p) => (
                <TableRow
                  key={p.id}
                  onClick={() => setSelectedId(p.id)}
                  className={`cursor-pointer ${p.statut === "ecarte" ? "opacity-55" : ""}`}
                >
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Avatar nom={p.nom} />
                      <div className="min-w-0">
                        <div className="truncate font-medium">{p.nom}</div>
                        <div className="truncate text-xs text-muted-foreground">
                          {[p.activite, p.ville].filter(Boolean).join(" · ") || "—"}
                        </div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <StatutTags p={p} />
                  </TableCell>
                  <TableCell>
                    {p.campagne ? (
                      <Badge variant="outline" className="font-normal">
                        {p.campagne}
                      </Badge>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-center">
                    {p.filtreTier ? (
                      <TierBadge tier={p.filtreTier} total={p.filtreTotal} />
                    ) : p.score != null ? (
                      <ScorePill score={p.score} />
                    ) : p.statutAudit === "erreur" ? (
                      <AlertTriangle className="mx-auto size-4 text-warning-ink" />
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <ChevronRight className="size-4 text-muted-foreground" />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}

      <ProspectSheet prospect={selected} onClose={() => setSelectedId(null)} />
    </div>
  );
}
