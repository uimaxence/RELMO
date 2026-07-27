import "server-only";
import { domaineDe } from "@/lib/prospection/places";

// Client DataForSEO générique (API REST v3, auth Basic login:mot de passe).
// Même philosophie que la couche IA (src/lib/ai/client.ts) : ne connaît rien du
// métier, renvoie un résultat sérialisable et ne throw jamais. Dégradation propre
// sans identifiants (DATAFORSEO_LOGIN / DATAFORSEO_PASSWORD absents → { ok:false }).
//
// ATTENTION : le connecteur MCP DataForSEO ne sert qu'en développement assisté ;
// l'app déployée appelle l'API REST directement avec SES propres identifiants.

const BASE = "https://api.dataforseo.com/v3";
const DEFAULT_LOCATION = "France";
const DEFAULT_LANGUE = "fr";

export function dataforseoConfigured(): boolean {
  return Boolean(process.env.DATAFORSEO_LOGIN && process.env.DATAFORSEO_PASSWORD);
}

function authHeader(): string | null {
  const login = process.env.DATAFORSEO_LOGIN;
  const password = process.env.DATAFORSEO_PASSWORD;
  if (!login || !password) return null;
  return "Basic " + Buffer.from(`${login}:${password}`).toString("base64");
}

type DfsResult<T> = { ok: true; data: T } | { ok: false; error: string };

// POST générique d'une tâche unique. DataForSEO attend un TABLEAU de tâches et
// renvoie `tasks[0].result`. Toute erreur (réseau, HTTP, code d'erreur DFS,
// crédits épuisés) est capturée et renvoyée en { ok:false }.
async function dfsPost<T = unknown>(
  path: string,
  task: Record<string, unknown>,
): Promise<DfsResult<T>> {
  const auth = authHeader();
  if (!auth) {
    return {
      ok: false,
      error:
        "Identifiants DataForSEO absents. Ajoute DATAFORSEO_LOGIN et DATAFORSEO_PASSWORD dans .env.",
    };
  }
  try {
    const res = await fetch(`${BASE}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: auth },
      body: JSON.stringify([task]),
      // Les endpoints « live » peuvent être lents ; borne l'attente.
      signal: AbortSignal.timeout(60_000),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      return { ok: false, error: `DataForSEO a répondu ${res.status}. ${body.slice(0, 200)}` };
    }
    const json = await res.json();
    const t = json?.tasks?.[0];
    if (!t || (t.status_code && t.status_code >= 40000)) {
      return { ok: false, error: `DataForSEO : ${t?.status_message ?? "réponse inattendue"}` };
    }
    return { ok: true, data: (t.result ?? null) as T };
  } catch (e) {
    const reason = e instanceof Error ? e.message : "erreur inconnue";
    return { ok: false, error: `Échec d'appel DataForSEO : ${reason}` };
  }
}

// --- Position d'un mot-clé pour un domaine (SERP Google organique) ---

type SerpItem = {
  type?: string;
  rank_group?: number;
  rank_absolute?: number;
  domain?: string;
  url?: string;
};

export type PositionResult = { position: number | null; url: string | null };

// Relève la position organique du domaine sur un mot-clé. `position` = null si le
// domaine n'apparaît pas dans les 100 premiers résultats organiques.
export async function releverPosition(opts: {
  keyword: string;
  domaine: string;
  location?: string | null;
  langue?: string | null;
}): Promise<DfsResult<PositionResult>> {
  const cible = domaineDe(opts.domaine); // hôte normalisé (sans http/www)
  const r = await dfsPost<Array<{ items?: SerpItem[] }>>("/serp/google/organic/live/advanced", {
    keyword: opts.keyword,
    location_name: opts.location || DEFAULT_LOCATION,
    language_code: opts.langue || DEFAULT_LANGUE,
    depth: 100,
  });
  if (!r.ok) return r;

  const items = r.data?.[0]?.items ?? [];
  const match = items.find(
    (it) =>
      it.type === "organic" &&
      it.domain &&
      domaineDe(it.domain) === cible,
  );
  return {
    ok: true,
    data: {
      position: match?.rank_group ?? null,
      url: match?.url ?? null,
    },
  };
}

// --- Volumes de recherche (Labs keyword_overview, un appel pour N mots-clés) ---

type KeywordOverviewItem = {
  keyword?: string;
  keyword_info?: { search_volume?: number };
};

export async function volumesMotsCles(
  keywords: string[],
  location?: string | null,
  langue?: string | null,
): Promise<DfsResult<Record<string, number | null>>> {
  const nettoyes = keywords.map((k) => k.trim()).filter(Boolean);
  if (nettoyes.length === 0) return { ok: true, data: {} };

  const r = await dfsPost<Array<{ items?: KeywordOverviewItem[] }>>(
    "/dataforseo_labs/google/keyword_overview/live",
    {
      keywords: nettoyes,
      location_name: location || DEFAULT_LOCATION,
      language_code: langue || DEFAULT_LANGUE,
    },
  );
  if (!r.ok) return r;

  const map: Record<string, number | null> = {};
  for (const it of r.data?.[0]?.items ?? []) {
    if (it.keyword) map[it.keyword.toLowerCase()] = it.keyword_info?.search_volume ?? null;
  }
  return { ok: true, data: map };
}

// --- Vue d'ensemble d'un domaine (Labs domain_rank_overview) ---

type DomainOverviewItem = {
  metrics?: { organic?: { count?: number; etv?: number } };
};

export type VisibiliteResult = { nbMotsCles: number | null; traficEstime: number | null };

export async function visibiliteDomaine(opts: {
  domaine: string;
  location?: string | null;
  langue?: string | null;
}): Promise<DfsResult<VisibiliteResult>> {
  const cible = domaineDe(opts.domaine);
  const r = await dfsPost<Array<{ items?: DomainOverviewItem[] }>>(
    "/dataforseo_labs/google/domain_rank_overview/live",
    {
      target: cible,
      location_name: opts.location || DEFAULT_LOCATION,
      language_code: opts.langue || DEFAULT_LANGUE,
    },
  );
  if (!r.ok) return r;

  const organic = r.data?.[0]?.items?.[0]?.metrics?.organic;
  return {
    ok: true,
    data: {
      nbMotsCles: organic?.count ?? null,
      traficEstime: organic?.etv != null ? Math.round(organic.etv) : null,
    },
  };
}
