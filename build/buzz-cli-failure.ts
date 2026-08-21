const NSEC = /nsec1[a-z0-9]+/gi;
const HEX_SECRET = /\b[a-f0-9]{64}\b/gi;
const NAMED_SECRET = /(password|secret|private[_ -]?key|api[_ -]?key|token)\s*[=:]\s*\S+/gi;

export function redactBuzzDiagnostic(value: unknown) {
  return String(value ?? "")
    .replace(NSEC, "[redacted-nsec]")
    .replace(HEX_SECRET, "[redacted-secret]")
    .replace(NAMED_SECRET, "$1=[redacted]")
    .trim()
    .slice(0, 700);
}

export function buzzCliFailure(code: number | null | undefined, diagnostic: unknown) {
  const detail = redactBuzzDiagnostic(diagnostic);
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
