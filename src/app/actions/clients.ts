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

export type ClientRapideResult =
  | { ok: true; id: string; nom: string }
  | { ok: false; error: string };

// Création en 1 clic depuis l'analyse PDF d'un devis : le client détecté
// n'existe pas encore en base. Créé en statut "prospect" (le devis n'est pas
// encore signé). Idempotent : si le nom existe déjà, on renvoie l'existant.
export async function creerClientDepuisDevis(input: {
  nom: string;
  email?: string;
  telephone?: string;
}): Promise<ClientRapideResult> {
  const nom = input.nom.trim();
  if (!nom) return { ok: false, error: "Nom du client manquant." };

  const existant = await prisma.client.findFirst({
    where: { nom: { equals: nom, mode: "insensitive" } },
    select: { id: true, nom: true },
  });
  if (existant) return { ok: true, id: existant.id, nom: existant.nom };

  const client = await prisma.client.create({
    data: {
      nom,
      email: input.email?.trim() || null,
      telephone: input.telephone?.trim() || null,
      statut: "prospect",
      source: "autre",
      sourceDetail: "Créé depuis l'analyse PDF d'un devis",
    },
    select: { id: true, nom: true },
  });
  revalidatePath("/clients");
  revalidatePath("/");
  return { ok: true, id: client.id, nom: client.nom };
}

// Supprime le client et tout son arbre (sites/contrats/... via cascade).
export async function deleteClient(id: string): Promise<void> {
  await prisma.client.delete({ where: { id } });
  revalidatePath("/clients");
  revalidatePath("/");
  redirect("/clients");
}
