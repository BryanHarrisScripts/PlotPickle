"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

function SettingsRuneGlyph() {
  return (
    <svg
      aria-hidden="true"
      className="standalone-settings-rune"
      focusable="false"
      viewBox="0 0 48 48"
    >
      <circle className="standalone-settings-ring" cx="24" cy="24" r="18" />
      <path className="standalone-settings-spokes" d="M24 6v7M24 35v7M6 24h7M35 24h7M11.3 11.3l5 5M31.7 31.7l5 5M36.7 11.3l-5 5M16.3 31.7l-5 5" />
      <path className="standalone-settings-star" d="m24 13 3.7 6.2 7.3 1.5-5 5.4.8 7.4-6.8-3-6.8 3 .8-7.4-5-5.4 7.3-1.5Z" />
      <circle className="standalone-settings-core" cx="24" cy="24" r="3.2" />
    </svg>
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
        || alertText.includes("fast model"),
      );
    };
    refresh();
    const observer = new MutationObserver(refresh);
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });
    return () => observer.disconnect();
  }, []);

  if (!standalone) return null;
  return (
    <Link
      className="standalone-agent-settings-anchor"
      data-sage-setup-needed={sageSetupNeeded ? "true" : "false"}
      data-ui-continuity-anchor="agent-settings"
      aria-label="Open Agent and Settings"
      title={sageSetupNeeded ? "Open Settings to set up Sage" : "Settings"}
      href="/?workspace=settings"
    >
      <SettingsRuneGlyph />
      <span>{sageSetupNeeded ? "Setup Sage" : "Settings"}</span>
    </Link>
  );
}
