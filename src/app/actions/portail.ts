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
