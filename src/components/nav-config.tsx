import {
  LayoutDashboard,
  ListTodo,
  Users,
  ListChecks,
  Euro,
  Handshake,
  Gift,
  Target,
} from "lucide-react";

// Source unique de la navigation (sidebar + fil d'Ariane du header).
export type NavItem = {
  title: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  // Sections filles (ex. fiches) qui doivent rester actives sous cet onglet.
  match?: (pathname: string) => boolean;
};

export const NAV: NavItem[] = [
  { title: "Tableau de bord", href: "/", icon: LayoutDashboard },
  { title: "To-do de la semaine", href: "/semaine", icon: ListTodo },
  {
    title: "Clients & sites",
    href: "/clients",
    icon: Users,
    match: (p) => p.startsWith("/clients") || p.startsWith("/sites"),
  },
  { title: "Prospection", href: "/prospection", icon: Target },
  { title: "Pipeline & devis", href: "/pipeline", icon: Handshake },
  { title: "Livrables du mois", href: "/livrables", icon: ListChecks },
  { title: "MRR", href: "/mrr", icon: Euro },
  { title: "Wish-list", href: "/wishlist", icon: Gift },
];

export function activeNavItem(pathname: string): NavItem | undefined {
  return (
    NAV.find((item) =>
      item.match ? item.match(pathname) : pathname === item.href,
    ) ??
    // fallback : plus long préfixe
    NAV.filter((i) => i.href !== "/" && pathname.startsWith(i.href)).sort(
      (a, b) => b.href.length - a.href.length,
    )[0]
  );
}
