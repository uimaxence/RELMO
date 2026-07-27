import { NextResponse } from "next/server";

import { prisma } from "@/lib/db";
import { ensureReglage } from "@/lib/wishlist";
import { smtpConfigured, sendMail, smtpFrom } from "@/lib/mailer";
import { sansCadratin } from "@/lib/prospection/email";
import { currentPeriode, shiftPeriode, periodeLabel } from "@/lib/periode";
import { releverSite } from "@/lib/seo/releve";
import { getRapportData } from "@/lib/rapport";
import { genererIntroRapport, genererSyntheseSeo } from "@/lib/ai/assistant";

// Cron mensuel des rapports client (cf. vercel.json, le 1er du mois). Séquence,
// pour le mois écoulé :
//   1. relève les positions SEO + la visibilité de chaque site suivi (DataForSEO).
//   2. pré-génère un BROUILLON de rapport par client (intro + synthèse SEO IA) —
//      sans écraser un rapport déjà édité/envoyé.
//   3. envoie un RAPPEL à l'admin listant les rapports prêts à relire.
// Déclenché par Vercel avec « Authorization: Bearer $CRON_SECRET ».
// L'interrupteur Reglage.rapportMensuelActif doit être ON, sinon no-op.

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

function autorise(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return req.headers.get("authorization") === `Bearer ${secret}`;
}

// Base URL pour les liens du rappel (Vercel fournit VERCEL_URL sans protocole).
function baseUrl(): string | null {
  if (process.env.NEXT_PUBLIC_APP_URL) return process.env.NEXT_PUBLIC_APP_URL.replace(/\/$/, "");
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return null;
}

export async function GET(req: Request) {
  if (!autorise(req)) {
    return NextResponse.json({ ok: false, error: "Non autorisé." }, { status: 401 });
  }

  const reglage = await ensureReglage();
  if (!reglage.rapportMensuelActif) {
    return NextResponse.json({ ok: true, skipped: "Rapports mensuels désactivés (interrupteur OFF)." });
  }

  const periode = shiftPeriode(currentPeriode(), -1); // le mois écoulé

  // Clients actifs qui ont au moins un site (on ne rapporte que sur eux).
  const clients = await prisma.client.findMany({
    where: { statut: "actif", sites: { some: {} } },
    include: { sites: { include: { motsCles: { where: { actif: true } } } } },
    orderBy: { nom: "asc" },
  });

  const prets: { nom: string; id: string }[] = [];

  for (const client of clients) {
    // 1. Relevé SEO de chaque site qui a des mots-clés suivis.
    for (const site of client.sites) {
      if (site.motsCles.length === 0) continue;
      await releverSite(site.id, periode);
    }

    // 2. Brouillon : on ne (re)génère que s'il n'existe pas encore (préserve les
    //    éditions manuelles et les rapports déjà envoyés).
    const existant = await prisma.rapportMensuel.findUnique({
      where: { clientId_periode: { clientId: client.id, periode } },
    });
    if (existant) {
      prets.push({ nom: client.nom, id: client.id });
      continue;
    }

    const data = await getRapportData(client.id, periode);
    if (!data) continue;

    const intro = await genererIntroRapport(client.id, periode, data.livres);
    const synthese = data.seo.motsCles.length
      ? await genererSyntheseSeo(
          client.id,
          periode,
          data.seo.motsCles.map((m) => ({
            texte: m.texte,
            position: m.position,
            positionPrec: m.positionPrec,
            volume: m.volume,
          })),
          data.seo.visibilite,
        )
      : null;

    await prisma.rapportMensuel.create({
      data: {
        clientId: client.id,
        periode,
        intro: intro.ok ? intro.text : null,
        syntheseSeo: synthese?.ok ? synthese.text : null,
      },
    });
    prets.push({ nom: client.nom, id: client.id });
  }

  // 3. Rappel à l'admin. Destinataire : ADMIN_EMAIL, à défaut l'expéditeur SMTP.
  let rappelEnvoye = false;
  const dest = process.env.ADMIN_EMAIL || smtpFrom();
  if (prets.length && smtpConfigured() && dest) {
    const base = baseUrl();
    const lignes = prets.map((c) => {
      const lien = base ? `${base}/clients/${c.id}/rapport?periode=${periode}` : `Client : ${c.nom}`;
      return base ? `- ${c.nom} : ${lien}` : `- ${c.nom}`;
    });
    const texte = sansCadratin(
      [
        `Les rapports de ${periodeLabel(periode)} sont prêts à relire (${prets.length}).`,
        "Ouvre chacun, ajoute ton commentaire et tes actions, puis envoie-le au client :",
        lignes.join("\n"),
      ].join("\n\n"),
    );
    const res = await sendMail({
      to: dest,
      subject: sansCadratin(`Rapports ${periodeLabel(periode)} à préparer (${prets.length})`),
      text: texte,
    });
    rappelEnvoye = res.ok;
  }

  return NextResponse.json({
    ok: true,
    periode,
    rapportsPrepares: prets.length,
    rappelEnvoye,
  });
}
