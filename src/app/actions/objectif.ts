"use server";

import { revalidatePath } from "next/cache";

import { prisma } from "@/lib/db";
import { objectifSchema } from "@/lib/schemas";
import { parseForm, type FormState } from "@/lib/form";

export async function updateObjectif(
  id: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const parsed = parseForm(objectifSchema, formData);
  if (!parsed.ok) return parsed.state;

  await prisma.objectifMRR.update({ where: { id }, data: parsed.data });
  revalidatePath("/");
  return { ok: true, message: "Objectif mis à jour." };
}
