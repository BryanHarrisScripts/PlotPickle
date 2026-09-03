"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { summarizeRunTelemetry } from "../lib/runtime/run-telemetry";
import type { ResponsibilityRunEvent } from "../lib/agents/responsibility/responsibility-runs";
import styles from "./responsibility-run-activity.module.css";

type RunState = "queued" | "preparing-context" | "working" | "verifying" | "revising" | "waiting-for-writer" | "paused" | "completed" | "failed" | "cancelled";
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
  events: ResponsibilityRunEvent[];
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
          const telemetryEventCount = run.events.filter((event) => event.type.startsWith("telemetry.")).length;
          const telemetry = summarizeRunTelemetry(run);
          return (
            <article className={styles.card} key={run.runId} data-state={run.state}>
              <header>
                <div><strong>{run.goal}</strong><small>{run.profileId} · {run.kind.replaceAll("-", " ")}</small></div>
                <span>{stateLabel(run.state)}</span>
              </header>
              {telemetryEventCount ? <p><small>{telemetry.plainLanguage}</small></p> : null}
              <dl>
                <div><dt>Attempt</dt><dd>{run.usage.attempts}/{run.limits.maxAttempts}</dd></div>
                <div><dt>Tool calls</dt><dd>{run.usage.toolCalls}/{run.limits.maxToolCalls}</dd></div>
                <div><dt>Tokens</dt><dd>{run.usage.tokens.toLocaleString()}/{run.limits.maxTokens.toLocaleString()}</dd></div>
                <div><dt>Cloud budget</dt><dd>${run.usage.cloudCostUsd.toFixed(2)} / ${run.limits.maxCloudCostUsd.toFixed(2)}</dd></div>
                <div><dt>Waiting for</dt><dd>{waitingFor(run)}</dd></div>
                <div><dt>Context round</dt><dd>{run.contextRound}</dd></div>
              </dl>
              {telemetryEventCount ? <details>
                <summary>Technical Run details</summary>
                <dl>
                  <div><dt>Runtime</dt><dd>{telemetry.runtime || "Not reported"}</dd></div>
                  <div><dt>Provider</dt><dd>{telemetry.provider || "Not reported"}</dd></div>
                  <div><dt>Model</dt><dd>{telemetry.model || "Not reported"}</dd></div>
                  <div><dt>Capability</dt><dd>{telemetry.capabilityRole || "Not reported"}</dd></div>
                  <div><dt>Context sources</dt><dd>{telemetry.contextSourceCount}</dd></div>
                  <div><dt>Provider health</dt><dd>{telemetry.providerHealth.replaceAll("-", " ")}</dd></div>
                  <div><dt>Model calls</dt><dd>{telemetry.totals.localModelCalls} local · {telemetry.totals.cloudModelCalls} BYOK cloud</dd></div>
                  <div><dt>Token accounting</dt><dd>{telemetry.totals.inputTokens} in · {telemetry.totals.outputTokens} out · {telemetry.totals.estimatedTokenEvents} estimated · {telemetry.totals.unknownTokenEvents} unknown</dd></div>
                  <div><dt>Cloud cost</dt><dd>${telemetry.totals.cloudCostUsd.toFixed(4)} · {telemetry.totals.estimatedCostEvents} estimated · {telemetry.totals.unknownCostEvents} unknown</dd></div>
                  <div><dt>Safety signals</dt><dd>{telemetry.totals.policyDenials} policy denial(s) · {telemetry.totals.truncatedResults} partial/truncated result(s)</dd></div>
                </dl>
                <small>{telemetryEventCount} structured telemetry event(s) are correlated by Run ID. Private internal deliberation and credentials are not recorded.</small>
              </details> : null}
              <footer>
                <small>Updated {displayTime(run.updatedAt)} · {run.artifacts.length} artifact(s) · {run.verificationEvidence.length} evidence record(s)</small>
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
