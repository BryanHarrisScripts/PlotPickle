import { existsSync } from "node:fs";
import path from "node:path";

const BOUNDED_MARKER = "[DSDD interpretation bounded for session persistence.]";

const STOP_WORDS = new Set([
  "a","about","actually","again","all","also","am","an","and","are","as","at","be","because","been","before","but","by",
  "can","could","did","do","does","doing","for","from","go","going","had","has","have","here","how","i","if","in","into",
  "is","it","its","just","like","me","my","no","not","of","on","or","our","please","really","said","say","should","so",
  "some","that","the","their","them","then","there","these","they","thing","this","to","up","us","was","we","were","what",
  "when","where","which","who","will","with","would","yeah","yes","you","your"
]);

const NO_ACTION_HUMAN = /\b(?:not a problem|no problem|working as expected|nothing to change|no change needed)\b/iu;
const NO_ACTION_INTERPRETATION = /\b(?:not a problem|no (?:development )?(?:action|change) (?:is )?required|no development action is required)\b/iu;

function normalizedWords(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/gu, " ")
    .trim()
    .split(/\s+/u)
    .filter((word) => word.length >= 3 && !STOP_WORDS.has(word));
}

function repeatedWindow(value, size = 5) {
  const words = normalizedWords(value);
  if (words.length < size * 2) return false;
  const counts = new Map();
  for (let index = 0; index <= words.length - size; index += 1) {
    const key = words.slice(index, index + size).join(" ");
    const count = (counts.get(key) || 0) + 1;
    if (count >= 3) return true;
    counts.set(key, count);
  }
  return false;
}

function repeatedSentence(value) {
  const segments = String(value || "")
    .split(/[.!?\n]+/u)
    .map((segment) => normalizedWords(segment).join(" "))
    .filter((segment) => segment.split(" ").length >= 4);
  const counts = new Map();
  for (const segment of segments) {
    const count = (counts.get(segment) || 0) + 1;
    if (count >= 3) return true;
    counts.set(segment, count);
  }
  return false;
}

export function assessDsddInterpretation({ humanStatement, interpretation }) {
  const human = String(humanStatement || "").trim();
  const meaning = String(interpretation || "").trim();
  if (!human || !meaning) {
    return { ok: false, code: "missing-content", message: "DSDD needs both Human narration and an interpretation before intent can be locked." };
  }
  if (meaning.includes(BOUNDED_MARKER)) {
    return { ok: false, code: "bounded-output", message: "DSDD interpretation was truncated and cannot be locked. Interpret the Human intent again." };
  }
  if (repeatedSentence(meaning) || repeatedWindow(meaning)) {
    return { ok: false, code: "pathological-repetition", message: "DSDD interpretation repeated itself and cannot be locked. Interpret the Human intent again." };
  }

  const humanNoAction = NO_ACTION_HUMAN.test(human);
  const meaningNoAction = NO_ACTION_INTERPRETATION.test(meaning);
  if (meaningNoAction) {
    return humanNoAction
      ? { ok: true, code: "valid-no-action", message: "Explicit no-action observation is consistent with the Human narration." }
      : { ok: false, code: "unjustified-no-action", message: "DSDD concluded that no action is required, but the Human narration did not. Interpret the Human intent again." };
  }

  const humanTerms = [...new Set(normalizedWords(human))];
  const meaningTerms = new Set(normalizedWords(meaning));
  const shared = humanTerms.filter((term) => meaningTerms.has(term));
  const minimumShared = humanTerms.length <= 4 ? 1 : 2;
  if (shared.length < minimumShared) {
    return {
      ok: false,
      code: "weak-correspondence",
      message: "DSDD interpretation does not retain enough of the Human narration to lock safely. Interpret or correct the intent again.",
      sharedTerms: shared,
    };
  }

  return { ok: true, code: "valid", message: "Interpretation passed the bounded DSDD integrity check.", sharedTerms: shared.slice(0, 12) };
}

export function assertDsddInterpretationIntegrity(input) {
  const result = assessDsddInterpretation(input);
  if (!result.ok) {
    const error = new Error(result.message);
    error.code = result.code;
    throw error;
  }
  return result;
}

const PATH_PREFIXES = [
  "app/","build/","config/","core/","docs/","learn/","lib/","modules/","scripts/","tests/","schema/",".github/",".agents/"
];

function candidatePath(value) {
  const normalized = String(value || "").trim().replaceAll("\\", "/");
  if (!normalized || normalized.includes("\n") || normalized.startsWith("http://") || normalized.startsWith("https://")) return "";
  if (PATH_PREFIXES.some((prefix) => normalized.startsWith(prefix))) return normalized;
  if (/^[A-Za-z0-9_.-]+\.(?:md|json|mjs|js|ts|tsx|css|yml|yaml)$/u.test(normalized)) return normalized;
  if (/^[A-Za-z0-9_.@/-]+\.(?:md|json|mjs|js|ts|tsx|css|yml|yaml)$/u.test(normalized) && normalized.includes("/")) return normalized;
  return "";
}

export function extractPiRepositoryPathClaims(markdown) {
  const claims = [];
  for (const match of String(markdown || "").matchAll(/`([^`]+)`/gu)) {
    const candidate = candidatePath(match[1]);
    if (candidate) claims.push(candidate);
  }
  return [...new Set(claims)];
}

export function assessPiDraftGrounding(markdown, repoRoot) {
  const root = path.resolve(repoRoot);
  const claims = extractPiRepositoryPathClaims(markdown);
  const missing = [];
  const grounded = [];

  for (const claim of claims) {
    const resolved = path.resolve(root, claim);
    const insideRoot = resolved === root || resolved.startsWith(root + path.sep);
    if (!insideRoot || !existsSync(resolved)) missing.push(claim);
    else grounded.push(claim);
  }

  return {
    ok: missing.length === 0,
    grounded,
    missing,
    message: missing.length
      ? `Pi Draft named repository paths that were not found: ${missing.join(", ")}. Use verified paths or mark the location as unknown.`
      : "Pi Draft repository path claims are grounded in the current checkout.",
  };
}

export function assertPiDraftGrounding(markdown, repoRoot) {
  const result = assessPiDraftGrounding(markdown, repoRoot);
  if (!result.ok) {
    const error = new Error(result.message);
    error.code = "ungrounded-pi-draft";
    throw error;
  }
  return result;
}
