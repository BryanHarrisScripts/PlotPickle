import { readFileSync, statSync } from "node:fs";
import path from "node:path";

const FILE_EXTENSION_PATTERN = /\.(?:cjs|css|html|js|json|jsx|md|mjs|ps1|py|scss|ts|tsx|txt|yaml|yml)$/iu;

function normalizeClaim(value) {
  return String(value || "")
    .trim()
    .replace(/^[`"'(]+|[`"'),.;]+$/gu, "")
    .replace(/:\d+(?::\d+)?$/u, "")
    .replaceAll("\\", "/")
    .replace(/^\.\//u, "");
}

function section(text, heading) {
  const source = String(text || "");
  const start = source.indexOf(heading);
  if (start < 0) return "";
  const rest = source.slice(start + heading.length);
  const next = rest.search(/\n##\s+/u);
  return next >= 0 ? rest.slice(0, next) : rest;
}

function codeSpans(text) {
  return [...String(text || "").matchAll(/`([^`\r\n]+)`/gu)].map((match) => match[1].trim());
}

function pathClaims(text) {
  const claims = new Set();
  for (const span of codeSpans(text)) {
    const normalized = normalizeClaim(span);
    if ((normalized.includes("/") || FILE_EXTENSION_PATTERN.test(normalized)) && !/^[a-z]+:\/\//iu.test(normalized)) {
      claims.add(normalized);
    }
  }
  const plain = /(?:^|[\s("' ])((?:\.?\.?[\\/])?[a-z0-9_.@-]+(?:[\\/][a-z0-9_.@-]+)+\.(?:cjs|css|html|js|json|jsx|md|mjs|ps1|py|scss|ts|tsx|txt|yaml|yml))(?:$|[\s:),.;])/gimu;
  for (const match of String(text || "").matchAll(plain)) claims.add(normalizeClaim(match[1]));
  return [...claims];
}

function symbolClaims(text) {
  const claims = new Set();
  for (const span of codeSpans(text)) {
    const normalized = span.trim().replace(/\(\)$/u, "");
    if (/^[A-Za-z_$][A-Za-z0-9_$]*(?:\.[A-Za-z_$][A-Za-z0-9_$]*)?$/u.test(normalized)) claims.add(normalized);
  }
  return [...claims];
}

function isObservedPath(claim, observed) {
  const normalized = normalizeClaim(claim);
  return observed.some((candidate) => {
    const value = normalizeClaim(candidate);
    return value === normalized;
  });
}

function observedTextFiles(observedPaths, cwd) {
  const files = [];
  for (const relative of observedPaths) {
    const normalized = normalizeClaim(relative);
    if (!normalized || !FILE_EXTENSION_PATTERN.test(normalized)) continue;
    const absolute = path.resolve(cwd, normalized);
    const rel = path.relative(cwd, absolute);
    if (rel.startsWith("..") || path.isAbsolute(rel)) continue;
    try {
      if (!statSync(absolute).isFile()) continue;
      files.push({ path: normalized, text: readFileSync(absolute, "utf8") });
    } catch {
      // An observed path can disappear between the Pi run and validation; treat it as unavailable evidence.
    }
  }
  return files;
}

function symbolObserved(symbol, files) {
  const leaf = symbol.split(".").at(-1) || symbol;
  const escaped = [...leaf].map((character) => "\\^$.*+?()[]{}|".includes(character) ? `\\\\${character}` : character).join("");
  const pattern = new RegExp(`\\b${escaped}\\b`, "u");
  return files.some((file) => pattern.test(file.text));
}

export function validateDsddPiGrounding({ text, observedPaths, cwd = process.cwd() }) {
  const observed = [...new Set((Array.isArray(observedPaths) ? observedPaths : []).map(normalizeClaim).filter(Boolean))].sort();
  const likely = section(text, "## Likely files and symbols");
  const verification = section(text, "## Deterministic verification");
  const claimsSource = [likely, verification].filter(Boolean).join("\n");
  const claimedPaths = pathClaims(claimsSource);
  const claimedSymbols = symbolClaims(likely);
  const ungroundedPaths = claimedPaths.filter((claim) => !isObservedPath(claim, observed));
  const files = observedTextFiles(observed, cwd);
  const ungroundedSymbols = claimedSymbols.filter((claim) => !symbolObserved(claim, files));
  return {
    state: ungroundedPaths.length || ungroundedSymbols.length ? "invalid" : "valid",
    observedPaths: observed,
    claimedPaths: claimedPaths.sort(),
    claimedSymbols: claimedSymbols.sort(),
    ungroundedPaths: ungroundedPaths.sort(),
    ungroundedSymbols: ungroundedSymbols.sort(),
  };
}
