"use client";

import { useEffect, useState } from "react";
import SageSettingsWorkspace from "../sage-settings-workspace";

export default function AiRoutingPage() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const url = new URL(window.location.href);
    if (!url.hash && !url.searchParams.get("settings")) {
      url.searchParams.set("settings", "local-compute");
      window.history.replaceState({ settingsSection: "local-compute" }, "", `${url.pathname}${url.search}`);
    }
    setReady(true);
  }, []);

  if (!ready) return <main className="workspace-main"><p role="status">Opening AI Routing…</p></main>;
  return <SageSettingsWorkspace />;
}
