"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import styles from "./plan-studio-rail-host.module.css";

type RailItem = {
  id: string;
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
      { id: "simpleStart", label: "Simple Start", short: "SS" },
      { id: "overview", label: "Project Overview", short: "OV" },
      { id: "storySetup", label: "Story Setup", short: "01" },
      { id: "concept", label: "Concept Canvas", short: "CC" },
      { id: "pitch", label: "Pitch & Vision", short: "PV" },
    ],
  },
  {
    label: "World & Cast",
    items: [
      { id: "references", label: "Visual References", short: "VR" },
      { id: "world", label: "World", short: "WD" },
      { id: "characters", label: "Characters", short: "CH" },
    ],
  },
  {
    label: "Story Engine",
    items: [
      { id: "ghost", label: "Ghost", short: "GH" },
      { id: "catalyst", label: "Catalyst", short: "CA" },
      { id: "foundations", label: "Foundations", short: "FN" },
      { id: "pickle", label: "The Pickle", short: "PK" },
      { id: "dialogue", label: "Dialogue", short: "DL" },
    ],
  },
  {
    label: "Structure",
    items: [
      { id: "structureMap", label: "Structure Map", short: "ST" },
      { id: "blocks", label: "24 Blocks", short: "24" },
      { id: "storyboard", label: "Storyboard Handoff", short: "SB", legacyLabel: "Storyboard" },
    ],
  },
  {
    label: "Canon & Notes",
    items: [
      { id: "coreModel", label: "Core Model", short: "CM" },
      { id: "notes", label: "Notes", short: "NT" },
    ],
  },
];

const PLAN_ITEMS = PLAN_GROUPS.flatMap((group) => group.items);

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

function requestedPlanItem() {
  const requested = new URLSearchParams(window.location.search).get("section");
  return requested ? PLAN_ITEMS.find((item) => item.id === requested) ?? null : null;
}

export default function PlanStudioRailHost() {
  const [portalTarget, setPortalTarget] = useState<HTMLElement | null>(null);
  const [workspaceRoot, setWorkspaceRoot] = useState<HTMLElement | null>(null);
  const [activeText, setActiveText] = useState("");

  useEffect(() => {
    let mountedHost: HTMLElement | null = null;
    let hiddenLegacyRail: HTMLElement | null = null;
    let activeObserver: MutationObserver | null = null;
    let requestedSectionApplied = false;

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

      if (!requestedSectionApplied) {
        requestedSectionApplied = true;
        const requested = requestedPlanItem();
        if (requested) {
          window.setTimeout(() => clickLegacyDestination(studioLayout, requested), 0);
        }
      }

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
                    key={item.id}
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
