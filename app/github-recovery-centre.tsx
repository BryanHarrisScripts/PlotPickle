"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { GITHUB_RECOVERY_ALLOWED_PATHS, isGitHubRecoveryPath } from "@/lib/github-recovery";
import styles from "./github-recovery-centre.module.css";

type RecoveryEntry = {
  id: string;
  operation: string;
  label: string;
  path: string;
  state: "queued" | "retrying" | "paused" | "conflict" | "failed";
  classification: string;
  attempts: number;
  createdAt: string;
  updatedAt: string;
  lastAttemptAt: string;
  nextRetryAt: string;
  lastStatus: number;
  lastError: string;
  userAction: string;
};

type RecoveryStatus = {
  queued: number;
  due: number;
  localWritingAvailable: boolean;
  entries: RecoveryEntry[];
};

type Diagnosis = {
  connected: boolean;
  state: string;
  repository?: string;
  resolvedRepository?: string;
  moved?: boolean;
  branch?: string;
  branchMissing?: boolean;
  availableBranches?: string[];
  projectId?: string;
  message: string;
};

const API = "/api/local-github-recovery";
const LABELS: Record<string, string> = {
  "/api/local-github-sync/publish": "Publish approved project files",
  "/api/local-github-sync/release-snapshot": "Create portable release snapshot",
  "/api/local-github/submit-proposal": "Submit Story Proposal",
  "/api/local-github/approve-proposal": "Approve Story Proposal changes",
  "/api/local-github/decline-proposal": "Decline Story Proposal",
  "/api/local-collaboration/policy": "Update collaboration policy",
};

async function responseMessage(response: Response) {
  const source = await response.clone().text();
  if (!source) return `GitHub returned ${response.status}.`;
  try {
    const value = JSON.parse(source) as Record<string, unknown>;
    return typeof value.message === "string" ? value.message : `GitHub returned ${response.status}.`;
  } catch {
    return source.slice(0, 700);
  }
}

async function request(path: string, method: "GET" | "POST" | "DELETE" = "GET", body?: object) {
  const response = await fetch(path, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const value = await response.json() as Record<string, unknown>;
  if (!response.ok) throw new Error(typeof value.message === "string" ? value.message : "GitHub recovery failed.");
  return value;
}

function retryAfterMs(response: Response) {
  const source = response.headers.get("retry-after");
  if (!source) return 0;
  const seconds = Number(source);
  if (Number.isFinite(seconds)) return Math.max(0, seconds * 1000);
  const date = Date.parse(source);
  return Number.isFinite(date) ? Math.max(0, date - Date.now()) : 0;
}

async function requestBody(input: RequestInfo | URL, init?: RequestInit) {
  const supplied = init?.body;
  if (typeof supplied === "string") {
    try {
      const value = JSON.parse(supplied);
      return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
    } catch { return null; }
  }
  if (typeof Request !== "undefined" && input instanceof Request) {
    try {
      const source = await input.clone().text();
      const value = source ? JSON.parse(source) : {};
      return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
    } catch { return null; }
  }
  return null;
}

function operationPath(input: RequestInfo | URL) {
  try {
    const raw = typeof input === "string" || input instanceof URL ? String(input) : input.url;
    return new URL(raw, window.location.origin).pathname;
  } catch { return ""; }
}

function operationMethod(input: RequestInfo | URL, init?: RequestInit) {
  return String(init?.method || (typeof Request !== "undefined" && input instanceof Request ? input.method : "GET")).toUpperCase();
}

function formatTime(value: string) {
  if (!value) return "Not scheduled";
  try { return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(value)); } catch { return value; }
}

export default function GitHubRecoveryCentre() {
  const [status, setStatus] = useState<RecoveryStatus>({ queued: 0, due: 0, localWritingAvailable: true, entries: [] });
  const [diagnosis, setDiagnosis] = useState<Diagnosis | null>(null);
  const [open, setOpen] = useState(false);
  const [working, setWorking] = useState(false);
  const [notice, setNotice] = useState("");

  const refresh = useCallback(async () => {
    try {
      const value = await request(`${API}/status`);
      const entries = Array.isArray(value.entries) ? value.entries as RecoveryEntry[] : [];
      setStatus({
        queued: Number(value.queued) || entries.length,
        due: Number(value.due) || 0,
        localWritingAvailable: value.localWritingAvailable !== false,
        entries,
      });
      if (entries.length) setOpen(true);
    } catch {
      // The downloaded local server exposes this service; hosted previews do not.
    }
  }, []);

  const drain = useCallback(async () => {
    try {
      await request(`${API}/drain`, "POST", {});
      await refresh();
    } catch {
      // A later online event or manual retry will try again.
    }
  }, [refresh]);

  useEffect(() => {
    const originalFetch = window.fetch.bind(window);
    const intercepted: typeof window.fetch = async (input, init) => {
      const path = operationPath(input);
      const eligible = operationMethod(input, init) === "POST" && isGitHubRecoveryPath(path);
      const body = eligible ? await requestBody(input, init) : null;
      try {
        const response = await originalFetch(input, init);
        if (eligible && body && !response.ok) {
          void originalFetch(`${API}/enqueue`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              path,
              body,
              label: LABELS[path] || "GitHub collaboration operation",
              failure: {
                status: response.status,
                message: await responseMessage(response),
                retryAfterMs: retryAfterMs(response),
              },
            }),
          }).then(() => refresh()).catch(() => undefined);
        }
        return response;
      } catch (error) {
        if (eligible && body) {
          void originalFetch(`${API}/enqueue`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              path,
              body,
              label: LABELS[path] || "GitHub collaboration operation",
              failure: { status: 0, message: error instanceof Error ? error.message : "GitHub could not be reached." },
            }),
          }).then(() => refresh()).catch(() => undefined);
        }
        throw error;
      }
    };
    window.fetch = intercepted;
    void refresh();
    const timer = window.setInterval(() => { void drain(); }, 30_000);
    const online = () => { void drain(); };
    window.addEventListener("online", online);
    return () => {
      if (window.fetch === intercepted) window.fetch = originalFetch;
      window.clearInterval(timer);
      window.removeEventListener("online", online);
    };
  }, [drain, refresh]);

  const summary = useMemo(() => {
    if (!status.entries.length) return "GitHub recovery ready";
    const conflicts = status.entries.filter((entry) => entry.state === "conflict").length;
    const paused = status.entries.filter((entry) => entry.state === "paused").length;
    if (conflicts) return `${conflicts} conflict${conflicts === 1 ? "" : "s"} need review`;
    if (paused) return `${paused} operation${paused === 1 ? "" : "s"} paused`;
    return `${status.entries.length} GitHub operation${status.entries.length === 1 ? "" : "s"} queued`;
  }, [status.entries]);

  async function retry(id: string) {
    setWorking(true);
    setNotice("Retrying through the existing PlotPickle collaboration engine…");
    try {
      const value = await request(`${API}/retry`, "POST", { id });
      setNotice(value.ok ? "The queued GitHub operation completed." : "The retry stopped safely. Review the updated recovery state.");
      await refresh();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "The queued operation could not be retried.");
    } finally { setWorking(false); }
  }

  async function remove(id: string) {
    setWorking(true);
    try {
      await request(`${API}/queue?id=${encodeURIComponent(id)}`, "DELETE");
      setNotice("The queued operation was removed. The local story was not changed.");
      await refresh();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "The queued operation could not be removed.");
    } finally { setWorking(false); }
  }

  async function diagnose() {
    setWorking(true);
    setNotice("Checking the saved repository and approved branch without writing…");
    try {
      const value = await request(`${API}/diagnose`);
      setDiagnosis(value as unknown as Diagnosis);
      setNotice(String(value.message || "GitHub diagnosis completed."));
      setOpen(true);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "GitHub diagnosis failed.");
    } finally { setWorking(false); }
  }

  async function adoptMovedRepository() {
    if (!diagnosis?.moved || !diagnosis.resolvedRepository || !diagnosis.projectId) return;
    if (!window.confirm(`Adopt ${diagnosis.resolvedRepository} only after PlotPickle verifies the same project ID? A new green Ready check will still be required.`)) return;
    const [owner, repo] = diagnosis.resolvedRepository.split("/");
    setWorking(true);
    try {
      await request(`${API}/adopt-repository`, "POST", { owner, repo, branch: diagnosis.branch, projectId: diagnosis.projectId });
      setNotice("The moved repository was verified and saved. Open Settings and run the green Ready check before retrying writes.");
      window.dispatchEvent(new CustomEvent("plotpickle:navigate-workspace", { detail: "settings" }));
      await diagnose();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "The moved repository could not be adopted.");
    } finally { setWorking(false); }
  }

  async function recreateBranch() {
    if (!diagnosis?.branchMissing || !diagnosis.projectId) return;
    if (!window.confirm(`Recreate ${diagnosis.branch} from the last verified approved commit? PlotPickle will verify the project ID and will not force-push.`)) return;
    setWorking(true);
    try {
      await request(`${API}/recreate-branch`, "POST", { projectId: diagnosis.projectId });
      setNotice("The approved branch was recreated without force from the last verified approved commit.");
      await diagnose();
      await drain();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "The approved branch could not be recreated.");
    } finally { setWorking(false); }
  }

  return (
    <aside className={`${styles.centre} ${open ? styles.open : ""}`} aria-label="GitHub recovery centre">
      <button type="button" className={styles.trigger} onClick={() => setOpen((value) => !value)} aria-expanded={open}>
        <i aria-hidden="true" className={status.entries.length ? styles.attention : styles.ready} />
        <span>{summary}</span>
        {status.entries.length ? <b>{status.entries.length}</b> : null}
      </button>
      {open ? (
        <div className={styles.panel}>
          <header>
            <div><p>Phase 6 recovery centre</p><h2>Keep writing locally. Recover GitHub deliberately.</h2></div>
            <button type="button" onClick={() => setOpen(false)} aria-label="Close GitHub recovery centre">Close</button>
          </header>
          <p className={styles.localSafety}>Local writing, backups and exports remain available even while GitHub is offline or needs attention.</p>
          {notice ? <div className={styles.notice} role="status">{notice}</div> : null}
          <div className={styles.actions}>
            <button type="button" disabled={working} onClick={() => void drain()}>Retry due operations</button>
            <button type="button" disabled={working} onClick={() => void diagnose()}>Diagnose repository</button>
            <a href="/settings">Reconnect or test GitHub</a>
          </div>

          {diagnosis ? (
            <section className={styles.diagnosis}>
              <div><strong>Repository diagnosis</strong><span>{diagnosis.message}</span></div>
              {diagnosis.repository ? <code>{diagnosis.repository} · {diagnosis.branch}</code> : null}
              {diagnosis.moved && diagnosis.resolvedRepository && diagnosis.projectId ? <button type="button" disabled={working} onClick={() => void adoptMovedRepository()}>Verify and adopt {diagnosis.resolvedRepository}</button> : null}
              {diagnosis.branchMissing && diagnosis.projectId ? <button type="button" disabled={working} onClick={() => void recreateBranch()}>Project Lead: recreate approved branch</button> : null}
              {diagnosis.branchMissing && diagnosis.availableBranches?.length ? <span>Existing branches: {diagnosis.availableBranches.join(", ")}</span> : null}
            </section>
          ) : null}

          <div className={styles.queue}>
            {status.entries.map((entry) => (
              <article key={entry.id} data-state={entry.state}>
                <div className={styles.entryHeader}><strong>{entry.label}</strong><span>{entry.state.replace("-", " ")}</span></div>
                <p>{entry.lastError}</p>
                <small>{entry.userAction}</small>
                <dl>
                  <div><dt>Attempts</dt><dd>{entry.attempts}</dd></div>
                  <div><dt>Next retry</dt><dd>{formatTime(entry.nextRetryAt)}</dd></div>
                  <div><dt>Type</dt><dd>{entry.classification.replaceAll("-", " ")}</dd></div>
                </dl>
                <div className={styles.actions}>
                  <button type="button" disabled={working || entry.state === "retrying"} onClick={() => void retry(entry.id)}>Retry now</button>
                  <button type="button" disabled={working} onClick={() => void remove(entry.id)}>Remove from queue</button>
                </div>
              </article>
            ))}
            {!status.entries.length ? <p className={styles.empty}>No GitHub writes are waiting. PlotPickle will capture eligible collaboration failures automatically.</p> : null}
          </div>
          <footer>Protected queue paths: {GITHUB_RECOVERY_ALLOWED_PATHS.length}. Credentials are rejected before an operation is stored.</footer>
        </div>
      ) : null}
    </aside>
  );
}
