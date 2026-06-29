"use server";

// Frontière "use server" de l'assistant IA. Wrappers fins appelés depuis l'UI
// (client) ; ils renvoient l'AiResult sérialisable tel quel. Aucune écriture DB,
// aucun revalidate : la génération ne modifie rien, c'est un brouillon.

import {
  genererMessageProspection,
  genererDevisBrouillon,
  genererRelanceNego,
  genererAccrochesProspection,
  genererIntroRapport,
} from "@/lib/ai/assistant";
import type { AiResult } from "@/lib/ai/client";

export async function actionMessageProspection(
  clientId: string,
): Promise<AiResult> {
  return genererMessageProspection(clientId);
}

export async function actionDevisBrouillon(
  clientId: string,
): Promise<AiResult> {
  return genererDevisBrouillon(clientId);
}

export async function actionRelanceNego(devisId: string): Promise<AiResult> {
  return genererRelanceNego(devisId);
}

export async function actionAccrochesProspection(): Promise<AiResult> {
  return genererAccrochesProspection();
}

export async function actionIntroRapport(
  clientId: string,
  periode: string,
  livres: string[],
): Promise<AiResult> {
  return genererIntroRapport(clientId, periode, livres);
}
