"use server";

import { revalidatePath } from "next/cache";

import { prisma } from "@/lib/db";
import { devisSchema } from "@/lib/schemas";
import { parseForm, type FormState } from "@/lib/form";

function revalidateDevis() {
  revalidatePath("/pipeline");
  revalidatePath("/");
}

export async function createDevis(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const parsed = parseForm(devisSchema, formData);
  if (!parsed.ok) return parsed.state;

  await prisma.devis.create({ data: parsed.data });
  revalidateDevis();
  return { ok: true, message: "Devis créé." };
}

export async function updateDevis(
  id: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const parsed = parseForm(devisSchema, formData);
  if (!parsed.ok) return parsed.state;

  await prisma.devis.update({ where: { id }, data: parsed.data });
  revalidateDevis();
  return { ok: true, message: "Devis mis à jour." };
}

export async function deleteDevis(id: string): Promise<void> {
  await prisma.devis.delete({ where: { id } });
  revalidateDevis();
}

// Convertit un devis en contrat (cf. docs/PROJET.md §7) : crée le Contrat sur le
// site visé, passe le devis en « accepté », et active le client.
export async function convertDevisToContrat(id: string): Promise<FormState> {
  const devis = await prisma.devis.findUnique({
    where: { id },
    include: { contrat: true },
  });
  if (!devis) return { ok: false, message: "Devis introuvable." };
  if (devis.contrat) return { ok: false, message: "Devis déjà converti." };
  if (!devis.siteId)
    return { ok: false, message: "Associe d'abord un site au devis." };

  await prisma.$transaction([
    prisma.contrat.create({
      data: {
        siteId: devis.siteId,
        libelle: devis.libelle,
        montantMensuel: devis.montantMensuelPropose,
        montantCreation: devis.montantCreation,
        statut: "actif",
        devisId: devis.id,
      },
    }),
    prisma.devis.update({
      where: { id },
      data: { statut: "accepte", dateDecision: new Date() },
    }),
    prisma.client.update({
      where: { id: devis.clientId },
      data: { statut: "actif" },
    }),
  ]);

  revalidateDevis();
  revalidatePath(`/clients/${devis.clientId}`);
  revalidatePath(`/sites/${devis.siteId}`);
  return { ok: true, message: "Devis converti en contrat." };
}
