"use server";

import { revalidatePath } from "next/cache";

import { prisma } from "@/lib/db";
import { interactionSchema } from "@/lib/schemas";
import { parseForm, type FormState } from "@/lib/form";

export async function createInteraction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const parsed = parseForm(interactionSchema, formData);
  if (!parsed.ok) return parsed.state;

  await prisma.interaction.create({ data: parsed.data });
  revalidatePath(`/clients/${parsed.data.clientId}`);
  return { ok: true, message: "Échange journalisé." };
}

export async function deleteInteraction(
  id: string,
  clientId: string,
): Promise<void> {
  await prisma.interaction.delete({ where: { id } });
  revalidatePath(`/clients/${clientId}`);
}
