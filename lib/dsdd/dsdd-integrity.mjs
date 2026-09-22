import { stat } from "node:fs/promises";
import path from "node:path";

const NO_ACTION_CLAIM = /\b(?:not a problem|no problem|no (?:development )?(?:action|change) (?:is )?required|leave (?:it|this) as is|working as expected)\b/iu;
const HUMAN_NO_ACTION_SIGNAL = /\b(?:not a problem|no problem|no (?:change|action)|leave (?:it|this) as is|working (?:fine|correctly|as expected)|keep (?:it|this) as is|this is fine)\b/iu;
const SPECULATIVE_TECHNICAL_CLAIM = /\b(?:if a function exists|there might be|might be a|e\.g\.,?\s*(?:a|the)?\s*(?:file|function)|or similar functions?)\b/iu;
const PATH_CODE_SPAN = /`([A-Za-z0-9_.@/-]+\.[A-Za-z0-9]+)`/gu;
const WORD = /[a-z0-9][a-z0-9_-]{2,}/giu;
const STOP = new Set([
  "the","and","that","this","with","from","into","when","what","your","have","has","was","were","will","would","should","could",
  "about","then","than","they","them","their","there","here","just","also","only","first","thing","going","ahead","say","it's","its",
  "for","are","but","not","you","i'm","i've","our","out","all","can","did","does","do","of","to","in","on","is","it","a","an","as",
]);

function cleanWords(value) {
  return String(value || "").toLowerCase().match(WORD)?.filter((word) => !STOP.has(word)) || [];
}

function normalizedUnits(value) {
  return String(value || "")
    .split(/(?:\r?\n)+|(?<=[.!?])\s+/u)
    .map((unit) => unit.toLowerCase().replace(/[^a-z0-9' ]+/gu, " ").replace(/\s+/gu, " ").trim())
    .filter((unit) => unit.length >= 12);
}

function repetitionFinding(value) {
  const units = normalizedUnits(value);
  if (!units.length) return null;
  const counts = new Map();
  for (const unit of units) counts.set(unit, (counts.get(unit) || 0) + 1);
  const largest = Math.max(...counts.values());
  if (largest >= 3 || (largest >= 2 && largest / units.length >= 0.5)) {
    return "The DSDD interpretation repeated the same sentence or phrase too many times.";
  }

  const lowered = String(value || "").toLowerCase().replace(/[^a-z0-9' ]+/gu, " ").replace(/\s+/gu, " ");
  const words = lowered.trim().split(" ").filter(Boolean);
  if (words.length >= 12) {
    const sequences = new Map();
    for (let index = 0; index <= words.length - 5; index += 1) {
      const sequence = words.slice(index, index + 5).join(" ");
      sequences.set(sequence, (sequences.get(sequence) || 0) + 1);
    }
    if ([...sequences.values()].some((count) => count >= 3)) {
      return "The DSDD interpretation contains pathological phrase repetition.";
    }
  }
  return null;
}

export function interpretationIntegrity(humanStatement, interpretation) {
  const human = String(humanStatement || "").trim();
  const meaning = String(interpretation || "").trim();
  if (!human) return { ok: false, message: "DSDD cannot validate an interpretation without the Human narration." };
  if (meaning.length < 20) return { ok: false, message: "The DSDD interpretation is too short to lock as development intent." };

  const repetition = repetitionFinding(meaning);
  if (repetition) return { ok: false, message: repetition };

  if (NO_ACTION_CLAIM.test(meaning) && !HUMAN_NO_ACTION_SIGNAL.test(human)) {
    return {
      ok: false,
      message: "DSDD interpreted this as no problem/no action, but the Human narration does not support that conclusion. Re-run Interpret before Pi Draft.",
    };
  }

  const humanWords = new Set(cleanWords(human));
  const meaningWords = new Set(cleanWords(meaning));
  if (humanWords.size >= 3 && meaningWords.size >= 3) {
    const overlap = [...meaningWords].filter((word) => humanWords.has(word));
    if (!overlap.length) {
      return {
        ok: false,
        message: "The DSDD interpretation lost the subject of the Human narration. Re-run Interpret before Pi Draft.",
      };
    }
  }

  return { ok: true, message: "" };
}

export function assertInterpretationIntegrity(humanStatement, interpretation) {
  const result = interpretationIntegrity(humanStatement, interpretation);
  if (!result.ok) throw new Error(result.message);
}

export function requirementTextsFromInterpretation(interpretation) {
  const lines = String(interpretation || "").split(/\r?\n/u).map((line) => line.trim()).filter(Boolean);
  const bullets = lines
    .filter((line) => /^[-*]\s+\S/u.test(line))
    .map((line) => line.replace(/^[-*]\s+/u, "").trim());
  const candidates = bullets.length
    ? bullets
    : normalizedUnits(interpretation).map((unit) => unit.replace(/^\w/u, (character) => character.toUpperCase()));
  const unique = [];
  const seen = new Set();
  for (const candidate of candidates) {
    const key = candidate.toLowerCase().replace(/\s+/gu, " ").trim();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    unique.push(candidate.slice(0, 1200));
    if (unique.length === 8) break;
  }
  return unique.length ? unique : [String(interpretation || "").trim().slice(0, 1200)];
}

function candidatePaths(draft) {
  const values = [];
  for (const match of String(draft || "").matchAll(PATH_CODE_SPAN)) {
    const candidate = match[1].replaceAll("\\", "/");
    if (candidate.includes("*") || candidate.startsWith("http")) continue;
    values.push(candidate);
  }
  return [...new Set(values)];
}

async function repositoryPathExists(root, candidate) {
  const resolvedRoot = path.resolve(root);
  const resolved = path.resolve(resolvedRoot, candidate);
  const relative = path.relative(resolvedRoot, resolved);
  if (!relative || relative.startsWith("..") || path.isAbsolute(relative)) return false;
  try {
    await stat(resolved);
    return true;
  } catch {
    return false;
  }
}

export async function piDraftGrounding(draft, root) {
  const text = String(draft || "").trim();
  if (!text) return { ok: false, message: "Pi Draft is empty." };
  if (SPECULATIVE_TECHNICAL_CLAIM.test(text)) {
    return {
      ok: false,
      message: "Pi Draft contains speculative technical claims instead of bounded repository evidence. Regenerate Pi Draft before publishing.",
    };
  }

  const missing = [];
  for (const candidate of candidatePaths(text)) {
    if (!await repositoryPathExists(root, candidate)) missing.push(candidate);
  }
  if (missing.length) {
    return {
      ok: false,
      message: `Pi Draft references repository paths that were not grounded in the current repository: ${missing.slice(0, 5).join(", ")}.`,
      missingPaths: missing,
    };
  }
  return { ok: true, message: "", missingPaths: [] };
}

export async function assertPiDraftGrounding(draft, root) {
  const result = await piDraftGrounding(draft, root);
  if (!result.ok) throw new Error(result.message);
}
