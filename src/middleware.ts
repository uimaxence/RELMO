import { NextResponse, type NextRequest } from "next/server";

import { SESSION_COOKIE, verifierJetonSession } from "@/lib/auth";

// Verrouille le cockpit : tout est privé sauf le portail client (lien magique),
// la page de connexion et les routes cron (protégées par CRON_SECRET). Sans
// session valide → redirection vers /connexion (fail closed : si les variables
// ADMIN_* manquent, personne n'entre, le formulaire de connexion l'explique).
export async function middleware(request: NextRequest) {
  const ok = await verifierJetonSession(
    request.cookies.get(SESSION_COOKIE)?.value,
  );
  if (ok) return NextResponse.next();

  const url = request.nextUrl.clone();
  url.pathname = "/connexion";
  url.search =
    request.nextUrl.pathname === "/"
      ? ""
      : `?next=${encodeURIComponent(request.nextUrl.pathname)}`;
  return NextResponse.redirect(url);
}

export const config = {
  // Tout sauf : portail public, page de connexion, crons, assets Next et
  // fichiers statiques (tout chemin contenant un point).
  matcher: ["/((?!portail|connexion|api/cron|_next|.*\\..*).*)"],
};
