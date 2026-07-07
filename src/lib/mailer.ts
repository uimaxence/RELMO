import nodemailer from "nodemailer";
import type { Transporter } from "nodemailer";
import { emailValide } from "@/lib/prospection/email";

export { emailValide };

// Envoi SMTP (prospection à froid — cf. docs/PROJET.md). On envoie depuis la boîte
// de l'utilisateur (Gmail/Workspace ou hébergeur) : un vrai mail humain, meilleur
// taux de réponse qu'un ESP, réputation de domaine préservée. Texte brut volontaire
// (délivrabilité + ton personnel). Dégradation propre sans variables SMTP.
//
// .env :
//   SMTP_HOST      ex. smtp.gmail.com | ssl0.ovh.net
//   SMTP_PORT      465 (SSL) | 587 (STARTTLS)          [défaut 465]
//   SMTP_USER      adresse complète (login)
//   SMTP_PASSWORD  mot de passe d'application (Gmail) | mot de passe boîte (OVH)
//   SMTP_FROM      "Maxence Cailleau <prospection@domaine.fr>" [défaut = SMTP_USER]
//   SMTP_SECURE    "true" | "false"                    [défaut : true si port 465]

export function smtpConfigured(): boolean {
  return Boolean(
    process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASSWORD,
  );
}

// Adresse expéditeur affichée (From / Reply-To).
export function smtpFrom(): string {
  return (process.env.SMTP_FROM || process.env.SMTP_USER || "").trim();
}

let cached: Transporter | null = null;

function transporter(): Transporter | null {
  if (!smtpConfigured()) return null;
  if (cached) return cached;
  const port = Number(process.env.SMTP_PORT || 465);
  const secure =
    process.env.SMTP_SECURE != null
      ? process.env.SMTP_SECURE.toLowerCase() === "true"
      : port === 465;
  cached = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port,
    secure,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASSWORD,
    },
  });
  return cached;
}

export type SendResult =
  | { ok: true; messageId?: string }
  | { ok: false; error: string };

// Envoie un mail en texte brut. Renvoie une erreur claire plutôt que de throw.
// En cas de succès, remonte le Message-ID (sert à matcher les réponses en IMAP).
export async function sendMail(input: {
  to: string;
  subject: string;
  text: string;
  replyTo?: string;
  inReplyTo?: string; // Message-ID du mail parent (threading des relances)
  references?: string; // chaîne de Message-ID du fil
}): Promise<SendResult> {
  const t = transporter();
  if (!t) {
    return {
      ok: false,
      error: "SMTP non configuré (renseigne SMTP_HOST/USER/PASSWORD dans .env).",
    };
  }
  if (!emailValide(input.to)) {
    return { ok: false, error: "EMAIL_INVALIDE" };
  }
  try {
    const info = await t.sendMail({
      from: smtpFrom(),
      to: input.to.trim(),
      replyTo: input.replyTo || smtpFrom(),
      subject: input.subject,
      text: input.text,
      inReplyTo: input.inReplyTo || undefined,
      references: input.references || undefined,
    });
    return { ok: true, messageId: info.messageId };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Échec de l'envoi." };
  }
}

// Vérifie la connexion SMTP (bouton « Tester la connexion » côté UI).
export async function verifierSmtp(): Promise<SendResult> {
  const t = transporter();
  if (!t) return { ok: false, error: "SMTP non configuré." };
  try {
    await t.verify();
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Connexion SMTP impossible." };
  }
}
