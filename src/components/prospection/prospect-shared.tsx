"use client";

import { useState, useTransition } from "react";
import {
  Mail,
  Loader2,
  Check,
  Copy,
  MessageCircle,
  Rocket,
  AlertTriangle,
  MailX,
  Inbox,
  MessageSquare,
  BellRing,
  Search as SearchIcon,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { labelOf, PROSPECT_STATUTS, CANAUX_CONTACT } from "@/lib/constants";
import { metierByCle } from "@/lib/prospection/metiers-partenaires";
import { updateEmailProspect } from "@/app/actions/prospection";
import { emailValide } from "@/lib/prospection/email";
import type { ProspectRow } from "./prospect-row";

// Éléments de présentation partagés entre la liste et la fiche latérale.

function initiales(nom: string): string {
  return nom
    .replace(/[^\p{L}\s]/gu, "")
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
}

export function Avatar({ nom, size = "size-9" }: { nom: string; size?: string }) {
  return (
    <div
      className={`flex ${size} shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold text-muted-foreground ring-1 ring-border`}
    >
      {initiales(nom) || "?"}
    </div>
  );
}

export function ScorePill({ score, big = false }: { score: number; big?: boolean }) {
  const cls =
    score >= 65
      ? "bg-positive-bg text-positive-ink"
      : score >= 40
        ? "bg-warning-bg text-warning-ink"
        : "bg-muted text-muted-foreground";
  const size = big ? "px-3 py-1 text-lg" : "min-w-9 px-2 py-0.5 text-sm";
  return (
    <span
      className={`inline-flex items-center justify-center rounded-full font-mono font-semibold tabular-nums ${size} ${cls}`}
    >
      {score}
    </span>
  );
}

// Badge du filtre en or : la qualification structurée (chaud / tiède / à écarter).
const TIER_STYLE: Record<string, { cls: string; label: string }> = {
  chaud: { cls: "bg-positive-bg text-positive-ink", label: "Chaud" },
  tiede: { cls: "bg-warning-bg text-warning-ink", label: "Tiède" },
  drop: { cls: "bg-muted text-muted-foreground", label: "À écarter" },
};

export function TierBadge({ tier, total }: { tier: string; total: number | null }) {
  const s = TIER_STYLE[tier] ?? TIER_STYLE.drop;
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${s.cls}`}>
      {s.label}
      {total != null ? <span className="font-mono tabular-nums opacity-70">{total}/8</span> : null}
    </span>
  );
}

function SousScore({ label, note, value }: { label: string; note: string; value: number | null }) {
  const cls =
    value === 2 ? "bg-positive-bg text-positive-ink" : value === 1 ? "bg-warning-bg text-warning-ink" : "bg-muted text-muted-foreground";
  return (
    <div className="flex items-center justify-between gap-2 rounded-md border px-2.5 py-1.5">
      <div className="min-w-0">
        <div className="text-xs font-medium">{label}</div>
        <div className="truncate text-[11px] text-muted-foreground">{note}</div>
      </div>
      <span className={`shrink-0 rounded px-1.5 py-0.5 font-mono text-xs font-semibold tabular-nums ${cls}`}>
        {value != null ? `${value}/2` : "—"}
      </span>
    </div>
  );
}

// Détail du filtre en or dans la fiche : les 4 signaux + le gate besoin.
export function FiltreBreakdown({ p }: { p: ProspectRow }) {
  if (p.filtreTier == null) return null;
  const pro = p.segment === "pro";
  return (
    <div className="space-y-2 rounded-lg border p-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-muted-foreground">Filtre en or{pro ? " · Pro" : ""}</span>
        <TierBadge tier={p.filtreTier} total={p.filtreTotal} />
      </div>
      {p.filtreBesoin === false ? (
        <p className="rounded-md bg-muted px-2.5 py-1.5 text-[11px] text-muted-foreground">
          {pro
            ? "Besoin ROI absent (ni trafic payé, ni produit complexe) : écarté quel que soit le reste."
            : "Besoin de niche faible : le prospect est écarté quel que soit le reste du score."}
        </p>
      ) : null}
      <div className="grid gap-1.5 sm:grid-cols-2">
        <SousScore label="Potentiel éco." note={pro ? "Levée / effectif financé" : "Peut payer un récurrent"} value={p.filtrePotentiel} />
        <SousScore label={pro ? "Opportunité" : "Problème"} note={pro ? "Sous-performance / conversion" : "Défauts factuels du site"} value={p.filtreProbleme} />
        <SousScore label="Croissance" note="Signaux d'investissement" value={p.filtreCroissance} />
        <SousScore label="Accès" note="Joindre le décideur" value={p.filtreAcces} />
      </div>
      {p.signauxCroissance ? (
        <div className="flex flex-wrap gap-1">
          {p.signauxCroissance.split(" • ").map((s, i) => (
            <Badge key={i} variant="secondary" className="font-normal">
              {s}
            </Badge>
          ))}
        </div>
      ) : null}
      {p.filtreTrace ? <p className="text-[11px] leading-relaxed text-muted-foreground">{p.filtreTrace}</p> : null}
    </div>
  );
}

// E-mail éditable en ligne (saisie/correction de l'adresse avant la file d'envoi).
export function EmailInline({ id, email }: { id: string; email: string | null }) {
  const [val, setVal] = useState(email ?? "");
  const [saved, setSaved] = useState(false);
  const [pending, start] = useTransition();

  function save() {
    const clean = val.trim();
    if (clean === (email ?? "")) return;
    start(async () => {
      const res = await updateEmailProspect(id, clean);
      if (res.ok) {
        toast.success("E-mail enregistré.");
        setSaved(true);
        setTimeout(() => setSaved(false), 1500);
      } else {
        toast.error(res.error ?? "E-mail invalide.");
      }
    });
  }

  const invalide = val.trim() !== "" && !emailValide(val);
  return (
    <span className="inline-flex items-center gap-1">
      <Mail className="size-3 text-muted-foreground" />
      <input
        value={val}
        onChange={(e) => setVal(e.target.value)}
        onBlur={save}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            (e.target as HTMLInputElement).blur();
          }
        }}
        placeholder="ajouter un e-mail"
        className={`w-44 border-b bg-transparent pb-0.5 text-xs outline-none focus:border-foreground ${
          invalide ? "border-destructive" : "border-border"
        }`}
      />
      {pending ? <Loader2 className="size-3 animate-spin" /> : saved ? <Check className="size-3 text-positive-ink" /> : null}
    </span>
  );
}

export function CanalIcon({ canal }: { canal: string }) {
  // lucide n'expose plus les icônes de marque : icône DM générique pour les
  // messageries (LinkedIn/Instagram), enveloppe pour l'e-mail.
  if (canal === "linkedin" || canal === "instagram") return <MessageCircle className="size-3" />;
  return <Mail className="size-3" />;
}

export function StatutTags({ p }: { p: ProspectRow }) {
  return (
    <div className="flex flex-wrap items-center gap-1">
      <Badge variant={p.statut === "contacte" || p.statut === "converti" ? "default" : "secondary"} className="font-normal">
        {labelOf(PROSPECT_STATUTS, p.statut)}
      </Badge>
      {p.cible === "partenaire" ? (
        <Badge variant="outline" className="font-normal text-muted-foreground">
          {p.metier ? (metierByCle(p.metier)?.label ?? p.metier) : "Partenaire"}
        </Badge>
      ) : p.segment === "pro" ? (
        <Badge className="gap-1 border-accent-brand/30 bg-accent-brand-bg font-normal text-accent-brand">
          <Rocket className="size-3" /> Pro
        </Badge>
      ) : null}
      {p.flagConcurrent ? (
        <Badge className="gap-1 border-destructive/30 bg-destructive/10 font-normal text-destructive">
          <AlertTriangle className="size-3" /> Concurrent
        </Badge>
      ) : null}
      {p.flagAQualifier ? (
        <Badge className="gap-1 border-warning-ink/30 bg-warning-bg font-normal text-warning-ink">
          <SearchIcon className="size-3" /> À qualifier
        </Badge>
      ) : null}
      {!emailValide(p.email) && ["nouveau", "a_contacter"].includes(p.statut) ? (
        <Badge className="gap-1 border-warning-ink/30 bg-warning-bg font-normal text-warning-ink">
          <MailX className="size-3" /> Sans e-mail
        </Badge>
      ) : null}
      {p.statut === "a_contacter" ? (
        <Badge className="gap-1 border-accent-brand/30 bg-accent-brand-bg font-normal text-accent-brand">
          <Inbox className="size-3" /> En file
        </Badge>
      ) : null}
      {p.canalContact ? (
        <Badge variant="outline" className="gap-1 font-normal text-muted-foreground">
          <CanalIcon canal={p.canalContact} /> {labelOf(CANAUX_CONTACT, p.canalContact)}
        </Badge>
      ) : p.messageEnvoye ? (
        <Badge variant="outline" className="gap-1 font-normal text-muted-foreground">
          <Mail className="size-3" /> Contacté
        </Badge>
      ) : null}
      {p.reponduLeFr ? (
        <Badge className="gap-1 border-positive-ink/30 bg-positive-bg font-normal text-positive-ink">
          <MessageSquare className="size-3" /> Répondu
        </Badge>
      ) : p.relanceDue ? (
        <Badge className="gap-1 border-warning-ink/30 bg-warning-bg font-normal text-warning-ink">
          <BellRing className="size-3" /> Relance
        </Badge>
      ) : null}
    </div>
  );
}

export function Accroche({ titre, texte }: { titre: string; texte: string }) {
  const [done, setDone] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(texte);
      setDone(true);
      toast.success("Copié.");
      setTimeout(() => setDone(false), 1500);
    } catch {
      toast.error("Copie impossible.");
    }
  }
  return (
    <div className="space-y-1.5 rounded-lg border border-border bg-muted/40 p-3">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{titre}</p>
        <Button type="button" variant="ghost" size="sm" onClick={copy}>
          {done ? <Check /> : <Copy />} Copier
        </Button>
      </div>
      <p className="whitespace-pre-wrap text-sm leading-relaxed">{texte}</p>
    </div>
  );
}
