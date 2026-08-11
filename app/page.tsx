import { plotPickleCurriculum } from "../adapters/curriculum/current-catalog";
import LearnWorkspace from "../modules/learn/ui/learn-workspace";

export default function Home() {
  return <LearnWorkspace curriculum={plotPickleCurriculum} />;
}
