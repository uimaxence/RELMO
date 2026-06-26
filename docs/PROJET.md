# Projet — Outil de gestion de portefeuille de sites clients

> Document de cadrage. Sert de contexte de référence pour le développement (notamment avec Claude Code).
> Nom de travail : **SiteFlow** _(placeholder — à remplacer)_.
> Statut : spec initiale. Tout ce qui suit est versionnable et amené à évoluer.

---

## 1. Vision en une phrase

Un cockpit unique pour gérer un portefeuille de sites clients en modèle récurrent : suivre le MRR, savoir en un coup d'œil ce qui a été **vendu** à chaque client et ce qui a été **réellement livré** ce mois-ci, et produire le rapport qui justifie l'abonnement.

## 2. Problème

Quand on gère plusieurs sites en contrat de maintenance/suivi récurrent (création ~800 €, abonnement ~60 €/mois), trois douleurs reviennent :

1. **Pas de visibilité sur le réalisé vs le vendu.** Un contrat dit « 2 articles SEO/mois + maj de sécurité ». Mais ai-je fait les 2 articles ce mois-ci sur *ce* site précis ? L'info est éparpillée entre la tête, le git et des notes.
2. **MRR flou.** Combien je facture en récurrent, par client, et quels contrats sont à risque ? Aucune vue consolidée.
3. **Le client ne voit pas la valeur.** Sans rapport mensuel concret, l'abonnement à 60 € devient une ligne qu'on questionne → churn.

## 3. Positionnement / différenciation

Le marché est dense mais mal aligné avec ce besoin précis :

- Les outils de **gestion multi-sites** (ManageWP, InstaWP, WP Remote…) sont quasi tous **centrés WordPress**. Hors sujet pour des sites Next.js / custom.
- Les outils de **reporting SEO** (AgencyAnalytics, Whatagraph, Swydo…) sont commoditisés et ne réconcilient pas l'engagement contractuel avec le réalisé.
- Les outils de **gestion d'agence** (ClientPlug, SPP, Plutio…) gèrent tâches + facturation mais restent génériques (souvent orientés Ads) et lourds pour un solo.

**Notre angle distinctif :**

- **Réconciliation contrat ↔ livrables** : le cœur. On modélise ce qui est *vendu* dans chaque contrat (quantités récurrentes) et on suit le *livré*, idéalement coché automatiquement depuis le git.
- **Agnostique du CMS / orienté sites custom & headless** (Next.js en premier), là où la concurrence suppose WordPress.
- **Pensé pour un dev solo**, pas pour une agence de 50 personnes.

## 4. Utilisateurs cibles

- **V1 (priorité absolue) : moi.** Outil interne, dogfooding. Un seul utilisateur, mes propres clients.
- **V2 (hypothèse à valider) : freelances dev/SEO solo** en modèle récurrent sur sites custom. À n'envisager **que** si une demande spontanée émerge.

> Décision de cadrage : on construit d'abord un outil mono-utilisateur. Le multi-comptes (auth multi-tenant, billing SaaS, support, RGPD) est explicitement **hors périmètre** jusqu'à validation de la demande.

## 5. Périmètre

### 5.1 MVP (ce qu'on construit d'abord)

| # | Fonction | Description | Pourquoi |
|---|----------|-------------|----------|
| F1 | **Annuaire clients & sites** | CRUD client → 1..n sites (URL, stack, repo git, hébergeur, dates clés). | Base de tout. |
| F2 | **Contrats récurrents** | Par site : type de presta, montant mensuel, date de début, statut. Définit les **engagements récurrents** (ex. « 2 articles/mois », « maj sécu mensuelle »). | Source de vérité du « vendu ». |
| F3 | **Suivi MRR** | Vue consolidée : MRR total, par client, évolution. Saisie manuelle au départ. | Pilotage business. |
| F4 | **Livrables du mois (le cœur)** | Pour chaque site, génération auto d'une checklist mensuelle à partir des engagements du contrat. État fait / pas fait. Vue « ce mois-ci, qu'est-ce qui reste ». | La douleur n°1. |
| F5 | **Tableau de bord global** | Une page : tous les sites, MRR, livrables en retard, alertes contrat à risque (rien de livré depuis X). | Le cockpit. |

### 5.2 Phase 2 (après dogfooding)

- **F6 — Intégration git** : lire l'activité d'un repo (commits, déploiements, ou tags conventionnels type `seo:`, `maj:`) pour **cocher automatiquement** des livrables. *C'est la fonction signature ; on la fait une fois le modèle manuel validé.*
- **F7 — Rapport mensuel client** : génération auto (PDF/HTML) compilant livrables réalisés + évolution SEO, envoyable au client.
- **F8 — Suivi de positions SEO** : par site/mot-clé, via DataForSEO, alimentant le rapport.
- **F9 — Santé technique** : monitoring uptime, alertes SSL/domaine qui expirent, Lighthouse/Core Web Vitals dans le temps.

### 5.3 Hors périmètre (non-goals)

À écarter explicitement pour ne pas se disperser :

- ❌ Multi-tenant / comptes multiples / inscription publique.
- ❌ Facturation récurrente automatisée (Stripe billing) — la saisie manuelle du MRR suffit en V1.
- ❌ Portail client (login côté client).
- ❌ Gestion WordPress (updates plugins, etc.).
- ❌ CRM de prospection, devis, contrats signés électroniquement.
- ❌ App mobile.

## 6. Stack technique proposée

Alignée sur l'environnement de dev existant.

- **Framework** : Next.js (App Router) + TypeScript.
- **UI** : Tailwind CSS. Composants simples, sobres ; c'est un outil interne, pas une vitrine.
- **Base de données** : PostgreSQL (ex. via Neon/Supabase) avec **Prisma** ou **Drizzle** comme ORM.
- **Auth** : mono-utilisateur en V1 → une protection simple (variable d'env + middleware, ou Auth.js avec un seul compte). Pas de système multi-utilisateurs.
- **Intégrations (phase 2)** :
  - Git : API GitHub/GitLab (lecture commits/déploiements).
  - SEO : DataForSEO (déjà utilisé par ailleurs).
- **Hébergement** : Vercel (cohérent avec Next.js).

> Note pour le dev : commencer simple. SQLite/Postgres local suffit pour amorcer. Pas de sur-ingénierie tant que l'outil n'a qu'un utilisateur.

## 7. Modèle de données (esquisse)

```
Client
  id, nom, email, téléphone, notes, créé_le

Site
  id, client_id (FK), nom, url, repo_git_url, hébergeur,
  date_mise_en_ligne, stack (ex. "Next.js"), statut, notes

Contrat
  id, site_id (FK), libellé, montant_mensuel, date_début,
  date_fin (nullable), statut (actif | en_pause | résilié)

Engagement            # ce qui est VENDU, récurrent
  id, contrat_id (FK), type (ex. "article_seo", "maj_securite"),
  libellé, quantité_par_mois, récurrence (mensuelle | ...)

Livrable              # ce qui est À FAIRE / FAIT, instancié par mois
  id, engagement_id (FK), période (AAAA-MM), libellé,
  statut (à_faire | fait | non_applicable),
  fait_le (nullable), source (manuel | git), note
```

Logique clé : au passage d'un nouveau mois, chaque `Engagement` actif génère N `Livrable` pour la période (N = `quantité_par_mois`). Le tableau de bord lit les `Livrable` de la période courante.

## 8. Principes produit

- **Mono-utilisateur d'abord.** Toute complexité multi-comptes est repoussée jusqu'à preuve de la demande.
- **Le manuel avant l'auto.** On valide le modèle contrat↔livrable en saisie manuelle (F4) **avant** de brancher le git (F6).
- **L'outil doit réduire ma charge mentale, pas l'augmenter.** Si une fonction demande plus de saisie qu'elle n'en fait gagner, on la coupe.
- **Vendable ≠ objectif initial.** L'objectif est de résoudre ma douleur. La revente n'est envisagée que si des confrères la réclament spontanément.

## 9. Critère de succès (V1)

L'outil est un succès si, à la fin de chaque mois, je peux répondre en moins de 30 secondes à : « pour chacun de mes sites, qu'ai-je vendu, qu'ai-je livré, et combien je facture en récurrent ? » — sans ouvrir une autre app.

## 10. Roadmap indicative

1. **Sprint 0** — Setup projet (Next.js + DB + ORM + auth simple).
2. **Sprint 1** — F1 + F2 (clients, sites, contrats, engagements). CRUD.
3. **Sprint 2** — F4 (génération + suivi des livrables mensuels). C'est le cœur.
4. **Sprint 3** — F3 + F5 (MRR + tableau de bord global).
5. **→ Dogfooding réel sur mes propres clients pendant plusieurs semaines.**
6. **Phase 2** — git (F6), rapport client (F7), SEO (F8), santé technique (F9), selon ce que l'usage révèle nécessaire.

---

_Document de travail — à versionner dans le repo (ex. `docs/PROJET.md`)._
