"use client";

import { useMemo, useState, useTransition } from "react";
import { Search, Upload, Sparkles, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { REGIONS, REGION_DEFAUT, REGION_OPTIONS } from "@/lib/prospection/regions";
import { SECTEUR_OPTIONS, SECTEUR_DEFAUT } from "@/lib/prospection/secteurs";
import {
  collecterProspects,
  importerProspectsCsv,
  auditerNonAudites,
  supprimerNonAudites,
} from "@/app/actions/prospection";

const TOUTES = "__toutes__";

export function RechercheToolbar({
  placesActif,
  nbAAuditer,
}: {
  placesActif: boolean;
  nbAAuditer: number;
}) {
  const [region, setRegion] = useState(REGION_DEFAUT);
  const [secteur, setSecteur] = useState(SECTEUR_DEFAUT);
  const [ville, setVille] = useState(REGIONS[REGION_DEFAUT][0]);
  const [pages, setPages] = useState("1");
  const [campagne, setCampagne] = useState("Phase 1");
  const [pending, start] = useTransition();
  const [auditPending, startAudit] = useTransition();

  const villes = useMemo(() => REGIONS[region] ?? [], [region]);

  function onRegionChange(v: string) {
    setRegion(v);
    setVille(REGIONS[v]?.[0] ?? TOUTES);
  }

  function lancer() {
    start(async () => {
      const villesCible = ville === TOUTES ? villes : [ville];
      const res = await collecterProspects({
        region,
        secteur,
        villes: villesCible,
        pages: Number(pages),
        campagne,
      });
      if (res.ok) {
        toast.success(
          `${res.ajoutes} prospect(s) ajouté(s), ${res.audites ?? 0} audité(s) par DeepSeek ` +
            `(sur ${res.total} trouvés).`,
        );
      } else {
        toast.error(res.error ?? "Échec de la collecte.");
      }
    });
  }

  function viderNonAudites() {
    startAudit(async () => {
      const res = await supprimerNonAudites();
      toast.success(`${res.supprimes} prospect(s) non audité(s) supprimé(s).`);
    });
  }

  function auditerTous() {
    startAudit(async () => {
      const res = await auditerNonAudites();
      if (res.ok) {
        toast.success(
          `${res.audites} prospect(s) audité(s).` +
            (res.restants ? ` ${res.restants} restant(s) — relance pour continuer.` : ""),
        );
      } else {
        toast.error(res.error ?? "Échec de l'audit.");
      }
    });
  }

  return (
    <Card>
      <CardContent className="space-y-4 pt-6">
        <div className="space-y-1.5">
          <Label htmlFor="campagne">Campagne (groupe de prospection)</Label>
          <Input
            id="campagne"
            value={campagne}
            onChange={(e) => setCampagne(e.target.value)}
            placeholder="Ex. Phase 1 — habitat Angers"
            className="sm:max-w-xs"
          />
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-1.5">
            <Label>Région</Label>
            <Select value={region} onValueChange={onRegionChange}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {REGION_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>Secteur</Label>
            <Select value={secteur} onValueChange={setSecteur}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SECTEUR_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>Ville</Label>
            <Select value={ville} onValueChange={setVille}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={TOUTES}>Toutes (plafonné)</SelectItem>
                {villes.map((v) => (
                  <SelectItem key={v} value={v}>
                    {v}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>Profondeur</Label>
            <Select value={pages} onValueChange={setPages}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1">20 résultats / requête</SelectItem>
                <SelectItem value="3">60 résultats / requête (lent)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button onClick={lancer} disabled={pending || !placesActif}>
            {pending ? <Loader2 className="animate-spin" /> : <Search />}
            {pending ? "Recherche + audit…" : "Lancer la recherche (15 max)"}
          </Button>

          <ImportCsvDialog secteur={secteur} campagne={campagne} />

          <Button
            variant="outline"
            onClick={auditerTous}
            disabled={auditPending || nbAAuditer === 0}
          >
            {auditPending ? <Loader2 className="animate-spin" /> : <Sparkles className="text-brand" />}
            {auditPending
              ? "En cours…"
              : `Auditer les non-audités${nbAAuditer ? ` (${nbAAuditer})` : ""}`}
          </Button>

          {nbAAuditer > 0 ? (
            <Button
              variant="ghost"
              onClick={viderNonAudites}
              disabled={auditPending}
              className="text-muted-foreground"
            >
              <Trash2 /> Vider les non-audités
            </Button>
          ) : null}
        </div>

        <p className="text-xs text-muted-foreground">
          Une recherche garde et note les <strong>15</strong> meilleurs prospects (audit
          DeepSeek automatique). Elle tourne côté serveur : tu peux changer d&apos;onglet
          sans l&apos;interrompre.
          {!placesActif ? (
            <>
              {" "}
              Scraping Google Places désactivé (clé{" "}
              <code className="rounded bg-muted px-1">GOOGLE_PLACES_API_KEY</code> absente) —
              l&apos;import CSV reste disponible.
            </>
          ) : null}
        </p>
      </CardContent>
    </Card>
  );
}

function ImportCsvDialog({ secteur, campagne }: { secteur: string; campagne: string }) {
  const [open, setOpen] = useState(false);
  const [csv, setCsv] = useState("");
  const [pending, start] = useTransition();

  function importer() {
    start(async () => {
      const res = await importerProspectsCsv(csv, secteur, campagne);
      if (res.ok) {
        toast.success(
          `${res.ajoutes} prospect(s) importé(s), ${res.audites ?? 0} audité(s) ` +
            `(${res.total} lignes lues).`,
        );
        setOpen(false);
        setCsv("");
      } else {
        toast.error(res.error ?? "Import impossible.");
      }
    });
  }

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) setCsv(await file.text());
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <Upload /> Importer un CSV
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Importer des prospects</DialogTitle>
          <DialogDescription>
            Colonnes attendues :{" "}
            <code className="rounded bg-muted px-1 text-xs">nom,site,ville,activite,telephone</code>.
            Les doublons (même site) sont écartés.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <input
            type="file"
            accept=".csv,text/csv"
            onChange={onFile}
            className="block w-full text-sm text-muted-foreground file:mr-3 file:rounded-md file:border-0 file:bg-muted file:px-3 file:py-1.5 file:text-sm"
          />
          <Textarea
            value={csv}
            onChange={(e) => setCsv(e.target.value)}
            placeholder="…ou colle ton CSV ici"
            className="min-h-[160px] font-mono text-xs"
          />
        </div>

        <DialogFooter>
          <Button onClick={importer} disabled={pending || !csv.trim()}>
            {pending ? <Loader2 className="animate-spin" /> : <Upload />} Importer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
