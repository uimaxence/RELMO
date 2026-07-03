"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import {
  Send,
  Loader2,
  Check,
  AlertTriangle,
  ChevronDown,
  Square,
  Play,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  envoyerMailProspect,
  updateEmailProspect,
} from "@/app/actions/prospection";
import { emailValide, extraireObjet } from "@/lib/prospection/email";

export type CampagneRow = {
  id: string;
  nom: string;
  meta: string; // activité · ville
  email: string;
  accroche: string;
};

type Statut = "idle" | "sending" | "sent" | "error";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export function CampagneRunner({
  prospects,
  configured,
  delaiSec,
  plafond,
  expediteur,
}: {
  prospects: CampagneRow[];
  configured: boolean;
  delaiSec: number;
  plafond: number;
  expediteur: string;
}) {
  const [rows, setRows] = useState(prospects);
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(prospects.filter((p) => emailValide(p.email)).map((p) => p.id)),
  );
  const [statut, setStatut] = useState<Record<string, Statut>>({});
  const [erreur, setErreur] = useState<Record<string, string>>({});
  const [expandId, setExpandId] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const cancelRef = useRef(false);
  const [, startPersist] = useTransition();

  const setRow = (id: string, patch: Partial<CampagneRow>) =>
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, ...patch } : r)));

  const toggle = (id: string) =>
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  // File d'envoi : sélectionnés + email valide + pas déjà envoyés, plafonnée.
  const file = useMemo(
    () =>
      rows.filter(
        (r) => selected.has(r.id) && emailValide(r.email) && statut[r.id] !== "sent",
      ),
    [rows, selected, statut],
  );
  const aEnvoyer = Math.min(file.length, plafond);

  function persistEmail(id: string, email: string) {
    startPersist(async () => {
      const res = await updateEmailProspect(id, email);
      if (!res.ok) toast.error(res.error ?? "Email non enregistré.");
    });
  }

  async function lancer() {
    setConfirmOpen(false);
    const ids = file.slice(0, plafond).map((r) => r.id);
    if (!ids.length) return;
    cancelRef.current = false;
    setRunning(true);
    setProgress({ done: 0, total: ids.length });
    let ok = 0;
    for (let i = 0; i < ids.length; i++) {
      if (cancelRef.current) break;
      const id = ids[i];
      const row = rows.find((r) => r.id === id)!;
      setStatut((s) => ({ ...s, [id]: "sending" }));
      const res = await envoyerMailProspect(id, row.accroche);
      if (res.ok) {
        ok++;
        setStatut((s) => ({ ...s, [id]: "sent" }));
        setSelected((s) => {
          const n = new Set(s);
          n.delete(id);
          return n;
        });
      } else {
        setStatut((s) => ({ ...s, [id]: "error" }));
        setErreur((e) => ({ ...e, [id]: res.error ?? "Échec." }));
      }
      setProgress({ done: i + 1, total: ids.length });
      if (i < ids.length - 1 && !cancelRef.current) await sleep(delaiSec * 1000);
    }
    setRunning(false);
    toast[ok ? "success" : "error"](
      `Campagne ${cancelRef.current ? "interrompue" : "terminée"} : ${ok} mail${ok > 1 ? "s" : ""} envoyé${ok > 1 ? "s" : ""}.`,
    );
  }

  if (rows.length === 0) {
    return (
      <Card className="py-10 text-center text-sm text-muted-foreground">
        Aucun prospect prêt à contacter. Audite des prospects (accroche générée) et
        renseigne leur email pour lancer une campagne.
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {/* Barre d'action */}
      <div className="flex flex-wrap items-center gap-3 rounded-xl border bg-card px-4 py-3">
        <div className="text-sm">
          <span className="font-mono font-medium tabular-nums">{aEnvoyer}</span>{" "}
          <span className="text-muted-foreground">
            mail{aEnvoyer > 1 ? "s" : ""} à envoyer
            {file.length > plafond ? ` (plafond ${plafond}/lancement)` : ""}
          </span>
        </div>
        <div className="ml-auto flex items-center gap-2">
          {running ? (
            <>
              <span className="font-mono text-sm tabular-nums text-muted-foreground">
                {progress.done}/{progress.total}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  cancelRef.current = true;
                }}
              >
                <Square /> Stopper
              </Button>
            </>
          ) : (
            <Button
              size="sm"
              disabled={!configured || aEnvoyer === 0}
              onClick={() => setConfirmOpen(true)}
            >
              <Play /> Lancer la campagne
            </Button>
          )}
        </div>
      </div>

      {!configured ? (
        <p className="text-xs text-warning-ink">
          SMTP non configuré — renseigne les variables <code>SMTP_*</code> dans{" "}
          <code>.env</code> pour activer l&apos;envoi.
        </p>
      ) : null}

      {/* Liste */}
      <div className="space-y-2">
        {rows.map((r) => {
          const st = statut[r.id] ?? "idle";
          const valide = emailValide(r.email);
          const objet = extraireObjet(r.accroche).objet;
          const checked = selected.has(r.id);
          return (
            <Card key={r.id} className="p-3">
              <div className="flex items-start gap-3">
                <input
                  type="checkbox"
                  className="mt-1 size-4 accent-[var(--accent-brand)]"
                  checked={checked}
                  disabled={!valide || running || st === "sent"}
                  onChange={() => toggle(r.id)}
                  aria-label={`Inclure ${r.nom}`}
                />
                <div className="min-w-0 flex-1 space-y-1.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{r.nom}</span>
                    <span className="text-xs text-muted-foreground">{r.meta}</span>
                    <StatutPill st={st} err={erreur[r.id]} />
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <Input
                      value={r.email}
                      onChange={(e) => setRow(r.id, { email: e.target.value })}
                      onBlur={(e) => persistEmail(r.id, e.target.value)}
                      placeholder="email@prospect.fr"
                      className={`h-8 w-64 text-sm ${
                        r.email && !valide ? "border-destructive" : ""
                      }`}
                      disabled={running || st === "sent"}
                    />
                    <button
                      type="button"
                      onClick={() => setExpandId(expandId === r.id ? null : r.id)}
                      className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                    >
                      <ChevronDown
                        className={`size-3.5 transition-transform ${expandId === r.id ? "rotate-180" : ""}`}
                      />
                      {objet ? `Objet : ${objet}` : "⚠ objet manquant"}
                    </button>
                  </div>

                  {expandId === r.id ? (
                    <Textarea
                      value={r.accroche}
                      onChange={(e) => setRow(r.id, { accroche: e.target.value })}
                      className="min-h-[180px] text-sm leading-relaxed"
                      disabled={running || st === "sent"}
                    />
                  ) : null}
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      {/* Confirmation */}
      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Lancer la campagne ?</DialogTitle>
            <DialogDescription>
              {aEnvoyer} mail{aEnvoyer > 1 ? "s" : ""} envoyé{aEnvoyer > 1 ? "s" : ""}{" "}
              depuis <strong>{expediteur}</strong>, un toutes les {delaiSec}s. Garde
              cet onglet ouvert pendant l&apos;envoi. Chaque prospect passe en
              « contacté » avec une relance planifiée.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmOpen(false)}>
              Annuler
            </Button>
            <Button onClick={lancer}>
              <Send /> Envoyer {aEnvoyer} mail{aEnvoyer > 1 ? "s" : ""}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function StatutPill({ st, err }: { st: Statut; err?: string }) {
  if (st === "sending")
    return (
      <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
        <Loader2 className="size-3 animate-spin" /> Envoi…
      </span>
    );
  if (st === "sent")
    return (
      <span className="inline-flex items-center gap-1 text-xs text-positive-ink">
        <Check className="size-3" /> Envoyé
      </span>
    );
  if (st === "error")
    return (
      <span
        className="inline-flex items-center gap-1 text-xs text-destructive"
        title={err}
      >
        <AlertTriangle className="size-3" /> {err === "EMAIL_INVALIDE" ? "Email invalide" : "Échec"}
      </span>
    );
  return null;
}
