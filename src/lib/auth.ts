// Authentification admin mono-utilisateur (cockpit privé). Un seul compte,
// défini en variables d'environnement : ADMIN_EMAIL, ADMIN_PASSWORD, AUTH_SECRET
// (cf. .env.example). Pas de table utilisateur : la session est un cookie signé
// HMAC-SHA256 au format "expiration.signature". Web Crypto uniquement, pour
// fonctionner à la fois dans le middleware (edge) et côté Node.

export const SESSION_COOKIE = "relmo_session";
export const SESSION_DUREE_S = 30 * 24 * 3600; // 30 jours

export function authConfigured(): boolean {
  return Boolean(
    process.env.ADMIN_EMAIL && process.env.ADMIN_PASSWORD && process.env.AUTH_SECRET,
  );
}

async function signer(payload: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(process.env.AUTH_SECRET ?? ""),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function creerJetonSession(): Promise<string> {
  const exp = Date.now() + SESSION_DUREE_S * 1000;
  return `${exp}.${await signer(String(exp))}`;
}

export async function verifierJetonSession(
  jeton: string | undefined,
): Promise<boolean> {
  if (!jeton || !process.env.AUTH_SECRET) return false;
  const [expStr, sig] = jeton.split(".");
  const exp = Number(expStr);
  if (!Number.isFinite(exp) || exp < Date.now() || !sig) return false;

  const attendu = await signer(expStr);
  if (sig.length !== attendu.length) return false;
  // Comparaison à temps constant (pas de retour anticipé à la 1re différence).
  let diff = 0;
  for (let i = 0; i < attendu.length; i++)
    diff |= sig.charCodeAt(i) ^ attendu.charCodeAt(i);
  return diff === 0;
}
