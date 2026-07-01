"use client";

import { useState, useTransition } from "react";
import {
  Sparkles,
  Loader2,
  MoreHorizontal,
  UserPlus,
  Mail,
  Phone,
  Copy,
  Check,
  ExternalLink,
  Flag,
  Archive,
  AlertTriangle,
  Send,
  BellRing,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { labelOf, PROSPECT_STATUTS } from "@/lib/constants";
import {
  auditerUnProspect,
  convertirEnClient,
  changerStatutProspect,
  marquerContacte,
  marquerRelanceFaite,
  annulerProspect,
} from "@/app/actions/prospection";

export type ProspectRow = {
  id: string;
  nom: string;
  site: string | null;
  ville: string | null;
  activite: string | null;
  telephone: string | null;
  email: string | null;
  statutAudit: string;
  score: number | null;
  design: string | null;
  anciennete: string | null;
  pointsFaibles: string | null;
  accrocheEmail: string | null;
  accrocheLinkedin: string | null;
  dirigeant: string | null;
  linkedin: string | null;
  note: string | null;
  statut: string;
  messageEnvoye: string | null;
  contacteLeFr: string | null;
  relanceLeFr: string | null;
  relanceDue: boolean;
  nbRelances: number;
};

function scoreTone(score: number | null): string {
  if (score == null) return "text-muted-foreground";
  if (score >= 65) return "text-positive-ink";
  if (score >= 40) return "text-warning-ink";
  return "text-muted-foreground";
}

export function ProspectTable({ prospects }: { prospects: ProspectRow[] }) {
  if (prospects.length === 0) {
    return (
      <Card className="py-12 text-center text-sm text-muted-foreground">
        Aucun prospect ici. Lance une recherche ou importe un CSV pour commencer.
      </Card>
    );
  }

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {prospects.map((p) => (
        <ProspectCard key={p.id} p={p} />
      ))}
    </div>
  );
}

function ProspectCard({ p }: { p: ProspectRow }) {
  const [pending, start] = useTransition();
  const [mailOpen, setMailOpen] = useState(false);
  const [annulerOpen, setAnnulerOpen] = useState(false);

  function auditer() {
    start(async () => {
      const res = await auditerUnProspect(p.id);
      if (res.ok) toast.success(`Audité — score ${res.score ?? "n/d"}.`);
      else toast.error(res.error ?? "Échec de l'audit.");
    });
  }

  function convertir() {
    start(async () => {
      const res = await convertirEnClient(p.id);
      if (res.ok) toast.success(`« ${p.nom} » ajouté aux clients (prospect).`);
      else toast.error(res.error ?? "Conversion impossible.");
    });
  }

  function setStatut(statut: string) {
    start(async () => {
      await changerStatutProspect(p.id, statut);
      toast.success("Statut mis à jour.");
    });
  }

  function relanceFaite() {
    start(async () => {
      await marquerRelanceFaite(p.id);
      toast.success("Relance enregistrée — prochaine dans 5 jours.");
    });
  }

  const audite = p.statutAudit === "ok" || p.statutAudit === "aucun_site";
  const enErreur = p.statutAudit === "erreur";
  const contacte = p.statut === "contacte";

  return (
    <Card
      className={
        p.statut === "ecarte"
          ? "opacity-60"
          : p.relanceDue
            ? "ring-1 ring-warning-ink/40"
            : undefined
      }
    >
      <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
        <div className="min-w-0 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-semibold">{p.nom}</h3>
            {p.statut !== "nouveau" ? (
              <Badge variant="secondary" className="font-normal">
                {labelOf(PROSPECT_STATUTS, p.statut)}
              </Badge>
            ) : null}
            {p.relanceDue ? (
              <Badge className="border-warning-ink/30 bg-warning-bg font-normal text-warning-ink">
                <BellRing className="size-3" /> Relance due
              </Badge>
            ) : null}
          </div>
          <p className="text-xs text-muted-foreground">
            {[p.activite, p.ville].filter(Boolean).join(" · ") || "—"}
            {p.site ? (
              <>
                {" · "}
                <a
                  href={p.site}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-0.5 hover:underline"
                >
                  site <ExternalLink className="size-3" />
                </a>
              </>
            ) : (
              " · sans site"
            )}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {p.score != null ? (
            <div className="text-right">
              <div className={`font-mono text-2xl font-medium tabular-nums ${scoreTone(p.score)}`}>
                {p.score}
              </div>
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                / 100
              </div>
            </div>
          ) : null}
          <ActionsMenu
            p={p}
            audite={audite}
            pending={pending}
            onConvertir={convertir}
            onAuditer={auditer}
            onStatut={setStatut}
            onAnnuler={() => setAnnulerOpen(true)}
          />
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        {!audite ? (
          <div className="space-y-2">
            {enErreur ? (
              <p className="flex items-start gap-1.5 text-xs text-warning-ink">
                <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
                <span>Audit en échec{p.note ? ` : ${p.note}` : ""}. Réessaie.</span>
              </p>
            ) : (
              <p className="text-xs text-muted-foreground">Pas encore audité.</p>
            )}
            <Button variant="outline" size="sm" onClick={auditer} disabled={pending}>
              {pending ? <Loader2 className="animate-spin" /> : <Sparkles className="text-brand" />}
              {enErreur ? "Ré-auditer" : "Auditer"}
            </Button>
          </div>
        ) : (
          <>
            {p.design || p.anciennete ? (
              <div className="space-y-0.5 text-sm text-muted-foreground">
                {p.design ? <p>{p.design}</p> : null}
                {p.anciennete ? <p>{p.anciennete}</p> : null}
              </div>
            ) : null}

            {p.pointsFaibles ? (
              <div className="flex flex-wrap gap-1.5">
                {p.pointsFaibles.split(" • ").map((pf, i) => (
                  <Badge key={i} variant="secondary" className="font-normal">
                    {pf}
                  </Badge>
                ))}
              </div>
            ) : null}

            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
              {p.email ? (
                <a href={`mailto:${p.email}`} className="inline-flex items-center gap-1 hover:underline">
                  <Mail className="size-3" /> {p.email}
                </a>
              ) : null}
              {p.telephone ? (
                <span className="inline-flex items-center gap-1 text-muted-foreground">
                  <Phone className="size-3" /> {p.telephone}
                </span>
              ) : null}
              {p.dirigeant ? (
                <span className="text-muted-foreground">
                  {p.dirigeant}
                  {p.linkedin ? (
                    <>
                      {" · "}
                      <a
                        href={p.linkedin}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-brand hover:underline"
                      >
                        LinkedIn
                      </a>
                    </>
                  ) : null}
                </span>
              ) : null}
            </div>

            {/* Accroches (masquées une fois contacté pour alléger) */}
            {!contacte && p.accrocheEmail ? (
              <Accroche titre="Message e-mail" texte={p.accrocheEmail} />
            ) : null}
            {!contacte && p.accrocheLinkedin ? (
              <Accroche titre="Message LinkedIn" texte={p.accrocheLinkedin} />
            ) : null}

            {/* Pipeline de suivi */}
            {contacte ? (
              <SuiviContact p={p} pending={pending} onRelance={relanceFaite} />
            ) : (
              <div className="flex flex-wrap gap-2">
                <Button size="sm" onClick={() => setMailOpen(true)} disabled={pending}>
                  <Send /> Mail envoyé
                </Button>
                {p.statut !== "converti" ? (
                  <Button variant="outline" size="sm" onClick={convertir} disabled={pending}>
                    <UserPlus /> Convertir en client
                  </Button>
                ) : null}
              </div>
            )}
          </>
        )}
      </CardContent>

      <MailEnvoyeDialog
        open={mailOpen}
        onOpenChange={setMailOpen}
        prospectId={p.id}
        nom={p.nom}
        defaultMessage={p.accrocheEmail ?? ""}
      />
      <AnnulerDialog
        open={annulerOpen}
        onOpenChange={setAnnulerOpen}
        prospectId={p.id}
        nom={p.nom}
      />
    </Card>
  );
}

function SuiviContact({
  p,
  pending,
  onRelance,
}: {
  p: ProspectRow;
  pending: boolean;
  onRelance: () => void;
}) {
  return (
    <div className="space-y-2 rounded-lg bg-muted/40 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
        <span className="text-muted-foreground">
          Contacté le <strong className="text-foreground">{p.contacteLeFr}</strong>
          {p.nbRelances > 0 ? ` · ${p.nbRelances} relance${p.nbRelances > 1 ? "s" : ""}` : ""}
          {" · "}
          {p.relanceDue ? (
            <span className="font-medium text-warning-ink">relance à faire ({p.relanceLeFr})</span>
          ) : (
            <>relance le {p.relanceLeFr}</>
          )}
        </span>
        {p.relanceDue ? (
          <Button size="sm" variant="outline" onClick={onRelance} disabled={pending}>
            {pending ? <Loader2 className="animate-spin" /> : <BellRing />} Relance faite
          </Button>
        ) : null}
      </div>
      {p.messageEnvoye ? (
        <details className="text-xs">
          <summary className="cursor-pointer text-muted-foreground">Message envoyé</summary>
          <p className="mt-1 whitespace-pre-wrap leading-relaxed">{p.messageEnvoye}</p>
        </details>
      ) : null}
    </div>
  );
}

function MailEnvoyeDialog({
  open,
  onOpenChange,
  prospectId,
  nom,
  defaultMessage,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  prospectId: string;
  nom: string;
  defaultMessage: string;
}) {
  const [message, setMessage] = useState(defaultMessage);
  const [pending, start] = useTransition();

  function confirmer() {
    start(async () => {
      const res = await marquerContacte(prospectId, message);
      if (res.ok) {
        toast.success("Contact enregistré — relance prévue dans 5 jours.");
        onOpenChange(false);
      } else {
        toast.error(res.error ?? "Impossible d'enregistrer.");
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Message envoyé à {nom}</DialogTitle>
          <DialogDescription>
            Confirme (ou colle) le message que tu as réellement envoyé. Il est enregistré
            tel quel — DeepSeek s&apos;en sert pour apprendre ton style et personnaliser les
            prochaines accroches.
          </DialogDescription>
        </DialogHeader>
        <Textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          className="min-h-[200px] text-sm leading-relaxed"
          placeholder="Le message envoyé…"
        />
        <DialogFooter>
          <Button onClick={confirmer} disabled={pending}>
            {pending ? <Loader2 className="animate-spin" /> : <Send />} Confirmer l&apos;envoi
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AnnulerDialog({
  open,
  onOpenChange,
  prospectId,
  nom,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  prospectId: string;
  nom: string;
}) {
  const [raison, setRaison] = useState("");
  const [pending, start] = useTransition();

  function confirmer() {
    start(async () => {
      await annulerProspect(prospectId, raison);
      toast.success(`« ${nom} » supprimé.`);
      onOpenChange(false);
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Annuler la fiche de {nom} ?</DialogTitle>
          <DialogDescription>
            La fiche est supprimée définitivement de la base. La raison est facultative
            (juste pour toi).
          </DialogDescription>
        </DialogHeader>
        <Textarea
          value={raison}
          onChange={(e) => setRaison(e.target.value)}
          className="min-h-[80px] text-sm"
          placeholder="Raison (facultatif) : pas la cible, déjà un site récent, injoignable…"
        />
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>
            Garder
          </Button>
          <Button variant="destructive" onClick={confirmer} disabled={pending}>
            {pending ? <Loader2 className="animate-spin" /> : <Trash2 />} Supprimer la fiche
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ActionsMenu({
  p,
  audite,
  pending,
  onConvertir,
  onAuditer,
  onStatut,
  onAnnuler,
}: {
  p: ProspectRow;
  audite: boolean;
  pending: boolean;
  onConvertir: () => void;
  onAuditer: () => void;
  onStatut: (s: string) => void;
  onAnnuler: () => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Plus d'actions">
          <MoreHorizontal />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {p.statut !== "converti" ? (
          <DropdownMenuItem onSelect={onConvertir}>
            <UserPlus /> Convertir en client
          </DropdownMenuItem>
        ) : null}
        {audite ? (
          <DropdownMenuItem onSelect={onAuditer} disabled={pending}>
            <Sparkles /> Ré-auditer
          </DropdownMenuItem>
        ) : null}
        {p.statut !== "contacte" ? (
          <DropdownMenuItem onSelect={() => onStatut("a_contacter")}>
            <Flag /> Marquer à contacter
          </DropdownMenuItem>
        ) : null}
        {p.statut === "ecarte" ? (
          <DropdownMenuItem onSelect={() => onStatut("nouveau")}>
            <Archive /> Restaurer
          </DropdownMenuItem>
        ) : (
          <DropdownMenuItem onSelect={() => onStatut("ecarte")}>
            <Archive /> Écarter (garder)
          </DropdownMenuItem>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive" onSelect={onAnnuler}>
          <Trash2 /> Annuler la fiche
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function Accroche({ titre, texte }: { titre: string; texte: string }) {
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
        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          {titre}
        </p>
        <Button type="button" variant="ghost" size="sm" onClick={copy}>
          {done ? <Check /> : <Copy />} Copier
        </Button>
      </div>
      <p className="whitespace-pre-wrap text-sm leading-relaxed">{texte}</p>
    </div>
  );
}
