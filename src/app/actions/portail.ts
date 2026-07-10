"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { put } from "@vercel/blob";

import { prisma } from "@/lib/db";
import { parseForm, type FormState } from "@/lib/form";
import { briefSchema, portailUpdateSchema } from "@/lib/schemas";
import { sendMail, smtpConfigured } from "@/lib/mailer";
import { sansCadratin } from "@/lib/prospection/email";
import { totalStockage } from "@/app/actions/photos";
import { QUOTA_BYTES } from "@/lib/photos";
import { DOSSIER_BRIEF } from "@/lib/constants";

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

// --- Côté portail public (appelé avec le token, cloisonné serveur) ---

async function clientFromToken(token: string) {
  if (!token) return null;
  return prisma.client.findFirst({
    where: { portailToken: token, portailActif: true },
  });
}

// Le client accepte un devis en ligne (1 clic) → conversion en contrat.
export async function accepterDevisPortail(
  token: string,
  devisId: string,
): Promise<{ ok: boolean; error?: string }> {
  const client = await clientFromToken(token);
  if (!client) return { ok: false, error: "Accès invalide." };

  const devis = await prisma.devis.findUnique({
    where: { id: devisId },
    include: { contrat: true },
  });
  if (!devis || devis.clientId !== client.id)
    return { ok: false, error: "Devis introuvable." };
  if (devis.contrat) return { ok: false, error: "Devis déjà accepté." };
  if (!["envoye", "en_nego"].includes(devis.statut))
    return { ok: false, error: "Ce devis n'est pas en attente." };
  if (!devis.siteId)
    return { ok: false, error: "Devis non finalisé — contactez votre prestataire." };

  await prisma.$transaction([
    prisma.contrat.create({
      data: {
        siteId: devis.siteId,
        libelle: devis.libelle,
        montantMensuel: devis.montantMensuelPropose,
        montantCreation: devis.montantCreation,
        statut: "actif",
        devisId: devis.id,
      },
    }),
    prisma.devis.update({
      where: { id: devisId },
      data: {
        statut: "accepte",
        dateDecision: new Date(),
        accepteLe: new Date(),
      },
    }),
    prisma.client.update({
      where: { id: client.id },
      data: { statut: "actif" },
    }),
  ]);

  revalidatePath(`/portail/${token}`);
  revalidatePath(`/clients/${client.id}`);
  revalidatePath("/pipeline");
  return { ok: true };
}

// Le client remplit (ou complète) son brief de démarrage depuis son portail.
export async function enregistrerBriefPortail(
  token: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const client = await clientFromToken(token);
  if (!client) return { ok: false, message: "Accès invalide." };

  const parsed = parseForm(briefSchema, formData);
  if (!parsed.ok) return parsed.state;

  await prisma.brief.upsert({
    where: { clientId: client.id },
    create: { clientId: client.id, ...parsed.data, rempliLe: new Date() },
    update: { ...parsed.data, rempliLe: new Date() },
  });

  revalidatePath(`/portail/${token}`);
  revalidatePath(`/clients/${client.id}`);
  return { ok: true, message: "Merci, vos réponses sont bien enregistrées." };
}

// Le client dépose un fichier de son brief (logo, éléments visuels). Stocké sur
// Vercel Blob via le modèle Photo, dans le dossier réservé DOSSIER_BRIEF (exclu
// de la galerie mensuelle). Suppression : deletePhoto (déjà cloisonnée par token).
export async function uploadFichierBrief(
  token: string,
  formData: FormData,
): Promise<{ ok: boolean; error?: string }> {
  const client = await clientFromToken(token);
  if (!client) return { ok: false, error: "Accès invalide." };

  if (!process.env.BLOB_READ_WRITE_TOKEN)
    return { ok: false, error: "Stockage non configuré (BLOB_READ_WRITE_TOKEN absent)." };

  const file = formData.get("file");
  if (!(file instanceof File)) return { ok: false, error: "Aucun fichier." };
  const accepte = file.type.startsWith("image/") || file.type === "application/pdf";
  if (!accepte)
    return { ok: false, error: "Formats acceptés : images (PNG, JPG, SVG…) et PDF." };
  if (file.size > 20 * 1024 * 1024)
    return { ok: false, error: "Fichier trop lourd (20 Mo max)." };

  const used = await totalStockage();
  if (used + file.size > QUOTA_BYTES)
    return { ok: false, error: "Quota de stockage atteint." };

  const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-60);
  const pathname = `portail/${client.id}/brief/${randomUUID()}-${safe}`;
  let url: string;
  try {
    const blob = await put(pathname, file, {
      access: "public",
      contentType: file.type,
    });
    url = blob.url;
  } catch {
    return { ok: false, error: "Échec de l'envoi du fichier." };
  }

  await prisma.photo.create({
    data: {
      clientId: client.id,
      dossier: DOSSIER_BRIEF,
      nom: file.name.slice(0, 120),
      url,
      pathname,
      taille: file.size,
    },
  });

  revalidatePath(`/portail/${token}`);
  revalidatePath(`/clients/${client.id}`);
  return { ok: true };
}

// --- Côté admin : espace projet ---

// Enregistre le texte d'accueil de l'espace projet (brouillon IA relu/édité).
export async function enregistrerIntroPortail(
  clientId: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const texte = String(formData.get("portailIntro") ?? "").trim();
  const client = await prisma.client.update({
    where: { id: clientId },
    data: { portailIntro: texte || null },
  });

  revalidatePath(`/clients/${clientId}`);
  if (client.portailToken) revalidatePath(`/portail/${client.portailToken}`);
  return { ok: true, message: texte ? "Accueil publié sur l'espace client." : "Accueil retiré." };
}

// Publie une actu d'avancement dans l'espace projet, et notifie le client par
// email si demandé (SMTP configuré + email client renseigné).
export async function publierUpdate(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const parsed = parseForm(portailUpdateSchema, formData);
  if (!parsed.ok) return parsed.state;
  const { clientId, titre, contenu, envoyerEmail, origin } = parsed.data;

  const client = await prisma.client.findUnique({ where: { id: clientId } });
  if (!client) return { ok: false, message: "Client introuvable." };

  const update = await prisma.portailUpdate.create({
    data: { clientId, titre, contenu },
  });

  let message = "Actu publiée sur l'espace client.";
  if (envoyerEmail) {
    if (!client.email) {
      message = "Actu publiée, mais pas de mail : le client n'a pas d'email renseigné.";
    } else if (!smtpConfigured()) {
      message = "Actu publiée, mais pas de mail : SMTP non configuré.";
    } else {
      const lien =
        origin && client.portailActif && client.portailToken
          ? `${origin}/portail/${client.portailToken}`
          : null;
      const texte = sansCadratin(
        [
          `Bonjour ${client.nom},`,
          `Du nouveau sur votre projet : ${titre}`,
          contenu ?? null,
          lien
            ? `Retrouvez tout l'avancement sur votre espace :\n${lien}`
            : null,
          `Maxence`,
        ]
          .filter(Boolean)
          .join("\n\n"),
      );
      const res = await sendMail({
        to: client.email,
        subject: sansCadratin(`Votre projet avance : ${titre}`),
        text: texte,
      });
      if (res.ok) {
        await prisma.portailUpdate.update({
          where: { id: update.id },
          data: { emailEnvoyeLe: new Date() },
        });
        message = `Actu publiée et envoyée à ${client.email}.`;
      } else {
        message = `Actu publiée, mais l'email a échoué : ${res.error}`;
      }
    }
  }

  revalidatePath(`/clients/${clientId}`);
  if (client.portailToken) revalidatePath(`/portail/${client.portailToken}`);
  return { ok: true, message };
}

// Supprime une actu de l'espace projet.
export async function supprimerUpdate(
  id: string,
  clientId: string,
): Promise<void> {
  const client = await prisma.client.findUnique({ where: { id: clientId } });
  await prisma.portailUpdate.delete({ where: { id } });
  revalidatePath(`/clients/${clientId}`);
  if (client?.portailToken) revalidatePath(`/portail/${client.portailToken}`);
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
