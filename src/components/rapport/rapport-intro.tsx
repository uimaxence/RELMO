"use client";

import { useState } from "react";
import { Sparkles, RefreshCw } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { actionIntroRapport } from "@/app/actions/ai";

// Intro du rapport : générée à la demande (DeepSeek), éditable, incluse à l'impression.
export function RapportIntro({
  clientId,
  periode,
  livres,
}: {
  clientId: string;
  periode: string;
  livres: string[];
}) {
  const [text, setText] = useState("");
  const [pending, setPending] = useState(false);

  async function generate() {
    setPending(true);
    const res = await actionIntroRapport(clientId, periode, livres);
    setPending(false);
    if (res.ok) setText(res.text);
    else toast.error(res.error);
  }

  if (!text) {
    return (
      <div className="print-hide">
        <Button variant="outline" size="sm" onClick={generate} disabled={pending}>
          <Sparkles className="text-brand" />
          {pending ? "Génération…" : "Générer l'intro (IA)"}
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {/* Version imprimée : texte simple. */}
      <p className="hidden whitespace-pre-wrap text-sm leading-relaxed print:block">
        {text}
      </p>
      {/* Version écran : éditable. */}
      <Textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        className="print-hide min-h-[110px] text-sm leading-relaxed"
      />
      <Button
        variant="ghost"
        size="sm"
        onClick={generate}
        disabled={pending}
        className="print-hide"
      >
        <RefreshCw className={pending ? "animate-spin" : ""} /> Régénérer
      </Button>
    </div>
  );
}
