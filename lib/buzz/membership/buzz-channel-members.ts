function rows(value: unknown): unknown[] {
  if (Array.isArray(value)) return value;
  if (!value || typeof value !== "object") return [];
  const item = value as Record<string, unknown>;
  for (const key of ["members", "items", "data", "results"]) {
    if (Array.isArray(item[key])) return item[key] as unknown[];
  }
  return [];
}

export const buzzChannelMemberRows = rows;

function normalizedPubkey(value: unknown) {
  if (typeof value !== "string") return "";
  const pubkey = value.trim().toLowerCase();
  return /^[a-f0-9]{64}$/.test(pubkey) ? pubkey : "";
}

export function buzzChannelMemberPubkeys(value: unknown) {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const entry of rows(value)) {
    const pubkey = typeof entry === "string"
      ? normalizedPubkey(entry)
      : entry && typeof entry === "object" && !Array.isArray(entry)
        ? normalizedPubkey((entry as Record<string, unknown>).pubkey)
        : "";
    if (!pubkey || seen.has(pubkey)) continue;
    seen.add(pubkey);
    result.push(pubkey);
  }
  return result;
}
