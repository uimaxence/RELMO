import { ImapFlow } from "imapflow";
import { simpleParser } from "mailparser";
import { prisma } from "@/lib/db";

// Détection automatique des réponses (server-only). Lit la boîte Gmail en IMAP
// avec les mêmes identifiants que le SMTP (le mot de passe d'application Gmail
// vaut pour les deux). But : ne JAMAIS relancer un prospect qui a déjà répondu,
// et honorer un « STOP » (opt-out RGPD). C'est la sécurité de l'auto-relance.
//
// .env (en plus des SMTP_*) :
//   IMAP_HOST   ex. imap.gmail.com          [défaut imap.gmail.com]
//   IMAP_PORT   993                          [défaut 993]

const LOOKBACK_JOURS = 14; // fenêtre de scan (au-delà, une réponse est trop tardive)

export function imapConfigured(): boolean {
  return Boolean(process.env.SMTP_USER && process.env.SMTP_PASSWORD);
}

function normaliseEmail(e?: string | null): string {
  return (e || "").trim().toLowerCase();
}

// Message-ID sans chevrons ni casse, pour comparer References/In-Reply-To.
function normaliseId(id?: string | null): string {
  return (id || "").replace(/[<>]/g, "").trim().toLowerCase();
}

// Un prospect a-t-il demandé à ne plus être contacté ? (opt-out large et tolérant)
function estStop(texte: string): boolean {
  const t = texte.toLowerCase();
  return (
    /(^|[\s"«.,;:])stop([\s"».,;:!?]|$)/.test(t) ||
    /ne plus (me|nous|m'|me\s)?\s*(contacter|recontacter|écrire|solliciter)/.test(t) ||
    /me (retirer|désinscrire|désabonner)/.test(t) ||
    /désinscri|désabonn/.test(t)
  );
}

export type ScanResult = {
  ok: boolean;
  error?: string;
  reponses: number; // prospects marqués « répondu »
  stops: number; // prospects marqués opt-out
  scannes: number; // messages parcourus
};

// Scanne l'INBOX, marque `reponduLe` (réponse détectée) et `optOutLe` (STOP) sur
// les prospects encore en attente. Idempotent : on ne touche que ceux non résolus.
export async function scannerReponses(): Promise<ScanResult> {
  if (!imapConfigured()) {
    return { ok: false, error: "IMAP non configuré (SMTP_USER/PASSWORD).", reponses: 0, stops: 0, scannes: 0 };
  }

  // On ne s'intéresse qu'aux prospects contactés par mail, sans réponse ni opt-out.
  const enAttente = await prisma.prospect.findMany({
    where: { statut: "contacte", reponduLe: null, optOutLe: null, canalContact: "email" },
    select: { id: true, email: true, emailsTous: true, dernierMessageId: true },
  });
  if (!enAttente.length) return { ok: true, reponses: 0, stops: 0, scannes: 0 };

  // Index de matching : par adresse (réponse depuis l'adresse contactée) et par
  // Message-ID envoyé (réponse depuis une autre adresse mais dans le même thread).
  const parEmail = new Map<string, string>();
  const parMsgId = new Map<string, string>();
  for (const p of enAttente) {
    for (const e of [p.email, ...(p.emailsTous?.split(/\s+/) ?? [])]) {
      const n = normaliseEmail(e);
      if (n) parEmail.set(n, p.id);
    }
    const mid = normaliseId(p.dernierMessageId);
    if (mid) parMsgId.set(mid, p.id);
  }

  const client = new ImapFlow({
    host: process.env.IMAP_HOST || "imap.gmail.com",
    port: Number(process.env.IMAP_PORT || 993),
    secure: true,
    auth: { user: process.env.SMTP_USER!, pass: process.env.SMTP_PASSWORD! },
    logger: false,
  });

  const aRepondu = new Set<string>();
  const aStop = new Set<string>();
  let scannes = 0;

  try {
    await client.connect();
    const lock = await client.getMailboxLock("INBOX");
    try {
      const since = new Date(Date.now() - LOOKBACK_JOURS * 86_400_000);

      // Passe 1 (métadonnées, léger) : repère les messages qui matchent un prospect.
      const matches: { uid: number; pid: string }[] = [];
      for await (const msg of client.fetch(
        { since },
        { uid: true, envelope: true, headers: ["references", "in-reply-to"] },
      )) {
        scannes++;
        const from = normaliseEmail(msg.envelope?.from?.[0]?.address);
        let pid = from ? parEmail.get(from) : undefined;
        if (!pid && msg.headers) {
          const cites = (msg.headers.toString("utf8").match(/<[^>]+>/g) ?? []).map(normaliseId);
          for (const id of cites) {
            const found = parMsgId.get(id);
            if (found) { pid = found; break; }
          }
        }
        if (pid) matches.push({ uid: msg.uid, pid });
      }

      // Passe 2 (corps, uniquement les messages matchés) : détecte un éventuel STOP.
      for (const m of matches) {
        aRepondu.add(m.pid);
        try {
          const full = await client.fetchOne(String(m.uid), { source: true }, { uid: true });
          if (full && full.source) {
            const parsed = await simpleParser(full.source);
            if (estStop(`${parsed.subject ?? ""} ${parsed.text ?? ""}`)) aStop.add(m.pid);
          }
        } catch {
          // Corps illisible : on garde « répondu », on ne présume pas un STOP.
        }
      }
    } finally {
      lock.release();
    }
    await client.logout();
  } catch (e) {
    try { await client.close(); } catch { /* déjà fermé */ }
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Scan IMAP impossible.",
      reponses: 0,
      stops: 0,
      scannes,
    };
  }

  const now = new Date();
  // Réponse simple : horodate `reponduLe` (fiabilise aussi le taux de réponse).
  for (const id of aRepondu) {
    await prisma.prospect.update({ where: { id }, data: { reponduLe: now } });
  }
  // STOP : opt-out définitif + sort du pipeline (prime sur la simple réponse).
  for (const id of aStop) {
    await prisma.prospect.update({ where: { id }, data: { optOutLe: now, statut: "ecarte" } });
  }

  return { ok: true, reponses: aRepondu.size, stops: aStop.size, scannes };
}
