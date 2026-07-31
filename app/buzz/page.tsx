"use client";

import { useEffect } from "react";

const COLLAB_SECTION_KEY = "plotpickle.collab.section";

export default function BuzzCompatibilityPage() {
  useEffect(() => {
    window.sessionStorage.setItem(COLLAB_SECTION_KEY, "buzz");
    window.location.replace("/?workspace=collab");
  }, []);

  return <main className="workspace-main"><p role="status">Opening Collab → Buzz Story Room…</p></main>;
}
