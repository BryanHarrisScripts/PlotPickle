const NSEC = /nsec1[a-z0-9]+/gi;
const HEX_SECRET = /\b[a-f0-9]{64}\b/gi;
const NAMED_SECRET = /(password|secret|private[_ -]?key|api[_ -]?key|token)\s*[=:]\s*\S+/gi;

function readableDiagnostic(value: unknown) {
  const raw = String(value ?? "").trim();
  if (!raw) return "";
  try {
    const decoded: unknown = JSON.parse(raw);
    if (decoded && typeof decoded === "object" && !Array.isArray(decoded)) {
      const item = decoded as Record<string, unknown>;
      for (const key of ["message", "error", "detail"]) {
        if (typeof item[key] === "string" && item[key].trim()) return item[key].trim();
      }
    }
  } catch (error) {
    if (!(error instanceof SyntaxError)) return raw;
    return raw;
  }
  return raw;
}

export function redactBuzzDiagnostic(value: unknown) {
  return readableDiagnostic(value)
    .replace(NSEC, "[redacted-nsec]")
    .replace(HEX_SECRET, "[redacted-secret]")
    .replace(NAMED_SECRET, "$1=[redacted]")
    .trim()
    .slice(0, 700);
}

export function buzzCliFailure(code: number | null | undefined, diagnostic: unknown) {
  const detail = redactBuzzDiagnostic(diagnostic);
  if (/relay[_ -]?membership[_ -]?required|not a relay member|not authorized.*community|membership required/i.test(detail)) {
    return new Error(`BUZZ recognized the signer, but this identity is not a member of the PlotPickle Community. Open the PlotPickle Community with the same identity in BUZZ Desktop, join or confirm membership, then retry. ${detail}`.trim());
  }
  const suffix = detail ? ` ${detail}` : "";
  switch (code ?? 4) {
    case 1:
      return new Error(`BUZZ rejected the identity request as invalid.${suffix}`);
    case 2:
      return new Error(`The BUZZ relay could not be reached.${suffix}`);
    case 3:
      return new Error(`BUZZ rejected this private identity key or its signed authentication.${suffix}`);
    case 5:
      return new Error(`BUZZ reported a write conflict while updating the identity.${suffix}`);
    default:
      return new Error(`BUZZ Desktop could not complete the identity operation.${suffix}`);
  }
}
