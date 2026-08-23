"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import styles from "./storyboard-plan-intention-host.module.css";

type StoryboardContext = {
  identity: string;
  storyPurpose: string;
  visualIntention: string;
};

function normalizedText(element: Element | null | undefined) {
  return (element?.textContent || "").replace(/\s+/g, " ").trim();
}

function visualIntention(root: ParentNode) {
  const articles = Array.from(root.querySelectorAll<HTMLElement>("#visual-language article"));
  const pitch = articles.find((article) => /pitch visual statement/i.test(normalizedText(article.querySelector("strong"))));
  const world = articles.find((article) => /world visual language/i.test(normalizedText(article.querySelector("strong"))));
  return normalizedText(pitch?.querySelector("p"))
    || normalizedText(world?.querySelector("p"))
    || "Add the project visual intention in Plan so every Storyboard moment inherits the same visual promise.";
}

function readContext(root: HTMLElement, directorPanel: HTMLElement): StoryboardContext | null {
  const params = new URLSearchParams(window.location.search);
  if (params.get("workspace") !== "storyboard" || params.get("visualSection") !== "frames" || params.get("decision") === "review") return null;

  const storyLabel = normalizedText(directorPanel.querySelector("header span"));
  const storyPurpose = normalizedText(directorPanel.querySelector("header p"));
  const match = storyLabel.match(/Block\s+(\d+)\.(\d+)/i);
  const block = Number(params.get("block")) || Number(match?.[1] || 0);
  const mini = Number(params.get("mini")) || Number(match?.[2] || 0);
  if (!block || !mini) return null;
  const scene = params.get("scene") || storyLabel.split("·").slice(1).join("·").trim();

  return {
    identity: `Block ${block}.${mini}${scene ? ` · ${scene}` : ""}`,
    storyPurpose: storyPurpose || "This moment keeps the same dramatic purpose, turn and outcome defined by the canonical story structure.",
    visualIntention: visualIntention(root),
  };
}

export default function StoryboardPlanIntentionHost() {
  const [target, setTarget] = useState<HTMLElement | null>(null);
  const [context, setContext] = useState<StoryboardContext | null>(null);

  useEffect(() => {
    let host: HTMLElement | null = null;
    let parent: HTMLElement | null = null;

    const sync = () => {
      const root = document.querySelector<HTMLElement>(".visual-studio-layout");
      const decisions = root?.querySelector<HTMLElement>("#storyboard-decisions") || null;
      const directorPanel = decisions?.closest<HTMLElement>("section") || null;
      const nextParent = directorPanel?.parentElement || null;
      const nextContext = root && directorPanel ? readContext(root, directorPanel) : null;

      if (!root || !directorPanel || !nextParent || !nextContext) {
        host?.remove();
        host = null;
        parent = null;
        setTarget(null);
        setContext(null);
        return;
      }

      if (!host || !host.isConnected || parent !== nextParent) {
        host?.remove();
        host = document.createElement("div");
        host.dataset.storyboardPlanIntention = "true";
        nextParent.insertBefore(host, directorPanel);
        parent = nextParent;
        setTarget(host);
      }
      setContext(nextContext);
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

  if (!target || !context) return null;

  return createPortal(
    <aside className={styles.context} aria-label="Selected Storyboard story context">
      <header>
        <span>Same PPF story moment</span>
        <strong>{context.identity}</strong>
      </header>
      <div>
        <article>
          <span>Plan intention</span>
          <p>{context.visualIntention}</p>
        </article>
        <article>
          <span>Story purpose</span>
          <p>{context.storyPurpose}</p>
        </article>
      </div>
      <p>The visual direction stays attached to this Block and mini-block. It informs Storyboard and Write without overwriting screenplay or approval state.</p>
    </aside>,
    target,
  );
}
