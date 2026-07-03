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
};

// Capture la home et renvoie un data URI base64 (ou null). ScreenshotOne si une clé
// est fournie (plus fiable), sinon thum.io sans clé (démarrage immédiat).
async function capturerScreenshot(url: string): Promise<string | null> {
  const cible = /^https?:\/\//i.test(url) ? url : `https://${url}`;
  const key = process.env.SCREENSHOTONE_KEY;
  const endpoint = key
    ? `https://api.screenshotone.com/take?access_key=${key}&url=${encodeURIComponent(cible)}` +
      `&format=jpg&viewport_width=1280&viewport_height=900&image_quality=72` +
      `&block_ads=true&block_cookie_banners=true&cache=true`
    : `https://image.thum.io/get/width/1200/crop/1000/${cible}`;
  try {
    const res = await fetch(endpoint, { signal: AbortSignal.timeout(20_000) });
    if (!res.ok) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.byteLength < 1500) return null; // trop petit = placeholder/erreur
    const ct = res.headers.get("content-type");
    const mime = ct && ct.startsWith("image/") ? ct : "image/jpeg";
    return `data:${mime};base64,${buf.toString("base64")}`;
  } catch {
    return null;
  }
}

const SYS_VISUEL = `Tu es directeur artistique. On te montre la capture d'écran de la page d'accueil d'un site d'entreprise locale. Juge UNIQUEMENT le VISUEL / design (pas le contenu, pas le SEO). Sois honnête, concret et bref.
Réponds UNIQUEMENT en JSON : {"modernite":"moderne|correct|date","constat":"1-2 phrases en français décrivant ce qui se voit (mise en page, typographie, couleurs, images, impression générale, rendu mobile si visible)","pointsVisuels":["2 à 4 défauts visuels précis, courts"]}.
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
  if (!image) return null;

  const res = await chat({
    provider: "gemini",
    jsonMode: true,
    temperature: 0.3,
    maxTokens: 500,
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
  if (!res.ok) return null;

  try {
    const raw = JSON.parse(nettoieJson(res.text));
    const constat = typeof raw.constat === "string" ? raw.constat.trim() : "";
    if (!constat) return null;
    return {
      modernite: typeof raw.modernite === "string" ? raw.modernite.trim() : "",
      constat,
      pointsVisuels: Array.isArray(raw.pointsVisuels)
        ? raw.pointsVisuels.map((p: unknown) => String(p).trim()).filter(Boolean)
        : [],
    };
  } catch {
    return null;
  }
}
