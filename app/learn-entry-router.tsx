"use client";

import { useEffect } from "react";

function studioLearnHref(rawHref: string) {
  try {
    const source = new URL(rawHref, window.location.origin);
    if (source.pathname !== "/read-learn") return null;
    const destination = new URL("/", window.location.origin);
    destination.searchParams.set("workspace", "learn");
    source.searchParams.forEach((value, key) => destination.searchParams.set(key, value));
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

      for (const anchor of document.querySelectorAll<HTMLAnchorElement>('a[href^="/read-learn"]')) {
        const nextHref = studioLearnHref(anchor.getAttribute("href") || "");
        if (nextHref && anchor.getAttribute("href") !== nextHref) anchor.setAttribute("href", nextHref);
      }

      const navigation = document.querySelector<HTMLElement>('nav[aria-label="Learn sections"]');
      if (!navigation || navigation.dataset.plotpickleLearnRouted === "true") return;

      const libraryButton = Array.from(navigation.querySelectorAll<HTMLButtonElement>("button"))
        .find((button) => button.textContent?.includes("Complete Learning Library"));
      if (!libraryButton) return;

      navigation.dataset.plotpickleLearnRouted = "true";
      const current = navigation.querySelector<HTMLButtonElement>('button[aria-current="page"]');
      if (current?.textContent?.includes("Introduction")) libraryButton.click();
    };

    routeLearnEntry();
    const observer = new MutationObserver(routeLearnEntry);
    observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["href"] });

    return () => {
      stopped = true;
      observer.disconnect();
    };
  }, []);

  return null;
}
