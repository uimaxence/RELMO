"use server";

import { createHash, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import {
  SESSION_COOKIE,
  SESSION_DUREE_S,
  creerJetonSession,
  authConfigured,
} from "@/lib/auth";
import type { FormState } from "@/lib/form";

// Comparaison à temps constant : on hache d'abord (longueurs égalisées, sinon
// timingSafeEqual jette quand les tailles diffèrent).
function memeSecret(a: string, b: string): boolean {
  return timingSafeEqual(
    createHash("sha256").update(a).digest(),
    createHash("sha256").update(b).digest(),
  );
}

export async function seConnecter(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  if (!authConfigured())
    return {
      ok: false,
      message:
        "Connexion non configurée : renseigne ADMIN_EMAIL, ADMIN_PASSWORD et AUTH_SECRET dans les variables d'environnement.",
    };

  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const okEmail = memeSecret(
    email,
    (process.env.ADMIN_EMAIL ?? "").trim().toLowerCase(),
  );
  const okPassword = memeSecret(password, process.env.ADMIN_PASSWORD ?? "");

  if (!okEmail || !okPassword) {
    // Freine la force brute (mono-utilisateur : pas besoin de plus).
    await new Promise((r) => setTimeout(r, 800));
    return { ok: false, message: "Email ou mot de passe incorrect." };
  }

  (await cookies()).set(SESSION_COOKIE, await creerJetonSession(), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_DUREE_S,
  });

  // Retour vers la page demandée avant la redirection (chemin interne only).
  const next = String(formData.get("next") ?? "");
  redirect(next.startsWith("/") && !next.startsWith("//") ? next : "/");
}

export async function seDeconnecter(): Promise<void> {
  (await cookies()).delete(SESSION_COOKIE);
  redirect("/connexion");
}
