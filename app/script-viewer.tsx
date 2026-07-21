"use client";

import { ChangeEvent, useMemo, useRef, useState } from "react";
import type { PlotPickleProject, ScreenplayDocument } from "@/lib/project";
import {
  parseScreenplay,
  screenplayFormatForFile,
  screenplayLegend,
  screenplayStats,
  type ScreenplayElement,
} from "@/lib/screenplay";
import styles from "./script-viewer.module.css";

type ScriptViewerProps = {
  project: PlotPickleProject;
  onImport: (screenplay: ScreenplayDocument) => boolean;
  onOpenBlock: (blockNumber: number) => void;
};

function guideAnswers(project: PlotPickleProject, element?: ScreenplayElement) {
  const block = project.blocks[(element?.blockNumber ?? 1) - 1] ?? project.blocks[0];
  return [
    { question: "What is this part of the story doing?", answer: block.purpose || block.summary },
    { question: "What does the character want here?", answer: block.goal },
    { question: "Where does the pressure enter?", answer: block.conflict },
    { question: "What choice changes the direction?", answer: block.choice || block.action },
    { question: "What consequence hands us forward?", answer: block.consequence || block.payoff },
    { question: "What does the audience expect—and how does The Pickle turn?", answer: [block.audienceExpectation, block.pickleTurn].filter(Boolean).join(" ") },
    { question: "Which deeper wound or belief is being tested?", answer: project.development.ghost.presentPattern || project.development.ghost.centralWound },
  ];
}

function EmptyViewer({ onChoose }: { onChoose: () => void }) {
  return (
    <section className={styles.empty}>
      <div className={styles.emptyMark} aria-hidden="true">SP</div>
      <p>Full Script Viewer</p>
      <h1>Read the screenplay and see how the structure works beneath it.</h1>
      <span>Load a plain-text, Fountain, or Final Draft FDX screenplay. The file stays inside this local PlotPickle project.</span>
      <button type="button" onClick={onChoose}>Load a screenplay</button>
      <small>Supported: .txt, .fountain, .spmd, and .fdx</small>
    </section>
  );
}

export default function ScriptViewer({ project, onImport, onOpenBlock }: ScriptViewerProps) {
  const fileInput = useRef<HTMLInputElement>(null);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [search, setSearch] = useState("");
  const [showGuide, setShowGuide] = useState(true);
  const [showColours, setShowColours] = useState(true);
  const [fontSize, setFontSize] = useState<"small" | "regular" | "large">("regular");
  const elements = useMemo(() => parseScreenplay(project.screenplay), [project.screenplay]);
  const stats = useMemo(() => screenplayStats(elements), [elements]);
  const selected = elements[Math.min(selectedIndex, Math.max(elements.length - 1, 0))];
  const block = project.blocks[(selected?.blockNumber ?? 1) - 1] ?? project.blocks[0];
  const answers = guideAnswers(project, selected);
  const scenes = useMemo(() => elements.filter((item) => item.type === "scene-heading"), [elements]);
  const query = search.trim().toLowerCase();
  const visible = elements.map((element, index) => ({ element, index })).filter(({ element }) => !query || element.text.toLowerCase().includes(query));

  async function loadScript(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    const sourceText = await file.text();
    const next: ScreenplayDocument = {
      fileName: file.name,
      format: screenplayFormatForFile(file.name),
      sourceText,
      importedAt: new Date().toISOString(),
      analysisStatus: "none",
      analyzedAt: "",
      suggestedFields: [],
    };
    if (!onImport(next)) return;
    setSelectedIndex(0);
    setSearch("");
  }

  function selectElement(index: number) {
    setSelectedIndex(index);
  }

  function jumpToScene(element: ScreenplayElement) {
    const index = elements.findIndex((item) => item.id === element.id);
    setSelectedIndex(Math.max(0, index));
    window.setTimeout(() => document.getElementById(element.id)?.scrollIntoView({ behavior: "smooth", block: "center" }), 0);
  }

  return (
    <div className={styles.page}>
      <input ref={fileInput} className={styles.hiddenInput} type="file" accept=".txt,.fountain,.spmd,.fdx,text/plain,text/xml,application/xml" onChange={loadScript} />
      {!elements.length ? <EmptyViewer onChoose={() => fileInput.current?.click()} /> : (
        <>
          <header className={styles.header}>
            <div>
              <p>Full Script Viewer</p>
              <h1>{project.metadata.title}</h1>
              <span>{project.screenplay.fileName} · Read-only learning view</span>
              {project.screenplay.analysisStatus === "suggested" ? <strong className={styles.suggestionStatus}>Structure suggested from script · review before confirming</strong> : null}
              {project.screenplay.analysisStatus === "reviewed" ? <strong className={styles.reviewedStatus}>Imported structure reviewed</strong> : null}
            </div>
            <div className={styles.headerActions}>
              <button type="button" className={styles.secondaryButton} onClick={() => fileInput.current?.click()}>Replace script</button>
              <button type="button" className={styles.primaryButton} onClick={() => onOpenBlock(selected?.blockNumber ?? 1)}>Open Block {selected?.blockNumber ?? 1}</button>
            </div>
          </header>

          <section className={styles.toolbar} aria-label="Script viewer controls">
            <div className={styles.stats}>
              <span><b>{stats.pages}</b> estimated pages</span>
              <span><b>{stats.scenes}</b> scenes</span>
              <span><b>{stats.elements}</b> passages</span>
            </div>
            <label className={styles.search}><span>Find in script</span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Character, place, phrase…" /></label>
            <div className={styles.toggles}>
              <button type="button" className={showColours ? styles.activeControl : ""} onClick={() => setShowColours((value) => !value)}>Colours</button>
              <button type="button" className={showGuide ? styles.activeControl : ""} onClick={() => setShowGuide((value) => !value)}>Guided reading</button>
              <select aria-label="Script text size" value={fontSize} onChange={(event) => setFontSize(event.target.value as typeof fontSize)}><option value="small">Small text</option><option value="regular">Regular text</option><option value="large">Large text</option></select>
            </div>
          </section>

          {showColours ? <div className={styles.legend} aria-label="Screenplay colour legend">{screenplayLegend.map((item) => <span className={styles[item.type]} key={item.type}><i />{item.label}</span>)}</div> : null}

          <div className={showGuide ? styles.layout : styles.layoutWithoutGuide}>
            <aside className={styles.sceneRail}>
              <p>Scene navigator</p>
              <nav aria-label="Screenplay scenes">
                {scenes.map((scene) => <button type="button" className={scene.scene === selected?.scene ? styles.activeScene : ""} key={scene.id} onClick={() => jumpToScene(scene)}><span>{String(scene.scene).padStart(2, "0")}</span><strong>{scene.text}</strong><small>Page {scene.page} · Block {scene.blockNumber}</small></button>)}
              </nav>
            </aside>

            <main className={`${styles.scriptPaper} ${styles[fontSize]} ${showColours ? styles.coloured : styles.plain}`} aria-label="Full screenplay">
              {visible.length ? visible.map(({ element, index }) => (
                <button
                  type="button"
                  id={element.id}
                  className={`${styles.scriptLine} ${styles[element.type]} ${index === selectedIndex ? styles.selectedLine : ""}`}
                  key={element.id}
                  onClick={() => selectElement(index)}
                >
                  <span className={styles.lineMeta}>P{element.page} · S{element.scene || "—"} · B{element.blockNumber}</span>
                  <span className={styles.lineText}>{element.text}</span>
                </button>
              )) : <div className={styles.noResults}>No screenplay passages match “{search}”.</div>}
            </main>

            {showGuide ? (
              <aside className={styles.guide}>
                <div className={`${styles.blockBadge} ${styles[`act${block.act}`]}`}><span>Estimated position</span><strong>Act {block.act} · Block {block.number}</strong><small>{block.title}</small></div>
                <p className={styles.estimateNote}>{project.screenplay.analysisStatus === "suggested" ? "This block and its guided answers were suggested from script position and extracted passages. Confirm or revise them in Story Planner." : "The initial block link is estimated from script position. Use it as a reading guide until the screenplay is manually reconciled with the 24 Blocks."}</p>
                <div className={styles.selectedPassage}><span>Selected passage</span><strong>{selected ? screenplayLegend.find((item) => item.type === selected.type)?.label : "Script"}</strong><p>{selected?.text}</p></div>
                <h2>Questions this passage helps answer</h2>
                <dl>{answers.map((item) => <div key={item.question}><dt>{item.question}</dt><dd className={item.answer ? "" : styles.unanswered}>{item.answer || "Not answered yet—keep this question open while you read."}</dd></div>)}</dl>
                <button type="button" className={styles.openBlockButton} onClick={() => onOpenBlock(block.number)}>Open the full Block {block.number} plan</button>
              </aside>
            ) : null}
          </div>
        </>
      )}
    </div>
  );
}
