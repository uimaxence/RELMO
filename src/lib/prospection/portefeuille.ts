// Double scrape (cf. relmo-mode-partenaire.md §2, §4). On lit le site d'un
// PARTENAIRE (comptable, graphiste…), on détecte la zone « clients / références /
// témoignages » et on extrait les NOMS d'entreprises de son portefeuille aval.
// Chaque nom part ensuite dans le pipeline d'audit client existant.
//
// 100 % regex (comme audit.ts, pas de cheerio). Garde-fou §7 : on ne FABRIQUE
// jamais un nom. Extraction incertaine → confiance LOW, marquée pour vérif
// manuelle, jamais devinée. Alt/lien = HIGH, nom de fichier = MEDIUM, témoignage
// = LOW (ordre de fiabilité de la source).

const UA = "Mozilla/5.0 (compatible; RelmoAudit/1.0; +audit-prospection)";

export type Confidence = "HIGH" | "MEDIUM" | "LOW";

export type PortefeuilleItem = {
  nom: string; // nom d'entreprise normalisé
  site: string | null; // domaine du client si le logo pointe vers son site (bonus)
  confidence: Confidence;
  source: string; // « alt » | « lien » | « fichier » | « témoignage » (traçabilité)
};

// Titres de section qui signalent une zone portefeuille (ordre de priorité §4).
const ZONE_RE =
  /clients|r[eé]f[eé]rences|ils\s+nous\s+font\s+confiance|t[eé]moignages|portfolio|r[eé]alisations|partenaires|nos\s+(clients|partenaires)|trusted\s+by|they\s+trust/i;

// Noms d'actifs / mentions qui ne sont PAS un client (on ne les garde pas).
const JUNK_NOM =
  /^(logo|logos|client|clients|placeholder|avatar|image|img|photo|banni[eè]re|banner|icon|ic[oô]ne|slider|slide|hero|thumb|thumbnail|default|group|mask|layer|rectangle|frame|ellipse|vector|asset|sans[- ]titre|untitled|screenshot|capture|partenaire|partenaires|témoignage|temoignage)([-_ ]?\d+)?$/i;

// Hôtes à ignorer comme « site client » (réseaux, CDN, plateformes).
const HOST_IGNORE =
  /(facebook|instagram|linkedin|twitter|x\.com|youtube|tiktok|pinterest|wa\.me|whatsapp|google\.|goo\.gl|maps\.|gstatic|gravatar|googleapis|cloudflare|cdn|jsdelivr|unpkg|fontawesome|wixstatic|squarespace-cdn|shopify|calendly|doctolib|mailto|tel:)/i;

// Suffixes juridiques retirés à la normalisation (dédup plus fiable).
const SUFFIXE_JURIDIQUE =
  /\b(sarl|s\.a\.r\.l|sas|s\.a\.s|sasu|eurl|sci|scop|sa|s\.a|snc|gie|eirl|micro[- ]entreprise|auto[- ]entrepreneur|ei|ltd|llc|inc|gmbh|group|groupe)\b\.?/gi;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function hostDe(url: string, base?: string): string {
  try {
    return new URL(url, base).host.replace(/^www\./i, "").toLowerCase();
  } catch {
    return "";
  }
}

// Nettoie et normalise un nom d'entreprise. Renvoie "" si le résultat est du bruit
// (trop court, générique, purement numérique) → la fiche n'est pas créée.
export function normaliserNom(raw: string): string {
  let s = raw
    .replace(/&amp;/gi, "&")
    .replace(/&#0?39;|&apos;/gi, "'")
    .replace(/[_]+/g, " ")
    .replace(/\.(png|jpe?g|gif|webp|svg|avif)$/i, "")
    .replace(/\s+/g, " ")
    .trim();
  // « logo boulangerie martin » → « boulangerie martin »
  s = s.replace(/^(logo|logotype|client|r[eé]f(?:[eé]rence)?)[-\s:]+/i, "").trim();
  s = s.replace(SUFFIXE_JURIDIQUE, "").replace(/\s{2,}/g, " ").trim();
  s = s.replace(/[·•|,;–—-]+\s*$/, "").trim();
  if (s.length < 2 || s.length > 80) return "";
  if (JUNK_NOM.test(s)) return "";
  if (/^\d+$/.test(s)) return "";
  // Au moins une lettre.
  if (!/[a-zà-ÿ]/i.test(s)) return "";
  // Casse : si tout minuscule ou tout majuscule, on capitalise chaque mot.
  if (s === s.toLowerCase() || s === s.toUpperCase()) {
    s = s
      .toLowerCase()
      .replace(/\b\p{L}/gu, (c) => c.toUpperCase());
  }
  return s;
}

// Découpe le html en fenêtres autour des titres de section « portefeuille ».
// Une fenêtre = 6000 caractères après le mot-clé (assez pour couvrir une grille
// de logos ou un bloc de témoignages). Fenêtres fusionnées si elles se chevauchent.
function zonesPortefeuille(html: string): string[] {
  const spans: [number, number][] = [];
  for (const m of html.matchAll(new RegExp(ZONE_RE.source, "gi"))) {
    const start = m.index ?? 0;
    spans.push([start, Math.min(html.length, start + 6000)]);
  }
  if (!spans.length) return [];
  spans.sort((a, b) => a[0] - b[0]);
  const merged: [number, number][] = [spans[0]];
  for (const [s, e] of spans.slice(1)) {
    const last = merged[merged.length - 1];
    if (s <= last[1]) last[1] = Math.max(last[1], e);
    else merged.push([s, e]);
  }
  return merged.map(([s, e]) => html.slice(s, e));
}

function attrImg(imgTag: string, name: string): string {
  const m = imgTag.match(new RegExp(`\\b${name}\\s*=\\s*["']([^"']*)["']`, "i"));
  return m ? m[1].trim() : "";
}

// Nom d'entreprise depuis un chemin de fichier de logo.
function nomDepuisFichier(src: string): string {
  const file = (src.split("?")[0].split("/").pop() ?? "")
    .replace(/\.(png|jpe?g|gif|webp|svg|avif)$/i, "")
    .replace(/[-_]/g, " ")
    .replace(/\b\d{2,}\b/g, " ") // dimensions / hash numériques
    .trim();
  return file;
}

// Extrait les entreprises d'une zone : liens-logos (HIGH), images (alt HIGH,
// fichier MEDIUM), puis témoignages (LOW). Dédup par nom normalisé dans l'appelant.
function extraireDeZone(zone: string, baseUrl: string, ownHost: string): PortefeuilleItem[] {
  const items: PortefeuilleItem[] = [];
  const imgVus = new Set<string>();

  // (1) Liens contenant un logo → le domaine cible est un signal direct (HIGH).
  for (const a of zone.matchAll(/<a\b[^>]*href\s*=\s*["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)) {
    const href = a[1];
    const inner = a[2];
    const img = inner.match(/<img\b[^>]*>/i)?.[0];
    if (!img) continue;
    const src = attrImg(img, "src") || attrImg(img, "data-src");
    if (src) imgVus.add(src);
    const host = hostDe(href, baseUrl);
    const externe = host && host !== ownHost && !HOST_IGNORE.test(href);
    const nom = normaliserNom(
      attrImg(img, "alt") ||
        attrImg(img, "title") ||
        nomDepuisFichier(src) ||
        (externe ? host.split(".")[0] : ""),
    );
    if (!nom) continue;
    items.push({
      nom,
      site: externe ? `https://${host}` : null,
      confidence: externe || attrImg(img, "alt") ? "HIGH" : "MEDIUM",
      source: externe ? "lien" : "alt",
    });
  }

  // (2) Images nues (logos sans lien) : alt = HIGH, sinon nom de fichier = MEDIUM.
  for (const img of zone.matchAll(/<img\b[^>]*>/gi)) {
    const tag = img[0];
    const src = attrImg(tag, "src") || attrImg(tag, "data-src");
    if (src && imgVus.has(src)) continue;
    const alt = attrImg(tag, "alt") || attrImg(tag, "title");
    const nom = normaliserNom(alt || nomDepuisFichier(src));
    if (!nom) continue;
    items.push({
      nom,
      site: null,
      confidence: alt ? "HIGH" : "MEDIUM",
      source: alt ? "alt" : "fichier",
    });
  }

  // (3) Témoignages : société citée dans un <cite> ou après « , » en fin de
  // citation. Peu fiable → LOW, marqué pour vérification manuelle.
  for (const c of zone.matchAll(/<cite\b[^>]*>([\s\S]*?)<\/cite>/gi)) {
    const txt = c[1].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
    // « Jean Martin, Boulangerie Martin » → on garde ce qui suit la virgule.
    const societe = txt.includes(",") ? txt.split(",").slice(1).join(",") : txt;
    const nom = normaliserNom(societe);
    if (nom) items.push({ nom, site: null, confidence: "LOW", source: "témoignage" });
  }

  return items;
}

// Liens vers une page dédiée « clients / références » (scan complet en zone).
function liensPortefeuille(html: string, baseUrl: string): string[] {
  const urls = new Set<string>();
  for (const m of html.matchAll(/<a\b[^>]*href\s*=\s*["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)) {
    const href = m[1];
    const txt = m[2].replace(/<[^>]+>/g, " ");
    if (ZONE_RE.test(href + " " + txt)) {
      try {
        const u = new URL(href, baseUrl);
        if (u.host === new URL(baseUrl).host) urls.add(u.href);
      } catch {
        /* href invalide */
      }
    }
  }
  return [...urls].slice(0, 2);
}

async function fetchHtml(url: string, timeout = 15000): Promise<string> {
  try {
    const res = await fetch(url, {
      redirect: "follow",
      headers: { "User-Agent": UA, Accept: "text/html,application/xhtml+xml" },
      signal: AbortSignal.timeout(timeout),
    });
    if (!res.ok) return "";
    return await res.text();
  } catch {
    return "";
  }
}

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

export type ScrapePortefeuille = {
  ok: boolean;
  items: PortefeuilleItem[];
  zonesTrouvees: number; // nb de zones détectées (0 = gate §3 non passé)
  error?: string;
};

// Scrape complet : home + éventuelle page « références » → liste dédupliquée
// d'entreprises du portefeuille aval, triée par confiance (HIGH d'abord).
export async function scraperPortefeuille(
  rawUrl: string | null | undefined,
  opts?: { max?: number },
): Promise<ScrapePortefeuille> {
  const url = normalizeUrl(rawUrl);
  if (!url) return { ok: false, items: [], zonesTrouvees: 0, error: "Aucun site à scanner." };

  const home = await fetchHtml(url);
  if (!home) return { ok: false, items: [], zonesTrouvees: 0, error: "Site inaccessible." };

  const ownHost = hostDe(url);
  let zones = zonesPortefeuille(home);

  // Pages dédiées « références / clients » : scannées entièrement comme une zone.
  for (const lien of liensPortefeuille(home, url)) {
    const page = await fetchHtml(lien, 10000);
    if (page) zones.push(page);
    await sleep(200);
  }
  zones = zones.filter(Boolean);

  const brut = zones.flatMap((z) => extraireDeZone(z, url, ownHost));

  // Dédup par nom normalisé (clé lowercase) en gardant la MEILLEURE confiance et
  // le site s'il a été trouvé. On écarte le partenaire lui-même.
  const rang: Record<Confidence, number> = { HIGH: 3, MEDIUM: 2, LOW: 1 };
  const parNom = new Map<string, PortefeuilleItem>();
  for (const it of brut) {
    const cle = it.nom.toLowerCase();
    if (hostDe(it.site ?? "") === ownHost) it.site = null;
    if (it.nom.toLowerCase() === ownHost.split(".")[0]) continue;
    const prev = parNom.get(cle);
    if (!prev) {
      parNom.set(cle, it);
    } else {
      parNom.set(cle, {
        ...prev,
        site: prev.site ?? it.site,
        confidence: rang[it.confidence] > rang[prev.confidence] ? it.confidence : prev.confidence,
        source: rang[it.confidence] > rang[prev.confidence] ? it.source : prev.source,
      });
    }
  }

  const items = [...parNom.values()]
    .sort((a, b) => rang[b.confidence] - rang[a.confidence])
    .slice(0, opts?.max ?? 20);

  return { ok: true, items, zonesTrouvees: zones.length };
}
