"use client";

import { useEffect } from "react";

function studioLearnHref(rawHref: string) {
  try {
    const source = new URL(rawHref, window.location.origin);
    if (source.pathname !== "/read-learn") return null;
    const destination = new URL("/", window.location.origin);
    destination.searchParams.set("workspace", "learn");
    destination.searchParams.set("view", "library");
    const legacyView = source.searchParams.get("view");
    source.searchParams.forEach((value, key) => {
      if (key === "view") return;
      if (key === "lesson" && !source.searchParams.has("module")) destination.searchParams.set("module", value);
      else destination.searchParams.set(key, value);
    });
    if (legacyView && legacyView !== "library") destination.searchParams.set("collection", legacyView);
    return `${destination.pathname}${destination.search}${source.hash}`;
  } catch {
    return null;
  }
}

export default function LearnEntryRouter() {
  useEffect(() => {
    let stopped = false;

    const routeLearnEntry = () => {
      if (stopped) return;

      const learningStudio = document.querySelector<HTMLElement>('nav[aria-label="Learning Studio views"]');
      if (learningStudio) document.documentElement.dataset.plotpickleLearnScreen = "true";
      else delete document.documentElement.dataset.plotpickleLearnScreen;

      if (window.location.pathname === "/core-curriculum") document.documentElement.dataset.plotpickleCoreLearn = "true";
      else delete document.documentElement.dataset.plotpickleCoreLearn;

      for (const anchor of document.querySelectorAll<HTMLAnchorElement>('a[href^="/read-learn"]')) {
        const nextHref = studioLearnHref(anchor.getAttribute("href") || "");
        if (nextHref && anchor.getAttribute("href") !== nextHref) anchor.setAttribute("href", nextHref);
      }

      const navigation = document.querySelector<HTMLElement>('nav[aria-label="Learn sections"]');
      if (navigation) navigation.dataset.plotpickleLearnRouted = "true";
    };

    routeLearnEntry();
    const observer = new MutationObserver(routeLearnEntry);
    observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["href"] });

    return () => {
      stopped = true;
      observer.disconnect();
      delete document.documentElement.dataset.plotpickleLearnScreen;
      delete document.documentElement.dataset.plotpickleCoreLearn;
    };
  }, []);

  return null;
}
