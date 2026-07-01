"use server";

import { revalidatePath } from "next/cache";

import { prisma } from "@/lib/db";
import { contratSchema } from "@/lib/schemas";
import { parseForm, type FormState } from "@/lib/form";

export async function createContrat(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const parsed = parseForm(contratSchema, formData);
  if (!parsed.ok) return parsed.state;
  const data = parsed.data;

  const contrat = await prisma.contrat.create({
    data,
    include: { site: { select: { clientId: true } } },
  });
  revalidatePath(`/sites/${data.siteId}`);
  revalidatePath(`/clients/${contrat.site.clientId}`);
  revalidatePath("/");
  return { ok: true, message: "Contrat créé." };
}

export async function updateContrat(
  id: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const parsed = parseForm(contratSchema, formData);
  if (!parsed.ok) return parsed.state;
  const data = parsed.data;

  const contrat = await prisma.contrat.update({
    where: { id },
    data,
    include: { site: { select: { clientId: true } } },
  });
  revalidatePath(`/sites/${data.siteId}`);
  revalidatePath(`/clients/${contrat.site.clientId}`);
  revalidatePath("/");
  return { ok: true, message: "Contrat mis à jour." };
}

// Bascule rapide « facturation démarrée » (depuis la page MRR) : marque un
// contrat démarré comme facturé (compté dans le MRR) ou en attente.
export async function marquerFacturationDemarree(
  id: string,
  valeur: boolean,
): Promise<void> {
  const ct = await prisma.contrat.update({
    where: { id },
    data: { facturationDemarree: valeur },
    select: { siteId: true },
  });
  revalidatePath("/mrr");
  revalidatePath("/");
  revalidatePath("/clients");
  revalidatePath(`/sites/${ct.siteId}`);
}

export async function deleteContrat(id: string, siteId: string): Promise<void> {
  const contrat = await prisma.contrat.delete({
    where: { id },
    include: { site: { select: { clientId: true } } },
  });
  revalidatePath(`/sites/${siteId}`);
  revalidatePath(`/clients/${contrat.site.clientId}`);
  revalidatePath("/");
}
