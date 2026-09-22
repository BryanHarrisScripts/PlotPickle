import { existsSync } from "node:fs";
import path from "node:path";

const PATH_PREFIXES = [
  "app/","build/","config/","core/","docs/","learn/","lib/","modules/","scripts/","tests/","schema/",".github/",".agents/"
];

function candidatePath(value) {
  const normalized = String(value || "").trim().replaceAll("\\", "/");
  if (!normalized || normalized.includes("\n") || normalized.startsWith("http://") || normalized.startsWith("https://")) return "";
  if (PATH_PREFIXES.some((prefix) => normalized.startsWith(prefix))) return normalized;
  if (/^[A-Za-z0-9_.-]+\.(?:md|json|mjs|js|ts|tsx|css|yml|yaml)$/u.test(normalized)) return normalized;
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
