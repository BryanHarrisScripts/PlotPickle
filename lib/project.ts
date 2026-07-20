export type Relationship = {
  characterId: string;
  label: string;
  description: string;
};

export type Character = {
  id: string;
  name: string;
  role: string;
  pronouns: string;
  description: string;
  want: string;
  need: string;
  ghost: string;
  fatalFlaw: string;
  strengths: string;
  arc: string;
  voice: string;
  image: string;
  relationships: Relationship[];
};

export type Location = {
  id: string;
  name: string;
  description: string;
  image: string;
};

export type VisualFrame = {
  id: string;
  src: string;
  alt: string;
  caption: string;
  prompt: string;
  shot: string;
  continuity: string;
};

export type StoryBlock = {
  id: string;
  number: number;
  act: number;
  title: string;
  purpose: string;
  summary: string;
  characterIds: string[];
  locationIds: string[];
  goal: string;
  conflict: string;
  choice: string;
  action: string;
  consequence: string;
  emotionalTurn: string;
  setup: string;
  payoff: string;
  scriptExcerpt: string;
  notes: string;
  visuals: VisualFrame[];
};

export type PlotPickleProject = {
  schemaVersion: "1.0.0";
  id: string;
  metadata: {
    title: string;
    subtitle: string;
    format: string;
    targetMinutes: number;
    genre: string;
    tone: string;
    status: string;
    createdAt: string;
    updatedAt: string;
  };
  story: {
    premise: string;
    logline: string;
    theme: string;
    antiTheme: string;
    dramaticQuestion: string;
    hook: string;
    catalyst: string;
    stakes: string;
    ending: string;
    notes: string;
  };
  world: {
    ordinaryWorld: string;
    newWorld: string;
    period: string;
    history: string;
    cultures: string;
    rules: string;
    technology: string;
    visualLanguage: string;
    locations: Location[];
  };
  characters: Character[];
  blocks: StoryBlock[];
};

export const beatTemplates = [
  ["Hook, Introduction & Catalyst", "Open with a compelling image, establish the protagonist's ordinary world, then disrupt it."],
  ["Problem, Stakes & Philosophy", "Define the problem caused by the catalyst, what can be lost, and the belief under pressure."],
  ["Anti-theme, Want & Choice", "Expose the opposing belief, clarify the protagonist's conscious want, and force a choice."],
  ["Initial Plan, Action & New Problem", "Turn the choice into a plan and action that creates a fresh complication."],
  ["Adaptation, Revised Plan & Raised Stakes", "Make the protagonist adapt while the cost of failure increases."],
  ["Choice, Action & Antagonist Hint", "Close Act One with commitment and a clearer glimpse of the opposing force."],
  ["New World & Exploration", "Enter the new situation and reveal its rules, opportunities, and dangers."],
  ["Action, Rising Tension & Problems", "Let the plan create movement, pressure, and additional obstacles."],
  ["Therefore, Choice & Adjusted Plan", "Connect consequence to a new decision and a more informed plan."],
  ["Raised Stakes, Deeper Question & Action", "Increase urgency and deepen the central dramatic question."],
  ["Revelation, Problem & Therefore", "Reveal new information that changes the meaning of the conflict."],
  ["Midpoint Choice & Action", "Force a defining choice, escalate the stakes, and change the direction of the story."],
  ["Consequences & Complications", "Make the protagonist live with earlier choices as the conflict tightens."],
  ["Therefore, Choice & Adjusted Plan", "Use the new complication to force another meaningful adaptation."],
  ["Major Crisis & All Is Lost", "Collapse the current plan and make the cost feel unavoidable."],
  ["Dark Night & Revelation", "Create reflection, doubt, and the insight needed to move forward differently."],
  ["New Choice, Plan & Preparation", "Turn internal change into a concrete plan for the final confrontation."],
  ["Action, Climax & Immediate Result", "Execute the plan and make the confrontation test the protagonist's growth."],
  ["Fallout & New Normal", "Show the immediate consequences and the first shape of the changed world."],
  ["Remaining Questions & Actions", "Resolve lingering plot or relationship questions through action."],
  ["Final Choice & Last Attempt", "Demand a final choice that proves who the protagonist has become."],
  ["Final Action & Ultimate Stakes", "Resolve the remaining external or internal climax."],
  ["Resolution & New Equilibrium", "Settle the central conflicts and reveal the lasting outcome."],
  ["Reflection & Closing Image", "Complete the theme with an image that mirrors or contrasts the opening."],
] as const;

function makeId(prefix: string) {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `${prefix}-${crypto.randomUUID()}`;
  }
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function createBlankProject(): PlotPickleProject {
  const now = new Date().toISOString();
  return {
    schemaVersion: "1.0.0",
    id: makeId("project"),
    metadata: {
      title: "Untitled Story",
      subtitle: "A 24 Blocks project",
      format: "Feature screenplay",
      targetMinutes: 120,
      genre: "",
      tone: "",
      status: "Planning",
      createdAt: now,
      updatedAt: now,
    },
    story: {
      premise: "",
      logline: "",
      theme: "",
      antiTheme: "",
      dramaticQuestion: "",
      hook: "",
      catalyst: "",
      stakes: "",
      ending: "",
      notes: "",
    },
    world: {
      ordinaryWorld: "",
      newWorld: "",
      period: "",
      history: "",
      cultures: "",
      rules: "",
      technology: "",
      visualLanguage: "",
      locations: [],
    },
    characters: [],
    blocks: beatTemplates.map(([title, purpose], index) => ({
      id: `block-${String(index + 1).padStart(2, "0")}`,
      number: index + 1,
      act: Math.floor(index / 6) + 1,
      title,
      purpose,
      summary: "",
      characterIds: [],
      locationIds: [],
      goal: "",
      conflict: "",
      choice: "",
      action: "",
      consequence: "",
      emotionalTurn: "",
      setup: "",
      payoff: "",
      scriptExcerpt: "",
      notes: "",
      visuals: [],
    })),
  };
}

export function cloneProject(project: PlotPickleProject): PlotPickleProject {
  return JSON.parse(JSON.stringify(project)) as PlotPickleProject;
}

export function isPlotPickleProject(value: unknown): value is PlotPickleProject {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<PlotPickleProject>;
  return (
    candidate.schemaVersion === "1.0.0" &&
    typeof candidate.id === "string" &&
    !!candidate.metadata &&
    !!candidate.story &&
    !!candidate.world &&
    Array.isArray(candidate.characters) &&
    Array.isArray(candidate.blocks) &&
    candidate.blocks.length === 24
  );
}

export function completionFor(project: PlotPickleProject) {
  const foundation = [
    project.story.premise,
    project.story.logline,
    project.story.theme,
    project.story.dramaticQuestion,
    project.story.catalyst,
    project.story.stakes,
  ];
  const world = [project.world.ordinaryWorld, project.world.newWorld, project.world.rules];
  const characterScore = project.characters.filter(
    (character) => character.name && character.want && character.need && character.ghost,
  ).length;
  const blockScore = project.blocks.filter(
    (block) => block.summary && block.conflict && (block.action || block.choice),
  ).length;
  const completed =
    foundation.filter(Boolean).length +
    world.filter(Boolean).length +
    Math.min(characterScore, 4) +
    blockScore;
  const total = foundation.length + world.length + 4 + 24;
  return Math.round((completed / total) * 100);
}

export function addBlankCharacter(project: PlotPickleProject): PlotPickleProject {
  const character: Character = {
    id: makeId("character"),
    name: "New Character",
    role: "Supporting character",
    pronouns: "",
    description: "",
    want: "",
    need: "",
    ghost: "",
    fatalFlaw: "",
    strengths: "",
    arc: "",
    voice: "",
    image: "",
    relationships: [],
  };
  return { ...project, characters: [...project.characters, character] };
}

export function addBlankLocation(project: PlotPickleProject): PlotPickleProject {
  const location: Location = {
    id: makeId("location"),
    name: "New Location",
    description: "",
    image: "",
  };
  return { ...project, world: { ...project.world, locations: [...project.world.locations, location] } };
}

export function addBlankFrame(block: StoryBlock): StoryBlock {
  return {
    ...block,
    visuals: [
      ...block.visuals,
      {
        id: makeId("frame"),
        src: "",
        alt: "",
        caption: "New storyboard frame",
        prompt: "",
        shot: "",
        continuity: "",
      },
    ],
  };
}
