"use client";

import { KeyboardEvent, useMemo, useState } from "react";
import type {
  PlotPickleProject,
  ScreenplayDocument,
  ScreenplayDraftElement,
  ScreenplayDraftElementType,
} from "@/lib/project";
import {
  createDraftElement,
  draftFromScreenplay,
  estimatedScreenplayPages,
  nextElementType,
  screenplayToFinalDraft,
  screenplayToFountain,
  syncDraft,
} from "@/lib/screenplay-draft";
import ScriptViewer from "./script-viewer";
import styles from "./script-workspace.module.css";

type Props = {
  project: PlotPickleProject;
  onChange: (screenplay: ScreenplayDocument) => void;
  onImport: (screenplay: ScreenplayDocument) => boolean;
  onOpenBlock: (blockNumber: number) => void;
};

type ViewMode = "write" | "read";
type AiResponse = { ok?: boolean; text?: string; message?: string };

const elementLabels: Record<ScreenplayDraftElementType, string> = {
  "scene-heading": "Scene heading",
  action: "Action",
  character: "Character",
  parenthetical: "Parenthetical",
  dialogue: "Dialogue",
  transition: "Transition",
};

const elementOrder = Object.keys(elementLabels) as ScreenplayDraftElementType[];

function download(name: string, contents: string, type: string) {
  const url = URL.createObjectURL(new Blob([contents], { type }));
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function slug(value: string) {
  return value.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "screenplay";
}

function allMiniBlocks(project: PlotPickleProject, blockNumber: number) {
  return project.blocks[blockNumber - 1].scenes.flatMap((scene) => scene.miniBlocks);
}

export default function ScriptWorkspace({ project, onChange, onImport, onOpenBlock }: Props) {
  const [mode, setMode] = useState<ViewMode>(project.screenplay.sourceText ? "read" : "write");
  const [blockNumber, setBlockNumber] = useState(1);
  const [miniBlockNumber, setMiniBlockNumber] = useState(1);
  const [selectedId, setSelectedId] = useState("");
  const [aiDirection, setAiDirection] = useState("");
  const [aiSuggestion, setAiSuggestion] = useState("");
  const [aiState, setAiState] = useState<"idle" | "working" | "error">("idle");

  const elements = project.screenplay.draftElements;
  const block = project.blocks[blockNumber - 1];
  const minis = allMiniBlocks(project, blockNumber);
  const mini = minis[miniBlockNumber - 1];
  const selected = elements.find((item) => item.id === selectedId);
  const pages = estimatedScreenplayPages(elements);
  const sceneCount = useMemo(() => new Set(elements.map((item) => item.sceneNumber)).size, [elements]);

  function save(next: ScreenplayDraftElement[]) {
    onChange(syncDraft(project.screenplay, next));
  }

  function makeEditable() {
    const draft = draftFromScreenplay(project.screenplay);
    save(draft);
    setSelectedId(draft[0]?.id ?? "");
  }

  function addElement(type: ScreenplayDraftElementType, text = "") {
    const lastScene = elements.at(-1)?.sceneNumber ?? 0;
    const sceneNumber = type === "scene-heading" ? lastScene + 1 : Math.max(1, lastScene);
    const next = createDraftElement(type, blockNumber, miniBlockNumber, sceneNumber, text);
    const insertionIndex = elements.findLastIndex((item) =>
      item.blockNumber < blockNumber || (item.blockNumber === blockNumber && item.miniBlockNumber <= miniBlockNumber),
    );
    const draft = [...elements];
    draft.splice(insertionIndex + 1, 0, next);
    save(draft);
    setSelectedId(next.id);
    window.setTimeout(() => document.getElementById(`draft-${next.id}`)?.focus(), 0);
  }

  function updateElement(id: string, patch: Partial<ScreenplayDraftElement>) {
    save(elements.map((item) => item.id === id ? { ...item, ...patch, updatedAt: new Date().toISOString() } : item));
  }

  function removeElement(id: string) {
    const index = elements.findIndex((item) => item.id === id);
    save(elements.filter((item) => item.id !== id));
    setSelectedId(elements[Math.max(0, index - 1)]?.id ?? "");
  }

  function moveElement(id: string, direction: -1 | 1) {
    const index = elements.findIndex((item) => item.id === id);
    const target = index + direction;
    if (index < 0 || target < 0 || target >= elements.length) return;
    const next = [...elements];
    [next[index], next[target]] = [next[target], next[index]];
    save(next);
  }

  function handleKey(event: KeyboardEvent<HTMLTextAreaElement>, element: ScreenplayDraftElement) {
    if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
      event.preventDefault();
      addElement(nextElementType(element.type));
    }
  }

  async function askAi() {
    if (!aiDirection.trim() || aiState === "working") return;
    setAiState("working");
    setAiSuggestion("");
    try {
      const response = await fetch("/api/local-ai/generate/text", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          instructions: "You are assisting a screenwriter. Return only polished screenplay-ready material, without Markdown, commentary, or claims that the writer did not provide.",
          prompt: [
            `Project: ${project.metadata.title} (${project.metadata.genre}; ${project.metadata.tone})`,
            `Block ${block.number}: ${block.title}. Purpose: ${block.purpose}. Goal: ${block.goal}. Conflict: ${block.conflict}.`,
            `Mini-block ${block.number}.${miniBlockNumber} ${mini.label}. Function: ${mini.function}. Objective: ${mini.objective}. Resistance: ${mini.resistance}. Turn: ${mini.turn}.`,
            `Characters: ${project.characters.map((character) => `${character.name} — ${character.role}; want: ${character.want}; voice: ${character.voice}`).join(" | ")}`,
            `Writer request: ${aiDirection.trim()}`,
          ].join("\n"),
        }),
      });
      const result = await response.json() as AiResponse;
      if (!response.ok || !result.text) throw new Error(result.message || "AI returned no suggestion.");
      setAiSuggestion(result.text);
      setAiState("idle");
    } catch (error) {
      setAiSuggestion(error instanceof Error ? error.message : "AI assistance is unavailable.");
      setAiState("error");
    }
  }

  function applyAi(type: ScreenplayDraftElementType) {
    if (!aiSuggestion || aiState === "error") return;
    addElement(type, aiSuggestion);
    setAiSuggestion("");
    setAiDirection("");
  }

  if (mode === "read") {
    return (
      <div className={styles.workspaceShell}>
        <div className={styles.modeBar}>
          <div><strong>Screenplay</strong><span>Write the draft or study its structure.</span></div>
          <div><button type="button" onClick={() => setMode("write")}>Write</button><button type="button" className={styles.activeMode}>Read & learn</button></div>
        </div>
        <ScriptViewer project={project} onImport={onImport} onOpenBlock={onOpenBlock} />
      </div>
    );
  }

  return (
    <div className={styles.workspaceShell}>
      <div className={styles.modeBar}>
        <div><strong>Screenplay</strong><span>24 Blocks · 96 mini-blocks · standard feature format</span></div>
        <div><button type="button" className={styles.activeMode}>Write</button><button type="button" disabled={!project.screenplay.sourceText} onClick={() => setMode("read")}>Read & learn</button></div>
      </div>

      <header className={styles.writerHeader}>
        <div><p>Feature Screenplay</p><h1>{project.metadata.title}</h1><span>{pages} estimated pages · {sceneCount} scenes · target {project.metadata.targetMinutes} minutes</span></div>
        <div className={styles.exportActions}>
          <button type="button" onClick={() => download(`${slug(project.metadata.title)}.fountain`, screenplayToFountain(project.screenplay), "text/plain")}>Export Fountain</button>
          <button type="button" onClick={() => download(`${slug(project.metadata.title)}.fdx`, screenplayToFinalDraft(project), "application/xml")}>Export Final Draft</button>
          <button type="button" onClick={() => window.print()}>Print / PDF</button>
        </div>
      </header>

      <div className={styles.writerLayout}>
        <aside className={styles.blockRail}>
          <div><span>Story structure</span><strong>24 Blocks / 96 mini-blocks</strong><small>Select a block, then one of its four story movements.</small></div>
          <nav aria-label="Screenplay blocks">{project.blocks.map((item) => {
            const count = elements.filter((element) => element.blockNumber === item.number).length;
            return <button type="button" className={item.number === blockNumber ? styles.activeBlock : ""} key={item.id} onClick={() => { setBlockNumber(item.number); setMiniBlockNumber(1); }}><span>{String(item.number).padStart(2, "0")}</span><strong>{item.title}</strong><small>{count ? `${count} script elements` : "Not written"}</small></button>;
          })}</nav>
        </aside>

        <main className={styles.writerMain}>
          <section className={styles.miniNavigator}>
            <div><span>Act {block.act} · Block {block.number}</span><h2>{block.title}</h2><p>{block.purpose}</p></div>
            <div className={styles.miniGrid}>{minis.map((item) => {
              const count = elements.filter((element) => element.blockNumber === blockNumber && element.miniBlockNumber === item.number).length;
              return <button type="button" className={item.number === miniBlockNumber ? styles.activeMini : ""} key={item.id} onClick={() => setMiniBlockNumber(item.number)}><span>{block.number}.{item.number}</span><strong>{item.label}</strong><small>{item.function}</small><i>{count ? `${count} elements` : "Empty"}</i></button>;
            })}</div>
            <button type="button" className={styles.openPlan} onClick={() => onOpenBlock(blockNumber)}>Open Block {blockNumber} plan</button>
          </section>

          {!elements.length && project.screenplay.sourceText ? (
            <section className={styles.convertCard}><h2>Make this imported screenplay editable</h2><p>PlotPickle will convert the loaded script into editable screenplay elements and retain its estimated 24 Block positions.</p><button type="button" onClick={makeEditable}>Convert to editable draft</button></section>
          ) : null}

          <section className={styles.formatToolbar} aria-label="Add screenplay element">
            <span>Add to Block {blockNumber}.{miniBlockNumber}</span>
            {elementOrder.map((type) => <button type="button" key={type} onClick={() => addElement(type)}>{elementLabels[type]}</button>)}
          </section>

          <section className={styles.scriptPaper} aria-label="Editable screenplay">
            {!elements.length && !project.screenplay.sourceText ? <div className={styles.blankPage}><span>Page 1</span><h2>Begin with the opening image.</h2><p>Start with a scene heading, then action. PlotPickle will keep every page connected to Block 1 and its four mini-blocks.</p><button type="button" onClick={() => addElement("scene-heading", "INT. LOCATION - DAY")}>Write the first scene</button></div> : null}
            {elements.map((element, index) => (
              <article className={`${styles.scriptElement} ${styles[element.type]} ${selectedId === element.id ? styles.selectedElement : ""}`} key={element.id} onClick={() => setSelectedId(element.id)}>
                <div className={styles.elementMeta}>
                  <span>B{element.blockNumber}.{element.miniBlockNumber}</span>
                  <select aria-label="Screenplay element type" value={element.type} onChange={(event) => updateElement(element.id, { type: event.target.value as ScreenplayDraftElementType })}>{elementOrder.map((type) => <option key={type} value={type}>{elementLabels[type]}</option>)}</select>
                  <button type="button" aria-label="Move up" onClick={() => moveElement(element.id, -1)}>↑</button>
                  <button type="button" aria-label="Move down" onClick={() => moveElement(element.id, 1)}>↓</button>
                  <button type="button" aria-label="Delete element" onClick={() => removeElement(element.id)}>×</button>
                </div>
                <textarea
                  id={`draft-${element.id}`}
                  aria-label={`${elementLabels[element.type]} ${index + 1}`}
                  value={element.text}
                  rows={Math.max(1, Math.ceil(element.text.length / (element.type === "dialogue" ? 34 : 62)))}
                  placeholder={elementLabels[element.type]}
                  onChange={(event) => updateElement(element.id, { text: event.target.value })}
                  onKeyDown={(event) => handleKey(event, element)}
                />
              </article>
            ))}
          </section>
          {elements.length ? <p className={styles.keyboardHint}>Ctrl/Command + Enter adds the next screenplay element. Use the format menu to change any line.</p> : null}
        </main>

        <aside className={styles.assistantPanel}>
          <div className={styles.miniBrief}><span>Current mini-block</span><strong>{block.number}.{mini.number} {mini.label}</strong><p>{mini.function}</p><dl><div><dt>Objective</dt><dd>{mini.objective || "Open in the Block plan to answer."}</dd></div><div><dt>Resistance</dt><dd>{mini.resistance || block.conflict || "Not answered yet."}</dd></div><div><dt>Turn</dt><dd>{mini.turn || block.choice || "Not answered yet."}</dd></div><div><dt>Dialogue intention</dt><dd>{mini.dialogueIntention || "Not answered yet."}</dd></div></dl></div>
          <div className={styles.aiCard}>
            <span>Optional AI assistant</span><h2>Ask from this exact story position.</h2><p>PlotPickle sends the current Block, mini-block and character context through the provider connected in Settings.</p>
            <textarea value={aiDirection} onChange={(event) => setAiDirection(event.target.value)} placeholder="For example: Draft a tense exchange where Mara hides what she learned." rows={5} />
            <button type="button" onClick={askAi} disabled={!aiDirection.trim() || aiState === "working"}>{aiState === "working" ? "Generating…" : "Generate suggestion"}</button>
            {aiSuggestion ? <div className={aiState === "error" ? styles.aiError : styles.aiResult}><p>{aiSuggestion}</p>{aiState !== "error" ? <div><button type="button" onClick={() => applyAi("action")}>Insert as action</button><button type="button" onClick={() => applyAi("dialogue")}>Insert as dialogue</button></div> : null}</div> : null}
            <small>Nothing is inserted until you approve it. AI is optional.</small>
          </div>
          {selected ? <div className={styles.assignmentCard}><span>Selected element</span><label>Block<select value={selected.blockNumber} onChange={(event) => updateElement(selected.id, { blockNumber: Number(event.target.value) })}>{project.blocks.map((item) => <option value={item.number} key={item.id}>{item.number} · {item.title}</option>)}</select></label><label>Mini-block<select value={selected.miniBlockNumber} onChange={(event) => updateElement(selected.id, { miniBlockNumber: Number(event.target.value) })}>{allMiniBlocks(project, selected.blockNumber).map((item) => <option value={item.number} key={item.id}>{selected.blockNumber}.{item.number} · {item.label}</option>)}</select></label></div> : null}
        </aside>
      </div>
    </div>
  );
}
