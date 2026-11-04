"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { authenticatedProfileFetch } from "../../core/auth/profile-request-browser";
import {
  loadLibraryProjectSnapshot,
  PROJECT_LIBRARY_CHANGED_EVENT,
  sessionActiveProjectId,
} from "../../core/storage/project-library-browser";
import styles from "./elara-shot-readback.module.css";

type ActiveProject = { readonly id: string; readonly revision: number; readonly title: string };
type ShotCandidate = {
  readonly id: string;
  readonly reviewState: string;
  readonly savedMarkerPresent: boolean;
  readonly locked: boolean;
  readonly mediaBytesVerified: false;
};
type ShotObservation = {
  readonly code: string;
  readonly state: "OBSERVED" | "BLOCKED";
  readonly project: { readonly id: string; readonly revision: number } | null;
  readonly shotStatus?: "EMPTY" | "CANDIDATE" | "SAVED" | "LOCKED";
  readonly candidateCount: number;
  readonly candidates: readonly ShotCandidate[];
  readonly nextAction: string | null;
  readonly mediaBytesVerified: false;
  readonly sourceEvidence: null | {
    readonly scope: "MINI_BLOCK";
    readonly shotSpecificMappingVerified: false;
    readonly passageCount: number;
    readonly passageIds: readonly string[];
  };
};

type MiniBlockSourcePreview = Readonly<{
  projectId: string;
  revision: number;
  block: number;
  mini: number;
  sourceFileName: string;
  sourceFormat: string;
  matchingCount: number;
  truncated: boolean;
  passages: readonly Readonly<{
    id: string;
    type: string;
    sceneNumber: number;
    text: string;
  }>[];
}>;

function selectedProject(): ActiveProject | null {
  const id = sessionActiveProjectId();
  if (!id) return null;
  const project = loadLibraryProjectSnapshot(id);
  if (!project || project.id !== id || !Number.isSafeInteger(project.revision)) return null;
  return { id, revision: project.revision, title: project.title || "Untitled Story" };
}

export default function ElaraShotReadback() {
  const [project, setProject] = useState<ActiveProject | null>(null);
  const [block, setBlock] = useState(1);
  const [mini, setMini] = useState(1);
  const [shot, setShot] = useState(1);
  const [observation, setObservation] = useState<ShotObservation | null>(null);
  const [sourcePreview, setSourcePreview] = useState<MiniBlockSourcePreview | null>(null);
  const [status, setStatus] = useState("Choose a saved story, then inspect one shot.");
  const [busy, setBusy] = useState(false);
  const generation = useRef(0);

  const refreshProject = useCallback(() => {
    generation.current += 1;
    setBusy(false);
    setObservation(null);
    setSourcePreview(null);
    try {
      const next = selectedProject();
      setProject(next);
      setStatus(next ? "Ready for an authenticated read-only shot inspection." : "No saved active PPF selected.");
    } catch {
      setProject(null);
      setStatus("Active project reference could not be read.");
    }
  }, []);

  useEffect(() => {
    refreshProject();
    window.addEventListener(PROJECT_LIBRARY_CHANGED_EVENT, refreshProject);
    window.addEventListener("focus", refreshProject);
    return () => {
      generation.current += 1;
      window.removeEventListener(PROJECT_LIBRARY_CHANGED_EVENT, refreshProject);
      window.removeEventListener("focus", refreshProject);
    };
  }, [refreshProject]);

  async function inspect() {
    const requestVersion = ++generation.current;
    setObservation(null);
    setSourcePreview(null);
    setBusy(true);
    setStatus("Reading the existing profile-owned PPF…");
    try {
      const current = selectedProject();
      if (!current || !project || current.id !== project.id || current.revision !== project.revision) {
        setStatus("Project changed. Refresh this panel before inspecting.");
        return;
      }
      const act = Math.floor((block - 1) / 6) + 1;
      const sequence = Math.floor((block - 1) / 2) + 1;
      const query = new URLSearchParams({
        storyboardShot: "1",
        projectId: current.id,
        revision: String(current.revision),
        act: String(act),
        sequence: String(sequence),
        block: String(block),
        mini: String(mini),
        shot: String(shot),
      });
      const response = await authenticatedProfileFetch("/api/auth/profile-private?" + query, {
        cache: "no-store",
      });
      const value = await response.json() as ShotObservation;
      if (requestVersion !== generation.current) return;
      const stillSelected = selectedProject();
      if (!stillSelected || stillSelected.id !== current.id || stillSelected.revision !== current.revision) {
        setStatus("Project changed while inspecting. Stale result discarded.");
        return;
      }
      if (!response.ok || value.state !== "OBSERVED" ||
          value.project?.id !== current.id || value.project?.revision !== current.revision ||
          value.mediaBytesVerified !== false) {
        setStatus(value.code || "Shot observation was not verified.");
        return;
      }
      // The authenticated owner reads the active PPF from its vault; reconcile
      // the browser's already-hydrated copy against its exact passage IDs before
      // displaying any text. A Mini-Block source is not Shot-specific evidence.
      const snapshot = loadLibraryProjectSnapshot(current.id);
      const screenplay = snapshot?.sourceEvidence?.screenplay;
      const passages = screenplay?.passages.filter(item =>
        item.blockNumber === block && item.miniBlockNumber === mini) ?? [];
      const observedIds = value.sourceEvidence?.passageIds;
      const expectedIds = passages.slice(0, 64).map(item => item.id);
      if (!snapshot || snapshot.id !== current.id || snapshot.revision !== current.revision ||
          !screenplay || value.sourceEvidence?.scope !== "MINI_BLOCK" ||
          value.sourceEvidence.passageCount !== passages.length ||
          !Array.isArray(observedIds) || observedIds.length !== expectedIds.length ||
          observedIds.some((id, index) => id !== expectedIds[index])) {
        setStatus("Saved source and authenticated shot evidence disagree. Refresh the active story; no text displayed.");
        return;
      }
      setSourcePreview({
        projectId: current.id,
        revision: current.revision,
        block,
        mini,
        sourceFileName: screenplay.sourceFileName,
        sourceFormat: screenplay.sourceFormat,
        matchingCount: passages.length,
        truncated: screenplay.passagesTruncated || passages.length > 32,
        passages: passages.slice(0, 32).map(item => ({
          id: item.id,
          type: item.type,
          sceneNumber: item.sceneNumber,
          text: item.text,
        })),
      });
      setObservation(value);
      setStatus("Profile-owned source verified for this Mini-Block. Shot-specific mapping, image bytes and independent acceptance remain unverified.");
    } catch (failure) {
      if (requestVersion === generation.current) {
        setStatus(failure instanceof Error ? failure.message : "Authenticated shot readback unavailable.");
      }
    } finally {
      if (requestVersion === generation.current) setBusy(false);
    }
  }

  async function copySourceForChatGPT() {
    if (!sourcePreview || !project || sourcePreview.projectId !== project.id ||
        sourcePreview.revision !== project.revision ||
        sourcePreview.block !== block || sourcePreview.mini !== mini) return;
    try {
      const current = selectedProject();
      if (!current || current.id !== sourcePreview.projectId ||
          current.revision !== sourcePreview.revision) throw Error("Project revision changed.");
      const snapshot = loadLibraryProjectSnapshot(current.id);
      const latest = snapshot?.sourceEvidence?.screenplay?.passages.filter(item =>
        item.blockNumber === block && item.miniBlockNumber === mini).slice(0, 32).map(item => ({
          id: item.id, type: item.type, sceneNumber: item.sceneNumber, text: item.text,
        }));
      if (!latest || JSON.stringify(latest) !== JSON.stringify(sourcePreview.passages)) {
        throw Error("Source passages changed. Inspect again before sharing.");
      }
      const header = [
        "PLOTPICKLE / SCREENPLAY SOURCE HANDOFF (READ-ONLY)",
        "Project ID: " + sourcePreview.projectId,
        "PPF revision: " + sourcePreview.revision,
        "Imported file: " + sourcePreview.sourceFileName,
        "Source format: " + sourcePreview.sourceFormat,
        "Block: " + String(block).padStart(2, "0") + " / Mini-Block: " + mini,
        "Target Shot: " + String(shot).padStart(2, "0") + " (NOT individually source-mapped)",
        "Source is Mini-Block-wide; do not treat draft shot content as approved canon.",
        "Source passages shown: " + sourcePreview.passages.length + " of " + sourcePreview.matchingCount,
        sourcePreview.truncated ? "WARNING: retained source may be truncated." : "",
      ].filter(Boolean);
      const lines = sourcePreview.passages.map(item =>
        "[" + item.id + "] " + item.type + " / Scene " + item.sceneNumber + ": " + item.text);
      await navigator.clipboard.writeText([...header, "", ...lines].join("\n"));
      setStatus("Read-only screenplay source copied by your explicit action. Paste it into ChatGPT to review; no project mutation.");
    } catch (failure) {
      setStatus(failure instanceof Error ? failure.message : "Clipboard unavailable; no source copied.");
    }
  }

  return (
    <section className={styles.root} aria-label="Read a canonical Storyboard shot">
      <div className={styles.title}>
        <strong>Storyboard shot · Canonical readback</strong>
        <small>Existing authenticated PPF route · agent API adapter pending</small>
      </div>
      <p className={styles.project} title={project?.id || undefined}>
        {project ? `${project.title} · revision ${project.revision}` : "No active saved story"}
      </p>
      <div className={styles.selectors}>
        <label>Block
          <select value={block} onChange={(e) => { generation.current += 1; setBlock(Number(e.target.value)); setObservation(null); setSourcePreview(null); setBusy(false); }}>
            {Array.from({ length: 24 }, (_, i) => i + 1).map(value => (
              <option key={value} value={value}>{String(value).padStart(2, "0")}</option>
            ))}
          </select>
        </label>
        <label>Mini
          <select value={mini} onChange={(e) => { generation.current += 1; setMini(Number(e.target.value)); setObservation(null); setSourcePreview(null); setBusy(false); }}>
            {[1, 2, 3, 4].map(value => <option key={value} value={value}>{value}</option>)}
          </select>
        </label>
        <label>Shot
          <select value={shot} onChange={(e) => { generation.current += 1; setShot(Number(e.target.value)); setObservation(null); setSourcePreview(null); setBusy(false); }}>
            {Array.from({ length: 25 }, (_, i) => i + 1).map(value => (
              <option key={value} value={value}>{String(value).padStart(2, "0")}</option>
            ))}
          </select>
        </label>
      </div>
      <button className={styles.inspect} type="button"
        disabled={!project || busy} onClick={() => { void inspect(); }}>
        {busy ? "Inspecting…" : "Inspect saved Shot"}
      </button>
      <button type="button" className={styles.refresh} onClick={refreshProject}>Refresh active story</button>
      <p className={styles.status} role="status">{status}</p>
      {sourcePreview ? (
        <details className={styles.sourcePreview} data-source-scope="MINI_BLOCK">
          <summary>Imported screenplay · {sourcePreview.matchingCount} Mini-Block passages</summary>
          <p className={styles.sourceNote}>
            {sourcePreview.sourceFileName} · {sourcePreview.sourceFormat} · revision {sourcePreview.revision}.
            These are actual retained screenplay passages, not a shot-by-shot allocation.
            {sourcePreview.truncated ? " Some source may be truncated." : ""}
          </p>
          <ol className={styles.sourceList}>
            {sourcePreview.passages.map(item => (
              <li key={item.id}>
                <small>{item.type} · Scene {item.sceneNumber} · {item.id}</small>
                <p>{item.text}</p>
              </li>
            ))}
          </ol>
          <button type="button" className={styles.refresh} onClick={() => void copySourceForChatGPT()}>
            Copy source excerpt for ChatGPT
          </button>
          <p className={styles.sourceNote}>
            Explicit clipboard handoff only. No automated ChatGPT ingestion or image generation is claimed.
          </p>
        </details>
      ) : null}
      {observation ? (
        <dl className={styles.evidence}>
          <div><dt>Actual candidate state</dt><dd>{observation.shotStatus || "UNKNOWN"}</dd></div>
          <div><dt>Stored candidates</dt><dd>{observation.candidateCount}</dd></div>
          <div><dt>Mini-Block source passages</dt><dd>{observation.sourceEvidence?.passageCount ?? "UNVERIFIED"}</dd></div>
          <div><dt>Image bytes</dt><dd>NOT VERIFIED</dd></div>
          {observation.candidates.slice(0, 3).map(item => (
            <div key={item.id}>
              <dt>Candidate {item.id.slice(0, 12)}</dt>
              <dd>{item.locked ? "LOCKED marker" : item.savedMarkerPresent ? "SAVED marker" : item.reviewState} · bytes unverified</dd>
            </div>
          ))}
        </dl>
      ) : null}
      {!project ? <Link href="/?workspace=library">Open Library to select a story</Link> : null}
      <Link href={`/storyboard?block=${block}&mini=${mini}`}>Open Storyboard · Block {String(block).padStart(2, "0")} / Mini {mini}</Link>
    </section>
  );
}
