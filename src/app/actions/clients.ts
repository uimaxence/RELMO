"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { prisma } from "@/lib/db";
import { clientSchema } from "@/lib/schemas";
import { parseForm, type FormState } from "@/lib/form";

export async function createClient(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const parsed = parseForm(clientSchema, formData);
  if (!parsed.ok) return parsed.state;

  await prisma.client.create({ data: parsed.data });
  revalidatePath("/clients");
  revalidatePath("/");
  return { ok: true, message: "Client créé." };
}

export async function updateClient(
  id: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const parsed = parseForm(clientSchema, formData);
  if (!parsed.ok) return parsed.state;

  await prisma.client.update({ where: { id }, data: parsed.data });
  revalidatePath("/clients");
  revalidatePath(`/clients/${id}`);
  return { ok: true, message: "Client mis à jour." };
}

// Supprime le client et tout son arbre (sites/contrats/... via cascade).
export async function deleteClient(id: string): Promise<void> {
  await prisma.client.delete({ where: { id } });
  revalidatePath("/clients");
  revalidatePath("/");
  redirect("/clients");
}
