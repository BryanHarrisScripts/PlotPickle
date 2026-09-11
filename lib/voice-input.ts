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
  "tel",
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

const SPECIALIZED_FIELD_PATTERN = /\b(password|passphrase|secret|token|api[ _-]?key|credential|signing|private[ _-]?key|file[ _-]?path|directory|folder|command|terminal|shell|code|endpoint|base[ _-]?url|server[ _-]?(address|url)|repository[ _-]?url|provider[ _-]?(id|model)|model[ _-]?id|port|timecode)\b/iu;

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

export function voiceInputFieldAllowed(input: {
  readonly type?: string;
  readonly inputMode?: string;
  readonly autocomplete?: string;
  readonly descriptor?: string;
  readonly disabled?: boolean;
  readonly readOnly?: boolean;
  readonly voiceInput?: boolean;
}) {
  if (input.disabled || input.readOnly || input.voiceInput === false) return false;
  if (!voiceInputAllowed({ type: input.type, voiceInput: input.voiceInput })) return false;
  const inputMode = String(input.inputMode || "").toLowerCase();
  if (["numeric", "decimal", "tel", "email", "url"].includes(inputMode)) return false;
  const autocomplete = String(input.autocomplete || "").toLowerCase();
  if (/password|one-time-code|cc-|address|postal|tel|email|url/u.test(autocomplete)) return false;
  return !SPECIALIZED_FIELD_PATTERN.test(String(input.descriptor || ""));
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
