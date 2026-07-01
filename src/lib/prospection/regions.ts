// Régions FR → liste de villes à requêter sur Google Places.
// On interroge `mot-clé + ville` (l'API Text Search plafonne par requête, donc la
// granularité par ville maximise la couverture). Pays de la Loire (région d'Angers)
// a une couverture fine des 5 départements ; les autres listent les villes clés.

export const REGIONS: Record<string, string[]> = {
  "Pays de la Loire": [
    // 49 Maine-et-Loire
    "Angers", "Cholet", "Saumur", "Beaupréau-en-Mauges", "Avrillé", "Trélazé",
    "Les Ponts-de-Cé", "Saint-Barthélemy-d'Anjou", "Segré-en-Anjou Bleu",
    "Doué-en-Anjou", "Chemillé-en-Anjou", "Baugé-en-Anjou",
    // 44 Loire-Atlantique
    "Nantes", "Saint-Nazaire", "Saint-Herblain", "Rezé", "Vertou",
    "Saint-Sébastien-sur-Loire", "La Baule-Escoublac", "Ancenis", "Pornic",
    // 85 Vendée
    "La Roche-sur-Yon", "Les Sables-d'Olonne", "Challans", "Les Herbiers",
    "Fontenay-le-Comte", "Montaigu-Vendée",
    // 72 Sarthe
    "Le Mans", "La Flèche", "Sablé-sur-Sarthe", "Allonnes",
    // 53 Mayenne
    "Laval", "Mayenne", "Château-Gontier-sur-Mayenne", "Évron",
  ],
  Bretagne: ["Rennes", "Brest", "Quimper", "Lorient", "Vannes", "Saint-Malo", "Saint-Brieuc", "Fougères", "Lannion"],
  "Nouvelle-Aquitaine": ["Bordeaux", "Limoges", "Poitiers", "La Rochelle", "Pau", "Bayonne", "Angoulême", "Niort"],
  "Île-de-France": ["Paris", "Boulogne-Billancourt", "Versailles", "Nanterre", "Créteil", "Saint-Denis", "Argenteuil"],
  "Auvergne-Rhône-Alpes": ["Lyon", "Grenoble", "Saint-Étienne", "Clermont-Ferrand", "Annecy", "Villeurbanne", "Valence", "Chambéry"],
  Occitanie: ["Toulouse", "Montpellier", "Nîmes", "Perpignan", "Béziers", "Albi", "Carcassonne"],
  "Provence-Alpes-Côte d'Azur": ["Marseille", "Nice", "Toulon", "Aix-en-Provence", "Avignon", "Cannes", "Antibes"],
  "Grand Est": ["Strasbourg", "Reims", "Metz", "Nancy", "Mulhouse", "Troyes", "Colmar"],
  "Hauts-de-France": ["Lille", "Amiens", "Roubaix", "Tourcoing", "Dunkerque", "Arras", "Beauvais"],
  Normandie: ["Rouen", "Caen", "Le Havre", "Cherbourg-en-Cotentin", "Évreux", "Alençon"],
  "Centre-Val de Loire": ["Tours", "Orléans", "Bourges", "Blois", "Chartres", "Châteauroux"],
};

export const REGION_DEFAUT = "Pays de la Loire";

export const REGION_OPTIONS = Object.keys(REGIONS).map((value) => ({
  value,
  label: value,
}));
