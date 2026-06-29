"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { X, Trash2 } from "lucide-react";
import { toast } from "sonner";

import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { deletePhoto } from "@/app/actions/photos";

export type GalleryPhoto = { id: string; url: string; nom: string };
export type GalleryGroup = { dossier: string; label: string; photos: GalleryPhoto[] };

export function PortailGallery({
  token,
  groups,
}: {
  token: string;
  groups: GalleryGroup[];
}) {
  const router = useRouter();
  const [active, setActive] = useState<GalleryPhoto | null>(null);
  const [pending, startTransition] = useTransition();

  function remove(photo: GalleryPhoto) {
    startTransition(async () => {
      const res = await deletePhoto(token, photo.id);
      if (res.ok) {
        toast.success("Photo supprimée.");
        setActive(null);
        router.refresh();
      } else {
        toast.error(res.error ?? "Suppression impossible.");
      }
    });
  }

  if (groups.length === 0) {
    return (
      <p className="rounded-xl border border-dashed py-12 text-center text-sm text-muted-foreground">
        Aucune photo pour l&apos;instant. Déposez vos premières images ci-dessus.
      </p>
    );
  }

  return (
    <div className="space-y-8">
      {groups.map((g) => (
        <section key={g.dossier}>
          <h2 className="mb-3 text-sm font-semibold capitalize">{g.label}</h2>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
            {g.photos.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => setActive(p)}
                className="group relative aspect-square overflow-hidden rounded-lg border bg-muted"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={p.url}
                  alt={p.nom}
                  loading="lazy"
                  className="size-full object-cover transition-transform group-hover:scale-105"
                />
              </button>
            ))}
          </div>
        </section>
      ))}

      <Dialog open={!!active} onOpenChange={(o) => !o && setActive(null)}>
        <DialogContent className="max-w-3xl gap-2 p-2 sm:max-w-3xl">
          <DialogTitle className="sr-only">{active?.nom ?? "Photo"}</DialogTitle>
          {active ? (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={active.url}
                alt={active.nom}
                className="max-h-[75vh] w-full rounded-md object-contain"
              />
              <div className="flex items-center justify-between px-1 pb-1">
                <span className="truncate text-xs text-muted-foreground">
                  {active.nom}
                </span>
                <button
                  type="button"
                  onClick={() => remove(active)}
                  disabled={pending}
                  className="inline-flex items-center gap-1 text-xs text-destructive hover:underline disabled:opacity-50"
                >
                  <Trash2 className="size-3.5" /> Supprimer
                </button>
              </div>
            </>
          ) : null}
          <button
            type="button"
            onClick={() => setActive(null)}
            className="absolute right-2 top-2 rounded-md bg-background/80 p-1"
            aria-label="Fermer"
          >
            <X className="size-4" />
          </button>
        </DialogContent>
      </Dialog>
    </div>
  );
}
