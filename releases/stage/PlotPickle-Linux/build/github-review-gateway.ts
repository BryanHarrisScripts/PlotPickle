import { randomUUID } from "node:crypto";
import { mkdir, open, readFile, rename } from "node:fs/promises";
import type { IncomingMessage, ServerResponse } from "node:http";
import os from "node:os";
import path from "node:path";
import type { Plugin } from "vite";
import {
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
  type StoryProjectManifest,
} from "../lib/story-project-repository";
import {
  applyStoryProposalGroups,
  compareStoryProposalProjects,
  storyProposalDecision,
  validStoryProposalGroups,
  withStoryProposalDecision,
  type StoryProposalGroupId,
} from "../lib/story-proposals";
import { persistentHome, readCredentialJson, writeCredentialJson } from "./local-credentials";

const API = "/api/local-github";
const MAX_BODY = 30 * 1024 * 1024;
const SYNC_STATE_FILE = "github-project-sync.json";

type GitHubConnection = {
  version: 1;
  owner: string;
  repo: string;
  branch: string;
  projectPath: string;
  projectRoot?: string;
  token: string;
  verifiedAt: string;
  readiness?: { ready: boolean };
};

type ServerIdentity = {
  version: 1;
  id: string;
  label: string;
  createdAt: string;
};

type GitHubError = Error & { status?: number; body?: unknown };
type GitHubTreeItem = { path: string; mode: string; type: "blob"; sha: string; size: number };
type CommitState = { commitSha: string; treeSha: string; tree: GitHubTreeItem[] };
type CanonicalState = {
  commit: CommitState;
  storyManifest: StoryProjectManifest;
  projectRoot: string;
  contents: Record<string, string>;
  inventory: ProjectSyncInventory;
  project: PlotPickleProject;
};

type PullRequestRecord = Record<string, unknown> & {
  number?: number;
  body?: string | null;
  state?: string;
  draft?: boolean;
  merged_at?: string | null;
  title?: string;
  html_url?: string;
  updated_at?: string;
  base?: { ref?: string; sha?: string };
  head?: { ref?: string; sha?: string };
  user?: { login?: string };
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

function identityFile() { return path.join(persistentHome(), "server-identity.json"); }

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

async function readBody(request: IncomingMessage): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = [];
  let length = 0;
  for await (const chunk of request) {
    const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    length += bytes.length;
    if (length > MAX_BODY) throw new Error("The Story Proposal request is too large.");
    chunks.push(bytes);
  }
  const value = JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("The Story Proposal request is invalid.");
  return value as Record<string, unknown>;
}

async function atomicWrite(filePath: string, content: string) {
  await mkdir(path.dirname(filePath), { recursive: true, mode: 0o700 });
  const temporary = `${filePath}.${process.pid}.${Date.now()}.tmp`;
  const handle = await open(temporary, "w", 0o600);
  try {
    await handle.writeFile(content, "utf8");
    await handle.sync();
  } finally {
    await handle.close();
  }
  await rename(temporary, filePath);
}

function validConnection(value: unknown): value is GitHubConnection {
  if (!value || typeof value !== "object") return false;
  const item = value as Partial<GitHubConnection>;
  return item.version === 1 && typeof item.owner === "string" && typeof item.repo === "string"
    && typeof item.branch === "string" && typeof item.projectPath === "string"
    && typeof item.token === "string" && typeof item.verifiedAt === "string";
}

async function readConnection() {
  const value = await readCredentialJson<unknown>("github-connection.json");
  if (!validConnection(value)) throw new Error("Reconnect the GitHub repository before using Story Proposals.");
  if (!value.readiness?.ready) throw new Error("Test the GitHub connection and wait for the green Ready light before using Story Proposals.");
  return value;
}

async function serverIdentity() {
  try {
    const value: unknown = JSON.parse(await readFile(identityFile(), "utf8"));
    if (value && typeof value === "object") {
      const item = value as Partial<ServerIdentity>;
      if (item.version === 1 && typeof item.id === "string" && typeof item.label === "string" && typeof item.createdAt === "string") return item as ServerIdentity;
    }
  } catch { /* Create the durable local identity below. */ }
  const identity: ServerIdentity = {
    version: 1,
    id: randomUUID(),
    label: `${os.hostname() || "PlotPickle server"} · ${process.platform}`,
    createdAt: new Date().toISOString(),
  };
  await atomicWrite(identityFile(), `${JSON.stringify(identity, null, 2)}\n`);
  return identity;
}

function repoEndpoint(connection: GitHubConnection) {
  return `/repos/${encodeURIComponent(connection.owner)}/${encodeURIComponent(connection.repo)}`;
}

async function githubRequest(connection: GitHubConnection, endpoint: string, init: { method?: string; body?: unknown } = {}) {
  const response = await fetch(`https://api.github.com${endpoint}`, {
    method: init.method || "GET",
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${connection.token}`,
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": "PlotPickle-Story-Proposals",
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

function safePullRequest(value: unknown): PullRequestRecord {
  if (!value || typeof value !== "object") throw new Error("GitHub returned an invalid Story Proposal.");
  return value as PullRequestRecord;
}

function proposalNumber(value: unknown) {
  const number = Number(value);
  if (!Number.isInteger(number) || number <= 0) throw new Error("Choose a valid Story Proposal.");
  return number;
}

async function commitState(connection: GitHubConnection, commitSha: string): Promise<CommitState> {
  if (!commitSha) throw new Error("GitHub did not return the required story revision.");
  const commit = await githubRequest(connection, `${repoEndpoint(connection)}/git/commits/${encodeURIComponent(commitSha)}`);
  const treeSha = commit && typeof commit === "object" && (commit as { tree?: { sha?: unknown } }).tree?.sha
    ? String((commit as { tree: { sha: string } }).tree.sha)
    : "";
  if (!treeSha) throw new Error("GitHub did not return the Story Proposal tree.");
  const treeBody = await githubRequest(connection, `${repoEndpoint(connection)}/git/trees/${encodeURIComponent(treeSha)}?recursive=1`);
  if (treeBody && typeof treeBody === "object" && (treeBody as { truncated?: unknown }).truncated) {
    throw new Error("The repository tree is too large for safe Story Proposal review.");
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
      type: "blob" as const,
      sha: record.sha,
      size: Number(record.size) || 0,
    }];
  });
  return { commitSha, treeSha, tree };
}

async function approvedBranchState(connection: GitHubConnection) {
  const branchPath = connection.branch.split("/").map(encodeURIComponent).join("/");
  const ref = await githubRequest(connection, `${repoEndpoint(connection)}/git/ref/heads/${branchPath}`);
  const sha = ref && typeof ref === "object" && (ref as { object?: { sha?: unknown } }).object?.sha
    ? String((ref as { object: { sha: string } }).object.sha)
    : "";
  return commitState(connection, sha);
}

async function blobText(connection: GitHubConnection, sha: string) {
  const blob = await githubRequest(connection, `${repoEndpoint(connection)}/git/blobs/${encodeURIComponent(sha)}`);
  if (!blob || typeof blob !== "object" || typeof (blob as { content?: unknown }).content !== "string") {
    throw new Error("GitHub did not return a required Story Proposal file.");
  }
  const encoding = typeof (blob as { encoding?: unknown }).encoding === "string" ? String((blob as { encoding: string }).encoding) : "base64";
  const content = String((blob as { content: string }).content).replace(/\s/g, "");
  return encoding === "base64" ? Buffer.from(content, "base64").toString("utf8") : content;
}

async function readTreeFile(connection: GitHubConnection, state: CommitState, filePath: string) {
  const item = state.tree.find((entry) => entry.path === filePath);
  return item ? blobText(connection, item.sha) : null;
}

async function canonicalState(connection: GitHubConnection, state: CommitState): Promise<CanonicalState> {
  const storyManifestText = await readTreeFile(connection, state, STORY_PROJECT_MANIFEST_PATH);
  if (!storyManifestText) throw new Error("The Story Proposal repository is missing plotpickle-project.json.");
  let source: unknown;
  try { source = JSON.parse(storyManifestText); } catch { throw new Error("The Story Proposal repository manifest is not valid JSON."); }
  const inspected = inspectStoryProjectManifest(source);
  const projectRoot = inspected.manifest.canonicalProject.root;
  const prefix = `${projectRoot}/`;
  const contents: Record<string, string> = {};
  for (const item of state.tree.filter((entry) => entry.path.startsWith(prefix))) {
    contents[item.path] = await blobText(connection, item.sha);
  }
  const inventory = inventoryFromContents(contents, projectRoot);
  if (!inventory.manifestSha256) throw new Error("The Story Proposal does not contain a canonical PlotPickle project folder.");
  const project = parseProjectSyncContents(contents, projectRoot);
  if (project.id !== inspected.manifest.projectId) throw new Error("The Story Proposal project ID does not match its repository manifest.");
  return { commit: state, storyManifest: inspected.manifest, projectRoot, contents, inventory, project };
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

async function createBlob(connection: GitHubConnection, content: string) {
  const result = await githubRequest(connection, `${repoEndpoint(connection)}/git/blobs`, {
    method: "POST",
    body: { content: Buffer.from(content, "utf8").toString("base64"), encoding: "base64" },
  });
  const sha = result && typeof result === "object" && typeof (result as { sha?: unknown }).sha === "string" ? String((result as { sha: string }).sha) : "";
  if (!sha) throw new Error("GitHub did not return a Story Proposal file revision.");
  return sha;
}

async function treeEntries(
  connection: GitHubConnection,
  diff: ReturnType<typeof diffProjectSyncInventories>,
  projectRoot: string,
) {
  const entries: Array<{ path: string; mode: "100644"; type: "blob"; sha: string | null }> = [];
  for (const file of [...diff.create, ...diff.update]) {
    entries.push({ path: file.path, mode: "100644", type: "blob", sha: await createBlob(connection, file.content) });
  }
  for (const file of diff.delete) {
    if (!safeManagedDeletionPath(file.path, projectRoot)) throw new Error(`PlotPickle refused to delete unmanaged repository path ${file.path}.`);
    entries.push({ path: file.path, mode: "100644", type: "blob", sha: null });
  }
  return entries;
}

async function createCommit(
  connection: GitHubConnection,
  base: CommitState,
  entries: Array<{ path: string; mode: "100644"; type: "blob"; sha: string | null }>,
  message: string,
) {
  if (!entries.length) throw new Error("The Story Proposal contains no changed canonical project files.");
  const tree = await githubRequest(connection, `${repoEndpoint(connection)}/git/trees`, {
    method: "POST",
    body: { base_tree: base.treeSha, tree: entries },
  });
  const treeSha = tree && typeof tree === "object" && typeof (tree as { sha?: unknown }).sha === "string" ? String((tree as { sha: string }).sha) : "";
  if (!treeSha) throw new Error("GitHub did not create the Story Proposal tree.");
  const commit = await githubRequest(connection, `${repoEndpoint(connection)}/git/commits`, {
    method: "POST",
    body: { message, tree: treeSha, parents: [base.commitSha] },
  });
  const commitSha = commit && typeof commit === "object" && typeof (commit as { sha?: unknown }).sha === "string" ? String((commit as { sha: string }).sha) : "";
  if (!commitSha) throw new Error("GitHub did not create the Story Proposal commit.");
  return commitSha;
}

async function createBranch(connection: GitHubConnection, branchName: string, commitSha: string) {
  await githubRequest(connection, `${repoEndpoint(connection)}/git/refs`, {
    method: "POST",
    body: { ref: `refs/heads/${branchName}`, sha: commitSha },
  });
}

async function updateApprovedBranch(connection: GitHubConnection, commitSha: string) {
  const branchPath = connection.branch.split("/").map(encodeURIComponent).join("/");
  await githubRequest(connection, `${repoEndpoint(connection)}/git/refs/heads/${branchPath}`, {
    method: "PATCH",
    body: { sha: commitSha, force: false },
  });
}

function safeSlug(value: string, fallback = "story") {
  return value.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 55) || fallback;
}

function proposalBody(
  project: PlotPickleProject,
  identity: ServerIdentity,
  baseCommit: string,
  groups: ReturnType<typeof compareStoryProposalProjects>,
  changedPaths: string[],
  note: string,
) {
  return [
    "## PlotPickle Story Proposal",
    "",
    `**Project:** ${project.metadata.title}`,
    `**Contributor workspace:** ${identity.label}`,
    `**Workspace ID:** \`${identity.id}\``,
    `**Approved base commit:** \`${baseCommit}\``,
    `**Canonical project root:** \`project/\``,
    `**Changed canonical files:** ${changedPaths.length}`,
    "",
    "### Semantic change groups",
    "",
    ...groups.map((group) => `- **${group.label}:** ${group.summary}`),
    "",
    note.trim() ? `### Contributor note\n\n${note.trim()}` : "",
    "",
    "### Approval boundary",
    "",
    "This Story Proposal changes only its proposal branch. The approved branch remains unchanged until the Project Lead selects semantic groups and approves them in PlotPickle. Unselected groups are excluded from the approved result.",
    "",
    "No API key, access token, refresh token or private credential is stored in the project files or this proposal.",
    "",
    "<!-- plotpickle-decision: open -->",
    `<!-- plotpickle-base: ${baseCommit} -->`,
  ].filter(Boolean).join("\n");
}

async function writeSyncState(connection: GitHubConnection, project: PlotPickleProject, inventory: ProjectSyncInventory, remoteCommit: string) {
  const state: SavedSyncState = {
    version: 1,
    repository: `${connection.owner}/${connection.repo}`,
    branch: connection.branch,
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

async function createProposal(connection: GitHubConnection, project: PlotPickleProject, title: string, note: string, expectedBaseRevision: string) {
  const identity = await serverIdentity();
  const baseCommit = await approvedBranchState(connection);
  if (!expectedBaseRevision || expectedBaseRevision !== baseCommit.commitSha) {
    const error = new Error("The approved story changed after this workspace last refreshed it. Refresh the approved version, review the differences and create a new Story Proposal.") as GitHubError;
    error.status = 409;
    throw error;
  }
  const approved = await canonicalState(connection, baseCommit);
  if (approved.project.id !== project.id) throw new Error("The active story belongs to a different PlotPickle project ID.");
  const proposedInventory = createProjectSyncInventory(project, approved.projectRoot);
  const diff = diffProjectSyncInventories(proposedInventory, approved.inventory);
  if (!diff.changedCount) throw new Error("The active story matches the approved project. There is nothing to propose.");
  const changedPaths = diffSummary(diff).changedPaths;
  const groups = compareStoryProposalProjects(approved.project, project, changedPaths);
  const entries = await treeEntries(connection, diff, approved.projectRoot);
  const message = title.trim() || `Story Proposal: ${project.metadata.title}`;
  const commitSha = await createCommit(connection, approved.commit, entries, message);

  const profile = await githubRequest(connection, "/user");
  const login = profile && typeof profile === "object" && typeof (profile as Record<string, unknown>).login === "string" ? String((profile as Record<string, unknown>).login) : "collaborator";
  const stamp = new Date().toISOString().replace(/[-:.TZ]/g, "").slice(0, 14);
  const branchName = `plotpickle/proposal/${safeSlug(login, "writer")}-${identity.id.slice(0, 8)}/${stamp}-${safeSlug(project.metadata.title)}-${randomUUID().slice(0, 6)}`;
  await createBranch(connection, branchName, commitSha);

  const pull = await githubRequest(connection, `${repoEndpoint(connection)}/pulls`, {
    method: "POST",
    body: {
      title: title.trim() || `Story Proposal: ${project.metadata.title}`,
      head: branchName,
      base: connection.branch,
      body: proposalBody(project, identity, approved.commit.commitSha, groups, changedPaths, note),
      maintainer_can_modify: true,
    },
  });
  const record = safePullRequest(pull);
  return {
    branchName,
    commitSha,
    pullRequestNumber: Number(record.number) || 0,
    pullRequestUrl: typeof record.html_url === "string" ? record.html_url : "",
    baseRevision: approved.commit.commitSha,
    serverId: identity.id,
    serverLabel: identity.label,
    groups,
    diff: diffSummary(diff),
  };
}

function proposalListItem(value: PullRequestRecord) {
  const head = value.head && typeof value.head === "object" ? value.head : {};
  const user = value.user && typeof value.user === "object" ? value.user : {};
  const branchName = typeof head.ref === "string" ? head.ref : "";
  if (!branchName.startsWith("plotpickle/proposal/") && !branchName.startsWith("plotpickle/")) return null;
  const body = typeof value.body === "string" ? value.body : "";
  const decision = storyProposalDecision(body);
  const state = value.merged_at
    ? "merged"
    : decision === "approved"
      ? "approved"
      : decision === "declined" || value.state === "closed"
        ? "declined"
        : value.draft
          ? "draft"
          : "open";
  return {
    number: Number(value.number) || 0,
    title: typeof value.title === "string" ? value.title : "Story Proposal",
    url: typeof value.html_url === "string" ? value.html_url : "",
    state,
    author: typeof user.login === "string" ? user.login : "unknown",
    branchName,
    updatedAt: typeof value.updated_at === "string" ? value.updated_at : "",
    mergedAt: typeof value.merged_at === "string" ? value.merged_at : "",
  };
}

async function listProposals(connection: GitHubConnection) {
  const body = await githubRequest(connection, `${repoEndpoint(connection)}/pulls?state=all&base=${encodeURIComponent(connection.branch)}&sort=updated&direction=desc&per_page=100`);
  return (Array.isArray(body) ? body : []).flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const proposal = proposalListItem(item as PullRequestRecord);
    return proposal ? [proposal] : [];
  });
}

async function pullRequest(connection: GitHubConnection, number: number) {
  return safePullRequest(await githubRequest(connection, `${repoEndpoint(connection)}/pulls/${number}`));
}

function pullCommit(value: PullRequestRecord, side: "base" | "head") {
  const record = value[side];
  const sha = record && typeof record === "object" && typeof record.sha === "string" ? record.sha : "";
  if (!sha) throw new Error(`GitHub did not return the Story Proposal ${side} revision.`);
  return sha;
}

async function proposalReview(connection: GitHubConnection, number: number) {
  const pull = await pullRequest(connection, number);
  const base = await canonicalState(connection, await commitState(connection, pullCommit(pull, "base")));
  const proposed = await canonicalState(connection, await commitState(connection, pullCommit(pull, "head")));
  if (base.project.id !== proposed.project.id) throw new Error("The Story Proposal belongs to a different PlotPickle project.");
  const diff = diffProjectSyncInventories(proposed.inventory, base.inventory);
  const groups = compareStoryProposalProjects(base.project, proposed.project, diffSummary(diff).changedPaths);
  return {
    proposal: proposalListItem(pull),
    baseCommit: base.commit.commitSha,
    headCommit: proposed.commit.commitSha,
    projectRoot: base.projectRoot,
    groups,
    diff: diffSummary(diff),
  };
}

async function commentOnProposal(connection: GitHubConnection, number: number, body: string) {
  await githubRequest(connection, `${repoEndpoint(connection)}/issues/${number}/comments`, { method: "POST", body: { body } });
}

async function closeProposal(connection: GitHubConnection, pull: PullRequestRecord, decision: "approved" | "declined") {
  const number = proposalNumber(pull.number);
  const body = withStoryProposalDecision(typeof pull.body === "string" ? pull.body : "", decision);
  await githubRequest(connection, `${repoEndpoint(connection)}/pulls/${number}`, {
    method: "PATCH",
    body: { body, state: "closed" },
  });
}

async function approveProposal(connection: GitHubConnection, input: Record<string, unknown>) {
  const number = proposalNumber(input.number);
  const selectedGroups = validStoryProposalGroups(input.selectedGroups);
  if (!selectedGroups.length) throw new Error("Choose at least one semantic change group to approve.");
  const expectedBaseCommit = typeof input.expectedBaseCommit === "string" ? input.expectedBaseCommit : "";
  const pull = await pullRequest(connection, number);
  if (pull.state === "closed") throw new Error("This Story Proposal is already closed.");
  const current = await approvedBranchState(connection);
  const pullBaseCommit = pullCommit(pull, "base");
  if (!expectedBaseCommit || current.commitSha !== expectedBaseCommit || pullBaseCommit !== expectedBaseCommit) {
    const error = new Error("The approved branch changed after Story Proposal review began. Refresh the approved version and review the proposal again before approving it.") as GitHubError;
    error.status = 409;
    throw error;
  }
  const approved = await canonicalState(connection, current);
  const proposed = await canonicalState(connection, await commitState(connection, pullCommit(pull, "head")));
  const proposalDiff = diffProjectSyncInventories(proposed.inventory, approved.inventory);
  const groups = compareStoryProposalProjects(approved.project, proposed.project, diffSummary(proposalDiff).changedPaths);
  const changedGroupIds = new Set(groups.map((group) => group.id));
  const accepted = selectedGroups.filter((group) => changedGroupIds.has(group));
  if (!accepted.length) throw new Error("The selected semantic groups do not contain any proposal changes.");

  const resultProject = applyStoryProposalGroups(approved.project, proposed.project, accepted);
  const resultInventory = createProjectSyncInventory(resultProject, approved.projectRoot);
  const acceptedDiff = diffProjectSyncInventories(resultInventory, approved.inventory);
  const entries = await treeEntries(connection, acceptedDiff, approved.projectRoot);
  const message = `Approve Story Proposal #${number}: ${accepted.join(", ")}`;
  const commitSha = await createCommit(connection, approved.commit, entries, message);
  await updateApprovedBranch(connection, commitSha);
  await closeProposal(connection, pull, "approved");
  const rejected = groups.map((group) => group.id).filter((group) => !accepted.includes(group));
  await commentOnProposal(connection, number, [
    "## PlotPickle Project Lead decision",
    "",
    `Approved semantic groups: ${accepted.join(", ")}.`,
    rejected.length ? `Not applied: ${rejected.join(", ")}.` : "All proposed semantic groups were applied.",
    `Approved commit: \`${commitSha}\`.`,
  ].join("\n"));
  const syncState = await writeSyncState(connection, resultProject, resultInventory, commitSha);
  return {
    proposalNumber: number,
    project: resultProject,
    remoteCommit: commitSha,
    previousRemoteCommit: approved.commit.commitSha,
    selectedGroups: accepted,
    rejectedGroups: rejected,
    diff: diffSummary(acceptedDiff),
    inventory: resultInventory,
    syncState,
  };
}

async function declineProposal(connection: GitHubConnection, input: Record<string, unknown>) {
  const number = proposalNumber(input.number);
  const pull = await pullRequest(connection, number);
  if (pull.state === "closed") throw new Error("This Story Proposal is already closed.");
  const note = typeof input.note === "string" && input.note.trim() ? input.note.trim() : "The Project Lead declined this Story Proposal.";
  await closeProposal(connection, pull, "declined");
  await commentOnProposal(connection, number, `## PlotPickle Project Lead decision\n\n${note}`);
  return { proposalNumber: number, declined: true };
}

async function refreshApproved(connection: GitHubConnection) {
  const state = await canonicalState(connection, await approvedBranchState(connection));
  const syncState = await writeSyncState(connection, state.project, state.inventory, state.commit.commitSha);
  return {
    project: state.project,
    remoteCommit: state.commit.commitSha,
    projectRoot: state.projectRoot,
    inventory: state.inventory,
    syncState,
  };
}

async function handle(request: IncomingMessage, response: ServerResponse, url: URL) {
  if (request.method === "GET" && url.pathname === `${API}/identity`) {
    sendJson(response, 200, { ok: true, ...(await serverIdentity()) });
    return;
  }
  const connection = await readConnection();
  if (request.method === "GET" && url.pathname === `${API}/proposals`) {
    sendJson(response, 200, { ok: true, proposals: await listProposals(connection) });
    return;
  }
  if (request.method === "GET" && url.pathname === `${API}/proposal-review`) {
    sendJson(response, 200, { ok: true, ...(await proposalReview(connection, proposalNumber(url.searchParams.get("number")))) });
    return;
  }
  if (request.method === "POST" && url.pathname === `${API}/submit-proposal`) {
    const body = await readBody(request);
    const project = normalizePlotPickleProject(body.project);
    if (!project) throw new Error("The active story could not be normalized before creating the Story Proposal.");
    const title = typeof body.title === "string" ? body.title : "";
    const note = typeof body.note === "string" ? body.note : "";
    const baseRevision = typeof body.baseRevision === "string" ? body.baseRevision : "";
    sendJson(response, 200, { ok: true, ...(await createProposal(connection, project, title, note, baseRevision)) });
    return;
  }
  if (request.method === "POST" && url.pathname === `${API}/approve-proposal`) {
    sendJson(response, 200, { ok: true, ...(await approveProposal(connection, await readBody(request))) });
    return;
  }
  if (request.method === "POST" && url.pathname === `${API}/decline-proposal`) {
    sendJson(response, 200, { ok: true, ...(await declineProposal(connection, await readBody(request))) });
    return;
  }
  if (request.method === "POST" && url.pathname === `${API}/refresh-approved`) {
    sendJson(response, 200, { ok: true, ...(await refreshApproved(connection)) });
    return;
  }
  sendJson(response, 404, { ok: false, message: "Story Proposal operation not found." });
}

export function githubReviewGateway(): Plugin {
  return {
    name: "plotpickle-github-review-gateway",
    apply: "serve",
    configureServer(server) {
      server.middlewares.use((request, response, next) => {
        const rawUrl = request.url;
        if (!rawUrl) { next(); return; }
        const url = new URL(rawUrl, "http://127.0.0.1");
        const paths = [
          `${API}/identity`,
          `${API}/proposals`,
          `${API}/proposal-review`,
          `${API}/submit-proposal`,
          `${API}/approve-proposal`,
          `${API}/decline-proposal`,
          `${API}/refresh-approved`,
        ];
        if (!paths.includes(url.pathname)) { next(); return; }
        if (!isLocalRequest(request)) {
          sendJson(response, 403, { ok: false, message: "Story Proposals accept requests only from this local PlotPickle server." });
          return;
        }
        void handle(request, response, url).catch((error) => {
          const rawMessage = error instanceof Error ? error.message : "The Story Proposal operation failed.";
          const message = rawMessage.replace(/gh[pousr]_[A-Za-z0-9_]+/g, "[redacted]");
          const status = (error as GitHubError).status === 409 ? 409 : 400;
          sendJson(response, status, { ok: false, message });
        });
      });
    },
  };
}
