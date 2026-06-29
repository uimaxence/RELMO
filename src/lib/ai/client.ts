import { PROVIDERS, type AiProvider } from "@/lib/ai/providers";

// Client LLM générique (compatible OpenAI). Ne connaît rien du métier : il prend
// un provider + des messages et renvoie un résultat sérialisable (traverse la
// frontière server→client tel quel). Toute erreur est capturée → jamais de crash.

export type AiMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export type AiResult =
  | { ok: true; text: string; provider: AiProvider; model: string }
  | { ok: false; error: string };

type ChatOptions = {
  provider: AiProvider;
  messages: AiMessage[];
  model?: string;
  temperature?: number;
  maxTokens?: number;
  jsonMode?: boolean; // force une réponse JSON (extraction structurée)
};

export async function chat({
  provider,
  messages,
  model,
  temperature = 0.5,
  maxTokens = 900,
  jsonMode = false,
}: ChatOptions): Promise<AiResult> {
  const cfg = PROVIDERS[provider];
  const key = process.env[cfg.envKey];
  if (!key) {
    return {
      ok: false,
      error: `Clé ${cfg.label} absente. Ajoute ${cfg.envKey} dans .env pour activer cette fonction.`,
    };
  }

  const usedModel = model ?? cfg.defaultModel;

  try {
    const res = await fetch(`${cfg.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({
        model: usedModel,
        messages,
        temperature,
        max_tokens: maxTokens,
        ...(jsonMode ? { response_format: { type: "json_object" } } : {}),
      }),
      // Évite qu'un provider lent ne bloque l'UI indéfiniment.
      signal: AbortSignal.timeout(45_000),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      return {
        ok: false,
        error: `${cfg.label} a répondu ${res.status}. ${body.slice(0, 200)}`,
      };
    }

    const data = await res.json();
    const text: string | undefined = data?.choices?.[0]?.message?.content?.trim();
    if (!text) {
      return { ok: false, error: `Réponse ${cfg.label} vide.` };
    }

    return { ok: true, text, provider, model: data?.model ?? usedModel };
  } catch (e) {
    const reason = e instanceof Error ? e.message : "erreur inconnue";
    return { ok: false, error: `Échec d'appel ${cfg.label} : ${reason}` };
  }
}
