import { execFileSync } from "node:child_process";
import { existsSync, lstatSync, realpathSync } from "node:fs";
import path from "node:path";
import { assessPiDraftGrounding, assertPiDraftGrounding } from "../dsdd-integrity.mjs";

const MAX_EVIDENCE_PATHS = 32;
const MAX_EVIDENCE_CHARS = 4_000;
const MAX_BRIEF_CHARS = 12_000;
const MAX_MISSING_CHARS = 1_500;
const BARE_FILENAME = /^[A-Za-z0-9_.-]+\.(?:md|json|mjs|js|ts|tsx|css|yml|yaml)$/u;
const EXCLUDED = new Set(["from", "with", "that", "this", "into", "then", "only", "have", "should", "when", "what", "file", "files", "test", "tests", "draft", "code", "story", "human", "plotpickle"]);

function words(value) {
  return new Set(String(value || "").toLowerCase().match(/[a-z][a-z0-9]{2,}/gu)?.filter((word) => !EXCLUDED.has(word)) || []);
}

function validTrackedFile(root, raw) {
  const relative = raw.replaceAll("\\", "/");
  if (!relative || /[\x00-\x1f`]/u.test(relative) || path.posix.isAbsolute(relative)
      || path.win32.isAbsolute(relative) || relative.split("/").some((segment) => segment === ".." || segment === ".")) return "";
  const absolute = path.resolve(root, relative);
  const inside = absolute.startsWith(root + path.sep);
  if (!inside) return "";
  // Nonexistent tracked entries are excluded; unexpected filesystem errors fail closed.
  if (!existsSync(absolute) || !lstatSync(absolute).isFile()) return "";
  const realRoot = realpathSync(root);
  const realFile = realpathSync(absolute);
  if (!realFile.startsWith(realRoot + path.sep)) return "";
  return relative;
}

function trackedListingAt(root, trackedListing) {
  return trackedListing === undefined
    ? execFileSync("git", ["ls-files", "--cached", "-z", "--full-name"], {
      cwd: root, maxBuffer: 8 * 1024 * 1024,
    }).toString("utf8")
    : String(trackedListing);
}

/**
 * Canonicalize only unqualified inline-code filenames with a unique indexed,
 * present, regular-file match. Missing / ambiguous paths remain unverified.
 */
export function canonicalizePiBareFilenameClaims(markdown, repoRoot, { trackedListing } = {}) {
  const root = path.resolve(repoRoot);
  const listing = trackedListingAt(root, trackedListing);
  if (!listing) throw new Error("Pi Draft cannot establish tracked repository evidence. Repository inspection is required.");
  const tracked = [...new Set(listing.split("\0")
    .map((raw) => validTrackedFile(root, raw)).filter(Boolean))];
  if (!tracked.length) throw new Error("Pi Draft found no existing tracked files. Repository inspection is required.");
  const byName = new Map();
  for (const relative of tracked) {
    const filename = path.posix.basename(relative);
    const matches = byName.get(filename) || [];
    matches.push(relative);
    byName.set(filename, matches);
  }
  const known = new Set(tracked);
  const replacements = [];
  const ambiguous = [];
  const text = String(markdown || "").replace(/`([^`\r\n]+)`/gu, (original, raw) => {
    const filename = raw.trim();
    if (filename !== raw || !BARE_FILENAME.test(filename)) return original;
    // Root-level files are already complete paths; do not prefer a nested sibling.
    if (known.has(filename)) return original;
    const matches = byName.get(filename) || [];
    if (matches.length !== 1) {
      if (matches.length > 1) ambiguous.push(filename);
      return original;
    }
    const resolved = matches[0];
    replacements.push({ filename, path: resolved });
    return "`" + resolved + "`";
  });
  return { text, replacements, ambiguous: [...new Set(ambiguous)] };
}

// Read-only git index consultation. No worktree edits, package install or shell expansion.
export function verifiedRepoPaths(repoRoot, intentText, { trackedListing } = {}) {
  const root = path.resolve(repoRoot);
  const listing = trackedListingAt(root, trackedListing);
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
  const listing = trackedListingAt(path.resolve(repoRoot), trackedListing);
  const verifiedPaths = verifiedRepoPaths(repoRoot, intentText, { trackedListing: listing });
  const canonicalize = (output) => canonicalizePiBareFilenameClaims(output, repoRoot, { trackedListing: listing });
  const evidence = evidenceText(verifiedPaths);
  const original = `${lockedPrompt}\n\n${evidence}`;
  const firstOutput = completionText(await runDraft(original));
  if (!firstOutput) throw new Error("Pi Draft completed without producing a technical developer brief.");
  const first = canonicalize(firstOutput).text;
  const firstGrounding = assessPiDraftGrounding(first, repoRoot);
  if (firstGrounding.ok) return { text: first, grounding: firstGrounding, attempts: 1 };

  // Exactly one correction. The original locked intent is byte-for-byte unchanged.
  const invalid = firstGrounding.missing.join(", ").slice(0, MAX_MISSING_CHARS);
  const correction = [
    "ONE BOUNDED CORRECTION: the preceding response claimed nonexistent repository paths.",
    `Ungrounded paths: ${invalid}`,
    "Produce the same requested developer brief for the unchanged locked intent above.",
    "When citing an existing file, use the exact full repo-relative path from the tracked index, never only its basename.",
    "If a named file or proposed component does not exist, write Unknown / requires inspection WITHOUT a backticked filename.",
    "Do not turn a proposed new file into a claim that it already exists.",
    "Do not invent sibling files, grant authority, call cloud providers or mutate the repository.",
    "Return the complete brief, not a critique of the previous answer.",
  ].join("\n");
  const secondOutput = completionText(await runDraft(`${original}\n\n${correction}`));
  if (!secondOutput) throw new Error("Pi Draft correction returned no technical developer brief.");
  const second = canonicalize(secondOutput).text;
  const grounding = assertPiDraftGrounding(second, repoRoot); // a second invalid response fails closed
  return { text: second, grounding, attempts: 2 };
}
