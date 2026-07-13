import { redirect } from "next/navigation";

// Fusionné dans l'écran unique /prospection (onglet « Envoyer »).
export default function CampagneRedirect() {
  redirect("/prospection?vue=envoyer");
}
