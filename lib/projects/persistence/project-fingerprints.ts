export function createProjectEntityId(prefix: string) {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `${prefix}-${crypto.randomUUID()}`;
  }
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function currentProjectTimestamp() {
  const now = new Date();
  return now.toISOString();
}

export function stableProjectSerialization(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(stableProjectSerialization).join(",")}]`;
  }
  if (value && typeof value === "object") {
    const serializedEntries = Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => `${JSON.stringify(key)}:${stableProjectSerialization(item)}`);
    return `{${serializedEntries.join(",")}}`;
  }
  return JSON.stringify(value);
}

export function projectContentFingerprint(value: unknown) {
  const source = stableProjectSerialization(value);
  let hash = 2166136261;
  for (let index = 0; index < source.length; index += 1) {
    hash ^= source.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `fnv1a-${(hash >>> 0).toString(16).padStart(8, "0")}`;
}
