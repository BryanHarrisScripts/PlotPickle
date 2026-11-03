import type { ReactNode } from "react";
import PreproductionContextNav from "../_components/preproduction/preproduction-context-nav";
import StudioProductionRouteShell from "../skin-v1/studio-production-route-shell";

export default function StoryboardLayout({ children }: { readonly children: ReactNode }) {
  return (
    <StudioProductionRouteShell activeShortcutId="storyboard">
      <PreproductionContextNav area="storyboard" />
      {children}
    </StudioProductionRouteShell>
  );
}
