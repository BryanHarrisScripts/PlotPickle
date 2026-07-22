"use client";

import { useEffect, useMemo, useState } from "react";
import type { PlotPickleProject } from "@/lib/project";
import { learningModules, learningPaths, moduleSearchText, type LearningModule } from "./learning-library";
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

type ViewMode = "guide" | "library";

const anatomy = ["Structure", "Dialogue", "Character", "Theme & conflict", "World-building", "Pacing & tone", "Symbolic techniques"];

function miniBlocks(project: PlotPickleProject, blockNumber: number) {
  return project.blocks[blockNumber - 1].scenes.flatMap((scene) => scene.miniBlocks);
}

function recommendations(blockNumber: number, miniBlockNumber: number) {
  const stage = blockNumber <= 4
    ? ["pitch", "concept-to-draft", "character-bible"]
    : blockNumber <= 8
      ? ["world-building", "genres", "story-bible"]
      : blockNumber <= 16
        ? ["structures", "challenges", "formatting"]
        : blockNumber <= 20
          ? ["vomit-draft", "writing-process", "responsible-ai"]
          : ["challenges", "formatting", "industry"];
  const byMovement = miniBlockNumber === 1 ? "concept-to-draft" : miniBlockNumber === 2 ? "character-bible" : miniBlockNumber === 3 ? "challenges" : "writing-process";
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
  const selected = learningModules.find((module) => module.id === selectedId) ?? null;

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
    return learningModules.filter((module) => (path === "All" || module.path === path) && (!needle || moduleSearchText(module).includes(needle)));
  }, [path, query]);

  function applyModule(module: LearningModule) {
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
    const index = learningModules.findIndex((module) => module.id === selected.id);
    const next = learningModules[index + direction];
    if (next) openModule(next.id);
  }

  const progress = Math.round((completed.size / learningModules.length) * 100);

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
      <div><span>Course progress</span><strong>{completed.size} of {learningModules.length} modules complete</strong></div>
      <div className={styles.progressTrack}><i style={{ width: `${progress}%` }} /></div>
      <b>{progress}%</b>
    </section>

    <section className={styles.anatomy}>
      <div><span>Screenplay anatomy</span><strong>Seven lenses run through the complete course</strong></div>
      <ul>{anatomy.map((item, index) => <li key={item}><b>{index + 1}</b>{item}</li>)}</ul>
    </section>

    <nav className={styles.viewTabs} aria-label="Learning Studio views">
      <button type="button" className={view === "library" ? styles.active : ""} onClick={() => setView("library")}>Complete Learning Library</button>
      <button type="button" className={view === "guide" ? styles.active : ""} onClick={() => setView("guide")}>Guidance for this Block</button>
    </nav>

    {view === "guide" ? <section className={styles.guidance}>
      <div className={styles.sectionIntro}><span>Recommended here</span><h2>Learn what helps at Block {block.number}.{mini.number}</h2><p>These modules match the current stage and mini-block movement. Opening one does not change the story; the exercise connects it to the work when you are ready.</p></div>
      <div className={styles.recommendedGrid}>{recommendedIds.map((id) => {
        const recommendedModule = learningModules.find((item) => item.id === id)!;
        return <ModuleCard module={recommendedModule} complete={completed.has(recommendedModule.id)} recommended onOpen={() => openModule(recommendedModule.id)} onToggle={() => toggleComplete(recommendedModule.id)} key={recommendedModule.id} />;
      })}</div>
      <button className={styles.browseAll} type="button" onClick={() => setView("library")}>Browse all 14 complete modules</button>
    </section> : <section className={styles.library}>
      <div className={styles.sectionIntro}><span>Complete curriculum</span><h2>Fourteen full learning modules</h2><p>Search the lesson text, definitions, examples, checklists, common mistakes and exercises—not only the module titles.</p></div>
      <section className={styles.filters}>
        <input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search formatting, genre, character, dialogue, rights, AI…" aria-label="Search screenwriting lessons" />
        <div>{learningPaths.map((item) => <button type="button" className={path === item ? styles.active : ""} onClick={() => setPath(item)} key={item}>{item}</button>)}</div>
      </section>
      <main className={styles.moduleGrid}>{filtered.map((module) => <ModuleCard module={module} complete={completed.has(module.id)} recommended={recommendedIds.includes(module.id)} onOpen={() => openModule(module.id)} onToggle={() => toggleComplete(module.id)} key={module.id} />)}</main>
      {!filtered.length ? <div className={styles.empty}>No module matches that search. Try a craft term such as structure, dialogue, world, pitch, continuity or privacy.</div> : null}
    </section>}

    {selected ? <ModuleReader module={selected} complete={completed.has(selected.id)} blockNumber={block.number} miniBlockNumber={mini.number} first={selected.number === 1} last={selected.number === learningModules.length} onClose={() => setSelectedId(null)} onPrevious={() => moveModule(-1)} onNext={() => moveModule(1)} onToggle={() => toggleComplete(selected.id)} onApply={() => applyModule(selected)} /> : null}
  </div>;
}

function ModuleCard({ module, complete, recommended, onOpen, onToggle }: { module: LearningModule; complete: boolean; recommended: boolean; onOpen: () => void; onToggle: () => void }) {
  return <article className={`${styles.moduleCard} ${recommended ? styles.recommended : ""}`}>
    <div className={styles.moduleMeta}><span>Module {module.number} · {module.path}</span>{recommended ? <strong>Recommended here</strong> : null}</div>
    <h3>{module.title}</h3>
    <p>{module.overview}</p>
    <div className={styles.cardStats}><span>{module.duration}</span><span>{module.sections.length} lessons</span><span>Exercise</span></div>
    <div className={styles.cardActions}><button type="button" onClick={onOpen}>Read full module</button><button type="button" className={complete ? styles.complete : ""} onClick={onToggle}>{complete ? "Completed" : "Mark complete"}</button></div>
  </article>;
}

function ModuleReader({ module, complete, blockNumber, miniBlockNumber, first, last, onClose, onPrevious, onNext, onToggle, onApply }: { module: LearningModule; complete: boolean; blockNumber: number; miniBlockNumber: number; first: boolean; last: boolean; onClose: () => void; onPrevious: () => void; onNext: () => void; onToggle: () => void; onApply: () => void }) {
  return <section className={styles.reader} id="learning-module-reader">
    <div className={styles.readerTop}><button type="button" onClick={onClose}>Close module</button><div><button type="button" disabled={first} onClick={onPrevious}>Previous</button><button type="button" disabled={last} onClick={onNext}>Next</button></div></div>
    <header className={styles.readerHeader}><span>Module {module.number} of {learningModules.length} · {module.path} · {module.duration}</span><h2>{module.title}</h2><p>{module.overview}</p><button type="button" className={complete ? styles.complete : ""} onClick={onToggle}>{complete ? "Completed — mark incomplete" : "Mark module complete"}</button></header>

    <div className={styles.readerLayout}>
      <main>
        <section className={styles.objectives}><h3>What you will learn</h3><ul>{module.objectives.map((objective) => <li key={objective}>{objective}</li>)}</ul></section>
        {module.sections.map((section) => <section className={styles.lessonSection} key={section.heading}><h3>{section.heading}</h3>{section.paragraphs.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}{section.points?.length ? <ul>{section.points.map((point) => <li key={point}>{point}</li>)}</ul> : null}</section>)}
        <section className={styles.example}><span>Worked example</span><h3>{module.example.title}</h3><p>{module.example.text}</p></section>
        <section className={styles.exercise}><span>Apply it to Block {blockNumber}.{miniBlockNumber}</span><h3>Practical exercise</h3><p>{module.exercise}</p><button type="button" onClick={onApply}>Open {module.apply}</button></section>
      </main>
      <aside>
        <section><h3>Plain-language definitions</h3><dl>{module.definitions.map((item) => <div key={item.term}><dt>{item.term}</dt><dd>{item.meaning}</dd></div>)}</dl></section>
        <section><h3>Practical checklist</h3><ul className={styles.checklist}>{module.checklist.map((item) => <li key={item}>{item}</li>)}</ul></section>
        <section className={styles.mistakes}><h3>Common mistakes</h3><ul>{module.mistakes.map((item) => <li key={item}>{item}</li>)}</ul></section>
      </aside>
    </div>
  </section>;
}
