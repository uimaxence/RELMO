import type { Metadata } from "next";

import { LoginForm } from "@/components/login-form";

export const metadata: Metadata = { title: "Connexion · Relmo" };

// Page de connexion admin (hors du chrome de l'app : pas de sidebar).
// Le portail client (/portail/[token]) reste public, lui.
export default async function ConnexionPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 px-4">
      <div className="w-full max-w-sm space-y-6 rounded-2xl border bg-background p-6">
        <div className="flex items-center gap-2">
          <span className="flex size-8 items-center justify-center rounded-md bg-accent-brand text-sm font-bold text-white">
            R
          </span>
          <div>
            <p className="font-heading font-semibold tracking-tight">Relmo</p>
            <p className="text-xs text-muted-foreground">Espace privé</p>
          </div>
        </div>
        <LoginForm next={next} />
      </div>
    </div>
  );
}
