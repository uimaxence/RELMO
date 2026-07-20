# RELMO V2 — Mode Partenaire

Spec de la feature qui transforme RELMO d'un moteur de prospection linéaire (1 scan = 1 client potentiel) en moteur de prescription (1 scan = 1 partenaire + N clients pré-audités livrés avec).

---

## 1. Ce que ça change

Le mode client actuel score des entreprises finales : est-ce qu'elles ont un problème web que je peux vendre.

Le mode partenaire score des **prescripteurs** : est-ce que cette personne a un portefeuille de clients qu'elle peut m'envoyer, et est-ce que ces clients valent le coup.

L'inversion du scoring et le flag "agence web → qualification manuelle" sont déjà actés. Ce doc ne les re-détaille pas. Il détaille les deux briques qui font réellement la différence :

1. **Le scoring prescripteur** (quels signaux, quels poids, quels seuils).
2. **Le double scrape** : extraction du portefeuille aval et pré-audit automatique via le pipeline client existant.

---

## 2. Le principe clé — double scrape

C'est le cœur de la feature. Séquence sur un seul prescripteur :

1. RELMO crawl le site du partenaire (ex. un cabinet comptable).
2. Il détecte la zone "clients / références / ils nous font confiance / témoignages".
3. Il extrait les **noms d'entreprises** de cette zone (alt text des logos, noms de fichiers image, entreprises citées dans les témoignages).
4. Chaque nom extrait est normalisé puis **réinjecté dans le pipeline d'audit client RELMO déjà en place** (Maps + site).
5. Sortie : la fiche partenaire **+ la liste de ses clients, chacun avec son score et ses problèmes factuels détectés**.

Conséquence commerciale : quand tu appelles le comptable, tu ne dis pas "je pourrais aider vos clients". Tu dis "sur les 40 clients que vous affichez, j'en ai regardé 40 : 28 ont [problème factuel]. Voici ce que je propose qu'on leur offre." Le partenaire voit la valeur avant de s'engager, à coût zéro pour lui.

Un scan partenaire vaut donc autant que 40 scans clients — mais dédupliqué en une seule action, avec la confiance du prescripteur déjà attachée à chaque lead.

---

## 3. Scoring prescripteur

### Gate éliminatoire (bloquant)

**Portefeuille client visible.** Si aucun logo client, aucune référence nommée, aucun témoignage attribuable → score = 0, statut `DROPPED`.

Raison double : sans portefeuille visible, (a) rien ne prouve qu'il a des clients à référer, et (b) le double scrape n'a aucune matière. Les deux piliers de la stratégie tombent.

### Signaux pondérés (sur 100, une fois le gate passé)

| Signal | Poids | Détection |
|---|---|---|
| **Volume du portefeuille** | 30 | Nombre de clients affichés (logos + témoignages). Proxy secondaire : taille du cabinet / effectif / nb d'associés si mentionné. Plus il y a de clients, plus le flux potentiel est gros. |
| **Adjacence + absence de solution web interne** | 25 | Le partenaire touche des TPE/PME (comptable, graphiste, agence de com sans dev) **et** ne fait pas de web lui-même. Drapeau rouge : il propose "création de site" dans ses services, ou les sites de ses clients partagent un même footer/signature d'agence (= déjà un prestataire web). |
| **Auditabilité du portefeuille aval** | 15 | Part des clients affichés qui ont un problème web détectable. Un prescripteur dont les clients ont déjà tous un site nickel = peu d'opportunité pour toi. Calculé après le double scrape (voir §4). |
| **Digitalisation du partenaire lui-même** | 15 | Site propre, actif, présence Maps soignée, blog. Un partenaire digital-friendly comprend et pousse mieux un cadeau digital. |
| **Proximité géo** | 15 | 49 = plein score, Grand Ouest = partiel, reste France = minimal. Le transfert de confiance et la base client partagée fonctionnent mieux en local. |

### Seuils

- **≥ 70** → `HOT` : à contacter en priorité (semaine 2 du plan).
- **50–69** → `TO_QUALIFY` : correct, à traiter en second rideau.
- **< 50** → `DROPPED`.

### Cas particulier agences web

Statut `MANUAL` systématique (déjà acté). Elles peuvent être partenaires (débordement de charge, sous-traitance) ou concurrents. Jamais scorées automatiquement, jamais double-scrapées sans validation de ta part.

---

## 4. Extraction du portefeuille aval

### Détection de la zone portefeuille

Playwright cherche, par ordre de priorité :

1. Sections dont le titre matche `clients | références|references | ils nous font confiance | témoignages|temoignages | portfolio | réalisations|realisations | partenaires`.
2. Blocs de logos (grilles d'images de dimensions similaires, souvent en niveaux de gris ou avec hover).
3. Blocs de témoignages (citation + nom + société).

### Extraction des noms

Par source, dans l'ordre de fiabilité :

1. **Attribut `alt`** des images logo (le plus fiable quand présent).
2. **Nom de fichier** de l'image (`logo-boulangerie-martin.png` → "Boulangerie Martin").
3. **Texte des témoignages** : société citée après le nom de la personne.
4. **Lien** : si le logo pointe vers le site du client, l'URL est un signal direct (et un bonus, tu as déjà le domaine à auditer).

### Réinjection

Chaque nom → normalisation (nettoyage casse, suppression suffixes juridiques SARL/SAS, dédup) → recherche Maps + résolution du site → **pipeline d'audit client RELMO standard**. Aucun nouveau code d'audit : on réutilise l'existant.

### Sortie

La fiche partenaire est enrichie d'une liste `downstreamProspects`, chacun avec :
- Nom, ville, site, fiche Maps.
- Score client RELMO.
- Problèmes factuels détectés (les mêmes que ton audit habituel).
- Confiance d'extraction (`HIGH` alt/lien, `MEDIUM` filename, `LOW` témoignage) → tri du travail de vérification.

---

## 5. Modèle de données (Prisma)

```prisma
enum PartnerProfession {
  COMPTABLE
  GRAPHISTE
  AGENCE_COM
  ADJACENT      // métier proche du web sans être web
  AUTRE
}

enum PartnerStatus {
  TO_QUALIFY
  HOT
  MANUAL        // agences web
  CONTACTED
  ACTIVE
  DROPPED
}

enum ExtractionConfidence {
  HIGH
  MEDIUM
  LOW
}

model Partner {
  id             String            @id @default(cuid())
  name           String
  profession     PartnerProfession
  website        String?
  city           String?
  department     String?

  gatePassed     Boolean           @default(false)  // portefeuille visible
  portfolioSize  Int               @default(0)
  hasInternalWeb Boolean           @default(false)
  digitalScore   Int               @default(0)
  partnerScore   Int               @default(0)
  status         PartnerStatus     @default(TO_QUALIFY)

  downstream     Prospect[]        @relation("PartnerDownstream")

  createdAt      DateTime          @default(now())
  updatedAt      DateTime          @updatedAt
}

// Réutilise ton modèle Prospect existant, avec 2 champs ajoutés :
model Prospect {
  // ... champs existants (score, problèmes, Maps, site) ...

  sourcePartner       Partner?             @relation("PartnerDownstream", fields: [sourcePartnerId], references: [id])
  sourcePartnerId     String?
  extractionConfidence ExtractionConfidence?
}
```

Le point clé : `Prospect` gagne juste deux colonnes. Un prospect issu d'un double scrape reste un prospect normal, traçable jusqu'à son prescripteur.

---

## 6. Pipeline

1. **Seed partenaires** — DataForSEO SERP/Maps sur requêtes métier + géo : `expert comptable Angers`, `graphiste Angers`, `agence communication Maine-et-Loire`, etc. → liste brute de partenaires candidats.
2. **Crawl partenaire** (Playwright) — site + fiche Maps. Détection zone portefeuille (§4).
3. **Gate** — portefeuille visible ? Sinon `DROPPED`, on s'arrête là.
4. **Extraction aval** — noms d'entreprises + confiance.
5. **Double scrape** — chaque nom → pipeline client RELMO existant.
6. **Scoring partenaire** — les 5 signaux, dont l'auditabilité aval calculée à l'étape 5.
7. **Agrégation** — fiche partenaire + downstream pré-audité, prête pour l'approche.

Les étapes 1, 2, 5 réutilisent du code déjà écrit. Le neuf, c'est 3–4 (détection + extraction portefeuille) et 6 (scoring inversé).

---

## 7. Garde-fous

- **Extraction imparfaite.** Alt text manquant, logos sans nom exploitable, images vectorielles. Les cas `LOW` sont signalés pour vérif manuelle, jamais devinés. RELMO ne fabrique pas de nom d'entreprise — un nom incertain est marqué, pas inventé. (Cohérent avec ta règle : les données d'audit doivent rester la source de vérité, pas des suppositions.)
- **Ne jamais contacter l'aval avant le partenaire.** C'est tout le sens de la stratégie et ça protège sa réputation. Les `downstreamProspects` restent en attente tant que le `Partner` n'est pas `ACTIVE`. Techniquement : bloquer tout export/outreach sur un prospect dont le `sourcePartner` n'est pas actif.
- **Auditabilité honnête.** Le pré-audit sert à préparer un cadeau utile, pas un argumentaire alarmiste. Si les clients d'un partenaire vont bien, c'est un signal de mauvais fit prescripteur, pas une invitation à dramatiser.
- **Agences web = manuel.** Jamais de double scrape automatique sur une agence sans ta validation.

---

## 8. Ce que ça débloque ensuite

Une fois la feature en place, l'étape suivante logique est le **générateur d'audit-cadeau co-brandé** : à partir des `downstreamProspects` d'un partenaire actif, sortir en batch les audits individuels au nom du partenaire (crédités Maxence Cailleau côté delivery). C'est la brique de distribution ; celle-ci est la brique de sourcing. À scoper séparément.
