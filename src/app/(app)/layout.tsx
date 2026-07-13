import { AppSidebar } from "@/components/app-sidebar";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import { CustomSidebarTrigger } from "@/components/custom-sidebar-trigger";
import { HeaderBreadcrumb } from "@/components/header-breadcrumb";

// Layout de l'app interne (cockpit) : sidebar + header. Le portail client public
// (/portail/[token]) vit hors de ce groupe et n'hérite donc pas de ce chrome.
export default function AppLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <SidebarProvider>
      <AppSidebar />
      {/* min-w-0 : sans ça, un enfant large (table de prospection) élargit toute la
          colonne au lieu de scroller dans son propre conteneur → scroll horizontal. */}
      <SidebarInset className="min-w-0">
        <header className="flex h-14 shrink-0 items-center gap-2 border-b px-4">
          <CustomSidebarTrigger />
          <Separator
            orientation="vertical"
            className="mr-1 h-4 data-[orientation=vertical]:self-center"
          />
          <HeaderBreadcrumb />
        </header>
        <main className="flex-1 p-4 md:p-6">{children}</main>
      </SidebarInset>
    </SidebarProvider>
  );
}
