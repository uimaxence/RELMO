import Link from "next/link";

export type ClientRef = { id: string; nom: string };

// Transforme le @mention du client lié en lien cliquable vers sa fiche.
export function renderLibelle(libelle: string, client?: ClientRef | null) {
  if (!client) return libelle;
  const token = `@${client.nom}`;
  const idx = libelle.indexOf(token);
  if (idx === -1) return libelle;
  return (
    <>
      {libelle.slice(0, idx)}
      <Link
        href={`/clients/${client.id}`}
        className="font-medium text-brand hover:underline"
        onClick={(e) => e.stopPropagation()}
      >
        {token}
      </Link>
      {libelle.slice(idx + token.length)}
    </>
  );
}
