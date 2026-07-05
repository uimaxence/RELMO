// Collecte Google Places (New) : `places:searchText` renvoie directement le site
// et le téléphone (pas de second appel Details). Dégrade proprement sans clé.
// Scopé par (ville × mot-clé) pour rester dans le budget temps d'une server action.

const PLACES_URL = "https://places.googleapis.com/v1/places:searchText";

export type LeadBrut = {
  nom: string;
  site: string;
  ville: string;
  activite: string;
  telephone: string;
  placeId: string;
  nbAvis: number | null; // avis Google : proxy volume de portefeuille (mode partenaire)
  noteGoogle: number | null;
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export function placesConfigured(): boolean {
  return Boolean(process.env.GOOGLE_PLACES_API_KEY);
}

type PlaceResult = {
  id?: string;
  displayName?: { text?: string };
  websiteUri?: string;
  nationalPhoneNumber?: string;
  rating?: number;
  userRatingCount?: number;
};

async function searchText(
  key: string,
  textQuery: string,
  pageToken?: string,
): Promise<{ places?: PlaceResult[]; nextPageToken?: string; error?: { message: string } }> {
  const res = await fetch(PLACES_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": key,
      "X-Goog-FieldMask":
        "places.id,places.displayName,places.websiteUri,places.nationalPhoneNumber,places.rating,places.userRatingCount,nextPageToken",
    },
    body: JSON.stringify({
      textQuery,
      languageCode: "fr",
      regionCode: "FR",
      pageSize: 20,
      ...(pageToken ? { pageToken } : {}),
    }),
    signal: AbortSignal.timeout(20_000),
  });
  return res.json();
}

function domaineDe(site: string): string {
  return site ? site.replace(/^https?:\/\/(www\.)?/i, "").split("/")[0].toLowerCase() : "";
}

// Collecte pour une liste de villes × mots-clés. `pagesParRequete` = nb de pages
// de 20 résultats (1 = 20, 3 = 60 max API). Dédup par placeId et par domaine.
export async function collecter(opts: {
  villes: string[];
  keywords: string[];
  activiteLabel?: (kw: string) => string;
  pagesParRequete?: number;
  delayMs?: number;
}): Promise<{ ok: true; leads: LeadBrut[] } | { ok: false; error: string }> {
  const key = process.env.GOOGLE_PLACES_API_KEY;
  if (!key) {
    return {
      ok: false,
      error:
        "Clé Google Places absente. Ajoute GOOGLE_PLACES_API_KEY dans .env pour activer le scraping (l'import CSV reste disponible sans clé).",
    };
  }

  const pages = Math.max(1, Math.min(3, opts.pagesParRequete ?? 1));
  const delay = opts.delayMs ?? 600;
  const seenId = new Set<string>();
  const seenDomain = new Set<string>();
  const leads: LeadBrut[] = [];

  try {
    for (const ville of opts.villes) {
      for (const kw of opts.keywords) {
        const q = `${kw} ${ville}`;
        let token: string | undefined;
        for (let page = 0; page < pages; page++) {
          const j = await searchText(key, q, token);
          if (j.error) break;
          for (const p of j.places ?? []) {
            if (p.id && seenId.has(p.id)) continue;
            const site = p.websiteUri ?? "";
            const domain = domaineDe(site);
            if (domain && seenDomain.has(domain)) continue;
            if (p.id) seenId.add(p.id);
            if (domain) seenDomain.add(domain);
            leads.push({
              nom: p.displayName?.text ?? "",
              site,
              ville,
              activite: kw,
              telephone: p.nationalPhoneNumber ?? "",
              placeId: p.id ?? "",
              nbAvis: typeof p.userRatingCount === "number" ? p.userRatingCount : null,
              noteGoogle: typeof p.rating === "number" ? p.rating : null,
            });
          }
          token = j.nextPageToken;
          if (!token) break;
          await sleep(1500); // le token a besoin d'un court délai
        }
        await sleep(delay);
      }
    }
  } catch (e) {
    const reason = e instanceof Error ? e.message : "erreur inconnue";
    // On renvoie ce qu'on a déjà collecté plutôt que de tout perdre.
    if (leads.length) return { ok: true, leads };
    return { ok: false, error: `Échec Google Places : ${reason}` };
  }

  return { ok: true, leads };
}

export { domaineDe };
