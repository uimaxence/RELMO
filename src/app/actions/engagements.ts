"use server";

import { revalidatePath } from "next/cache";

import { prisma } from "@/lib/db";
import { engagementSchema } from "@/lib/schemas";
import { parseForm, type FormState } from "@/lib/form";

// siteId est lié côté formulaire pour revalider la page du site.
export async function createEngagement(
  siteId: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const parsed = parseForm(engagementSchema, formData);
  if (!parsed.ok) return parsed.state;

  await prisma.engagement.create({ data: parsed.data });
  revalidatePath(`/sites/${siteId}`);
  return { ok: true, message: "Engagement ajouté." };
}

export async function updateEngagement(
  id: string,
  siteId: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const parsed = parseForm(engagementSchema, formData);
  if (!parsed.ok) return parsed.state;

  await prisma.engagement.update({ where: { id }, data: parsed.data });
  revalidatePath(`/sites/${siteId}`);
  return { ok: true, message: "Engagement mis à jour." };
}

export async function deleteEngagement(
  id: string,
  siteId: string,
): Promise<void> {
  await prisma.engagement.delete({ where: { id } });
  revalidatePath(`/sites/${siteId}`);
}
