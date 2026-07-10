import { chat } from "@/lib/ai/client";
import { providerConfigured } from "@/lib/ai/providers";

// Analyse VISUELLE d'un site prospect : on capture la page d'accueil (service HTTP,
// compatible Vercel serverless) puis un modèle de vision bon marché (Gemini Flash)
// juge le design. Le verdict enrichit l'audit : l'accroche peut alors AFFIRMER le
// design (« daté sur mobile ») au lieu d'une généralité prudente. Dégrade proprement
// sans clé Gemini (renvoie null → audit en mode « design couvert »).

export type VerdictVisuel = {
  modernite: string; // moderne | correct | date
  constat: string; // 1-2 phrases exploitables
  pointsVisuels: string[]; // défauts visuels précis
  siteVisible: boolean; // false = capture = écran de chargement/blanc/erreur → verdict inexploitable
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function grab(
  endpoint: string,
  timeout: number,
): Promise<{ buf: Buffer; mime: string } | null> {
  try {
    const res = await fetch(endpoint, { signal: AbortSignal.timeout(timeout) });
    if (!res.ok) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    const ct = res.headers.get("content-type");
    const mime = ct && ct.startsWith("image/") ? ct : "image/png";
    return { buf, mime };
  } catch {
    return null;
  }
}

// Capture la home et renvoie un data URI base64 (ou null).
// - ScreenshotOne si SCREENSHOTONE_KEY : synchrone et fiable (recommandé en prod).
// - Sinon thum.io (sans clé) : rend en ASYNCHRONE, la 1re requête peut renvoyer un
//   placeholder → on réessaie jusqu'à obtenir une vraie image.
async function capturerScreenshot(url: string): Promise<string | null> {
  const cible = /^https?:\/\//i.test(url) ? url : `https://${url}`;
  const key = process.env.SCREENSHOTONE_KEY;

  if (key) {
    // `wait_until=networkidle2` + `delay=3` : on attend que le réseau se calme et on
    // laisse 3 s de plus aux splash/loaders JS de disparaître, sinon on photographie
    // l'écran de chargement au lieu du vrai site.
    const endpoint =
      `https://api.screenshotone.com/take?access_key=${key}&url=${encodeURIComponent(cible)}` +
      `&format=jpg&viewport_width=1280&viewport_height=900&image_quality=72` +
      `&wait_until=networkidle2&delay=3` +
      `&block_ads=true&block_cookie_banners=true&cache=true`;
    const r = await grab(endpoint, 40_000);
    return r && r.buf.byteLength > 3_000
      ? `data:${r.mime};base64,${r.buf.toString("base64")}`
      : null;
  }

  // `wait/5` : laisse la page (et les splash/loaders JS) finir de rendre avant la
  // capture, sinon on photographie l'écran de chargement.
  const endpoint = `https://image.thum.io/get/width/1200/crop/1000/wait/5/${cible}`;
  for (let i = 0; i < 3; i++) {
    const r = await grab(endpoint, 25_000);
    // Une vraie capture pèse > ~10 Ko ; en-dessous c'est un placeholder de rendu.
    if (r && r.buf.byteLength > 10_000) {
      return `data:${r.mime};base64,${r.buf.toString("base64")}`;
    }
    await sleep(3_500);
  }
  return null;
}

const SYS_VISUEL = `Tu es directeur artistique. On te montre la capture d'écran de la page d'accueil d'un site d'entreprise locale. Juge UNIQUEMENT le VISUEL / design (pas le contenu, pas le SEO). Sois honnête, concret et bref.
AVANT de juger : si la capture ne montre PAS le vrai site mais un écran de chargement (spinner, "loading", barre de progression), une page blanche/noire quasi vide, une erreur (404, 500, "site indisponible"), ou un mur de cookies/consentement qui masque tout, alors le design N'EST PAS visible : réponds {"siteVisible":false} et laisse les autres champs vides. Ne DÉCRIS JAMAIS un écran de chargement comme si c'était le design du site.
Réponds UNIQUEMENT en JSON. "siteVisible" = true si le vrai site est visible et jugeable, false sinon. "modernite" = UN SEUL mot, exactement "moderne" OU "correct" OU "date" (jamais les trois). Format : {"siteVisible":true,"modernite":"date","constat":"1-2 phrases en français décrivant ce qui se voit (mise en page, typographie, couleurs, images, impression générale, rendu mobile si visible)","pointsVisuels":["2 à 4 défauts visuels précis, courts"]}.
"date" = design qui fait visiblement ancien (années 2000-2010 : dégradés, polices système, images pixelisées ou étirées, mise en page rigide, trop chargé, boutons old-school). "correct" = propre mais sans caractère. "moderne" = épuré, aéré, typographie soignée, responsive.
Français impeccable. INTERDIT d'utiliser le tiret cadratin « — » ou demi-cadratin « – » (virgule ou point à la place).`;

function nettoieJson(s: string): string {
  return s.replace(/^```(?:json)?/i, "").replace(/```$/i, "").trim();
}

export async function analyseVisuelle(
  url: string | null | undefined,
): Promise<VerdictVisuel | null> {
  if (!url || !providerConfigured("gemini")) return null;
  const image = await capturerScreenshot(url);
  if (!image) {
    if (process.env.RELMO_DEBUG) console.error("[visuel] screenshot null pour", url);
    return null;
  }

  const res = await chat({
    provider: "gemini",
    jsonMode: true,
    temperature: 0.3,
    maxTokens: 700,
    messages: [
      { role: "system", content: SYS_VISUEL },
      {
        role: "user",
        content: [
          { type: "text", text: "Analyse le visuel de cette page d'accueil." },
          { type: "image_url", image_url: { url: image } },
        ],
      },
    ],
  });
  if (!res.ok) {
    if (process.env.RELMO_DEBUG) console.error("[visuel] gemini KO:", res.error);
    return null;
  }

  try {
    const raw = JSON.parse(nettoieJson(res.text));
    // Capture inexploitable (écran de chargement, page blanche, erreur, mur cookies) :
    // on jette le verdict → l'audit repasse en mode « design couvert » générique
    // plutôt que d'écrire « votre site n'affiche qu'un écran de chargement ».
    if (raw.siteVisible === false) {
      if (process.env.RELMO_DEBUG) console.error("[visuel] site non visible (écran de chargement/erreur) pour", url);
      return null;
    }
    const constat = typeof raw.constat === "string" ? raw.constat.trim() : "";
    if (!constat) {
      if (process.env.RELMO_DEBUG) console.error("[visuel] constat vide. Texte:", res.text.slice(0, 300));
      return null;
    }
    return {
      modernite: typeof raw.modernite === "string" ? raw.modernite.trim() : "",
      constat,
      pointsVisuels: Array.isArray(raw.pointsVisuels)
        ? raw.pointsVisuels.map((p: unknown) => String(p).trim()).filter(Boolean)
        : [],
      siteVisible: true,
    };
  } catch (e) {
    if (process.env.RELMO_DEBUG) console.error("[visuel] parse KO:", (e as Error).message, "| texte:", res.text.slice(0, 300));
    return null;
  }
}
