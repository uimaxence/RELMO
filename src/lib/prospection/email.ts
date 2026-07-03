import { DEFAUT_OPT_OUT } from "@/lib/constants";

// Assemble le mail final à partir de l'accroche générée (qui commence par une
// ligne « Objet : … ») + les contenus de campagne (lien de réalisation, signature,
// opt-out). Pur & testable — pas d'I/O.

export type ContenusCampagne = {
  signatureEmail?: string | null;
  optOutTexte?: string | null;
  lienRealisation?: string | null;
};

export type EmailAssemble = { objet: string; corps: string };

// Placeholder inséré par le prompt quand aucune URL réelle n'est connue.
const PLACEHOLDER_LIEN = "[lien d'une réalisation]";

// Validité d'un email (garde-fou EMAIL_INVALIDE). Pur → utilisable côté client
// (ne pas importer depuis mailer.ts qui embarque nodemailer, server-only).
export function emailValide(email: string | null | undefined): boolean {
  return !!email && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim());
}

// Sépare la ligne « Objet : … » du corps. Tolérant : si absente, objet vide.
export function extraireObjet(accroche: string): { objet: string; corps: string } {
  const lignes = accroche.replace(/\r\n/g, "\n").split("\n");
  const idx = lignes.findIndex((l) => /^\s*objet\s*:/i.test(l));
  if (idx === -1) return { objet: "", corps: accroche.trim() };
  const objet = lignes[idx].replace(/^\s*objet\s*:/i, "").trim();
  const corps = lignes
    .filter((_, i) => i !== idx)
    .join("\n")
    .trim();
  return { objet, corps };
}

// Construit {objet, corps} prêt à envoyer. Le corps intègre (dans l'ordre) :
// message → signature → mention opt-out. Le placeholder de lien est remplacé si
// une URL est fournie, sinon laissé tel quel (à compléter à la main).
export function construireEmail(
  accroche: string,
  contenus: ContenusCampagne = {},
): EmailAssemble {
  const { objet, corps } = extraireObjet(accroche);

  let texte = corps;
  const lien = contenus.lienRealisation?.trim();
  if (lien) {
    // Remplace le placeholder par l'URL là où l'IA l'a posé.
    texte = texte.split(PLACEHOLDER_LIEN).join(lien);
  } else {
    // Pas de lien configuré : on retire le jeton pour ne pas envoyer « [lien…] ».
    texte = texte.split(PLACEHOLDER_LIEN).join("").replace(/[ \t]{2,}/g, " ");
  }

  const blocs = [texte.trim()];
  // Garantit la présence du portfolio même si l'IA a omis le placeholder
  // (adhérence irrégulière du modèle) : ligne dédiée avant la signature.
  if (lien && !texte.includes(lien)) blocs.push(`Mon portfolio : ${lien}`);

  const signature = contenus.signatureEmail?.trim();
  if (signature) blocs.push(signature);
  const optOut = (contenus.optOutTexte?.trim() || DEFAUT_OPT_OUT).trim();
  blocs.push("— — —\n" + optOut);

  return { objet: objet || "", corps: blocs.join("\n\n") };
}

// Reste-t-il un placeholder de lien non remplacé ? (avertissement UI avant envoi)
export function lienManquant(accroche: string, lien?: string | null): boolean {
  return accroche.includes(PLACEHOLDER_LIEN) && !lien?.trim();
}
