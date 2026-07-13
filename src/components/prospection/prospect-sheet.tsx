"use client";

import { useState, useTransition } from "react";
import {
  Sparkles,
  Loader2,
  UserPlus,
  Phone,
  ExternalLink,
  AlertTriangle,
  Send,
  BellRing,
  Trash2,
  Archive,
  RotateCcw,
  MessageSquare,
  Inbox,
  Undo2,
  Rocket,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { CANAUX_CONTACT } from "@/lib/constants";
import {
  auditerUnProspect,
  convertirEnClient,
  changerStatutProspect,
  marquerContacte,
  marquerRelanceFaite,
  marquerReponse,
  annulerProspect,
  basculerSegmentProspect,
} from "@/app/actions/prospection";
import { emailValide } from "@/lib/prospection/email";
import type { ProspectRow } from "./prospect-row";
import {
  Avatar,
  ScorePill,
  FiltreBreakdown,
  StatutTags,
  EmailInline,
  CanalIcon,
  Accroche,
} from "./prospect-shared";

// Panneau latéral (détail façon Notion) : audit, qualification, pipeline, actions.
export function ProspectSheet({ prospect, onClose }: { prospect: ProspectRow | null; onClose: () => void }) {
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
                  <a href={p.site} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 hover:underline">
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

              {/* Segment client : bascule classique ↔ Pro (angle ROI, funnel séparé) */}
              {p.cible !== "partenaire" ? (
                <button
                  type="button"
                  onClick={() =>
                    run(
                      () => basculerSegmentProspect(p.id),
                      p.segment === "pro" ? "Repassé en classique." : "Passé en Pro. À ré-auditer.",
                    )
                  }
                  disabled={pending}
                  className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground disabled:opacity-50"
                >
                  <Rocket className="size-3" />
                  {p.segment === "pro" ? "Repasser en classique" : "Passer en Pro (ROI)"}
                </button>
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
                  {p.flagConcurrent || p.flagAQualifier ? (
                    <div
                      className={`rounded-lg border p-3 text-xs leading-relaxed ${
                        p.flagConcurrent
                          ? "border-destructive/30 bg-destructive/10 text-destructive"
                          : "border-warning-ink/30 bg-warning-bg text-warning-ink"
                      }`}
                    >
                      <p className="font-medium">
                        {p.flagConcurrent ? "Concurrent : aucun pitch automatique." : "À qualifier manuellement avant toute approche."}
                      </p>
                      {p.note ? <p className="mt-1">{p.note}</p> : null}
                    </div>
                  ) : null}

                  {p.design || p.anciennete || p.nbAvis != null ? (
                    <div className="space-y-0.5 text-muted-foreground">
                      {p.design ? <p>{p.design}</p> : null}
                      {p.anciennete ? <p>{p.anciennete}</p> : null}
                      {p.nbAvis != null ? (
                        <p>
                          {p.nbAvis} avis Google
                          {p.cible === "partenaire" ? " (proxy volume de portefeuille)" : ""}
                        </p>
                      ) : null}
                    </div>
                  ) : null}

                  {p.cible !== "partenaire" ? <FiltreBreakdown p={p} /> : null}

                  {p.atouts ? (
                    <div className="flex flex-wrap gap-1.5">
                      {p.atouts.split(" • ").map((a, i) => (
                        <Badge key={i} className="border-positive-ink/30 bg-positive-bg font-normal text-positive-ink">
                          {a}
                        </Badge>
                      ))}
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
                  {p.accrocheLinkedin ? <Accroche titre="Message LinkedIn" texte={p.accrocheLinkedin} /> : null}
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
                      <span className="font-medium text-positive-ink">A répondu le {p.reponduLeFr}</span>
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
                      onClick={() => run(() => marquerReponse(p.id), p.reponduLeFr ? "Réponse retirée." : "Réponse enregistrée.")}
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
                {audite && !contacte && !enFile && !p.flagConcurrent && !p.flagAQualifier ? (
                  <Button
                    size="sm"
                    onClick={() => run(() => changerStatutProspect(p.id, "a_contacter"), "Ajouté à la file d'envoi.")}
                    disabled={pending || !emailValide(p.email)}
                    title={emailValide(p.email) ? "Le mail partira au prochain lancement de campagne" : "Ajoute un e-mail valide d'abord"}
                  >
                    <Inbox /> Mettre en file d&apos;envoi
                  </Button>
                ) : null}
                {enFile ? (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => run(() => changerStatutProspect(p.id, "nouveau"), "Retiré de la file.")}
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
                    title="Je l'ai contacté moi-même (mail, LinkedIn ou Instagram)"
                  >
                    <Send /> J&apos;ai contacté
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

            <ContactManuelDialog
              open={mailOpen}
              onOpenChange={setMailOpen}
              prospectId={p.id}
              nom={p.nom}
              accrocheEmail={p.accrocheEmail ?? ""}
              accrocheLinkedin={p.accrocheLinkedin ?? ""}
            />
            <AnnulerDialog open={annulerOpen} onOpenChange={setAnnulerOpen} prospectId={p.id} nom={p.nom} onDone={onClose} />
          </>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}

function ContactManuelDialog({
  open,
  onOpenChange,
  prospectId,
  nom,
  accrocheEmail,
  accrocheLinkedin,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  prospectId: string;
  nom: string;
  accrocheEmail: string;
  accrocheLinkedin: string;
}) {
  // Message par défaut selon le canal : accroche e-mail pour l'e-mail, accroche
  // courte (LinkedIn) pour les DM LinkedIn/Instagram.
  const defautPour = (c: string) => (c === "email" ? accrocheEmail : accrocheLinkedin || accrocheEmail);

  const [canal, setCanal] = useState("email");
  const [message, setMessage] = useState(accrocheEmail);
  const [pending, start] = useTransition();

  function changerCanal(c: string) {
    setCanal(c);
    setMessage(defautPour(c));
  }

  function confirmer() {
    start(async () => {
      const res = await marquerContacte(prospectId, message, canal);
      if (res.ok) {
        toast.success("Contact enregistré, relance prévue dans 5 jours.");
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
          <DialogTitle>Marquer {nom} comme contacté</DialogTitle>
          <DialogDescription>
            Par quel canal, et avec quel message ? Il est enregistré tel quel : DeepSeek s&apos;en sert pour apprendre ton style.
          </DialogDescription>
        </DialogHeader>

        {/* Choix du canal */}
        <div className="flex gap-1 rounded-lg bg-muted p-1">
          {CANAUX_CONTACT.map((c) => (
            <button
              key={c.value}
              type="button"
              onClick={() => changerCanal(c.value)}
              className={`flex flex-1 items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                canal === c.value ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <CanalIcon canal={c.value} /> {c.label}
            </button>
          ))}
        </div>

        <Textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          className="min-h-[200px] text-sm leading-relaxed"
          placeholder="Le message envoyé…"
        />
        <DialogFooter>
          <Button onClick={confirmer} disabled={pending}>
            {pending ? <Loader2 className="animate-spin" /> : <Send />} Enregistrer le contact
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
