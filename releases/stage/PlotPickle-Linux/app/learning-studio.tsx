"use client";

import { useEffect, useMemo, useState } from "react";
import type { PlotPickleProject } from "@/lib/project";
import { aiRevisionLessons, aiRevisionLessonSearchText, type AiRevisionLesson } from "./learning-ai-revision";
import {
  characterMotionLessons,
  characterMotionSearchText,
  type CharacterMotionLesson,
} from "./learning-characters-in-motion";
import {
  collaborationOwnershipLessons,
  collaborationOwnershipSearchText,
  workflowChoices,
  type CollaborationOwnershipLesson,
  type WorkflowChoice,
} from "./learning-collaboration-ownership";
import { workingTogetherLessons, workingTogetherSearchText, type WorkingTogetherLesson } from "./learning-working-together";
import { dialogueLessons, dialogueLessonSearchText, type DialogueLesson } from "./learning-dialogue-in-motion";
import { storyCraftLessons, storyCraftSearchText, type StoryCraftLesson } from "./learning-story-craft-essentials";
import { coreGuideFor } from "./learning-core-curriculum";
import { learningModules, learningPaths, moduleSearchText, type LearningModule } from "./learning-library";
import { loglinesThatCarryTheMovie } from "./learning-loglines-that-carry-the-movie";
import { moodColourVisualLanguage } from "./learning-mood-colour-visual-language";
import { earlyVisualDevelopmentLesson, earlyVisualDevelopmentSearchText } from "./learning-early-visual-development";
import { whyPlotPickleWorksInLayers, whyPlotPickleSearchText } from "./learning-why-plotpickle";
import { twentyFourBlocksLessons, twentyFourBlocksSearchText, type TwentyFourBlocksLesson } from "./learning-24-blocks";
import styles from "./learning-studio.module.css";

type Props = {
  project: PlotPickleProject;
  blockNumber: number;
  miniBlockNumber: number;
  onBlockChange: (blockNumber: number) => void;
  onMiniBlockChange: (miniBlockNumber: number) => void;
  onOpenTreatment: () => void;
  onOpenScreenplay: () => void;
  onOpenBlock: (blockNumber: number) => void;
};

type ViewMode = "workflow" | "guide" | "library" | "method" | "ai-revision" | "collaboration" | "working-together" | "characters" | "dialogue" | "story-craft";
type CourseModule = LearningModule | TwentyFourBlocksLesson | AiRevisionLesson | CollaborationOwnershipLesson | CharacterMotionLesson | WorkingTogetherLesson | DialogueLesson | StoryCraftLesson;

const courseModules: CourseModule[] = [
  ...learningModules,
  loglinesThatCarryTheMovie,
  moodColourVisualLanguage,
  earlyVisualDevelopmentLesson,
  whyPlotPickleWorksInLayers,
  ...twentyFourBlocksLessons,
  ...aiRevisionLessons,
  ...collaborationOwnershipLessons,
  ...workingTogetherLessons,
  ...characterMotionLessons,
  ...dialogueLessons,
  ...storyCraftLessons,
];
const anatomy = ["Structure", "Dialogue", "Character", "Theme & conflict", "World-building", "Pacing & tone", "Symbolic techniques"];

function isMethodLesson(module: CourseModule): module is TwentyFourBlocksLesson {
  return "collection" in module && module.collection === "The 24 Blocks Method";
}

function isAiRevisionLesson(module: CourseModule): module is AiRevisionLesson {
  return "collection" in module && module.collection === "AI-Assisted Revision";
}

function isCollaborationLesson(module: CourseModule): module is CollaborationOwnershipLesson {
  return "collection" in module && module.collection === "Collaboration, Formats & Ownership";
}

function isCharacterMotionLesson(module: CourseModule): module is CharacterMotionLesson {
  return "collection" in module && module.collection === "Characters in Motion";
}

function isWorkingTogetherLesson(module: CourseModule): module is WorkingTogetherLesson {
  return "collection" in module && module.collection === "Working Together in PlotPickle";
}

function isDialogueLesson(module: CourseModule): module is DialogueLesson {
  return "collection" in module && module.collection === "Dialogue in Motion";
}

function isStoryCraftLesson(module: CourseModule): module is StoryCraftLesson {
  return "collection" in module && module.collection === "Story Craft Essentials";
}

function courseSearchText(module: CourseModule) {
  const base = moduleSearchText(module);
  if (isMethodLesson(module)) return `${base} ${twentyFourBlocksSearchText(module)}`;
  if (isAiRevisionLesson(module)) return `${base} ${aiRevisionLessonSearchText(module)}`;
  if (isCollaborationLesson(module)) return `${base} ${collaborationOwnershipSearchText(module)}`;
  if (isWorkingTogetherLesson(module)) return `${base} ${workingTogetherSearchText(module)}`;
  if (isDialogueLesson(module)) return `${base} ${dialogueLessonSearchText(module)}`;
  if (isStoryCraftLesson(module)) return `${base} ${storyCraftSearchText(module)}`;
  if (isCharacterMotionLesson(module)) return `${base} ${characterMotionSearchText(module)}`;
  if (module.id === earlyVisualDevelopmentLesson.id) return `${base} ${earlyVisualDevelopmentSearchText()}`;
  if (module.id === whyPlotPickleWorksInLayers.id) return `${base} ${whyPlotPickleSearchText()}`;
  const coreGuide = coreGuideFor(module.id);
  if (coreGuide) return `${base} ${coreGuide.sourceTitle} ${coreGuide.sourceAliases.join(" ")} ${coreGuide.adaptation} ${coreGuide.understand} ${coreGuide.seeIt} ${coreGuide.tryIt} ${coreGuide.applyLabel} ${coreGuide.checkLabel} ${coreGuide.deeperLabel} ${coreGuide.commonNextProblem}`;
  return base;
}

function miniBlocks(project: PlotPickleProject, blockNumber: number) {
  return project.blocks[blockNumber - 1].scenes.flatMap((scene) => scene.miniBlocks);
}

function recommendations(blockNumber: number, miniBlockNumber: number) {
  const stage = blockNumber <= 4
    ? ["24b-new-spin", "24b-dramatic-question", "pitch"]
    : blockNumber <= 8
      ? ["24b-structure-guide", "24b-story-beats", "world-building"]
      : blockNumber <= 16
        ? ["24b-structures-role", "24b-structure-diversity", "structures"]
        : blockNumber <= 20
          ? ["24b-reflection", "24b-ai", "responsible-ai"]
          : ["24b-dynamic-scenes", "24b-reflection", "formatting"];
  const byMovement = miniBlockNumber === 1
    ? "24b-principle-three"
    : miniBlockNumber === 2
      ? "24b-story-beats"
      : miniBlockNumber === 3
        ? "24b-structures-role"
        : "24b-dynamic-scenes";
  const aiByStage = blockNumber <= 4
    ? "ai-revision-character-choice-arc"
    : blockNumber <= 12
      ? "ai-revision-structure-causality"
      : blockNumber <= 18
        ? "ai-revision-conflict-stakes-escalation"
        : "ai-revision-pacing-repetition";
  const aiByMovement = miniBlockNumber === 1
    ? "ai-revision-theme-motif-foreshadowing"
    : miniBlockNumber === 2
      ? "ai-revision-scene-purpose-turn"
      : miniBlockNumber === 3
        ? "ai-revision-conflict-stakes-escalation"
        : "ai-revision-visual-pageflow";
  const characterByStage = blockNumber <= 4
    ? "characters-engine"
    : blockNumber <= 8
      ? "characters-relationships"
      : blockNumber <= 13
        ? "characters-inner-journey"
        : blockNumber <= 19
          ? "characters-conflict"
          : "characters-choice-proof";
  const characterByMovement = miniBlockNumber === 1
    ? "characters-engine"
    : miniBlockNumber === 2
      ? "characters-choice-proof"
      : miniBlockNumber === 3
        ? "characters-conflict"
        : "characters-voiceprint";
  const dialogueByStage = blockNumber <= 6
    ? "dialogue-action"
    : blockNumber <= 12
      ? "dialogue-subtext"
      : blockNumber <= 18
        ? "dialogue-conflict"
        : "dialogue-revision";
  const dialogueByMovement = miniBlockNumber === 1
    ? "dialogue-exposition-genre"
    : miniBlockNumber === 2
      ? "dialogue-voiceprint"
      : miniBlockNumber === 3
        ? "dialogue-conflict"
        : "dialogue-exchange-turn";
  const essentialsByStage = blockNumber <= 4
    ? "essentials-experience"
    : blockNumber <= 10
      ? "essentials-pacing"
      : blockNumber <= 16
        ? "essentials-theme"
        : blockNumber <= 20
          ? "essentials-motif"
          : "essentials-audit";
  const essentialsByMovement = miniBlockNumber === 1
    ? "essentials-tone"
    : miniBlockNumber === 2
      ? "essentials-screen-evidence"
      : miniBlockNumber === 3
        ? "essentials-scene"
        : "essentials-formatting";
  return [...new Set([essentialsByMovement, essentialsByStage, dialogueByMovement, dialogueByStage, characterByMovement, characterByStage, aiByMovement, aiByStage, byMovement, ...stage])].slice(0, 10);
}

function clickNamedNavigationButton(navLabel: string, buttonLabel: string) {
  const navigation = document.querySelector(`nav[aria-label="${navLabel}"]`);
  const button = Array.from(navigation?.querySelectorAll<HTMLButtonElement>("button") ?? [])
    .find((item) => item.textContent?.includes(buttonLabel));
  button?.click();
  return Boolean(button);
}

export default function LearningStudio({ project, blockNumber, miniBlockNumber, onBlockChange, onMiniBlockChange, onOpenTreatment, onOpenScreenplay, onOpenBlock }: Props) {
  const [query, setQuery] = useState("");
  const [path, setPath] = useState<(typeof learningPaths)[number]>("All");
  const [view, setView] = useState<ViewMode>("workflow");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [completed, setCompleted] = useState<Set<string>>(new Set());
  const [workflowChoiceId, setWorkflowChoiceId] = useState<WorkflowChoice["id"] | null>(null);
  const block = project.blocks[blockNumber - 1];
  const minis = miniBlocks(project, blockNumber);
  const mini = minis[miniBlockNumber - 1];
  const storageKey = `plotpickle-learning-progress:${project.id}`;
  const workflowStorageKey = `plotpickle-workflow-choice:${project.id}`;
  const recommendedIds = recommendations(blockNumber, miniBlockNumber);
  const selected = courseModules.find((module) => module.id === selectedId) ?? null;

  useEffect(() => {
    const loadProgress = window.setTimeout(() => {
      try {
        const saved = window.localStorage.getItem(storageKey);
        setCompleted(new Set(saved ? JSON.parse(saved) as string[] : []));
        const savedWorkflow = window.localStorage.getItem(workflowStorageKey) as WorkflowChoice["id"] | null;
        const params = new URLSearchParams(window.location.search);
        const requestedView = params.get("view") as ViewMode | null;
        const requestedModule = params.get("module");
        const validViews: ViewMode[] = ["workflow", "guide", "library", "method", "ai-revision", "collaboration", "working-together", "characters", "dialogue", "story-craft"];
        if (requestedView && validViews.includes(requestedView)) {
          setView(requestedView);
        } else if (savedWorkflow && workflowChoices.some((choice) => choice.id === savedWorkflow)) {
          setWorkflowChoiceId(savedWorkflow);
          setView("library");
        } else {
          setWorkflowChoiceId(null);
          setView("workflow");
        }
        if (requestedModule && courseModules.some((module) => module.id === requestedModule)) setSelectedId(requestedModule);
      } catch {
        setCompleted(new Set());
        setWorkflowChoiceId(null);
        setView("workflow");
      }
    }, 0);
    return () => window.clearTimeout(loadProgress);
  }, [storageKey, workflowStorageKey]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return courseModules.filter((module) => (path === "All" || module.path === path) && (!needle || courseSearchText(module).includes(needle)));
  }, [path, query]);

  function openCollaborationWorkspace(module: CollaborationOwnershipLesson) {
    if (module.workspaceTarget === "writer") {
      onOpenScreenplay();
      return;
    }
    if (module.workspaceTarget === "pitch-review") {
      window.location.assign(module.workspaceHref);
      return;
    }
    if (module.workspaceTarget === "project-overview") {
      clickNamedNavigationButton("Primary workspaces", "Story Planner");
      window.setTimeout(() => clickNamedNavigationButton("Story Planner story sections", "Project Overview"), 0);
      return;
    }
    clickNamedNavigationButton("Primary workspaces", "Settings");
    const settingsSection = module.workspaceTarget === "ai-setup" ? "AI Setup" : "GitHub";
    window.setTimeout(() => clickNamedNavigationButton("Settings sections", settingsSection), 0);
  }

  function openCharacterWorkspace(module: CharacterMotionLesson) {
    if (module.workspaceHref === "/characters-in-motion") {
      const queryString = new URLSearchParams({
        block: String(block.number),
        mini: String(mini.number),
        lesson: module.id,
      });
      const section = module.workspaceSection ? `#${module.workspaceSection}` : "";
      window.location.assign(`${module.workspaceHref}?${queryString.toString()}${section}`);
      return;
    }
    window.location.assign(module.workspaceHref);
  }

  function openDialogueWorkspace(module: DialogueLesson) {
    const queryString = new URLSearchParams({ block: String(block.number), mini: String(mini.number), lesson: module.id });
    const section = module.workspaceSection ? `#${module.workspaceSection}` : "";
    window.location.assign(`${module.workspaceHref}?${queryString.toString()}${section}`);
  }

  function openStoryCraftWorkspace(module: StoryCraftLesson) {
    const queryString = new URLSearchParams({ block: String(block.number), mini: String(mini.number), lesson: module.id });
    const section = module.workspaceSection ? `#${module.workspaceSection}` : "";
    window.location.assign(`${module.workspaceHref}?${queryString.toString()}${section}`);
  }

  function applyModule(module: CourseModule) {
    if (isAiRevisionLesson(module)) {
      window.location.assign(module.workspaceHref);
      return;
    }
    if (isCollaborationLesson(module)) {
      openCollaborationWorkspace(module);
      return;
    }
    if (isCharacterMotionLesson(module)) {
      openCharacterWorkspace(module);
      return;
    }
    if (isWorkingTogetherLesson(module)) {
      window.location.assign(module.workspaceHref);
      return;
    }
    if (isDialogueLesson(module)) {
      openDialogueWorkspace(module);
      return;
    }
    if (isStoryCraftLesson(module)) {
      openStoryCraftWorkspace(module);
      return;
    }
    const coreGuide = coreGuideFor(module.id);
    if (coreGuide) {
      window.location.assign(coreGuide.applyHref);
      return;
    }
    if (module.apply === "Screenplay") onOpenScreenplay();
    else if (module.apply === "Block plan") onOpenBlock(block.number);
    else onOpenTreatment();
  }

  function toggleComplete(moduleId: string) {
    setCompleted((current) => {
      const next = new Set(current);
      if (next.has(moduleId)) next.delete(moduleId);
      else next.add(moduleId);
      try {
        window.localStorage.setItem(storageKey, JSON.stringify([...next]));
      } catch {
        // Learning remains usable when browser storage is unavailable.
      }
      return next;
    });
  }

  function openModule(moduleId: string) {
    setSelectedId(moduleId);
    window.setTimeout(() => document.getElementById("learning-module-reader")?.scrollIntoView({ behavior: "smooth", block: "start" }), 0);
  }

  function chooseWorkflow(choice: WorkflowChoice) {
    setWorkflowChoiceId(choice.id);
    try {
      window.localStorage.setItem(workflowStorageKey, choice.id);
    } catch {
      // The workflow chooser remains usable without persistent browser storage.
    }
    setView("collaboration");
    openModule(choice.lessonId);
  }

  function reviewWorkflowLesson(choice: WorkflowChoice) {
    setView("collaboration");
    openModule(choice.lessonId);
  }

  function moveModule(direction: -1 | 1) {
    if (!selected) return;
    const index = courseModules.findIndex((module) => module.id === selected.id);
    const next = courseModules[index + direction];
    if (next) openModule(next.id);
  }

  const progress = Math.round((completed.size / courseModules.length) * 100);

  return <div className={styles.page}>
    <header className={styles.header}>
      <div><span>Read & Learn</span><h1>The complete PlotPickle screenwriting course.</h1><p>Learn the craft, choose how you want to work, and apply each lesson directly to the active Block, character evidence, treatment, screenplay, collaboration workflow, guided revision pass or specialist workspace.</p></div>
      <div className={styles.licence}><strong>Shared teaching, private writing</strong><span>Educational guidance: CC BY-SA 4.0</span><small>Your original story and screenplay remain yours and are not automatically licensed to PlotPickle or the public.</small></div>
    </header>

    <section className={styles.position}>
      <div><span>Current story position</span><h2>Block {block.number}.{mini.number}: {mini.label}</h2><p>{mini.function}</p></div>
      <label>Block<select value={blockNumber} onChange={(event) => { onBlockChange(Number(event.target.value)); onMiniBlockChange(1); }}>{project.blocks.map((item) => <option value={item.number} key={item.id}>{item.number} · {item.title}</option>)}</select></label>
      <label>Mini-block<select value={miniBlockNumber} onChange={(event) => onMiniBlockChange(Number(event.target.value))}>{minis.map((item) => <option value={item.number} key={item.id}>{block.number}.{item.number} · {item.label}</option>)}</select></label>
    </section>

    <section className={styles.courseStatus} aria-label="Learning progress">
      <div><span>Course progress</span><strong>{completed.size} of {courseModules.length} modules complete</strong></div>
      <div className={styles.progressTrack}><i style={{ width: `${progress}%` }} /></div>
      <b>{progress}%</b>
    </section>

    <section className={styles.anatomy} aria-label="Learning entry points">
      <div><span>Choose your learning view</span><strong>Complete Learning Library or the PlotPickle Core Curriculum</strong></div>
      <ul>
        <li><b>1</b><button type="button" onClick={() => setView("library")}>Complete Learning Library</button></li>
        <li><b>2</b><button type="button" onClick={() => window.location.assign("/core-curriculum")}>Start with the PlotPickle Core Curriculum</button></li>
      </ul>
    </section>

    <section className={styles.anatomy}>
      <div><span>Screenplay anatomy</span><strong>Seven lenses run through the complete course</strong></div>
      <ul>{anatomy.map((item, index) => <li key={item}><b>{index + 1}</b>{item}</li>)}</ul>
    </section>

    <nav className={styles.viewTabs} aria-label="Learning Studio views">
      <button type="button" className={view === "library" ? styles.active : ""} onClick={() => setView("library")}>Complete Learning Library</button>
      <button type="button" onClick={() => window.location.assign("/core-curriculum")}>Core Curriculum</button>
      <button type="button" className={view === "workflow" ? styles.active : ""} onClick={() => setView("workflow")}>Choose Your Workflow</button>
      <button type="button" className={view === "method" ? styles.active : ""} onClick={() => setView("method")}>The 24 Blocks Method</button>
      <button type="button" className={view === "characters" ? styles.active : ""} onClick={() => setView("characters")}>Characters in Motion</button>
      <button type="button" className={view === "dialogue" ? styles.active : ""} onClick={() => setView("dialogue")}>Dialogue in Motion</button>
      <button type="button" className={view === "story-craft" ? styles.active : ""} onClick={() => setView("story-craft")}>Story Craft Essentials</button>
      <button type="button" className={view === "ai-revision" ? styles.active : ""} onClick={() => setView("ai-revision")}>AI-Assisted Revision</button>
      <button type="button" className={view === "collaboration" ? styles.active : ""} onClick={() => setView("collaboration")}>Collaboration, Formats & Ownership</button>
      <button type="button" className={view === "working-together" ? styles.active : ""} onClick={() => setView("working-together")}>Working Together</button>
      <button type="button" className={view === "guide" ? styles.active : ""} onClick={() => setView("guide")}>Guidance for this Block</button>
    </nav>

    {view === "workflow" ? <section className={styles.guidance}>
      <div className={styles.sectionIntro}><span>First-run guide</span><h2>Choose how you want to work</h2><p>Compare all five valid paths. Choosing one records a project preference and opens the most relevant lesson; it does not connect an account, publish the project, run AI or change story material.</p></div>
      <div className={styles.recommendedGrid}>{workflowChoices.map((choice) => <WorkflowChoiceCard choice={choice} selected={workflowChoiceId === choice.id} onChoose={() => chooseWorkflow(choice)} onRead={() => reviewWorkflowLesson(choice)} key={choice.id} />)}</div>
      <button className={styles.browseAll} type="button" onClick={() => setView("collaboration")}>Explore all collaboration and ownership lessons</button>
    </section> : view === "guide" ? <section className={styles.guidance}>
      <div className={styles.sectionIntro}><span>Recommended here</span><h2>Learn what helps at Block {block.number}.{mini.number}</h2><p>These craft lessons, character questions and guided revision passes match the current stage and mini-block movement. Opening one does not change the story.</p></div>
      <div className={styles.recommendedGrid}>{recommendedIds.map((id) => {
        const recommendedModule = courseModules.find((item) => item.id === id);
        return recommendedModule ? <ModuleCard module={recommendedModule} complete={completed.has(recommendedModule.id)} recommended onOpen={() => openModule(recommendedModule.id)} onToggle={() => toggleComplete(recommendedModule.id)} key={recommendedModule.id} /> : null;
      })}</div>
      <button className={styles.browseAll} type="button" onClick={() => setView("library")}>Browse all {courseModules.length} complete modules</button>
    </section> : view === "method" ? <section className={styles.library}>
      <div className={styles.sectionIntro}><span>Foundational collection</span><h2>The 24 Blocks Method</h2><p>Ten PlotPickled lessons make the original concepts explicit, searchable and directly applicable to the current 4-act, 12-sequence, 24-block and 96-mini-block architecture.</p></div>
      <main className={styles.moduleGrid}>{twentyFourBlocksLessons.map((module) => <ModuleCard module={module} complete={completed.has(module.id)} recommended={recommendedIds.includes(module.id)} onOpen={() => openModule(module.id)} onToggle={() => toggleComplete(module.id)} key={module.id} />)}</main>
    </section> : view === "characters" ? <section className={styles.library}>
      <div className={styles.sectionIntro}><span>Behaviour-first character collection</span><h2>Characters in Motion</h2><p>Eight PlotPickled lessons connect character engine, choice evidence, flexible arc checkpoints, conflict, opposition, relationships, Voiceprint and cast design to the active story and Character Proof dashboard.</p></div>
      <main className={styles.moduleGrid}>{characterMotionLessons.map((module) => <ModuleCard module={module} complete={completed.has(module.id)} recommended={recommendedIds.includes(module.id)} onOpen={() => openModule(module.id)} onToggle={() => toggleComplete(module.id)} key={module.id} />)}</main>
    </section> : view === "dialogue" ? <section className={styles.library}>
      <div className={styles.sectionIntro}><span>Playable screenplay dialogue collection</span><h2>Dialogue in Motion</h2><p>Eight PlotPickled lessons connect objectives, tactics, Voiceprint, subtext, conflict, action, silence, exposition, genre, scene turns, revision and table-read evidence to the active project.</p></div>
      <main className={styles.moduleGrid}>{dialogueLessons.map((module) => <ModuleCard module={module} complete={completed.has(module.id)} recommended={recommendedIds.includes(module.id)} onOpen={() => openModule(module.id)} onToggle={() => toggleComplete(module.id)} key={module.id} />)}</main>
    </section> : view === "story-craft" ? <section className={styles.library}>
      <div className={styles.sectionIntro}><span>Integrated craft path</span><h2>Story Craft Essentials</h2><p>Nine PlotPickled lessons connect audience experience, pacing, tone, thematic argument, scene change, screen evidence, motifs, advanced screenplay forms and an evidence-based craft audit to the active project.</p></div>
      <main className={styles.moduleGrid}>{storyCraftLessons.map((module) => <ModuleCard module={module} complete={completed.has(module.id)} recommended={recommendedIds.includes(module.id)} onOpen={() => openModule(module.id)} onToggle={() => toggleComplete(module.id)} key={module.id} />)}</main>
    </section> : view === "ai-revision" ? <section className={styles.library}>
      <div className={styles.sectionIntro}><span>Guided collection</span><h2>AI-Assisted Revision</h2><p>Fourteen focused passes begin with the story problem, limit the operation and canonical scope, identify evaluation criteria and known AI failure modes, and route approved work to the right PlotPickle engine or lab.</p></div>
      <main className={styles.moduleGrid}>{aiRevisionLessons.map((module) => <ModuleCard module={module} complete={completed.has(module.id)} recommended={recommendedIds.includes(module.id)} onOpen={() => openModule(module.id)} onToggle={() => toggleComplete(module.id)} key={module.id} />)}</main>
    </section> : view === "collaboration" ? <section className={styles.library}>
      <div className={styles.sectionIntro}><span>Practical workflow collection</span><h2>Collaboration, Formats & Ownership</h2><p>Five PlotPickled lessons replace eight legacy Blog articles with current local-first workflow choices, owner-controlled collaboration, direct screenplay interchange, careful rights guidance and optional AI, GitHub and public publishing paths.</p></div>
      <main className={styles.moduleGrid}>{collaborationOwnershipLessons.map((module) => <ModuleCard module={module} complete={completed.has(module.id)} recommended={workflowChoices.find((choice) => choice.id === workflowChoiceId)?.lessonId === module.id} onOpen={() => openModule(module.id)} onToggle={() => toggleComplete(module.id)} key={module.id} />)}</main>
    </section> : view === "working-together" ? <section className={styles.library}>
      <div className={styles.sectionIntro}><span>Contributor onboarding and review handbook</span><h2>Working Together in PlotPickle</h2><p>Nine PlotPickled lessons define collaboration models, roles, briefs, approved-story workflow, proposal packets, anchored review, canon decisions, rights, privacy and scalable creative review without requiring GitHub or public licensing.</p></div>
      <main className={styles.moduleGrid}>{workingTogetherLessons.map((module) => <ModuleCard module={module} complete={completed.has(module.id)} recommended={false} onOpen={() => openModule(module.id)} onToggle={() => toggleComplete(module.id)} key={module.id} />)}</main>
    </section> : <section className={styles.library}>
      <div className={styles.sectionIntro}><span>Complete curriculum</span><h2>{courseModules.length} full learning modules</h2><p>Search lesson text, legacy source aliases, character evidence, arc shapes, relationship perspectives, workflow paths, format cautions, ownership distinctions, revision operations, definitions, examples, checklists, common mistakes and active-project exercises—not only module titles.</p></div>
      <section className={styles.filters}>
        <input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search 24 Blocks, story experience, pacing, tone, theme, motifs, montage, playable dialogue, Voiceprint, ownership, AI revision…" aria-label="Search screenwriting lessons" />
        <div>{learningPaths.map((item) => <button type="button" className={path === item ? styles.active : ""} onClick={() => setPath(item)} key={item}>{item}</button>)}</div>
      </section>
      <main className={styles.moduleGrid}>{filtered.map((module) => <ModuleCard module={module} complete={completed.has(module.id)} recommended={recommendedIds.includes(module.id)} onOpen={() => openModule(module.id)} onToggle={() => toggleComplete(module.id)} key={module.id} />)}</main>
      {!filtered.length ? <div className={styles.empty}>No module matches that search. Try character guide, inner journey, archetypes, heart of conflict, dialectical triad, Act questions, collaboration, Fountain, ownership, AI navigation, continuity or privacy.</div> : null}
    </section>}

    {selected ? <ModuleReader module={selected} complete={completed.has(selected.id)} blockNumber={block.number} miniBlockNumber={mini.number} first={selected.id === courseModules[0]?.id} last={selected.id === courseModules.at(-1)?.id} onClose={() => setSelectedId(null)} onPrevious={() => moveModule(-1)} onNext={() => moveModule(1)} onToggle={() => toggleComplete(selected.id)} onApply={() => applyModule(selected)} /> : null}
  </div>;
}

function WorkflowChoiceCard({ choice, selected, onChoose, onRead }: { choice: WorkflowChoice; selected: boolean; onChoose: () => void; onRead: () => void }) {
  return <article className={`${styles.moduleCard} ${selected ? styles.recommended : ""}`}>
    <div className={styles.moduleMeta}><span>Workflow path</span>{selected ? <strong>Current choice</strong> : null}</div>
    <small>{choice.accountRequirement}</small>
    <h3>{choice.title}</h3>
    <p>{choice.summary}</p>
    <div className={styles.cardStats}><span>{choice.workspaceLabel}</span><span>Writer-controlled</span></div>
    <div className={styles.cardActions}><button type="button" onClick={onChoose}>{selected ? "Keep this path" : "Choose this path"}</button><button type="button" onClick={onRead}>Read linked lesson</button></div>
  </article>;
}

function ModuleCard({ module, complete, recommended, onOpen, onToggle }: { module: CourseModule; complete: boolean; recommended: boolean; onOpen: () => void; onToggle: () => void }) {
  return <article className={`${styles.moduleCard} ${recommended ? styles.recommended : ""}`}>
    <div className={styles.moduleMeta}><span>Module {module.number} · {module.path}</span>{recommended ? <strong>Recommended here</strong> : null}</div>
    {isMethodLesson(module) ? <small>{module.collection} · Source concept: {module.sourceConcept}</small> : null}
    {isAiRevisionLesson(module) ? <small>{module.collection} · {module.layer} · Route to {module.destination}</small> : null}
    {isCollaborationLesson(module) ? <small>{module.collection} · Open {module.workspaceLabel}</small> : null}
    {isWorkingTogetherLesson(module) ? <small>{module.collection} · Open {module.workspaceLabel}</small> : null}
    {isDialogueLesson(module) ? <small>{module.collection} · Open {module.workspaceLabel}</small> : null}
    {isStoryCraftLesson(module) ? <small>{module.collection} · Open {module.workspaceLabel}</small> : null}
    {coreGuideFor(module.id) ? <small>PlotPickle Core Curriculum · {coreGuideFor(module.id)?.sourceTitle}</small> : null}
    {isCharacterMotionLesson(module) ? <small>{module.collection} · Open {module.workspaceLabel}</small> : null}
    <h3>{module.title}</h3>
    <p>{module.overview}</p>
    <div className={styles.cardStats}><span>{module.duration}</span><span>{module.sections.length} lessons</span>{isAiRevisionLesson(module) ? <span>{module.defaultOperation}</span> : isCollaborationLesson(module) || isWorkingTogetherLesson(module) || isDialogueLesson(module) || isStoryCraftLesson(module) || isCharacterMotionLesson(module) ? <span>{module.workspaceLabel}</span> : <span>Exercise</span>}</div>
    <div className={styles.cardActions}><button type="button" onClick={onOpen}>Read full module</button><button type="button" className={complete ? styles.complete : ""} onClick={onToggle}>{complete ? "Completed" : "Mark complete"}</button></div>
  </article>;
}

function ModuleReader({ module, complete, blockNumber, miniBlockNumber, first, last, onClose, onPrevious, onNext, onToggle, onApply }: { module: CourseModule; complete: boolean; blockNumber: number; miniBlockNumber: number; first: boolean; last: boolean; onClose: () => void; onPrevious: () => void; onNext: () => void; onToggle: () => void; onApply: () => void }) {
  return <section className={styles.reader} id="learning-module-reader">
    <div className={styles.readerTop}><button type="button" onClick={onClose}>Close module</button><div><button type="button" disabled={first} onClick={onPrevious}>Previous</button><button type="button" disabled={last} onClick={onNext}>Next</button></div></div>
    <header className={styles.readerHeader}><span>Module {module.number} of {courseModules.length} · {module.path} · {module.duration}</span><h2>{module.title}</h2><p>{module.overview}</p>{isMethodLesson(module) || isAiRevisionLesson(module) || isCollaborationLesson(module) || isWorkingTogetherLesson(module) || isDialogueLesson(module) || isStoryCraftLesson(module) || isCharacterMotionLesson(module) ? <small>{module.sourceNote}</small> : null}{coreGuideFor(module.id) ? <small>Adapted from {coreGuideFor(module.id)?.sourceTitle} and rewritten for PlotPickle&apos;s current local-first workflow. Legacy phrases remain searchable.</small> : null}<button type="button" className={complete ? styles.complete : ""} onClick={onToggle}>{complete ? "Completed — mark incomplete" : "Mark module complete"}</button></header>

    <div className={styles.readerLayout}>
      <main>
        <section className={styles.objectives}><h3>What you will learn</h3><ul>{module.objectives.map((objective) => <li key={objective}>{objective}</li>)}</ul></section>
        {module.sections.map((section) => <section className={styles.lessonSection} key={section.heading}><h3>{section.heading}</h3>{section.paragraphs.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}{section.points?.length ? <ul>{section.points.map((point) => <li key={point}>{point}</li>)}</ul> : null}</section>)}
        {isMethodLesson(module) ? <section className={styles.example}><span>Visual hierarchy</span><h3>{module.sourceConcept}</h3><p>{module.visual.join(" → ")}</p></section> : null}
        {isMethodLesson(module) ? <section className={styles.lessonSection}><h3>How PlotPickle applies this</h3><p>{module.howPlotPickleApplies}</p></section> : null}
        {isAiRevisionLesson(module) ? <section className={styles.example}><span>Guided pass setup</span><h3>{module.layer} · {module.destination}</h3><p>Default operation: {module.defaultOperation}. Canonical scope: {module.canonicalScopes.join(" · ")}. The original remains separate from any proposed revision until the writer approves it.</p></section> : null}
        {isCollaborationLesson(module) ? <section className={styles.example}><span>Direct application</span><h3>{module.workspaceLabel}</h3><p>This lesson opens the current PlotPickle workspace rather than an obsolete external workaround. Opening it does not publish, connect, licence, merge or apply story changes automatically.</p></section> : null}
        {isWorkingTogetherLesson(module) ? <section className={styles.example}><span>Direct application</span><h3>{module.workspaceLabel}</h3><p>Create a project-specific welcome card, contribution brief, proposal packet, anchored review note or decision record. Records stay local until the writer deliberately shares a proposal.</p></section> : null}
        {isDialogueLesson(module) ? <section className={styles.example}><span>Direct application</span><h3>{module.workspaceLabel}</h3><p>The active Block and mini-block travel into the dialogue workspace. Blueprint, proof and table-read records remain reviewable evidence; no screenplay text is rewritten or applied automatically.</p></section> : null}
        {isStoryCraftLesson(module) ? <section className={styles.example}><span>Direct application</span><h3>{module.workspaceLabel}</h3><p>The active Block and mini-block travel into the craft workspace. Cards, maps, ledgers and audits remain evidence records; no story or screenplay text is rewritten, formatted or inserted automatically.</p></section> : null}
        {isCharacterMotionLesson(module) ? <section className={styles.example}><span>Direct application</span><h3>{module.workspaceLabel}</h3><p>The active Block and mini-block travel into the character workspace. Diagnostics compare planned claims with project evidence and remain questions for the writer; no character, relationship, scene or dialogue is rewritten or merged automatically.</p></section> : null}
        {coreGuideFor(module.id) ? <section className={styles.example}><span>Core-to-workspace path</span><h3>Understand → See it → Try it → Apply it → Check it → Go deeper</h3><p><strong>Understand:</strong> {coreGuideFor(module.id)?.understand}</p><p><strong>See it:</strong> {coreGuideFor(module.id)?.seeIt}</p><p><strong>Try it:</strong> {coreGuideFor(module.id)?.tryIt}</p><p><a href={coreGuideFor(module.id)?.applyHref}>{coreGuideFor(module.id)?.applyLabel}</a> · <a href={coreGuideFor(module.id)?.checkHref}>{coreGuideFor(module.id)?.checkLabel}</a> · <a href={coreGuideFor(module.id)?.deeperHref}>{coreGuideFor(module.id)?.deeperLabel}</a></p><small>Recommended before and useful after relationships are advisory, never locked prerequisites.</small></section> : null}
        <section className={styles.example}><span>Worked example</span><h3>{module.example.title}</h3><p>{module.example.text}</p></section>
        <section className={styles.exercise}><span>Apply it to Block {blockNumber}.{miniBlockNumber}</span><h3>Active-project exercise</h3><p>{module.exercise}</p><button type="button" onClick={onApply}>Open {isAiRevisionLesson(module) ? module.destination : isCollaborationLesson(module) || isWorkingTogetherLesson(module) || isDialogueLesson(module) || isStoryCraftLesson(module) || isCharacterMotionLesson(module) ? module.workspaceLabel : coreGuideFor(module.id)?.applyLabel ?? module.apply}</button></section>
      </main>
      <aside>
        <section><h3>Plain-language definitions</h3><dl>{module.definitions.map((item) => <div key={item.term}><dt>{item.term}</dt><dd>{item.meaning}</dd></div>)}</dl></section>
        <section><h3>Practical checklist</h3><ul className={styles.checklist}>{module.checklist.map((item) => <li key={item}>{item}</li>)}</ul></section>
        <section className={styles.mistakes}><h3>Common mistakes</h3><ul>{module.mistakes.map((item) => <li key={item}>{item}</li>)}</ul></section>
      </aside>
    </div>
  </section>;
}
