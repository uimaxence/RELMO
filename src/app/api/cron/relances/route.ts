import { NextResponse } from "next/server";

import { prisma } from "@/lib/db";
import { ensureReglage } from "@/lib/wishlist";
import { smtpConfigured, sendMail } from "@/lib/mailer";
import { emailValide, construireEmail } from "@/lib/prospection/email";
import { scannerReponses } from "@/lib/prospection/reponses";
import { genererRelanceProspect } from "@/lib/ai/assistant";
import {
  PROSPECT_RELANCE_JOURS,
  RELANCE_MAX,
  RELANCE_AUTO_PLAFOND_JOUR,
  RELANCE_AUTO_DELAI_SEC,
} from "@/lib/constants";

// Cron quotidien des relances automatiques (cf. vercel.json). Séquence :
//   1. scan IMAP des réponses (marque reponduLe / optOutLe) — SÉCURITÉ : sans
//      scan fiable, on n'envoie rien (sinon on relance des gens qui ont répondu).
//   2. sélection des relances réellement dues + garde-fous.
//   3. génération + envoi throttlé + reprogrammation.
// Déclenché par Vercel avec l'en-tête « Authorization: Bearer $CRON_SECRET ».
// L'interrupteur Reglage.relanceAutoActive doit être ON, sinon no-op.

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function autorise(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false; // pas de secret configuré = endpoint fermé
  return req.headers.get("authorization") === `Bearer ${secret}`;
}

export async function GET(req: Request) {
  if (!autorise(req)) {
    return NextResponse.json({ ok: false, error: "Non autorisé." }, { status: 401 });
  }

  const reglage = await ensureReglage();
  if (!reglage.relanceAutoActive) {
    return NextResponse.json({ ok: true, skipped: "Relances auto désactivées (interrupteur OFF)." });
  }
  if (!smtpConfigured()) {
    return NextResponse.json({ ok: false, error: "SMTP non configuré." }, { status: 200 });
  }

  // 1. Détection des réponses. Si le scan échoue, on ABORTE l'envoi (fail-safe) :
  //    mieux vaut ne pas relancer que relancer quelqu'un qui a déjà répondu.
  const scan = await scannerReponses();
  if (!scan.ok) {
    return NextResponse.json(
      { ok: false, error: `Scan des réponses impossible, aucune relance envoyée : ${scan.error}` },
      { status: 200 },
    );
  }

  // 2. Relances dues (tous les garde-fous en une requête).
  const now = new Date();
  const dus = await prisma.prospect.findMany({
    where: {
      statut: "contacte",
      canalContact: "email",
      reponduLe: null,
      optOutLe: null,
      flagConcurrent: false,
      flagAQualifier: false,
      relanceLe: { lte: now },
      nbRelances: { lt: RELANCE_MAX },
      email: { not: null },
    },
    orderBy: { relanceLe: "asc" },
    take: RELANCE_AUTO_PLAFOND_JOUR,
  });

  // 3. Génération + envoi throttlé.
  let envoyees = 0;
  const erreurs: { id: string; nom: string; error: string }[] = [];

  for (let i = 0; i < dus.length; i++) {
    const p = dus[i];
    if (!emailValide(p.email)) {
      erreurs.push({ id: p.id, nom: p.nom, error: "EMAIL_INVALIDE" });
      continue;
    }

    const gen = await genererRelanceProspect({
      nom: p.nom,
      ville: p.ville,
      activite: p.activite,
      messagePrecedent: p.messageEnvoye,
      numero: p.nbRelances + 1,
    });
    if (!gen.ok) {
      erreurs.push({ id: p.id, nom: p.nom, error: gen.error });
      continue;
    }

    const { objet, corps } = construireEmail(gen.text, reglage);
    // Relance dans le MÊME fil que le 1er mail : on garde l'objet d'origine en
    // « Re: … » (Gmail thread sur References + sujet) et on chaîne les Message-ID.
    const base = p.dernierObjet?.trim() || objet;
    if (!base) {
      erreurs.push({ id: p.id, nom: p.nom, error: "Objet manquant (1er envoi et relance)." });
      continue;
    }
    const sujet = /^re\s*:/i.test(base) ? base : `Re: ${base}`;

    const res = await sendMail({
      to: p.email!,
      subject: sujet,
      text: corps,
      inReplyTo: p.dernierMessageId ?? undefined,
      references: p.dernierMessageId ?? undefined,
    });
    if (!res.ok) {
      erreurs.push({ id: p.id, nom: p.nom, error: res.error });
      continue;
    }

    await prisma.prospect.update({
      where: { id: p.id },
      data: {
        relanceFaiteLe: now,
        relanceLe: new Date(now.getTime() + PROSPECT_RELANCE_JOURS * 86_400_000),
        nbRelances: p.nbRelances + 1,
        dernierMessageId: res.messageId ?? undefined,
        dernierObjet: sujet,
      },
    });
    envoyees++;

    // Throttle (sauf après le dernier).
    if (i < dus.length - 1) await sleep(RELANCE_AUTO_DELAI_SEC * 1000);
  }

  return NextResponse.json({
    ok: true,
    scan: { reponses: scan.reponses, stops: scan.stops, messagesScannes: scan.scannes },
    dues: dus.length,
    envoyees,
    erreurs,
  });
}
