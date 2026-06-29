"use client";

import { useState, useTransition } from "react";
import { Link2, Copy, Check, RefreshCw, Power, ExternalLink } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { togglePortail, regenererToken } from "@/app/actions/portail";

export function PortailControl({
  clientId,
  actif,
  token,
  nbPhotos,
}: {
  clientId: string;
  actif: boolean;
  token: string | null;
  nbPhotos: number;
}) {
  // Lu une seule fois au montage côté client (pas d'effet → pas de cascade).
  const [origin] = useState(() =>
    typeof window !== "undefined" ? window.location.origin : "",
  );
  const [copied, setCopied] = useState(false);
  const [pending, startTransition] = useTransition();

  const url = token ? `${origin}/portail/${token}` : "";

  function toggle() {
    startTransition(async () => {
      await togglePortail(clientId);
      toast.success(actif ? "Portail désactivé." : "Portail activé.");
    });
  }

  function renew() {
    startTransition(async () => {
      await regenererToken(clientId);
      toast.success("Lien renouvelé (l'ancien ne marche plus).");
    });
  }

  async function copy() {
    await navigator.clipboard.writeText(url);
    setCopied(true);
    toast.success("Lien copié.");
    setTimeout(() => setCopied(false), 1500);
  }

  if (!actif) {
    return (
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-muted/30 px-4 py-3">
        <div className="flex items-center gap-2 text-sm">
          <Link2 className="size-4 text-muted-foreground" />
          <span className="text-muted-foreground">
            Portail client (dépôt de photos) désactivé.
          </span>
        </div>
        <Button size="sm" variant="outline" onClick={toggle} disabled={pending}>
          <Power /> Activer le portail
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-2 rounded-xl border bg-muted/30 px-4 py-3">
      <div className="flex items-center justify-between gap-2">
        <span className="inline-flex items-center gap-2 text-sm font-medium">
          <Link2 className="size-4 text-brand" /> Portail client actif · {nbPhotos}{" "}
          photo{nbPhotos > 1 ? "s" : ""}
        </span>
        <div className="flex gap-1">
          <Button size="sm" variant="ghost" onClick={renew} disabled={pending}>
            <RefreshCw /> Renouveler
          </Button>
          <Button size="sm" variant="ghost" onClick={toggle} disabled={pending}>
            <Power /> Désactiver
          </Button>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Input
          readOnly
          value={url}
          suppressHydrationWarning
          className="h-8 font-mono text-xs"
        />
        <Button size="sm" variant="outline" onClick={copy} disabled={!url}>
          {copied ? <Check /> : <Copy />}
        </Button>
        <Button asChild size="sm" variant="outline" disabled={!url}>
          <a href={url} target="_blank" rel="noreferrer" aria-label="Ouvrir">
            <ExternalLink />
          </a>
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        Lien magique sans mot de passe — à envoyer au client. Renouvelez-le pour
        révoquer l&apos;accès.
      </p>
    </div>
  );
}
