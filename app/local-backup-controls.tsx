"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { PlotPickleProject } from "../lib/project";

type BackupItem = {
  fileName: string;
  bytes: number;
  createdAt: string;
  valid: boolean;
  projectId: string;
  title: string;
  projectRevision: number;
  includes: string[];
};

type RetentionRecord = {
  id: string;
  kind: "responsibility-run" | "verification" | "trace-log" | "backup";
  createdAt: string;
  bytes: number;
  pinned: boolean;
};

type StoragePayload = {
  ok?: boolean;
  summary?: { totalBytes: number; reclaimableBytes: number; plannedDeleteCount: number; counts: Record<string, number> };
  records?: RetentionRecord[];
  message?: string;
};

type ListPayload = { ok?: boolean; backups?: BackupItem[]; message?: string };
type ActionPayload = {
  ok?: boolean;
  backup?: { fileName: string; bytes: number; evidenceCount: number };
  preview?: { fileName: string; title: string; projectId: string; projectRevision: number; createdAt: string; sourceAppVersion: string; includedKinds: string[]; evidenceCount: number; warning: string };
  restore?: { project: PlotPickleProject; title: string; projectRevision: number; restoredFrom: string };
  diagnostics?: unknown;
  deleted?: unknown;
  message?: string;
};

const API = "/api/local-backups";

function bytes(value: number) {
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}

function date(value: string) {
  const parsed = new Date(value);
  return Number.isNaN(parsed.valueOf()) ? value : parsed.toLocaleString();
}

async function post(body: Record<string, unknown>) {
  const response = await fetch(API, { method: "POST", cache: "no-store", headers: { Accept: "application/json", "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const value = await response.json() as ActionPayload;
  if (!response.ok) throw new Error(value.message || `Backup action returned ${response.status}.`);
  return value;
}

async function get<T>(action: string) {
  const response = await fetch(`${API}?action=${encodeURIComponent(action)}`, { cache: "no-store", headers: { Accept: "application/json" } });
  const value = await response.json() as T & { message?: string };
  if (!response.ok) throw new Error(value.message || `Backup request returned ${response.status}.`);
  return value;
}

export default function LocalBackupControls({ project, onRestore }: { project: PlotPickleProject; onRestore: (project: PlotPickleProject, source: string) => void }) {
  const [backups, setBackups] = useState<BackupItem[]>([]);
  const [records, setRecords] = useState<RetentionRecord[]>([]);
  const [summary, setSummary] = useState<StoragePayload["summary"]>();
  const [includeRuns, setIncludeRuns] = useState(true);
  const [includeVerification, setIncludeVerification] = useState(true);
  const [busy, setBusy] = useState("");
  const [notice, setNotice] = useState("");

  const refresh = useCallback(async () => {
    try {
      const [list, storage] = await Promise.all([get<ListPayload>("list"), get<StoragePayload>("storage")]);
      setBackups(Array.isArray(list.backups) ? list.backups : []);
      setRecords(Array.isArray(storage.records) ? storage.records : []);
      setSummary(storage.summary);
      setNotice("");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Local backup status is unavailable.");
    }
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  const recentRecords = useMemo(() => records.slice(0, 18), [records]);

  async function createBackup() {
    setBusy("create");
    try {
      const result = await post({ action: "create", project, includeRuns, includeVerification });
      setNotice(result.backup ? `Complete backup created: ${result.backup.fileName} · ${bytes(result.backup.bytes)} · ${result.backup.evidenceCount} optional evidence record(s).` : "Complete backup created.");
      await refresh();
    } catch (error) { setNotice(error instanceof Error ? error.message : "Backup creation failed."); }
    finally { setBusy(""); }
  }

  async function restoreBackup(fileName: string) {
    setBusy(`restore:${fileName}`);
    try {
      const preview = (await post({ action: "preview-restore", fileName })).preview;
      if (!preview) throw new Error("Backup preview was unavailable.");
      const confirmed = window.confirm(`${preview.warning}\n\nRestore: ${preview.title}\nProject revision: ${preview.projectRevision}\nBackup: ${date(preview.createdAt)}\nIncludes: ${preview.includedKinds.join(", ") || "project only"}`);
      if (!confirmed) { setNotice("Restore cancelled. The active project was not changed."); return; }
      const restored = (await post({ action: "restore", fileName, confirm: true })).restore;
      if (!restored?.project) throw new Error("Validated backup did not return a restorable project.");
      onRestore(restored.project, restored.restoredFrom);
      setNotice(`Restored ${restored.title} from ${restored.restoredFrom} at canonical revision ${restored.projectRevision}.`);
    } catch (error) { setNotice(error instanceof Error ? error.message : "Restore failed."); }
    finally { setBusy(""); }
  }

  async function pin(record: RetentionRecord) {
    setBusy(`pin:${record.kind}:${record.id}`);
    try { await post({ action: "pin", kind: record.kind, id: record.id, pinned: !record.pinned }); await refresh(); }
    catch (error) { setNotice(error instanceof Error ? error.message : "Pin action failed."); }
    finally { setBusy(""); }
  }

  async function remove(record: RetentionRecord) {
    if (!window.confirm(`Delete ${record.kind} evidence ${record.id}? This does not delete canonical PPF revision history.`)) return;
    setBusy(`delete:${record.kind}:${record.id}`);
    try { await post({ action: "delete", kind: record.kind, id: record.id, confirm: true }); await refresh(); }
    catch (error) { setNotice(error instanceof Error ? error.message : "Delete action failed."); }
    finally { setBusy(""); }
  }

  async function prune() {
    if (!window.confirm("Clean up old unpinned Run, Verification, raw verification log and backup evidence using PlotPickle's retention defaults? Canonical PPF revision history is never pruned by this action.")) return;
    setBusy("prune");
    try {
      const result = await post({ action: "prune" });
      setNotice(Array.isArray(result.deleted) ? `Cleanup removed ${result.deleted.length} old unpinned evidence file(s).` : "Cleanup complete.");
      await refresh();
    } catch (error) { setNotice(error instanceof Error ? error.message : "Cleanup failed."); }
    finally { setBusy(""); }
  }

  async function exportDiagnostics() {
    setBusy("diagnostics");
    try {
      const payload = await get<{ diagnostics?: unknown }>("diagnostics");
      const blob = new Blob([`${JSON.stringify(payload.diagnostics || {}, null, 2)}\n`], { type: "application/json" });
      const href = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = href;
      anchor.download = `plotpickle-local-diagnostics-${new Date().toISOString().replace(/[:.]/g, "-")}.json`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(href);
      setNotice("Exported storage diagnostics. Project content, prompts and secrets are excluded.");
    } catch (error) { setNotice(error instanceof Error ? error.message : "Diagnostics export failed."); }
    finally { setBusy(""); }
  }

  return (
    <section aria-label="Local backup and retention" style={{ display: "grid", gap: 14, padding: 18, border: "1px solid rgba(255,255,255,.12)", borderRadius: 16, background: "rgba(0,0,0,.18)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 16, alignItems: "flex-start", flexWrap: "wrap" }}>
        <div style={{ display: "grid", gap: 5, maxWidth: 800 }}>
          <strong>Local backup, restore & storage</strong>
          <span>Complete backups wrap the portable PPF with checksums and optional Run/Verification evidence. Credentials, provider keys, Studio private signing keys and BUZZ-owned private data are excluded.</span>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button type="button" disabled={Boolean(busy)} onClick={() => void createBackup()}>{busy === "create" ? "Backing up…" : "Create complete backup"}</button>
          <button type="button" disabled={Boolean(busy)} onClick={() => void prune()}>Clean up old evidence</button>
          <button type="button" disabled={Boolean(busy)} onClick={() => void exportDiagnostics()}>Export diagnostics</button>
        </div>
      </div>

      <div style={{ display: "flex", gap: 18, flexWrap: "wrap" }}>
        <label><input type="checkbox" checked={includeRuns} onChange={(event) => setIncludeRuns(event.target.checked)} /> Include recent Responsibility Runs</label>
        <label><input type="checkbox" checked={includeVerification} onChange={(event) => setIncludeVerification(event.target.checked)} /> Include recent Verification history</label>
      </div>

      {summary ? <p style={{ margin: 0 }}>Local evidence uses <strong>{bytes(summary.totalBytes)}</strong>. Current retention policy could reclaim <strong>{bytes(summary.reclaimableBytes)}</strong> from {summary.plannedDeleteCount} old unpinned file(s). Canonical project history is not included in that cleanup.</p> : null}
      {notice ? <p role="status" style={{ margin: 0 }}>{notice}</p> : null}

      <details open={backups.length > 0}>
        <summary>Complete backup archives ({backups.length})</summary>
        <div style={{ display: "grid", gap: 8, marginTop: 10 }}>
          {backups.length ? backups.slice(0, 12).map((backup) => <div key={backup.fileName} style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", flexWrap: "wrap", padding: 9, border: "1px solid rgba(255,255,255,.08)", borderRadius: 10 }}>
            <span><strong>{backup.title || backup.fileName}</strong> · rev {backup.projectRevision} · {bytes(backup.bytes)} · {date(backup.createdAt)} · {backup.valid ? "verified" : "invalid"}</span>
            <span style={{ display: "flex", gap: 8 }}>
              <a href={`${API}?action=export&file=${encodeURIComponent(backup.fileName)}`}>Export</a>
              <button type="button" disabled={Boolean(busy) || !backup.valid} onClick={() => void restoreBackup(backup.fileName)}>Preview & Restore</button>
            </span>
          </div>) : <span>No complete archives yet. Existing timestamped .ppf restore points continue to work separately.</span>}
        </div>
      </details>

      <details>
        <summary>Evidence retention ({records.length} files)</summary>
        <div style={{ display: "grid", gap: 7, marginTop: 10 }}>
          {recentRecords.map((record) => <div key={`${record.kind}:${record.id}`} style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
            <span>{record.kind.replaceAll("-", " ")} · {record.id} · {bytes(record.bytes)} · {date(record.createdAt)}{record.pinned ? " · pinned" : ""}</span>
            <span style={{ display: "flex", gap: 7 }}>
              <button type="button" disabled={Boolean(busy)} onClick={() => void pin(record)}>{record.pinned ? "Unpin" : "Pin"}</button>
              <button type="button" disabled={Boolean(busy)} onClick={() => void remove(record)}>Delete</button>
            </span>
          </div>)}
        </div>
      </details>
    </section>
  );
}
