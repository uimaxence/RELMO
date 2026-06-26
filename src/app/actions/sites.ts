"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { prisma } from "@/lib/db";
import { siteSchema } from "@/lib/schemas";
import { parseForm, type FormState } from "@/lib/form";

export async function createSite(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const parsed = parseForm(siteSchema, formData);
  if (!parsed.ok) return parsed.state;
  const data = parsed.data;

  await prisma.site.create({ data });
  revalidatePath(`/clients/${data.clientId}`);
  revalidatePath("/clients");
  revalidatePath("/");
  return { ok: true, message: "Site créé." };
}

export async function updateSite(
  id: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const parsed = parseForm(siteSchema, formData);
  if (!parsed.ok) return parsed.state;
  const data = parsed.data;

  await prisma.site.update({ where: { id }, data });
  revalidatePath(`/sites/${id}`);
  revalidatePath(`/clients/${data.clientId}`);
  return { ok: true, message: "Site mis à jour." };
}

export async function deleteSite(id: string, clientId: string): Promise<void> {
  await prisma.site.delete({ where: { id } });
  revalidatePath(`/clients/${clientId}`);
  revalidatePath("/");
  redirect(`/clients/${clientId}`);
}
