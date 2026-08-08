"use client";

import { useEffect } from "react";

export default function LearnEntryRouter() {
  useEffect(() => {
    let stopped = false;

    const routeLearnEntry = () => {
      if (stopped) return;
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
    observer.observe(document.body, { childList: true, subtree: true });

    return () => {
      stopped = true;
      observer.disconnect();
    };
  }, []);

  return null;
}
