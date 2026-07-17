"use server";

import { revalidatePath } from "next/cache";

import { prisma } from "@/lib/db";
import { parserJournalIndy } from "@/lib/compta-import";
import { CATEGORIES_COMPTA, typeDeCategorie } from "@/lib/compta";
import { categoriserEcrituresIA } from "@/lib/ai/assistant";

export type ImportResult =
  | { ok: true; importees: number; ignorees: number; lignes: number; aCategoriser: number }
  | { ok: false; error: string };

// Import idempotent du journal Indy : parse → dédup (hash) → insertion.
export async function importerCsvCompta(csv: string): Promise<ImportResult> {
  if (!csv.trim()) return { ok: false, error: "Colle le contenu du CSV d'abord." };

  let parsed;
  try {
    parsed = parserJournalIndy(csv);
  } catch {
    return { ok: false, error: "CSV illisible. Vérifie que c'est bien l'export « journal » d'Indy." };
  }
  if (parsed.ecritures.length === 0) {
    return { ok: false, error: "Aucune écriture exploitable trouvée dans ce fichier." };
  }

  // Dédup : on n'insère que les hash absents.
  const hashes = parsed.ecritures.map((e) => e.hash);
  const existants = await prisma.ecritureCompta.findMany({
    where: { hash: { in: hashes } },
    select: { hash: true },
  });
  const dejaLa = new Set(existants.map((e) => e.hash));

  // Un même fichier peut contenir deux fois le même hash seulement si un bug de
  // rang survient ; on déduplique aussi en mémoire par sécurité.
  const vus = new Set<string>();
  const aInserer = parsed.ecritures.filter((e) => {
    if (dejaLa.has(e.hash) || vus.has(e.hash)) return false;
    vus.add(e.hash);
    return true;
  });

  if (aInserer.length > 0) {
    await prisma.ecritureCompta.createMany({
      data: aInserer.map((e) => ({
        date: e.date,
        libelle: e.libelle,
        compte: e.compte,
        libelleCompte: e.libelleCompte,
        montant: e.montant,
        sens: e.sens,
        type: e.type,
        categorie: e.categorie,
        periode: e.periode,
        hash: e.hash,
        source: "indy",
      })),
      skipDuplicates: true,
    });
    revalidatePath("/comptabilite");
    revalidatePath("/");
  }

  const aCategoriser = aInserer.filter((e) => e.type === "a_categoriser").length;
  return {
    ok: true,
    importees: aInserer.length,
    ignorees: parsed.ecritures.length - aInserer.length,
    lignes: parsed.lignesLues,
    aCategoriser,
  };
}

// Recatégorise une écriture (met à jour la catégorie ET le type dérivé).
export async function recategoriserEcriture(
  id: string,
  categorie: string,
): Promise<{ ok: boolean; error?: string }> {
  const connue = CATEGORIES_COMPTA.some((c) => c.value === categorie);
  if (!connue) return { ok: false, error: "Catégorie inconnue." };

  await prisma.ecritureCompta.update({
    where: { id },
    data: { categorie, type: typeDeCategorie(categorie) },
  });
  revalidatePath("/comptabilite");
  revalidatePath("/");
  return { ok: true };
}

export async function supprimerEcriture(id: string): Promise<void> {
  await prisma.ecritureCompta.delete({ where: { id } });
  revalidatePath("/comptabilite");
  revalidatePath("/");
}

// Catégorisation assistée : demande à l'IA de trancher les « à catégoriser »,
// applique les propositions fiables, renvoie le nombre traité.
export async function categoriserAvecIA(): Promise<
  { ok: true; traitees: number } | { ok: false; error: string }
> {
  const aTraiter = await prisma.ecritureCompta.findMany({
    where: { type: "a_categoriser" },
    orderBy: { date: "desc" },
    take: 60,
  });
  if (aTraiter.length === 0) return { ok: true, traitees: 0 };

  const res = await categoriserEcrituresIA(
    aTraiter.map((e) => ({
      id: e.id,
      libelle: e.libelle,
      libelleCompte: e.libelleCompte,
      sens: e.sens,
      montant: e.montant,
    })),
  );
  if (!res.ok) return res;

  let traitees = 0;
  for (const p of res.propositions) {
    if (p.categorie === "a_categoriser") continue;
    if (!CATEGORIES_COMPTA.some((c) => c.value === p.categorie)) continue;
    if (!aTraiter.some((e) => e.id === p.id)) continue;
    await prisma.ecritureCompta.update({
      where: { id: p.id },
      data: { categorie: p.categorie, type: typeDeCategorie(p.categorie) },
    });
    traitees += 1;
  }

  revalidatePath("/comptabilite");
  revalidatePath("/");
  return { ok: true, traitees };
}
