"use client";

import { useEffect, useState } from "react";

function SettingsRelic() {
  return (
    <img
      aria-hidden="true"
      alt=""
      className="standalone-settings-relic"
      height={56}
      src="/assets/workflow-relics/settings.svg"
      width={56}
    />
  );
}

export default function UiContinuityAnchor() {
  const [standalone, setStandalone] = useState(false);
  const [sageSetupNeeded, setSageSetupNeeded] = useState(false);

  useEffect(() => {
    const refresh = () => {
      setStandalone(Boolean(!document.querySelector('[data-ui-continuity-shell="v1"]')));
      const alertText = document.querySelector('[role="alert"]')?.textContent?.toLowerCase() || "";
      setSageSetupNeeded(
        alertText.includes("local model")
        || alertText.includes("local runtime")
        || alertText.includes("fast model")
        || alertText.includes("quality local model"),
      );
    };
    refresh();
    const observer = new MutationObserver(refresh);
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });
    return () => observer.disconnect();
  }, []);

  if (!standalone) return null;
  return (
    <a
      className="standalone-agent-settings-anchor"
      data-sage-setup-needed={sageSetupNeeded ? "true" : "false"}
      data-ui-continuity-anchor="agent-settings"
      aria-label="Open Agent and Settings"
      title={sageSetupNeeded ? "Open Settings to configure local AI" : "Settings"}
      href="/?workspace=settings"
    >
      <SettingsRelic />
      <span>{sageSetupNeeded ? "Setup AI" : "Settings"}</span>
    </a>
  );
}
