const SECRET_ASSIGNMENT_NAMES = Object.freeze([
  "private_key",
  "private-key",
  "privatekey",
  "authorization",
  "passphrase",
  "password",
  "credential",
  "api_key",
  "api-key",
  "apikey",
  "nostr_sk",
  "secret",
  "token",
  "cookie",
  "passwd",
  "auth",
  "key",
]);

const PROVIDER_PREFIXES = Object.freeze([
  "github_pat_",
  "sk-or-v1-",
  "sk-proj-",
  "sk-ant-",
  "glpat-",
  "xoxa-",
  "xoxb-",
  "xoxo-",
  "xoxp-",
  "xoxr-",
  "xoxs-",
  "ghp_",
  "gho_",
  "ghu_",
  "ghs_",
  "hf_",
  "AKIA",
  "AIza",
  "sk-",
  "pk-",
]);

function asciiAlphaNumeric(value) {
  const code = value?.charCodeAt(0) ?? -1;
  return (code >= 48 && code <= 57) || (code >= 65 && code <= 90) || (code >= 97 && code <= 122);
}

function wordCharacter(value) {
  return asciiAlphaNumeric(value) || value === "_";
}

function boundaryBefore(text, index) {
  return index <= 0 || !wordCharacter(text[index - 1]);
}

function equalsIgnoreCase(text, index, candidate) {
  if (index + candidate.length > text.length) return false;
  return text.slice(index, index + candidate.length).toLowerCase() === candidate.toLowerCase();
}

function whitespace(value) {
  return value === " " || value === "\t" || value === "\n" || value === "\r" || value === "\f" || value === "\v";
}

function credentialCharacter(value) {
  return asciiAlphaNumeric(value) || "_./+=-".includes(value);
}

function nsecCharacter(value) {
  return asciiAlphaNumeric(value);
}

function assignmentValueCharacter(value) {
  return Boolean(value) && !whitespace(value) && value !== "," && value !== ";";
}

function consumeWhile(text, index, predicate) {
  let cursor = index;
  while (cursor < text.length && predicate(text[cursor])) cursor += 1;
  return cursor;
}

function secretAssignmentAt(text, index) {
  if (!boundaryBefore(text, index)) return null;
  for (const name of SECRET_ASSIGNMENT_NAMES) {
    if (!equalsIgnoreCase(text, index, name)) continue;
    const nameEnd = index + name.length;
    if (wordCharacter(text[nameEnd])) continue;
    let cursor = nameEnd;
    while (whitespace(text[cursor])) cursor += 1;
    if (text[cursor] !== ":" && text[cursor] !== "=") continue;
    cursor += 1;
    while (whitespace(text[cursor])) cursor += 1;
    const valueStart = cursor;
    cursor = consumeWhile(text, cursor, assignmentValueCharacter);
    if (cursor === valueStart) continue;
    return {
      next: cursor,
      replacement: `${text.slice(index, nameEnd)}=[REDACTED]`,
    };
  }
  return null;
}

function bearerAt(text, index) {
  if (!boundaryBefore(text, index) || !equalsIgnoreCase(text, index, "Bearer")) return null;
  let cursor = index + 6;
  if (!whitespace(text[cursor])) return null;
  while (whitespace(text[cursor])) cursor += 1;
  const valueStart = cursor;
  cursor = consumeWhile(text, cursor, credentialCharacter);
  if (cursor - valueStart < 8) return null;
  return { next: cursor, replacement: "Bearer [REDACTED]" };
}

function nsecAt(text, index) {
  if (!boundaryBefore(text, index) || !equalsIgnoreCase(text, index, "nsec1")) return null;
  const valueStart = index + 5;
  const next = consumeWhile(text, valueStart, nsecCharacter);
  if (next - valueStart < 8) return null;
  return { next, replacement: "[REDACTED_NOSTR_PRIVATE_KEY]" };
}

function nostrExportAt(text, index) {
  const prefix = "nostr-export://";
  if (!boundaryBefore(text, index) || !equalsIgnoreCase(text, index, prefix)) return null;
  const valueStart = index + prefix.length;
  const next = consumeWhile(text, valueStart, (value) => Boolean(value) && !whitespace(value));
  if (next - valueStart < 12) return null;
  return { next, replacement: "nostr-export://[REDACTED]" };
}

function providerKeyAt(text, index) {
  if (!boundaryBefore(text, index)) return null;
  for (const prefix of PROVIDER_PREFIXES) {
    if (!equalsIgnoreCase(text, index, prefix)) continue;
    const valueStart = index + prefix.length;
    const next = consumeWhile(text, valueStart, credentialCharacter);
    if (next - valueStart < 8) continue;
    return { next, replacement: "[REDACTED_PROVIDER_KEY]" };
  }
  return null;
}

function windowsUserPathAt(text, index) {
  if (!asciiAlphaNumeric(text[index]) || text[index + 1] !== ":" || text[index + 2] !== "\\") return null;
  if (!equalsIgnoreCase(text, index + 3, "Users\\")) return null;
  const userStart = index + 9;
  const next = consumeWhile(text, userStart, (value) => Boolean(value) && value !== "\\" && !whitespace(value));
  if (next === userStart) return null;
  return { next, replacement: "[local-user]" };
}

function unixUserPathAt(text, index) {
  for (const prefix of ["/home/", "/Users/"]) {
    if (!equalsIgnoreCase(text, index, prefix)) continue;
    const userStart = index + prefix.length;
    const next = consumeWhile(text, userStart, (value) => Boolean(value) && value !== "/" && !whitespace(value));
    if (next === userStart) return null;
    return { next, replacement: `${prefix}[user]` };
  }
  return null;
}

function collapseWhitespace(value) {
  let output = "";
  let pendingSpace = false;
  for (const character of value) {
    const code = character.charCodeAt(0);
    const shouldSpace = whitespace(character) || code <= 31 || code === 127;
    if (shouldSpace) {
      pendingSpace = output.length > 0;
      continue;
    }
    if (pendingSpace) output += " ";
    output += character;
    pendingSpace = false;
  }
  return output.trim();
}

export function sanitizeBoundaryText(value, options = {}) {
  const text = typeof value === "string" ? value : String(value ?? "");
  const redactLocalUserPaths = options.redactLocalUserPaths === true;
  let output = "";
  let index = 0;

  while (index < text.length) {
    const match = secretAssignmentAt(text, index)
      || bearerAt(text, index)
      || nsecAt(text, index)
      || nostrExportAt(text, index)
      || providerKeyAt(text, index)
      || (redactLocalUserPaths ? windowsUserPathAt(text, index) || unixUserPathAt(text, index) : null);
    if (match) {
      output += match.replacement;
      index = match.next;
      continue;
    }
    output += text[index];
    index += 1;
  }

  const clean = collapseWhitespace(output);
  const numericLimit = Number(options.limit);
  if (!Number.isFinite(numericLimit)) return clean;
  return clean.slice(0, Math.max(0, Math.floor(numericLimit)));
}
