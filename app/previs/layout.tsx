import type { ReactNode } from "react";
import PreproductionContextNav from "../_components/preproduction/preproduction-context-nav";

export default function PrevisLayout({ children }: { readonly children: ReactNode }) {
  return (
    <>
      <PreproductionContextNav area="previs" />
      {children}
    </>
  );
}
