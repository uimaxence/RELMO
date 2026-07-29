"use server";

// Server actions du suivi SEO (F8) : cible de relevé d'un site, mots-clés suivis,
// et relevé à la demande via DataForSEO. Pattern habituel : parseForm → prisma →
// revalidatePath (cf. src/app/actions/factures.ts).

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { parseForm, type FormState } from "@/lib/form";
import { siteSeoSchema, motCleSchema } from "@/lib/schemas";
import { currentPeriode } from "@/lib/periode";
import { releverSite } from "@/lib/seo/releve";

// Cible de relevé du site (domaine + localisation/langue DataForSEO).
export async function updateSiteSeo(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const parsed = parseForm(siteSeoSchema, formData);
  if (!parsed.ok) return parsed.state;
  const { siteId, domaine, seoLocation, seoLangue } = parsed.data;

  await prisma.site.update({
    where: { id: siteId },
    data: {
      domaine: domaine ?? null,
      seoLocation: seoLocation ?? null,
      seoLangue,
    },
  });
  revalidatePath(`/sites/${siteId}`);
  return { ok: true, message: "Cible SEO enregistrée." };
}

// Ajoute un mot-clé suivi au site.
export async function addMotCle(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const parsed = parseForm(motCleSchema, formData);
  if (!parsed.ok) return parsed.state;
  const { siteId, texte } = parsed.data;

  await prisma.motCle.create({ data: { siteId, texte } });
  revalidatePath(`/sites/${siteId}`);
  return { ok: true, message: "Mot-clé ajouté." };
}

// Supprime un mot-clé suivi (et ses relevés, en cascade).
export async function deleteMotCle(id: string, siteId: string): Promise<void> {
  await prisma.motCle.delete({ where: { id } });
  revalidatePath(`/sites/${siteId}`);
}

// Relève tout de suite les positions + la visibilité du site pour le mois courant.
export async function releverMaintenant(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const siteId = String(formData.get("siteId") ?? "");
  if (!siteId) return { ok: false, message: "Site manquant." };

  const res = await releverSite(siteId, currentPeriode());
  revalidatePath(`/sites/${siteId}`);
  return { ok: res.ok, message: res.message };
}

// Relève tous les sites suivis d'un client, pour la période du rapport. Utilisé
// par le bouton « Relever le SEO » de la page rapport.
export async function releverClient(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const clientId = String(formData.get("clientId") ?? "");
  const periode = String(formData.get("periode") ?? "") || currentPeriode();
  if (!clientId) return { ok: false, message: "Client manquant." };

  const sites = await prisma.site.findMany({
    where: { clientId, motsCles: { some: { actif: true } } },
    select: { id: true },
  });
  if (sites.length === 0) {
    return { ok: false, message: "Aucun site avec des mots-clés suivis pour ce client." };
  }

  let total = 0;
  let dernier = "";
  for (const s of sites) {
    const res = await releverSite(s.id, periode);
    total += res.releves;
    if (!res.ok) dernier = res.message;
  }
  revalidatePath(`/clients/${clientId}/rapport`);
  return {
    ok: total > 0,
    message: total > 0 ? `Relevé effectué : ${total} mot(s)-clé(s).` : dernier || "Aucun relevé.",
  };
}
