"use client";

import { useEffect, useState } from "react";
import { plotPickleCurriculum } from "../adapters/curriculum/current-catalog";
import { answerFromCurriculum } from "../modules/creative-room/curriculum-guide";
import LearnWorkspace from "../modules/learn/ui/learn-workspace";
import FoundationsPlanWorkspace from "../modules/plan/ui/foundations-plan-workspace";

type Workspace = "learn" | "plan";

function requestedWorkspace(): Workspace {
  if (typeof window === "undefined") return "learn";
  return new URLSearchParams(window.location.search).get("workspace") === "plan" ? "plan" : "learn";
}

export default function Home() {
  const [workspace, setWorkspace] = useState<Workspace>("learn");

  useEffect(() => {
    const sync = () => setWorkspace(requestedWorkspace());
    sync();
    window.addEventListener("popstate", sync);
    return () => window.removeEventListener("popstate", sync);
  }, []);

  if (workspace === "plan") {
    return <FoundationsPlanWorkspace curriculum={plotPickleCurriculum} />;
  }

  return (
    <LearnWorkspace
      curriculum={plotPickleCurriculum}
      guide={answerFromCurriculum}
    />
  );
}
