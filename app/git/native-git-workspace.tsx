"use client";

import { useCallback, useEffect, useState } from "react";

type GitStatus = {
  branch: string;
  clean: boolean;
  remote: string;
  upstream: string;
  changes: Array<{ status: string; path: string }>;
  conflicts: Array<{ status: string; path: string }>;
};
type Revision = { sha: string; shortSha: string; author: string; date: string; subject: string };
type Branch = { name: string; sha: string; updatedAt: string; subject: string; active: boolean; proposal: boolean };

async function request<T>(path: string, projectKey: string, payload?: Record<string, unknown>): Promise<T> {
  const response = await fetch(`/api/local-projects/git${path}${payload ? "" : `?project=${encodeURIComponent(projectKey)}`}`, {
    method: payload ? "POST" : "GET",
    headers: payload ? { "Content-Type": "application/json" } : undefined,
    body: payload ? JSON.stringify({ projectKey, ...payload }) : undefined,
  });
  const result = await response.json() as T & { ok?: boolean; message?: string };
  if (!response.ok || result.ok === false) throw new Error(result.message || "Git operation failed.");
  return result;
}

export function NativeGitWorkspace({ initialProject = "afterglow" }: { initialProject?: string }) {
  const [projectKey, setProjectKey] = useState(initialProject);
  const [status, setStatus] = useState<GitStatus | null>(null);
  const [revisions, setRevisions] = useState<Revision[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [message, setMessage] = useState("");
  const [branchName, setBranchName] = useState("");
  const [remote, setRemote] = useState("");
  const [notice, setNotice] = useState("Ready.");
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    const [statusResult, historyResult, branchResult] = await Promise.all([
      request<{ ok: true } & GitStatus>("/status", projectKey),
      request<{ revisions: Revision[] }>("/history", projectKey),
      request<{ branches: Branch[] }>("/branches", projectKey),
    ]);
    setStatus(statusResult);
    setRevisions(historyResult.revisions);
    setBranches(branchResult.branches);
    setRemote(statusResult.remote);
  }, [projectKey]);

  useEffect(() => { void refresh().catch((error) => setNotice(error instanceof Error ? error.message : "Unable to read Git status.")); }, [refresh]);

  async function run(label: string, path: string, payload: Record<string, unknown> = {}) {
    setBusy(true);
    setNotice(`${label}…`);
    try {
      await request(path, projectKey, payload);
      await refresh();
      setNotice(`${label} complete.`);
      setMessage("");
      setBranchName("");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : `${label} failed.`);
    } finally { setBusy(false); }
  }

  return (
    <main className="mx-auto max-w-6xl space-y-6 p-6">
      <header>
        <p className="text-sm font-semibold uppercase tracking-wide">Project</p>
        <h1 className="text-3xl font-bold">Native Git</h1>
        <p className="mt-2 max-w-3xl">Save revisions, work on story branches, publish proposals and resolve conflicts without opening a terminal.</p>
      </header>

      <section className="rounded-xl border p-4">
        <label className="block text-sm font-semibold" htmlFor="project-key">Local project folder</label>
        <div className="mt-2 flex gap-2">
          <input id="project-key" className="min-w-0 flex-1 rounded border px-3 py-2" value={projectKey} onChange={(event) => setProjectKey(event.target.value)} />
          <button className="rounded border px-4 py-2" disabled={busy} onClick={() => void refresh()}>Open Git Project</button>
        </div>
        <p className="mt-3 text-sm" role="status">{notice}</p>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <article className="rounded-xl border p-4"><h2 className="font-bold">Current Branch</h2><p className="mt-2 text-lg">{status?.branch ?? "—"}</p><p className="text-sm">{status?.clean ? "Working folder is clean" : `${status?.changes.length ?? 0} changed file(s)`}</p></article>
        <article className="rounded-xl border p-4"><h2 className="font-bold">Remote</h2><p className="mt-2 break-all text-sm">{status?.remote || "Local only"}</p><p className="text-sm">{status?.upstream || "Not published"}</p></article>
        <article className="rounded-xl border p-4"><h2 className="font-bold">Conflicts</h2><p className="mt-2 text-lg">{status?.conflicts.length ?? 0}</p><p className="text-sm">Resolve each file before saving the merge revision.</p></article>
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <article className="rounded-xl border p-4">
          <h2 className="text-xl font-bold">Save Revision</h2>
          <textarea className="mt-3 min-h-24 w-full rounded border p-3" placeholder="Describe what changed in the story" value={message} onChange={(event) => setMessage(event.target.value)} />
          <button className="mt-3 rounded border px-4 py-2" disabled={busy} onClick={() => void run("Save Revision", "/revision", { message })}>Save Revision</button>
        </article>

        <article className="rounded-xl border p-4">
          <h2 className="text-xl font-bold">Story Branches & Proposals</h2>
          <input className="mt-3 w-full rounded border px-3 py-2" placeholder="alternate-ending" value={branchName} onChange={(event) => setBranchName(event.target.value)} />
          <div className="mt-3 flex flex-wrap gap-2">
            <button className="rounded border px-4 py-2" disabled={busy} onClick={() => void run("Create Story Branch", "/branch", { name: branchName })}>Create Story Branch</button>
            <button className="rounded border px-4 py-2" disabled={busy} onClick={() => void run("Create Story Proposal", "/proposal", { name: branchName })}>Create Story Proposal</button>
          </div>
          <ul className="mt-4 space-y-2 text-sm">{branches.map((branch) => <li key={branch.name} className="flex items-center justify-between gap-3 rounded border p-2"><span><strong>{branch.name}</strong>{branch.proposal ? " · proposal" : ""}</span>{branch.active ? <span>Active</span> : <button disabled={busy} onClick={() => void run("Switch Branch", "/switch", { name: branch.name })}>Switch</button>}</li>)}</ul>
        </article>
      </section>

      <section className="rounded-xl border p-4">
        <h2 className="text-xl font-bold">Pull Latest & Publish Changes</h2>
        <div className="mt-3 flex flex-col gap-2 md:flex-row">
          <input className="min-w-0 flex-1 rounded border px-3 py-2" placeholder="https://github.com/owner/story.git" value={remote} onChange={(event) => setRemote(event.target.value)} />
          <button className="rounded border px-4 py-2" disabled={busy} onClick={() => void run("Connect Remote", "/remote", { url: remote })}>Connect</button>
          <button className="rounded border px-4 py-2" disabled={busy || !status?.remote} onClick={() => void run("Pull Latest", "/pull")}>Pull Latest</button>
          <button className="rounded border px-4 py-2" disabled={busy || !status?.remote} onClick={() => void run("Publish Changes", "/publish")}>Publish Changes</button>
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <article className="rounded-xl border p-4"><h2 className="text-xl font-bold">Revision History</h2><ol className="mt-3 space-y-2 text-sm">{revisions.map((revision) => <li key={revision.sha} className="rounded border p-3"><strong>{revision.subject}</strong><div>{revision.shortSha} · {revision.author} · {new Date(revision.date).toLocaleString()}</div></li>)}</ol></article>
        <article className="rounded-xl border p-4"><h2 className="text-xl font-bold">Resolve Conflict</h2>{status?.conflicts.length ? <ul className="mt-3 space-y-2">{status.conflicts.map((conflict) => <li key={conflict.path} className="rounded border p-3"><div className="font-mono text-sm">{conflict.path}</div><div className="mt-2 flex gap-2"><button disabled={busy} onClick={() => void run("Keep Current", "/resolve", { path: conflict.path, resolution: "ours" })}>Keep Current</button><button disabled={busy} onClick={() => void run("Accept Incoming", "/resolve", { path: conflict.path, resolution: "theirs" })}>Accept Incoming</button><button disabled={busy} onClick={() => void run("Mark Resolved", "/resolve", { path: conflict.path, resolution: "manual" })}>Mark Resolved</button></div></li>)}</ul> : <p className="mt-3">No unresolved Git conflicts.</p>}</article>
      </section>
    </main>
  );
}
