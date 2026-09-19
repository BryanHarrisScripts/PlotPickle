"use client";

import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import PreproductionCapabilityReturn from "../_components/preproduction/preproduction-capability-return";
import styles from "./preproduction-context.module.css";

export default function CraftLoopLayout({ children }: { readonly children: ReactNode }) {
  const [fromPreproduction, setFromPreproduction] = useState(false);

  useEffect(() => {
    setFromPreproduction(new URLSearchParams(window.location.search).get("from") === "preproduction");
  }, []);

  return (
    <div className={styles.boundary} data-craftloop-boundary="canonical" data-preproduction-context={fromPreproduction ? "true" : "false"}>
      <PreproductionCapabilityReturn />
      {children}
    </div>
  );
}
