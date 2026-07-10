"use client";

import { useActionState } from "react";
import { LogIn } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/forms/form-ui";
import { seConnecter } from "@/app/actions/auth";
import { initialFormState } from "@/lib/form";

// Formulaire de connexion admin. En cas de succès, l'action pose le cookie de
// session et redirige ; l'état ne revient donc que sur échec.
export function LoginForm({ next }: { next?: string }) {
  const [state, formAction, pending] = useActionState(seConnecter, initialFormState);

  return (
    <form action={formAction} className="space-y-5">
      {next ? <input type="hidden" name="next" value={next} /> : null}
      {state?.message ? (
        <p className="rounded-lg bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {state.message}
        </p>
      ) : null}
      <Field label="Email" htmlFor="email">
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="username"
          placeholder="vous@exemple.fr"
          autoFocus
          required
        />
      </Field>
      <Field label="Mot de passe" htmlFor="password">
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
        />
      </Field>
      <Button type="submit" className="w-full" disabled={pending}>
        <LogIn /> {pending ? "Connexion…" : "Se connecter"}
      </Button>
    </form>
  );
}
