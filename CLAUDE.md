# CLAUDE.md

Guide pour travailler sur **Relmo** (repo `RELMO`). Lis aussi
[design.md](design.md) **avant de créer ou modifier de l'UI**.

## Projet

Cockpit **mono-utilisateur** pour gérer un portefeuille de sites clients en modèle
récurrent : suivre le MRR, réconcilier ce qui est **vendu** (contrats /
engagements) avec ce qui est **livré** chaque mois. Cadrage : [docs/PROJET.md](docs/PROJET.md).

Statut : MVP F1→F5 livré (CRUD clients/sites/contrats/engagements, livrables du
mois, MRR, dashboard). Phase 2 (git, rapport client, SEO) pas encore commencée.

## Stack

- **Next.js 16** (App Router, RSC) + **TypeScript** + **Tailwind v4**
- **shadcn/ui** (preset `radix-nova`, icônes lucide) + kit `@efferd/dashboard-4`
- **Prisma 7** + **SQLite** via driver adapter **`better-sqlite3`**
- **Zod** (validation des server actions) · **pnpm**

## Commandes

```bash
pnpm dev          # serveur de dev (http://localhost:3000)
pnpm build        # build prod (lance aussi le typecheck)
pnpm lint         # eslint (doit rester clean)
pnpm db:migrate   # prisma migrate dev
pnpm db:studio    # explorer la base
pnpm db:seed      # ⚠️ RESET : réécrit toutes les données
```

Avant de conclure une tâche qui touche au code : **`pnpm build` et `pnpm lint`
doivent passer**.

## Architecture

- **Lecture** : Server Components qui interrogent `prisma` directement. Mettre
  `export const dynamic = "force-dynamic"` sur les pages qui lisent la DB.
- **Écriture** : Server Actions dans [src/app/actions/](src/app/actions/)
  (`"use server"`) → `parseForm` (Zod) → `prisma` → `revalidatePath`.
- **Formulaires** : dialogs shadcn + `useActionState`, cf. patterns dans
  [design.md](design.md) §4. Toast + fermeture **dans l'action**, pas en effet.
- **DB** : singleton dans [src/lib/db.ts](src/lib/db.ts). Fichier SQLite à
  `prisma/dev.db` (`DATABASE_URL` dans `.env`, résolu depuis la racine projet).
- **Client Prisma 7** généré dans `src/generated/prisma` (gitignoré, régénéré au
  `postinstall`). Requiert le driver adapter — `new PrismaClient({ adapter })`.

## Modèle de données

`Client → Site → Contrat → Engagement` (le vendu, récurrent) `→ Livrable` (le
livré, instancié par mois). Voir [prisma/schema.prisma](prisma/schema.prisma).
Logique clé : un `Livrable` est généré par mois pour chaque engagement dont le
contrat est **actif et démarré** sur la période (cf.
[src/lib/periode.ts](src/lib/periode.ts) `contratActifSurPeriode`).

## Pièges connus (déjà rencontrés)

- **pnpm + scripts de build natifs** : pnpm bloque les postinstall natifs
  (sharp, better-sqlite3, prisma, esbuild). Les autoriser dans
  `pnpm-workspace.yaml` (`allowBuilds: <pkg>: true` + `onlyBuiltDependencies`),
  puis `pnpm install`.
- **Prisma 7** impose un **driver adapter** ; le constructeur `new PrismaClient()`
  sans `{ adapter }` ne compile pas.
- **`pnpm db:seed` est destructif** (reset). Ne PAS le relancer si l'utilisateur a
  saisi/édité des données dans l'app — privilégier le CRUD UI.
- **Migrations** : après un changement de schéma, `pnpm db:migrate` puis vérifier
  que `src/generated/prisma` est régénéré (sinon `npx prisma generate`).
- **Déploiement Vercel** : ne marchera pas tel quel (SQLite fichier + FS serverless
  éphémère). Repoussé ; passage à Turso (SQLite cloud) recommandé le moment venu.

## Conventions

- UI en **français**, code/identifiants en anglais ou français cohérent avec
  l'existant. Couleur, typo, patterns : **suivre [design.md](design.md)**.
- Liens cliquables en markdown vers `fichier:ligne` quand on référence du code.
- Commits : messages clairs en français, terminés par le trailer
  `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`.
  Ne commiter/pusher que si l'utilisateur le demande.
