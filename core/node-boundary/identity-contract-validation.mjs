const DEFAULT_ID_PATTERN = /^[a-z0-9][a-z0-9._:-]{1,127}$/i;

export function normalizeContractId(value, label, options = {}) {
  const text = String(value ?? "").trim();
  const pattern = options.pattern instanceof RegExp ? options.pattern : DEFAULT_ID_PATTERN;
  const maxLength = Number.isInteger(options.maxLength) ? options.maxLength : 128;
  if (text.length > maxLength || !pattern.test(text)) {
    throw new Error(`${label} must be a stable 2-${maxLength} character identifier.`);
  }
  return text;
}

export function normalizeIsoDateTime(value, label, parser = Date.parse) {
  const text = String(value ?? "");
  const parsed = parser(text);
  if (!text || Number.isNaN(parsed)) throw new Error(`${label} must be an ISO date-time.`);
  return text;
}

export function assertAllowedContractFields(input, allowed, label, keys = Object.keys) {
  const fields = keys(input ?? {});
  const unexpected = fields.find((key) => !allowed.includes(key));
  if (unexpected) throw new Error(`${label} field is outside the allowlist: ${unexpected}`);
}
