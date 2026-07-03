"use client";

import { useState, useTransition } from "react";
import { MailCheck, MailX, Loader2, PlugZap, SendHorizontal } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { testerConnexionSmtp, envoyerMailTest } from "@/app/actions/prospection";

// Bandeau d'état SMTP + tests (connexion, mail de test à soi-même).
export function SmtpStatus({
  configured,
  expediteur,
}: {
  configured: boolean;
  expediteur: string;
}) {
  const [pending, start] = useTransition();
  const [action, setAction] = useState<"test" | "mail" | null>(null);

  function tester() {
    setAction("test");
    start(async () => {
      const res = await testerConnexionSmtp();
      if (res.ok) toast.success("Connexion SMTP OK.");
      else toast.error(res.error ?? "Connexion impossible.");
      setAction(null);
    });
  }

  function mailTest() {
    setAction("mail");
    start(async () => {
      const res = await envoyerMailTest();
      if (res.ok) toast.success(`Mail de test envoyé à ${expediteur}.`);
      else toast.error(res.error ?? "Envoi impossible.");
      setAction(null);
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-xl border bg-card px-4 py-3">
      {configured ? (
        <span className="inline-flex items-center gap-1.5 text-sm">
          <MailCheck className="size-4 text-positive-ink" />
          SMTP prêt · expéditeur{" "}
          <span className="font-medium">{expediteur}</span>
        </span>
      ) : (
        <span className="inline-flex items-center gap-1.5 text-sm text-warning-ink">
          <MailX className="size-4" />
          SMTP non configuré (variables <code>SMTP_*</code> dans <code>.env</code>)
        </span>
      )}
      <div className="ml-auto flex items-center gap-2">
        <Button variant="outline" size="sm" disabled={!configured || pending} onClick={tester}>
          {pending && action === "test" ? <Loader2 className="animate-spin" /> : <PlugZap />}
          Tester la connexion
        </Button>
        <Button variant="outline" size="sm" disabled={!configured || pending} onClick={mailTest}>
          {pending && action === "mail" ? <Loader2 className="animate-spin" /> : <SendHorizontal />}
          M&apos;envoyer un test
        </Button>
      </div>
    </div>
  );
}
