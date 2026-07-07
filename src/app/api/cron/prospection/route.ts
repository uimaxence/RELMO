import { NextResponse } from "next/server";

import { prisma } from "@/lib/db";
import { ensureReglage } from "@/lib/wishlist";
import { collecterProspects, auditerNonAudites } from "@/app/actions/prospection";
import { placesConfigured } from "@/lib/prospection/places";
import { SECTEURS } from "@/lib/prospection/secteurs";
import { REGIONS, REGION_DEFAUT } from "@/lib/prospection/regions";
import {
  PROSPECTION_AUTO_KEYWORDS_PAR_SECTEUR,
  PROSPECTION_AUTO_BUDGET_MS,
  PROSPECTION_AUTO_MAX_ITER,
} from "@/lib/constants";

// Cron de prospection automatique (2×/jour, cf. vercel.json). À chaque passage :
//   1. Découvre ~50 prospects en faisant tourner les 4 secteurs sur des villes
//      des Pays de la Loire (rotation persistée → diversification entre runs).
//   2. Audite le backlog en lots, dans un budget de temps (le reste passe au run
//      suivant, les prospects persistent).
//   3. Met en FILE D'ENVOI (statut « a_contacter ») les prospects audités dont
//      l'accroche est prête. AUCUN envoi automatique : l'utilisateur valide et
//      envoie en 1 clic. Ceux sans email restent dans la file « à traiter »
//      (champ email éditable inline) pour qu'il complète l'adresse.
// Déclenché par Vercel (Authorization: Bearer $CRON_SECRET). Interrupteur
// Reglage.prospectionAutoActive doit être ON, sinon no-op.

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

function autorise(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return req.headers.get("authorization") === `Bearer ${secret}`;
}

// Tranche tournante de `k` mots-clés dans la liste d'un secteur (borne le coût).
function motsClesTournants(keywords: string[], rotation: number, k: number): string[] {
  if (keywords.length <= k) return keywords;
  const out: string[] = [];
  const start = (rotation * k) % keywords.length;
  for (let i = 0; i < k; i++) out.push(keywords[(start + i) % keywords.length]);
  return out;
}

export async function GET(req: Request) {
  if (!autorise(req)) {
    return NextResponse.json({ ok: false, error: "Non autorisé." }, { status: 401 });
  }

  const reglage = await ensureReglage();
  if (!reglage.prospectionAutoActive) {
    return NextResponse.json({ ok: true, skipped: "Prospection auto désactivée (interrupteur OFF)." });
  }
  if (!placesConfigured()) {
    return NextResponse.json(
      { ok: false, error: "GOOGLE_PLACES_API_KEY absente : découverte impossible (à ajouter côté Vercel)." },
      { status: 200 },
    );
  }

  const rotation = reglage.prospectionRotation;
  const villes = REGIONS[REGION_DEFAUT];

  // 1. Découverte multi-secteurs (une ville tournante par secteur).
  let decouverts = 0;
  const erreurs: { secteur: string; error: string }[] = [];
  for (let i = 0; i < SECTEURS.length; i++) {
    const secteur = SECTEURS[i];
    const ville = villes[(rotation * SECTEURS.length + i) % villes.length];
    const keywords = motsClesTournants(
      secteur.keywords,
      rotation,
      PROSPECTION_AUTO_KEYWORDS_PAR_SECTEUR,
    );
    try {
      const res = await collecterProspects({
        region: REGION_DEFAUT,
        secteur: secteur.cle,
        villes: [ville],
        keywords,
        pages: 1,
        campagne: "Auto",
      });
      if (res.ok) decouverts += res.ajoutes ?? 0;
      else erreurs.push({ secteur: secteur.cle, error: res.error ?? "collecte échouée" });
    } catch (e) {
      erreurs.push({ secteur: secteur.cle, error: e instanceof Error ? e.message : "collecte échouée" });
    }
  }

  // Avance la rotation pour le prochain run (villes/mots-clés suivants).
  await prisma.reglage.update({
    where: { id: "singleton" },
    data: { prospectionRotation: rotation + 1 },
  });

  // 2. Audit du backlog, borné par le temps (le reste passera au run suivant).
  const start = Date.now();
  let audites = 0;
  let restants = 0;
  let iter = 0;
  while (iter < PROSPECTION_AUTO_MAX_ITER) {
    const res = await auditerNonAudites();
    iter++;
    if (!res.ok) {
      erreurs.push({ secteur: "audit", error: res.error ?? "audit échoué" });
      break;
    }
    audites += res.audites ?? 0;
    restants = res.restants ?? 0;
    if (restants === 0) break;
    if (Date.now() - start > PROSPECTION_AUTO_BUDGET_MS) break;
  }

  // 3. Mise en file d'envoi : les audités prêts (accroche générée, non flaggés)
  //    passent en « a_contacter » (à valider en 1 clic). Ceux sans email y restent
  //    en « à traiter » (champ email à compléter dans la file).
  const misEnFile = await prisma.prospect.updateMany({
    where: {
      statut: "nouveau",
      statutAudit: { in: ["ok", "aucun_site"] },
      accrocheEmail: { not: null },
      flagConcurrent: false,
      flagAQualifier: false,
    },
    data: { statut: "a_contacter" },
  });

  // Bilan de la file : combien sont prêts (email présent) vs à traiter (sans email).
  const [fileTotale, sansEmail] = await Promise.all([
    prisma.prospect.count({ where: { statut: "a_contacter" } }),
    prisma.prospect.count({ where: { statut: "a_contacter", email: null } }),
  ]);

  return NextResponse.json({
    ok: true,
    decouverts,
    audites,
    backlogRestant: restants,
    misEnFileCeRun: misEnFile.count,
    file: { total: fileTotale, prets: fileTotale - sansEmail, aTraiterSansEmail: sansEmail },
    erreurs,
  });
}
