# Guide d'implémentation UI — Relmo

> **La source de vérité du design est [DESIGN_SYSTEM.md](DESIGN_SYSTEM.md)**
> (+ la démo vivante [style-guide.html](style-guide.html)). Ce fichier-ci est le
> **pont vers le code** : comment appliquer la spec dans ce projet Next.js + shadcn.
> En cas de doute sur une couleur/typo/espacement → DESIGN_SYSTEM.md prime.

## Tokens → classes (où c'est branché)

Tout est dans [src/app/globals.css](src/app/globals.css). La palette de
DESIGN_SYSTEM.md est exposée de **deux** façons interchangeables :

- **Tokens shadcn** (utilisés par les composants ui) : `bg-background` (canvas),
  `bg-card` (surface), `bg-muted` (sunken), `text-foreground` (ink),
  `text-muted-foreground` (ink-soft), `border-border`.
- **Noms de la spec** (pour l'UI custom) : `bg-canvas`, `text-ink`,
  `text-ink-soft`, `text-ink-faint`, `border-border-strong`, et les statuts
  `bg-positive-bg text-positive-ink` (+ `warning` / `negative` / `neutral`).
- **Marque** : `bg-brand` / `text-brand` (teal `#2A9D8F`). Accent **restreint** :
  mark sidebar, **onglet de nav actif** (`data-[active=true]:text-brand`), focus
  (`--ring`), 1ʳᵉ série de graphe (`--chart-1`). Jamais sur un bouton primaire.

➡️ **Jamais de hex en dur.** Toujours une classe token. Le dark mode (chaud) suit.

## Composants & patterns (réutiliser, ne pas réinventer)

| Besoin | Quoi utiliser |
|---|---|
| Chiffres / KPI | `font-mono tabular-nums` **toujours** ; KPI = `font-mono text-2xl font-medium tabular-nums` |
| Label de section | `text-xs font-medium uppercase tracking-wider text-muted-foreground` |
| Statut métier | [`StatusBadge`](src/components/status-badge.tsx) (`ok`/`warn`/`bad`/`neutral`) + `SiteStatusBadge`, `ContratStatusBadge` |
| En-tête de page | [`PageHeader`](src/components/page-header.tsx) |
| Avancement vers cible | barre segmentée, cf. [objectif-mrr.tsx](src/components/objectif-mrr.tsx) (petits segments, jamais de bloc plein) |
| Formulaire create/edit | dialog shadcn + `useActionState` + Zod, cf. [src/components/forms/](src/components/forms/) ; toast + fermeture **dans l'action** (pas en `useEffect`) |
| Suppression | [`ConfirmDelete`](src/components/forms/confirm-delete.tsx) (`AlertDialog`) |
| Graphe | `recharts` + [ui/chart.tsx](src/components/ui/chart.tsx) ; couleurs `--chart-1..5` (1 = marque) |
| Icônes | lucide, `size-4` (ou `size-3.5` en contexte dense) |

## Conventions de code

- **Lecture** : Server Component + `prisma` ; `export const dynamic = "force-dynamic"`
  si la page lit la DB.
- **Écriture** : server action dans `src/app/actions/` → `parseForm` (Zod) →
  `prisma` → `revalidatePath`.
- Navigation : source unique [nav-config.tsx](src/components/nav-config.tsx)
  (sidebar + breadcrumb).
- **Toujours** un état vide avec CTA ; liens cliquables vers le détail.

## Kit `@efferd/dashboard-4`
Composants e-commerce de démo (charts, stats, nav-user…) conservés comme **modèle
visuel** uniquement (non câblés). On s'en inspire pour construire l'équivalent métier.
