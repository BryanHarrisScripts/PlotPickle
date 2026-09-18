"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, type MouseEvent } from "react";
import { applyStoryCommand } from "@/core/project/apply-command";
import { loadFoundationProject, saveFoundationProject } from "@/core/storage/foundation-project-browser";
import styles from "./preproduction-context-nav.module.css";

export type PreproductionArea = "outline" | "storyboard" | "previs";

const AREAS: Record<PreproductionArea, { label: string; href: string; depth: string }> = {
  outline: {
    label: "Outline",
    href: "/?workspace=dashboard",
    depth: "Story Cards → 24/96 Story Map · source evidence",
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

const LEARN_BY_AREA: Record<PreproductionArea, readonly { lessonId: string; label: string }[]> = {
  outline: [
    { lessonId: "24b-structure-guide", label: "Structure · Grid as guide" },
    { lessonId: "mood-colour-visual-language", label: "Visual language" },
  ],
  storyboard: [
    { lessonId: "early-visual-development", label: "Concept → Storyboard frame" },
    { lessonId: "essentials-screen-evidence", label: "Screen evidence" },
  ],
  previs: [
    { lessonId: "early-visual-development", label: "Frame → Production keyframe" },
    { lessonId: "essentials-screen-evidence", label: "Playable visual evidence" },
  ],
};

function boundedBlock(value: string | null) {
  const number = Number(value || 0);
  return Number.isFinite(number) && number >= 1 && number <= 24 ? Math.trunc(number) : null;
}

function boundedMini(value: string | null) {
  const number = Number(value || 0);
  return Number.isFinite(number) && number >= 1 && number <= 4 ? Math.trunc(number) : null;
}

function withAddress(href: string, blockNumber: number | null, miniBlockNumber: number | null) {
  const url = new URL(href, "https://plotpickle.local");
  if (blockNumber) url.searchParams.set("block", String(blockNumber));
  if (miniBlockNumber) url.searchParams.set("mini", String(miniBlockNumber));
  return `${url.pathname}${url.search}`;
}

function learnHref(lessonId: string, returnPath: string) {
  const query = new URLSearchParams({
    workspace: "learn",
    lesson: lessonId,
    from: "preproduction",
    return: returnPath,
  });
  return `/?${query.toString()}`;
}

function openContextLesson(event: MouseEvent<HTMLAnchorElement>, lessonId: string, href: string) {
  event.preventDefault();
  try {
    const project = loadFoundationProject();
    const next = applyStoryCommand(project, {
      type: "lesson.open",
      lessonId,
      occurredAt: new Date().toISOString(),
    });
    saveFoundationProject(next);
  } catch {
    // LEARN can still open without an active PPF project; its normal recovery
    // path remains authoritative for project loading.
  }
  window.location.assign(href);
}

export default function PreproductionContextNav({
  area,
  blockNumber,
}: {
  readonly area: PreproductionArea;
  readonly blockNumber?: number;
}) {
  const [routeBlock, setRouteBlock] = useState<number | null>(null);
  const [routeMini, setRouteMini] = useState<number | null>(null);

  useEffect(() => {
    const query = new URLSearchParams(window.location.search);
    setRouteBlock(boundedBlock(query.get("block")));
    setRouteMini(boundedMini(query.get("mini")));
  }, []);

  const activeBlock = Number.isFinite(blockNumber) && (blockNumber ?? 0) >= 1 && (blockNumber ?? 0) <= 24
    ? Math.trunc(blockNumber!)
    : routeBlock;
  const currentReturn = useMemo(
    () => withAddress(AREAS[area].href, activeBlock, routeMini),
    [activeBlock, area, routeMini],
  );
  const outlineReturn = useMemo(
    () => withAddress("/?workspace=dashboard", activeBlock, routeMini),
    [activeBlock, routeMini],
  );
  const dashboardReturn = useMemo(
    () => withAddress("/?workspace=dashboard", activeBlock, routeMini),
    [activeBlock, routeMini],
  );
  const contextualReturn = encodeURIComponent(outlineReturn);

  return (
    <section className={styles.context} aria-label="PRE-PRODUCTION context">
      <div className={styles.identity}>
        <span>PRE-PRODUCTION</span>
        <strong>{AREAS[area].label}</strong>
        {activeBlock ? (
          <small>
            Block {String(activeBlock).padStart(2, "0")}{routeMini ? ` · Mini-Block ${routeMini}` : ""}
          </small>
        ) : <small>Current project</small>}
      </div>

      <nav className={styles.stageNav} aria-label="PRE-PRODUCTION stages">
        {(Object.keys(AREAS) as PreproductionArea[]).map((stage) => (
          <Link
            aria-current={stage === area ? "page" : undefined}
            data-active={stage === area ? "true" : "false"}
            href={withAddress(AREAS[stage].href, activeBlock, routeMini)}
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

      <div className={styles.learn} aria-label={`${AREAS[area].label} LEARN help`}>
        <span>LEARN</span>
        {LEARN_BY_AREA[area].map((lesson) => {
          const href = learnHref(lesson.lessonId, currentReturn);
          return (
            <Link
              href={href}
              key={lesson.lessonId}
              onClick={(event) => openContextLesson(event, lesson.lessonId, href)}
            >
              {lesson.label}
            </Link>
          );
        })}
      </div>

      {area === "outline" ? (
        <div className={styles.tools} aria-label="Outline contextual tools">
          <span>Context tools</span>
          <Link href={`/craftloop?from=preproduction&return=${contextualReturn}`}>CraftLoop · Practice</Link>
          <Link href={`/pageflow?from=preproduction&return=${contextualReturn}`}>PageFlow · Diagnostic</Link>
        </div>
      ) : null}

      <Link className={styles.dashboardExit} href={dashboardReturn}>Dashboard</Link>
    </section>
  );
}
