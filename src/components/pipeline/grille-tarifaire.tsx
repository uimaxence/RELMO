import { Card, CardContent } from "@/components/ui/card";
import { PaliersForm } from "@/components/pipeline/paliers-form";
import { euros } from "@/lib/format";

// Grille tarifaire de référence (aide-mémoire de négo — cf. brief §4). Prix publics
// « à partir de » qui filtrent les prospects sans budget et empêchent de brader.
export function GrilleTarifaire({
  palierEssentiel,
  palierPro,
  tarifSuivi,
}: {
  palierEssentiel: number;
  palierPro: number;
  tarifSuivi: number;
}) {
  const formules = [
    {
      nom: "Essentiel",
      prix: `à partir de ${euros(palierEssentiel)}`,
      contenu: "Vitrine 5-6 pages, design sur mesure, SEO local de base, responsive.",
      ancre: false,
    },
    {
      nom: "Pro",
      prix: `à partir de ${euros(palierPro)}`,
      contenu: "Essentiel + rédaction des contenus, pages métiers, photos, Google Business.",
      ancre: true,
    },
    {
      nom: "Suivi & SEO",
      prix: `${euros(tarifSuivi)}/mois`,
      contenu: "Hébergement, mises à jour, suivi SEO local, modifs, rapport mensuel.",
      ancre: false,
    },
  ];

  return (
    <Card>
      <CardContent className="space-y-4 pt-6">
        <div className="flex items-center justify-between gap-3">
          <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Grille tarifaire · paliers courants
          </span>
          <PaliersForm
            palierEssentiel={palierEssentiel}
            palierPro={palierPro}
            tarifSuivi={tarifSuivi}
          />
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          {formules.map((f) => (
            <div
              key={f.nom}
              className={`rounded-lg border p-3 ${
                f.ancre ? "border-accent-brand/40 bg-accent-brand/5" : "bg-muted/30"
              }`}
            >
              <p className="font-heading text-sm font-semibold uppercase tracking-tight">
                {f.nom}
              </p>
              <p className="mt-0.5 font-mono text-base font-medium tabular-nums text-accent-brand">
                {f.prix}
              </p>
              <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                {f.contenu}
              </p>
            </div>
          ))}
        </div>

        <p className="text-xs text-muted-foreground">
          Le « à partir de » garde la marge pour facturer le scope en plus. Le Pro
          sert d&apos;ancrage — à côté de {euros(palierPro)}, l&apos;Essentiel paraît
          raisonnable. Jamais de hausse « selon les résultats » : par calendrier écrit.
        </p>
      </CardContent>
    </Card>
  );
}
