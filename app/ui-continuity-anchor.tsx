"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

export default function UiContinuityAnchor() {
  const [standalone, setStandalone] = useState(false);

  useEffect(() => {
    const refresh = () => setStandalone(Boolean(
      !document.querySelector('[data-ui-continuity-shell="v1"]')
      && !document.querySelector('[data-hide-agent-settings-anchor="true"]'),
    ));
    refresh();
    const observer = new MutationObserver(refresh);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);

  if (!standalone) return null;
  return (
    <Link
      className="standalone-agent-settings-anchor"
      data-ui-continuity-anchor="agent-settings"
      aria-label="Open Agent and Settings"
      title="Agent and Settings"
      href="/?workspace=settings"
    >
      <span aria-hidden="true">A</span>
    </Link>
  );
}
