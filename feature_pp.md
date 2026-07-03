# CLAUDE.md — Outil de prospection web (scraping + audit + accroches IA)

> **But.** Construire des prospects qualifiés pour une activité de **dev web freelance en Anjou**.
> Deux entrées possibles : (A) **scraping automatique** Google Places par **région + secteur**,
> ou (B) **import d'un CSV** existant. Puis pour chaque entreprise : audit du site, extraction du
> contact (email/tél, souvent dans les mentions légales), **score commercial** et **accroche
> email + LinkedIn personnalisée** générées par DeepSeek. Sortie : un CSV trié, meilleurs prospects en haut.

Claude Code : crée les fichiers ci-dessous tels quels, fais `npm install`, puis suis la section **Utilisation**.

---

## Architecture

```
collect.mjs        → (A) scraping Places : région + secteur → leads.csv
                     (B) si --source csv : on saute cette étape
prospect-audit.mjs → analyse chaque site + contact + IA → prospects-<date>.csv
regions.mjs        → régions FR → liste de villes à requêter
sectors.mjs        → secteurs → mots-clés Google Maps (avec favoris ⭐)
```

Flux : `collect.mjs` produit `leads.csv` (colonnes `nom,site,ville,activite,telephone`),
que `prospect-audit.mjs` consomme. L'import CSV utilise exactement le même format.

---

## Prérequis & installation

- Node ≥ 18 (fetch natif).
- `package.json` :

```json
{
  "name": "prospection-web",
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "collect": "node collect.mjs",
    "audit": "node prospect-audit.mjs leads.csv"
  },
  "dependencies": {
    "cheerio": "^1.0.0",
    "papaparse": "^5.4.1"
  }
}
```

```bash
npm install
cp .env.example .env   # puis remplis les clés
```

- `.env.example` :

```bash
# Scraping (étape A) — API Google Places (New). https://console.cloud.google.com → activer "Places API (New)"
GOOGLE_PLACES_API_KEY=

# Audit (obligatoire) — https://platform.deepseek.com
DEEPSEEK_API_KEY=sk-xxxx

# Enrichissement dirigeant + LinkedIn (optionnel, ne tourne que sur les bons scores)
PERPLEXITY_API_KEY=pplx-xxxx
ENRICH=false
SCORE_ENRICH_MIN=65

# Perf/SEO réels via Google PageSpeed (optionnel, lent). Laisser vide = désactivé.
GOOGLE_PSI_KEY=

# Politesse réseau
DELAY_MS=800
```

---

## Configuration : zone géographique & secteur

### Régions — `regions.mjs`

Chaque région se déplie en une liste de villes ; on interroge `mot-clé + ville` (l'API Text Search
plafonne à 60 résultats par requête, donc la granularité par ville maximise la couverture).
**Pays de la Loire** est le défaut (région d'Angers), avec une couverture fine des 5 départements.
Les autres régions listent les principales villes — facile à compléter.

```js
// regions.mjs
export const REGIONS = {
  "Pays de la Loire": [
    // 49 Maine-et-Loire
    "Angers", "Cholet", "Saumur", "Beaupréau-en-Mauges", "Avrillé", "Trélazé",
    "Les Ponts-de-Cé", "Saint-Barthélemy-d'Anjou", "Segré-en-Anjou Bleu",
    "Doué-en-Anjou", "Chemillé-en-Anjou", "Baugé-en-Anjou",
    // 44 Loire-Atlantique
    "Nantes", "Saint-Nazaire", "Saint-Herblain", "Rezé", "Vertou",
    "Saint-Sébastien-sur-Loire", "La Baule-Escoublac", "Ancenis", "Pornic",
    // 85 Vendée
    "La Roche-sur-Yon", "Les Sables-d'Olonne", "Challans", "Les Herbiers",
    "Fontenay-le-Comte", "Montaigu-Vendée",
    // 72 Sarthe
    "Le Mans", "La Flèche", "Sablé-sur-Sarthe", "Allonnes",
    // 53 Mayenne
    "Laval", "Mayenne", "Château-Gontier-sur-Mayenne", "Évron",
  ],
  "Bretagne": ["Rennes", "Brest", "Quimper", "Lorient", "Vannes", "Saint-Malo", "Saint-Brieuc", "Fougères", "Lannion"],
  "Nouvelle-Aquitaine": ["Bordeaux", "Limoges", "Poitiers", "La Rochelle", "Pau", "Bayonne", "Angoulême", "Niort"],
  "Île-de-France": ["Paris", "Boulogne-Billancourt", "Versailles", "Nanterre", "Créteil", "Saint-Denis", "Argenteuil"],
  "Auvergne-Rhône-Alpes": ["Lyon", "Grenoble", "Saint-Étienne", "Clermont-Ferrand", "Annecy", "Villeurbanne", "Valence", "Chambéry"],
  "Occitanie": ["Toulouse", "Montpellier", "Nîmes", "Perpignan", "Béziers", "Albi", "Carcassonne"],
  "Provence-Alpes-Côte d'Azur": ["Marseille", "Nice", "Toulon", "Aix-en-Provence", "Avignon", "Cannes", "Antibes"],
  "Grand Est": ["Strasbourg", "Reims", "Metz", "Nancy", "Mulhouse", "Troyes", "Colmar"],
  "Hauts-de-France": ["Lille", "Amiens", "Roubaix", "Tourcoing", "Dunkerque", "Arras", "Beauvais"],
  "Normandie": ["Rouen", "Caen", "Le Havre", "Cherbourg-en-Cotentin", "Évreux", "Alençon"],
  "Centre-Val de Loire": ["Tours", "Orléans", "Bourges", "Blois", "Chartres", "Châteauroux"],
};

export const REGION_DEFAUT = "Pays de la Loire";
```

### Secteurs — `sectors.mjs`

Chaque secteur = une liste de mots-clés Google Maps. Les **favoris ⭐** sont ceux conseillés :
ils combinent budget réel, besoin web évident, densité locale et décideur joignable.

```js
// sectors.mjs
export const SECTEURS = {
  // ⭐ FAVORI #1 — habitat / rénovation haut de gamme.
  // Devis à 5 chiffres → un site à 4 chiffres est une évidence comptable, et ils ont besoin de leads.
  // Idéal si tu as déjà des références dans ce milieu (menuiserie, charpente…).
  habitat: [
    "menuisier", "menuiserie", "véranda", "pisciniste", "paysagiste",
    "cuisiniste", "charpentier", "couvreur", "rénovation énergétique",
    "architecte d'intérieur", "store et fermeture", "agencement intérieur",
    "escalier sur mesure", "carreleur", "plaquiste",
  ],
  // ⭐ FAVORI #2 — santé / paramédical / libéral. Densité énorme, décideur unique,
  // SEO local vital ("ostéopathe Angers") → justifie l'abonnement suivi.
  // NB : éviter médecins/avocats/notaires (com. réglementée) ; viser paramédical & expert-comptable.
  sante: [
    "ostéopathe", "kinesithérapeute", "vétérinaire", "chirurgien-dentiste",
    "orthophoniste", "podologue", "sophrologue", "naturopathe",
    "diététicien", "expert-comptable", "cabinet d'expertise comptable",
  ],
  // Réserve — tourisme / réception (beaux projets, cashflow saisonnier).
  tourisme: [
    "domaine viticole", "gîte", "chambre d'hôtes", "salle de réception",
    "lieu de mariage", "hôtel", "camping", "restaurant gastronomique",
  ],
  // Réserve — végétal / paysage (positionnement "capitale du végétal" en Anjou).
  vegetal: ["paysagiste", "pépiniériste", "jardinerie", "élagueur", "entreprise espaces verts"],
};

export const SECTEUR_DEFAUT = "habitat";
```

---

## (A) Scraping automatique — `collect.mjs`

Utilise **Places API (New)** : `places:searchText` renvoie directement le **site web** et le
**téléphone** (pas besoin d'un second appel Details). Pagination jusqu'à 60 résultats par
`mot-clé × ville`, déduplication par identifiant et par domaine.

```js
// collect.mjs
import fs from "node:fs";
import Papa from "papaparse";
import { REGIONS, REGION_DEFAUT } from "./regions.mjs";
import { SECTEURS, SECTEUR_DEFAUT } from "./sectors.mjs";

const KEY = process.env.GOOGLE_PLACES_API_KEY;
const DELAY_MS = Number(process.env.DELAY_MS || 800);

// --- args : --region "Bretagne" --secteur sante --keywords "x,y" --max 60 --out leads.csv ---
const args = Object.fromEntries(
  process.argv.slice(2).join(" ").split(/\s--/).filter(Boolean)
    .map((s) => s.replace(/^--/, "")).map((s) => {
      const i = s.indexOf(" ");
      return i === -1 ? [s, true] : [s.slice(0, i), s.slice(i + 1).trim().replace(/^["']|["']$/g, "")];
    })
);

const region = args.region || REGION_DEFAUT;
const secteur = args.secteur || SECTEUR_DEFAUT;
const out = args.out || "leads.csv";
const maxParRequete = Number(args.max || 60); // 60 = max API (3 pages de 20)

const villes = REGIONS[region];
if (!villes) { console.error(`Région inconnue: ${region}. Choix: ${Object.keys(REGIONS).join(", ")}`); process.exit(1); }
const keywords = args.keywords ? String(args.keywords).split(",").map((s) => s.trim()) : SECTEURS[secteur];
if (!keywords) { console.error(`Secteur inconnu: ${secteur}. Choix: ${Object.keys(SECTEURS).join(", ")}`); process.exit(1); }
if (!KEY) { console.error("GOOGLE_PLACES_API_KEY manquant dans .env"); process.exit(1); }

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function searchText(textQuery, pageToken) {
  const res = await fetch("https://places.googleapis.com/v1/places:searchText", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": KEY,
      "X-Goog-FieldMask":
        "places.id,places.displayName,places.websiteUri,places.nationalPhoneNumber,places.formattedAddress,nextPageToken",
    },
    body: JSON.stringify({
      textQuery, languageCode: "fr", regionCode: "FR", pageSize: 20,
      ...(pageToken ? { pageToken } : {}),
    }),
  });
  return res.json();
}

async function collectQuery(textQuery) {
  const found = [];
  let token = null;
  for (let page = 0; page < Math.ceil(maxParRequete / 20); page++) {
    const j = await searchText(textQuery, token);
    if (j.error) { console.warn(`  ! ${textQuery}: ${j.error.message}`); break; }
    for (const p of j.places || []) found.push(p);
    token = j.nextPageToken;
    if (!token) break;
    await sleep(1500); // le token a besoin d'un court délai
  }
  return found;
}

async function main() {
  console.log(`🌍 Région : ${region}  (${villes.length} villes)`);
  console.log(`🏷️  Secteur : ${secteur}  (${keywords.length} mots-clés)\n`);

  const seenId = new Set();
  const seenDomain = new Set();
  const rows = [];

  for (const ville of villes) {
    for (const kw of keywords) {
      const q = `${kw} ${ville}`;
      const places = await collectQuery(q);
      let nouveaux = 0;
      for (const p of places) {
        if (p.id && seenId.has(p.id)) continue;
        const site = p.websiteUri || "";
        const domain = site ? site.replace(/^https?:\/\/(www\.)?/, "").split("/")[0] : "";
        if (domain && seenDomain.has(domain)) continue;
        if (p.id) seenId.add(p.id);
        if (domain) seenDomain.add(domain);
        rows.push({
          nom: p.displayName?.text || "",
          site,
          ville,
          activite: kw,
          telephone: p.nationalPhoneNumber || "",
        });
        nouveaux++;
      }
      console.log(`  ${q} → +${nouveaux}`);
      await sleep(DELAY_MS);
    }
  }

  fs.writeFileSync(out, Papa.unparse(rows), "utf8");
  const sansSite = rows.filter((r) => !r.site).length;
  console.log(`\n✅ ${rows.length} entreprises uniques → ${out}`);
  console.log(`   dont ${sansSite} SANS site web (prospects chauds : site à créer de zéro).`);
}

main().catch((e) => { console.error(e); process.exit(1); });
```

> **Coût Places API.** Le champ "website/phone" relève d'un SKU plus élevé. Compte sur l'ordre de
> quelques dizaines d'euros pour plusieurs milliers de prospects, **avec un crédit gratuit mensuel**
> Google. Vérifie le tarif courant avant un gros run, et limite avec `--max` au besoin.

### (B) Importer ton propre CSV

Pas besoin de `collect.mjs`. Fournis un fichier aux colonnes `nom,site,ville,activite,telephone`
(`site` et `telephone` peuvent être vides) et passe-le directement à l'audit :

```bash
node prospect-audit.mjs mon-fichier.csv
```

---

## Audit + accroches — `prospect-audit.mjs`

Pour chaque ligne : analyse technique du site (présence, HTTPS, responsive, SEO de base,
indices d'ancienneté, perf optionnelle), recherche du contact (home + `/mentions-legales` +
`/contact`), puis DeepSeek pour le score + les points faibles + les 2 accroches. Perplexity
(optionnel) retrouve le dirigeant + LinkedIn pour les meilleurs scores. Sortie triée par score.

```js
#!/usr/bin/env node
// prospect-audit.mjs
import fs from "node:fs";
import path from "node:path";
import * as cheerio from "cheerio";
import Papa from "papaparse";

const DEEPSEEK_KEY = process.env.DEEPSEEK_API_KEY;
const PPLX_KEY = process.env.PERPLEXITY_API_KEY;
const ENRICH = String(process.env.ENRICH).toLowerCase() === "true";
const SCORE_ENRICH_MIN = Number(process.env.SCORE_ENRICH_MIN || 65);
const PSI_KEY = process.env.GOOGLE_PSI_KEY || "";
const DELAY_MS = Number(process.env.DELAY_MS || 800);
const UA = "Mozilla/5.0 (compatible; ProspectAudit/1.0; +audit-prospection)";

const inputPath = process.argv[2] || "leads.csv";
if (!DEEPSEEK_KEY) { console.error("❌ DEEPSEEK_API_KEY manquant."); process.exit(1); }

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
function normalizeUrl(raw) {
  if (!raw) return null;
  let u = raw.trim();
  if (!/^https?:\/\//i.test(u)) u = "https://" + u;
  try { return new URL(u).href; } catch { return null; }
}
async function fetchHtml(url, timeout = 15000) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeout);
  try {
    const res = await fetch(url, { signal: ctrl.signal, redirect: "follow",
      headers: { "User-Agent": UA, Accept: "text/html,application/xhtml+xml" } });
    return { ok: res.ok, status: res.status, finalUrl: res.url, html: await res.text() };
  } catch (e) {
    return { ok: false, status: 0, error: String(e?.message || e), finalUrl: url, html: "" };
  } finally { clearTimeout(t); }
}

const EMAIL_RE = /[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}/g;
const PHONE_RE = /(?:\+33\s?|0)[1-9](?:[\s.\-]?\d{2}){4}/g;
const SIRET_RE = /\b\d{3}[\s.]?\d{3}[\s.]?\d{3}[\s.]?\d{5}\b/;
const BAD_EMAIL = /(\.(png|jpg|jpeg|gif|webp|svg)$)|(@(sentry|wixpress|example|email)\.)/i;

function extractContacts(html) {
  const emails = new Set(), phones = new Set();
  for (const m of html.matchAll(/mailto:([^"'?>\s]+)/gi)) emails.add(decodeURIComponent(m[1]));
  for (const m of html.matchAll(EMAIL_RE)) emails.add(m[0]);
  for (const m of html.matchAll(/tel:([+0-9\s().\-]{8,})/gi)) phones.add(m[1].trim());
  for (const m of html.matchAll(PHONE_RE)) phones.add(m[0].trim());
  return { emails: [...emails].filter((e) => !BAD_EMAIL.test(e)), phones: [...phones], siret: html.match(SIRET_RE)?.[0] || null };
}
function pickEmail(emails, host) {
  if (!emails.length) return "";
  const score = (e) => { const lo = e.toLowerCase(); let s = 0;
    if (/noreply|no-reply|nepasrepondre/.test(lo)) s -= 5;
    if (/^(contact|bonjour|hello|info|accueil)@/.test(lo)) s += 3;
    if (host && lo.endsWith("@" + host.replace(/^www\./, ""))) s += 2; return s; };
  return [...emails].sort((a, b) => score(b) - score(a))[0];
}
function findContactPages($, baseUrl) {
  const urls = new Set();
  $("a[href]").each((_, el) => {
    const href = $(el).attr("href") || "", txt = ($(el).text() || "").toLowerCase();
    if (/(mention|legal|légal|contact|cgv|confidential|confidentialit)/i.test(href + " " + txt)) {
      try { urls.add(new URL(href, baseUrl).href); } catch {}
    }
  });
  return [...urls].slice(0, 4);
}

async function analyzeSite(rawUrl) {
  const url = normalizeUrl(rawUrl);
  if (!url) return { statut: "aucun_site", signals: {}, contacts: { emails: [], phones: [], siret: null } };
  const res = await fetchHtml(url);
  if (!res.ok || !res.html) return { statut: "erreur", error: res.error || `HTTP ${res.status}`, signals: { url }, contacts: { emails: [], phones: [], siret: null } };

  const $ = cheerio.load(res.html), html = res.html;
  const host = (() => { try { return new URL(res.finalUrl).host; } catch { return ""; } })();
  const years = [...html.matchAll(/20\d{2}/g)].map((m) => +m[0]).filter((y) => y >= 2005 && y <= 2026);
  const signals = {
    url: res.finalUrl,
    https: res.finalUrl.startsWith("https"),
    title: $("title").first().text().trim().slice(0, 120) || null,
    metaDescription: ($('meta[name="description"]').attr("content") || "").trim().slice(0, 200) || null,
    h1Count: $("h1").length,
    viewport: $('meta[name="viewport"]').length > 0,
    generator: $('meta[name="generator"]').attr("content") || null,
    structuredData: $('script[type="application/ld+json"]').length > 0,
    ogTags: $('meta[property^="og:"]').length > 0,
    jquery: (html.match(/jquery[-.](\d+\.\d+)/i) || [])[1] || null,
    imgCount: $("img").length,
    imgSansAlt: $("img:not([alt])").length,
    derniereAnneeVisible: years.length ? Math.max(...years) : null,
    poidsHtmlKo: Math.round(html.length / 1024),
  };

  let contacts = extractContacts(html);
  for (const p of findContactPages($, res.finalUrl)) {
    if (contacts.emails.length && contacts.phones.length) break;
    const sub = await fetchHtml(p, 10000);
    if (sub.html) { const c = extractContacts(sub.html);
      contacts.emails = [...new Set([...contacts.emails, ...c.emails])];
      contacts.phones = [...new Set([...contacts.phones, ...c.phones])];
      contacts.siret = contacts.siret || c.siret; }
    await sleep(200);
  }
  contacts.bestEmail = pickEmail(contacts.emails, host);

  if (PSI_KEY) {
    try {
      const u = `https://www.googleapis.com/pagespeedonline/v5/runPagespeed?url=${encodeURIComponent(res.finalUrl)}&strategy=mobile&category=performance&category=seo&key=${PSI_KEY}`;
      const cat = (await (await fetch(u)).json())?.lighthouseResult?.categories;
      signals.perfScore = cat?.performance ? Math.round(cat.performance.score * 100) : null;
      signals.seoScore = cat?.seo ? Math.round(cat.seo.score * 100) : null;
    } catch {}
  }
  return { statut: "ok", signals, contacts };
}

const SYS_PROMPT = `Tu es l'assistant de prospection d'un développeur web freelance basé à Angers (49).
Il crée des sites modernes (Next.js, SEO local, performance) pour des entreprises locales.
À partir des signaux techniques bruts d'un site prospect, tu produis une évaluation commerciale et deux accroches.
Règles :
- Réponds UNIQUEMENT en JSON valide (json).
- Français, ton naturel, professionnel et chaleureux, JAMAIS de flatterie générique.
- Accroches COURTES (2-4 phrases), centrées sur 1-2 problèmes concrets repérés + le bénéfice. Pas de jargon.
- Termine par une question légère ou une proposition simple (audit offert, échange de 15 min).
- Si pas de site : angle "vous n'apparaissez pas en ligne / pas de site = clients perdus".
Schéma : {"score":<0-100>,"design":"<1 phrase>","anciennete":"<1 phrase>","points_faibles":["..."],"accroche_email":"...","accroche_linkedin":"..."}`;

async function deepseek(lead, statut, signals) {
  const r = await fetch("https://api.deepseek.com/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${DEEPSEEK_KEY}` },
    body: JSON.stringify({
      model: "deepseek-chat", temperature: 0.5, response_format: { type: "json_object" },
      messages: [
        { role: "system", content: SYS_PROMPT },
        { role: "user", content: "Signaux du prospect :\n" + JSON.stringify({ entreprise: lead.nom, ville: lead.ville, activite: lead.activite, statut_site: statut, signaux: signals }, null, 2) },
      ],
    }),
  });
  const txt = (await r.json())?.choices?.[0]?.message?.content || "{}";
  try { return JSON.parse(txt); } catch { return JSON.parse(txt.replace(/```json|```/g, "").trim()); }
}

async function enrich(lead) {
  if (!PPLX_KEY) return {};
  const q = `Qui dirige l'entreprise "${lead.nom}"${lead.ville ? " à " + lead.ville : ""} (${lead.activite || ""}) ? Donne uniquement : nom complet du dirigeant et l'URL de son profil LinkedIn s'il existe. Si tu ne sais pas, dis-le.`;
  try {
    const r = await fetch("https://api.perplexity.ai/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${PPLX_KEY}` },
      body: JSON.stringify({ model: "sonar", messages: [{ role: "user", content: q }] }), // vérifier le nom de modèle courant
    });
    const txt = (await r.json())?.choices?.[0]?.message?.content || "";
    const linkedin = (txt.match(/https?:\/\/(?:[a-z]{2,3}\.)?linkedin\.com\/[^\s)"]+/i) || [])[0] || "";
    return { dirigeant: txt.split("\n")[0].slice(0, 120), linkedin };
  } catch { return {}; }
}

async function main() {
  const { data } = Papa.parse(fs.readFileSync(inputPath, "utf8"), { header: true, skipEmptyLines: true });
  console.log(`📋 ${data.length} leads\n`);
  const out = [];
  for (let i = 0; i < data.length; i++) {
    const lead = data[i];
    process.stdout.write(`(${i + 1}/${data.length}) ${lead.nom} … `);
    try {
      const { statut, signals, contacts } = await analyzeSite(lead.site);
      const ia = await deepseek(lead, statut, signals);
      let extra = {};
      if (ENRICH && Number(ia.score) >= SCORE_ENRICH_MIN) extra = await enrich(lead);
      out.push({
        nom: lead.nom, ville: lead.ville || "", activite: lead.activite || "",
        site: signals.url || lead.site || "", statut, score: ia.score ?? "",
        design: ia.design ?? "", anciennete: ia.anciennete ?? "",
        points_faibles: (ia.points_faibles || []).join(" • "),
        email: contacts.bestEmail || "", emails_tous: (contacts.emails || []).join(" "),
        telephone: contacts.phones?.[0] || lead.telephone || "", siret: contacts.siret || "",
        dirigeant: extra.dirigeant || "", linkedin: extra.linkedin || "",
        accroche_email: ia.accroche_email ?? "", accroche_linkedin: ia.accroche_linkedin ?? "",
      });
      console.log(`ok (score ${ia.score})`);
    } catch (e) { console.log(`⚠️ ${e?.message || e}`); out.push({ nom: lead.nom, statut: "echec", score: "" }); }
    await sleep(DELAY_MS);
  }
  out.sort((a, b) => (Number(b.score) || 0) - (Number(a.score) || 0));
  const outPath = path.join(path.dirname(inputPath), `prospects-${new Date().toISOString().slice(0, 10)}.csv`);
  fs.writeFileSync(outPath, Papa.unparse(out), "utf8");
  console.log(`\n✅ ${out.length} lignes → ${outPath}`);
  console.log(`🔥 ${out.filter((o) => Number(o.score) >= 65).length} prospects score ≥ 65 (en haut).`);
}
main().catch((e) => { console.error(e); process.exit(1); });
```

---

## Utilisation

```bash
# (A) Scraper + auditer — secteur & région par défaut (habitat, Pays de la Loire)
node collect.mjs
node prospect-audit.mjs leads.csv

# Cibler une autre région / secteur
node collect.mjs --region "Bretagne" --secteur sante
node collect.mjs --region "Pays de la Loire" --secteur habitat --max 40

# Mots-clés custom (ignore le preset secteur)
node collect.mjs --region "Occitanie" --keywords "véranda,pisciniste,paysagiste"

# (B) Importer ton propre CSV (colonnes nom,site,ville,activite,telephone)
node prospect-audit.mjs mon-fichier.csv
```

Résultat : `prospects-<date>.csv` trié par score. Ouvre-le, attaque les scores ≥ 65 d'abord,
les accroches sont prêtes à copier dans ton outil d'envoi.

---

## RGPD (prospection B2B France)

- Cible des **données professionnelles** (contact@, dirigeant identifiable d'une entreprise).
- Mets un **opt-out** clair dans chaque email ("répondez stop et je ne vous recontacte plus") et traite les refus aussitôt.
- Un seul passage par site, délais déjà intégrés. Ne scrape pas LinkedIn (CGU + risque de ban).

## Pistes v2 (optionnel)

- **Vrai jugement de design** : capture Playwright + modèle vision, au lieu des seuls signaux HTML.
- **Dashboard HTML** cliquable (tri/filtres) en plus du CSV.
- **Suivi & dédup** : table SQLite pour ne pas recontacter deux fois et tracer les réponses.
- **Détection de stack** (Wix/WordPress non maintenu) pour affiner l'angle de vente.
```
