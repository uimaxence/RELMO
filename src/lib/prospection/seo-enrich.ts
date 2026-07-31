import "server-only";
import { domaineDe } from "@/lib/prospection/places";
import {
  dataforseoConfigured,
  visibiliteDomaine,
  releverPosition,
} from "@/lib/seo/dataforseo";

// Enrichissement SEO d'un prospect via DataForSEO : visibilité globale du domaine
// + position sur sa requête locale (activité + ville). Appelé à l'audit, gaté sur
// le score (coûteux, cf. auditerUnProspect). Dégradation propre → null si non
// configuré, pas de domaine, ou tout échoue. Ne throw jamais.

export type SeoEnrich = {
  nbMotsCles: number | null;
  trafic: number | null;
  motCleLocal: string | null;
  positionLocale: number | null; // null = hors top 100 (ou requête non testée)
};

export async function enrichirSeo(opts: {
  domaine: string | null;
  site?: string | null;
  activite?: string | null;
  ville?: string | null;
}): Promise<SeoEnrich | null> {
  if (!dataforseoConfigured()) return null;
  const domaine = domaineDe(opts.domaine || opts.site || "");
  if (!domaine) return null;

  // Requête locale : « activité ville » (ex. « plombier lyon »). Sans les deux, on
  // se contente de la visibilité globale.
  const motCleLocal =
    opts.activite && opts.ville ? `${opts.activite} ${opts.ville}`.toLowerCase() : null;

  const [vis, pos] = await Promise.all([
    visibiliteDomaine({ domaine, location: "France", langue: "fr" }),
    motCleLocal
      ? releverPosition({ keyword: motCleLocal, domaine, location: "France", langue: "fr" })
      : Promise.resolve(null),
  ]);

  // Tout a échoué → rien à stocker.
  if (!vis.ok && (!pos || !pos.ok)) return null;

  return {
    nbMotsCles: vis.ok ? vis.data.nbMotsCles : null,
    trafic: vis.ok ? vis.data.traficEstime : null,
    motCleLocal,
    positionLocale: pos && pos.ok ? pos.data.position : null,
  };
}
