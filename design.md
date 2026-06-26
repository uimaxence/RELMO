# Design system — SiteFlow

> Référence à suivre pour **chaque nouvel élément d'UI**. But : un outil interne
> sobre, lisible, cohérent. On part de shadcn/ui (preset `radix-nova`, Tailwind v4)
> + du kit de design issu du block `@efferd/dashboard-4`, teinté de notre marque.

## 1. Couleur de marque

**Teal `#2A9D8F`** → `oklch(0.63 0.101 183)` (clair) / `oklch(0.78 0.101 183)` (dark).

C'est une **touche**, pas un aplat partout. Définie dans
[src/app/globals.css](src/app/globals.css) sur les tokens :

| Token | Rôle |
|---|---|
| `--primary` | Boutons d'action, états actifs, accents clés |
| `--ring` | Anneaux de focus |
| `--sidebar-primary` / `--sidebar-ring` | Onglet actif / focus dans la sidebar |
| `--chart-1` | Première série de graphe (les charts mènent avec la marque) |

➡️ **Règle : ne jamais coder une couleur en dur.** Toujours passer par les tokens
sémantiques (`bg-primary`, `text-primary`, `border-border`, `bg-muted`,
`text-muted-foreground`, `bg-card`…). Ils gèrent le dark mode automatiquement.

### Couleurs sémantiques de statut (exceptions tolérées)
Pour les états métier, on utilise des teintes Tailwind explicites, en `/10`–`/40` :
- **Fait / OK** → `emerald` (ex. `bg-emerald-500/10 text-emerald-700`)
- **À faire / en retard / attention** → `amber`
- **Erreur / suppression** → token `destructive`
- **Neutre / secondaire** → `Badge variant="secondary"`, `text-muted-foreground`

## 2. Typographie

- Police : **Geist Sans** (`--font-sans`), mono = Geist Mono.
- **Chiffres** (montants, compteurs, KPI) : `tabular-nums tracking-tight`.
- Titres de page : `text-2xl font-semibold tracking-tight` (via `PageHeader`).
- Valeurs KPI : `text-2xl font-semibold tabular-nums tracking-tight`.
- Labels secondaires : `text-sm`/`text-xs text-muted-foreground`.

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
→ valeur `text-2xl font-semibold tabular-nums` → `CardDescription` (hint).
Référence enrichie (avec indicateur de tendance) :
[stats.tsx](src/components/stats.tsx) + [delta.tsx](src/components/delta.tsx).
👉 Utiliser `Delta`/`DeltaIcon`/`DeltaValue` **dès qu'on a une comparaison**
(ex. MRR vs mois précédent, une fois l'historique en place).

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
