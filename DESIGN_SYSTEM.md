# SiteFlow · Design System

> Système graphique de l'outil. Sert de source de vérité pour le dev (Claude Code, Tailwind).
> Direction : dashboard data **monochrome, éditorial, calme**, dérivée de la réf fournie.
> À versionner : `docs/DESIGN_SYSTEM.md`. Le fichier `style-guide.html` est la démo vivante.

---

## 0. Principe directeur

Un seul mot d'ordre : **calme et lisible**. C'est un outil qu'on ouvre tous les jours, vite. La donnée est la vedette, l'UI s'efface.

- **Quasi-monochrome.** Noir (encre) pour le texte, les données et les actions primaires. La couleur ne sert qu'à **dire quelque chose** (vert = ça monte / c'est fait, ambre = en attente, rouge = en retard). Jamais décorative.
- **Chiffres en monospace.** Tous les nombres (MRR, montants, quantités, axes) sont en fonte mono à chasse fixe → alignement parfait, pas de saut de largeur quand ça s'anime.
- **Micro-labels en capitales.** Les titres de section et de KPI sont en petites capitales, tracking large, gris clair.
- **Filets, pas d'ombres lourdes.** Hiérarchie par bordures fines + ombres à peine perceptibles. L'élévation se gagne, elle ne se distribue pas.
- **Une audace, une seule** (cf. Chanel) : les deux éléments **signature** (§9). Tout le reste reste discipliné.

---

## 1. Tokens couleur

Source de vérité = variables CSS. Mapping Tailwind en §1.2.

```css
:root {
  /* Surfaces */
  --canvas:          #F4F4F1; /* fond de l'app */
  --surface:         #FFFFFF; /* cartes */
  --surface-sunken:  #F1F1ED; /* insets, pistes, barres "fantôme" */
  --border:          #E7E7E1; /* filet par défaut */
  --border-strong:   #DAD9D2; /* filet appuyé (séparateurs, focus léger) */

  /* Encre (texte + données + primaire) */
  --ink:             #1A1A17; /* texte principal, barres, boutons primaires */
  --ink-soft:        #6B6B63; /* texte secondaire */
  --ink-faint:       #A2A299; /* micro-labels capitales, axes, placeholder */

  /* Sémantique · positif (ça monte / c'est fait) */
  --positive:        #1E9E5A;
  --positive-ink:    #15703F;
  --positive-bg:     #E7F4EC;

  /* Sémantique · attente (pending / en négo) */
  --warning:         #E0930F;
  --warning-ink:     #8A5A0C;
  --warning-bg:      #FAEFD7;

  /* Sémantique · alerte (en retard / à risque) */
  --negative:        #C2452D;
  --negative-ink:    #93341F;
  --negative-bg:     #F7E7E2;

  /* Sémantique · neutre (non applicable / archivé) */
  --neutral-ink:     #6E6E66;
  --neutral-bg:      #EFEFEA;
}
```

**Règle d'accent unique :** le vert fait double emploi (succès *et* croissance MRR), ce qui est cohérent pour un outil de revenu. On n'ajoute pas d'autre couleur de marque. Si un jour il faut un accent de marque distinct, on le pose ici et on s'y tient.

### 1.2 Mapping Tailwind v4 (`@theme`)

```css
/* app/globals.css */
@import "tailwindcss";

@theme {
  --color-canvas: #F4F4F1;
  --color-surface: #FFFFFF;
  --color-sunken: #F1F1ED;
  --color-border: #E7E7E1;
  --color-border-strong: #DAD9D2;
  --color-ink: #1A1A17;
  --color-ink-soft: #6B6B63;
  --color-ink-faint: #A2A299;
  --color-positive: #1E9E5A;
  --color-positive-ink: #15703F;
  --color-positive-bg: #E7F4EC;
  --color-warning: #E0930F;
  --color-warning-ink: #8A5A0C;
  --color-warning-bg: #FAEFD7;
  --color-negative: #C2452D;
  --color-negative-ink: #93341F;
  --color-negative-bg: #F7E7E2;
  --color-neutral-ink: #6E6E66;
  --color-neutral-bg: #EFEFEA;
}
```

Usage : `bg-canvas`, `text-ink`, `border-border`, `text-positive-ink bg-positive-bg`, etc.

---

## 2. Typographie

Trois rôles, deux familles. Pile recommandée alignée sur le stack Next.js.

| Rôle | Famille | Usage |
|---|---|---|
| **Display / UI** | **Geist** (fallback : Inter, system-ui) | Titres, nav, labels, boutons, corps. |
| **Data / Mono** | **Geist Mono** (fallback : "JetBrains Mono", ui-monospace) | **Tous les nombres** : MRR, montants, quantités, axes, %, dates courtes, kbd. |

> Next.js : charger via `next/font/google`.
> ```ts
> import { Geist, Geist_Mono } from "next/font/google";
> const sans = Geist({ subsets: ["latin"], variable: "--font-sans" });
> const mono = Geist_Mono({ subsets: ["latin"], variable: "--font-mono" });
> ```
> Puis `--font-sans` / `--font-mono` dans `@theme`.

### 2.1 Échelle type

| Token | Taille / interligne | Graisse | Notes |
|---|---|---|---|
| `display` | 30 / 1.15 | 600 | « Bon retour, … » (titre de page). |
| `title` | 16 / 1.3 | 600 | Titres de carte non-capitales. |
| `metric` | 28 / 1.1 | 500 | **Mono**, `font-variant-numeric: tabular-nums`, `letter-spacing: .01em`. Les gros chiffres. |
| `metric-sm` | 18 / 1.2 | 500 | **Mono**, chiffres secondaires. |
| `label` | 11 / 1 | 500 | **CAPITALES**, `letter-spacing: .08em`, couleur `--ink-faint`. Titres de section & KPI. |
| `body` | 14 / 1.5 | 400 | Corps, cellules texte. |
| `body-strong` | 14 / 1.5 | 500 | Noms, valeurs mises en avant. |
| `small` | 12.5 / 1.4 | 400 | Légendes, deltas, méta. |
| `mono-table` | 13 / 1.4 | 450 | **Mono**, chiffres de tableau. |

**Règle d'or :** un nombre destiné à être lu/comparé/animé est **toujours** en mono tabulaire. Du texte n'est jamais en mono.

---

## 3. Espacement, rayons, élévation

### 3.1 Espacement (base 4px)
`2 · 4 · 6 · 8 · 12 · 16 · 20 · 24 · 32 · 40 · 48`
- Padding carte : **20** (compacte) / **24** (large).
- Gap grille de cartes : **16–20**.
- Gap entre sections : **28–32**.
- Gouttière de page : **24**.

### 3.2 Rayons
```css
--r-card:    16px;  /* cartes, conteneurs de graphe */
--r-inset:   12px;  /* insets, bandeaux internes */
--r-control: 10px;  /* boutons, inputs, dropdowns, date pill */
--r-pill:    999px; /* badges, segmented, item de nav actif */
```

### 3.3 Élévation (volontairement plate)
```css
--shadow-xs: 0 1px 2px rgba(26,26,23,.05);
--shadow-sm: 0 1px 3px rgba(26,26,23,.06), 0 1px 2px rgba(26,26,23,.04);
--shadow-md: 0 6px 16px -4px rgba(26,26,23,.10), 0 2px 6px -2px rgba(26,26,23,.06);
```
- **Carte au repos** = `1px solid --border-strong` (filet volontairement visible, comme la réf) + `--shadow-xs`.
- **Item de nav actif / pastille** = `--surface` + `--shadow-sm`.
- **Survol carte / popover / tooltip / dropdown** = `--shadow-md`.
- Au-delà, rien. Pas d'ombre colorée, pas de glow.

---

## 4. Layout & grille

```
┌───────────┬───────────────────────────────────────────────┐
│  SIDEBAR  │  TOPBAR : breadcrumb · search(⌘K) · 🔔 · 📥 · ⦿ │
│  248px    ├───────────────────────────────────────────────┤
│  fixe     │  HEADER : « Bon retour » · [Daily▾][date][CSV] │
│           ├───────────────────────────────────────────────┤
│  groupes  │  KPIs : [MRR][Sites][Nv. clients][Signature]   │ 4-up
│  + actif  ├──────────────────────────┬────────────────────┤
│  pastille │  ÉVOLUTION DU MRR (large)│ VENDU vs LIVRÉ      │ ~62/38
│           ├──────────────────────────┴────────────────────┤
│           │  TABLE : livrables du mois / devis récents     │
└───────────┴───────────────────────────────────────────────┘
```

- **Shell** : sidebar fixe 248px + zone contenu (max ~1200px, gouttière 24).
- **KPI** : 4-up → 2-up (<1024) → 1-up (<640).
- **Charts** : 2 colonnes ~62/38, empilées sous 1024.
- **Table** : pleine largeur.
- Plancher qualité : responsive jusqu'au mobile, focus clavier visible, `prefers-reduced-motion` respecté.

---

## 5. Nav latérale

Structure groupée, reprise de la réf, **renommée pour SiteFlow** :

```
[◈ SiteFlow / Mon agence]            ← sélecteur en haut, pastille + chevrons

PILOTAGE
  ▸ Dashboard            (actif)
  ▸ Objectif MRR
CLIENTS
  ▸ Clients & sites
  ▸ Contrats
COMMERCIAL
  ▸ Pipeline & devis
  ▸ To-do du jour
LIVRAISON
  ▸ Livrables du mois
  ▸ Rapports
SYSTÈME
  ▸ Intégrations
  ▸ Réglages
```

- En-têtes de groupe : style `label` (capitales, `--ink-faint`).
- Item : icône 18px + libellé `body`. Repos = transparent / `--ink-soft`. Survol = `--surface-sunken`, texte `--ink`. **Actif** = pastille `--surface` + `--shadow-sm` + icône pleine + texte `--ink`, rayon `--r-pill`.

---

## 6. Composants (inventaire + états)

Chaque composant : repos / survol / actif-focus / désactivé. Focus visible partout (`outline: 2px solid var(--ink)` décalé, ou ring `--border-strong`).

- **Carte KPI (deux niveaux)** : une **base grise** (`--sunken`, `1px --border`, `--r-card`) dans laquelle **flotte une carte blanche** (`--surface`, `1px --border-strong`, rayon 12) qui porte `label` + `metric` (mono) + **sparkline** à droite. Le **delta vit dans la zone grise exposée** sous la carte blanche : à gauche une petite pastille ronde (icône ↑/↓), à droite le **delta-badge**. Repris fidèlement de la réf.
- **Delta-badge** : pill `mono`, **flèche ↑/↓ + valeur**, fond teinté léger. Positif → `--positive-bg`/`--positive-ink` ; négatif → `--negative-bg`/`--negative-ink`. **Pas de signe `+`/`-`** : la flèche et la couleur disent déjà le sens (ex. `↑ 125%`, `↓ 7 %`). Quand ce n'est pas un delta (objectif, cible), texte neutre `--ink-soft` sans flèche.
- **Carte graphe** : `label` de section · barre d'outils à droite (segmented / dropdown / `⋯`) · zone de tracé.
- **Segmented control** (Hebdo/Mensuel/Annuel) : piste `--surface-sunken`, **thumb** `--surface` + `--shadow-xs` qui **glisse** (cf. §8). Texte actif `--ink`, inactif `--ink-soft`.
- **Dropdown / Date pill** : `--surface`, `1px border`, `--r-control`, icône + label mono pour les dates, chevron.
- **Boutons** :
  - *Primaire* : `--ink` / texte blanc, `--r-control`, padding 10×16. Survol `#000`. Press `scale(.98)`.
  - *Secondaire* : `--surface` + `1px border` + texte `--ink`. Survol `--surface-sunken`.
  - *Ghost* : transparent + texte `--ink-soft`. Survol `--surface-sunken`.
  - *Icône* : carré 36px, `--r-control`, secondaire.
- **Input / Search** : `--surface`, `1px border`, `--r-control`, placeholder `--ink-faint`. Search affiche un **kbd** `⌘K` (mono, `--surface-sunken`).
- **Badge de statut** (pill, `small`, point coloré + texte) :
  - `Livré` / `Signé` → positive · `À faire` / `En négo` → warning · `En retard` / `À risque` → negative · `N/A` / `Archivé` → neutral.
- **Table** : en-têtes `label` triables (icône `⇅`), lignes séparées par filet (pas de zébrures), **survol de ligne** `--surface-sunken`, checkbox custom, menu d'action `⋯` en fin de ligne. Chiffres en `mono-table` alignés à droite.
- **Bandeau IA** (= F14) : inset `--surface-sunken`, icône étincelle, texte « Voir l'analyse IA », chevron. Survol = léger reflet (cf. §8).
- **Tooltip / Toast / Empty state** : voir §8 pour le mouvement. Empty state = une phrase + une action (jamais décoratif).

---

## 7. Voix de l'interface (copy)

Du point de vue de l'utilisateur, verbes actifs, casse phrase, zéro remplissage.
- L'action garde le même mot du début à la fin : bouton **« Marquer livré »** → toast **« Livré »**.
- Pas de jargon système : « Intégrations », pas « Webhooks ». « Relancer le devis », pas « Trigger follow-up ».
- Vide = invitation : « Aucun livrable en retard. » plutôt qu'un écran neutre. Erreur = ce qui s'est passé + comment corriger, sans s'excuser.

---

## 8. Mouvement & micro-animations

Le mouvement sert la lecture (d'où vient un chiffre, où on en est), il n'amuse pas. **GPU-friendly** : on n'anime que `transform` et `opacity`. `prefers-reduced-motion` coupe tout sauf les fondus essentiels (et les compteurs sautent à la valeur finale).

### 8.1 Tokens de motion
```css
--t-fast:  120ms;  /* hover, press, focus */
--t-base:  200ms;  /* popovers, badges, bascules */
--t-slow:  320ms;  /* barres, listes */
--t-enter: 420ms;  /* entrées de section */

--ease-out:      cubic-bezier(.22, 1, .36, 1);   /* décélération · entrées */
--ease-standard: cubic-bezier(.4, 0, .2, 1);     /* va-et-vient */
--ease-emphar:   cubic-bezier(.34, 1.4, .5, 1);  /* léger rebond · thumb, curseur */
```

### 8.2 Recettes par interaction
1. **Entrée d'app / section** : `opacity 0→1` + `translateY(8px)→0`, `--t-enter` `--ease-out`. Grille de cartes : **stagger 60ms** par carte.
2. **Compteur (count-up)** : les `metric` s'animent `0 → valeur` (~700ms `--ease-out`) au montage ; sur changement de donnée, on anime *ancienne → nouvelle*. La mono tabulaire évite le reflow.
3. **Sparkline KPI** : barres `scaleY 0→1` depuis la base, stagger 30ms, `--t-slow`.
4. **Curseur d'objectif MRR** (signature) : le remplissage anime `width 0 → actuel` sur ~900ms `--ease-out` au chargement ; sur update, depuis la valeur précédente. Le repère « rythme requis » fait **un** pulse. Le badge vert/orange/rouge **cross-fade**.
5. **Survol carte** : `translateY(-2px)` + `--shadow-md`, `--t-base`. Press bouton : `scale(.98)`, `--t-fast`.
6. **Survol nav / ligne de table** : fond cross-fade `--t-fast`.
7. **Segmented control** : le thumb **glisse** en `transform` (`--ease-emphar`), il ne saute pas. Idem onglets.
8. **Tooltip / dropdown / menu** : `opacity` + `scale(.98→1)` + 4px de montée, `--t-base`, origine près du déclencheur.
9. **Toast** : montée + fondu à l'apparition, inverse à la sortie, auto-dismiss ~4s.
10. **Checkbox** : le ✓ se **dessine** (`stroke-dashoffset`), `--t-base`.
11. **Barres de graphe** (Vendu vs Livré) : la barre **réelle** pousse vers le haut au montage (stagger) ; la barre **fantôme** (le vendu/cible) reste fixe derrière.
12. **Bandeau IA** : l'étincelle scintille doucement (boucle lente) ; reflet diagonal au survol.
13. **Changement de valeur** : flash de fond très bref sur la cellule/badge qui change.

### 8.3 Implémentation
- **Micro-interactions** (hover, press, focus, cross-fade) → transitions CSS, avec les tokens ci-dessus.
- **Orchestration** (stagger d'entrée, count-up, glissement du thumb, réordonnancement de liste, curseur) → **Framer Motion** (`motion/react`) : `AnimatePresence`, `layout`, `useSpring`/`animate` pour les nombres.
- Partager les mêmes durées/easings entre CSS et JS (exposer les tokens, les lire en JS).
- `will-change: transform` uniquement sur l'élément animé et le temps de l'anim.
- **Reduced motion** :
  ```css
  @media (prefers-reduced-motion: reduce) {
    *, *::before, *::after {
      animation-duration: .001ms !important;
      transition-duration: .001ms !important;
    }
  }
  ```
  + côté JS, sauter les count-up et poser la valeur finale.

---

## 9. Éléments signature (l'audace, concentrée)

Deux composants qui n'existent que pour SiteFlow et portent tout le concept (réconciliation contrat↔livrable + objectif). C'est là qu'on met l'effort ; le reste reste sobre.

### 9.1 Barres « Vendu vs Livré »
Repris du *Revenue Breakdown* (barre réelle noire + barre fantôme grise). Ici :
- **Barre fantôme** (`--surface-sunken`) = quantité **vendue** (engagement du contrat).
- **Barre pleine** (`--ink`) = quantité **livrée** ce mois.
- D'un coup d'œil : l'écart entre les deux = ce qui reste à faire. Vert si livré ≥ vendu, ambre sinon.

### 9.2 Curseur d'objectif MRR (barre segmentée)
La progression vers 3 000 € est un **volume**, donc rendue en **segments verticaux** (pills `--r` ~3 px), pas en remplissage continu : segments atteints en `--ink`, restants en `--sunken`, qui **apparaissent en cascade** au montage. Un **repère** `--negative` marque le « rythme requis » (où tu devrais être à cette date). Badge d'état **vert / orange / rouge** selon l'avance. Monochrome assumé (on emprunte la *forme* segmentée à l'inspiration, pas son dégradé). C'est la première chose que l'œil doit trouver. Le détail (potentiel pipeline, légende complète, analyse IA) vit sur la page « Objectif MRR », pas dans la tuile.

---

## 10. À faire / à éviter

**Faire** · mono tabulaire pour tout chiffre · une couleur = un sens · filets avant ombres · animer `transform`/`opacity` seulement · focus visible · respecter reduced-motion.

**Éviter** · ombres colorées / glow · dégradés décoratifs · plus de 2 graisses par écran · couleur sans signification · animations qui ralentissent une tâche quotidienne · icônes sans label dans la nav.

---

## 11. Graphiques & règles d'affichage

- **Courbe pour une métrique unique qui progresse** (MRR dans le temps) : ligne lissée + aire très légère (`--ink` à ~6 %), tracé qui se **dessine** au montage. Une courbe lit une trajectoire vers un objectif mieux qu'une barre. Projection future = même ligne en pointillé `--ink-faint`.
- **Mosaïque de petits carrés pour les volumes / densité** (activité par jour, livrables par période, heatmap) : colonnes de carrés ~6 px, `--ink` rempli / `--sunken` vide. **Jamais de blocs pleins continus** · c'est le rendu de la réf, on le reproduit fidèlement.
- **Vendu vs livré** : barre pleine `--ink` (livré) devant barre fantôme `--sunken` (vendu). Ambre si livré < vendu. (Seul cas où on garde des barres pleines.)
- **Labels jamais sur deux lignes.** `white-space: nowrap` partout · badges, axes, légendes de colonne, cellules. Si ça déborde : réduire la taille, tronquer avec `…`, ou rendre la zone **scrollable** (tableaux étroits sur mobile). Jamais de retour à la ligne au milieu d'un label ou d'un badge.
- **Cartes du dashboard = simples. Une carte = une idée.** Le détail (légendes complètes, décomposition du pipeline, analyse IA, historique) vit sur la **page de détail de l'entité** (ex. page « Objectif MRR »), pas entassé dans la tuile du dashboard. La tuile montre l'essentiel + un lien « Détail → ».

---

_Document de travail · voir `style-guide.html` pour la version vivante et animée._
