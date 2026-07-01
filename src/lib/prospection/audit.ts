// Analyse technique légère d'un site prospect + extraction du contact.
// 100 % regex (pas de cheerio) : on lit la home, puis mentions légales / contact
// pour compléter email & téléphone. Les signaux nourrissent ensuite DeepSeek.

const UA = "Mozilla/5.0 (compatible; RelmoAudit/1.0; +audit-prospection)";

export type Signaux = {
  url: string;
  https: boolean;
  title: string | null;
  metaDescription: string | null;
  h1Count: number;
  viewport: boolean;
  generator: string | null;
  structuredData: boolean;
  ogTags: boolean;
  jquery: string | null;
  imgCount: number;
  imgSansAlt: number;
  derniereAnneeVisible: number | null;
  poidsHtmlKo: number;
};

export type Contacts = {
  emails: string[];
  phones: string[];
  siret: string | null;
  bestEmail: string;
};

export type AuditResult = {
  statut: "ok" | "aucun_site" | "erreur";
  error?: string;
  signals: Partial<Signaux>;
  contacts: Contacts;
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function normalizeUrl(raw: string | null | undefined): string | null {
  if (!raw) return null;
  let u = raw.trim();
  if (!/^https?:\/\//i.test(u)) u = "https://" + u;
  try {
    return new URL(u).href;
  } catch {
    return null;
  }
}

async function fetchHtml(
  url: string,
  timeout = 15000,
): Promise<{ ok: boolean; status: number; finalUrl: string; html: string; error?: string }> {
  try {
    const res = await fetch(url, {
      redirect: "follow",
      headers: { "User-Agent": UA, Accept: "text/html,application/xhtml+xml" },
      signal: AbortSignal.timeout(timeout),
    });
    return { ok: res.ok, status: res.status, finalUrl: res.url, html: await res.text() };
  } catch (e) {
    return { ok: false, status: 0, finalUrl: url, html: "", error: e instanceof Error ? e.message : String(e) };
  }
}

const EMAIL_RE = /[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}/g;
const PHONE_RE = /(?:\+33\s?|0)[1-9](?:[\s.\-]?\d{2}){4}/g;
const SIRET_RE = /\b\d{3}[\s.]?\d{3}[\s.]?\d{3}[\s.]?\d{5}\b/;
const BAD_EMAIL = /(\.(png|jpg|jpeg|gif|webp|svg)$)|(@(sentry|wixpress|example|email)\.)/i;

function extractContacts(html: string): { emails: string[]; phones: string[]; siret: string | null } {
  const emails = new Set<string>();
  const phones = new Set<string>();
  for (const m of html.matchAll(/mailto:([^"'?>\s]+)/gi)) {
    try {
      emails.add(decodeURIComponent(m[1]));
    } catch {
      emails.add(m[1]);
    }
  }
  for (const m of html.matchAll(EMAIL_RE)) emails.add(m[0]);
  for (const m of html.matchAll(/tel:([+0-9\s().\-]{8,})/gi)) phones.add(m[1].trim());
  for (const m of html.matchAll(PHONE_RE)) phones.add(m[0].trim());
  return {
    emails: [...emails].filter((e) => !BAD_EMAIL.test(e)),
    phones: [...phones],
    siret: html.match(SIRET_RE)?.[0] ?? null,
  };
}

function pickEmail(emails: string[], host: string): string {
  if (!emails.length) return "";
  const score = (e: string) => {
    const lo = e.toLowerCase();
    let s = 0;
    if (/noreply|no-reply|nepasrepondre/.test(lo)) s -= 5;
    if (/^(contact|bonjour|hello|info|accueil)@/.test(lo)) s += 3;
    if (host && lo.endsWith("@" + host.replace(/^www\./, ""))) s += 2;
    return s;
  };
  return [...emails].sort((a, b) => score(b) - score(a))[0];
}

// Liens vers mentions légales / contact (regex sur les <a href ...>).
function findContactPages(html: string, baseUrl: string): string[] {
  const urls = new Set<string>();
  for (const m of html.matchAll(/<a[^>]+href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)) {
    const href = m[1];
    const txt = m[2].replace(/<[^>]+>/g, " ").toLowerCase();
    if (/(mention|legal|légal|contact|cgv|confidential|confidentialit)/i.test(href + " " + txt)) {
      try {
        urls.add(new URL(href, baseUrl).href);
      } catch {
        /* href invalide, on ignore */
      }
    }
  }
  return [...urls].slice(0, 4);
}

function attr(html: string, re: RegExp): string | null {
  const m = html.match(re);
  return m ? m[1].trim() : null;
}

function buildSignaux(html: string, finalUrl: string): Signaux {
  const years = [...html.matchAll(/20\d{2}/g)]
    .map((m) => +m[0])
    .filter((y) => y >= 2005 && y <= 2026);
  const imgTags = html.match(/<img\b[^>]*>/gi) ?? [];
  const imgSansAlt = imgTags.filter((t) => !/\salt\s*=/i.test(t)).length;

  return {
    url: finalUrl,
    https: finalUrl.startsWith("https"),
    title: attr(html, /<title[^>]*>([\s\S]*?)<\/title>/i)?.slice(0, 120) || null,
    metaDescription:
      attr(html, /<meta[^>]+name=["']description["'][^>]+content=["']([^"']*)["']/i)?.slice(0, 200) || null,
    h1Count: (html.match(/<h1\b/gi) ?? []).length,
    viewport: /<meta[^>]+name=["']viewport["']/i.test(html),
    generator: attr(html, /<meta[^>]+name=["']generator["'][^>]+content=["']([^"']*)["']/i),
    structuredData: /<script[^>]+type=["']application\/ld\+json["']/i.test(html),
    ogTags: /<meta[^>]+property=["']og:/i.test(html),
    jquery: (html.match(/jquery[-.](\d+\.\d+)/i) ?? [])[1] ?? null,
    imgCount: imgTags.length,
    imgSansAlt,
    derniereAnneeVisible: years.length ? Math.max(...years) : null,
    poidsHtmlKo: Math.round(html.length / 1024),
  };
}

const emptyContacts: Contacts = { emails: [], phones: [], siret: null, bestEmail: "" };

export async function analyzeSite(rawUrl: string | null | undefined): Promise<AuditResult> {
  const url = normalizeUrl(rawUrl);
  if (!url) return { statut: "aucun_site", signals: {}, contacts: { ...emptyContacts } };

  const res = await fetchHtml(url);
  if (!res.ok || !res.html) {
    return {
      statut: "erreur",
      error: res.error || `HTTP ${res.status}`,
      signals: { url },
      contacts: { ...emptyContacts },
    };
  }

  const host = (() => {
    try {
      return new URL(res.finalUrl).host;
    } catch {
      return "";
    }
  })();

  const signals = buildSignaux(res.html, res.finalUrl);
  const base = extractContacts(res.html);
  const emails = new Set(base.emails);
  const phones = new Set(base.phones);
  let siret = base.siret;

  for (const p of findContactPages(res.html, res.finalUrl)) {
    if (emails.size && phones.size) break;
    const sub = await fetchHtml(p, 10000);
    if (sub.html) {
      const c = extractContacts(sub.html);
      c.emails.forEach((e) => emails.add(e));
      c.phones.forEach((ph) => phones.add(ph));
      siret = siret ?? c.siret;
    }
    await sleep(200);
  }

  const emailList = [...emails];
  const contacts: Contacts = {
    emails: emailList,
    phones: [...phones],
    siret,
    bestEmail: pickEmail(emailList, host),
  };

  return { statut: "ok", signals, contacts };
}
