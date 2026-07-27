import type { IncomingMessage, ServerResponse } from "node:http";
import type { Plugin } from "vite";
import { parsePortableProjectFile } from "../lib/project-package";
import {
  createPortableReleaseSnapshot,
  createProjectSyncInventory,
  diffProjectSyncInventories,
  inventoryFromContents,
  parseProjectSyncContents,
  safeManagedDeletionPath,
  type ProjectSyncInventory,
} from "../lib/project-folder-sync";
import { normalizePlotPickleProject, type PlotPickleProject } from "../lib/project";
import {
  inspectStoryProjectManifest,
  STORY_PROJECT_MANIFEST_PATH,
  upgradeStoryProjectManifest,
  type StoryProjectManifest,
} from "../lib/story-project-repository";
import { readCredentialJson, writeCredentialJson } from "./local-credentials";

const API = "/api/local-github-sync";
const CONNECTION_FILE = "github-connection.json";
const SYNC_STATE_FILE = "github-project-sync.json";
const MAX_BODY = 30 * 1024 * 1024;

type GitHubConnection = {
  version: 1;
  owner: string;
  repo: string;
  branch: string;
  projectPath: string;
  projectRoot?: string;
  token: string;
  login?: string;
  verifiedAt: string;
  readiness?: { ready: boolean };
};

type GitHubError = Error & { status?: number; body?: unknown };
type GitHubTreeItem = { path: string; mode: string; type: string; sha: string; size: number };
type BranchState = { commitSha: string; treeSha: string; tree: GitHubTreeItem[] };
type RemoteProjectState = {
  branch: BranchState;
  storyManifestSource: unknown;
  storyManifest: StoryProjectManifest;
  migrationRequired: boolean;
  legacyPortablePath: string;
  projectRoot: string;
  contents: Record<string, string>;
  inventory: ProjectSyncInventory;
  project: PlotPickleProject | null;
  legacyProject: PlotPickleProject | null;
};

type SavedSyncState = {
  version: 1;
  repository: string;
  branch: string;
  projectId: string;
  projectRoot: string;
  remoteCommit: string;
  manifestSha256: string;
  inventory: ProjectSyncInventory;
  synchronizedAt: string;
};

function isLoopback(value: string | undefined) {
  return value === "127.0.0.1" || value === "::1" || value === "::ffff:127.0.0.1";
}

function isLocalRequest(request: IncomingMessage) {
  if (!isLoopback(request.socket.remoteAddress)) return false;
  const host = request.headers.host;
  if (!host) return false;
  try {
    const hostUrl = new URL(`http://${host}`);
    if (!["127.0.0.1", "localhost", "[::1]"].includes(hostUrl.hostname)) return false;
    const origin = request.headers.origin;
    return !origin || new URL(origin).host === hostUrl.host;
  } catch {
    return false;
  }
}

function sendJson(response: ServerResponse, statusCode: number, body: Record<string, unknown>) {
  response.statusCode = statusCode;
  response.setHeader("Content-Type", "application/json; charset=utf-8");
  response.setHeader("Cache-Control", "no-store");
  response.setHeader("X-Content-Type-Options", "nosniff");
  response.end(JSON.stringify(body));
}

async function readBody(request: IncomingMessage) {
  const chunks: Buffer[] = [];
  let length = 0;
  for await (const chunk of request) {
    const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    length += bytes.length;
    if (length > MAX_BODY) throw new Error("The project synchronization request is too large.");
    chunks.push(bytes);
  }
  const value = JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("The project synchronization request is invalid.");
  return value as Record<string, unknown>;
}

function validConnection(value: GitHubConnection | null): value is GitHubConnection {
  return Boolean(value && value.version === 1 && value.owner && value.repo && value.branch && value.token && value.readiness?.ready);
}

async function connection() {
  const value = await readCredentialJson<GitHubConnection>(CONNECTION_FILE);
  if (!validConnection(value)) throw new Error("Reconnect GitHub and wait for the green Ready light before synchronizing the canonical project folder.");
  return value;
}

function repoEndpoint(value: GitHubConnection) {
  return `/repos/${encodeURIComponent(value.owner)}/${encodeURIComponent(value.repo)}`;
}

async function githubRequest(value: GitHubConnection, endpoint: string, init: { method?: string; body?: unknown } = {}) {
  const response = await fetch(`https://api.github.com${endpoint}`, {
    method: init.method || "GET",
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${value.token}`,
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": "PlotPickle-Canonical-Sync",
      ...(init.body === undefined ? {} : { "Content-Type": "application/json" }),
    },
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
    signal: AbortSignal.timeout(30_000),
  });
  const source = await response.text();
  let body: unknown = {};
  try { body = source ? JSON.parse(source) : {}; } catch { body = {}; }
  if (!response.ok) {
    const message = body && typeof body === "object" && typeof (body as { message?: unknown }).message === "string"
      ? String((body as { message: string }).message)
      : `GitHub returned ${response.status}.`;
    const error = new Error(message) as GitHubError;
    error.status = response.status;
    error.body = body;
    throw error;
  }
  return body;
}

async function branchState(value: GitHubConnection): Promise<BranchState> {
  const branchPath = value.branch.split("/").map(encodeURIComponent).join("/");
  const ref = await githubRequest(value, `${repoEndpoint(value)}/git/ref/heads/${branchPath}`);
  const commitSha = ref && typeof ref === "object" && (ref as { object?: { sha?: unknown } }).object?.sha
    ? String((ref as { object: { sha: string } }).object.sha)
    : "";
  if (!commitSha) throw new Error("GitHub did not return the approved branch commit.");
  const commit = await githubRequest(value, `${repoEndpoint(value)}/git/commits/${encodeURIComponent(commitSha)}`);
  const treeSha = commit && typeof commit === "object" && (commit as { tree?: { sha?: unknown } }).tree?.sha
    ? String((commit as { tree: { sha: string } }).tree.sha)
    : "";
  if (!treeSha) throw new Error("GitHub did not return the approved project tree.");
  const treeBody = await githubRequest(value, `${repoEndpoint(value)}/git/trees/${encodeURIComponent(treeSha)}?recursive=1`);
  if (treeBody && typeof treeBody === "object" && (treeBody as { truncated?: unknown }).truncated) {
    throw new Error("The repository tree is too large for safe PlotPickle synchronization. Move the story to a dedicated repository or reduce unrelated generated files.");
  }
  const entries = treeBody && typeof treeBody === "object" && Array.isArray((treeBody as { tree?: unknown[] }).tree)
    ? (treeBody as { tree: unknown[] }).tree
    : [];
  const tree = entries.flatMap((entry) => {
    if (!entry || typeof entry !== "object") return [];
    const record = entry as Record<string, unknown>;
    if (record.type !== "blob" || typeof record.path !== "string" || typeof record.sha !== "string") return [];
    return [{
      path: record.path,
      mode: typeof record.mode === "string" ? record.mode : "100644",
      type: "blob",
      sha: record.sha,
      size: Number(record.size) || 0,
    }];
  });
  return { commitSha, treeSha, tree };
}

async function blobText(value: GitHubConnection, sha: string) {
  const blob = await githubRequest(value, `${repoEndpoint(value)}/git/blobs/${encodeURIComponent(sha)}`);
  if (!blob || typeof blob !== "object" || typeof (blob as { content?: unknown }).content !== "string") {
    throw new Error("GitHub did not return a required canonical project file.");
  }
  const encoding = typeof (blob as { encoding?: unknown }).encoding === "string" ? String((blob as { encoding: string }).encoding) : "base64";
  const content = String((blob as { content: string }).content).replace(/\s/g, "");
  return encoding === "base64" ? Buffer.from(content, "base64").toString("utf8") : content;
}

function treeItem(branch: BranchState, filePath: string) {
  return branch.tree.find((entry) => entry.path === filePath) || null;
}

async function readTreeFile(value: GitHubConnection, branch: BranchState, filePath: string) {
  const item = treeItem(branch, filePath);
  return item ? blobText(value, item.sha) : null;
}

async function remoteState(value: GitHubConnection): Promise<RemoteProjectState> {
  const branch = await branchState(value);
  const storyManifestText = await readTreeFile(value, branch, STORY_PROJECT_MANIFEST_PATH);
  if (!storyManifestText) throw new Error("The repository is missing plotpickle-project.json. Initialize it through PlotPickle before synchronizing story files.");
  let storyManifestSource: unknown;
  try { storyManifestSource = JSON.parse(storyManifestText); } catch { throw new Error("The repository story manifest is not valid JSON. PlotPickle did not overwrite it."); }
  const inspected = inspectStoryProjectManifest(storyManifestSource);
  const projectRoot = inspected.manifest.canonicalProject.root;
  const contents: Record<string, string> = {};
  const prefix = `${projectRoot}/`;
  for (const item of branch.tree.filter((entry) => entry.path.startsWith(prefix))) {
    contents[item.path] = await blobText(value, item.sha);
  }
  const inventory = inventoryFromContents(contents, projectRoot);
  let project: PlotPickleProject | null = null;
  if (inventory.manifestSha256) project = parseProjectSyncContents(contents, projectRoot);

  let legacyProject: PlotPickleProject | null = null;
  if (!project) {
    const legacyText = await readTreeFile(value, branch, inspected.legacyPortablePath);
    if (legacyText) {
      const parsed = parsePortableProjectFile(legacyText);
      if (!parsed.integrityValid) throw new Error("The legacy approved .ppf failed its integrity check. Recover it before migration.");
      legacyProject = parsed.project;
    }
  }
  return {
    branch,
    storyManifestSource,
    storyManifest: inspected.manifest,
    migrationRequired: inspected.migrationRequired || !project,
    legacyPortablePath: inspected.legacyPortablePath,
    projectRoot,
    contents,
    inventory,
    project,
    legacyProject,
  };
}

function diffSummary(diff: ReturnType<typeof diffProjectSyncInventories>) {
  return {
    create: diff.create.length,
    update: diff.update.length,
    delete: diff.delete.length,
    unchanged: diff.unchanged.length,
    changed: diff.changedCount,
    changedPaths: [...diff.create, ...diff.update, ...diff.delete].map((file) => file.path),
  };
}

function checkProjectIdentity(remote: RemoteProjectState, project: PlotPickleProject) {
  if (remote.storyManifest.projectId !== project.id) {
    throw new Error("The connected GitHub story project belongs to a different PlotPickle project ID. PlotPickle did not overwrite it.");
  }
}

async function createBlob(value: GitHubConnection, content: string) {
  const result = await githubRequest(value, `${repoEndpoint(value)}/git/blobs`, {
    method: "POST",
    body: { content: Buffer.from(content, "utf8").toString("base64"), encoding: "base64" },
  });
  const sha = result && typeof result === "object" && typeof (result as { sha?: unknown }).sha === "string" ? String((result as { sha: string }).sha) : "";
  if (!sha) throw new Error("GitHub did not return a blob revision for a synchronized project file.");
  return sha;
}

async function commitTree(
  value: GitHubConnection,
  branch: BranchState,
  entries: Array<{ path: string; mode: "100644"; type: "blob"; sha: string | null }>,
  message: string,
) {
  const tree = await githubRequest(value, `${repoEndpoint(value)}/git/trees`, {
    method: "POST",
    body: { base_tree: branch.treeSha, tree: entries },
  });
  const treeSha = tree && typeof tree === "object" && typeof (tree as { sha?: unknown }).sha === "string" ? String((tree as { sha: string }).sha) : "";
  if (!treeSha) throw new Error("GitHub did not create the synchronized project tree.");
  const commit = await githubRequest(value, `${repoEndpoint(value)}/git/commits`, {
    method: "POST",
    body: { message, tree: treeSha, parents: [branch.commitSha] },
  });
  const commitSha = commit && typeof commit === "object" && typeof (commit as { sha?: unknown }).sha === "string" ? String((commit as { sha: string }).sha) : "";
  if (!commitSha) throw new Error("GitHub did not create the synchronized project commit.");
  const branchPath = value.branch.split("/").map(encodeURIComponent).join("/");
  await githubRequest(value, `${repoEndpoint(value)}/git/refs/heads/${branchPath}`, {
    method: "PATCH",
    body: { sha: commitSha, force: false },
  });
  return commitSha;
}

async function writeSyncState(value: GitHubConnection, project: PlotPickleProject, inventory: ProjectSyncInventory, remoteCommit: string) {
  const state: SavedSyncState = {
    version: 1,
    repository: `${value.owner}/${value.repo}`,
    branch: value.branch,
    projectId: project.id,
    projectRoot: inventory.projectRoot,
    remoteCommit,
    manifestSha256: inventory.manifestSha256,
    inventory,
    synchronizedAt: new Date().toISOString(),
  };
  await writeCredentialJson(SYNC_STATE_FILE, state);
  return state;
}

async function preview(value: GitHubConnection, project: PlotPickleProject) {
  const remote = await remoteState(value);
  checkProjectIdentity(remote, project);
  const local = createProjectSyncInventory(project, remote.projectRoot);
  const diff = diffProjectSyncInventories(local, remote.inventory);
  return {
    repository: `${value.owner}/${value.repo}`,
    branch: value.branch,
    remoteCommit: remote.branch.commitSha,
    projectRoot: remote.projectRoot,
    remoteProjectAvailable: Boolean(remote.project),
    migrationRequired: remote.migrationRequired,
    legacyPortablePath: remote.legacyPortablePath,
    localInventory: local,
    remoteInventory: remote.inventory,
    diff: diffSummary(diff),
  };
}

async function pull(value: GitHubConnection) {
  const remote = await remoteState(value);
  const project = remote.project || remote.legacyProject;
  if (!project) throw new Error("The approved repository contains neither a canonical project folder nor a readable legacy .ppf project.");
  if (remote.project) await writeSyncState(value, project, remote.inventory, remote.branch.commitSha);
  return {
    project,
    remoteCommit: remote.branch.commitSha,
    projectRoot: remote.projectRoot,
    inventory: remote.inventory,
    mode: remote.project ? "modular-folder" : "legacy-ppf",
    migrationRequired: !remote.project,
    legacyPortablePath: remote.legacyPortablePath,
  };
}

async function publish(value: GitHubConnection, input: Record<string, unknown>) {
  const project = normalizePlotPickleProject(input.project);
  if (!project) throw new Error("The active story could not be normalized before synchronizing its canonical project folder.");
  const expectedRemoteCommit = typeof input.expectedRemoteCommit === "string" ? input.expectedRemoteCommit : "";
  if (!expectedRemoteCommit) throw new Error("Compare project files before publishing so PlotPickle can guard the approved GitHub version.");
  const remote = await remoteState(value);
  checkProjectIdentity(remote, project);
  if (remote.branch.commitSha !== expectedRemoteCommit) {
    const error = new Error("The approved GitHub version changed after the synchronization preview. Get the latest approved version, review it and compare again before publishing.") as GitHubError;
    error.status = 409;
    throw error;
  }
  if (remote.migrationRequired && input.allowLegacyMigration !== true) {
    const error = new Error("This repository still uses the legacy .ppf collaboration layout. Review the migration preview and explicitly allow migration before publishing the canonical folder.") as GitHubError;
    error.status = 409;
    throw error;
  }

  const local = createProjectSyncInventory(project, remote.projectRoot);
  const diff = diffProjectSyncInventories(local, remote.inventory);
  const entries: Array<{ path: string; mode: "100644"; type: "blob"; sha: string | null }> = [];
  for (const file of [...diff.create, ...diff.update]) {
    entries.push({ path: file.path, mode: "100644", type: "blob", sha: await createBlob(value, file.content) });
  }
  for (const file of diff.delete) {
    if (!safeManagedDeletionPath(file.path, remote.projectRoot)) throw new Error(`PlotPickle refused to delete unmanaged repository path ${file.path}.`);
    entries.push({ path: file.path, mode: "100644", type: "blob", sha: null });
  }

  const upgradedManifest = {
    ...upgradeStoryProjectManifest(remote.storyManifestSource),
    projectId: project.id,
    title: project.metadata.title,
    updatedAt: new Date().toISOString(),
  };
  const manifestContent = `${JSON.stringify(upgradedManifest, null, 2)}\n`;
  entries.push({ path: STORY_PROJECT_MANIFEST_PATH, mode: "100644", type: "blob", sha: await createBlob(value, manifestContent) });

  let releaseSnapshot: { path: string; sha256: string; bytes: number } | null = null;
  if (input.includeReleaseSnapshot === true) {
    const snapshot = createPortableReleaseSnapshot(project);
    entries.push({ path: snapshot.path, mode: "100644", type: "blob", sha: await createBlob(value, snapshot.content) });
    releaseSnapshot = { path: snapshot.path, sha256: snapshot.sha256, bytes: snapshot.bytes };
  }
  if (!entries.length) return { remoteCommit: remote.branch.commitSha, diff: diffSummary(diff), inventory: local, releaseSnapshot, unchanged: true };

  const message = typeof input.message === "string" && input.message.trim()
    ? input.message.trim()
    : remote.migrationRequired
      ? `Migrate ${project.metadata.title} to canonical PlotPickle project files`
      : `Synchronize approved PlotPickle project files for ${project.metadata.title}`;
  const commitSha = await commitTree(value, remote.branch, entries, message);
  const state = await writeSyncState(value, project, local, commitSha);
  return {
    remoteCommit: commitSha,
    previousRemoteCommit: remote.branch.commitSha,
    projectRoot: remote.projectRoot,
    migrationCompleted: remote.migrationRequired,
    diff: diffSummary(diff),
    inventory: local,
    releaseSnapshot,
    syncState: state,
    unchanged: false,
  };
}

async function releaseSnapshot(value: GitHubConnection, input: Record<string, unknown>) {
  const project = normalizePlotPickleProject(input.project);
  if (!project) throw new Error("The active story could not be normalized before creating its portable release snapshot.");
  const expectedRemoteCommit = typeof input.expectedRemoteCommit === "string" ? input.expectedRemoteCommit : "";
  const remote = await remoteState(value);
  checkProjectIdentity(remote, project);
  if (!expectedRemoteCommit || expectedRemoteCommit !== remote.branch.commitSha) {
    const error = new Error("The approved GitHub version changed. Compare project files again before creating a release snapshot.") as GitHubError;
    error.status = 409;
    throw error;
  }
  const snapshot = createPortableReleaseSnapshot(project);
  const sha = await createBlob(value, snapshot.content);
  const commitSha = await commitTree(value, remote.branch, [{ path: snapshot.path, mode: "100644", type: "blob", sha }], `Create PlotPickle release snapshot for ${project.metadata.title}`);
  return { remoteCommit: commitSha, previousRemoteCommit: remote.branch.commitSha, snapshot: { path: snapshot.path, sha256: snapshot.sha256, bytes: snapshot.bytes } };
}

async function status(value: GitHubConnection) {
  const saved = await readCredentialJson<SavedSyncState>(SYNC_STATE_FILE);
  const remote = await remoteState(value);
  return {
    repository: `${value.owner}/${value.repo}`,
    branch: value.branch,
    remoteCommit: remote.branch.commitSha,
    projectRoot: remote.projectRoot,
    remoteProjectAvailable: Boolean(remote.project),
    migrationRequired: remote.migrationRequired,
    legacyPortablePath: remote.legacyPortablePath,
    lastSync: saved && saved.repository === `${value.owner}/${value.repo}` && saved.branch === value.branch ? saved : null,
  };
}

async function handle(request: IncomingMessage, response: ServerResponse, url: URL) {
  const value = await connection();
  if (request.method === "GET" && url.pathname === `${API}/status`) {
    sendJson(response, 200, { ok: true, ...(await status(value)) });
    return;
  }
  if (request.method === "POST" && url.pathname === `${API}/preview`) {
    const body = await readBody(request);
    const project = normalizePlotPickleProject(body.project);
    if (!project) throw new Error("The active story could not be normalized before comparing project files.");
    sendJson(response, 200, { ok: true, ...(await preview(value, project)) });
    return;
  }
  if (request.method === "POST" && url.pathname === `${API}/pull`) {
    sendJson(response, 200, { ok: true, ...(await pull(value)) });
    return;
  }
  if (request.method === "POST" && url.pathname === `${API}/publish`) {
    sendJson(response, 200, { ok: true, ...(await publish(value, await readBody(request))) });
    return;
  }
  if (request.method === "POST" && url.pathname === `${API}/release-snapshot`) {
    sendJson(response, 200, { ok: true, ...(await releaseSnapshot(value, await readBody(request))) });
    return;
  }
  sendJson(response, 404, { ok: false, message: "Canonical project synchronization operation not found." });
}

function safeError(error: unknown) {
  return (error instanceof Error ? error.message : "Canonical project synchronization failed.")
    .replace(/gh[pousr]_[A-Za-z0-9_]+/g, "[redacted]")
    .slice(0, 700);
}

export function githubProjectSyncGateway(): Plugin {
  return {
    name: "plotpickle-github-project-sync-gateway",
    apply: "serve",
    configureServer(server) {
      server.middlewares.use((request, response, next) => {
        const rawUrl = request.url;
        if (!rawUrl) { next(); return; }
        const url = new URL(rawUrl, "http://127.0.0.1");
        if (!url.pathname.startsWith(API)) { next(); return; }
        if (!isLocalRequest(request)) {
          sendJson(response, 403, { ok: false, message: "Canonical project synchronization accepts requests only from this local PlotPickle server." });
          return;
        }
        void handle(request, response, url).catch((error) => {
          const statusCode = (error as GitHubError).status === 409 ? 409 : 400;
          sendJson(response, statusCode, { ok: false, message: safeError(error) });
        });
      });
    },
  };
}
