"use client";

import { useEffect } from "react";

const SETTINGS_SECTION_KEY = "plotpickle.settings.section";

export default function BuzzSettingsCompatibilityPage() {
  useEffect(() => {
    window.sessionStorage.setItem(SETTINGS_SECTION_KEY, "buzz");
    window.location.replace("/?workspace=settings");
  }, []);

  return <main className="workspace-main"><p role="status">Opening Settings → Buzz Installation…</p></main>;
}
