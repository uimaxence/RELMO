// Ligne de prospect telle qu'affichée dans la table et la fiche (données déjà
// mises en forme côté serveur). Type partagé par la liste, la fiche et les vues.
export type ProspectRow = {
  id: string;
  nom: string;
  site: string | null;
  ville: string | null;
  activite: string | null;
  telephone: string | null;
  email: string | null;
  statutAudit: string;
  score: number | null;
  filtreTier: string | null;
  filtreTotal: number | null;
  filtreBesoin: boolean | null;
  filtrePotentiel: number | null;
  filtreProbleme: number | null;
  filtreCroissance: number | null;
  filtreAcces: number | null;
  filtreTrace: string | null;
  effectif: number | null;
  signauxCroissance: string | null;
  design: string | null;
  anciennete: string | null;
  pointsFaibles: string | null;
  cible: string; // client | partenaire
  segment: string; // classique | pro
  metier: string | null;
  flagConcurrent: boolean;
  flagAQualifier: boolean;
  atouts: string | null;
  nbAvis: number | null;
  accrocheEmail: string | null;
  accrocheLinkedin: string | null;
  dirigeant: string | null;
  linkedin: string | null;
  note: string | null;
  statut: string;
  campagne: string | null;
  canalContact: string | null;
  messageEnvoye: string | null;
  contacteLeFr: string | null;
  relanceLeFr: string | null;
  relanceDue: boolean;
  nbRelances: number;
  reponduLeFr: string | null;
};
