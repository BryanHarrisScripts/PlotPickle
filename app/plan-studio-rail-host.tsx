"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import styles from "./plan-studio-rail-host.module.css";

type RailItem = {
  label: string;
  short: string;
  legacyLabel?: string;
};

type RailGroup = {
  label: string;
  items: RailItem[];
};

const PLAN_GROUPS: RailGroup[] = [
  {
    label: "Story",
    items: [
      { label: "Simple Start", short: "SS" },
      { label: "Project Overview", short: "OV" },
      { label: "Story Setup", short: "01" },
      { label: "Concept Canvas", short: "CC" },
      { label: "Pitch & Vision", short: "PV" },
    ],
  },
  {
    label: "World & Cast",
    items: [
      { label: "Visual References", short: "VR" },
      { label: "World", short: "WD" },
      { label: "Characters", short: "CH" },
    ],
  },
  {
    label: "Story Engine",
    items: [
      { label: "Ghost", short: "GH" },
      { label: "Catalyst", short: "CA" },
      { label: "Foundations", short: "FN" },
      { label: "The Pickle", short: "PK" },
      { label: "Dialogue", short: "DL" },
    ],
  },
  {
    label: "Structure",
    items: [
      { label: "Structure Map", short: "ST" },
      { label: "24 Blocks", short: "24" },
      { label: "Storyboard Handoff", short: "SB", legacyLabel: "Storyboard" },
    ],
  },
  {
    label: "Canon & Notes",
    items: [
      { label: "Core Model", short: "CM" },
      { label: "Notes", short: "NT" },
    ],
  },
];

function normalized(text: string | null | undefined) {
  return (text || "").replace(/\s+/g, " ").trim().toLowerCase();
}

function legacyButtons(root: ParentNode) {
  return Array.from(root.querySelectorAll<HTMLButtonElement>(".story-rail nav button"));
}

function activeLegacyLabel(root: ParentNode) {
  const active = root.querySelector<HTMLButtonElement>(
    '.story-rail nav button.active, .story-rail nav button[aria-current="page"]',
  );
  return normalized(active?.textContent);
}

function clickLegacyDestination(root: ParentNode, item: RailItem) {
  const destination = normalized(item.legacyLabel || item.label);
  const button = legacyButtons(root).find((candidate) => normalized(candidate.textContent).includes(destination));
  button?.click();
}

export default function PlanStudioRailHost() {
  const [portalTarget, setPortalTarget] = useState<HTMLElement | null>(null);
  const [workspaceRoot, setWorkspaceRoot] = useState<HTMLElement | null>(null);
  const [activeText, setActiveText] = useState("");

  useEffect(() => {
    let mountedHost: HTMLElement | null = null;
    let hiddenLegacyRail: HTMLElement | null = null;
    let activeObserver: MutationObserver | null = null;

    const sync = () => {
      const plannerContent = document.querySelector<HTMLElement>(".planner-content");
      const studioLayout = plannerContent?.closest<HTMLElement>(".studio-layout") || null;
      const legacyRail = studioLayout?.querySelector<HTMLElement>(".story-rail") || null;

      if (!plannerContent || !studioLayout || !legacyRail) {
        if (hiddenLegacyRail) hiddenLegacyRail.hidden = false;
        hiddenLegacyRail = null;
        if (mountedHost?.isConnected) mountedHost.remove();
        mountedHost = null;
        activeObserver?.disconnect();
        activeObserver = null;
        setPortalTarget(null);
        setWorkspaceRoot(null);
        setActiveText("");
        return;
      }

      if (!mountedHost || !mountedHost.isConnected || mountedHost.parentElement !== studioLayout) {
        mountedHost?.remove();
        mountedHost = document.createElement("div");
        mountedHost.dataset.planStudioRail = "true";
        studioLayout.insertBefore(mountedHost, legacyRail);
        setPortalTarget(mountedHost);
      }

      if (hiddenLegacyRail !== legacyRail) {
        if (hiddenLegacyRail) hiddenLegacyRail.hidden = false;
        hiddenLegacyRail = legacyRail;
        hiddenLegacyRail.hidden = true;
      }

      setWorkspaceRoot(studioLayout);
      setActiveText(activeLegacyLabel(studioLayout));

      if (!activeObserver) {
        activeObserver = new MutationObserver(() => setActiveText(activeLegacyLabel(studioLayout)));
        activeObserver.observe(legacyRail, {
          subtree: true,
          attributes: true,
          attributeFilter: ["class", "aria-current"],
        });
      }
    };

    sync();
    const observer = new MutationObserver(sync);
    observer.observe(document.body, { childList: true, subtree: true });
    window.addEventListener("popstate", sync);

    return () => {
      observer.disconnect();
      activeObserver?.disconnect();
      window.removeEventListener("popstate", sync);
      if (hiddenLegacyRail) hiddenLegacyRail.hidden = false;
      mountedHost?.remove();
    };
  }, []);

  const activeDestination = useMemo(() => {
    for (const group of PLAN_GROUPS) {
      for (const item of group.items) {
        const target = normalized(item.legacyLabel || item.label);
        if (activeText.includes(target)) return item.label;
      }
    }
    return "Project Overview";
  }, [activeText]);

  if (!portalTarget || !workspaceRoot) return null;

  return createPortal(
    <aside className={styles.rail} aria-label="Plan creative areas">
      <header className={styles.header}>
        <p>Plan</p>
        <h2>Shape the story.</h2>
        <span>One canon. Five creative areas.</span>
      </header>

      <nav aria-label="Plan tools" className={styles.navigation}>
        {PLAN_GROUPS.map((group) => (
          <section key={group.label} className={styles.group}>
            <h3>{group.label}</h3>
            <div>
              {group.items.map((item) => {
                const active = activeDestination === item.label;
                return (
                  <button
                    key={item.label}
                    type="button"
                    aria-current={active ? "page" : undefined}
                    className={active ? styles.active : ""}
                    onClick={() => clickLegacyDestination(workspaceRoot, item)}
                  >
                    <span>{item.short}</span>
                    <strong>{item.label}</strong>
                  </button>
                );
              })}
            </div>
          </section>
        ))}
      </nav>

      <footer className={styles.footer}>
        <span>4 Acts</span>
        <span>24 Blocks</span>
        <span>96 mini-blocks</span>
      </footer>
    </aside>,
    portalTarget,
  );
}
