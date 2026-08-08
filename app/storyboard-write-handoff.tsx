"use client";

import { useEffect, useState } from "react";

type StoryMoment = {
  block: number;
  mini: number;
};

function queryNumber(params: URLSearchParams, name: string, minimum: number, maximum: number) {
  const value = Number(params.get(name));
  return Number.isInteger(value) && value >= minimum && value <= maximum ? value : 0;
}

function currentStoryboardMoment(): StoryMoment | null {
  const params = new URLSearchParams(window.location.search);
  if (params.get("workspace") !== "storyboard") return null;
  if (params.get("visualSection") !== "frames") return null;
  if (params.get("decision") === "review") return null;

  const block = queryNumber(params, "block", 1, 24);
  const mini = queryNumber(params, "mini", 1, 4);
  return block && mini ? { block, mini } : null;
}

export default function StoryboardWriteHandoff() {
  const [moment, setMoment] = useState<StoryMoment | null>(null);

  useEffect(() => {
    const sync = () => {
      const next = currentStoryboardMoment();
      setMoment((current) => {
        if (!current && !next) return current;
        if (current && next && current.block === next.block && current.mini === next.mini) return current;
        return next;
      });
    };

    sync();
    const observer = new MutationObserver(sync);
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["class", "aria-current"],
    });
    window.addEventListener("popstate", sync);

    return () => {
      observer.disconnect();
      window.removeEventListener("popstate", sync);
    };
  }, []);

  if (!moment) return null;

  const href = `/?workspace=write&block=${moment.block}&mini=${moment.mini}`;
  return (
    <aside className="storyboard-write-handoff" aria-label="Continue selected Storyboard moment">
      <div>
        <span>Continue this story moment</span>
        <strong>Block {moment.block}.{moment.mini}</strong>
        <small>Same canonical mini-block and owning scene</small>
      </div>
      <a href={href}>Write this moment</a>
    </aside>
  );
}
