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
  };
};

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
  const [status, setStatus] = useState("Choose a saved story, then inspect one shot.");
  const [busy, setBusy] = useState(false);
  const generation = useRef(0);

  const refreshProject = useCallback(() => {
    generation.current += 1;
    setBusy(false);
    setObservation(null);
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
      setObservation(value);
      setStatus("Source-bound read only. Media bytes and independent acceptance remain unverified.");
    } catch (failure) {
      if (requestVersion === generation.current) {
        setStatus(failure instanceof Error ? failure.message : "Authenticated shot readback unavailable.");
      }
    } finally {
      if (requestVersion === generation.current) setBusy(false);
    }
  }

  return (
    <section className={styles.root} aria-label="Read a canonical Storyboard shot">
      <div className={styles.title}>
        <strong>Storyboard shot · Headless parity</strong>
        <small>Same profile-owned PPF as Storyboard and Previs</small>
      </div>
      <p className={styles.project} title={project?.id || undefined}>
        {project ? `${project.title} · revision ${project.revision}` : "No active saved story"}
      </p>
      <div className={styles.selectors}>
        <label>Block
          <select value={block} onChange={(e) => { generation.current += 1; setBlock(Number(e.target.value)); setObservation(null); setBusy(false); }}>
            {Array.from({ length: 24 }, (_, i) => i + 1).map(value => (
              <option key={value} value={value}>{String(value).padStart(2, "0")}</option>
            ))}
          </select>
        </label>
        <label>Mini
          <select value={mini} onChange={(e) => { generation.current += 1; setMini(Number(e.target.value)); setObservation(null); setBusy(false); }}>
            {[1, 2, 3, 4].map(value => <option key={value} value={value}>{value}</option>)}
          </select>
        </label>
        <label>Shot
          <select value={shot} onChange={(e) => { generation.current += 1; setShot(Number(e.target.value)); setObservation(null); setBusy(false); }}>
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
      <p className={styles.status} role="status">{status}</p>
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
      <Link href="/storyboard">Open the owning Storyboard</Link>
    </section>
  );
}
