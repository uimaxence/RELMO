// Référentiels partagés (libellés FR ↔ valeurs stockées en base).

export type Option = { value: string; label: string };

export const SITE_STATUTS: Option[] = [
  { value: "actif", label: "Actif" },
  { value: "en_pause", label: "En pause" },
  { value: "archive", label: "Archivé" },
];

export const CONTRAT_STATUTS: Option[] = [
  { value: "actif", label: "Actif" },
  { value: "en_pause", label: "En pause" },
  { value: "resilie", label: "Résilié" },
];

export const RECURRENCES: Option[] = [
  { value: "mensuelle", label: "Mensuelle" },
  { value: "hebdomadaire", label: "Hebdomadaire" },
  { value: "a_la_demande", label: "À la demande" },
];

export const LIVRABLE_STATUTS: Option[] = [
  { value: "a_faire", label: "À faire" },
  { value: "fait", label: "Fait" },
  { value: "non_applicable", label: "Non applicable" },
];

export const CLIENT_STATUTS: Option[] = [
  { value: "prospect", label: "Prospect" },
  { value: "actif", label: "Actif" },
  { value: "ancien", label: "Ancien" },
];

// Formules de la grille publique (cf. brief §4). Sert à tagger un devis/contrat
// et à suivre « signé à 700 / 850 / 1000 » (paliers). Les prix vivent dans Reglage
// (palierEssentiel / palierPro / tarifSuivi) car ils montent au fil des références.
export const FORMULES: Option[] = [
  { value: "essentiel", label: "Essentiel" },
  { value: "pro", label: "Pro" },
  { value: "suivi", label: "Suivi & SEO" },
  { value: "sur_mesure", label: "Sur-mesure" },
];

// Prospection sortante — repères du brief §2 (machine de volume).
export const PROSPECTION_OBJECTIF_MENSUEL = 130; // envois/mois visés (~120-150)
export const PROSPECTION_TAUX_REPONSE_MIN = 2; // % en-dessous duquel ajuster accroche/cible

// Campagne d'envoi (SMTP). Garde-fous délivrabilité (cf. brief §2 / §6).
export const CAMPAGNE_PLAFOND = 20; // mails max par lancement
export const CAMPAGNE_DELAI_SEC = 30; // délai entre deux envois (throttle)
// Mention opt-out RGPD par défaut (éditable dans les réglages campagne).
export const DEFAUT_OPT_OUT =
  "Vous ne souhaitez pas être recontacté ? Répondez simplement « STOP » et je vous retire aussitôt.";

// Ordre = progression du pipeline (F10).
export const DEVIS_STATUTS: Option[] = [
  { value: "brouillon", label: "Brouillon" },
  { value: "envoye", label: "Envoyé" },
  { value: "en_nego", label: "En négo" },
  { value: "accepte", label: "Accepté" },
  { value: "refuse", label: "Refusé" },
  { value: "expire", label: "Expiré" },
];

// Canal d'acquisition d'un client (marketing / F14).
export const SOURCES: Option[] = [
  { value: "bouche_a_oreille", label: "Bouche-à-oreille" },
  { value: "reseau", label: "Réseau perso" },
  { value: "linkedin", label: "LinkedIn" },
  { value: "instagram", label: "Instagram" },
  { value: "inbound", label: "Site / inbound" },
  { value: "prospection", label: "Prospection sortante" },
  { value: "event", label: "Événement / salon" },
  { value: "ancien_client", label: "Ré-engagement" },
  { value: "autre", label: "Autre" },
];

export const CANAUX: Option[] = [
  { value: "whatsapp", label: "WhatsApp" },
  { value: "email", label: "E-mail" },
  { value: "tel", label: "Téléphone" },
  { value: "autre", label: "Autre" },
];

export const DIRECTIONS: Option[] = [
  { value: "sortant", label: "Sortant" },
  { value: "entrant", label: "Entrant" },
];

// Factures (portail client F15).
export const FACTURE_STATUTS: Option[] = [
  { value: "emise", label: "Émise" },
  { value: "payee", label: "Payée" },
  { value: "en_retard", label: "En retard" },
];

// To-do (Kanban hebdo).
export const TACHE_TYPES: Option[] = [
  { value: "livrable", label: "Livrable" },
  { value: "relance_devis", label: "Relance devis" },
  { value: "prospection", label: "Prospection" },
  { value: "brand", label: "Brand" },
  { value: "perso", label: "Perso" },
  { value: "admin", label: "Admin" },
  { value: "technique", label: "Technique" },
  { value: "autre", label: "Autre" },
];

// Catégories que l'IA peut attribuer à une tâche suggérée (cf. assistant).
export const TACHE_CATEGORIES_IA = [
  "prospection",
  "brand",
  "perso",
  "admin",
  "technique",
  "autre",
] as const;

export const TACHE_PRIORITES: Option[] = [
  { value: "basse", label: "Basse" },
  { value: "normale", label: "Normale" },
  { value: "haute", label: "Haute" },
];

// Catégories d'envies (wish-list / gamification).
export const ENVIE_CATEGORIES: Option[] = [
  { value: "bureau", label: "Bureau / setup" },
  { value: "materiel", label: "Matériel / tech" },
  { value: "formation", label: "Formation" },
  { value: "plaisir", label: "Plaisir / loisir" },
  { value: "autre", label: "Autre" },
];

// Canal du 1er contact d'un prospect (mail auto, ou DM manuel LinkedIn/Instagram).
export const CANAUX_CONTACT: Option[] = [
  { value: "email", label: "E-mail" },
  { value: "linkedin", label: "LinkedIn" },
  { value: "instagram", label: "Instagram" },
];

// Prospection sortante — suivi d'un prospect découvert (avant conversion client).
export const PROSPECT_STATUTS: Option[] = [
  { value: "nouveau", label: "Nouveau" },
  { value: "a_contacter", label: "À contacter" },
  { value: "contacte", label: "Contacté" },
  { value: "ecarte", label: "Écarté" },
  { value: "converti", label: "Converti" },
];

// Délai par défaut avant relance d'un prospect contacté (jours).
export const PROSPECT_RELANCE_JOURS = 5;

// Relances automatiques (cron quotidien). Garde-fous délivrabilité + réputation.
export const RELANCE_MAX = 2; // relances auto max par prospect, puis on lâche
export const RELANCE_AUTO_PLAFOND_JOUR = 12; // relances auto max par passage du cron
export const RELANCE_AUTO_DELAI_SEC = 3; // délai entre deux envois de relance (throttle)

// Prospection automatique (cron 2×/jour). Découverte multi-secteurs puis audit,
// les prospects prêts (accroche générée) sont mis en file d'envoi (à valider en 1 clic).
// AUCUN envoi automatique ici : seul l'utilisateur envoie depuis la file.
export const PROSPECTION_AUTO_KEYWORDS_PAR_SECTEUR = 3; // mots-clés tirés par secteur et par run (borne le coût Google Places)
export const PROSPECTION_AUTO_BUDGET_MS = 210_000; // budget d'audit par run (le backlog restant passe au run suivant)
export const PROSPECTION_AUTO_MAX_ITER = 25; // garde-fou anti-boucle sur l'audit

export function labelOf(options: Option[], value: string): string {
  return options.find((o) => o.value === value)?.label ?? value;
}
