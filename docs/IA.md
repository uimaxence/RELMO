# Couche IA de Relmo — réflexion & architecture

> Document de réflexion + référence d'implémentation pour la couche assistant.
> Complète [PROJET.md](PROJET.md) §5.2b (F14) et le principe « la donnée est l'actif ».
> Statut : socle livré (assistant de rédaction). F14 (copilote analytique) reste à l'horizon.

---

## 1. La question de départ

On veut que Relmo aide à **débloquer des clients** : rédiger des messages de
prospection, des relances de négo, des brouillons de devis, et enrichir la to-do
quotidienne. La question n'est pas « quel LLM est le meilleur » dans l'absolu,
mais **quel modèle pour quelle tâche, à quel coût**, sur un outil mono-utilisateur
où le volume d'appels est faible mais la qualité de rédaction compte.

## 2. Pourquoi pas (uniquement) Claude

Claude reste le meilleur pour la rédaction commerciale nuancée en français. Mais
sur un usage perso à petit volume, deux fournisseurs couvrent 90 % du besoin pour
une fraction du prix, et chacun a une **spécialité nette** :

| Besoin | Modèle retenu | Pourquoi ce choix |
|---|---|---|
| **Recherche** sur un prospect (secteur, site, contexte marché) | **Perplexity (Sonar)** | C'est sa raison d'être : réponse **ancrée sur le web en temps réel**. Un message de prospection personnalisé suppose de *savoir* qui on contacte — c'est le seul cas où la recherche change la donne. |
| **Génération de texte** (devis, négo, reformulation, accroches) | **DeepSeek (`deepseek-chat`)** | Très bon marché, qualité de rédaction FR largement suffisante pour un brouillon qu'on relit et édite. Le web n'apporte rien ici : c'est du copywriting + nos propres chiffres. |

> Principe de routage : **Perplexity quand il faut *aller chercher* de
> l'information, DeepSeek quand il faut *rédiger* à partir d'infos qu'on a déjà.**

Claude reste l'option « montée en gamme » si un jour la qualité d'un livrable
client (rapport F7, message à fort enjeu) le justifie. Le socle est conçu pour
qu'ajouter un 3ᵉ provider soit trivial (cf. §5).

## 3. Économie

Les deux API sont **compatibles OpenAI** (`/chat/completions`, auth Bearer) — aucun
SDK, juste un `fetch`. Ordres de grandeur (à vérifier sur les pages de prix
officielles, ça bouge) :

- **DeepSeek** : ~0,15–0,30 $ / M tokens en sortie. Un brouillon de devis ≈ 500
  tokens ⇒ **fraction de centime** par génération.
- **Perplexity Sonar** : ~1 $ / M tokens + un petit coût par requête de recherche
  (~5 $/1000 requêtes selon le palier).

Conséquence concrète : avec **50 € de crédit**, sur un usage mono-utilisateur
(quelques dizaines de générations par semaine), on tient **des mois**. Le budget
n'est pas le facteur limitant ; la qualité du *prompt* et du *contexte fourni* l'est.

## 4. Principes d'intégration (les garde-fous)

1. **À la demande, jamais en tâche de fond.** Aucune génération au chargement
   d'une page (coût + latence). L'IA se déclenche sur **clic explicite**. La to-do
   du jour reste produite par l'**algorithme** (déterministe, gratuit, fiable) ;
   l'IA vient seulement *enrichir* sur demande.
2. **L'IA propose, l'humain dispose.** Tout texte généré atterrit dans un champ
   **éditable** avec bouton copier/régénérer. On ne poste, n'envoie, ni n'enregistre
   rien automatiquement. C'est un brouillon, pas une décision.
3. **Dégradation propre.** Pas de clé configurée ⇒ message d'aide clair
   (« ajoute `DEEPSEEK_API_KEY` dans `.env` »), jamais de crash. L'app reste
   100 % fonctionnelle sans IA.
4. **Le contexte vient de la donnée structurée.** Les prompts sont nourris par les
   champs typés (secteur, MRR, historique d'interactions, motif de perte, pricing
   existant), pas par du texte libre. C'est exactement le pari de PROJET.md §8 :
   *un corpus propre rend l'IA utile ; branchée sur du flou, elle ne sort que du
   générique.* La couche assistant d'aujourd'hui est le **premier consommateur** de
   ce corpus — et un banc d'essai avant le copilote analytique F14.
5. **Frontière serveur.** Les clés restent côté serveur (server actions). Aucune
   clé n'atteint le navigateur. Les appels partent du runtime Next, pas du client.
6. **Confidentialité.** On envoie à un tiers le contexte nécessaire (nom, secteur,
   montants). Acceptable pour de la prospection ; à garder en tête si un jour des
   données client sensibles entrent dans le périmètre.

## 5. Architecture

```
src/lib/ai/
  providers.ts   # table des fournisseurs (baseUrl, clé env, modèle par défaut)
  client.ts      # chat() générique compatible OpenAI (fetch) + gestion d'erreur
  assistant.ts   # fonctions métier : chargent le contexte DB → prompt → routage
src/app/actions/
  ai.ts          # frontière "use server" : wrappers fins appelés par l'UI
src/components/ai/
  ai-generate-dialog.tsx  # dialog réutilisable (générer / éditer / copier / régénérer)
```

- **`chat()`** ne connaît pas le métier : il prend un provider + des messages et
  renvoie `{ ok, text }` ou `{ ok:false, error }`. Ajouter Claude = une ligne dans
  `providers.ts`.
- **`assistant.ts`** porte la connaissance métier : *quel* contexte charger, *quel*
  provider router, *quel* system prompt. C'est là qu'on itère la qualité.
- **`AiResult`** est un objet sérialisable : il traverse la frontière server→client
  sans friction (les actions le renvoient tel quel à la `dialog`).

### Routage par surface

| Surface (où) | Fonction | Provider |
|---|---|---|
| Fiche client → « Message de prospection » | `genererMessageProspection` | Perplexity |
| Fiche client → « Brouillon de devis » | `genererDevisBrouillon` | DeepSeek |
| Fiche client / pipeline → « Relance de négo » | `genererRelanceNego` | DeepSeek |
| To-do de la semaine → « Accroches de prospection » | `genererAccrochesProspection` | DeepSeek |
| Devis → drop d'un PDF → extraction des champs | `extraireDevisDepuisTexte` (texte via `unpdf`, mode JSON) | DeepSeek |

## 6. Lien avec F14 (copilote analytique, horizon)

L'assistant d'aujourd'hui **rédige** ; F14 **analysera et conseillera** (leviers
priorisés, objectifs adaptatifs, boucle d'expériences). Les deux partagent le même
socle `src/lib/ai`. La différence : F14 a besoin de **plusieurs mois de données
horodatées** (devis gagnés/perdus, sources, motifs de perte, churn) avant d'être
autre chose que du générique. En attendant, chaque interaction journalisée et
chaque motif de perte saisi **alimentent ce futur corpus**. On construit la couche
de rédaction maintenant, la couche d'analyse quand la donnée existe.

## 7. Configuration

```bash
# .env (jamais commité)
PERPLEXITY_API_KEY="pplx-..."
DEEPSEEK_API_KEY="sk-..."
```

Sans ces clés, les boutons IA restent visibles mais renvoient un message d'aide.
Voir `.env.example` pour le gabarit.
