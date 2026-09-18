export type StoryLearningAddress = {
  readonly blockNumber: number;
  readonly miniBlockNumber: number;
};

export type StoryLearningReference = {
  readonly lessonId: string;
  readonly concept: string;
  readonly actionLabel: string;
  readonly reason: string;
};

export type StoryLearningContext = {
  readonly address: StoryLearningAddress;
  readonly actNumber: 1 | 2 | 3 | 4;
  readonly sequenceNumber: number;
  readonly miniRole: "Promise" | "Progress" | "Pressure" | "Payoff";
  readonly positionNote: string;
  readonly references: readonly StoryLearningReference[];
};

const MINI_ROLES = ["Promise", "Progress", "Pressure", "Payoff"] as const;

function bounded(value: number, maximum: number) {
  if (!Number.isFinite(value)) return 1;
  return Math.min(maximum, Math.max(1, Math.trunc(value)));
}

function actNumber(blockNumber: number): 1 | 2 | 3 | 4 {
  if (blockNumber <= 6) return 1;
  if (blockNumber <= 12) return 2;
  if (blockNumber <= 18) return 3;
  return 4;
}

function structuralReference(blockNumber: number): StoryLearningReference {
  if (blockNumber === 12 || blockNumber === 13) {
    return {
      lessonId: "24b-structure-guide",
      concept: "Midpoint region",
      actionLabel: "Why this midpoint region?",
      reason: "Review midpoint and turning-point vocabulary as a flexible lens for what changes across the Block 12/13 boundary, not as a compulsory beat.",
    };
  }
  if (blockNumber <= 6) {
    return {
      lessonId: "24b-dramatic-question",
      concept: "Setup and dramatic question",
      actionLabel: "Why this early Block?",
      reason: "Review how setup, disruption, stakes and the central dramatic question can accumulate across the opening act without forcing one event per Block.",
    };
  }
  if (blockNumber <= 18) {
    return {
      lessonId: "24b-structures-role",
      concept: "Pressure and progression",
      actionLabel: "Why this Block?",
      reason: "Review how structure can manage causality, pressure, pacing and character development while allowing the story to choose its own event pattern.",
    };
  }
  return {
    lessonId: "24b-reflection",
    concept: "Payoff, consequence and changed meaning",
    actionLabel: "Why this late Block?",
    reason: "Review payoff and reflection as optional lenses for consequences, unresolved questions and the story's changed meaning.",
  };
}

function characterReference(blockNumber: number): StoryLearningReference {
  if (blockNumber <= 6) {
    return {
      lessonId: "characters-engine",
      concept: "Character starting state",
      actionLabel: "Review character start",
      reason: "Compare the character's want, need, protective strategy and formative history with the choices the screenplay actually makes visible.",
    };
  }
  if (blockNumber <= 10) {
    return {
      lessonId: "characters-relationships",
      concept: "Relationship pressure",
      actionLabel: "Review relationship movement",
      reason: "Review how relationships create pressure and reveal character through behaviour rather than biography alone.",
    };
  }
  if (blockNumber <= 14) {
    return {
      lessonId: "characters-inner-journey",
      concept: "Mid-arc state",
      actionLabel: "Review character arc here",
      reason: "Compare the planned inner journey with observable evidence around the middle of the story; a midpoint shift is a checkpoint, not a required identical event.",
    };
  }
  if (blockNumber <= 19) {
    return {
      lessonId: "characters-conflict",
      concept: "Pressure, crisis and choice",
      actionLabel: "Review character pressure",
      reason: "Review whether escalating pressure changes strategy, relationship or choice and whether that change is visible in the screenplay.",
    };
  }
  return {
    lessonId: "characters-choice-proof",
    concept: "Ending proof",
    actionLabel: "Review character ending proof",
    reason: "Compare the intended ending state with choices and consequences the audience can actually observe rather than relying on profile claims alone.",
  };
}

function miniReference(miniBlockNumber: number): StoryLearningReference {
  const role = MINI_ROLES[miniBlockNumber - 1];
  return {
    lessonId: "24b-principle-three",
    concept: `${role} movement`,
    actionLabel: `Learn ${role}`,
    reason: `${role} is a planning lens for this Mini-Block position. Use it to inspect local expectation, development, pressure or payoff without manufacturing filler to satisfy the label.`,
  };
}

export function storyLearningContext(input: StoryLearningAddress): StoryLearningContext {
  const blockNumber = bounded(input.blockNumber, 24);
  const miniBlockNumber = bounded(input.miniBlockNumber, 4);
  const act = actNumber(blockNumber);
  const sequence = Math.ceil(blockNumber / 2);
  const miniRole = MINI_ROLES[miniBlockNumber - 1];
  const midpoint = blockNumber === 12 || blockNumber === 13;
  return {
    address: { blockNumber, miniBlockNumber },
    actNumber: act,
    sequenceNumber: sequence,
    miniRole,
    positionNote: midpoint
      ? "This address sits in the midpoint region between the first and second halves. Inspect what becomes newly understood, unavoidable or chosen here; do not force a stock midpoint event."
      : `Act ${act} · Sequence ${String(sequence).padStart(2, "0")} · Block ${String(blockNumber).padStart(2, "0")} · ${miniRole}. Curriculum explains the craft lens; the screenplay decides the event.`,
    references: [
      structuralReference(blockNumber),
      miniReference(miniBlockNumber),
      characterReference(blockNumber),
    ],
  };
}

export function storyLearningHref(reference: StoryLearningReference, address: StoryLearningAddress) {
  const context = storyLearningContext(address);
  const query = new URLSearchParams({
    workspace: "learn",
    lesson: reference.lessonId,
    block: String(context.address.blockNumber),
    mini: String(context.address.miniBlockNumber),
    return: "dashboard",
  });
  return `/?${query.toString()}`;
}

export function storyLearningReturnHref(address: StoryLearningAddress) {
  const context = storyLearningContext(address);
  const query = new URLSearchParams({
    workspace: "dashboard",
    block: String(context.address.blockNumber),
    mini: String(context.address.miniBlockNumber),
  });
  return `/?${query.toString()}`;
}
