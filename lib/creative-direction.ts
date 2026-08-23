import type { CreativeExplorationCandidate } from "./creative-candidates";

export type CreativeDirectionDimension =
  | "subject"
  | "composition"
  | "mood"
  | "action"
  | "colour"
  | "camera"
  | "continuity";

export type CreativeDirectionNotes = Record<CreativeDirectionDimension, string>;

export type KeepChangeTryDirection = {
  keep: string;
  change: string;
  try: string;
  notes: CreativeDirectionNotes;
  advancedPrompt: string;
};

export type ProviderNeutralCreativeRequest = {
  version: 1;
  sourceCandidateId: string;
  mediaType: CreativeExplorationCandidate["mediaType"];
  target: CreativeExplorationCandidate["target"];
  direction: {
    keep: string[];
    change: string[];
    try: string[];
    dimensions: CreativeDirectionNotes;
  };
  advanced: {
    prompt: string;
    visibleByDefault: false;
  };
};

export const CREATIVE_DIRECTION_DIMENSIONS: { id: CreativeDirectionDimension; label: string; help: string }[] = [
  { id: "subject", label: "Subject", help: "Who or what must remain recognizable, move, appear, disappear or change?" },
  { id: "composition", label: "Composition", help: "Framing, balance, foreground, background, negative space and visual hierarchy." },
  { id: "mood", label: "Mood", help: "Emotional atmosphere, tension, warmth, unease, wonder, intimacy or energy." },
  { id: "action", label: "Action", help: "What is happening, changing, entering, leaving or being revealed?" },
  { id: "colour", label: "Colour", help: "Palette, contrast, saturation, temperature and colour relationships." },
  { id: "camera", label: "Camera", help: "Shot size, angle, lens feeling, point of view, movement or stillness." },
  { id: "continuity", label: "Continuity", help: "Identity, wardrobe, geography, props, lighting and story facts that must stay consistent." },
];

function clean(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function lines(value: string) {
  return value
    .split(/\n|;/)
    .map((item) => item.trim())
    .filter(Boolean);
}

export function createBlankCreativeDirection(): KeepChangeTryDirection {
  return {
    keep: "",
    change: "",
    try: "",
    notes: {
      subject: "",
      composition: "",
      mood: "",
      action: "",
      colour: "",
      camera: "",
      continuity: "",
    },
    advancedPrompt: "",
  };
}

export function normalizeCreativeDirection(value: unknown): KeepChangeTryDirection {
  const blank = createBlankCreativeDirection();
  if (!value || typeof value !== "object" || Array.isArray(value)) return blank;
  const candidate = value as Partial<KeepChangeTryDirection>;
  const notes = candidate.notes && typeof candidate.notes === "object" && !Array.isArray(candidate.notes)
    ? candidate.notes as Partial<CreativeDirectionNotes>
    : {};
  return {
    keep: clean(candidate.keep),
    change: clean(candidate.change),
    try: clean(candidate.try),
    notes: {
      subject: clean(notes.subject),
      composition: clean(notes.composition),
      mood: clean(notes.mood),
      action: clean(notes.action),
      colour: clean(notes.colour),
      camera: clean(notes.camera),
      continuity: clean(notes.continuity),
    },
    advancedPrompt: clean(candidate.advancedPrompt),
  };
}

export function buildProviderNeutralCreativeRequest(
  sourceCandidate: CreativeExplorationCandidate,
  value: KeepChangeTryDirection,
): ProviderNeutralCreativeRequest {
  const direction = normalizeCreativeDirection(value);
  return {
    version: 1,
    sourceCandidateId: sourceCandidate.id,
    mediaType: sourceCandidate.mediaType,
    target: { ...sourceCandidate.target },
    direction: {
      keep: lines(direction.keep),
      change: lines(direction.change),
      try: lines(direction.try),
      dimensions: { ...direction.notes },
    },
    advanced: {
      prompt: direction.advancedPrompt,
      visibleByDefault: false,
    },
  };
}

export function describeCreativeRequest(request: ProviderNeutralCreativeRequest) {
  const parts: string[] = [];
  if (request.direction.keep.length) parts.push(`Keep: ${request.direction.keep.join(", ")}`);
  if (request.direction.change.length) parts.push(`Change: ${request.direction.change.join(", ")}`);
  if (request.direction.try.length) parts.push(`Try: ${request.direction.try.join(", ")}`);
  for (const dimension of CREATIVE_DIRECTION_DIMENSIONS) {
    const note = request.direction.dimensions[dimension.id];
    if (note) parts.push(`${dimension.label}: ${note}`);
  }
  return parts.join(" · ");
}
