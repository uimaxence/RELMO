# Relmo

Cockpit mono-utilisateur pour gérer un portefeuille de sites clients en modèle
récurrent : suivre le MRR, réconcilier ce qui est **vendu** (contrats /
engagements) avec ce qui est **livré** chaque mois, et produire le rapport qui
justifie l'abonnement.

> Cadrage complet : [docs/PROJET.md](docs/PROJET.md).

## Stack

- **Next.js 16** (App Router) + **TypeScript**
- **Tailwind CSS v4** + **shadcn/ui** (preset Nova : Lucide + Geist)
- **Prisma 7** + **SQLite** (driver adapter `better-sqlite3`)

## Démarrer

```bash
pnpm install          # installe + génère le client Prisma (postinstall)
pnpm db:migrate       # applique les migrations sur prisma/dev.db
pnpm dev              # http://localhost:3000
```

## Scripts

| Script            | Rôle                                 |
| ----------------- | ------------------------------------ |
| `pnpm dev`        | Serveur de développement             |
| `pnpm build`      | Build de production                  |
| `pnpm db:migrate` | `prisma migrate dev`                 |
| `pnpm db:studio`  | Explorer la base (`prisma studio`)   |

## Modèle de données

`Client` → `Site` → `Contrat` → `Engagement` (le vendu, récurrent) →
`Livrable` (le livré, instancié par mois). Voir
[prisma/schema.prisma](prisma/schema.prisma) et §7 de la spec.

La base de données vit dans `prisma/dev.db` (`DATABASE_URL` dans `.env`, résolu
relativement à la racine du projet).

## État

Sprint 0 terminé : socle Next.js + shadcn + Prisma, shell d'app (sidebar,
dashboard branché sur la DB) et pages F1/F3/F4 en placeholder.

Prochaine étape — **Sprint 1** : CRUD Clients → Sites → Contrats → Engagements.
Roadmap complète dans [docs/PROJET.md](docs/PROJET.md) §10.
