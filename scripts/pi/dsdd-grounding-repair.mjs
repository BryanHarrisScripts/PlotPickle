import { execFileSync } from "node:child_process";
import { lstatSync } from "node:fs";
import path from "node:path";
import { assessPiDraftGrounding, assertPiDraftGrounding } from "../dsdd-integrity.mjs";

const MAX_EVIDENCE_PATHS = 32;
const MAX_EVIDENCE_CHARS = 4_000;
const MAX_BRIEF_CHARS = 12_000;
const MAX_MISSING_CHARS = 1_500;
const EXCLUDED = new Set(["from", "with", "that", "this", "into", "then", "only", "have", "should", "when", "what", "file", "files", "test", "tests", "draft", "code", "story", "human", "plotpickle"]);

function words(value) {
  return new Set(String(value || "").toLowerCase().match(/[a-z][a-z0-9]{2,}/gu)?.filter((word) => !EXCLUDED.has(word)) || []);
}

function validTrackedFile(root, raw) {
  const relative = raw.replaceAll("\\", "/");
  if (!relative || /[\x00-\x1f`]/u.test(relative) || path.posix.isAbsolute(relative)) return "";
  const absolute = path.resolve(root, relative);
  const inside = absolute.startsWith(root + path.sep);
  if (!inside) return "";
  try {
    if (!lstatSync(absolute).isFile()) return ""; // deleted tracked files, symlinks and directories are not evidence
  } catch {
    return "";
  }
  return relative;
}

// Read-only git index consultation. No worktree edits, package install or shell expansion.
export function verifiedRepoPaths(repoRoot, intentText, { trackedListing } = {}) {
  const root = path.resolve(repoRoot);
  const listing = trackedListing === undefined
    ? execFileSync("git", ["ls-files", "--cached", "-z", "--full-name"], { cwd: root, maxBuffer: 8 * 1024 * 1024 }).toString("utf8")
    : String(trackedListing);
  if (!listing) throw new Error("Pi Draft cannot establish tracked repository evidence. Repository inspection is required.");
  const targets = words(intentText);
  const candidates = [...new Set(listing.split("\0").map((raw) => validTrackedFile(root, raw)).filter(Boolean))];
  if (!candidates.length) throw new Error("Pi Draft found no existing tracked files. Repository inspection is required.");
  const scored = candidates.map((name) => {
    const parts = words(name.replaceAll(/[\/_.-]/gu, " "));
    const overlap = [...parts].filter((part) => targets.has(part)).length;
    const anchor = name === "AGENTS.md" ? 1 : 0;
    return { name, rank: overlap * 10 + anchor };
  }).sort((a, b) => b.rank - a.rank || a.name.localeCompare(b.name, "en"));
  const evidence = [];
  let size = 0;
  for (const { name, rank } of scored) {
    if (rank === 0 && evidence.length >= 8) break;
    if (evidence.length >= MAX_EVIDENCE_PATHS || size + name.length + 3 > MAX_EVIDENCE_CHARS) break;
    evidence.push(name);
    size += name.length + 3;
  }
  if (!evidence.length) throw new Error("Pi Draft has no bounded verified repository paths.");
  return evidence;
}

function completionText(value) {
  return String(value?.stdout || "").trim().slice(0, MAX_BRIEF_CHARS);
}

function evidenceText(paths) {
  return [
    "READ-ONLY VERIFIED REPOSITORY EVIDENCE (tracked and present at invocation):",
    ...paths.map((name) => `- \`${name}\``),
    "You may inspect additional paths with read/grep/find/ls, but never claim an uninspected path exists.",
    "If any desired path cannot be verified, say Unknown / requires inspection.",
  ].join("\n");
}

export async function draftWithVerifiedGrounding({ lockedPrompt, intentText, repoRoot, runDraft, trackedListing }) {
  if (typeof runDraft !== "function") throw new TypeError("Pi Draft requires a local read-only runner.");
  const verifiedPaths = verifiedRepoPaths(repoRoot, intentText, { trackedListing });
  const evidence = evidenceText(verifiedPaths);
  const original = `${lockedPrompt}\n\n${evidence}`;
  const first = completionText(await runDraft(original));
  if (!first) throw new Error("Pi Draft completed without producing a technical developer brief.");
  const firstGrounding = assessPiDraftGrounding(first, repoRoot);
  if (firstGrounding.ok) return { text: first, grounding: firstGrounding, attempts: 1 };

  // Exactly one correction. The original locked intent is byte-for-byte unchanged.
  const invalid = firstGrounding.missing.join(", ").slice(0, MAX_MISSING_CHARS);
  const correction = [
    "ONE BOUNDED CORRECTION: the preceding response claimed nonexistent repository paths.",
    `Ungrounded paths: ${invalid}`,
    "Produce the same requested developer brief for the unchanged locked intent above.",
    "Use verified existing paths only; otherwise write Unknown / requires inspection.",
    "Do not invent sibling files, grant authority, call cloud providers or mutate the repository.",
    "Return the complete brief, not a critique of the previous answer.",
  ].join("\n");
  const second = completionText(await runDraft(`${original}\n\n${correction}`));
  if (!second) throw new Error("Pi Draft correction returned no technical developer brief.");
  const grounding = assertPiDraftGrounding(second, repoRoot); // a second invalid response fails closed
  return { text: second, grounding, attempts: 2 };
}
