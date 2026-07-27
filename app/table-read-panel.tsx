"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { PlotPickleProject } from "@/lib/project";
import {
  actorSides,
  applyTableReadPronunciations,
  createTableReadSession,
  estimatedTableReadSeconds,
  finishTableReadSession,
  formatTableReadDuration,
  itemsForTableReadScope,
  recordTableReadNote,
  tableReadSceneOptions,
  tableReadSessionReport,
  tableReadSessions,
  updateTableReadSession,
  type TableReadScope,
} from "@/lib/table-read";
import styles from "./table-read-panel.module.css";

type Props = {
  project: PlotPickleProject;
  onProjectChange: (project: PlotPickleProject) => void;
  initialTargetId?: string;
};

function scopeLabel(scope: TableReadScope) {
  if (scope === "screenplay") return "Full screenplay";
  return scope === "sequence" ? "Sequence" : "One scene";
}

export default function TableReadPanel({ project, onProjectChange, initialTargetId = "" }: Props) {
  const sessions = useMemo(() => tableReadSessions(project), [project]);
  const scenes = useMemo(() => tableReadSceneOptions(project), [project]);
  const initialSceneId = project.screenplay.draftElements.find((element) => element.id === initialTargetId)?.sceneId
    || scenes.find((scene) => scene.id === initialTargetId)?.id
    || scenes[0]?.id
    || "";
  const [selectedId, setSelectedId] = useState(sessions[0]?.session.id ?? "");
  const [title, setTitle] = useState("");
  const [scope, setScope] = useState<TableReadScope>("scene");
  const [startSceneId, setStartSceneId] = useState(initialSceneId);
  const [playing, setPlaying] = useState(false);
  const [paused, setPaused] = useState(false);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [noteAuthor, setNoteAuthor] = useState("Reader");
  const [noteBody, setNoteBody] = useState("");
  const [sideCharacterId, setSideCharacterId] = useState(project.characters[0]?.id ?? "");
  const [pronunciationPhrase, setPronunciationPhrase] = useState("");
  const [pronunciationReplacement, setPronunciationReplacement] = useState("");
  const startedAtRef = useRef(0);
  const playingRef = useRef(false);
  const pausedRef = useRef(false);
  const completedIdsRef = useRef<Set<string>>(new Set());

  const selected = sessions.find(({ session }) => session.id === selectedId)?.session ?? sessions[0]?.session;
  const items = useMemo(
    () => selected ? itemsForTableReadScope(project, selected.scope, selected.startSceneId) : [],
    [project, selected],
  );
  const currentIndex = Math.max(0, items.findIndex((item) => item.id === selected?.currentElementId));
  const current = items[currentIndex] ?? items[0];
  const report = selected ? tableReadSessionReport(project, selected) : null;
  const sides = useMemo(() => actorSides(project, sideCharacterId), [project, sideCharacterId]);

  useEffect(() => {
    if (!globalThis.speechSynthesis) return;
    const load = () => setVoices(globalThis.speechSynthesis.getVoices());
    load();
    globalThis.speechSynthesis.addEventListener("voiceschanged", load);
    return () => {
      globalThis.speechSynthesis.removeEventListener("voiceschanged", load);
      globalThis.speechSynthesis.cancel();
    };
  }, []);

  const patch = useCallback((patchValue: Record<string, unknown>) => {
    if (!selected) return;
    onProjectChange(updateTableReadSession(project, selected.id, (session) => ({ ...session, ...patchValue })));
  }, [onProjectChange, project, selected]);

  const speakAt = useCallback(function speakAt(index: number) {
    if (!selected || !globalThis.speechSynthesis || index < 0 || index >= items.length) {
      playingRef.current = false;
      setPlaying(false);
      return;
    }
    const item = items[index];
    patch({ currentElementId: item.id });
    const utterance = new SpeechSynthesisUtterance(applyTableReadPronunciations(item.text, selected.pronunciations));
    const assignment = selected.voiceAssignments.find((candidate) => candidate.characterId === item.characterId);
    const voiceURI = item.narrator ? selected.narratorVoiceURI : assignment?.voiceURI;
    utterance.voice = voices.find((voice) => voice.voiceURI === voiceURI) ?? null;
    utterance.rate = item.narrator ? selected.narratorRate : assignment?.rate ?? 1;
    utterance.pitch = item.narrator ? selected.narratorPitch : assignment?.pitch ?? 1;
    utterance.onend = () => {
      if (!playingRef.current || pausedRef.current) return;
      completedIdsRef.current.add(item.id);
      patch({
        currentElementId: item.id,
        completedElementIds: [...completedIdsRef.current],
        startedAt: selected.startedAt || new Date().toISOString(),
      });
      speakAt(index + 1);
    };
    globalThis.speechSynthesis.cancel();
    globalThis.speechSynthesis.speak(utterance);
  }, [items, patch, selected, voices]);

  function createSession() {
    if (!startSceneId) return;
    const next = createTableReadSession(project, { title, scope, startSceneId });
    const created = tableReadSessions(next)[0]?.session;
    onProjectChange(next);
    if (created) setSelectedId(created.id);
    setTitle("");
  }

  function play() {
    if (!selected || !items.length) return;
    startedAtRef.current = Date.now();
    playingRef.current = true;
    pausedRef.current = false;
    completedIdsRef.current = new Set(selected.completedElementIds);
    setPlaying(true);
    setPaused(false);
    patch({ startedAt: selected.startedAt || new Date().toISOString(), endedAt: "" });
    speakAt(currentIndex);
  }

  function pause() {
    globalThis.speechSynthesis?.pause();
    pausedRef.current = true;
    setPaused(true);
  }

  function resume() {
    globalThis.speechSynthesis?.resume();
    pausedRef.current = false;
    setPaused(false);
  }

  function stop() {
    globalThis.speechSynthesis?.cancel();
    playingRef.current = false;
    pausedRef.current = false;
    setPlaying(false);
    setPaused(false);
  }

  function moveTo(index: number) {
    const bounded = Math.min(Math.max(index, 0), Math.max(0, items.length - 1));
    patch({ currentElementId: items[bounded]?.id || "" });
    if (playingRef.current) speakAt(bounded);
  }

  function moveScene(direction: -1 | 1) {
    if (!current) return;
    const sceneIds = [...new Set(items.map((item) => item.sceneId))];
    const sceneIndex = sceneIds.indexOf(current.sceneId);
    const nextSceneId = sceneIds[Math.min(Math.max(sceneIndex + direction, 0), sceneIds.length - 1)];
    const nextIndex = items.findIndex((item) => item.sceneId === nextSceneId);
    if (nextIndex >= 0) moveTo(nextIndex);
  }

  function saveNote() {
    if (!selected || !current || !noteBody.trim()) return;
    onProjectChange(recordTableReadNote(project, selected.id, current.target, noteAuthor, noteBody));
    setNoteBody("");
  }

  function finish() {
    if (!selected) return;
    stop();
    const elapsed = startedAtRef.current ? (Date.now() - startedAtRef.current) / 1000 : selected.actualDurationSeconds;
    onProjectChange(finishTableReadSession(project, selected.id, elapsed));
  }

  function addPronunciation() {
    if (!selected || !pronunciationPhrase.trim() || !pronunciationReplacement.trim()) return;
    patch({
      pronunciations: [...selected.pronunciations, {
        id: `pronunciation-${globalThis.crypto?.randomUUID?.() ?? Date.now()}`,
        phrase: pronunciationPhrase.trim(),
        replacement: pronunciationReplacement.trim(),
      }],
    });
    setPronunciationPhrase("");
    setPronunciationReplacement("");
  }

  function updateVoice(characterId: string, voiceURI: string) {
    if (!selected) return;
    patch({
      voiceAssignments: selected.voiceAssignments.map((assignment) => assignment.characterId === characterId
        ? { ...assignment, voiceURI }
        : assignment),
    });
  }

  async function copySides() {
    const character = project.characters.find((candidate) => candidate.id === sideCharacterId);
    const text = [
      `${project.metadata.title} · Actor sides · ${character?.name || "Character"}`,
      ...sides.flatMap((line) => [
        "",
        line.sceneLabel,
        line.cue ? `CUE: ${line.cue}` : "CUE: Opening line",
        line.line,
      ]),
    ].join("\n");
    await navigator.clipboard?.writeText(text);
  }

  return (
    <section className={styles.tableRead} aria-label="Table Read and rehearsal">
      <header className={styles.heading}>
        <div><p>Table Read</p><h2>Hear the screenplay. Capture the performance evidence.</h2></div>
        <span>Browser voices work locally. External voice providers remain optional and cannot alter canon.</span>
      </header>

      <div className={styles.create}>
        <label><span>Session title</span><input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="First cast read" /></label>
        <label><span>Read</span><select value={scope} onChange={(event) => setScope(event.target.value as TableReadScope)}><option value="scene">One scene</option><option value="sequence">Sequence</option><option value="screenplay">Full screenplay</option></select></label>
        <label><span>Start from scene</span><select value={startSceneId} onChange={(event) => setStartSceneId(event.target.value)}>{scenes.map((scene) => <option value={scene.id} key={scene.id}>{scene.label}</option>)}</select></label>
        <button type="button" onClick={createSession} disabled={!startSceneId}>Start local session</button>
      </div>

      <div className={styles.sessionLayout}>
        <nav aria-label="Table Read session history">
          {sessions.map(({ session }) => <button type="button" key={session.id} aria-pressed={selected?.id === session.id} onClick={() => setSelectedId(session.id)}><strong>{session.title}</strong><span>{scopeLabel(session.scope)} · {new Date(session.createdAt).toLocaleString("en-CA")}</span></button>)}
          {!sessions.length ? <p>No Table Read sessions yet. Select the current scene and begin locally.</p> : null}
        </nav>

        {selected && report ? <div className={styles.session}>
          <div className={styles.metrics}>
            <article><strong>{report.sceneCount}</strong><span>Scenes</span></article>
            <article><strong>{report.lineCount}</strong><span>Readable elements</span></article>
            <article><strong>{formatTableReadDuration(report.estimatedSeconds)}</strong><span>Estimated</span></article>
            <article><strong>{report.completedCount}/{report.lineCount}</strong><span>Completed</span></article>
            <article><strong>{report.noteCount}</strong><span>Notes</span></article>
          </div>

          <section className={styles.playback} aria-label="Local browser voice playback">
            <header><div><span>{current?.sceneLabel || "No screenplay text"}</span><h3>{current?.speakerName || "Add screenplay dialogue to begin"}</h3></div><b>{items.length ? `${currentIndex + 1} / ${items.length}` : "0 / 0"}</b></header>
            <article className={styles.currentLine}><span>{current?.element.type || "screenplay"}</span><p>{current?.text || "This session has no readable screenplay elements."}</p><small>Stable target: {current?.id || "none"}</small></article>
            <div className={styles.controls}>
              <button type="button" onClick={() => moveScene(-1)} disabled={!items.length}>Previous scene</button>
              <button type="button" onClick={() => moveTo(currentIndex - 1)} disabled={!items.length}>Previous line</button>
              {!playing ? <button type="button" className={styles.primary} onClick={play} disabled={!items.length || !globalThis.speechSynthesis}>Play</button> : paused ? <button type="button" className={styles.primary} onClick={resume}>Resume</button> : <button type="button" className={styles.primary} onClick={pause}>Pause</button>}
              <button type="button" onClick={stop} disabled={!playing}>Stop</button>
              <button type="button" onClick={() => moveTo(currentIndex + 1)} disabled={!items.length}>Next line</button>
              <button type="button" onClick={() => moveScene(1)} disabled={!items.length}>Next scene</button>
            </div>
          </section>

          <details className={styles.settings}>
            <summary>Voice assignment and pronunciation</summary>
            <div className={styles.voiceGrid}>
              <label><span>Narrator</span><select value={selected.narratorVoiceURI} onChange={(event) => patch({ narratorVoiceURI: event.target.value })}><option value="">Browser default</option>{voices.map((voice) => <option key={voice.voiceURI} value={voice.voiceURI}>{voice.name} · {voice.lang}</option>)}</select></label>
              {selected.voiceAssignments.map((assignment) => <label key={assignment.characterId}><span>{assignment.characterName || "Unnamed character"}</span><select value={assignment.voiceURI} onChange={(event) => updateVoice(assignment.characterId, event.target.value)}><option value="">Browser default</option>{voices.map((voice) => <option key={voice.voiceURI} value={voice.voiceURI}>{voice.name} · {voice.lang}</option>)}</select></label>)}
            </div>
            <div className={styles.pronunciation}>
              <label><span>Written phrase</span><input value={pronunciationPhrase} onChange={(event) => setPronunciationPhrase(event.target.value)} /></label>
              <label><span>Speak as</span><input value={pronunciationReplacement} onChange={(event) => setPronunciationReplacement(event.target.value)} /></label>
              <button type="button" onClick={addPronunciation}>Add pronunciation</button>
            </div>
            <div className={styles.rules}>{selected.pronunciations.map((rule) => <span key={rule.id}><b>{rule.phrase}</b> → {rule.replacement}<button type="button" aria-label={`Remove ${rule.phrase}`} onClick={() => patch({ pronunciations: selected.pronunciations.filter((candidate) => candidate.id !== rule.id) })}>Remove</button></span>)}</div>
          </details>

          <section className={styles.note}>
            <header><div><span>Anchored rehearsal note</span><h3>{current?.target.label || "Select a screenplay line"}</h3></div></header>
            <div><label><span>Reader or actor</span><input value={noteAuthor} onChange={(event) => setNoteAuthor(event.target.value)} /></label><label><span>Observation</span><textarea rows={3} value={noteBody} onChange={(event) => setNoteBody(event.target.value)} placeholder="Intention, clarity, rhythm, pronunciation, interruption or performance…" /></label><button type="button" onClick={saveNote} disabled={!current || !noteBody.trim()}>Save as Feedback</button></div>
          </section>

          <section className={styles.sides}>
            <header><div><span>Actor sides</span><h3>Lines with preceding cues and stable scene links</h3></div><button type="button" onClick={copySides} disabled={!sides.length}>Copy actor sides</button></header>
            <label><span>Character</span><select value={sideCharacterId} onChange={(event) => setSideCharacterId(event.target.value)}>{project.characters.map((character) => <option value={character.id} key={character.id}>{character.name || "Unnamed character"}</option>)}</select></label>
            <div>{sides.map((line) => <article key={line.id}><span>{line.sceneLabel}</span><small>{line.cue ? `Cue: ${line.cue}` : "Opening line"}</small><p>{line.line}</p></article>)}</div>
          </section>

          <section className={styles.summary}>
            <label><span>Session summary</span><textarea rows={4} value={selected.summary} onChange={(event) => patch({ summary: event.target.value })} placeholder="What changed after hearing the work?" /></label>
            <div><span>Actual session: {formatTableReadDuration(selected.actualDurationSeconds)}</span><span>Estimated scope: {formatTableReadDuration(estimatedTableReadSeconds(items))}</span><button type="button" onClick={finish}>Finish session and save report</button></div>
          </section>
        </div> : null}
      </div>
    </section>
  );
}
