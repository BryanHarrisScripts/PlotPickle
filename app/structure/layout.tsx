import type { ReactNode } from "react";
import PreproductionContextNav from "../_components/preproduction/preproduction-context-nav";
import PreproductionVisualThinking from "../_components/preproduction/preproduction-visual-thinking";
import styles from "./preproduction-context.module.css";

export default function StructureLayout({ children }: { readonly children: ReactNode }) {
  return (
    <div className={styles.boundary}>
      <PreproductionContextNav area="outline" />
      <PreproductionVisualThinking />
      {children}
    </div>
  );
}
