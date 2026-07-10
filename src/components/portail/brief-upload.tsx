"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { UploadCloud, Loader2, FileText, X } from "lucide-react";
import { toast } from "sonner";

import { cn } from "@/lib/utils";
import { uploadFichierBrief } from "@/app/actions/portail";
import { deletePhoto } from "@/app/actions/photos";

export type BriefFile = { id: string; url: string; nom: string };

// Dépôt des éléments du brief (logo, visuels, PDF) : zone compacte + vignettes
// des fichiers déjà déposés, supprimables. Indépendant du formulaire de brief.
export function BriefUpload({
  token,
  files,
}: {
  token: string;
  files: BriefFile[];
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [dragging, setDragging] = useState(false);

  async function handle(list: FileList | null) {
    if (!list || list.length === 0) return;
    setBusy(true);
    let ok = 0;
    for (const file of Array.from(list)) {
      const fd = new FormData();
      fd.append("file", file);
      const res = await uploadFichierBrief(token, fd);
      if (res.ok) ok++;
      else toast.error(`${file.name} : ${res.error}`);
    }
    setBusy(false);
    if (ok > 0) {
      toast.success(`${ok} fichier${ok > 1 ? "s" : ""} bien reçu${ok > 1 ? "s" : ""}.`);
      router.refresh();
    }
  }

  async function remove(id: string, nom: string) {
    const res = await deletePhoto(token, id);
    if (res.ok) {
      toast.success(`${nom} supprimé.`);
      router.refresh();
    } else {
      toast.error(res.error ?? "Suppression impossible.");
    }
  }

  return (
    <div className="space-y-3">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          if (!busy) void handle(e.dataTransfer.files);
        }}
        onClick={() => !busy && inputRef.current?.click()}
        className={cn(
          "flex cursor-pointer items-center justify-center gap-2 rounded-xl border-2 border-dashed px-4 py-5 text-center transition-colors",
          dragging ? "border-brand bg-brand/5" : "hover:border-foreground/30",
          busy && "pointer-events-none opacity-70",
        )}
      >
        {busy ? (
          <>
            <Loader2 className="size-5 animate-spin text-brand" />
            <span className="text-sm text-muted-foreground">Envoi en cours…</span>
          </>
        ) : (
          <>
            <UploadCloud className="size-5 text-muted-foreground" />
            <span className="text-sm">
              Déposez votre logo ou vos éléments ici, ou{" "}
              <span className="font-medium text-brand">parcourez</span>
            </span>
          </>
        )}
        <input
          ref={inputRef}
          type="file"
          accept="image/*,.pdf"
          multiple
          className="hidden"
          onChange={(e) => {
            void handle(e.target.files);
            e.target.value = "";
          }}
        />
      </div>

      {files.length > 0 ? (
        <ul className="flex flex-wrap gap-3">
          {files.map((f) => {
            const isPdf = f.nom.toLowerCase().endsWith(".pdf");
            return (
              <li key={f.id} className="group relative">
                <a
                  href={f.url}
                  target="_blank"
                  rel="noreferrer"
                  className="flex w-24 flex-col items-center gap-1.5"
                  title={f.nom}
                >
                  {isPdf ? (
                    <span className="flex size-16 items-center justify-center rounded-lg border bg-muted">
                      <FileText className="size-6 text-muted-foreground" />
                    </span>
                  ) : (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={f.url}
                      alt={f.nom}
                      className="size-16 rounded-lg border object-contain"
                    />
                  )}
                  <span className="w-full truncate text-center text-xs text-muted-foreground">
                    {f.nom}
                  </span>
                </a>
                <button
                  type="button"
                  onClick={() => void remove(f.id, f.nom)}
                  aria-label={`Supprimer ${f.nom}`}
                  className="absolute -right-1.5 -top-1.5 hidden size-5 items-center justify-center rounded-full border bg-background shadow-sm group-hover:flex"
                >
                  <X className="size-3" />
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}
