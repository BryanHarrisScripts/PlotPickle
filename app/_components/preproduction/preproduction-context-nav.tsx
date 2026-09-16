"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import styles from "./preproduction-context-nav.module.css";

export type PreproductionArea = "outline" | "storyboard" | "previs";

const AREAS: Record<PreproductionArea, { label: string; href: string; depth: string }> = {
  outline: {
    label: "Outline",
    href: "/structure",
    depth: "Structure → Breakdown · Scenes + Assets",
  },
  storyboard: {
    label: "Storyboard",
    href: "/storyboard",
    depth: "Visual Beats → Shots → Frames",
  },
  previs: {
    label: "Previs",
    href: "/previs",
    depth: "Timing → Production Plan · Provider-neutral handoff",
  },
};

function boundedBlock(value: string | null) {
  const number = Number(value || 0);
  return Number.isFinite(number) && number >= 1 && number <= 24 ? Math.trunc(number) : null;
}

function withBlock(href: string, blockNumber: number | null) {
  return blockNumber ? `${href}?block=${blockNumber}` : href;
}

export default function PreproductionContextNav({
  area,
  blockNumber,
}: {
  readonly area: PreproductionArea;
  readonly blockNumber?: number;
}) {
  const [routeBlock, setRouteBlock] = useState<number | null>(null);

  useEffect(() => {
    setRouteBlock(boundedBlock(new URLSearchParams(window.location.search).get("block")));
  }, []);

  const activeBlock = Number.isFinite(blockNumber) && (blockNumber ?? 0) >= 1 && (blockNumber ?? 0) <= 24
    ? Math.trunc(blockNumber!)
    : routeBlock;
  const outlineReturn = useMemo(() => withBlock("/structure", activeBlock), [activeBlock]);
  const contextualReturn = encodeURIComponent(outlineReturn);

  return (
    <section className={styles.context} aria-label="PRE-PRODUCTION context">
      <div className={styles.identity}>
        <span>PRE-PRODUCTION</span>
        <strong>{AREAS[area].label}</strong>
        {activeBlock ? <small>Block {String(activeBlock).padStart(2, "0")}</small> : <small>Current project</small>}
      </div>

      <nav className={styles.stageNav} aria-label="PRE-PRODUCTION stages">
        {(Object.keys(AREAS) as PreproductionArea[]).map((stage) => (
          <Link
            aria-current={stage === area ? "page" : undefined}
            data-active={stage === area ? "true" : "false"}
            href={withBlock(AREAS[stage].href, activeBlock)}
            key={stage}
          >
            {AREAS[stage].label}
          </Link>
        ))}
      </nav>

      <div className={styles.depth}>
        <span>Nested depth</span>
        <strong>{AREAS[area].depth}</strong>
      </div>

      {area === "outline" ? (
        <div className={styles.tools} aria-label="Outline contextual tools">
          <span>Context tools</span>
          <Link href={`/craftloop?from=preproduction&return=${contextualReturn}`}>CraftLoop · Practice</Link>
          <Link href={`/pageflow?from=preproduction&return=${contextualReturn}`}>PageFlow · Diagnostic</Link>
        </div>
      ) : null}

      <Link className={styles.dashboardExit} href="/?workspace=dashboard">Dashboard</Link>
    </section>
  );
}
