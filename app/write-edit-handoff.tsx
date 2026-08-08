"use client";

import { useEffect, useState } from "react";

type StoryMoment = { block: number; mini: number };

function queryMoment() {
  const params = new URLSearchParams(window.location.search);
  if (params.get("workspace") !== "write") return null;
  const block = Number(params.get("block"));
  const mini = Number(params.get("mini"));
  if (Number.isInteger(block) && block >= 1 && block <= 24 && Number.isInteger(mini) && mini >= 1 && mini <= 4) return { block, mini };
  return null;
}

function visibleWriterMoment(): StoryMoment | null {
  const activeBlock = document.querySelector<HTMLElement>('nav[aria-label="Screenplay blocks"] button[aria-current="page"], nav[aria-label="Screenplay blocks"] button[class*="activeBlock"]');
  const activeMini = document.querySelector<HTMLElement>('[class*="miniNavigator"] [class*="activeMini"]');
  const block = Number(activeBlock?.querySelector("span")?.textContent?.trim());
  const miniText = activeMini?.querySelector("span")?.textContent?.trim() || "";
  const match = miniText.match(/^(\d+)\.(\d+)$/);
  const mini = match ? Number(match[2]) : 0;
  if (Number.isInteger(block) && block >= 1 && block <= 24 && Number.isInteger(mini) && mini >= 1 && mini <= 4) return { block, mini };
  return null;
}

export default function WriteEditHandoff() {
  const [moment, setMoment] = useState<StoryMoment | null>(null);
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    const sync = () => {
      const params = new URLSearchParams(window.location.search);
      if (params.get("workspace") !== "write") {
        setMoment(null);
        return;
      }
      const next = visibleWriterMoment() ?? queryMoment();
      setMoment((current) => current?.block === next?.block && current?.mini === next?.mini ? current : next);
    };

    sync();
    const observer = new MutationObserver(sync);
    observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["class", "aria-current"] });
    window.addEventListener("popstate", sync);
    return () => {
      observer.disconnect();
      window.removeEventListener("popstate", sync);
    };
  }, []);

  if (!moment) return null;

  function openEdit() {
    if (leaving) return;
    setLeaving(true);
    const href = `/edit?block=${moment!.block}&mini=${moment!.mini}`;
    window.setTimeout(() => window.location.assign(href), 420);
  }

  return (
    <aside className="write-edit-handoff" aria-label="Continue selected Write moment in Edit">
      <div><span>Same screenplay</span><strong>Block {moment.block}.{moment.mini}</strong><small>Review this exact story moment</small></div>
      <button type="button" disabled={leaving} onClick={openEdit}>{leaving ? "Opening Edit…" : "Review in Edit"}</button>
    </aside>
  );
}
