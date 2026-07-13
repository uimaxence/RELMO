# RELMO — Spec de scoring (filtre en or)

Objectif : passer de « RELMO audite un site et sort des problèmes » à « RELMO score un prospect sur sa probabilité de signer un contrat MRR-compatible ».

Principe directeur (Valentin) : la qualification, c'est 90 % du résultat. Un prospect avec un problème mais sans budget ni besoin réel, c'est un audit brûlé. Le scoring existe pour réduire le volume, pas pour le gonfler — ta propre règle : 15 audits qualifiés battent 50 génériques.

---

## Les 5 signaux

### 1. Potentiel économique — poids fort

La boîte peut-elle payer un contrat récurrent ? C'est le signal qui élimine le piège des petites boîtes qui acceptent le RDV mais bloquent au prix.

Sources, par ordre de fiabilité :
- CA public (Pappers / Societe.com, API ou scrape)
- À défaut : masse salariale (effectif LinkedIn, ou « X collaborateurs » sur le site)
- À défaut : proxies indirects (véhicules floqués sur photos Google, taille des locaux, nombre de points de vente)

Scoring (l'effectif est le meilleur proxy solo-friendly) :
- 0 = 1-2 personnes ou signaux de solo / démarrage
- 1 = 3-9
- 2 = 10-49
- Capé ou pénalisé au-delà de 50 (accès plus dur, cycles longs, appels d'offres)

Proxy le plus actionnable sans API payante : effectif LinkedIn croisé avec présence de locaux réels.

### 2. Besoin — poids fort, en GATE

Le service entre-t-il dans le cycle de vente du prospect ? Pas « a-t-il un site moche » mais « va-t-il gagner de l'argent grâce à ton service ». C'est un gate, pas juste un score : si le besoin est nul, le prospect sort quel que soit le reste.

- Ça se score par NICHE, pas par prospect (Vincent : trouve la niche qui a le besoin, c'est vrai pour toute la niche). Maintenir une table de niches avec un flag besoin fort / faible.
- Besoin fort : la clientèle fait une recherche + comparaison avant d'acheter, panier moyen élevé (paysagiste, artisan haut de gamme, prestataire B2B, santé privée hors réglementé).
- Besoin faible : commerce de proximité qui tourne au passage (boulangerie, resto de quartier, pressing).

Scoring : gate binaire au niveau niche. On ne scrape que les niches flaggées fortes. Économise ~80 % du scraping inutile.

### 3. Problème — poids moyen (cœur de métier, RELMO le fait déjà)

Défaut factuel et concret que tu peux régler.

Sources (ce que RELMO extrait déjà) : pas responsive, temps de chargement, HTTPS absent, SEO on-page, balises manquantes, page 32 sur un mot-clé local, absence de Google Business Profile optimisé.

Scoring :
- 0 = site propre, rien à redire (sors-le, ou route-le vers RELMO Pro)
- 1 = 1-2 problèmes mineurs
- 2 = 3+ problèmes dont au moins un majeur (responsive cassé, HTTPS absent, invisible en local)

Discipline non négociable : factuel uniquement. Jamais « moche » (subjectif, détruit la crédibilité). Toujours « charge en 4,2 s / non responsive / absent de la page 1 sur [requête] ».

### 4. Envie de croissance — poids moyen (ajout de Vincent)

Une boîte qui ne veut pas grossir n'investit pas, même avec les moyens et le besoin.

Signaux scrapables :
- Offres d'emploi actives (le plus fiable — Indeed, page carrière, posts LinkedIn « on recrute »)
- Effectif en hausse année sur année (LinkedIn)
- CA en hausse (Pappers)
- Déménagement / nouveaux locaux, levée de fonds, investissements matériels annoncés

Scoring :
- 0 = aucun signal
- 1 = un signal
- 2 = deux+ signaux (recrute ET effectif en hausse = boîte en mode fusée)

Le signal recrutement seul est déjà très bon marché à détecter et très prédictif.

### 5. Accès — poids moyen, en GATE soft

Peux-tu joindre le décideur ? Sans accès, tout le reste est théorique.

Ce que tu veux, par ordre : nom + rôle du décideur, LinkedIn (warm-up avant contact), email perso (pas contact@/info@), numéro perso si dispo.

Sources : LinkedIn pour nom/rôle/profil, enrichissement email (pattern prénom.nom@domaine + vérif, ou enrichisseur type Full Enrich / Dropcontact en API).

Scoring :
- 0 = seulement un formulaire de contact générique (pénalise fort)
- 1 = email ou LinkedIn du décideur
- 2 = plusieurs canaux (indispensable pour la relance multicanale)

---

## Pondération et seuil

Score max 10 (2 par critère), besoin en gate amont.

- Besoin faible → drop immédiat, pas de scrape.
- Somme des 4 autres critères (sur 8) :
  - ≥ 7 / 8 = prospect chaud → tête de file pour audit personnalisé RELMO
  - 5-6 = tiède → batch secondaire
  - < 5 = drop

Garde-fou volume : le scoring sert à ne garder que le haut de la pile. 15 audits qualifiés > 50 génériques.

---

## Garde-fou de crédibilité (transversal)

RELMO ne doit jamais asserter dans l'audit un problème qu'il n'a pas vérifié techniquement. La crédibilité est fragile : une affirmation invérifiable te contredit devant le client. Chaque ligne d'audit trace sa source. Formulations factuelles ou conditionnelles, jamais de jugement.
