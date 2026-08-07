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
} from "@/lib/screenplay-draft";
import { assignDraftElementToScene, buildGlobalSceneIndex } from "@/lib/scene-management";
import { productionPageLabel, productionSceneLabel, reconcileProductionDraft } from "@/lib/production-draft";
import TreatmentEditor from "./treatment-editor";
import ProductionDraftPanel from "./production-draft-panel";
import { CraftDiagnosticSummary } from "./craft-diagnostics";
import styles from "./script-workspace.module.css";

type Props = {
  project: PlotPickleProject;
  mode: WriterViewMode;
  initialBlockNumber?: number;
  initialSceneId?: string;
  onModeChange: (mode: WriterViewMode) => void;
  onChange: (screenplay: ScreenplayDocument) => void;
  onProjectChange: (project: PlotPickleProject) => void;
  onOpenBlock: (blockNumber: number) => void;
};

export type WriterViewMode = "treatment" | "screenplay";
type AiResponse = { ok?: boolean; text?: string; message?: string };

const elementLabels: Record<ScreenplayDraftElementType, string> = {
  "scene-heading": "Scene heading",
  action: "Action",
  character: "Character",
  parenthetical: "Parenthetical",
  dialogue: "Dialogue",
  transition: "Transition",
  section: "Section",
  synopsis: "Synopsis",
  shot: "Shot",
  lyrics: "Lyrics",
  "dual-dialogue": "Dual dialogue",
  centered: "Centered text",
  "page-break": "Page break",
  "title-page": "Title page",
  note: "Note",
  boneyard: "Boneyard",
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

export default function ScriptWorkspace({ project, mode, initialBlockNumber, initialSceneId, onModeChange, onChange, onProjectChange, onOpenBlock }: Props) {
  const initialSceneEntry = initialSceneId
    ? buildGlobalSceneIndex(project.blocks).find((entry) => entry.sceneId === initialSceneId)
    : undefined;
  const initialElement = initialSceneId
    ? project.screenplay.draftElements.find((element) => element.sceneId === initialSceneId)
    : undefined;
  const [blockNumber, setBlockNumber] = useState(initialSceneEntry?.blockNumber ?? initialBlockNumber ?? 1);
  const [miniBlockNumber, setMiniBlockNumber] = useState(initialSceneEntry?.miniBlockNumbers[0] ?? 1);
  const [selectedId, setSelectedId] = useState(initialElement?.id ?? "");
  const [aiDirection, setAiDirection] = useState("");
  const [aiSuggestion, setAiSuggestion] = useState("");
  const [aiState, setAiState] = useState<"idle" | "working" | "error">("idle");

  const elements = project.screenplay.draftElements;
  const block = project.blocks[blockNumber - 1];
  const minis = allMiniBlocks(project, blockNumber);
  const mini = minis[miniBlockNumber - 1];
  const selected = elements.find((item) => item.id === selectedId);
  const pages = estimatedScreenplayPages(elements);
  const sceneIndex = useMemo(() => buildGlobalSceneIndex(project.blocks), [project.blocks]);
  const currentSceneEntry = sceneIndex.find((entry) => (
    entry.blockNumber === blockNumber && entry.miniBlockNumbers.includes(miniBlockNumber)
  )) ?? sceneIndex.find((entry) => entry.blockNumber === blockNumber);

  const scriptedSceneCount = useMemo(() => new Set(elements.map((item) => item.sceneId || `number-${item.sceneNumber}`)).size, [elements]);

  function save(next: ScreenplayDraftElement[]) {
    onChange(reconcileProductionDraft(project.screenplay, next));
  }

  function makeEditable() {
    const draft = draftFromScreenplay(project.screenplay);
    save(draft);
    setSelectedId(draft[0]?.id ?? "");
  }

  function addElement(type: ScreenplayDraftElementType, text = "") {
    const fallbackScene = elements.at(-1)?.sceneNumber ?? 1;
    const sceneNumber = currentSceneEntry?.globalNumber ?? Math.max(1, fallbackScene);
    const next = createDraftElement(
      type,
      blockNumber,
      miniBlockNumber,
      sceneNumber,
      text,
      currentSceneEntry?.sceneId ?? "",
    );
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
      if (!response.ok || !result.text) throw new Error("Writing assistance is unavailable. Open Settings to check the writing setup.");
      setAiSuggestion(result.text);
      setAiState("idle");
    } catch {
      setAiSuggestion("Writing assistance is unavailable. Open Settings to check the writing setup.");
      setAiState("error");
    }
  }

  function applyAi(type: ScreenplayDraftElementType) {
    if (!aiSuggestion || aiState === "error") return;
    addElement(type, aiSuggestion);
    setAiSuggestion("");
    setAiDirection("");
  }

  function sendTreatmentToScreenplay(text: string) {
    if (!text.trim()) return;
    addElement("action", text.trim());
    onModeChange("screenplay");
  }

  function jumpToPosition(nextBlockNumber: number, nextMiniBlockNumber?: number) {
    const target = elements.find((element) =>
      element.blockNumber === nextBlockNumber
      && (nextMiniBlockNumber === undefined || element.miniBlockNumber === nextMiniBlockNumber),
    );
    setBlockNumber(nextBlockNumber);
    setMiniBlockNumber(nextMiniBlockNumber ?? target?.miniBlockNumber ?? 1);
    if (!target) return;
    setSelectedId(target.id);
    window.setTimeout(() => {
      document.getElementById(`script-position-${target.id}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 0);
  }

  if (mode === "treatment") {
    return (
      <div className={styles.workspaceShell}>
        <div className={styles.modeBar}>
          <div><strong>Writer</strong><span>Develop and format the story in one connected flow.</span></div>
          <div><button type="button" className={styles.activeMode}>Treatment</button><button type="button" onClick={() => onModeChange("screenplay")}>Screenplay</button></div>
        </div>
        <TreatmentEditor
          project={project}
          blockNumber={blockNumber}
          miniBlockNumber={miniBlockNumber}
          onBlockChange={setBlockNumber}
          onMiniBlockChange={setMiniBlockNumber}
          onProjectChange={onProjectChange}
          onOpenBlock={onOpenBlock}
          onSendToScreenplay={sendTreatmentToScreenplay}
        />
      </div>
    );
  }

  return (
    <div className={styles.workspaceShell}>
      <div className={styles.modeBar}>
        <div><strong>Writer</strong><span>24 Blocks · 96 mini-blocks · standard feature format</span></div>
        <div><button type="button" onClick={() => onModeChange("treatment")}>Treatment</button><button type="button" className={styles.activeMode}>Screenplay</button></div>
      </div>

      <header className={styles.writerHeader}>
        <div><p>Feature Screenplay · full scrollable draft</p><h1>{project.metadata.title}</h1><span>{pages} estimated pages · {sceneIndex.length} planned scenes · {scriptedSceneCount} scenes with draft material · target {project.metadata.targetMinutes} minutes</span></div>
        <div className={styles.exportActions}>
          <button type="button" onClick={() => download(`${slug(project.metadata.title)}.fountain`, screenplayToFountain(project.screenplay), "text/plain")}>Export Fountain</button>
          <button type="button" onClick={() => download(`${slug(project.metadata.title)}.fdx`, screenplayToFinalDraft(project), "application/xml")}>Export Final Draft</button>
          <button type="button" onClick={() => window.print()}>Print / PDF</button>
        </div>
      </header>
      <ProductionDraftPanel project={project} selected={selected} onProjectChange={onProjectChange} />

      <div className={styles.writerLayout}>
        <aside className={styles.blockRail}>
          <div><span>Story structure</span><strong>24 Blocks / 96 mini-blocks</strong><small>Select a block, then one of its four story movements.</small></div>
          <nav aria-label="Screenplay blocks">{project.blocks.map((item) => {
            const count = elements.filter((element) => element.blockNumber === item.number).length;
            return <button type="button" className={item.number === blockNumber ? styles.activeBlock : ""} key={item.id} onClick={() => jumpToPosition(item.number)}><span>{String(item.number).padStart(2, "0")}</span><strong>{item.title}</strong><small>{count ? `${count} script elements` : "Not written"}</small></button>;
          })}</nav>
        </aside>

        <main className={styles.writerMain}>
          <section className={styles.miniNavigator}>
            <div><span>Act {block.act} · Block {block.number}</span><h2>{block.title}</h2><p>{block.purpose}</p></div>
            <div className={styles.miniGrid}>{minis.map((item) => {
              const count = elements.filter((element) => element.blockNumber === blockNumber && element.miniBlockNumber === item.number).length;
              return <button type="button" className={item.number === miniBlockNumber ? styles.activeMini : ""} key={item.id} onClick={() => jumpToPosition(blockNumber, item.number)}><span>{block.number}.{item.number}</span><strong>{item.label}</strong><small>{item.function}</small><i>{count ? `${count} elements` : "Empty"}</i></button>;
            })}</div>
            <button type="button" className={styles.openPlan} onClick={() => onOpenBlock(blockNumber)}>Open Block {blockNumber} plan</button>
          </section>

          {!elements.length && project.screenplay.sourceText ? (
            <section className={styles.convertCard}><h2>Make this imported screenplay editable</h2><p>PlotPickle will convert the loaded script into editable screenplay elements and retain its estimated 24 Block positions.</p><button type="button" onClick={makeEditable}>Convert to editable draft</button></section>
          ) : null}

          <section className={styles.formatToolbar} aria-label="Add screenplay element">
            <span>Add to Scene {currentSceneEntry?.globalNumber ?? "—"} · Block {blockNumber}.{miniBlockNumber}</span>
            {elementOrder.map((type) => <button type="button" key={type} onClick={() => addElement(type)}>{elementLabels[type]}</button>)}
          </section>

          <section className={styles.scriptPaper} aria-label="Editable screenplay">
            {!elements.length && !project.screenplay.sourceText ? <div className={styles.blankPage}><span>Page 1</span><h2>Begin with the opening image.</h2><p>Start with a scene heading, then action. PlotPickle will keep every page connected to Block 1 and its four mini-blocks.</p><button type="button" onClick={() => addElement("scene-heading", "INT. LOCATION - DAY")}>Write the first scene</button></div> : null}
            {elements.map((element, index) => (
              <article id={`script-position-${element.id}`} className={`${styles.scriptElement} ${styles[element.type]} ${selectedId === element.id ? styles.selectedElement : ""}`} key={element.id} onClick={() => setSelectedId(element.id)}>
                <div className={styles.elementMeta}>
                  <span>S{element.sceneNumber} · B{element.blockNumber}.{element.miniBlockNumber}</span>
                  {project.screenplay.productionDraft.mode === "production"
                    ? <span>Production S{productionSceneLabel(project.screenplay, element)}{project.screenplay.productionDraft.paginationLocked ? ` · P${productionPageLabel(project.screenplay, element.id) || "—"}` : ""}</span>
                    : null}
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
          <CraftDiagnosticSummary project={project} focus={{ blockNumber, sceneId: currentSceneEntry?.sceneId }} />
          <div className={styles.aiCard}>
            <span>Optional writing assistant</span><h2>Develop this exact story moment.</h2><p>PlotPickle already has the current Block, mini-block and character context. Describe what you want to write next.</p>
            <textarea value={aiDirection} onChange={(event) => setAiDirection(event.target.value)} placeholder="For example: Draft a tense exchange where Mara hides what she learned." rows={5} />
            <button type="button" onClick={askAi} disabled={!aiDirection.trim() || aiState === "working"}>{aiState === "working" ? "Writing…" : "Suggest a version"}</button>
            {aiSuggestion ? <div className={aiState === "error" ? styles.aiError : styles.aiResult}><p>{aiSuggestion}</p>{aiState !== "error" ? <div><button type="button" onClick={() => applyAi("action")}>Insert as action</button><button type="button" onClick={() => applyAi("dialogue")}>Insert as dialogue</button></div> : <button type="button" onClick={() => window.location.assign("/ai-routing")}>Open Settings</button>}</div> : null}
            <small>Nothing is added to the screenplay until you choose to insert it. Writing assistance is optional.</small>
          </div>
          {selected ? <div className={styles.assignmentCard}>
            <span>Selected element</span>
            <label>Scene
              <select
                value={selected.sceneId || sceneIndex.find((entry) => entry.globalNumber === selected.sceneNumber)?.sceneId || ""}
                onChange={(event) => {
                  const entry = sceneIndex.find((item) => item.sceneId === event.target.value);
                  if (entry) updateElement(selected.id, assignDraftElementToScene(selected, entry));
                }}
              >
                {sceneIndex.map((entry) => <option value={entry.sceneId} key={entry.sceneId}>Scene {entry.globalNumber} · Block {entry.blockNumber}.{entry.localNumber} · {entry.title}</option>)}
              </select>
            </label>
            <label>Block
              <select value={selected.blockNumber} onChange={(event) => {
                const entry = sceneIndex.find((item) => item.blockNumber === Number(event.target.value));
                if (entry) updateElement(selected.id, assignDraftElementToScene(selected, entry));
              }}>{project.blocks.map((item) => <option value={item.number} key={item.id}>{item.number} · {item.title}</option>)}</select>
            </label>
            <label>Mini-block
              <select value={selected.miniBlockNumber} onChange={(event) => {
                const miniNumber = Number(event.target.value);
                const entry = sceneIndex.find((item) => item.blockNumber === selected.blockNumber && item.miniBlockNumbers.includes(miniNumber));
                if (entry) updateElement(selected.id, { ...assignDraftElementToScene(selected, entry), miniBlockNumber: miniNumber });
              }}>{allMiniBlocks(project, selected.blockNumber).map((item) => <option value={item.number} key={item.id}>{selected.blockNumber}.{item.number} · {item.label}</option>)}</select>
            </label>
            <label>Revision colour
              <select value={selected.revisionColour} onChange={(event) => updateElement(selected.id, { revisionColour: event.target.value as ScreenplayDraftElement["revisionColour"] })}>{["none", "blue", "pink", "yellow", "green", "goldenrod", "buff", "salmon", "cherry", "tan", "gray"].map((colour) => <option key={colour}>{colour}</option>)}</select>
            </label>
            <label><input type="checkbox" checked={selected.locked} onChange={(event) => updateElement(selected.id, { locked: event.target.checked })} /> Lock element</label>
            <label><input type="checkbox" checked={selected.omitted} onChange={(event) => updateElement(selected.id, { omitted: event.target.checked })} /> Omit without deleting</label>
            {project.storyThreads.length ? <fieldset><legend>Story Threads</legend>{project.storyThreads.map((thread) => <label key={thread.id}><input type="checkbox" checked={selected.threadIds.includes(thread.id)} onChange={() => updateElement(selected.id, { threadIds: selected.threadIds.includes(thread.id) ? selected.threadIds.filter((id) => id !== thread.id) : [...selected.threadIds, thread.id] })} /> {thread.name}</label>)}</fieldset> : null}
          </div> : null}
        </aside>
      </div>
    </div>
  );
}
