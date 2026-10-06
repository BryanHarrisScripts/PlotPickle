import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import { copyFile, mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { promisify } from "node:util";

const exec = promisify(execFile);
const REPOSITORY = "BryanHarrisScripts/PlotPickle";
const SESSION_SCHEMA_VERSION = 1;
const MAX_ISSUE_BODY_CHARS = 45_000;

function clean(value, maximum = 4_000) {
  return typeof value === "string" ? value.trim().slice(0, maximum) : "";
}

function slug(value) {
  return clean(value, 120).toLocaleLowerCase("en-US").replace(/[^a-z0-9]+/gu, "-").replace(/^-+|-+$/gu, "") || "surface";
}

function sha256(buffer) {
  return createHash("sha256").update(buffer).digest("hex");
}

function marker(surface, hash) {
  return `plotpickle-openpencil-design:${slug(surface)}:${hash}`;
}

function stateFileName(sessionId) {
  return `${sessionId.replace(/[^a-zA-Z0-9._-]/gu, "-")}.json`;
}

function defaultStateRoot(env) {
  const local = clean(env.LOCALAPPDATA, 2_000);
  return local
    ? path.win32.join(local, "PlotPickle", "openpencil", "design-review-sessions")
    : path.join(process.cwd(), ".plotpickle", "openpencil", "design-review-sessions");
}

async function defaultRunProcess(command, args, options = {}) {
  const result = await exec(command, [...args], {
    cwd: options.cwd,
    env: options.env || process.env,
    windowsHide: true,
    timeout: options.timeout || 120_000,
    maxBuffer: 4 * 1024 * 1024,
  });
  return { stdout: String(result.stdout || ""), stderr: String(result.stderr || ""), code: 0 };
}

function dependencies(overrides = {}) {
  return {
    env: overrides.env || process.env,
    repositoryRoot: overrides.repositoryRoot || process.cwd(),
    stateRoot: overrides.stateRoot || defaultStateRoot(overrides.env || process.env),
    now: overrides.now || (() => new Date()),
    randomId: overrides.randomId || (() => globalThis.crypto?.randomUUID?.() || `session-${Date.now()}`),
    readBytes: overrides.readBytes || ((file) => readFile(file)),
    writeText: overrides.writeText || ((file, text) => writeFile(file, text, "utf8")),
    makeDirectory: overrides.makeDirectory || ((dir) => mkdir(dir, { recursive: true })),
    listDirectory: overrides.listDirectory || ((dir) => readdir(dir, { withFileTypes: true })),
    makeTempDirectory: overrides.makeTempDirectory || ((prefix) => mkdtemp(path.join(os.tmpdir(), prefix))),
    copyFile: overrides.copyFile || ((source, destination) => copyFile(source, destination)),
    removePath: overrides.removePath || ((target) => rm(target, { recursive: true, force: true })),
    runProcess: overrides.runProcess || defaultRunProcess,
  };
}

async function run(deps, command, args, options = {}) {
  return deps.runProcess(command, args, {
    cwd: options.cwd || deps.repositoryRoot,
    env: deps.env,
    timeout: options.timeout,
  });
}

async function writeSession(deps, session) {
  await deps.makeDirectory(deps.stateRoot);
  const file = path.join(deps.stateRoot, stateFileName(session.id));
  await deps.writeText(file, JSON.stringify(session, null, 2) + "\n");
  return session;
}

async function readSessionFile(deps, file) {
  const parsed = JSON.parse((await deps.readBytes(file)).toString("utf8"));
  if (!parsed || parsed.schemaVersion !== SESSION_SCHEMA_VERSION || typeof parsed.id !== "string") return null;
  return parsed;
}

async function latestSessionForSurface(deps, surface) {
  await deps.makeDirectory(deps.stateRoot);
  const entries = await deps.listDirectory(deps.stateRoot);
  const matches = [];
  for (const entry of entries) {
    if (!entry.isFile?.() || !entry.name.endsWith(".json")) continue;
    try {
      const session = await readSessionFile(deps, path.join(deps.stateRoot, entry.name));
      if (session && slug(session.surface) === slug(surface) && session.state !== "unchanged" && session.state !== "published") {
        matches.push(session);
      }
    } catch {}
  }
  return matches.sort((left, right) => String(right.openedAt).localeCompare(String(left.openedAt)))[0] || null;
}

async function loadSession(deps, sessionId, surface) {
  if (sessionId) {
    try {
      const session = await readSessionFile(deps, path.join(deps.stateRoot, stateFileName(sessionId)));
      if (session && slug(session.surface) === slug(surface)) return session;
    } catch {}
  }
  return latestSessionForSurface(deps, surface);
}

async function gitText(deps, args, cwd = deps.repositoryRoot) {
  const result = await run(deps, "git", args, { cwd });
  return result.stdout.trim();
}

async function ghText(deps, args, cwd = deps.repositoryRoot) {
  const result = await run(deps, "gh", args, { cwd });
  return result.stdout.trim();
}

function designReviewBrief(session, publication) {
  const reviewMarker = marker(session.surface, publication.afterHash);
  const body = [
    `<!-- ${reviewMarker} -->`,
    `# Developer Brief — OpenPencil design review: ${session.surface}`,
    "",
    "## Human design intent",
    "",
    `The Human intentionally opened **${session.surface}** in OpenPencil, edited the registered design artifact, saved it, and returned to PlotPickle. The saved design is now durable GitHub evidence for discussion before implementation.`,
    "",
    "## Design evidence",
    "",
    `- Surface: ${session.surface}`,
    `- OpenPencil page: ${session.page}`,
    `- Artifact: ${session.relativeFile.replaceAll("\\", "/")}`,
    `- Design-review branch: \`${publication.branch}\``,
    `- Design commit: \`${publication.commitSha}\``,
    `- Base GitHub main: \`${session.baseSha}\``,
    `- Before SHA-256: \`${session.beforeHash}\``,
    `- After SHA-256: \`${publication.afterHash}\``,
    `- Before bytes: ${session.beforeBytes}`,
    `- After bytes: ${publication.afterBytes}`,
    "",
    "## Current product authority",
    "",
    `The live PlotPickle **${session.surface}** implementation remains source authority. The OpenPencil FIG is approved design evidence, not executable application source and not merge authority.`,
    "",
    "## Observed design changes",
    "",
    "The registered OpenPencil artifact changed during this intentional design session. PlotPickle does not infer semantic UI intent from opaque FIG bytes. Review the committed design visually and use this issue conversation to describe or refine the intended product changes.",
    "",
    "## Implementation constraints",
    "",
    "- Preserve PlotPickle canonical story/product contracts and existing data ownership.",
    "- Preserve accessibility, WebMCP governance, authenticated local boundaries and current runtime behavior unless this issue explicitly changes them.",
    "- Do not silently replace Human-approved design evidence.",
    "- Do not treat this issue as authorization to merge implementation code.",
    "",
    "## Proposed implementation scope",
    "",
    `Translate the saved ${session.surface} design delta into the smallest source implementation that reproduces the approved visual/interaction intent while preserving existing canonical behavior.`,
    "",
    "## Questions / decisions for Human review",
    "",
    "- Which visual or interaction changes in the saved design are intentional requirements versus exploratory layout?",
    "- Are any current product behaviors expected to change, or is this a presentation-only implementation?",
    "",
    "## Acceptance criteria",
    "",
    "- The implementation is traceable to this exact design branch and commit.",
    "- Ambiguous visual intent is resolved in this issue before implementation.",
    "- No unrelated source or design files are included.",
    "- WebMCP / focused UAT verifies the implemented surface.",
    "- Exact-head Architecture Verification is green before merge.",
    "",
    "## Conversation-first boundary",
    "",
    "This issue is the Human/agent conversation handoff. No implementation PR was created automatically.",
  ].join("\n");
  return body.slice(0, MAX_ISSUE_BODY_CHARS);
}

async function existingIssue(deps, surface, afterHash) {
  const reviewMarker = marker(surface, afterHash);
  const shortHash = afterHash.slice(0, 12);
  const stdout = await ghText(deps, [
    "issue", "list",
    "--repo", REPOSITORY,
    "--state", "all",
    "--limit", "100",
    "--search", shortHash,
    "--json", "number,url,title,body",
  ]);
  const issues = JSON.parse(stdout || "[]");
  const match = Array.isArray(issues) ? issues.find((issue) => String(issue?.body || "").includes(reviewMarker)) : null;
  return match ? { number: Number(match.number), url: String(match.url), title: String(match.title || "") } : null;
}

async function remoteBranchSha(deps, branch) {
  const stdout = await gitText(deps, ["ls-remote", "--heads", "origin", `refs/heads/${branch}`]);
  const first = stdout.split(/\r?\n/u).find(Boolean);
  return first ? first.split(/\s+/u)[0] : "";
}

async function publishBranch(deps, session, afterHash) {
  const branch = `design/openpencil/${slug(session.surface)}-${afterHash.slice(0, 12)}`;
  const existing = await remoteBranchSha(deps, branch);
  if (existing) return { branch, commitSha: existing, reused: true };

  const tempRoot = await deps.makeTempDirectory("plotpickle-openpencil-review-");
  const worktree = path.join(tempRoot, "repo");
  let worktreeAdded = false;
  try {
    await run(deps, "git", ["worktree", "add", "--detach", worktree, session.baseSha]);
    worktreeAdded = true;
    const destination = path.join(worktree, session.repositoryDesignPath);
    await deps.makeDirectory(path.dirname(destination));
    await deps.copyFile(session.designFile, destination);
    await run(deps, "git", ["checkout", "-b", branch], { cwd: worktree });
    await run(deps, "git", ["add", "--", session.repositoryDesignPath], { cwd: worktree });
    const staged = await gitText(deps, ["diff", "--cached", "--name-only", "--", session.repositoryDesignPath], worktree);
    if (staged.replaceAll("\\", "/") !== session.repositoryDesignPath.replaceAll("\\", "/")) {
      throw new Error("OPENPENCIL_DESIGN_STAGE_SCOPE_INVALID");
    }
    await run(deps, "git", ["commit", "-m", `design(openpencil): review ${session.surface} ${afterHash.slice(0, 12)}`], { cwd: worktree });
    const commitSha = await gitText(deps, ["rev-parse", "HEAD"], worktree);
    await run(deps, "git", ["push", "--set-upstream", "origin", `HEAD:refs/heads/${branch}`], { cwd: worktree, timeout: 180_000 });
    return { branch, commitSha, reused: false };
  } finally {
    if (worktreeAdded) {
      await run(deps, "git", ["worktree", "remove", "--force", worktree]).catch(() => {});
    }
    await deps.removePath(tempRoot).catch(() => {});
  }
}

async function createIssue(deps, session, publication) {
  const duplicate = await existingIssue(deps, session.surface, publication.afterHash);
  if (duplicate) return { ...duplicate, reused: true };

  const tempRoot = await deps.makeTempDirectory("plotpickle-openpencil-issue-");
  const bodyPath = path.join(tempRoot, "issue.md");
  const title = `OpenPencil design review: ${session.surface} · ${publication.afterHash.slice(0, 12)}`;
  try {
    await deps.writeText(bodyPath, designReviewBrief(session, publication) + "\n");
    const url = await ghText(deps, [
      "issue", "create",
      "--repo", REPOSITORY,
      "--title", title,
      "--body-file", bodyPath,
    ]);
    const match = url.match(/\/issues\/(\d+)(?:\s|$)/u);
    if (!match) throw new Error("GITHUB_ISSUE_CREATE_FAILED");
    return { number: Number(match[1]), url, title, reused: false };
  } finally {
    await deps.removePath(tempRoot).catch(() => {});
  }
}

function failureMessage(error) {
  const message = error instanceof Error ? error.message : String(error);
  if (/auth|login|credential/iu.test(message)) return "Design saved locally. GitHub authentication is unavailable; retry publish after GitHub is connected.";
  if (/issue create|GITHUB_ISSUE_CREATE_FAILED/iu.test(message)) return "Design branch published, but GitHub issue creation failed. Retry publish; PlotPickle will reuse the existing design branch.";
  return "Design saved locally. GitHub review could not be created. Retry publish.";
}

export function createOpenPencilDesignReviewPublisher(overrides = {}) {
  const deps = dependencies(overrides);

  async function begin(target) {
    const bytes = await deps.readBytes(target.designFile);
    const baseSha = await gitText(deps, ["rev-parse", "origin/main"]).catch(() => gitText(deps, ["rev-parse", "HEAD"]));
    const id = deps.randomId();
    const session = {
      schemaVersion: SESSION_SCHEMA_VERSION,
      id,
      state: "editing",
      surface: target.name,
      page: target.page,
      designFile: target.designFile,
      relativeFile: target.relativeFile,
      repositoryDesignPath: ["designs", "openpencil", target.relativeFile.replaceAll("\\", "/")].join("/"),
      baseSha,
      beforeHash: sha256(bytes),
      beforeBytes: bytes.length,
      openedAt: deps.now().toISOString(),
      updatedAt: deps.now().toISOString(),
      publication: null,
      error: "",
    };
    await writeSession(deps, session);
    return Object.freeze({ id, beforeHash: session.beforeHash, baseSha });
  }

  async function finalize(surface, sessionId = "") {
    const session = await loadSession(deps, sessionId, surface);
    if (!session) return Object.freeze({ state: "missing", message: `No pending OpenPencil design session exists for ${surface}.` });

    const afterBytesBuffer = await deps.readBytes(session.designFile);
    const afterHash = sha256(afterBytesBuffer);
    if (afterHash === session.beforeHash) {
      const unchanged = { ...session, state: "unchanged", updatedAt: deps.now().toISOString(), error: "" };
      await writeSession(deps, unchanged);
      return Object.freeze({
        state: "unchanged",
        surface: session.surface,
        sessionId: session.id,
        message: `${session.surface} closed with no saved design changes.`,
      });
    }

    const inFlight = { ...session, state: "publishing", updatedAt: deps.now().toISOString(), error: "" };
    await writeSession(deps, inFlight);
    let publication = session.publication?.afterHash === afterHash && session.publication?.branch && session.publication?.commitSha
      ? {
          branch: session.publication.branch,
          commitSha: session.publication.commitSha,
          reused: true,
          afterHash,
          afterBytes: afterBytesBuffer.length,
        }
      : null;
    try {
      await ghText(deps, ["auth", "status", "--hostname", "github.com"]);
      if (!publication) {
        const branch = await publishBranch(deps, session, afterHash);
        publication = {
          ...branch,
          afterHash,
          afterBytes: afterBytesBuffer.length,
        };
        await writeSession(deps, {
          ...session,
          state: "branch-published",
          updatedAt: deps.now().toISOString(),
          error: "",
          publication,
        });
      }
      const issue = await createIssue(deps, session, publication);
      const published = {
        ...session,
        state: "published",
        updatedAt: deps.now().toISOString(),
        error: "",
        publication: { ...publication, issue },
      };
      await writeSession(deps, published);
      return Object.freeze({
        state: "published",
        surface: session.surface,
        sessionId: session.id,
        branch: publication.branch,
        commitSha: publication.commitSha,
        issueNumber: issue.number,
        issueUrl: issue.url,
        message: `${session.surface} design saved and published for review. GitHub issue #${issue.number} created.`,
      });
    } catch (error) {
      const failed = {
        ...session,
        state: "failed",
        updatedAt: deps.now().toISOString(),
        error: error instanceof Error ? error.message : String(error),
        publication: publication || session.publication || null,
      };
      await writeSession(deps, failed);
      return Object.freeze({
        state: "failed",
        surface: session.surface,
        sessionId: session.id,
        branch: publication?.branch || "",
        commitSha: publication?.commitSha || "",
        message: publication
          ? `${failureMessage(error)} Published design branch: ${publication.branch} at ${publication.commitSha}.`
          : failureMessage(error),
      });
    }
  }

  return Object.freeze({ begin, finalize });
}
