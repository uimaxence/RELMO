"use server";

// Server actions du rapport mensuel client (F7) : édition du brouillon (intro,
// synthèse SEO, commentaire, actions) et envoi au client (publie sur le portail +
// email texte). L'envoi suit le modèle de publierUpdate (src/app/actions/portail.ts).

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { parseForm, type FormState } from "@/lib/form";
import { rapportSchema, envoyerRapportSchema } from "@/lib/schemas";
import { sendMail, smtpConfigured } from "@/lib/mailer";
import { getRapportData, construireEmailRapport } from "@/lib/rapport";

// Enregistre (upsert) les champs éditables du rapport d'un client pour une période.
export async function updateRapport(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const parsed = parseForm(rapportSchema, formData);
  if (!parsed.ok) return parsed.state;
  const { clientId, periode, intro, resumeTravail, syntheseSeo, commentaire, actions } =
    parsed.data;

  await prisma.rapportMensuel.upsert({
    where: { clientId_periode: { clientId, periode } },
    create: { clientId, periode, intro, resumeTravail, syntheseSeo, commentaire, actions },
    update: { intro, resumeTravail, syntheseSeo, commentaire, actions },
  });
  revalidatePath(`/clients/${clientId}/rapport`);
  return { ok: true, message: "Rapport enregistré." };
}

// Publie le rapport sur l'espace client et l'envoie par email (chiffres clés + lien).
export async function envoyerRapport(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const parsed = parseForm(envoyerRapportSchema, formData);
  if (!parsed.ok) return parsed.state;
  const { clientId, periode, intro, resumeTravail, syntheseSeo, commentaire, actions, origin } =
    parsed.data;

  // Enregistre d'abord les éventuelles éditions non sauvegardées (envoi = save + send).
  const rapport = await prisma.rapportMensuel.upsert({
    where: { clientId_periode: { clientId, periode } },
    create: { clientId, periode, intro, resumeTravail, syntheseSeo, commentaire, actions },
    update: { intro, resumeTravail, syntheseSeo, commentaire, actions },
  });

  const data = await getRapportData(clientId, periode);
  if (!data) return { ok: false, message: "Client introuvable." };
  if (!data.client.email) {
    return { ok: false, message: "Le client n'a pas d'email renseigné." };
  }
  if (!smtpConfigured()) {
    return { ok: false, message: "SMTP non configuré (voir .env)." };
  }

  const lien =
    origin && data.client.portailActif && data.client.portailToken
      ? `${origin}/portail/${data.client.portailToken}/rapport?periode=${periode}`
      : null;

  const { subject, text } = construireEmailRapport(data, lien);
  const res = await sendMail({ to: data.client.email, subject, text });
  if (!res.ok) {
    return { ok: false, message: `L'email a échoué : ${res.error}` };
  }

  await prisma.rapportMensuel.update({
    where: { id: rapport.id },
    data: { statut: "envoye", envoyeLe: new Date(), messageId: res.messageId ?? null },
  });

  revalidatePath(`/clients/${clientId}/rapport`);
  if (data.client.portailToken) revalidatePath(`/portail/${data.client.portailToken}/rapport`);
  return { ok: true, message: `Rapport envoyé à ${data.client.email}.` };
}
