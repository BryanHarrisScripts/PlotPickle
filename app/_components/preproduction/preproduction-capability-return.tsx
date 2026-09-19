"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import styles from "./preproduction-capability-return.module.css";

const INTERNAL_ORIGIN = "https://plotpickle.local";

type ReturnArea = "outline" | "storyboard" | "previs";
type ReturnTarget = {
  readonly area: ReturnArea;
  readonly block: number | null;
  readonly mini: number | null;
};

const DEFAULT_RETURN_TARGET: ReturnTarget = { area: "outline", block: null, mini: null };

function boundedStoryAddress(value: string | null, maximum: number) {
  if (!value || !/^\d+$/u.test(value)) return null;
  const parsed = Number.parseInt(value, 10);
  return Number.isInteger(parsed) && parsed >= 1 && parsed <= maximum ? parsed : null;
}

function safeReturnTarget(value: string | null): ReturnTarget {
  if (!value) return DEFAULT_RETURN_TARGET;

  let source: URL;
  try {
    source = new URL(value, INTERNAL_ORIGIN);
  } catch {
    return DEFAULT_RETURN_TARGET;
  }
  if (source.origin !== INTERNAL_ORIGIN) return DEFAULT_RETURN_TARGET;

  let area: ReturnArea;
  if (source.pathname === "/" && source.searchParams.get("workspace") === "dashboard") area = "outline";
  else if (source.pathname === "/storyboard") area = "storyboard";
  else if (source.pathname === "/previs") area = "previs";
  else return DEFAULT_RETURN_TARGET;

  return {
    area,
    block: boundedStoryAddress(source.searchParams.get("block"), 24),
    mini: boundedStoryAddress(source.searchParams.get("mini"), 4),
  };
}

function returnPath(target: ReturnTarget) {
  const route = target.area === "storyboard"
    ? "/storyboard"
    : target.area === "previs"
      ? "/previs"
      : "/?workspace=dashboard";
  const destination = new URL(route, INTERNAL_ORIGIN);
  if (target.block !== null) destination.searchParams.set("block", String(target.block));
  if (target.mini !== null) destination.searchParams.set("mini", String(target.mini));
  return `${destination.pathname}${destination.search}`;
}

function returnLabel(target: ReturnTarget) {
  if (target.area === "storyboard") return "Return to Storyboard";
  if (target.area === "previs") return "Return to Previs";
  return "Return to Outline";
}

function dashboardReturnPath(target: ReturnTarget) {
  const destination = new URL("/?workspace=dashboard", INTERNAL_ORIGIN);
  if (target.block !== null) destination.searchParams.set("block", String(target.block));
  if (target.mini !== null) destination.searchParams.set("mini", String(target.mini));
  return `${destination.pathname}${destination.search}`;
}

export default function PreproductionCapabilityReturn() {
  const [context, setContext] = useState<{ active: boolean; target: ReturnTarget }>({
    active: false,
    target: DEFAULT_RETURN_TARGET,
  });

  useEffect(() => {
    const search = new URLSearchParams(window.location.search);
    setContext({
      active: search.get("from") === "preproduction",
      target: safeReturnTarget(search.get("return")),
    });
  }, []);

  if (!context.active) return null;

  const safeReturnPath = returnPath(context.target);

  return (
    <nav className={styles.returnNav} data-skin-v1-local-chrome="return-navigation" aria-label="PRE-PRODUCTION return">
      <div>
        <span>CONTEXT TOOL</span>
        <strong>PRE-PRODUCTION remains your parent workspace.</strong>
      </div>
      <Link data-preproduction-return="true" href={safeReturnPath}>{returnLabel(context.target)}</Link>
      <Link href={dashboardReturnPath(context.target)}>Dashboard</Link>
    </nav>
  );
}
