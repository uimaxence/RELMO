import { notFound } from "next/navigation";
import { Globe, Images } from "lucide-react";

import { prisma } from "@/lib/db";
import { totalStockage } from "@/app/actions/photos";
import { PortailUpload } from "@/components/portail/portail-upload";
import {
  PortailGallery,
  type GalleryGroup,
} from "@/components/portail/portail-gallery";
import { periodeLabel } from "@/lib/periode";

export const dynamic = "force-dynamic";

export default async function PortailPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  const client = await prisma.client.findFirst({
    where: { portailToken: token, portailActif: true },
    include: {
      sites: { where: { statut: { not: "archive" } }, orderBy: { nom: "asc" } },
      photos: { orderBy: { createdAt: "desc" } },
    },
  });

  if (!client) notFound();

  const used = await totalStockage();

  // Regroupe les photos par dossier (mois), du plus récent au plus ancien.
  const byDossier = new Map<string, GalleryGroup["photos"]>();
  for (const p of client.photos) {
    const arr = byDossier.get(p.dossier) ?? [];
    arr.push({ id: p.id, url: p.url, nom: p.nom });
    byDossier.set(p.dossier, arr);
  }
  const groups: GalleryGroup[] = [...byDossier.entries()]
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([dossier, photos]) => ({
      dossier,
      label: periodeLabel(dossier),
      photos,
    }));

  return (
    <div className="min-h-screen bg-muted/30">
      <header className="border-b bg-background">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-brand">
              Relmo
            </p>
            <h1 className="text-lg font-semibold">Espace de {client.nom}</h1>
          </div>
          <span className="inline-flex items-center gap-1.5 text-sm text-muted-foreground">
            <Images className="size-4" /> {client.photos.length} photo
            {client.photos.length > 1 ? "s" : ""}
          </span>
        </div>
      </header>

      <main className="mx-auto max-w-5xl space-y-8 px-4 py-8">
        {client.sites.length > 0 ? (
          <section className="flex flex-wrap gap-x-6 gap-y-1 text-sm text-muted-foreground">
            {client.sites.map((s) => (
              <span key={s.id} className="inline-flex items-center gap-1.5">
                <Globe className="size-3.5" />
                {s.url ? (
                  <a
                    href={s.url}
                    target="_blank"
                    rel="noreferrer"
                    className="hover:underline"
                  >
                    {s.nom}
                  </a>
                ) : (
                  s.nom
                )}
              </span>
            ))}
          </section>
        ) : null}

        <section className="rounded-2xl border bg-background p-5">
          <h2 className="mb-1 text-base font-semibold">Déposer des photos</h2>
          <p className="mb-4 text-sm text-muted-foreground">
            Partagez vos visuels (logo, photos de vos produits, de votre équipe…).
            Ils sont rangés automatiquement par mois.
          </p>
          <PortailUpload token={token} used={used} />
        </section>

        <section>
          <PortailGallery token={token} groups={groups} />
        </section>
      </main>
    </div>
  );
}
