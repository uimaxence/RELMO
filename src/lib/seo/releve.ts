import "server-only";
import { prisma } from "@/lib/db";
import {
  dataforseoConfigured,
  releverPosition,
  volumesMotsCles,
  visibiliteDomaine,
} from "@/lib/seo/dataforseo";

// Relevé SEO d'un site pour une période : positions des mots-clés suivis +
// visibilité du domaine. Idempotent (upsert sur @@unique). Réutilisé par le cron
// mensuel ET par le bouton « Relever maintenant » de la fiche site.

export type ReleveResult = {
  ok: boolean;
  releves: number; // nb de mots-clés relevés
  message: string;
};

// Domaine effectif interrogé : `domaine` explicite, sinon on retombe sur l'URL.
function domaineDuSite(site: { domaine: string | null; url: string | null }): string | null {
  return site.domaine?.trim() || site.url?.trim() || null;
}

export async function releverSite(siteId: string, periode: string): Promise<ReleveResult> {
  if (!dataforseoConfigured()) {
    return { ok: false, releves: 0, message: "Identifiants DataForSEO absents (.env)." };
  }

  const site = await prisma.site.findUnique({
    where: { id: siteId },
    include: { motsCles: { where: { actif: true } } },
  });
  if (!site) return { ok: false, releves: 0, message: "Site introuvable." };

  const domaine = domaineDuSite(site);
  if (!domaine) {
    return { ok: false, releves: 0, message: "Renseigne un domaine ou une URL sur le site." };
  }

  // Volumes de recherche en un seul appel groupé.
  const textes = site.motsCles.map((m) => m.texte);
  const volumesRes = await volumesMotsCles(textes, site.seoLocation, site.seoLangue);
  const volumes = volumesRes.ok ? volumesRes.data : {};

  // Positions : un appel SERP par mot-clé (comptes faibles → parallèle OK).
  let releves = 0;
  await Promise.all(
    site.motsCles.map(async (mot) => {
      const pos = await releverPosition({
        keyword: mot.texte,
        domaine,
        location: site.seoLocation,
        langue: site.seoLangue,
      });
      if (!pos.ok) return; // on garde les autres mots-clés
      await prisma.positionReleve.upsert({
        where: { motCleId_periode: { motCleId: mot.id, periode } },
        create: {
          motCleId: mot.id,
          periode,
          position: pos.data.position,
          url: pos.data.url,
          volume: volumes[mot.texte.toLowerCase()] ?? null,
        },
        update: {
          position: pos.data.position,
          url: pos.data.url,
          volume: volumes[mot.texte.toLowerCase()] ?? null,
          releveLe: new Date(),
        },
      });
      releves++;
    }),
  );

  // Vue d'ensemble du domaine.
  const vis = await visibiliteDomaine({
    domaine,
    location: site.seoLocation,
    langue: site.seoLangue,
  });
  if (vis.ok) {
    await prisma.siteVisibilite.upsert({
      where: { siteId_periode: { siteId: site.id, periode } },
      create: {
        siteId: site.id,
        periode,
        nbMotsCles: vis.data.nbMotsCles,
        traficEstime: vis.data.traficEstime,
      },
      update: {
        nbMotsCles: vis.data.nbMotsCles,
        traficEstime: vis.data.traficEstime,
        releveLe: new Date(),
      },
    });
  }

  return {
    ok: true,
    releves,
    message:
      releves > 0
        ? `Relevé effectué : ${releves} mot(s)-clé(s).`
        : "Relevé effectué (aucun mot-clé suivi actif).",
  };
}
