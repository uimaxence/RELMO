"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";

import { prisma } from "@/lib/db";

// Active / désactive le portail client (F15). À l'activation, génère un token de
// lien magique non devinable s'il n'en existe pas encore (réutilisé ensuite,
// pour que le lien reste stable).
export async function togglePortail(clientId: string): Promise<void> {
  const client = await prisma.client.findUnique({ where: { id: clientId } });
  if (!client) return;

  await prisma.client.update({
    where: { id: clientId },
    data: {
      portailActif: !client.portailActif,
      portailToken:
        client.portailToken ??
        `${randomUUID()}${randomUUID()}`.replace(/-/g, ""),
    },
  });
  revalidatePath(`/clients/${clientId}`);
}

// --- Côté portail public (appelé avec le token, cloisonné serveur) ---

async function clientFromToken(token: string) {
  if (!token) return null;
  return prisma.client.findFirst({
    where: { portailToken: token, portailActif: true },
  });
}

// Le client accepte un devis en ligne (1 clic) → conversion en contrat.
export async function accepterDevisPortail(
  token: string,
  devisId: string,
): Promise<{ ok: boolean; error?: string }> {
  const client = await clientFromToken(token);
  if (!client) return { ok: false, error: "Accès invalide." };

  const devis = await prisma.devis.findUnique({
    where: { id: devisId },
    include: { contrat: true },
  });
  if (!devis || devis.clientId !== client.id)
    return { ok: false, error: "Devis introuvable." };
  if (devis.contrat) return { ok: false, error: "Devis déjà accepté." };
  if (!["envoye", "en_nego"].includes(devis.statut))
    return { ok: false, error: "Ce devis n'est pas en attente." };
  if (!devis.siteId)
    return { ok: false, error: "Devis non finalisé — contactez votre prestataire." };

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
      where: { id: devisId },
      data: {
        statut: "accepte",
        dateDecision: new Date(),
        accepteLe: new Date(),
      },
    }),
    prisma.client.update({
      where: { id: client.id },
      data: { statut: "actif" },
    }),
  ]);

  revalidatePath(`/portail/${token}`);
  revalidatePath(`/clients/${client.id}`);
  revalidatePath("/pipeline");
  return { ok: true };
}

// Renouvelle le token (révoque l'ancien lien).
export async function regenererToken(clientId: string): Promise<void> {
  await prisma.client.update({
    where: { id: clientId },
    data: {
      portailToken: `${randomUUID()}${randomUUID()}`.replace(/-/g, ""),
    },
  });
  revalidatePath(`/clients/${clientId}`);
}
