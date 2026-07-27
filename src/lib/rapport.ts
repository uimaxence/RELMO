import { prisma } from "@/lib/db";
import { periodeLabel, shiftPeriode } from "@/lib/periode";
import { sansCadratin } from "@/lib/prospection/email";

// Source de vérité du rapport mensuel client : agrège le vendu/livré du mois, le
// MRR et les données SEO (positions + visibilité) en un objet unique consommé par
// la page admin, l'espace client (portail) et l'email. Aucune écriture ici.

const HISTORIQUE_MOIS = 6;

export type RapportEngagement = {
  libelle: string;
  vendu: number;
  livre: number;
  items: { libelle: string; faitLe: Date | null }[];
};

export type RapportSite = { nom: string; engagements: RapportEngagement[] };

export type RapportMotCle = {
  texte: string;
  position: number | null;
  positionPrec: number | null;
  delta: number | null; // positionPrec - position (>0 = gagne des places)
  volume: number | null;
  url: string | null;
};

export type RapportData = {
  client: {
    id: string;
    nom: string;
    email: string | null;
    portailActif: boolean;
    portailToken: string | null;
  };
  periode: string;
  periodeLabel: string;
  mrr: number;
  totalVendu: number;
  totalLivre: number;
  tauxRealisation: number | null;
  sites: RapportSite[];
  livres: string[];
  seo: {
    motsCles: RapportMotCle[];
    historique: { periode: string; label: string; positionMoyenne: number | null }[];
    visibilite: { nbMotsCles: number | null; traficEstime: number | null } | null;
    suivi: boolean; // au moins un mot-clé suivi
  };
  rapport: {
    id: string;
    statut: string;
    intro: string | null;
    syntheseSeo: string | null;
    commentaire: string | null;
    actions: string | null;
    envoyeLe: Date | null;
  } | null;
};

// Charge et agrège tout le contenu du rapport d'un client pour une période.
export async function getRapportData(
  clientId: string,
  periode: string,
): Promise<RapportData | null> {
  const now = new Date();
  const periodePrec = shiftPeriode(periode, -1);
  const depuis = shiftPeriode(periode, -(HISTORIQUE_MOIS - 1));

  const client = await prisma.client.findUnique({
    where: { id: clientId },
    include: {
      sites: {
        orderBy: { nom: "asc" },
        include: {
          contrats: {
            include: { engagements: { include: { livrables: { where: { periode } } } } },
          },
          motsCles: {
            where: { actif: true },
            include: { releves: { where: { periode: { gte: depuis } } } },
          },
          visibilites: { where: { periode }, take: 1 },
        },
      },
      rapports: { where: { periode }, take: 1 },
    },
  });
  if (!client) return null;

  // MRR actif du client (même définition que partout).
  const mrr = client.sites
    .flatMap((s) => s.contrats)
    .filter((ct) => ct.statut === "actif" && ct.dateDebut <= now && ct.facturationDemarree)
    .reduce((s, ct) => s + ct.montantMensuel, 0);

  // Vendu / livré du mois, par site.
  const sites: RapportSite[] = client.sites
    .map((site) => ({
      nom: site.nom,
      engagements: site.contrats
        .flatMap((ct) => ct.engagements)
        .map((e) => ({
          libelle: e.libelle,
          vendu: e.livrables.length,
          livre: e.livrables.filter((l) => l.statut === "fait").length,
          items: e.livrables
            .filter((l) => l.statut === "fait")
            .map((l) => ({ libelle: l.libelle, faitLe: l.faitLe })),
        }))
        .filter((e) => e.vendu > 0),
    }))
    .filter((s) => s.engagements.length > 0);

  const totalVendu = sites.reduce((s, si) => s + si.engagements.reduce((a, e) => a + e.vendu, 0), 0);
  const totalLivre = sites.reduce((s, si) => s + si.engagements.reduce((a, e) => a + e.livre, 0), 0);
  const livres = sites.flatMap((s) => s.engagements.flatMap((e) => e.items.map((i) => i.libelle)));

  // --- SEO : positions par mot-clé (mois courant vs précédent) ---
  const motsCles: RapportMotCle[] = client.sites
    .flatMap((s) => s.motsCles)
    .map((mot) => {
      const cur = mot.releves.find((r) => r.periode === periode);
      const prec = mot.releves.find((r) => r.periode === periodePrec);
      const position = cur?.position ?? null;
      const positionPrec = prec?.position ?? null;
      const delta =
        position != null && positionPrec != null ? positionPrec - position : null;
      return {
        texte: mot.texte,
        position,
        positionPrec,
        delta,
        volume: cur?.volume ?? null,
        url: cur?.url ?? null,
      };
    });

  // Historique : position moyenne (mots-clés positionnés) par mois, sur la fenêtre.
  const parPeriode = new Map<string, number[]>();
  for (const mot of client.sites.flatMap((s) => s.motsCles)) {
    for (const r of mot.releves) {
      if (r.position == null) continue;
      const arr = parPeriode.get(r.periode) ?? [];
      arr.push(r.position);
      parPeriode.set(r.periode, arr);
    }
  }
  const historique: RapportData["seo"]["historique"] = [];
  for (let i = HISTORIQUE_MOIS - 1; i >= 0; i--) {
    const p = shiftPeriode(periode, -i);
    const positions = parPeriode.get(p);
    historique.push({
      periode: p,
      label: periodeLabel(p),
      positionMoyenne:
        positions && positions.length
          ? Math.round((positions.reduce((a, b) => a + b, 0) / positions.length) * 10) / 10
          : null,
    });
  }

  // Visibilité domaine : agrège les sites (somme des mots-clés, somme du trafic).
  const vis = client.sites.flatMap((s) => s.visibilites);
  const visibilite = vis.length
    ? {
        nbMotsCles: vis.reduce((a, v) => a + (v.nbMotsCles ?? 0), 0) || null,
        traficEstime: vis.reduce((a, v) => a + (v.traficEstime ?? 0), 0) || null,
      }
    : null;

  const suivi = client.sites.some((s) => s.motsCles.length > 0);
  const rapport = client.rapports[0] ?? null;

  return {
    client: {
      id: client.id,
      nom: client.nom,
      email: client.email,
      portailActif: client.portailActif,
      portailToken: client.portailToken,
    },
    periode,
    periodeLabel: periodeLabel(periode),
    mrr,
    totalVendu,
    totalLivre,
    tauxRealisation: totalVendu > 0 ? Math.round((totalLivre / totalVendu) * 100) : null,
    sites,
    livres,
    seo: { motsCles, historique, visibilite, suivi },
    rapport: rapport
      ? {
          id: rapport.id,
          statut: rapport.statut,
          intro: rapport.intro,
          syntheseSeo: rapport.syntheseSeo,
          commentaire: rapport.commentaire,
          actions: rapport.actions,
          envoyeLe: rapport.envoyeLe,
        }
      : null,
  };
}

// Top mouvements de positions pour l'email (mots-clés dont la position a bougé).
export function topMouvements(motsCles: RapportMotCle[]): RapportMotCle[] {
  return motsCles
    .filter((m) => m.delta != null && m.delta !== 0)
    .sort((a, b) => (b.delta ?? 0) - (a.delta ?? 0))
    .slice(0, 5);
}

// Construit l'email texte brut envoyé au client (chiffres clés + lien portail).
export function construireEmailRapport(
  data: RapportData,
  lien: string | null,
): { subject: string; text: string } {
  const { client, seo } = data;

  const lignesSeo: string[] = [];
  if (seo.visibilite?.nbMotsCles != null) {
    lignesSeo.push(
      `Visibilité : ${seo.visibilite.nbMotsCles} mots-clés positionnés sur Google` +
        (seo.visibilite.traficEstime != null
          ? ` (~${seo.visibilite.traficEstime} visites/mois estimées).`
          : "."),
    );
  }
  const mouvements = topMouvements(seo.motsCles);
  if (mouvements.length) {
    lignesSeo.push(
      "Évolution des positions :\n" +
        mouvements
          .map((m) => {
            const sens = (m.delta ?? 0) > 0 ? "en hausse" : "en baisse";
            return `- ${m.texte} : ${m.positionPrec} -> ${m.position} (${sens})`;
          })
          .join("\n"),
    );
  }

  const lignesLivre = data.livres.length
    ? "Ce que nous avons réalisé ce mois-ci :\n" +
      data.livres.map((l) => `- ${l}`).join("\n")
    : null;

  const rapport = data.rapport;
  const corps = [
    `Bonjour ${client.nom},`,
    rapport?.intro?.trim() ||
      `Voici votre point de visibilité pour ${data.periodeLabel}.`,
    lignesSeo.length ? lignesSeo.join("\n\n") : null,
    lignesLivre,
    rapport?.commentaire?.trim() || null,
    rapport?.actions?.trim() ? `La suite :\n${rapport.actions.trim()}` : null,
    lien ? `Le rapport complet (courbes et détails) est sur votre espace :\n${lien}` : null,
    "Maxence",
  ]
    .filter(Boolean)
    .join("\n\n");

  return {
    subject: sansCadratin(`Votre point du mois, ${data.periodeLabel}`),
    text: sansCadratin(corps),
  };
}
