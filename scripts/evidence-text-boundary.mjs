const ASSIGNMENT_KEYS = Object.freeze([
  "private_key",
  "private-key",
  "privatekey",
  "passphrase",
  "password",
  "api_key",
  "api-key",
  "apikey",
  "authorization",
  "secret",
  "token",
  "cookie",
]);

function codeAt(value, index) {
  return value.charCodeAt(index);
}

function isAsciiLetterCode(code) {
  return (code >= 65 && code <= 90) || (code >= 97 && code <= 122);
}

function isAsciiDigitCode(code) {
  return code >= 48 && code <= 57;
}

function isAsciiAlphaNumeric(value, index) {
  if (index < 0 || index >= value.length) return false;
  const code = codeAt(value, index);
  return isAsciiLetterCode(code) || isAsciiDigitCode(code);
}

function isProviderTokenChar(value, index) {
  if (isAsciiAlphaNumeric(value, index)) return true;
  const char = value[index];
  return char === "_" || char === "-";
}

function isBearerTokenChar(value, index) {
  if (isAsciiAlphaNumeric(value, index)) return true;
  return "._~+/=-".includes(value[index]);
}

function isWordContinuation(value, index) {
  if (isAsciiAlphaNumeric(value, index)) return true;
  const char = value[index];
  return char === "_" || char === "-";
}

function isWhitespaceOrControl(value, index) {
  const code = codeAt(value, index);
  return code <= 32 || code === 127 || code === 160;
}

function startsWithIgnoreCase(value, index, literal) {
  if (index < 0 || index + literal.length > value.length) return false;
  return value.slice(index, index + literal.length).toLowerCase() === literal.toLowerCase();
}

function hasLeftBoundary(value, index) {
  return index === 0 || !isWordContinuation(value, index - 1);
}

function scanWhile(value, index, predicate) {
  let cursor = index;
  while (cursor < value.length && predicate(value, cursor)) cursor += 1;
  return cursor;
}

function matchNostrPrivateKey(value, index) {
  if (!hasLeftBoundary(value, index) || !startsWithIgnoreCase(value, index, "nsec1")) return null;
  const end = scanWhile(value, index + 5, isAsciiAlphaNumeric);
  if (end - (index + 5) < 8) return null;
  return { end, replacement: "[REDACTED_NOSTR_PRIVATE_KEY]" };
}

function matchProviderKey(value, index) {
  if (!hasLeftBoundary(value, index)) return null;
  const prefix = startsWithIgnoreCase(value, index, "sk-") ? "sk-" : startsWithIgnoreCase(value, index, "pk-") ? "pk-" : "";
  if (!prefix) return null;
  const end = scanWhile(value, index + prefix.length, isProviderTokenChar);
  if (end - (index + prefix.length) < 8) return null;
  return { end, replacement: "[REDACTED_PROVIDER_KEY]" };
}

function matchBearer(value, index) {
  if (!hasLeftBoundary(value, index) || !startsWithIgnoreCase(value, index, "Bearer")) return null;
  let cursor = index + 6;
  if (cursor >= value.length || !isWhitespaceOrControl(value, cursor)) return null;
  cursor = scanWhile(value, cursor, isWhitespaceOrControl);
  const tokenStart = cursor;
  cursor = scanWhile(value, cursor, isBearerTokenChar);
  if (cursor - tokenStart < 8) return null;
  return { end: cursor, replacement: "Bearer [REDACTED]" };
}

function matchAssignment(value, index) {
  if (!hasLeftBoundary(value, index)) return null;
  for (const key of ASSIGNMENT_KEYS) {
    if (!startsWithIgnoreCase(value, index, key)) continue;
    const keyEnd = index + key.length;
    if (keyEnd < value.length && isWordContinuation(value, keyEnd)) continue;
    let cursor = scanWhile(value, keyEnd, isWhitespaceOrControl);
    if (value[cursor] !== ":" && value[cursor] !== "=") continue;
    cursor += 1;
    cursor = scanWhile(value, cursor, isWhitespaceOrControl);
    const secretStart = cursor;
    while (cursor < value.length) {
      const char = value[cursor];
      if (isWhitespaceOrControl(value, cursor) || char === "," || char === ";") break;
      cursor += 1;
    }
    if (cursor === secretStart) continue;
    return { end: cursor, replacement: `${value.slice(index, keyEnd)}=[REDACTED]` };
  }
  return null;
}

function matchWindowsUserPath(value, index) {
  if (index + 10 >= value.length || !isAsciiLetterCode(codeAt(value, index)) || value[index + 1] !== ":") return null;
  const slash = value[index + 2];
  if (slash !== "\\" && slash !== "/") return null;
  if (!startsWithIgnoreCase(value, index + 3, "Users")) return null;
  const separator = value[index + 8];
  if (separator !== "\\" && separator !== "/") return null;
  const userStart = index + 9;
  let cursor = userStart;
  while (cursor < value.length) {
    const char = value[cursor];
    if (char === "\\" || char === "/" || isWhitespaceOrControl(value, cursor)) break;
    cursor += 1;
  }
  if (cursor === userStart) return null;
  return { end: cursor, replacement: "[local-user]" };
}

function matchUnixUserPath(value, index) {
  const prefixes = [
    { literal: "/home/", replacement: "/home/[user]" },
    { literal: "/Users/", replacement: "/Users/[user]" },
  ];
  for (const prefix of prefixes) {
    if (!startsWithIgnoreCase(value, index, prefix.literal)) continue;
    const userStart = index + prefix.literal.length;
    let cursor = userStart;
    while (cursor < value.length) {
      if (value[cursor] === "/" || isWhitespaceOrControl(value, cursor)) break;
      cursor += 1;
    }
    if (cursor === userStart) continue;
    return { end: cursor, replacement: prefix.replacement };
  }
  return null;
}

function appendCollapsed(output, chunk) {
  for (let index = 0; index < chunk.length; index += 1) {
    const whitespace = isWhitespaceOrControl(chunk, index);
    if (whitespace) {
      if (output.length && output.at(-1) !== " ") output.push(" ");
    } else {
      output.push(chunk[index]);
    }
  }
}

export function sanitizeEvidenceText(input, limit = Number.POSITIVE_INFINITY) {
  const value = String(input ?? "");
  const output = [];
  let index = 0;
  while (index < value.length) {
    const match = matchWindowsUserPath(value, index)
      || matchUnixUserPath(value, index)
      || matchNostrPrivateKey(value, index)
      || matchBearer(value, index)
      || matchProviderKey(value, index)
      || matchAssignment(value, index);
    if (match) {
      appendCollapsed(output, match.replacement);
      index = match.end;
      continue;
    }
    appendCollapsed(output, value[index]);
    index += 1;
  }
  while (output.at(-1) === " ") output.pop();
  const safeLimit = Number.isFinite(Number(limit)) ? Math.max(0, Math.floor(Number(limit))) : Number.POSITIVE_INFINITY;
  const text = output.join("");
  return safeLimit === Number.POSITIVE_INFINITY ? text : text.slice(0, safeLimit);
}
