# Design system — SiteFlow

> Référence à suivre pour **chaque nouvel élément d'UI**. But : un outil interne
> sobre, lisible, **éditorial**. Base = shadcn/ui (preset `radix-nova`, Tailwind v4)
> + le kit `@efferd/dashboard-4`. La **maquette de référence vivante** est
> [style-guide.html](style-guide.html) (ouvre-la dans un navigateur) — elle prime
> pour le visuel ; ce fichier en est la traduction en règles.

## 1. Couleurs

Direction : **palette chaude monochrome** (pas de blanc ni de noir purs), l'encre
porte l'action, les **statuts** apportent la couleur, et le **teal de marque** est
une **touche** discrète. Tout est dans [src/app/globals.css](src/app/globals.css).

### Base neutre (tokens sémantiques — à toujours utiliser)

| Rôle | Token | Clair |
|---|---|---|
| Fond appli (canvas) | `--background` | `#F4F4F1` |
| Surface (cartes) | `--card` | `#FFFFFF` |
| Creux (hover, muted) | `--muted` / `--secondary` | `#F1F1ED` |
| Encre (texte, actions) | `--foreground` / `--primary` | `#1A1A17` |
| Encre douce | `--muted-foreground` | `#6B6B63` |
| Bordure | `--border` | `#E7E7E1` |
| Destructif | `--destructive` | `#C2452D` |

### Marque (la touche teal)

**Teal `#2A9D8F`**, exposé via le token **`--brand`** (`bg-brand`, `text-brand`).
Usage **restreint** : le mark « S » de la sidebar, l'anneau de focus (`--ring`),
la 1ʳᵉ série de graphe (`--chart-1`). **Pas** sur les boutons primaires (eux
restent en encre, cf. maquette).

➡️ **Règle : jamais de couleur en dur.** Toujours les tokens (`bg-background`,
`bg-card`, `text-muted-foreground`, `bg-brand`, `border-border`…). Le dark mode
suit automatiquement (variante chaude définie dans `globals.css`).

### Statuts métier → `StatusBadge`
Composant [status-badge.tsx](src/components/status-badge.tsx) (pastille + libellé).
Quatre variantes, dark-mode-safe :
- **`ok`** (livré, actif) → emerald · **`warn`** (à faire, en pause, à surveiller)
  → amber · **`bad`** (en retard, résilié) → red · **`neutral`** (n/a, en négo) → muted.
Helpers prêts : `SiteStatusBadge`, `ContratStatusBadge`.

## 2. Typographie

- Police : **Geist Sans** (`--font-sans`) ; **Geist Mono** (`font-mono`) pour
  **tous les chiffres** (KPI, montants, colonnes de table, %).
- **Métriques / KPI** : `font-mono text-2xl font-medium tabular-nums tracking-tight`.
- **Montants en table** : cellule `text-right font-mono tabular-nums`.
- Titres de page : `text-2xl font-semibold tracking-tight` (via `PageHeader`).
- **Label de section** (style maquette) : `text-xs font-medium uppercase
  tracking-wider text-muted-foreground`.
- Corps : `text-sm` ; secondaire : `text-xs text-muted-foreground`.

## 3. Layout

- **Shell** : sidebar ([app-sidebar.tsx](src/components/app-sidebar.tsx)) +
  header (trigger ⌘B + fil d'Ariane) dans [layout.tsx](src/app/layout.tsx).
- Navigation : **source unique** dans
  [src/components/nav-config.tsx](src/components/nav-config.tsx) (`NAV`,
  `activeNavItem`). Sidebar **et** breadcrumb la consomment → un seul endroit à
  modifier pour ajouter une section.
- Contenu de page : `main` en `p-4 md:p-6`, sections en `space-y-6`.
- Grilles de cartes : `grid gap-4` (KPI : `sm:grid-cols-2 lg:grid-cols-4`).

## 4. Patterns de composants (réutiliser, ne pas réinventer)

### En-tête de page
[`PageHeader`](src/components/page-header.tsx) — `title`, `description`, actions en
`children` (alignées à droite).

### Carte KPI / statistique
Structure : `Card` → label `text-sm text-muted-foreground` + icône lucide à droite
→ valeur **`font-mono text-2xl font-medium tabular-nums`** → `CardDescription` (hint).
Référence enrichie (indicateur de tendance) : [delta.tsx](src/components/delta.tsx).
👉 Utiliser `Delta`/`DeltaIcon`/`DeltaValue` **dès qu'on a une comparaison**
(ex. MRR vs mois précédent, une fois l'historique en place).

### Barre de progression segmentée
Pour un avancement vers une cible (ex. [objectif-mrr.tsx](src/components/objectif-mrr.tsx)) :
une rangée de petits segments (`flex gap-[3px]`, `flex-1 rounded-[3px] h-5`), remplis
en `bg-foreground`, vides en `bg-muted`. **Jamais de gros bloc plein** (principe
maquette : densité par petits carrés).

### Badge de statut
[`StatusBadge`](src/components/status-badge.tsx) (variantes `ok`/`warn`/`bad`/`neutral`)
plutôt que le `Badge` brut, pour tout état métier.

### Formulaires (création / édition)
Toujours le même squelette (cf. [src/components/forms/](src/components/forms/)) :
- `Dialog` shadcn + `useActionState` ; le **toast + fermeture** se font **dans
  l'action** (jamais dans un `useEffect` → règle `react-hooks/set-state-in-effect`).
- Validation **Zod côté serveur** ([schemas.ts](src/lib/schemas.ts)) via
  [`parseForm`](src/lib/form.ts) (discriminant `ok`).
- Champs via [`Field`](src/components/forms/form-ui.tsx) (label + hint + erreur).
- `Select` shadcn avec `name=` + `defaultValue=` (soumission native).
- Le composant gère création **et** édition (prop `entity?` optionnelle).

### Suppression
[`ConfirmDelete`](src/components/forms/confirm-delete.tsx) (`AlertDialog`) avec une
server action liée. Description explicite des effets en cascade.

### Server actions
Dans `src/app/actions/` (`"use server"`). Valider avec `parseForm`, muter via
`prisma`, puis `revalidatePath` des routes touchées (`/`, la liste, le détail).

### Tables, listes, états vides
- Tables : `Table` shadcn. Listes : `ul.divide-y`.
- **Toujours** prévoir un état vide avec un CTA (cf. /clients, /livrables).
- Liens cliquables vers le détail (`hover:underline`, `ChevronRight` discret).

### Graphes
`recharts` + le wrapper [ui/chart.tsx](src/components/ui/chart.tsx). Couleurs via
`--chart-1..5` (1 = marque). Exemples : [revenue-chart.tsx](src/components/revenue-chart.tsx).

## 5. Icônes
**lucide-react** uniquement. Taille par défaut `size-4` ; `size-3.5` dans les
contextes denses (breadcrumb).

## 6. Le kit `@efferd/dashboard-4` — adopté vs référence

**Adopté (utilisé en prod) :** tokens de marque, `custom-sidebar-trigger`,
`breadcrumb`, le pattern stat-card, `delta.tsx`, primitives ui (avatar, chart,
collapsible, item, kbd).

**Référence / démo e-commerce (non câblé, conservé comme exemple — supprimable) :**
`dashboard.tsx`, `stats.tsx` (données fictives), `revenue-chart*`,
`refund-return-rate-chart`, `category-rank-chart`, `quick-actions`,
`latest-change`, `nav-user` (user fictif), `app-shell`/`app-header`/`app-shared`
(nav de démo). On s'en sert comme **modèle visuel** quand on construit l'équivalent
métier (ex. un futur graphe d'évolution du MRR s'inspire de `revenue-chart`).

## 7. À faire / à ne pas faire

✅ Réutiliser les patterns ci-dessus · tokens sémantiques · `tabular-nums` sur les
chiffres · états vides · valider côté serveur.
❌ Couleurs en dur · dupliquer la nav · `setState` dans un effet pour fermer un
dialog · sur-styliser (c'est un outil interne, pas une vitrine).
