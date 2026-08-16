"use client";

import Image from "next/image";
import type { ReactNode } from "react";
import styles from "./plotpickle-workspace-shell.module.css";

export type RootWorkspace = "learn" | "plan" | "wyrmwood" | "community" | "settings";

export const ROOT_NAV_ITEMS = [
  { id: "dashboard", relic: "/assets/workflow-relics/dashboard.webp", label: "Dashboard", detail: "Start", selectable: false },
  { id: "community", relic: "/assets/workflow-relics/community.svg", label: "Community", detail: "Guildhall", selectable: true },
  { id: "learn", relic: "/assets/workflow-relics/learn.webp", label: "Learn", detail: "Guides", selectable: true },
  { id: "plan", relic: "/assets/workflow-relics/plan.webp", label: "Plan", detail: "Design", selectable: true },
  { id: "build", relic: "/assets/workflow-relics/build.webp", label: "Build", detail: "Assemble", selectable: false },
  { id: "storyboard", relic: "/assets/workflow-relics/storyboard.webp", label: "Storyboard", detail: "Sketch", selectable: false },
  { id: "graphic-novel", relic: "/assets/workflow-relics/graphic-novel.webp", label: "Previs", detail: "Visualize", selectable: false },
  { id: "write", relic: "/assets/workflow-relics/write.webp", label: "Write", detail: "Draft", selectable: false },
  { id: "edit", relic: "/assets/workflow-relics/edit.webp", label: "Edit", detail: "Polish", selectable: false },
  { id: "feedback", relic: "/assets/workflow-relics/feedback.webp", label: "Feedback", detail: "Review", selectable: false },
  { id: "refine", relic: "/assets/workflow-relics/refine.webp", label: "Refine", detail: "Decide", selectable: false },
  { id: "reports", relic: "/assets/workflow-relics/reports.webp", label: "Reports", detail: "Deliver", selectable: false },
  { id: "wyrmwood", relic: "/assets/workflow-relics/game.webp", label: "Wyrmwood", detail: "Game", selectable: true },
  { id: "settings", relic: "/assets/workflow-relics/settings.svg", label: "Settings", detail: "Config", selectable: true },
] as const;

type RootNavItem = (typeof ROOT_NAV_ITEMS)[number];

function isRootWorkspace(id: RootNavItem["id"]): id is RootWorkspace {
  return id === "learn" || id === "plan" || id === "wyrmwood" || id === "community" || id === "settings";
}

function endsNavigationGroup(id: RootNavItem["id"]) {
  return id === "community" || id === "graphic-novel" || id === "reports";
}

export default function PlotPickleWorkspaceShell({
  activeWorkspace,
  children,
  onNavigate,
}: {
  readonly activeWorkspace: RootWorkspace;
  readonly children: ReactNode;
  readonly onNavigate: (workspace: RootWorkspace) => void;
}) {
  return (
    <div className={styles.shell} data-active-workspace={activeWorkspace}>
      <nav
        aria-label="PlotPickle global workflow"
        className={styles.navigator}
        data-plotpickle-global-nav="v1"
      >
        <div className={styles.brand} aria-hidden="true">
          <Image
            alt=""
            className={styles.brandMark}
            height={64}
            priority
            src="/brand/plotpickle-ouroboros-v3-transparent.png"
            width={64}
          />
        </div>

        <div className={styles.scroller}>
          <ol className={styles.list}>
            {ROOT_NAV_ITEMS.map((item) => {
              const active = item.id === activeWorkspace;
              const selectable = item.selectable && isRootWorkspace(item.id);
              const className = [active ? styles.active : "", endsNavigationGroup(item.id) ? styles.groupBreakAfter : ""]
                .filter(Boolean)
                .join(" ") || undefined;
              return (
                <li className={className} key={item.id}>
                  <button
                    aria-current={active ? "page" : undefined}
                    disabled={!selectable || active}
                    onClick={() => {
                      if (selectable) onNavigate(item.id);
                    }}
                    title={`${item.label} · ${item.detail}`}
                    type="button"
                  >
                    <Image
                      alt=""
                      aria-hidden="true"
                      className={styles.relic}
                      height={44}
                      src={item.relic}
                      width={44}
                    />
                    <span className={styles.copy}>
                      <strong>{item.label}</strong>
                      <small>{item.detail}</small>
                    </span>
                  </button>
                </li>
              );
            })}
          </ol>
        </div>
      </nav>

      <div className={styles.workspaceFrame}>{children}</div>
    </div>
  );
}
