"use client";

import { usePathname } from "next/navigation";

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
} from "@/components/ui/breadcrumb";
import { activeNavItem } from "@/components/nav-config";

export function HeaderBreadcrumb() {
  const pathname = usePathname();
  const item = activeNavItem(pathname);
  if (!item) return null;
  const Icon = item.icon;

  return (
    <Breadcrumb>
      <BreadcrumbList>
        <BreadcrumbItem>
          <BreadcrumbPage className="flex items-center gap-2">
            <Icon className="size-3.5" />
            {item.title}
          </BreadcrumbPage>
        </BreadcrumbItem>
      </BreadcrumbList>
    </Breadcrumb>
  );
}
