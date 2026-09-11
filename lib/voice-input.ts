export const VOICE_INPUT_STATES = [
  "IDLE",
  "REQUESTING_PERMISSION",
  "LISTENING",
  "FINALIZING_AUDIO",
  "TRANSCRIBING",
  "INSERTED",
  "PERMISSION_DENIED",
  "MIC_UNAVAILABLE",
  "MODEL_UNAVAILABLE",
  "RUNTIME_UNAVAILABLE",
  "TRANSCRIPTION_FAILED",
  "CANCELLED",
  "TIMEOUT",
] as const;

export type VoiceInputState = (typeof VOICE_INPUT_STATES)[number];

const EXCLUDED_INPUT_TYPES = new Set([
  "password",
  "file",
  "number",
  "date",
  "datetime-local",
  "month",
  "time",
  "week",
  "color",
  "range",
  "url",
  "email",
]);

const EXCLUDED_PURPOSES = new Set([
  "credential",
  "secret",
  "api-key",
  "signing-key",
  "file-path",
  "command",
  "code",
  "provider-selector",
]);

export function voiceInputAllowed(input: {
  readonly type?: string;
  readonly purpose?: string;
  readonly voiceInput?: boolean;
} = {}) {
  if (input.voiceInput === false) return false;
  const type = String(input.type || "text").trim().toLowerCase();
  const purpose = String(input.purpose || "natural-language").trim().toLowerCase();
  return !EXCLUDED_INPUT_TYPES.has(type) && !EXCLUDED_PURPOSES.has(purpose);
}

export function insertDictationText(
  value: string,
  transcript: string,
  selectionStart?: number | null,
  selectionEnd?: number | null,
) {
  const source = String(value ?? "");
  const dictated = String(transcript ?? "").replace(/\s+/gu, " ").trim();
  if (!dictated) return { value: source, caret: Math.max(0, Math.min(source.length, selectionEnd ?? source.length)) };

  const start = Math.max(0, Math.min(source.length, selectionStart ?? source.length));
  const end = Math.max(start, Math.min(source.length, selectionEnd ?? start));
  const before = source.slice(0, start);
  const after = source.slice(end);
  const needsLeadingSpace = before.length > 0 && !/\s$/u.test(before);
  const needsTrailingSpace = after.length > 0 && !/^\s|^[,.;:!?)}\]]/u.test(after);
  const insertion = `${needsLeadingSpace ? " " : ""}${dictated}${needsTrailingSpace ? " " : ""}`;
  const nextValue = `${before}${insertion}${after}`;
  return { value: nextValue, caret: before.length + insertion.length };
}
