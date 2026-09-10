import type {
  CinematographyPrimitive,
  CinematographySelection,
} from "../core/contracts/cinematography";

const GRAMMAR: readonly CinematographyPrimitive[] = [
  {
    id: "framing.subject-small-in-world",
    category: "framing",
    technique: "Subject small in world",
    intents: ["isolation", "scale", "vulnerability", "distance"],
    observableEffect: "Keep the subject deliberately small while the environment carries most of the frame.",
    aliases: ["small in frame", "isolated", "tiny against environment", "wide isolation"],
    applicability: "both",
    compatibleWith: ["composition.negative-space", "camera-movement.slow-reveal"],
    conflictsWith: ["framing.face-dominant"],
  },
  {
    id: "framing.face-dominant",
    category: "framing",
    technique: "Face dominant",
    intents: ["intimacy", "pressure", "emotion", "confession"],
    observableEffect: "Let the face occupy most of the frame so small expression changes become the visual event.",
    aliases: ["close face", "close-up", "intimate portrait"],
    applicability: "both",
    compatibleWith: ["lighting.one-side-falloff"],
    conflictsWith: ["framing.subject-small-in-world"],
  },
  {
    id: "camera-angle.low-dominance",
    category: "camera-angle",
    technique: "Low dominance angle",
    intents: ["power", "threat", "authority", "monumental"],
    observableEffect: "Place the camera below the subject eye line so the subject gains visual dominance.",
    aliases: ["low angle", "look up", "dominant angle"],
    applicability: "both",
    compatibleWith: ["framing.face-dominant"],
    conflictsWith: ["camera-angle.high-vulnerability"],
  },
  {
    id: "camera-angle.high-vulnerability",
    category: "camera-angle",
    technique: "High vulnerability angle",
    intents: ["vulnerability", "exposure", "smallness", "helplessness"],
    observableEffect: "Place the camera above the subject eye line so the subject feels exposed within the surrounding space.",
    aliases: ["high angle", "look down", "vulnerable angle"],
    applicability: "both",
    compatibleWith: ["framing.subject-small-in-world"],
    conflictsWith: ["camera-angle.low-dominance"],
  },
  {
    id: "camera-movement.slow-reveal",
    category: "camera-movement",
    technique: "Slow reveal",
    intents: ["reveal", "discovery", "dread", "anticipation"],
    observableEffect: "Move gradually so new spatial information enters the frame in a controlled order.",
    aliases: ["slow reveal", "creep reveal", "gradual reveal"],
    applicability: "video",
    compatibleWith: ["composition.negative-space", "sound-atmosphere.room-pressure"],
    conflictsWith: ["camera-movement.abrupt-snap"],
  },
  {
    id: "camera-movement.push-attention",
    category: "camera-movement",
    technique: "Push attention",
    intents: ["focus", "realization", "intimacy", "pressure"],
    observableEffect: "Move physically closer to the subject so attention tightens while spatial parallax remains visible.",
    aliases: ["push in", "dolly in", "move closer"],
    applicability: "video",
    compatibleWith: ["framing.face-dominant"],
    conflictsWith: ["camera-movement.pull-release"],
  },
  {
    id: "camera-movement.pull-release",
    category: "camera-movement",
    technique: "Pull release",
    intents: ["release", "separation", "aftermath", "loneliness"],
    observableEffect: "Move physically away from the subject so surrounding space gradually takes over the emotional weight.",
    aliases: ["pull back", "dolly out", "move away"],
    applicability: "video",
    compatibleWith: ["framing.subject-small-in-world"],
    conflictsWith: ["camera-movement.push-attention"],
  },
  {
    id: "camera-movement.abrupt-snap",
    category: "camera-movement",
    technique: "Abrupt snap",
    intents: ["shock", "impact", "panic", "surprise"],
    observableEffect: "Change camera direction or framing quickly enough to make the shift itself perceptible.",
    aliases: ["snap", "whip", "abrupt camera move"],
    applicability: "video",
    compatibleWith: ["edit-transition.hard-interrupt"],
    conflictsWith: ["camera-movement.slow-reveal"],
  },
  {
    id: "lens.space-expanded",
    category: "lens",
    technique: "Expanded spatial perspective",
    intents: ["energy", "proximity", "environment", "unease"],
    observableEffect: "Favor wider perspective so foreground-to-background distance feels pronounced without distorting identity.",
    aliases: ["wide lens", "expanded perspective", "deep space"],
    applicability: "both",
    compatibleWith: ["composition.deep-layering"],
    conflictsWith: ["lens.space-compressed"],
  },
  {
    id: "lens.space-compressed",
    category: "lens",
    technique: "Compressed spatial perspective",
    intents: ["pressure", "crowding", "observation", "distance"],
    observableEffect: "Favor compressed depth so foreground and background appear visually closer together.",
    aliases: ["telephoto", "compressed lens", "flatten space"],
    applicability: "both",
    compatibleWith: ["framing.face-dominant"],
    conflictsWith: ["lens.space-expanded"],
  },
  {
    id: "composition.negative-space",
    category: "composition",
    technique: "Weighted negative space",
    intents: ["isolation", "absence", "anticipation", "unease"],
    observableEffect: "Reserve a meaningful empty region so absence or an expected arrival becomes part of the composition.",
    aliases: ["negative space", "empty side", "leave room"],
    applicability: "both",
    compatibleWith: ["framing.subject-small-in-world", "camera-movement.slow-reveal"],
    conflictsWith: [],
  },
  {
    id: "composition.deep-layering",
    category: "composition",
    technique: "Deep visual layering",
    intents: ["world", "tension", "relationship", "surveillance"],
    observableEffect: "Stage distinct foreground, subject and background layers so relationships read through depth.",
    aliases: ["deep composition", "foreground layer", "layered depth"],
    applicability: "both",
    compatibleWith: ["lens.space-expanded"],
    conflictsWith: [],
  },
  {
    id: "lighting.one-side-falloff",
    category: "lighting",
    technique: "One-side falloff",
    intents: ["mystery", "conflict", "intimacy", "doubt"],
    observableEffect: "Let one side of the subject remain more illuminated while the opposite side falls away gradually.",
    aliases: ["split light", "side light", "one side darker"],
    applicability: "both",
    compatibleWith: ["framing.face-dominant"],
    conflictsWith: ["lighting.open-even"],
  },
  {
    id: "lighting.open-even",
    category: "lighting",
    technique: "Open even illumination",
    intents: ["clarity", "safety", "neutrality", "honesty"],
    observableEffect: "Keep important faces and actions evenly readable with restrained contrast and no dominant shadow side.",
    aliases: ["even light", "soft open light", "clear lighting"],
    applicability: "both",
    compatibleWith: [],
    conflictsWith: ["lighting.one-side-falloff"],
  },
  {
    id: "colour-texture.muted-separation",
    category: "colour-texture",
    technique: "Muted separation",
    intents: ["memory", "distance", "fatigue", "melancholy"],
    observableEffect: "Reduce colour intensity while preserving enough tonal separation for subjects and locations to remain distinct.",
    aliases: ["muted colour", "desaturated", "faded palette"],
    applicability: "both",
    compatibleWith: ["framing.subject-small-in-world"],
    conflictsWith: ["colour-texture.high-vitality"],
  },
  {
    id: "colour-texture.high-vitality",
    category: "colour-texture",
    technique: "High vitality colour",
    intents: ["joy", "energy", "wonder", "celebration"],
    observableEffect: "Favor strong but controlled colour separation so the image feels vivid without losing material texture.",
    aliases: ["vivid colour", "saturated", "bright palette"],
    applicability: "both",
    compatibleWith: ["lighting.open-even"],
    conflictsWith: ["colour-texture.muted-separation"],
  },
  {
    id: "edit-transition.hard-interrupt",
    category: "edit-transition",
    technique: "Hard interruption",
    intents: ["shock", "contrast", "urgency", "rupture"],
    observableEffect: "End the visual thought decisively so the next image arrives without a soft transitional handoff.",
    aliases: ["hard cut", "smash cut", "interrupt"],
    applicability: "video",
    compatibleWith: ["camera-movement.abrupt-snap"],
    conflictsWith: ["edit-transition.visual-bridge"],
  },
  {
    id: "edit-transition.visual-bridge",
    category: "edit-transition",
    technique: "Visual bridge",
    intents: ["continuity", "association", "memory", "flow"],
    observableEffect: "Carry a shape, motion, colour or composition idea across the boundary so two moments feel deliberately connected.",
    aliases: ["match transition", "visual match", "bridge cut"],
    applicability: "video",
    compatibleWith: ["continuity.carry-motion"],
    conflictsWith: ["edit-transition.hard-interrupt"],
  },
  {
    id: "narrative-device.restricted-view",
    category: "narrative-device",
    technique: "Restricted visual knowledge",
    intents: ["suspense", "mystery", "uncertainty", "subjectivity"],
    observableEffect: "Withhold useful visual information that the viewpoint character cannot yet know or clearly perceive.",
    aliases: ["restricted view", "withhold information", "subjective knowledge"],
    applicability: "both",
    compatibleWith: ["composition.negative-space", "camera-movement.slow-reveal"],
    conflictsWith: [],
  },
  {
    id: "vfx-physical.environment-response",
    category: "vfx-physical",
    technique: "Environment responds physically",
    intents: ["impact", "danger", "scale", "supernatural"],
    observableEffect: "Show secondary physical reactions in nearby material or atmosphere so an extraordinary event has visible consequence.",
    aliases: ["debris response", "air response", "environment reacts"],
    applicability: "both",
    compatibleWith: ["sound-atmosphere.room-pressure"],
    conflictsWith: [],
  },
  {
    id: "sound-atmosphere.room-pressure",
    category: "sound-atmosphere",
    technique: "Environmental pressure bed",
    intents: ["dread", "tension", "isolation", "anticipation"],
    observableEffect: "Sustain a restrained environmental sound bed whose persistence makes silence and small changes noticeable.",
    aliases: ["room tone", "ambient pressure", "low atmosphere"],
    applicability: "video",
    compatibleWith: ["camera-movement.slow-reveal"],
    conflictsWith: [],
  },
  {
    id: "continuity.carry-motion",
    category: "continuity",
    technique: "Carry motion across boundary",
    intents: ["continuity", "flow", "momentum", "clarity"],
    observableEffect: "Preserve direction, pose and action phase across the shot boundary so the next image continues the same physical event.",
    aliases: ["match motion", "carry action", "motion continuity"],
    applicability: "video",
    compatibleWith: ["edit-transition.visual-bridge"],
    conflictsWith: [],
  },
] as const;

function normalizedTokens(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/gu, " ")
    .trim()
    .split(/\s+/u)
    .filter((token) => token.length > 1);
}

function searchableTerms(primitive: CinematographyPrimitive) {
  return [...primitive.intents, ...primitive.aliases, primitive.technique]
    .flatMap(normalizedTokens);
}

function supportsMedium(primitive: CinematographyPrimitive, medium: "still" | "video") {
  return primitive.applicability === "both" || primitive.applicability === medium;
}

function scorePrimitive(primitive: CinematographyPrimitive, intent: string) {
  const phrase = intent.toLowerCase();
  let score = 0;
  for (const alias of primitive.aliases) {
    if (alias.length >= 4 && phrase.includes(alias.toLowerCase())) score += 6;
  }
  for (const declared of primitive.intents) {
    if (phrase.includes(declared.toLowerCase())) score += 4;
  }
  const inputTokens = new Set(normalizedTokens(intent));
  for (const term of searchableTerms(primitive)) {
    if (inputTokens.has(term)) score += 1;
  }
  return score;
}

export function cinematographyGrammar() {
  return GRAMMAR;
}

export function cinematographyPrimitive(id: string) {
  return GRAMMAR.find((primitive) => primitive.id === id) ?? null;
}

export function selectCinematographyPrimitives(
  intent: string,
  options: { readonly medium?: "still" | "video"; readonly limit?: number } = {},
): CinematographySelection {
  const medium = options.medium ?? "video";
  const limit = Math.max(1, Math.min(options.limit ?? 5, 8));
  const ranked = GRAMMAR
    .filter((primitive) => supportsMedium(primitive, medium))
    .map((primitive) => ({ primitive, score: scorePrimitive(primitive, intent) }))
    .filter((candidate) => candidate.score > 0)
    .sort((left, right) => right.score - left.score || left.primitive.id.localeCompare(right.primitive.id));

  const selected: CinematographyPrimitive[] = [];
  for (const candidate of ranked) {
    if (selected.length >= limit) break;
    const conflicts = selected.some((chosen) =>
      chosen.conflictsWith.includes(candidate.primitive.id)
      || candidate.primitive.conflictsWith.includes(chosen.id));
    if (!conflicts) selected.push(candidate.primitive);
  }

  const inputTokens = new Set(normalizedTokens(intent));
  const matchedIntents = [...new Set(selected.flatMap((primitive) => primitive.intents)
    .filter((declared) => normalizedTokens(declared).some((token) => inputTokens.has(token))))];

  return {
    primitiveIds: selected.map((primitive) => primitive.id),
    matchedIntents,
    medium,
  };
}

export function compileCinematographySelection(selection: CinematographySelection) {
  const primitives = selection.primitiveIds
    .map(cinematographyPrimitive)
    .filter((primitive): primitive is CinematographyPrimitive => Boolean(primitive));
  if (!primitives.length) return "No cinematography grammar selections supplied.";
  return primitives.map((primitive) => [
    `${primitive.category.toUpperCase()} · ${primitive.technique}`,
    `VISIBLE EFFECT: ${primitive.observableEffect}`,
  ].join("\n")).join("\n\n");
}
