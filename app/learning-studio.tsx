"use client";

import { useEffect, useMemo, useState } from "react";
import type { PlotPickleProject } from "@/lib/project";
import { learningModules, learningPaths, moduleSearchText, type LearningModule } from "./learning-library";
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

type ViewMode = "guide" | "library" | "method";
type CourseModule = LearningModule | TwentyFourBlocksLesson;

const courseModules: CourseModule[] = [...learningModules, ...twentyFourBlocksLessons];
const anatomy = ["Structure", "Dialogue", "Character", "Theme & conflict", "World-building", "Pacing & tone", "Symbolic techniques"];

function isMethodLesson(module: CourseModule): module is TwentyFourBlocksLesson {
  return "collection" in module && module.collection === "The 24 Blocks Method";
}

function courseSearchText(module: CourseModule) {
  const base = moduleSearchText(module);
  return isMethodLesson(module) ? `${base} ${twentyFourBlocksSearchText(module)}` : base;
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
  return [...new Set([byMovement, ...stage])].slice(0, 4);
}

export default function LearningStudio({ project, blockNumber, miniBlockNumber, onBlockChange, onMiniBlockChange, onOpenTreatment, onOpenScreenplay, onOpenBlock }: Props) {
  const [query, setQuery] = useState("");
  const [path, setPath] = useState<(typeof learningPaths)[number]>("All");
  const [view, setView] = useState<ViewMode>("library");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [completed, setCompleted] = useState<Set<string>>(new Set());
  const block = project.blocks[blockNumber - 1];
  const minis = miniBlocks(project, blockNumber);
  const mini = minis[miniBlockNumber - 1];
  const storageKey = `plotpickle-learning-progress:${project.id}`;
  const recommendedIds = recommendations(blockNumber, miniBlockNumber);
  const selected = courseModules.find((module) => module.id === selectedId) ?? null;

  useEffect(() => {
    const loadProgress = window.setTimeout(() => {
      try {
        const saved = window.localStorage.getItem(storageKey);
        setCompleted(new Set(saved ? JSON.parse(saved) as string[] : []));
      } catch {
        setCompleted(new Set());
      }
    }, 0);

    return () => window.clearTimeout(loadProgress);
  }, [storageKey]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return courseModules.filter((module) => (path === "All" || module.path === path) && (!needle || courseSearchText(module).includes(needle)));
  }, [path, query]);

  function applyModule(module: CourseModule) {
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

  function moveModule(direction: -1 | 1) {
    if (!selected) return;
    const index = courseModules.findIndex((module) => module.id === selected.id);
    const next = courseModules[index + direction];
    if (next) openModule(next.id);
  }

  const progress = Math.round((completed.size / courseModules.length) * 100);

  return <div className={styles.page}>
    <header className={styles.header}>
      <div><span>Read & Learn</span><h1>The complete PlotPickle screenwriting course.</h1><p>Learn the craft in depth, then apply each lesson directly to the active Block, treatment, screenplay or visual-development flow.</p></div>
      <div className={styles.licence}><strong>Shared teaching, private writing</strong><span>Educational guidance: CC BY-SA 4.0</span><small>Your original story and screenplay remain yours.</small></div>
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

    <section className={styles.anatomy}>
      <div><span>Screenplay anatomy</span><strong>Seven lenses run through the complete course</strong></div>
      <ul>{anatomy.map((item, index) => <li key={item}><b>{index + 1}</b>{item}</li>)}</ul>
    </section>

    <nav className={styles.viewTabs} aria-label="Learning Studio views">
      <button type="button" className={view === "library" ? styles.active : ""} onClick={() => setView("library")}>Complete Learning Library</button>
      <button type="button" className={view === "method" ? styles.active : ""} onClick={() => setView("method")}>The 24 Blocks Method</button>
      <button type="button" className={view === "guide" ? styles.active : ""} onClick={() => setView("guide")}>Guidance for this Block</button>
    </nav>

    {view === "guide" ? <section className={styles.guidance}>
      <div className={styles.sectionIntro}><span>Recommended here</span><h2>Learn what helps at Block {block.number}.{mini.number}</h2><p>These modules match the current stage and mini-block movement. Opening one does not change the story; the exercise connects it to the work when you are ready.</p></div>
      <div className={styles.recommendedGrid}>{recommendedIds.map((id) => {
        const recommendedModule = courseModules.find((item) => item.id === id)!;
        return <ModuleCard module={recommendedModule} complete={completed.has(recommendedModule.id)} recommended onOpen={() => openModule(recommendedModule.id)} onToggle={() => toggleComplete(recommendedModule.id)} key={recommendedModule.id} />;
      })}</div>
      <button className={styles.browseAll} type="button" onClick={() => setView("library")}>Browse all {courseModules.length} complete modules</button>
    </section> : view === "method" ? <section className={styles.library}>
      <div className={styles.sectionIntro}><span>Foundational collection</span><h2>The 24 Blocks Method</h2><p>Ten PlotPickled lessons make the original concepts explicit, searchable and directly applicable to the current 4-act, 12-sequence, 24-block and 96-mini-block architecture.</p></div>
      <main className={styles.moduleGrid}>{twentyFourBlocksLessons.map((module) => <ModuleCard module={module} complete={completed.has(module.id)} recommended={recommendedIds.includes(module.id)} onOpen={() => openModule(module.id)} onToggle={() => toggleComplete(module.id)} key={module.id} />)}</main>
    </section> : <section className={styles.library}>
      <div className={styles.sectionIntro}><span>Complete curriculum</span><h2>{courseModules.length} full learning modules</h2><p>Search lesson text, source concepts, definitions, examples, checklists, common mistakes and active-project exercises—not only module titles.</p></div>
      <section className={styles.filters}>
        <input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search 24 Blocks, structure, dialogue, character, rights, AI…" aria-label="Search screenwriting lessons" />
        <div>{learningPaths.map((item) => <button type="button" className={path === item ? styles.active : ""} onClick={() => setPath(item)} key={item}>{item}</button>)}</div>
      </section>
      <main className={styles.moduleGrid}>{filtered.map((module) => <ModuleCard module={module} complete={completed.has(module.id)} recommended={recommendedIds.includes(module.id)} onOpen={() => openModule(module.id)} onToggle={() => toggleComplete(module.id)} key={module.id} />)}</main>
      {!filtered.length ? <div className={styles.empty}>No module matches that search. Try a craft term such as 24 Blocks, dramatic question, structure, dialogue, world, continuity or privacy.</div> : null}
    </section>}

    {selected ? <ModuleReader module={selected} complete={completed.has(selected.id)} blockNumber={block.number} miniBlockNumber={mini.number} first={selected.id === courseModules[0]?.id} last={selected.id === courseModules.at(-1)?.id} onClose={() => setSelectedId(null)} onPrevious={() => moveModule(-1)} onNext={() => moveModule(1)} onToggle={() => toggleComplete(selected.id)} onApply={() => applyModule(selected)} /> : null}
  </div>;
}

function ModuleCard({ module, complete, recommended, onOpen, onToggle }: { module: CourseModule; complete: boolean; recommended: boolean; onOpen: () => void; onToggle: () => void }) {
  return <article className={`${styles.moduleCard} ${recommended ? styles.recommended : ""}`}>
    <div className={styles.moduleMeta}><span>Module {module.number} · {module.path}</span>{recommended ? <strong>Recommended here</strong> : null}</div>
    {isMethodLesson(module) ? <small>{module.collection} · Source concept: {module.sourceConcept}</small> : null}
    <h3>{module.title}</h3>
    <p>{module.overview}</p>
    <div className={styles.cardStats}><span>{module.duration}</span><span>{module.sections.length} lessons</span><span>Exercise</span></div>
    <div className={styles.cardActions}><button type="button" onClick={onOpen}>Read full module</button><button type="button" className={complete ? styles.complete : ""} onClick={onToggle}>{complete ? "Completed" : "Mark complete"}</button></div>
  </article>;
}

function ModuleReader({ module, complete, blockNumber, miniBlockNumber, first, last, onClose, onPrevious, onNext, onToggle, onApply }: { module: CourseModule; complete: boolean; blockNumber: number; miniBlockNumber: number; first: boolean; last: boolean; onClose: () => void; onPrevious: () => void; onNext: () => void; onToggle: () => void; onApply: () => void }) {
  return <section className={styles.reader} id="learning-module-reader">
    <div className={styles.readerTop}><button type="button" onClick={onClose}>Close module</button><div><button type="button" disabled={first} onClick={onPrevious}>Previous</button><button type="button" disabled={last} onClick={onNext}>Next</button></div></div>
    <header className={styles.readerHeader}><span>Module {module.number} of {courseModules.length} · {module.path} · {module.duration}</span><h2>{module.title}</h2><p>{module.overview}</p>{isMethodLesson(module) ? <small>{module.sourceNote}</small> : null}<button type="button" className={complete ? styles.complete : ""} onClick={onToggle}>{complete ? "Completed — mark incomplete" : "Mark module complete"}</button></header>

    <div className={styles.readerLayout}>
      <main>
        <section className={styles.objectives}><h3>What you will learn</h3><ul>{module.objectives.map((objective) => <li key={objective}>{objective}</li>)}</ul></section>
        {module.sections.map((section) => <section className={styles.lessonSection} key={section.heading}><h3>{section.heading}</h3>{section.paragraphs.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}{section.points?.length ? <ul>{section.points.map((point) => <li key={point}>{point}</li>)}</ul> : null}</section>)}
        {isMethodLesson(module) ? <section className={styles.example}><span>Visual hierarchy</span><h3>{module.sourceConcept}</h3><p>{module.visual.join(" → ")}</p></section> : null}
        {isMethodLesson(module) ? <section className={styles.lessonSection}><h3>How PlotPickle applies this</h3><p>{module.howPlotPickleApplies}</p></section> : null}
        <section className={styles.example}><span>Worked example</span><h3>{module.example.title}</h3><p>{module.example.text}</p></section>
        <section className={styles.exercise}><span>Apply it to Block {blockNumber}.{miniBlockNumber}</span><h3>Active-project exercise</h3><p>{module.exercise}</p><button type="button" onClick={onApply}>Open {module.apply}</button></section>
      </main>
      <aside>
        <section><h3>Plain-language definitions</h3><dl>{module.definitions.map((item) => <div key={item.term}><dt>{item.term}</dt><dd>{item.meaning}</dd></div>)}</dl></section>
        <section><h3>Practical checklist</h3><ul className={styles.checklist}>{module.checklist.map((item) => <li key={item}>{item}</li>)}</ul></section>
        <section className={styles.mistakes}><h3>Common mistakes</h3><ul>{module.mistakes.map((item) => <li key={item}>{item}</li>)}</ul></section>
      </aside>
    </div>
  </section>;
}
