"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import styles from "./storyboard-moment-context-host.module.css";

type Selection = {
  block: number;
  mini: number;
  scene: string;
  storyLabel: string;
  storyTitle: string;
  storyPurpose: string;
  visualIntention: string;
};

function text(element: Element | null | undefined) {
  return (element?.textContent || "").replace(/\s+/g, " ").trim();
}

function validNumber(value: string | null, minimum: number, maximum: number) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= minimum && parsed <= maximum ? parsed : 0;
}

function intentionFromStoryboard(root: ParentNode) {
  const language = root.querySelector<HTMLElement>('#visual-language [data-storyboard-context="visual-language"]')
    ?? root.querySelector<HTMLElement>('#visual-language article');
  const pitch = Array.from(root.querySelectorAll<HTMLElement>("#visual-language article"))
    .find((article) => /pitch visual statement/i.test(text(article.querySelector("strong"))));
  const world = Array.from(root.querySelectorAll<HTMLElement>("#visual-language article"))
    .find((article) => /world visual language/i.test(text(article.querySelector("strong"))));
  const candidate = text(pitch?.querySelector("p")) || text(world?.querySelector("p")) || text(language?.querySelector("p"));
  return candidate || "Add the project visual intention in Plan so every Storyboard moment inherits the same visual promise.";
}

function readSelection(root: HTMLElement, panel: HTMLElement): Selection | null {
  const params = new URLSearchParams(window.location.search);
  const storyLabel = text(panel.querySelector("header span"));
  const storyTitle = text(panel.querySelector("header h2"));
  const storyPurpose = text(panel.querySelector("header p"));
  const labelMatch = storyLabel.match(/Block\s+(\d+)\.(\d+)/i);
  const block = validNumber(params.get("block"), 1, 24) || Number(labelMatch?.[1] || 0);
  const mini = validNumber(params.get("mini"), 1, 4) || Number(labelMatch?.[2] || 0);
  if (!block || !mini) return null;
  const scene = params.get("scene") || storyLabel.split("·").slice(1).join("·").trim();
  return {
    block,
    mini,
    scene,
    storyLabel,
    storyTitle,
    storyPurpose: storyPurpose || "This moment keeps the same purpose, turn and outcome defined by the canonical story structure.",
    visualIntention: intentionFromStoryboard(root),
  };
}

export default function StoryboardMomentContextHost() {
  const [portalTarget, setPortalTarget] = useState<HTMLElement | null>(null);
  const [selection, setSelection] = useState<Selection | null>(null);

  useEffect(() => {
    let host: HTMLElement | null = null;
    let mountedParent: HTMLElement | null = null;

    const sync = () => {
      const root = document.querySelector<HTMLElement>(".visual-studio-layout");
      const decisions = root?.querySelector<HTMLElement>("#storyboard-decisions") || null;
      const panel = decisions?.closest<HTMLElement>("section") || null;
      const parent = panel?.parentElement || null;

      if (!root || !panel || !parent) {
        host?.remove();
        host = null;
        mountedParent = null;
        setPortalTarget(null);
        setSelection(null);
        return;
      }

      if (!host || !host.isConnected || mountedParent !== parent) {
        host?.remove();
        host = document.createElement("div");
        host.dataset.storyboardMomentContext = "true";
        parent.insertBefore(host, panel);
        mountedParent = parent;
        setPortalTarget(host);
      }

      setSelection(readSelection(root, panel));
    };

    sync();
    const observer = new MutationObserver(sync);
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });
    window.addEventListener("popstate", sync);

    return () => {
      observer.disconnect();
      window.removeEventListener("popstate", sync);
      host?.remove();
    };
  }, []);

  const identity = useMemo(() => {
    if (!selection) return "";
    return `Block ${selection.block}.${selection.mini}${selection.scene ? ` · ${selection.scene}` : ""}`;
  }, [selection]);

  if (!portalTarget || !selection) return null;

  function openWorkspace(workspace: "write" | "pitch" | "build") {
    const url = new URL(window.location.href);
    url.searchParams.set("workspace", workspace);
    url.searchParams.set("block", String(selection!.block));
    url.searchParams.set("mini", String(selection!.mini));
    if (selection!.scene) url.searchParams.set("scene", selection!.scene);
    url.searchParams.delete("visualSection");
    url.searchParams.delete("decision");
    window.location.assign(url);
  }

  return createPortal(
    <aside className={styles.context} aria-label="Selected Storyboard story context">
      <header className={styles.identity}>
        <span>Same PPF story moment</span>
        <strong>{identity}</strong>
        <small>{selection.storyTitle || selection.storyLabel}</small>
      </header>

      <div className={styles.direction}>
        <article>
          <span>Plan intention</span>
          <p>{selection.visualIntention}</p>
        </article>
        <article>
          <span>Story purpose</span>
          <p>{selection.storyPurpose}</p>
        </article>
      </div>

      <nav className={styles.handoffs} aria-label="Continue this Storyboard moment">
        <button type="button" onClick={() => openWorkspace("write")}>Open in Write</button>
        <button type="button" onClick={() => openWorkspace("pitch")}>Open in Graphic Novel</button>
        <button type="button" onClick={() => openWorkspace("build")}>Send to Build</button>
      </nav>

      <p className={styles.note}>The Block, mini-block and scene identity travel with you. Approved visual direction remains context; it never overwrites screenplay or production canon automatically.</p>
    </aside>,
    portalTarget,
  );
}
