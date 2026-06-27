# Projet · Outil de gestion de portefeuille de sites clients

> Document de cadrage. Sert de contexte de référence pour le développement (notamment avec Claude Code).
> Nom de travail : **SiteFlow** _(placeholder · à remplacer)_.
> Statut : spec initiale. Tout ce qui suit est versionnable et amené à évoluer.

---

## 1. Vision en une phrase

Un cockpit unique pour gérer un portefeuille de sites clients en modèle récurrent : suivre le MRR, savoir en un coup d'œil ce qui a été **vendu** à chaque client et ce qui a été **réellement livré** ce mois-ci, produire le rapport qui justifie l'abonnement, et **piloter la croissance vers un objectif de MRR** (cap : 3 000 €). À terme, toute cette donnée accumulée et structurée alimente une **couche IA** qui affine les objectifs réalisables et les leviers à actionner, jour après jour, semaine après semaine.

## 2. Problème

Quand on gère plusieurs sites en contrat de maintenance/suivi récurrent (création ~800 €, abonnement ~60 €/mois), quatre douleurs reviennent :

1. **Pas de visibilité sur le réalisé vs le vendu.** Un contrat dit « 2 articles SEO/mois + maj de sécurité ». Mais ai-je fait les 2 articles ce mois-ci sur *ce* site précis ? L'info est éparpillée entre la tête, le git et des notes.
2. **MRR flou.** Combien je facture en récurrent, par client, et quels contrats sont à risque ? Aucune vue consolidée.
3. **Le client ne voit pas la valeur.** Sans rapport mensuel concret, l'abonnement à 60 € devient une ligne qu'on questionne → churn.
4. **Le commercial part en fumée.** Les négos et devis se perdent entre WhatsApp, mails et notes. Pas de pipeline, pas de relances, pas de lien clair entre « ce que je suis en train de signer » et « l'objectif de MRR que je vise ».

## 3. Positionnement / différenciation

Le marché est dense mais mal aligné avec ce besoin précis :

- Les outils de **gestion multi-sites** (ManageWP, InstaWP, WP Remote…) sont quasi tous **centrés WordPress**. Hors sujet pour des sites Next.js / custom.
- Les outils de **reporting SEO** (AgencyAnalytics, Whatagraph, Swydo…) sont commoditisés et ne réconcilient pas l'engagement contractuel avec le réalisé.
- Les outils de **gestion d'agence** (ClientPlug, SPP, Plutio…) gèrent tâches + facturation mais restent génériques (souvent orientés Ads) et lourds pour un solo.

**Notre angle distinctif :**

- **Réconciliation contrat ↔ livrables** : le cœur. On modélise ce qui est *vendu* dans chaque contrat (quantités récurrentes) et on suit le *livré*, idéalement coché automatiquement depuis le git.
- **Agnostique du CMS / orienté sites custom & headless** (Next.js en premier), là où la concurrence suppose WordPress.
- **Du pipeline à la livraison dans un seul outil** : la négo (devis) alimente le contrat, le contrat alimente les livrables, le tout alimente l'objectif de MRR. Une seule boucle.
- **Pensé pour un dev solo**, pas pour une agence de 50 personnes.

## 4. Utilisateurs cibles

- **V1 (priorité absolue) : moi.** Outil interne, dogfooding. Un seul utilisateur, mes propres clients.
- **V2 (hypothèse à valider) : freelances dev/SEO solo** en modèle récurrent sur sites custom. À n'envisager **que** si une demande spontanée émerge.

> Décision de cadrage : on construit d'abord un outil mono-utilisateur. Le multi-comptes (auth multi-tenant, billing SaaS, support, RGPD) est explicitement **hors périmètre** jusqu'à validation de la demande.

## 5. Périmètre

### 5.1 MVP · socle (ce qu'on construit d'abord)

| # | Fonction | Description | Pourquoi |
|---|----------|-------------|----------|
| F1 | **Annuaire clients & sites** | CRUD client → 1..n sites (URL, stack, repo git, hébergeur, dates clés). | Base de tout. |
| F2 | **Contrats récurrents** | Par site : type de presta, montant mensuel, date de début, statut. Définit les **engagements récurrents** (ex. « 2 articles/mois », « maj sécu mensuelle »). | Source de vérité du « vendu ». |
| F3 | **Suivi MRR** | Vue consolidée : MRR total, par client, évolution. Saisie manuelle au départ. | Pilotage business. |
| F4 | **Livrables du mois (le cœur)** | Pour chaque site, génération auto d'une checklist mensuelle à partir des engagements du contrat. État fait / pas fait. Vue « ce mois-ci, qu'est-ce qui reste ». | La douleur n°1. |
| F5 | **Tableau de bord global** | Une page : tous les sites, MRR, livrables en retard, alertes contrat à risque (rien de livré depuis X). | Le cockpit. |

### 5.1b V1.5 · pilotage commercial & objectif (juste après le socle)

Ces fonctions transforment l'outil de « suivi de l'existant » en « machine à atteindre 3 000 € de MRR ». Restent **manuelles d'abord**, fidèles au principe « le manuel avant l'auto ».

| # | Fonction | Description | Pourquoi |
|---|----------|-------------|----------|
| F10 | **Pipeline & devis (négos WhatsApp / mail)** | Suivi des prospects et des échanges de négociation, journalisés par canal (WhatsApp, e-mail, autre). Objets **Devis** : montant création + montant mensuel proposé, statut (brouillon → envoyé → en négo → accepté/refusé/expiré), date de relance. Un devis accepté se convertit en `Contrat`. **Saisie manuelle en V1** (cf. §6 sur les contraintes WhatsApp/mail). | Ne plus perdre une négo ; relier le commercial à l'objectif MRR. |
| F11 | **Objectif MRR + curseur de progression** | Un objectif paramétrable (cible **3 000 €**, MRR de départ, date cible) affiché sur le dashboard avec un **curseur d'avancement** (MRR actuel / cible) et un indicateur **« dans les temps / en retard »** comparant le rythme réel au rythme requis. Inclut le **MRR potentiel en pipeline** (somme des devis en négo) en superposition. | Rendre l'objectif visible et actionnable au quotidien. Voir §11. |
| F12 | **To-do quotidienne générée** | Chaque jour, génération d'une liste d'actions priorisées à partir de : livrables du mois en retard/à faire, devis à relancer, et un **« nudge » de prospection calibré sur l'écart à l'objectif** (combien de devis/clients viser ce mois-ci pour rester dans les temps). Cases à cocher, report possible. | Traduire « atteindre 3 k » en actions concrètes du jour, sans réfléchir. |

### 5.2 Phase 2 (après dogfooding)

- **F6 · Intégration git** : lire l'activité d'un repo (commits, déploiements, ou tags conventionnels type `seo:`, `maj:`) pour **cocher automatiquement** des livrables. *C'est la fonction signature ; on la fait une fois le modèle manuel validé.*
- **F7 · Rapport mensuel client** : génération auto (PDF/HTML) compilant livrables réalisés + évolution SEO, envoyable au client.
- **F8 · Suivi de positions SEO** : par site/mot-clé, via DataForSEO, alimentant le rapport.
- **F9 · Santé technique** : monitoring uptime, alertes SSL/domaine qui expirent, Lighthouse/Core Web Vitals dans le temps.
- **F15 · Portail client (espace client en lecture)** : un espace par client, accessible par **lien privé sans mot de passe** (magic link, **décidé**), où il retrouve ses **factures**, ses **devis**, l'**avancement de son site** et le **récap de ce qui a été livré ce mois** (la version client du « vendu vs livré » et du rapport F7). But : rendre la valeur visible et **réduire le churn** (douleur n°3). Lecture seule. Ce **n'est pas un SaaS multi-comptes** : juste un accès cloisonné par client aux données que tu choisis d'exposer. Dépend de F4 (livrables), F7 (rapport), F10 (devis) et des factures.
  > **À décider (F15) :** (1) **factures** : PDF rattachés depuis Indy, générées par l'outil, ou les deux ; (2) **acceptation de devis en ligne** : en un clic, ou consultation seule. _Tranché : connexion par **lien magique**, sans mot de passe._
- **F13 · Comptabilité / Indy** : Indy **n'expose pas d'API publique** exploitable (synchro bancaire + intégrations partenaires fermées). Donc pas d'intégration en dur. À la place : **export d'un récap facturable** (CSV/écritures) depuis l'outil, à importer/rapprocher manuellement dans Indy. Réévaluer si Indy ouvre une API. *Voir §6.*
- **F10+/F12+ · Auto-collecte des échanges** : remontée semi-auto des mails de négo (Gmail API / IMAP) pour pré-remplir le pipeline. **WhatsApp reste manuel** (cf. §6). *Optionnel, seulement si la saisie manuelle devient un point de friction réel.*

### 5.2b Phase 3 · couche IA d'optimisation (horizon, après plusieurs mois de données)

- **F14 · Copilote IA d'optimisation** : une fois plusieurs mois de données accumulées, une couche IA qui (a) **analyse le corpus** (MRR et son origine, devis gagnés/perdus, sources de prospects, tickets moyens, livrables réalisés/en retard, signaux de churn), (b) **ajuste les objectifs jour/semaine** en fonction du réel vs cible, (c) **propose des leviers priorisés** avec leur justification chiffrée, et (d) **suit des expériences** (hypothèse → action → résultat mesuré → conclusion) pour apprendre ce qui marche *sur ton activité précise*, pas en général.
  > ⚠️ **Échelle.** À ~1 client/mois, pas de tests statistiquement significatifs avant longtemps. L'IA agit comme **analyste + coach + journal d'expériences** sur un petit jeu de données riche, pas comme moteur d'A/B testing. Sa valeur croît avec la taille du portefeuille. On ne sur-promet pas : recommandations contextualisées + mémoire de ce qui a été testé.
  > **Prérequis non négociable :** la donnée doit être **structurée et horodatée dès la V1** (cf. §8). Une IA branchée sur du texte libre ne sort que du générique.



### 5.3 Hors périmètre (non-goals)

À écarter explicitement pour ne pas se disperser :

- ❌ **SaaS multi-opérateurs** : inscription publique, comptes opérateurs multiples, facturation SaaS. _Le portail client (F15) n'est PAS ça : c'est un accès en **lecture** cloisonné par client, mono-opérateur._
- ❌ Facturation récurrente automatisée (Stripe billing) : la saisie manuelle du MRR suffit en V1.
- ❌ Gestion WordPress (updates plugins, etc.).
- ❌ **CRM complet de prospection** (scoring, séquences d'emailing automatisées) et **signature électronique légale** de contrats. _Note : le suivi **léger** de pipeline + devis est DANS le périmètre (F10), et le client peut **accepter un devis en un clic** (F15), mais ce n'est pas une signature qualifiée._
- ❌ App mobile.

## 6. Stack technique proposée

Alignée sur l'environnement de dev existant.

- **Framework** : Next.js (App Router) + TypeScript.
- **UI** : Tailwind CSS. Composants simples, sobres ; c'est un outil interne, pas une vitrine.
- **Base de données** : PostgreSQL (ex. via Neon/Supabase) avec **Prisma** ou **Drizzle** comme ORM.
- **Auth** : mono-utilisateur en V1 → une protection simple (variable d'env + middleware, ou Auth.js avec un seul compte). Pas de système multi-utilisateurs.
- **Génération de la to-do quotidienne (F12)** : job planifié (Vercel Cron) qui matérialise les `Tache` du jour à partir des livrables, devis et de l'écart à l'objectif.
- **Intégrations (phase 2)** :
  - Git : API GitHub/GitLab (lecture commits/déploiements).
  - SEO : DataForSEO (déjà utilisé par ailleurs).
  - **E-mail (négos)** : Gmail API ou IMAP en lecture seule pour pré-remplir le pipeline. Optionnel.
  - **Comptabilité (Indy)** : ⚠️ **pas d'API publique** côté Indy. Pas d'intégration directe possible aujourd'hui. Approche retenue : export CSV depuis l'outil → import/rapprochement manuel dans Indy.
  - **WhatsApp** : ⚠️ pas d'accès simple à un compte **personnel** par API. La WhatsApp Business Platform (Cloud API) impose un numéro pro + validation Meta et ne donne pas l'historique de tes conversations existantes ; les libs non officielles (whatsapp-web.js, Baileys) violent les CGU et risquent le bannissement. **Décision : WhatsApp reste en saisie manuelle** (on journalise un résumé + on attache le devis). On ne tente aucune automatisation WhatsApp.
- **Hébergement** : Vercel (cohérent avec Next.js).

> Note pour le dev : commencer simple. SQLite/Postgres local suffit pour amorcer. Pas de sur-ingénierie tant que l'outil n'a qu'un utilisateur.

## 7. Modèle de données (esquisse)

```
Client
  id, nom, email, téléphone, statut (prospect | actif | ancien),
  notes, créé_le

Site
  id, client_id (FK), nom, url, repo_git_url, hébergeur,
  date_mise_en_ligne, stack (ex. "Next.js"), statut, notes

Contrat
  id, site_id (FK), libellé, montant_mensuel, montant_création,
  date_début, date_fin (nullable),
  statut (actif | en_pause | résilié),
  devis_id (FK nullable)        # d'où vient ce contrat

Engagement            # ce qui est VENDU, récurrent
  id, contrat_id (FK), type (ex. "article_seo", "maj_securite"),
  libellé, quantité_par_mois, récurrence (mensuelle | ...)

Livrable              # ce qui est À FAIRE / FAIT, instancié par mois
  id, engagement_id (FK), période (AAAA-MM), libellé,
  statut (à_faire | fait | non_applicable),
  fait_le (nullable), source (manuel | git), note

# --- V1.5 : pilotage commercial & objectif ---

Devis                 # une proposition commerciale
  id, client_id (FK), site_id (FK nullable),
  montant_création, montant_mensuel_proposé,
  statut (brouillon | envoyé | en_négo | accepté | refusé | expiré),
  date_envoi, date_relance (nullable), date_décision (nullable), note

Interaction           # un échange de négo journalisé
  id, client_id (FK), devis_id (FK nullable),
  canal (whatsapp | email | tel | autre),
  direction (entrant | sortant),
  date, résumé, contenu (note longue), pièce_jointe_url (nullable)

ObjectifMRR           # le cap à atteindre
  id, montant_cible (ex. 3000), mrr_départ, date_début,
  date_cible, actif (bool), note

Tache                 # to-do quotidienne (F12)
  id, date, libellé,
  type (livrable | relance_devis | prospection | technique | autre),
  ref_type (nullable), ref_id (nullable),   # lien vers livrable/devis/client
  priorité (basse | normale | haute),
  statut (à_faire | fait | reporté),
  généré_auto (bool)

# --- Phase 3 : couche IA d'optimisation (F14) ---

Experience            # un levier qu'on teste, pour apprendre ce qui marche
  id, hypothèse, levier (prix | referral | cadence_relance | offre | canal | autre),
  date_début, date_fin (nullable),
  métrique_suivie (ex. "taux_signature", "ticket_moyen"),
  valeur_avant, valeur_après,
  statut (en_cours | concluante | non_concluante | abandonnée), conclusion

Recommandation        # sortie de l'IA, traçable
  id, date, libellé, levier, priorité, justification,   # justification = chiffres à l'appui
  statut (proposée | acceptée | rejetée | terminée),
  experience_id (FK nullable), résultat (nullable)

# --- Phase 2 : portail client (F15) ---

Facture
  id, client_id (FK), site_id (FK nullable), numéro, période (AAAA-MM),
  montant, statut (émise | payée | en_retard),
  date_émission, date_échéance (nullable),
  url_pdf (PDF rattaché, ex. export Indy), source (indy | manuel)

# Accès portail : champs portés par Client
Client += portail_actif (bool), portail_token (lien privé non devinable),
          dernière_visite (nullable)

# Ce que le client voit
Livrable += visible_client (bool, défaut vrai)   # certains livrables internes restent masqués
Devis    += date_vue_client (nullable), accepté_le (nullable)  # acceptation en un clic
```

> Note pour F14 : `Recommandation` et `Experience` ferment la boucle · l'IA propose, j'actionne (ou non), le résultat est mesuré et réinjecté. C'est ce qui distingue un copilote qui apprend d'un générateur de conseils génériques.

Logiques clés :
- Au passage d'un nouveau mois, chaque `Engagement` actif génère N `Livrable` pour la période (N = `quantité_par_mois`). Le tableau de bord lit les `Livrable` de la période courante.
- Un `Devis` au statut `accepté` se convertit en `Contrat` (+ ses `Engagement`), ce qui incrémente le MRR.
- Le **MRR actuel** = somme des `montant_mensuel` des `Contrat` actifs. Le **MRR potentiel** = somme des `montant_mensuel_proposé` des `Devis` en négo.
- La génération de `Tache` (F12) lit : livrables en retard/à faire, devis à relancer, et l'écart `ObjectifMRR` vs MRR actuel pour calibrer le nudge de prospection.
- **Portail (F15) :** chaque client n'accède qu'à ses propres `Facture`, `Devis`, `Site` et `Livrable` (où `visible_client = vrai`). Le cloisonnement est **vérifié côté serveur** à partir du `portail_token`, jamais déduit de l'URL seule. Token non devinable, révocable et renouvelable. Si l'acceptation en ligne est activée (décision ouverte), accepter un devis passe le `Devis` en `accepté` (et déclenche la conversion en `Contrat`).

## 8. Principes produit

- **Mono-utilisateur d'abord.** Toute complexité multi-comptes est repoussée jusqu'à preuve de la demande.
- **Le manuel avant l'auto.** On valide le modèle contrat↔livrable, le pipeline et l'objectif **en saisie manuelle** avant de brancher git, mail ou quoi que ce soit.
- **L'outil doit réduire ma charge mentale, pas l'augmenter.** Si une fonction demande plus de saisie qu'elle n'en fait gagner, on la coupe. (Vaut particulièrement pour F10 : journaliser une négo doit prendre 15 s, pas 5 min.)
- **Un seul objectif visible.** Le dashboard doit toujours répondre à « où j'en suis vs 3 000 € » et « qu'est-ce que je fais aujourd'hui pour m'en rapprocher ».
- **La donnée est l'actif.** Chaque événement (devis, signature, livrable, interaction, source du prospect) est **structuré et horodaté dès la V1**, même en saisie manuelle. On évite le texte libre quand une donnée peut être typée. Raison : c'est ce corpus propre qui rendra la couche IA (F14) exploitable plus tard. Le dashboard est le bénéfice immédiat ; le dataset est le bénéfice composé.
- **Vendable ≠ objectif initial.** L'objectif est de résoudre ma douleur. La revente n'est envisagée que si des confrères la réclament spontanément.

## 9. Critère de succès (V1)

L'outil est un succès si :
1. À la fin de chaque mois, je peux répondre en moins de 30 secondes à : « pour chacun de mes sites, qu'ai-je vendu, qu'ai-je livré, et combien je facture en récurrent ? » · sans ouvrir une autre app.
2. Chaque matin, j'ouvre l'outil et il me dit **quoi faire aujourd'hui** (livrables + relances + prospection), et je vois mon **avancement vers 3 000 €** d'un coup d'œil.

## 10. Roadmap indicative

1. **Sprint 0** · Setup projet (Next.js + DB + ORM + auth simple).
2. **Sprint 1** · F1 + F2 (clients, sites, contrats, engagements). CRUD.
3. **Sprint 2** · F4 (génération + suivi des livrables mensuels). C'est le cœur.
4. **Sprint 3** · F3 + F5 (MRR + tableau de bord global).
5. **Sprint 4** · F10 + F11 (pipeline & devis manuels + objectif MRR avec curseur).
6. **Sprint 5** · F12 (to-do quotidienne générée).
7. **→ Dogfooding réel sur mes propres clients pendant plusieurs semaines.**
8. **Phase 2** · git (F6), rapport client (F7), **portail client (F15)**, SEO (F8), santé technique (F9), export compta/Indy (F13), auto-collecte mails (selon ce que l'usage révèle nécessaire). _F15 est prioritaire dans cette phase : c'est l'arme anti-churn._
9. **Phase 3 (horizon)** · couche IA d'optimisation (F14), une fois plusieurs mois de données propres accumulées : objectifs adaptatifs, leviers priorisés, boucle d'expérimentation.

## 11. Objectif MRR : cap 3 000 € · modèle & curseur

### 11.1 L'arithmétique de base

À **60 €/mois** par abonnement, **3 000 € de MRR = 50 abonnements actifs** (la création à ~800 € est du *one-shot*, elle ne compte pas dans le MRR). 50 sites à maintenir en solo (contenu + sécu + reporting), c'est un vrai plafond de capacité. Deux leviers pour l'atteindre :

- **Volume** : signer plus de clients à 60 €.
- **Valeur** : créer des paliers (ex. offre à 120–250 €/mois avec plus de contenu/SEO/monitoring). Moins de clients pour le même MRR → plus soutenable en solo.

### 11.2 Combien de temps ? (scénarios)

La durée dépend de **2 inconnues** : le **MRR de départ** et le **rythme net** d'acquisition (nouveaux clients − churn) par mois. En partant d'un MRR proche de 0 :

| Rythme net | Prix moyen | Clients visés | Durée estimée |
|---|---|---|---|
| +1 client/mois | 60 € | 50 | ~4 ans (trop lent) |
| +2 clients/mois | 60 € | 50 | ~2 ans |
| +3 clients/mois | 60 € | 50 | ~16-17 mois |
| +2 clients/mois | ~100 € (paliers) | 30 | ~15 mois |
| +3 clients/mois | ~100 € (paliers) | 30 | ~10 mois |

### 11.2b Calage avec les chiffres réels

Hypothèses retenues : **MRR de départ ~180 € (juillet 2026)**, **rythme +1 client net/mois**, **mix tarifaire** (volume + paliers plus chers). Gap à combler = 2 820 €. À rythme fixe (1/mois), c'est le **ticket moyen** par nouveau client qui pilote la durée :

| Ticket moyen / nouveau client | MRR ajouté/mois | Durée | Cible approx. |
|---|---|---|---|
| ~60 € (volume pur) | +60 € | ~47 mois | ~2030 (à éviter) |
| ~100 € | +100 € | ~28 mois | ~fin 2028 |
| ~120 € | +120 € | ~24 mois | **~juillet 2028** |
| ~150 € | +150 € | ~19 mois | ~début 2028 |

> **Objectif fixé (placeholder décidé) : 24 mois → cible ~juillet 2028.** Suppose un ticket moyen ≈ 120 €/nouveau client à 1 client/mois. `ObjectifMRR` : `montant_cible = 3000`, `mrr_départ = 180`, `date_début = 2026-07`, `date_cible = 2028-07`.

**Levier prioritaire** : le rythme (1 client/mois) est le facteur limitant. Passer à **1,5 client net/mois** ramène l'objectif à ~16 mois. Le nudge de prospection de F12 doit donc pousser **deux** leviers · augmenter le **ticket moyen** (vendre des paliers, pas du 60 €) et augmenter la **cadence** · et pas seulement signaler « trouve un client ».

### 11.3 Mécanique du curseur (F11)

- **Cible** : `ObjectifMRR.montant_cible` (3 000 €). **Départ** : `mrr_départ`. **Échéance** : `date_cible`.
- **Avancement (%)** = (MRR actuel − départ) / (cible − départ).
- **Rythme requis** = (cible − MRR actuel) / mois restants → « il te faut +X €/mois ».
- **Statut** : on compare le rythme réel (3 derniers mois) au rythme requis → badge **vert (dans les temps)** / **orange (à surveiller)** / **rouge (en retard)**.
- **Superposition pipeline** : afficher le **MRR potentiel** (devis en négo) en pointillé au-dessus du MRR actuel · « si tout signe, tu serais à Y € ».
- Ce statut alimente directement le **nudge de prospection** de la to-do quotidienne (F12).

---

_Document de travail · à versionner dans le repo (ex. `docs/PROJET.md`)._
