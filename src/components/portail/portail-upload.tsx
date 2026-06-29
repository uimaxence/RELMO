"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { UploadCloud, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { octets } from "@/lib/format";
import { uploadPhoto } from "@/app/actions/photos";
import { QUOTA_BYTES } from "@/lib/photos";

export function PortailUpload({
  token,
  used,
}: {
  token: string;
  used: number;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [dragging, setDragging] = useState(false);

  const pct = Math.min(100, Math.round((used / QUOTA_BYTES) * 100));

  async function handle(files: FileList | null) {
    if (!files || files.length === 0) return;
    setBusy(true);
    let ok = 0;
    let ko = 0;
    for (const file of Array.from(files)) {
      const fd = new FormData();
      fd.append("file", file);
      const res = await uploadPhoto(token, fd);
      if (res.ok) ok++;
      else {
        ko++;
        toast.error(`${file.name} : ${res.error}`);
      }
    }
    setBusy(false);
    if (ok > 0) {
      toast.success(`${ok} photo${ok > 1 ? "s" : ""} ajoutée${ok > 1 ? "s" : ""}.`);
      router.refresh();
    }
    if (ko === 0 && ok === 0) toast.info("Rien à envoyer.");
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
          "flex cursor-pointer flex-col items-center gap-2 rounded-xl border-2 border-dashed px-4 py-8 text-center transition-colors",
          dragging ? "border-brand bg-brand/5" : "hover:border-foreground/30",
          busy && "pointer-events-none opacity-70",
        )}
      >
        {busy ? (
          <>
            <Loader2 className="size-6 animate-spin text-brand" />
            <span className="text-sm text-muted-foreground">Envoi en cours…</span>
          </>
        ) : (
          <>
            <UploadCloud className="size-6 text-muted-foreground" />
            <span className="text-sm">
              Glissez vos photos ici, ou{" "}
              <span className="font-medium text-brand">parcourez</span>
            </span>
            <span className="text-xs text-muted-foreground">
              Triées automatiquement par date.
            </span>
          </>
        )}
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => {
            void handle(e.target.files);
            e.target.value = "";
          }}
        />
      </div>

      <div className="space-y-1">
        <div className="h-1.5 overflow-hidden rounded-full bg-muted">
          <div
            className={cn("h-full rounded-full", pct > 90 ? "bg-negative" : "bg-brand")}
            style={{ width: `${pct}%` }}
          />
        </div>
        <p className="text-right text-xs text-muted-foreground">
          {octets(used)} / {octets(QUOTA_BYTES)} utilisés
        </p>
      </div>

      {busy ? null : (
        <div className="flex justify-end">
          <Button variant="outline" size="sm" onClick={() => inputRef.current?.click()}>
            <UploadCloud /> Ajouter des photos
          </Button>
        </div>
      )}
    </div>
  );
}
