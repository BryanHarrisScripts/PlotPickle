"use client";

import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { usePathname, useRouter } from "next/navigation";
import PlotPickleWorkspaceShell, { type RootWorkspace } from "../plotpickle-workspace-shell";
import { GLOBAL_SHORTCUTS } from "./global-shortcuts";
import styles from "./release-experience-boundary.module.css";

type StandaloneTarget = {
  readonly activeShortcutId: string;
  readonly rootContext: RootWorkspace;
};

const STANDALONE_TARGETS: Readonly<Record<string, StandaloneTarget>> = {
  "/library": { activeShortcutId: "library", rootContext: "library" },
  "/story": { activeShortcutId: "story", rootContext: "story" },
  "/storyboard": { activeShortcutId: "storyboard", rootContext: "build" },
  "/previs": { activeShortcutId: "graphic-novel", rootContext: "build" },
  "/pageflow": { activeShortcutId: "write", rootContext: "build" },
  "/edit": { activeShortcutId: "edit", rootContext: "build" },
  "/pitch-review": { activeShortcutId: "feedback", rootContext: "build" },
  "/diagnostics": { activeShortcutId: "refine", rootContext: "build" },
  "/production": { activeShortcutId: "reports", rootContext: "build" },
};

function BuildStudioNavigationHost() {
  const router = useRouter();
  const [portalTarget, setPortalTarget] = useState<HTMLElement | null>(null);

  useEffect(() => {
    let host: HTMLElement | null = null;
    const sync = () => {
      const params = new URLSearchParams(window.location.search);
      if (window.location.pathname !== "/" || params.get("workspace") !== "build") {
        host?.remove();
        host = null;
        setPortalTarget(null);
        return;
      }
      const frame = document.querySelector<HTMLElement>('[data-workspace-frame="true"]');
      const workflow = frame?.querySelector<HTMLElement>('[data-story-workflow="foundations"]') ?? null;
      const build = frame?.querySelector<HTMLElement>('main[aria-label="Foundations BUILD"]') ?? null;
      if (!frame || !workflow || !build) return;

      if (workflow.previousElementSibling !== build) frame.appendChild(workflow);
      if (!host || !host.isConnected || host.parentElement !== frame) {
        host?.remove();
        host = document.createElement("div");
        host.dataset.buildStudioNavigationHost = "true";
        frame.prepend(host);
        setPortalTarget(host);
      }
    };

    sync();
    const observer = new MutationObserver(sync);
    observer.observe(document.body, { childList: true, subtree: true });
    window.addEventListener("popstate", sync);
    return () => {
      observer.disconnect();
      window.removeEventListener("popstate", sync);
      host?.remove();
    };
  }, []);

  if (!portalTarget) return null;

  const scrollTo = (selector: string) => {
    document.querySelector<HTMLElement>(selector)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return createPortal(
    <nav className={styles.buildStageNav} aria-label="BUILD studio stages">
      <div>
        <span>BUILD STUDIO</span>
        <strong>Story to screen</strong>
      </div>
      <button type="button" onClick={() => scrollTo('[data-story-coverage="live-foundations"]')}>Story Coverage</button>
      <button type="button" onClick={() => scrollTo('[data-story-workflow="foundations"]')}>Story Workflow</button>
      <button type="button" onClick={() => scrollTo('section[aria-label="Foundations Visual Narrative Wireframe workshop"]')}>Wireframe</button>
      <button type="button" onClick={() => router.push("/storyboard")}>Storyboard</button>
      <button type="button" onClick={() => router.push("/previs")}>Previs</button>
      <button type="button" onClick={() => router.push("/previs#render-plan")}>Render Plan</button>
    </nav>,
    portalTarget,
  );
}

function SettingsKeyboardShortcutsHost() {
  const [portalTarget, setPortalTarget] = useState<HTMLElement | null>(null);

  useEffect(() => {
    let host: HTMLElement | null = null;
    const sync = () => {
      const help = document.querySelector<HTMLElement>("#settings-help");
      if (!help) {
        host?.remove();
        host = null;
        setPortalTarget(null);
        return;
      }
      if (!host || !host.isConnected || host.parentElement !== help) {
        host?.remove();
        host = document.createElement("div");
        host.dataset.settingsKeyboardShortcuts = "true";
        const intro = help.querySelector(":scope > header");
        if (intro) intro.insertAdjacentElement("afterend", host);
        else help.prepend(host);
        setPortalTarget(host);
      }
    };

    sync();
    const observer = new MutationObserver(sync);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => {
      observer.disconnect();
      host?.remove();
    };
  }, []);

  if (!portalTarget) return null;
  return createPortal(
    <section className={styles.keyboardHelp} aria-labelledby="plotpickle-keyboard-shortcuts-title">
      <header>
        <span>Keyboard navigation</span>
        <h2 id="plotpickle-keyboard-shortcuts-title">Move around PlotPickle without cluttering the workspace.</h2>
        <p>Single-letter shortcuts work when you are not typing, editing a control, or using a dialog.</p>
      </header>
      <div className={styles.keyboardGrid}>
        {GLOBAL_SHORTCUTS.map((shortcut) => (
          <div key={shortcut.id}>
            <kbd>{shortcut.key}</kbd>
            <span><strong>{shortcut.label}</strong><small>{shortcut.detail}</small></span>
          </div>
        ))}
      </div>
    </section>,
    portalTarget,
  );
}

export default function ReleaseExperienceBoundary({ children }: { readonly children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const target = STANDALONE_TARGETS[pathname] ?? null;

  const navigateRoot = (workspace: RootWorkspace) => {
    router.push(`/?workspace=${workspace}`);
  };

  return (
    <>
      {target ? (
        <PlotPickleWorkspaceShell
          activeShortcutId={target.activeShortcutId}
          activeWorkspace={target.rootContext}
          onNavigate={navigateRoot}
        >
          {children}
        </PlotPickleWorkspaceShell>
      ) : children}
      <BuildStudioNavigationHost />
      <SettingsKeyboardShortcutsHost />
    </>
  );
}
