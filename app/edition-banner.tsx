"use client";

import { useEffect, useState } from "react";

export default function EditionBanner() {
  const [edition, setEdition] = useState<"checking" | "online" | "local">("checking");

  useEffect(() => {
    let active = true;

    void fetch("/__plotpickle/health", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) return false;
        const payload = (await response.json()) as { localRuntime?: boolean };
        return payload.localRuntime === true;
      })
      .then((isLocal) => {
        if (active) setEdition(isLocal ? "local" : "online");
      })
      .catch(() => {
        if (active) setEdition("online");
      });

    return () => {
      active = false;
    };
  }, []);

  if (edition === "checking") return null;

  if (edition === "local") {
    return (
      <div className="edition-banner edition-banner-local" role="status">
        <strong>PlotPickle Local</strong>
        <span>Your story is running from this computer and autosaving to the local project folder.</span>
      </div>
    );
  }

  return (
    <section className="edition-banner edition-banner-online" aria-label="PlotPickle Online">
      <div>
        <strong>PlotPickle Online</strong>
        <span>Try the complete 24 Blocks story workspace in your browser. No installation required.</span>
      </div>
      <div className="edition-banner-actions">
        <a href="#plotpickle-workspace">Open the workspace</a>
        <a href="https://github.com/BryanHarrisScripts/PlotPickle" target="_blank" rel="noreferrer">Local edition & source</a>
      </div>
    </section>
  );
}
