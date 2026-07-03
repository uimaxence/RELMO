"use client";

import { useMemo, useState, useTransition } from "react";
import {
  Sparkles,
  Loader2,
  UserPlus,
  Mail,
  Phone,
  Copy,
  Check,
  ExternalLink,
  AlertTriangle,
  Send,
  BellRing,
  Trash2,
  ChevronRight,
  Archive,
  RotateCcw,
  MessageSquare,
  Inbox,
  Undo2,
  Search as SearchIcon,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { labelOf, PROSPECT_STATUTS } from "@/lib/constants";
import {
  auditerUnProspect,
  convertirEnClient,
  changerStatutProspect,
  marquerContacte,
  marquerRelanceFaite,
  marquerReponse,
  updateEmailProspect,
  annulerProspect,
} from "@/app/actions/prospection";
import { emailValide } from "@/lib/prospection/email";

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
  campagne: string | null;
  messageEnvoye: string | null;
  contacteLeFr: string | null;
  relanceLeFr: string | null;
  relanceDue: boolean;
  nbRelances: number;
  reponduLeFr: string | null;
};

function initiales(nom: string): string {
  return nom
    .replace(/[^\p{L}\s]/gu, "")
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
}

function Avatar({ nom, size = "size-9" }: { nom: string; size?: string }) {
  return (
    <div
      className={`flex ${size} shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold text-muted-foreground ring-1 ring-border`}
    >
      {initiales(nom) || "?"}
    </div>
  );
}

function ScorePill({ score, big = false }: { score: number; big?: boolean }) {
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

// E-mail éditable en ligne (saisie/correction de l'adresse avant la file d'envoi).
function EmailInline({ id, email }: { id: string; email: string | null }) {
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
      {pending ? (
        <Loader2 className="size-3 animate-spin" />
      ) : saved ? (
        <Check className="size-3 text-positive-ink" />
      ) : null}
    </span>
  );
}

// Filtres de statut (segmentation du pipeline).
const FILTRES: { value: string; label: string; test: (p: ProspectRow) => boolean }[] = [
  { value: "a_traiter", label: "À traiter", test: (p) => !["ecarte", "converti"].includes(p.statut) },
  { value: "en_file", label: "En file d'envoi", test: (p) => p.statut === "a_contacter" },
  { value: "a_relancer", label: "À relancer", test: (p) => p.relanceDue },
  { value: "non_contacte", label: "Non contactés", test: (p) => p.statut === "nouveau" },
  { value: "contacte", label: "Contactés", test: (p) => p.statut === "contacte" },
  { value: "converti", label: "Convertis", test: (p) => p.statut === "converti" },
  { value: "ecarte", label: "Écartés", test: (p) => p.statut === "ecarte" },
  { value: "tous", label: "Tous", test: () => true },
];

export function ProspectTable({ prospects }: { prospects: ProspectRow[] }) {
  const [filtre, setFiltre] = useState("a_traiter");
  const [campagne, setCampagne] = useState("toutes");
  const [q, setQ] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const campagnes = useMemo(
    () => [...new Set(prospects.map((p) => p.campagne).filter(Boolean) as string[])].sort(),
    [prospects],
  );

  const filtered = useMemo(() => {
    const testStatut = FILTRES.find((f) => f.value === filtre)?.test ?? (() => true);
    const ql = q.trim().toLowerCase();
    return prospects.filter(
      (p) =>
        testStatut(p) &&
        (campagne === "toutes" || p.campagne === campagne) &&
        (!ql || p.nom.toLowerCase().includes(ql) || (p.ville ?? "").toLowerCase().includes(ql)),
    );
  }, [prospects, filtre, campagne, q]);

  const selected = prospects.find((p) => p.id === selectedId) ?? null;

  return (
    <div className="space-y-4">
      {/* Barre de filtres */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex flex-wrap gap-1 rounded-lg bg-muted p-1">
          {FILTRES.map((f) => {
            const n = prospects.filter(f.test).length;
            return (
              <button
                key={f.value}
                onClick={() => setFiltre(f.value)}
                className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                  filtre === f.value
                    ? "bg-card text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {f.label}
                <span className="font-mono tabular-nums opacity-60">{n}</span>
              </button>
            );
          })}
        </div>

        <div className="ml-auto flex items-center gap-2">
          {campagnes.length > 0 ? (
            <Select value={campagne} onValueChange={setCampagne}>
              <SelectTrigger className="h-8 w-[180px] text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="toutes">Toutes les campagnes</SelectItem>
                {campagnes.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : null}
          <div className="relative">
            <SearchIcon className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Rechercher…"
              className="h-8 w-[160px] pl-8 text-xs"
            />
          </div>
        </div>
      </div>

      {/* Tableau */}
      {filtered.length === 0 ? (
        <Card className="py-12 text-center text-sm text-muted-foreground">
          Aucun prospect dans ce filtre.
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Entreprise</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead>Campagne</TableHead>
                <TableHead className="text-center">Score</TableHead>
                <TableHead className="w-8" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((p) => (
                <TableRow
                  key={p.id}
                  onClick={() => setSelectedId(p.id)}
                  className={`cursor-pointer ${p.statut === "ecarte" ? "opacity-55" : ""}`}
                >
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Avatar nom={p.nom} />
                      <div className="min-w-0">
                        <div className="truncate font-medium">{p.nom}</div>
                        <div className="truncate text-xs text-muted-foreground">
                          {[p.activite, p.ville].filter(Boolean).join(" · ") || "—"}
                        </div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <StatutTags p={p} />
                  </TableCell>
                  <TableCell>
                    {p.campagne ? (
                      <Badge variant="outline" className="font-normal">
                        {p.campagne}
                      </Badge>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-center">
                    {p.score != null ? (
                      <ScorePill score={p.score} />
                    ) : p.statutAudit === "erreur" ? (
                      <AlertTriangle className="mx-auto size-4 text-warning-ink" />
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <ChevronRight className="size-4 text-muted-foreground" />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}

      <ProspectSheet
        prospect={selected}
        onClose={() => setSelectedId(null)}
      />
    </div>
  );
}

function StatutTags({ p }: { p: ProspectRow }) {
  return (
    <div className="flex flex-wrap items-center gap-1">
      <Badge
        variant={p.statut === "contacte" || p.statut === "converti" ? "default" : "secondary"}
        className="font-normal"
      >
        {labelOf(PROSPECT_STATUTS, p.statut)}
      </Badge>
      {p.statut === "a_contacter" ? (
        <Badge className="gap-1 border-accent-brand/30 bg-accent-brand-bg font-normal text-accent-brand">
          <Inbox className="size-3" /> En file
        </Badge>
      ) : null}
      {p.messageEnvoye ? (
        <Badge variant="outline" className="gap-1 font-normal text-muted-foreground">
          <Mail className="size-3" /> Mail envoyé
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

// ---------- Panneau latéral (détail façon Notion) ----------

function ProspectSheet({
  prospect,
  onClose,
}: {
  prospect: ProspectRow | null;
  onClose: () => void;
}) {
  const [pending, start] = useTransition();
  const [mailOpen, setMailOpen] = useState(false);
  const [annulerOpen, setAnnulerOpen] = useState(false);

  const p = prospect;
  const audite = p ? p.statutAudit === "ok" || p.statutAudit === "aucun_site" : false;
  const enErreur = p?.statutAudit === "erreur";
  const contacte = p?.statut === "contacte";
  const enFile = p?.statut === "a_contacter";

  function run(fn: () => Promise<unknown>, msg?: string) {
    start(async () => {
      await fn();
      if (msg) toast.success(msg);
    });
  }

  return (
    <Sheet open={!!p} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="gap-0 overflow-y-auto p-0 !w-[92vw] !max-w-none sm:!w-[52vw]">
        {p ? (
          <>
            <SheetHeader className="border-b bg-muted/30 p-5">
              <div className="flex items-start gap-3">
                <Avatar nom={p.nom} size="size-11" />
                <div className="min-w-0 flex-1">
                  <SheetTitle className="truncate">{p.nom}</SheetTitle>
                  <SheetDescription className="mt-0.5 truncate">
                    {[p.activite, p.ville].filter(Boolean).join(" · ") || "Prospect"}
                    {p.campagne ? ` · ${p.campagne}` : ""}
                  </SheetDescription>
                  <div className="mt-2">
                    <StatutTags p={p} />
                  </div>
                </div>
                {p.score != null ? <ScorePill score={p.score} big /> : null}
              </div>
            </SheetHeader>

            <div className="space-y-4 p-5 text-sm">
              {/* Liens / contact */}
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
                {p.site ? (
                  <a
                    href={p.site}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 hover:underline"
                  >
                    <ExternalLink className="size-3" /> Site
                  </a>
                ) : (
                  <span className="text-muted-foreground">Sans site</span>
                )}
                <EmailInline id={p.id} email={p.email} />
                {p.telephone ? (
                  <span className="inline-flex items-center gap-1 text-muted-foreground">
                    <Phone className="size-3" /> {p.telephone}
                  </span>
                ) : null}
              </div>
              {p.dirigeant ? (
                <p className="text-xs text-muted-foreground">
                  {p.dirigeant}
                  {p.linkedin ? (
                    <>
                      {" · "}
                      <a href={p.linkedin} target="_blank" rel="noopener noreferrer" className="text-brand hover:underline">
                        LinkedIn
                      </a>
                    </>
                  ) : null}
                </p>
              ) : null}

              {/* Non audité / erreur */}
              {!audite ? (
                <div className="space-y-2">
                  {enErreur ? (
                    <p className="flex items-start gap-1.5 text-xs text-warning-ink">
                      <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
                      <span>Audit en échec{p.note ? ` : ${p.note}` : ""}.</span>
                    </p>
                  ) : (
                    <p className="text-xs text-muted-foreground">Pas encore audité.</p>
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => run(() => auditerUnProspect(p.id), "Audit terminé.")}
                    disabled={pending}
                  >
                    {pending ? <Loader2 className="animate-spin" /> : <Sparkles className="text-brand" />}
                    {enErreur ? "Ré-auditer" : "Auditer"}
                  </Button>
                </div>
              ) : (
                <>
                  {p.design || p.anciennete ? (
                    <div className="space-y-0.5 text-muted-foreground">
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

                  {p.accrocheEmail ? <Accroche titre="Message e-mail" texte={p.accrocheEmail} /> : null}
                  {p.accrocheLinkedin ? (
                    <Accroche titre="Message LinkedIn" texte={p.accrocheLinkedin} />
                  ) : null}
                </>
              )}

              {/* Suivi / pipeline */}
              {contacte ? (
                <div className="space-y-2 rounded-lg bg-muted/50 p-3">
                  <p className="text-xs">
                    Contacté le <strong>{p.contacteLeFr}</strong>
                    {p.nbRelances > 0 ? ` · ${p.nbRelances} relance${p.nbRelances > 1 ? "s" : ""}` : ""}
                    {" · "}
                    {p.relanceDue ? (
                      <span className="font-medium text-warning-ink">relance à faire ({p.relanceLeFr})</span>
                    ) : (
                      <>relance le {p.relanceLeFr}</>
                    )}
                  </p>
                  <p className="text-xs">
                    {p.reponduLeFr ? (
                      <span className="font-medium text-positive-ink">
                        A répondu le {p.reponduLeFr}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">Pas encore de réponse.</span>
                    )}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {p.relanceDue ? (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => run(() => marquerRelanceFaite(p.id), "Relance enregistrée.")}
                        disabled={pending}
                      >
                        {pending ? <Loader2 className="animate-spin" /> : <BellRing />} Relance faite
                      </Button>
                    ) : null}
                    <Button
                      size="sm"
                      variant={p.reponduLeFr ? "ghost" : "outline"}
                      onClick={() =>
                        run(
                          () => marquerReponse(p.id),
                          p.reponduLeFr ? "Réponse retirée." : "Réponse enregistrée.",
                        )
                      }
                      disabled={pending}
                    >
                      {pending ? <Loader2 className="animate-spin" /> : <MessageSquare />}
                      {p.reponduLeFr ? "Retirer la réponse" : "Réponse reçue"}
                    </Button>
                  </div>
                  {p.messageEnvoye ? (
                    <details className="text-xs">
                      <summary className="cursor-pointer text-muted-foreground">Message envoyé</summary>
                      <p className="mt-1 whitespace-pre-wrap leading-relaxed">{p.messageEnvoye}</p>
                    </details>
                  ) : null}
                </div>
              ) : null}
            </div>

            {/* Actions bas de panneau */}
            <div className="sticky bottom-0 space-y-2 border-t bg-popover p-4">
              <div className="flex flex-wrap gap-2">
                {audite && !contacte && !enFile ? (
                  <Button
                    size="sm"
                    onClick={() =>
                      run(
                        () => changerStatutProspect(p.id, "a_contacter"),
                        "Ajouté à la file d'envoi.",
                      )
                    }
                    disabled={pending || !emailValide(p.email)}
                    title={
                      emailValide(p.email)
                        ? "Le mail partira au prochain lancement de campagne"
                        : "Ajoute un e-mail valide d'abord"
                    }
                  >
                    <Inbox /> Mettre en file d&apos;envoi
                  </Button>
                ) : null}
                {enFile ? (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      run(
                        () => changerStatutProspect(p.id, "nouveau"),
                        "Retiré de la file.",
                      )
                    }
                    disabled={pending}
                  >
                    <Undo2 /> Retirer de la file
                  </Button>
                ) : null}
                {audite && !contacte ? (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setMailOpen(true)}
                    disabled={pending}
                    title="J'ai envoyé le mail moi-même (journalisation)"
                  >
                    <Send /> Déjà envoyé
                  </Button>
                ) : null}
                {p.statut !== "converti" ? (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => run(() => convertirEnClient(p.id), `« ${p.nom} » ajouté aux clients.`)}
                    disabled={pending}
                  >
                    <UserPlus /> Convertir
                  </Button>
                ) : null}
                {p.statut === "ecarte" ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => run(() => changerStatutProspect(p.id, "nouveau"), "Restauré.")}
                    disabled={pending}
                  >
                    <RotateCcw /> Restaurer
                  </Button>
                ) : (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => run(() => changerStatutProspect(p.id, "ecarte"), "Écarté.")}
                    disabled={pending}
                  >
                    <Archive /> Écarter
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-destructive hover:text-destructive"
                  onClick={() => setAnnulerOpen(true)}
                  disabled={pending}
                >
                  <Trash2 /> Annuler la fiche
                </Button>
              </div>
            </div>

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
              onDone={onClose}
            />
          </>
        ) : null}
      </SheetContent>
    </Sheet>
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
            Confirme (ou colle) le message que tu as réellement envoyé. Il est enregistré tel
            quel — DeepSeek s&apos;en sert pour apprendre ton style et personnaliser les
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
  onDone,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  prospectId: string;
  nom: string;
  onDone: () => void;
}) {
  const [raison, setRaison] = useState("");
  const [pending, start] = useTransition();

  function confirmer() {
    start(async () => {
      await annulerProspect(prospectId, raison);
      toast.success(`« ${nom} » supprimé.`);
      onOpenChange(false);
      onDone();
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Annuler la fiche de {nom} ?</DialogTitle>
          <DialogDescription>
            La fiche est supprimée définitivement. La raison est facultative (juste pour toi).
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
            {pending ? <Loader2 className="animate-spin" /> : <Trash2 />} Supprimer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
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
        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{titre}</p>
        <Button type="button" variant="ghost" size="sm" onClick={copy}>
          {done ? <Check /> : <Copy />} Copier
        </Button>
      </div>
      <p className="whitespace-pre-wrap text-sm leading-relaxed">{texte}</p>
    </div>
  );
}
