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

  await prisma.contrat.create({ data });
  revalidatePath(`/sites/${data.siteId}`);
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

  await prisma.contrat.update({ where: { id }, data });
  revalidatePath(`/sites/${data.siteId}`);
  revalidatePath("/");
  return { ok: true, message: "Contrat mis à jour." };
}

export async function deleteContrat(id: string, siteId: string): Promise<void> {
  await prisma.contrat.delete({ where: { id } });
  revalidatePath(`/sites/${siteId}`);
  revalidatePath("/");
}
