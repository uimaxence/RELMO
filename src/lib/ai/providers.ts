// Fournisseurs LLM (cf. docs/IA.md §2 & §5). Tous compatibles OpenAI
// (`/chat/completions`, auth Bearer) → un seul client `fetch` les couvre tous.
// Ajouter un provider (ex. Claude) = ajouter une entrée ici, rien d'autre.

export type AiProvider = "perplexity" | "deepseek" | "gemini";

type ProviderConfig = {
  label: string;
  baseUrl: string;
  envKey: string;
  defaultModel: string;
};

export const PROVIDERS: Record<AiProvider, ProviderConfig> = {
  // Recherche ancrée sur le web temps réel → personnalisation prospect.
  perplexity: {
    label: "Perplexity",
    baseUrl: "https://api.perplexity.ai",
    envKey: "PERPLEXITY_API_KEY",
    defaultModel: "sonar",
  },
  // Génération de texte bon marché → devis, négo, reformulations.
  deepseek: {
    label: "DeepSeek",
    baseUrl: "https://api.deepseek.com",
    envKey: "DEEPSEEK_API_KEY",
    defaultModel: "deepseek-chat",
  },
  // Vision bon marché (endpoint compatible OpenAI) → analyse du VISUEL d'un site
  // prospect (design daté/moderne) à partir d'une capture d'écran.
  gemini: {
    label: "Gemini",
    baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai",
    envKey: "GEMINI_API_KEY",
    // Flash-Lite « latest » : alias (jamais déprécié) ET non-« thinking » — un
    // modèle thinking consomme le budget de tokens en raisonnement et tronque le
    // JSON. Lite = réponse complète, le moins cher, suffisant pour juger un visuel.
    defaultModel: "gemini-flash-lite-latest",
  },
};

export function providerConfigured(provider: AiProvider): boolean {
  return Boolean(process.env[PROVIDERS[provider].envKey]);
}
