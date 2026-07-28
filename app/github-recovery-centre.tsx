"use client";

import { useEffect, useMemo, useState } from "react";
import type { GitHubRecoverySummary } from "@/lib/github-recovery-status";
import type { GitHubCommandState, PublicGitHubCommandEntry } from "@/lib/github-command-outbox";
import styles from "./github-recovery-centre.module.css";

type RecoverySnapshot = {
  available: boolean;
  outboxUpdatedAt: string;
  summary: GitHubRecoverySummary;
  commands: PublicGitHubCommandEntry[];
  payloadsExposed: false;
};

type JsonRequestError = Error & { response?: Record<string, unknown> };

async function recoveryRequest(path = "", method: "GET" | "POST" = "GET") {
  const response = await fetch(`/api/local-github-commands${path}`, { method });
  const type = response.headers.get("content-type") ?? "";
  if (!type.includes("application/json")) throw new Error("GitHub recovery is available in the downloaded PlotPickle server.");
  const value = await response.json() as Record<string, unknown>;
  if (!response.ok) {
    const error = new Error(typeof value.message === "string" ? value.message : "The GitHub recovery operation failed.") as JsonRequestError;
    error.response = value;
    throw error;
  }
  return value as unknown as RecoverySnapshot;
}

function stateLabel(state: GitHubCommandState) {
  if (state === "needs-authentication") return "Reconnect GitHub";
  if (state === "needs-review") return "Review required";
  if (state === "retryable") return "Retry available";
  if (state === "sending") return "Sending";
  if (state === "pending") return "Ready for the original action";
  if (state === "completed") return "Completed";
  return "Cancelled";
}

function commandHelp(command: PublicGitHubCommandEntry, githubReady: boolean) {
  if (command.state === "needs-authentication") return githubReady
    ? "GitHub is connected again. Mark the command ready, then repeat the original action when you choose."
    : "Reconnect GitHub above and wait for the green Ready light before preparing this command.";
  if (command.state === "needs-review") return "Open the affected synchronization or Story Proposal workflow. PlotPickle will not choose local or remote content automatically.";
  if (command.state === "retryable") return "Mark this command ready, then repeat the original action when you choose.";
  if (command.state === "pending") return "The command is safely recorded and ready for its originating workflow.";
  if (command.state === "sending") return "The explicit command service is waiting for GitHub to confirm this operation.";
  return command.state === "completed" ? "GitHub confirmed this operation." : "This operation remains in the audit history but will not be sent.";
}

export default function GitHubRecoveryCentre({
  connected,
  ready,
  onNotice,
}: {
  connected: boolean;
  ready: boolean;
  onNotice: (message: string) => void;
}) {
  const [snapshot, setSnapshot] = useState<RecoverySnapshot | null>(null);
  const [workingId, setWorkingId] = useState("");
  const [error, setError] = useState("");

  async function refresh() {
    try {
      setSnapshot(await recoveryRequest());
      setError("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "GitHub recovery could not be loaded.");
    }
  }

  useEffect(() => {
    const timer = window.setTimeout(() => { void refresh(); }, 0);
    return () => window.clearTimeout(timer);
    // Recovery is intentionally loaded once; the visible Refresh control owns later reads.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const active = useMemo(() => snapshot?.commands
    .filter((command) => command.state !== "completed" && command.state !== "cancelled")
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt)) ?? [], [snapshot]);

  async function action(command: PublicGitHubCommandEntry, operation: "retry" | "cancel") {
    if (operation === "cancel" && !window.confirm(`Cancel “${command.label}”? The audit entry will be kept, but PlotPickle will not send it.`)) return;
    setWorkingId(command.id);
    try {
      const next = await recoveryRequest(`/${encodeURIComponent(command.id)}/${operation}`, "POST");
      setSnapshot(next);
      setError("");
      onNotice(operation === "retry"
        ? "The GitHub command is ready for its original workflow. PlotPickle has not sent it automatically."
        : "The GitHub command was cancelled. Its non-secret audit entry was kept.");
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "The GitHub recovery action failed.";
      setError(message);
      onNotice(message);
    } finally {
      setWorkingId("");
    }
  }

  const summary = snapshot?.summary ?? {
    tone: connected ? "pending" : "ready",
    label: "Checking recovery",
    message: "Reading the local non-secret GitHub command outbox…",
    activeCount: 0,
    terminalCount: 0,
    counts: { pending: 0, sending: 0, retryable: 0, needsAuthentication: 0, needsReview: 0 },
  } satisfies GitHubRecoverySummary;

  return (
    <section className={`${styles.centre} ${styles[summary.tone]}`} aria-labelledby="github-recovery-title">
      <header className={styles.header}>
        <div>
          <p>GitHub Recovery Centre</p>
          <h3 id="github-recovery-title">{summary.label}</h3>
          <span>{summary.message}</span>
        </div>
        <div className={styles.indicator} role="status" aria-live="polite"><i aria-hidden="true" /><b>{summary.activeCount ? `${summary.activeCount} waiting` : "Clear"}</b></div>
      </header>

      <div className={styles.boundary}>
        <strong>Passive by design</strong>
        <span>This view never intercepts browser requests, exposes command payloads or sends GitHub work automatically.</span>
        <button type="button" onClick={() => void refresh()}>Refresh</button>
      </div>

      {error ? <p className={styles.error}>{error}</p> : null}
      {!active.length && !error ? <div className={styles.empty}><strong>No GitHub recovery work is waiting.</strong><span>Local writing and saved projects remain available whether GitHub is connected or not.</span></div> : null}

      {active.length ? <div className={styles.commands}>{active.map((command) => (
        <article key={command.id} className={styles.command}>
          <div className={styles.commandHeader}>
            <div><strong>{command.label}</strong><span>{command.repository} · {command.branch}</span></div>
            <em data-state={command.state}>{stateLabel(command.state)}</em>
          </div>
          <p>{commandHelp(command, ready)}</p>
          {command.lastError ? <small>{command.lastError}</small> : null}
          <div className={styles.actions}>
            {command.state === "retryable" || (command.state === "needs-authentication" && ready)
              ? <button type="button" disabled={Boolean(workingId)} onClick={() => void action(command, "retry")}>{command.state === "needs-authentication" ? "Mark ready after reconnect" : "Mark ready to retry"}</button>
              : null}
            {["pending", "retryable", "needs-authentication", "needs-review"].includes(command.state)
              ? <button type="button" className={styles.cancel} disabled={Boolean(workingId)} onClick={() => void action(command, "cancel")}>Cancel command</button>
              : null}
          </div>
        </article>
      ))}</div> : null}

      <footer>
        <span>{connected ? ready ? "GitHub connection: Ready" : "GitHub connection: Needs attention" : "GitHub connection: Not connected"}</span>
        {snapshot?.summary.terminalCount ? <span>{snapshot.summary.terminalCount} completed or cancelled audit entries retained</span> : null}
      </footer>
    </section>
  );
}
