"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import styles from "./responsibility-run-activity.module.css";

type RunState = "queued" | "preparing-context" | "working" | "verifying" | "revising" | "waiting-for-writer" | "paused" | "completed" | "failed" | "cancelled";
type TelemetrySummary = {
  runId: string;
  totalTokens: number;
  tokenUsageKnown: boolean;
  totalContextCharacters: number;
  cloudCostUsd: number;
  cloudCostConfidence: "exact" | "estimated" | "unknown";
  route: "local" | "cloud/BYOK" | "";
  capabilityRole: string;
  provider: string;
  runtime: string;
  model: string;
  latencyMs: number;
  contextSourceCount: number;
  healthState: string;
  verificationRef: string;
  writerApprovalState: string;
  plainLanguage: string;
};
type RunSummary = {
  runId: string;
  kind: string;
  goal: string;
  profileId: string;
  state: RunState;
  objectiveRevision: number;
  contextRound: number;
  updatedAt: string;
  stopReason: string;
  usage: { attempts: number; tokens: number; toolCalls: number; cloudCostUsd: number };
  limits: { maxAttempts: number; maxTokens: number; maxToolCalls: number; maxCloudCostUsd: number };
  childRunIds: string[];
  artifacts: Array<{ id: string; kind: string }>;
  verificationEvidence: Array<{ authority: string; result: string }>;
  telemetrySummary?: TelemetrySummary | null;
};

type RunsPayload = { ok?: boolean; runs?: RunSummary[]; run?: RunSummary; message?: string };

async function request(init?: RequestInit) {
  const response = await fetch("/api/responsibility-runs", {
    ...init,
    cache: "no-store",
    headers: { Accept: "application/json", "Content-Type": "application/json", ...(init?.headers || {}) },
  });
  const value = await response.json() as RunsPayload;
  if (!response.ok) throw new Error(value.message || `Responsibility Runs returned ${response.status}.`);
  return value;
}

function stateLabel(state: RunState) {
  return state.replaceAll("-", " ");
}

function displayTime(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.valueOf()) ? "Recently" : date.toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

function waitingFor(run: RunSummary) {
  if (run.state === "waiting-for-writer") return "Writer decision";
  if (run.state === "paused") return "Resume or stop";
  if (run.state === "verifying") return "Independent verification";
  if (run.state === "revising") return "Bounded revision, then fresh verification";
  if (run.state === "failed") return run.stopReason || "Run limit or authoritative failure";
  if (run.state === "completed") return "Nothing — complete";
  if (run.state === "cancelled") return "Nothing — stopped";
  return "Current bounded work";
}

function usageLabel(run: RunSummary) {
  const telemetry = run.telemetrySummary;
  if (!telemetry) return "Runtime/model telemetry has not been recorded for this Run yet.";
  const detail = [
    telemetry.provider && telemetry.runtime ? `${telemetry.provider} · ${telemetry.runtime}` : telemetry.provider || telemetry.runtime,
    telemetry.model,
    telemetry.healthState ? `runtime ${telemetry.healthState}` : "",
    telemetry.tokenUsageKnown ? `${telemetry.totalTokens.toLocaleString()} measured tokens` : telemetry.totalTokens ? `${telemetry.totalTokens.toLocaleString()} estimated/partial tokens` : "",
  ].filter(Boolean).join(" · ");
  return detail ? `${telemetry.plainLanguage} · ${detail}` : telemetry.plainLanguage;
}

export default function ResponsibilityRunActivity() {
  const [runs, setRuns] = useState<RunSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState("");
  const [notice, setNotice] = useState("");

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const value = await request();
      setRuns(Array.isArray(value.runs) ? value.runs : []);
      setNotice("");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Responsibility Run activity is unavailable.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
    const timer = window.setInterval(() => void refresh(), 7_500);
    return () => window.clearInterval(timer);
  }, [refresh]);

  const visible = useMemo(() => runs.slice(0, 12), [runs]);

  async function control(run: RunSummary, action: "pause" | "resume" | "cancel") {
    setBusy(`${run.runId}:${action}`);
    try {
      await request({ method: "POST", body: JSON.stringify({ action, runId: run.runId, reason: action === "cancel" ? "Stopped from Agent Activity." : undefined }) });
      await refresh();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Run control failed.");
    } finally {
      setBusy("");
    }
  }

  return (
    <section className={styles.panel} aria-label="Responsibility Run activity">
      <header className={styles.heading}>
        <div>
          <span>Responsibility Runs</span>
          <h2>Bounded work with visible limits and human gates.</h2>
          <p>Runs can work, verify, revise and pause, but they cannot loop forever, grade their own deterministic work, silently spend on cloud models, or turn creative proposals into canon without the writer.</p>
        </div>
        <button type="button" disabled={loading} onClick={() => void refresh()}>{loading ? "Checking…" : "Refresh Runs"}</button>
      </header>

      {notice ? <p className={styles.notice} role="status">{notice}</p> : null}

      <div className={styles.grid}>
        {visible.length ? visible.map((run) => {
          const terminal = run.state === "completed" || run.state === "failed" || run.state === "cancelled";
          return (
            <article className={styles.card} key={run.runId} data-state={run.state}>
              <header>
                <div><strong>{run.goal}</strong><small>{run.profileId} · {run.kind.replaceAll("-", " ")}</small></div>
                <span>{stateLabel(run.state)}</span>
              </header>
              <p><strong>Run summary:</strong> {usageLabel(run)}</p>
              <dl>
                <div><dt>Attempt</dt><dd>{run.usage.attempts}/{run.limits.maxAttempts}</dd></div>
                <div><dt>Tool calls</dt><dd>{run.usage.toolCalls}/{run.limits.maxToolCalls}</dd></div>
                <div><dt>Tokens</dt><dd>{run.usage.tokens.toLocaleString()}/{run.limits.maxTokens.toLocaleString()}</dd></div>
                <div><dt>Cloud budget</dt><dd>${run.usage.cloudCostUsd.toFixed(2)} / ${run.limits.maxCloudCostUsd.toFixed(2)}</dd></div>
                <div><dt>Waiting for</dt><dd>{waitingFor(run)}</dd></div>
                <div><dt>Context round</dt><dd>{run.contextRound}</dd></div>
              </dl>
              <footer>
                <small>Run ID {run.runId} · Updated {displayTime(run.updatedAt)} · {run.artifacts.length} artifact(s) · {run.verificationEvidence.length} evidence record(s)</small>
                {!terminal ? <div className={styles.actions}>
                  {run.state === "paused"
                    ? <button type="button" disabled={Boolean(busy)} onClick={() => void control(run, "resume")}>Resume</button>
                    : <button type="button" disabled={Boolean(busy) || run.state === "waiting-for-writer"} onClick={() => void control(run, "pause")}>Pause</button>}
                  <button type="button" disabled={Boolean(busy)} onClick={() => void control(run, "cancel")}>Stop</button>
                </div> : null}
              </footer>
            </article>
          );
        }) : <p className={styles.empty}>No Responsibility Runs have been recorded yet. When bounded agent work starts, its status and limits will appear here.</p>}
      </div>
    </section>
  );
}
