import type { ReactNode } from "react";
import PreproductionContextNav from "../_components/preproduction/preproduction-context-nav";
import StudioProductionRouteShell from "../skin-v1/studio-production-route-shell";

export default function PrevisLayout({ children }: { readonly children: ReactNode }) {
  return (
    <StudioProductionRouteShell activeShortcutId="graphic-novel">
      <PreproductionContextNav area="previs" />
      {children}
    </StudioProductionRouteShell>
  );
}
