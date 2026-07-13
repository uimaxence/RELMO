import { redirect } from "next/navigation";

// Fusionné dans l'écran unique /prospection (onglet « Prospecter »).
export default function RechercheRedirect() {
  redirect("/prospection");
}
