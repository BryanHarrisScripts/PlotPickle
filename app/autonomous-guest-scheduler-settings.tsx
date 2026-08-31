"use client";

import { useEffect, useMemo, useState } from "react";
import styles from "./autonomous-guest-scheduler-settings.module.css";

type ScheduleSummary = Readonly<{
  status: "active" | "paused";
  nextFireAt: number;
  cron: string;
  timezone: string;
}>;

type TaskSummary = Readonly<{
  taskId: string;
  taskKind: string;
  state: string;
  notBefore: string;
  expiresAt: string;
  attempt: number;
  maxAttempts: number;
  lastFailureClass: string;
  schedule: ScheduleSummary | null;
}>;

type SchedulerSnapshot = Readonly<{
  available: boolean;
  enabled: boolean;
  policyPresent: boolean;
  projectId: string;
  currentRevision: string;
  nextRunAt: number | null;
  counts: Readonly<{
    pending: number;
    eligible: number;
    running: number;
    blocked: number;
    retryWait: number;
  }>;
  activeTasks: readonly TaskSummary[];
  history: readonly TaskSummary[];
}>;

function formatTime(value: number | string | null) {
  if (value == null || value === "") return "None scheduled";
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toLocaleString() : "Unknown";
}

async function readResponse(response: Response) {
  const body = await response.json() as SchedulerSnapshot & { message?: string };
  if (!response.ok) throw new Error(body.message || "The Autonomous Guest scheduler request was rejected.");
  return body;
}

export default function AutonomousGuestSchedulerSettings() {
  const [snapshot, setSnapshot] = useState<SchedulerSnapshot | null>(null);
  const [selectedTaskId, setSelectedTaskId] = useState("");
  const [cron, setCron] = useState("0 9 * * *");
  const [timezone, setTimezone] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    try {
      setTimezone(Intl.DateTimeFormat().resolvedOptions().timeZone || "");
    } catch {
      setTimezone("");
    }
  }, []);

  async function refresh() {
    setError("");
    try {
      const response = await fetch("/api/autonomous-guest/scheduler", { headers: { Accept: "application/json" } });
      const next = await readResponse(response);
      setSnapshot(next);
      setSelectedTaskId((current) => current && next.activeTasks.some((task) => task.taskId === current)
        ? current
        : next.activeTasks[0]?.taskId || "");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Autonomous Guest scheduler status is unavailable.");
    }
  }

  useEffect(() => { void refresh(); }, []);

  async function apply(action: string, detail: Record<string, unknown> = {}) {
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/autonomous-guest/scheduler", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ action, ...detail }),
      });
      const next = await readResponse(response);
      setSnapshot(next);
      setSelectedTaskId((current) => current && next.activeTasks.some((task) => task.taskId === current)
        ? current
        : next.activeTasks[0]?.taskId || "");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Autonomous Guest scheduler action failed.");
    } finally {
      setBusy(false);
    }
  }

  const selectedTask = useMemo(
    () => snapshot?.activeTasks.find((task) => task.taskId === selectedTaskId) || null,
    [selectedTaskId, snapshot],
  );

  if (!snapshot && !error) return <section className={styles.notice}><p>Checking Autonomous Guest scheduler…</p></section>;

  if (snapshot && !snapshot.available) {
    return (
      <section className={styles.notice}>
        <h3>Autonomous Guest is not active</h3>
        <p>A delegated Guest run must already exist before scheduling can be enabled or controlled. Settings cannot create Guest authority or impersonate a Human profile.</p>
      </section>
    );
  }

  if (!snapshot) return <section className={styles.notice}>{error ? <div className={styles.error}>{error}</div> : null}</section>;

  return (
    <section className={styles.panel} aria-label="Autonomous Guest Task Scheduler">
      <div className={styles.summary}>
        <div className={styles.summaryHeader}>
          <div>
            <h3>Task Scheduler</h3>
            <p>Quietly wakes approved Guest tasks. Every wake still rechecks route, revision, prerequisites, provider consent and budget.</p>
          </div>
          <span className={styles.status} data-enabled={snapshot.enabled}>{snapshot.enabled ? "Enabled" : "Disabled"}</span>
        </div>
        <div className={styles.metrics}>
          <div className={styles.metric}><strong>{snapshot.counts.pending}</strong><span>Pending</span></div>
          <div className={styles.metric}><strong>{snapshot.counts.eligible}</strong><span>Ready</span></div>
          <div className={styles.metric}><strong>{snapshot.counts.running}</strong><span>Running</span></div>
          <div className={styles.metric}><strong>{snapshot.counts.blocked}</strong><span>Blocked</span></div>
          <div className={styles.metric}><strong>{snapshot.counts.retryWait}</strong><span>Retry wait</span></div>
        </div>
        <div className={styles.taskMeta}>
          <span>Next run: {formatTime(snapshot.nextRunAt)}</span>
          {snapshot.projectId ? <span>Project: {snapshot.projectId}</span> : null}
          {snapshot.currentRevision ? <span>Revision: {snapshot.currentRevision}</span> : null}
        </div>
      </div>

      <div className={styles.controls}>
        <h3>Scheduler control</h3>
        <p>Disabling prevents future execution without erasing prior task evidence or history.</p>
        <div className={styles.controlRow}>
          <button
            type="button"
            disabled={busy || !snapshot.policyPresent}
            onClick={() => void apply("set-enabled", { enabled: !snapshot.enabled })}
          >
            {snapshot.enabled ? "Disable scheduling" : "Enable scheduling"}
          </button>
          <button type="button" disabled={busy} onClick={() => void refresh()}>Refresh</button>
        </div>
        {error ? <div className={styles.error} role="alert">{error}</div> : null}
      </div>

      <div className={styles.tasks}>
        <h3>Current tasks</h3>
        <p>Choose an existing PlotPickle-owned task. Settings can schedule or wake it, but cannot invent a task or grant a new route.</p>
        {snapshot.activeTasks.length ? (
          <>
            <div className={styles.controlRow}>
              <label>
                Task
                <select value={selectedTaskId} onChange={(event) => setSelectedTaskId(event.target.value)} disabled={busy}>
                  {snapshot.activeTasks.map((task) => <option key={task.taskId} value={task.taskId}>{task.taskKind} · {task.state}</option>)}
                </select>
              </label>
              <label>
                Cron
                <input value={cron} onChange={(event) => setCron(event.target.value)} disabled={busy || Boolean(selectedTask?.schedule)} aria-label="Cron schedule" />
              </label>
              <label>
                Time zone
                <input value={timezone} onChange={(event) => setTimezone(event.target.value)} disabled={busy || Boolean(selectedTask?.schedule)} aria-label="Schedule time zone" />
              </label>
            </div>
            {selectedTask ? (
              <article className={styles.task}>
                <div className={styles.taskHeader}>
                  <div><strong>{selectedTask.taskKind}</strong><br /><code>{selectedTask.taskId}</code></div>
                  <span className={styles.status} data-enabled={selectedTask.schedule?.status === "active"}>{selectedTask.schedule ? selectedTask.schedule.status : selectedTask.state}</span>
                </div>
                <div className={styles.taskMeta}>
                  <span>Not before: {formatTime(selectedTask.notBefore)}</span>
                  <span>Attempt: {selectedTask.attempt}/{selectedTask.maxAttempts}</span>
                  {selectedTask.schedule ? <span>Next wake: {formatTime(selectedTask.schedule.nextFireAt)}</span> : <span>Not scheduled</span>}
                </div>
                <div className={styles.taskActions}>
                  <button type="button" disabled={busy || Boolean(selectedTask.schedule)} onClick={() => void apply("schedule-cron", { taskId: selectedTask.taskId, cron, timezone })}>Schedule</button>
                  <button type="button" disabled={busy || !selectedTask.schedule} onClick={() => void apply("run-now", { taskId: selectedTask.taskId })}>Run now</button>
                  <button type="button" disabled={busy || selectedTask.schedule?.status !== "active"} onClick={() => void apply("pause", { taskId: selectedTask.taskId })}>Pause</button>
                  <button type="button" disabled={busy || selectedTask.schedule?.status !== "paused"} onClick={() => void apply("resume", { taskId: selectedTask.taskId })}>Resume</button>
                  <button
                    type="button"
                    className={styles.danger}
                    disabled={busy}
                    onClick={() => {
                      if (window.confirm("Cancel this Autonomous Guest task? Its prior evidence will remain in history.")) void apply("cancel", { taskId: selectedTask.taskId });
                    }}
                  >Cancel task</button>
                </div>
              </article>
            ) : null}
          </>
        ) : <p className={styles.empty}>No active Guest tasks are waiting or running.</p>}
      </div>

      <div className={styles.history}>
        <h3>Recent history</h3>
        <p>Bounded task state only; story text, credentials and hidden reasoning are not shown or stored here.</p>
        <div className={styles.historyList}>
          {snapshot.history.length ? snapshot.history.map((task) => (
            <article className={styles.historyItem} key={`${task.taskId}-${task.state}`}>
              <div className={styles.taskHeader}><strong>{task.taskKind}</strong><span>{task.state}</span></div>
              <div className={styles.taskMeta}><code>{task.taskId}</code><span>Attempt {task.attempt}/{task.maxAttempts}</span>{task.lastFailureClass ? <span>{task.lastFailureClass}</span> : null}</div>
            </article>
          )) : <p className={styles.empty}>No completed or interrupted Guest task history yet.</p>}
        </div>
      </div>
    </section>
  );
}
