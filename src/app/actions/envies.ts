"use server";

import { revalidatePath } from "next/cache";

import { prisma } from "@/lib/db";
import {
  envieSchema,
  reglageSchema,
  paliersSchema,
  reglageCampagneSchema,
} from "@/lib/schemas";
import { parseForm, type FormState } from "@/lib/form";
import { ensureReglage } from "@/lib/wishlist";

function revalidateWishlist() {
  revalidatePath("/wishlist");
}

export async function createEnvie(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const parsed = parseForm(envieSchema, formData);
  if (!parsed.ok) return parsed.state;

  await prisma.envie.create({ data: parsed.data });
  revalidateWishlist();
  return { ok: true, message: "Envie ajoutée." };
}

export async function updateEnvie(
  id: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const parsed = parseForm(envieSchema, formData);
  if (!parsed.ok) return parsed.state;

  await prisma.envie.update({ where: { id }, data: parsed.data });
  revalidateWishlist();
  return { ok: true, message: "Envie mise à jour." };
}

export async function deleteEnvie(id: string): Promise<void> {
  await prisma.envie.delete({ where: { id } });
  revalidateWishlist();
}

// Marque une envie comme achetée (ou annule l'achat) — la récompense est prise.
export async function toggleEnvieAchat(id: string): Promise<void> {
  const envie = await prisma.envie.findUnique({ where: { id } });
  if (!envie) return;
  await prisma.envie.update({
    where: { id },
    data: {
      achete: !envie.achete,
      acheteLe: envie.achete ? null : new Date(),
    },
  });
  revalidateWishlist();
}

// Règle le seuil d'abordabilité (% du MRR).
export async function updateReglage(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const parsed = parseForm(reglageSchema, formData);
  if (!parsed.ok) return parsed.state;

  await ensureReglage();
  await prisma.reglage.update({
    where: { id: "singleton" },
    data: parsed.data,
  });
  revalidateWishlist();
  return { ok: true, message: "Seuil mis à jour." };
}

// Met à jour les paliers de prix (grille publique — cf. brief §4). Ces prix
// pré-remplissent les devis et alimentent la grille tarifaire du pipeline.
export async function updatePaliers(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const parsed = parseForm(paliersSchema, formData);
  if (!parsed.ok) return parsed.state;

  await ensureReglage();
  await prisma.reglage.update({
    where: { id: "singleton" },
    data: parsed.data,
  });
  revalidatePath("/pipeline");
  revalidatePath("/acquisition");
  return { ok: true, message: "Paliers mis à jour." };
}

// Contenus de campagne (signature, opt-out, lien de réalisation) injectés dans
// chaque mail de prospection.
export async function updateReglageCampagne(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const parsed = parseForm(reglageCampagneSchema, formData);
  if (!parsed.ok) return parsed.state;

  await ensureReglage();
  await prisma.reglage.update({
    where: { id: "singleton" },
    data: parsed.data,
  });
  revalidatePath("/prospection/campagne");
  return { ok: true, message: "Réglages de campagne enregistrés." };
}
