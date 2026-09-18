"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import styles from "./preproduction-capability-return.module.css";

function safeReturnPath(value: string | null) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return "/?workspace=dashboard";
  return value;
}

function returnLabel(path: string) {
  if (path.startsWith("/storyboard")) return "Return to Storyboard";
  if (path.startsWith("/previs")) return "Return to Previs";
  return "Return to Outline";
}

function dashboardReturnPath(returnPath: string) {
  const source = new URL(returnPath, "https://plotpickle.local");
  const destination = new URL("/?workspace=dashboard", "https://plotpickle.local");
  const block = source.searchParams.get("block");
  const mini = source.searchParams.get("mini");
  if (block) destination.searchParams.set("block", block);
  if (mini) destination.searchParams.set("mini", mini);
  return `${destination.pathname}${destination.search}`;
}

export default function PreproductionCapabilityReturn() {
  const [context, setContext] = useState<{ active: boolean; returnPath: string }>({
    active: false,
    returnPath: "/?workspace=dashboard",
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
      <Link href={context.returnPath}>{returnLabel(context.returnPath)}</Link>
      <Link href={dashboardReturnPath(context.returnPath)}>Dashboard</Link>
    </nav>
  );
}
