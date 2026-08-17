"use client";

import Image from "next/image";
import type { ReactNode } from "react";
import CommunityPublicConversationsRail from "./community-public-conversations-rail";
import styles from "./plotpickle-workspace-shell.module.css";

export type RootWorkspace = "learn" | "plan" | "wyrmwood" | "community" | "settings" | "dashboard" | "build";

export const ROOT_NAV_ITEMS = [
  { id: "dashboard", relic: "/assets/workflow-relics/dashboard.webp", label: "Dashboard", detail: "Start", selectable: true },
  { id: "community", relic: "/assets/workflow-relics/community.svg", label: "Community", detail: "Guildhall", selectable: true },
  { id: "wyrmwood", relic: "/assets/workflow-relics/game.webp", label: "Wyrmwood", detail: "Game", selectable: true },
  { id: "learn", relic: "/assets/workflow-relics/learn.webp", label: "Learn", detail: "Guides", selectable: true },
  { id: "plan", relic: "/assets/workflow-relics/plan.webp", label: "Plan", detail: "Design", selectable: true },
  { id: "build", relic: "/assets/workflow-relics/build.webp", label: "Build", detail: "Assemble", selectable: true },
  { id: "storyboard", relic: "/assets/workflow-relics/storyboard.webp", label: "Storyboard", detail: "Sketch", selectable: false },
  { id: "graphic-novel", relic: "/assets/workflow-relics/graphic-novel.webp", label: "Previs", detail: "Visualize", selectable: false },
  { id: "write", relic: "/assets/workflow-relics/write.webp", label: "Write", detail: "Draft", selectable: false },
  { id: "edit", relic: "/assets/workflow-relics/edit.webp", label: "Edit", detail: "Polish", selectable: false },
  { id: "feedback", relic: "/assets/workflow-relics/feedback.webp", label: "Feedback", detail: "Review", selectable: false },
  { id: "refine", relic: "/assets/workflow-relics/refine.webp", label: "Refine", detail: "Decide", selectable: false },
  { id: "reports", relic: "/assets/workflow-relics/reports.webp", label: "Reports", detail: "Deliver", selectable: false },
  { id: "settings", relic: "/assets/workflow-relics/settings.svg", label: "Settings", detail: "Config", selectable: true },
] as const;

type RootNavItem = (typeof ROOT_NAV_ITEMS)[number];

function isRootWorkspace(id: RootNavItem["id"]): id is RootWorkspace {
  return id === "dashboard" || id === "learn" || id === "plan" || id === "build"
    || id === "wyrmwood" || id === "community" || id === "settings";
}

function navigationBreakAfter(id: RootNavItem["id"]) {
  if (id === "wyrmwood") return "community-game";
  if (id === "graphic-novel") return "previs";
  if (id === "refine") return "reports";
  return "";
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
        data-plotpickle-global-nav="v2"
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
          <ol className={styles.list} data-workspace-navigation="true">
            {ROOT_NAV_ITEMS.map((item) => {
              const active = item.id === activeWorkspace;
              const selectable = item.selectable && isRootWorkspace(item.id);
              const breakAfter = navigationBreakAfter(item.id);
              const className = [
                active ? styles.active : "",
                breakAfter === "community-game" ? styles.groupBreakCommunityGame : "",
                breakAfter === "previs" ? styles.groupBreakPrevis : "",
                breakAfter === "reports" ? styles.groupBreakReports : "",
              ].filter(Boolean).join(" ") || undefined;
              return (
                <li
                  className={className}
                  data-navigation-gap-after={breakAfter || undefined}
                  data-workspace-nav-id={item.id}
                  key={item.id}
                >
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

      <div className={styles.workspaceFrame} data-workspace-frame="true">{children}</div>
      {activeWorkspace === "community" ? <CommunityPublicConversationsRail /> : null}
    </div>
  );
}
