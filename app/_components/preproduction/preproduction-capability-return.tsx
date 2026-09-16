"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import styles from "./preproduction-capability-return.module.css";

function safeReturnPath(value: string | null) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return "/structure";
  return value;
}

export default function PreproductionCapabilityReturn() {
  const [context, setContext] = useState<{ active: boolean; returnPath: string }>({
    active: false,
    returnPath: "/structure",
  });

  useEffect(() => {
    const search = new URLSearchParams(window.location.search);
    setContext({
      active: search.get("from") === "preproduction",
      returnPath: safeReturnPath(search.get("return")),
    });
  }, []);

  if (!context.active) return null;

  return (
    <nav className={styles.returnNav} aria-label="PRE-PRODUCTION return">
      <div>
        <span>CONTEXT TOOL</span>
        <strong>PRE-PRODUCTION remains your parent workspace.</strong>
      </div>
      <Link href={context.returnPath}>Return to Outline</Link>
      <Link href="/?workspace=dashboard">Dashboard</Link>
    </nav>
  );
}
