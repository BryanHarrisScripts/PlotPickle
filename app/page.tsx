"use client";

import { plotPickleCurriculum } from "../adapters/curriculum/current-catalog";
import { answerFromCurriculum } from "../modules/creative-room/curriculum-guide";
import LearnWorkspace from "../modules/learn/ui/learn-workspace";

export default function Home() {
  return (
    <LearnWorkspace
      curriculum={plotPickleCurriculum}
      guide={answerFromCurriculum}
    />
  );
}
