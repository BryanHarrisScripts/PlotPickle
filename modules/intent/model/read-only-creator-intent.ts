/**
 * #3203 bounded v1 intent vocabulary. The interpreter does not choose a
 * project, invoke an agent, select compute, or acquire mutation authority.
 */
export const CREATOR_INTENT_CONTRACT_VERSION = 1 as const;

export type ReadOnlyCreatorIntent = "WHERE_AM_I" | "REVIEW_FILM";
export type InterpretedCreatorIntent = Readonly<{
  version: typeof CREATOR_INTENT_CONTRACT_VERSION;
  authority: "READ_ONLY";
  kind: ReadOnlyCreatorIntent | null;
  state: "SUPPORTED" | "UNSUPPORTED";
}>;

const SUPPORTED: Readonly<Record<string, ReadOnlyCreatorIntent>> = Object.freeze({
  "where am i": "WHERE_AM_I",
  "what should i review next": "WHERE_AM_I",
  "continue this film": "WHERE_AM_I",
  "review film readiness": "REVIEW_FILM",
  "review my film's readiness": "REVIEW_FILM",
});

export function interpretReadOnlyCreatorIntent(value: unknown): InterpretedCreatorIntent {
  const normalized = typeof value === "string"
    ? value.trim().toLowerCase().replace(/[?.!]+$/u, "") : "";
  const kind = Object.prototype.hasOwnProperty.call(SUPPORTED, normalized)
    ? SUPPORTED[normalized] : null;
  return Object.freeze({
    version: CREATOR_INTENT_CONTRACT_VERSION,
    authority: "READ_ONLY" as const,
    kind,
    state: kind ? "SUPPORTED" as const : "UNSUPPORTED" as const,
  });
}
