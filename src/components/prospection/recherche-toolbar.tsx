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
import { METIER_OPTIONS, METIER_DEFAUT } from "@/lib/prospection/metiers-partenaires";
import {
  collecterProspects,
  importerProspectsCsv,
  sourcerProspectsPro,
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
  const [cible, setCible] = useState("client"); // client final (V1) | partenaire (V2)
  const [segment, setSegment] = useState("classique"); // classique | pro (angle ROI)
  const [secteur, setSecteur] = useState(SECTEUR_DEFAUT);
  const [metier, setMetier] = useState(METIER_DEFAUT);
  const [ville, setVille] = useState(REGIONS[REGION_DEFAUT][0]);
  const [pages, setPages] = useState("1");
  const [angle, setAngle] = useState(""); // sourcing Pro (Perplexity)
  const [campagne, setCampagne] = useState("Phase 1");
  const [pending, start] = useTransition();
  const [auditPending, startAudit] = useTransition();
  const [looping, setLooping] = useState(false);
  const [progres, setProgres] = useState<{ done: number; restants: number } | null>(null);

  const villes = useMemo(() => REGIONS[region] ?? [], [region]);
  // Gamme Pro : la découverte ne passe plus par Google Places (commerce local) mais
  // par un sourcing Perplexity (startups / petits SaaS). Le secteur ne s'applique pas.
  const pro = cible === "client" && segment === "pro";

  // Audit par petits lots enchaînés (chaque appel tient sous la limite serverless).
  // On boucle jusqu'à épuisement des non-audités, avec progression en direct.
  async function boucleAudit() {
    setLooping(true);
    let done = 0;
    try {
      for (;;) {
        const res = await auditerNonAudites();
        if (!res.ok) {
          toast.error(res.error ?? "Échec de l'audit.");
          break;
        }
        done += res.audites ?? 0;
        setProgres({ done, restants: res.restants ?? 0 });
        // Fin : plus rien à auditer, ou un lot n'a rien pu traiter (sécurité anti-boucle).
        if (!res.restants || (res.audites ?? 0) === 0) break;
      }
      if (done > 0) toast.success(`${done} prospect(s) audité(s) (site + visuel).`);
    } finally {
      setLooping(false);
      setProgres(null);
    }
  }

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
        cible,
        metier: cible === "partenaire" ? metier : undefined,
        segment: cible === "client" ? segment : undefined,
      });
      if (!res.ok) {
        toast.error(res.error ?? "Échec de la collecte.");
        return;
      }
      toast.success(
        `${res.ajoutes} prospect(s) ajouté(s) sur ${res.total} trouvés. Audit en cours…`,
      );
      // Enchaîne l'audit (site + visuel) par lots, sans bloquer la collecte.
      await boucleAudit();
    });
  }

  // Sourcing Pro : Perplexity ramène des candidats → fiches segment=pro → audit.
  function sourcerPro() {
    start(async () => {
      const res = await sourcerProspectsPro({ angle, region, campagne });
      if (!res.ok) {
        toast.error(res.error ?? "Sourcing impossible.");
        return;
      }
      toast.success(`${res.ajoutes} startup(s) ajoutée(s) sur ${res.total} trouvées. Audit en cours…`);
      await boucleAudit();
    });
  }

  function viderNonAudites() {
    startAudit(async () => {
      const res = await supprimerNonAudites();
      toast.success(`${res.supprimes} prospect(s) non audité(s) supprimé(s).`);
    });
  }

  function auditerTous() {
    void boucleAudit();
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

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <div className="space-y-1.5">
            <Label>Cible</Label>
            <Select value={cible} onValueChange={setCible}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="client">Client final</SelectItem>
                <SelectItem value="partenaire">Partenaire (apporteur)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {cible === "client" ? (
            <div className="space-y-1.5">
              <Label>Gamme</Label>
              <Select value={segment} onValueChange={setSegment}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="classique">Classique (artisan / TPE)</SelectItem>
                  <SelectItem value="pro">Pro (startup / scale-up)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          ) : null}

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

          {cible === "client" && !pro ? (
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
          ) : cible === "partenaire" ? (
            <div className="space-y-1.5">
              <Label>Métier</Label>
              <Select value={metier} onValueChange={setMetier}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {METIER_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : null}

          {!pro ? (
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
          ) : null}

          {!pro ? (
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
          ) : null}
        </div>

        {/* Gamme Pro : sourcing par angle (Perplexity) au lieu du scrape local. */}
        {pro ? (
          <div className="space-y-1.5">
            <Label htmlFor="angle">Angle de recherche (startups / SaaS)</Label>
            <Input
              id="angle"
              value={angle}
              onChange={(e) => setAngle(e.target.value)}
              placeholder="Ex. petits SaaS français financés en seed 2025, ou : startups de Station F en martech"
            />
            <p className="text-xs text-muted-foreground">
              La région ci-dessus sert d&apos;indice géographique. Perplexity lit de vraies sources
              (incubateurs, Product Hunt, French Tech), à relire avant d&apos;auditer.
            </p>
          </div>
        ) : null}

        <div className="flex flex-wrap items-center gap-2">
          {pro ? (
            <Button onClick={sourcerPro} disabled={pending || looping || !angle.trim()}>
              {pending || looping ? <Loader2 className="animate-spin" /> : <Sparkles className="text-brand" />}
              {pending || looping ? "Sourcing + audit…" : "Trouver des startups (Pro)"}
            </Button>
          ) : (
            <Button onClick={lancer} disabled={pending || looping || !placesActif}>
              {pending || looping ? <Loader2 className="animate-spin" /> : <Search />}
              {pending || looping ? "Recherche + audit…" : "Lancer la recherche (15 max)"}
            </Button>
          )}

          <ImportCsvDialog
            secteur={cible === "client" ? secteur : undefined}
            campagne={campagne}
            cible={cible}
            metier={cible === "partenaire" ? metier : undefined}
            segment={cible === "client" ? segment : undefined}
            onImported={boucleAudit}
            disabled={looping || pending}
          />

          <Button
            variant="outline"
            onClick={auditerTous}
            disabled={looping || pending || nbAAuditer === 0}
          >
            {looping ? <Loader2 className="animate-spin" /> : <Sparkles className="text-brand" />}
            {looping
              ? progres
                ? `Audit… ${progres.done} faits · ${progres.restants} restants`
                : "Audit…"
              : `Auditer les non-audités${nbAAuditer ? ` (${nbAAuditer})` : ""}`}
          </Button>

          {nbAAuditer > 0 ? (
            <Button
              variant="ghost"
              onClick={viderNonAudites}
              disabled={auditPending || looping || pending}
              className="text-muted-foreground"
            >
              <Trash2 /> Vider les non-audités
            </Button>
          ) : null}
        </div>

        {pro ? (
          <p className="text-xs text-muted-foreground">
            Gamme <strong>Pro</strong> : pas de scrape local (les startups n&apos;y sont pas). Perplexity
            ramène jusqu&apos;à <strong>15</strong> candidats depuis de vraies sources, créés en fiches
            « Pro » puis audités (l&apos;audit élimine les URLs mortes). C&apos;est un canal de qualité,
            à relire, pas de la masse. L&apos;import CSV (export Crunchbase / Sales Navigator) reste dispo.
          </p>
        ) : (
          <p className="text-xs text-muted-foreground">
            Une recherche garde les <strong>15</strong> meilleurs prospects, puis les audite
            (site <strong>+ analyse visuelle</strong>) par petits lots. Garde l&apos;onglet
            ouvert : ça peut prendre quelques minutes, la progression s&apos;affiche sur le
            bouton.
            {!placesActif ? (
              <>
                {" "}
                Scraping Google Places désactivé (clé{" "}
                <code className="rounded bg-muted px-1">GOOGLE_PLACES_API_KEY</code> absente) —
                l&apos;import CSV reste disponible.
              </>
            ) : null}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function ImportCsvDialog({
  secteur,
  campagne,
  cible,
  metier,
  segment,
  onImported,
  disabled,
}: {
  secteur?: string;
  campagne: string;
  cible: string;
  metier?: string;
  segment?: string;
  onImported: () => void | Promise<void>;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [csv, setCsv] = useState("");
  const [pending, start] = useTransition();

  function importer() {
    start(async () => {
      const res = await importerProspectsCsv(csv, { secteur, campagne, cible, metier, segment });
      if (res.ok) {
        toast.success(
          `${res.ajoutes} prospect(s) importé(s) (${res.total} lignes). Audit en cours…`,
        );
        setOpen(false);
        setCsv("");
        await onImported();
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
        <Button variant="outline" disabled={disabled}>
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
