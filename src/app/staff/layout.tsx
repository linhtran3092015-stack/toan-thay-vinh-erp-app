import type { ReactNode } from "react";

import { AuthenticatedAppShell } from "@/components/layout/authenticated-app-shell";

export default function StaffLayout({
  children,
}: {
  children: ReactNode;
}) {
  return <AuthenticatedAppShell>{children}</AuthenticatedAppShell>;
}
