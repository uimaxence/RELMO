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
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ConfirmDelete } from "@/components/forms/confirm-delete";
import { labelOf, PROSPECT_STATUTS } from "@/lib/constants";
import {
  auditerUnProspect,
  convertirEnClient,
  changerStatutProspect,
  supprimerProspect,
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
  statut: string;
};

function scoreTone(score: number | null): string {
  if (score == null) return "text-muted-foreground";
  if (score >= 65) return "text-positive-ink";
  if (score >= 40) return "text-warning-ink";
  return "text-muted-foreground";
}

export function ProspectTable({ prospects }: { prospects: ProspectRow[] }) {
  const [detail, setDetail] = useState<ProspectRow | null>(null);

  if (prospects.length === 0) {
    return (
      <Card className="py-12 text-center text-sm text-muted-foreground">
        Aucun prospect ici. Lance une collecte ou importe un CSV pour commencer.
      </Card>
    );
  }

  return (
    <>
      <Card className="overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Entreprise</TableHead>
              <TableHead>Activité</TableHead>
              <TableHead className="text-center">Score</TableHead>
              <TableHead>Contact</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {prospects.map((p) => (
              <ProspectRowView key={p.id} p={p} onDetail={() => setDetail(p)} />
            ))}
          </TableBody>
        </Table>
      </Card>

      <ProspectDetailDialog prospect={detail} onClose={() => setDetail(null)} />
    </>
  );
}

function ProspectRowView({ p, onDetail }: { p: ProspectRow; onDetail: () => void }) {
  const [pending, start] = useTransition();

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

  const audite = p.statutAudit !== "a_auditer";

  return (
    <TableRow className={p.statut === "ecarte" ? "opacity-50" : undefined}>
      <TableCell>
        <div className="space-y-0.5">
          <div className="flex items-center gap-2 font-medium">
            {p.nom}
            {p.statut !== "nouveau" ? (
              <Badge variant="secondary" className="font-normal">
                {labelOf(PROSPECT_STATUTS, p.statut)}
              </Badge>
            ) : null}
          </div>
          <p className="text-xs text-muted-foreground">
            {p.ville ?? "—"}
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
      </TableCell>

      <TableCell className="text-sm text-muted-foreground">{p.activite ?? "—"}</TableCell>

      <TableCell className="text-center">
        {p.score != null ? (
          <span className={`font-mono text-lg font-medium tabular-nums ${scoreTone(p.score)}`}>
            {p.score}
          </span>
        ) : p.statutAudit === "a_auditer" ? (
          <span className="text-xs text-muted-foreground">—</span>
        ) : (
          <Badge variant="secondary" className="font-normal">
            {p.statutAudit === "aucun_site" ? "sans site" : "erreur"}
          </Badge>
        )}
      </TableCell>

      <TableCell>
        <div className="space-y-0.5 text-xs">
          {p.email ? (
            <a href={`mailto:${p.email}`} className="inline-flex items-center gap-1 hover:underline">
              <Mail className="size-3" /> {p.email}
            </a>
          ) : null}
          {p.telephone ? (
            <p className="inline-flex items-center gap-1 text-muted-foreground">
              <Phone className="size-3" /> {p.telephone}
            </p>
          ) : null}
          {!p.email && !p.telephone ? <span className="text-muted-foreground">—</span> : null}
        </div>
      </TableCell>

      <TableCell>
        <div className="flex items-center justify-end gap-1">
          {!audite ? (
            <Button variant="outline" size="sm" onClick={auditer} disabled={pending}>
              {pending ? <Loader2 className="animate-spin" /> : <Sparkles className="text-brand" />}
              Auditer
            </Button>
          ) : (
            <Button variant="ghost" size="sm" onClick={onDetail}>
              <Sparkles className="text-brand" /> Détail
            </Button>
          )}

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" aria-label="Plus d'actions">
                <MoreHorizontal />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {p.statut !== "converti" ? (
                <DropdownMenuItem onSelect={convertir}>
                  <UserPlus /> Convertir en client
                </DropdownMenuItem>
              ) : null}
              {audite ? (
                <DropdownMenuItem onSelect={auditer} disabled={pending}>
                  <Sparkles /> Ré-auditer
                </DropdownMenuItem>
              ) : null}
              <DropdownMenuItem onSelect={() => setStatut("a_contacter")}>
                <Flag /> Marquer à contacter
              </DropdownMenuItem>
              {p.statut === "ecarte" ? (
                <DropdownMenuItem onSelect={() => setStatut("nouveau")}>
                  <Archive /> Restaurer
                </DropdownMenuItem>
              ) : (
                <DropdownMenuItem onSelect={() => setStatut("ecarte")}>
                  <Archive /> Écarter
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              <ConfirmDelete
                action={supprimerProspect.bind(null, p.id)}
                description={`Supprimer définitivement « ${p.nom} » des prospects ?`}
                successMessage="Prospect supprimé."
                trigger={
                  <DropdownMenuItem
                    variant="destructive"
                    onSelect={(e) => e.preventDefault()}
                  >
                    Supprimer
                  </DropdownMenuItem>
                }
              />
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </TableCell>
    </TableRow>
  );
}

function CopyBtn({ text, label }: { text: string; label: string }) {
  const [done, setDone] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setDone(true);
      toast.success("Copié.");
      setTimeout(() => setDone(false), 1500);
    } catch {
      toast.error("Copie impossible.");
    }
  }
  return (
    <Button type="button" variant="outline" size="sm" onClick={copy}>
      {done ? <Check /> : <Copy />} {label}
    </Button>
  );
}

function ProspectDetailDialog({
  prospect,
  onClose,
}: {
  prospect: ProspectRow | null;
  onClose: () => void;
}) {
  return (
    <Dialog open={!!prospect} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        {prospect ? (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                {prospect.nom}
                {prospect.score != null ? (
                  <span className={`font-mono text-base ${scoreTone(prospect.score)}`}>
                    {prospect.score}/100
                  </span>
                ) : null}
              </DialogTitle>
              <DialogDescription>
                {[prospect.activite, prospect.ville].filter(Boolean).join(" · ") || "Prospect"}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 text-sm">
              {prospect.design || prospect.anciennete ? (
                <div className="space-y-1 text-muted-foreground">
                  {prospect.design ? <p>{prospect.design}</p> : null}
                  {prospect.anciennete ? <p>{prospect.anciennete}</p> : null}
                </div>
              ) : null}

              {prospect.pointsFaibles ? (
                <div className="space-y-1">
                  <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Points faibles
                  </p>
                  <p>{prospect.pointsFaibles}</p>
                </div>
              ) : null}

              {prospect.dirigeant || prospect.linkedin ? (
                <div className="space-y-1">
                  <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Dirigeant
                  </p>
                  <p>
                    {prospect.dirigeant}
                    {prospect.linkedin ? (
                      <>
                        {" — "}
                        <a
                          href={prospect.linkedin}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-brand hover:underline"
                        >
                          LinkedIn
                        </a>
                      </>
                    ) : null}
                  </p>
                </div>
              ) : null}

              {prospect.accrocheEmail ? (
                <Accroche
                  titre="Accroche e-mail"
                  texte={prospect.accrocheEmail}
                  label="Copier l'e-mail"
                />
              ) : null}
              {prospect.accrocheLinkedin ? (
                <Accroche
                  titre="Accroche LinkedIn"
                  texte={prospect.accrocheLinkedin}
                  label="Copier LinkedIn"
                />
              ) : null}

              {!prospect.accrocheEmail && !prospect.accrocheLinkedin ? (
                <p className="text-muted-foreground">
                  Pas encore d&apos;accroches générées pour ce prospect.
                </p>
              ) : null}
            </div>
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function Accroche({ titre, texte, label }: { titre: string; texte: string; label: string }) {
  return (
    <div className="space-y-2 rounded-lg border border-border bg-muted/40 p-3">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          {titre}
        </p>
        <CopyBtn text={texte} label={label} />
      </div>
      <p className="whitespace-pre-wrap leading-relaxed">{texte}</p>
    </div>
  );
}
