// Fournisseurs LLM (cf. docs/IA.md §2 & §5). Tous compatibles OpenAI
// (`/chat/completions`, auth Bearer) → un seul client `fetch` les couvre tous.
// Ajouter un provider (ex. Claude) = ajouter une entrée ici, rien d'autre.

export type AiProvider = "perplexity" | "deepseek";

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
};

export function providerConfigured(provider: AiProvider): boolean {
  return Boolean(process.env[PROVIDERS[provider].envKey]);
}
