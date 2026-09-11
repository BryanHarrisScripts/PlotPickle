"use client";

import { useEffect, useState } from "react";
import styles from "./local-voice-settings.module.css";

type VoiceStatus = {
  ok?: boolean;
  ready: boolean;
  provider: string;
  model: string;
  runtimeInstalled: boolean;
  modelInstalled: boolean;
  integrityVerified: boolean;
  releaseTag: string;
  sourceCommit: string;
  modelRevision: string;
  reason: string;
  setupTask: {
    state: "idle" | "installing" | "installed" | "failed";
    message: string;
    startedAt: string;
    finishedAt: string;
  };
  manifest?: {
    runtimeSizeBytes: number;
    modelSizeBytes: number;
    automaticRuntimeDownload: boolean;
    cloudFallback: boolean;
  };
};

const STATUS_PATH = "/api/local-voice/status";
const SETUP_PATH = "/api/local-voice/setup";

function megabytes(bytes = 0) {
  return `${Math.round(bytes / 1024 / 1024)} MB`;
}

async function voiceRequest(path: string, method: "GET" | "POST" = "GET", body?: object) {
  const response = await fetch(path, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const value = await response.json() as VoiceStatus & { message?: string };
  if (!response.ok && response.status !== 409) throw new Error(value.message || "Local dictation status is unavailable.");
  return value;
}

export default function LocalVoiceSettings() {
  const [status, setStatus] = useState<VoiceStatus | null>(null);
  const [notice, setNotice] = useState("");
  const [working, setWorking] = useState(false);

  async function refresh() {
    try {
      const next = await voiceRequest(STATUS_PATH);
      setStatus(next);
      if (next.setupTask?.state === "failed") setNotice(next.setupTask.message || next.reason);
      if (next.ready) setNotice("Local dictation is ready. Microphone audio stays on this computer and transcripts enter ordinary text fields.");
      return next;
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Local dictation status could not be checked.");
      return null;
    }
  }

  useEffect(() => {
    void refresh();
  }, []);

  useEffect(() => {
    if (status?.setupTask?.state !== "installing") return;
    const timer = window.setInterval(() => { void refresh(); }, 1500);
    return () => window.clearInterval(timer);
  }, [status?.setupTask?.state]);

  async function install() {
    if (working || status?.setupTask?.state === "installing") return;
    setWorking(true);
    setNotice("Installing the reviewed CPU-only whisper.cpp runtime and base.en speech model. Downloads are integrity-checked before activation.");
    try {
      const next = await voiceRequest(SETUP_PATH, "POST", { approved: true });
      setStatus(next);
      if (next.setupTask?.state === "installing") setNotice(next.setupTask.message);
      else if (next.ready) setNotice(next.reason);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Local dictation setup could not start.");
    } finally {
      setWorking(false);
    }
  }

  const installing = status?.setupTask?.state === "installing";
  const totalBytes = (status?.manifest?.runtimeSizeBytes ?? 0) + (status?.manifest?.modelSizeBytes ?? 0);

  return (
    <section className={styles.panel} aria-labelledby="local-dictation-title">
      <header>
        <div>
          <p>Local · speech to text</p>
          <h3 id="local-dictation-title">Local Dictation</h3>
          <span>Speak into ordinary PlotPickle text fields. PlotPickle records a bounded temporary WAV, transcribes it locally with whisper.cpp, inserts plain text, then deletes the audio.</span>
        </div>
        <strong data-ready={status?.ready || undefined}>{status?.ready ? "Ready" : installing ? "Installing" : "Setup"}</strong>
      </header>

      <div className={styles.boundary}>
        <strong>Voice is only another way to type.</strong>
        <p>Dictation never sends a message, never changes canon automatically, never becomes agent memory, and has no paid/cloud fallback. Passwords, API keys, file paths, numeric/date inputs and command-like fields do not receive microphone controls.</p>
      </div>

      <dl>
        <div><dt>Runtime</dt><dd>{status ? `whisper.cpp ${status.releaseTag}` : "Checking…"}</dd></div>
        <div><dt>Model</dt><dd>{status?.model || "base.en"}</dd></div>
        <div><dt>Integrity</dt><dd>{status?.integrityVerified ? "Verified" : "Not verified"}</dd></div>
        <div><dt>Download</dt><dd>{totalBytes ? `${megabytes(totalBytes)} total` : "About 149 MB model + 8 MB runtime"}</dd></div>
        <div><dt>Inference</dt><dd>Windows x64 CPU · local only</dd></div>
        <div><dt>Fallback</dt><dd>None</dd></div>
      </dl>

      {!status?.ready ? (
        <div className={styles.actions}>
          <button type="button" onClick={() => void install()} disabled={working || installing}>
            {installing ? "Installing local dictation…" : status?.runtimeInstalled || status?.modelInstalled ? "Repair local dictation" : "Install local dictation"}
          </button>
          <button type="button" onClick={() => void refresh()} disabled={working || installing}>Check again</button>
        </div>
      ) : (
        <div className={styles.actions}><button type="button" onClick={() => void refresh()} disabled={working}>Verify again</button></div>
      )}

      <p className={styles.notice} role="status" aria-live="polite">{notice || status?.reason || "Checking the reviewed local dictation runtime…"}</p>
      <small>Setup is explicit: PlotPickle does not download whisper.cpp or its model merely because a microphone button is visible.</small>
    </section>
  );
}
