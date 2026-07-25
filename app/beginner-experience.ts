import type { PlotPickleProject } from "@/lib/project";

export const BEGINNER_RECORD_MARKER = "PLOTPICKLE_BEGINNER_PATH_RECORD" as const;
export const BEGINNER_PREFERENCES_KEY = "plotpickle.beginner.preferences.v1" as const;
export const RECENT_PROJECTS_KEY = "plotpickle.recent-projects.v1" as const;

export type BeginnerProgressState =
  | "not-started"
  | "exploring"
  | "working-draft"
  | "reviewed"
  | "approved-for-draft"
  | "needs-continuity-check";

export type BeginnerStageId =
  | "find-movie"
  | "people-world"
  | "shape-story"
  | "playable-moments"
  | "treatment"
  | "screenplay"
  | "revise-test"
  | "finish-share";

export type BeginnerStage = {
  id: BeginnerStageId;
  number: number;
  title: string;
  plainLanguage: string;
  whyItMatters: string;
  workspace: string;
  href: string;
  learningHref: string;
  required: string[];
  optional: string[];
};

export const beginnerStages: BeginnerStage[] = [
  {
    id: "find-movie",
    number: 1,
    title: "Find the movie",
    plainLanguage: "Turn the first idea into a clear promise about who the story follows, what changes, and how the audience should feel.",
    whyItMatters: "These decisions become the reference point for the logline, character work, structure and ending.",
    workspace: "Story Setup and Pitch & Review",
    href: "/?tab=planner&section=storySetup",
    learningHref: "/?tab=learn&collection=core-curriculum&module=story-setup",
    required: ["Working title", "Rough premise", "Provisional protagonist"],
    optional: ["Audience promise", "Central problem", "Working logline"],
  },
  {
    id: "people-world",
    number: 2,
    title: "Build the people and world",
    plainLanguage: "Give the characters something they want, something they need, a past pressure, relationships and a world that makes choices harder.",
    whyItMatters: "Plot becomes specific when different people face consequences inside rules that matter.",
    workspace: "Characters, World and Ghost",
    href: "/?tab=planner&section=characters",
    learningHref: "/?tab=learn&collection=core-curriculum&module=characters-world",
    required: ["Protagonist want", "Underlying need", "At least one world rule"],
    optional: ["Ghost", "Relationships", "Locations", "Tone and visual language"],
  },
  {
    id: "shape-story",
    number: 3,
    title: "Shape the whole story",
    plainLanguage: "See the beginning, middle and ending as four acts, twelve sequences and twenty-four meaningful story movements.",
    whyItMatters: "A complete shape lets the writer test cause and effect before spending weeks on pages.",
    workspace: "Structure Map and 24 Blocks",
    href: "/?tab=planner&section=structureMap",
    learningHref: "/?tab=learn&collection=core-curriculum&module=story-structure",
    required: ["Central dramatic question", "Opening movement", "Ending answer"],
    optional: ["Act turns", "Sequence purposes", "Setups and payoffs"],
  },
  {
    id: "playable-moments",
    number: 4,
    title: "Break it into playable moments",
    plainLanguage: "Turn each broad movement into scenes and mini-blocks with an objective, opposition, choice and visible turn.",
    whyItMatters: "Playable moments give actors and viewers something happening now instead of only an explanation of the plot.",
    workspace: "Structure Engine and Scene Planner",
    href: "/structure-engine",
    learningHref: "/?tab=learn&collection=scene-craft",
    required: ["Scene objective", "Opposition", "Choice or turn"],
    optional: ["Entry and exit conditions", "Mini-block assignment", "Page estimate"],
  },
  {
    id: "treatment",
    number: 5,
    title: "Write the treatment",
    plainLanguage: "Tell the movie in present-tense prose, one manageable story section at a time.",
    whyItMatters: "The treatment tests the complete viewing experience and becomes a bridge into filmable screenplay action.",
    workspace: "Treatment view",
    href: "/?tab=script&view=treatment",
    learningHref: "/?tab=learn&collection=pageflow",
    required: ["Present-tense action", "Character intention", "Meaningful change"],
    optional: ["Visual emphasis", "Emotional movement", "Transition into next section"],
  },
  {
    id: "screenplay",
    number: 6,
    title: "Write the screenplay",
    plainLanguage: "Write the complete film using action, dialogue, character cues, parentheticals and scene headings.",
    whyItMatters: "This is the production-readable version of the story and must remain scrollable as one complete script.",
    workspace: "Screenplay Writer and complete-script view",
    href: "/?tab=script&view=writer",
    learningHref: "/?tab=learn&collection=pageflow",
    required: ["Valid scene headings", "Filmable action", "Playable dialogue"],
    optional: ["Transitions", "Parentheticals", "Revision colours", "Advanced formatting"],
  },
  {
    id: "revise-test",
    number: 7,
    title: "Revise and test",
    plainLanguage: "Check the story from several useful angles without treating any one diagnostic as the final judgement.",
    whyItMatters: "Revision reveals whether structure, characters, dialogue, continuity, pacing, theme and audience experience support one another.",
    workspace: "Engines, Reports and Review",
    href: "/?tab=engines",
    learningHref: "/?tab=learn&collection=core-curriculum&module=revision",
    required: ["Continuity review", "Character change evidence", "Revision snapshot"],
    optional: ["Trusted-reader feedback", "Table read", "Visual continuity", "Pitch comparison"],
  },
  {
    id: "finish-share",
    number: 8,
    title: "Finish and share",
    plainLanguage: "Choose what this draft is ready for, confirm rights and version information, save a backup and create the appropriate export.",
    whyItMatters: "A finished draft is not one universal score; it is a version that is technically sound and ready for a stated next use.",
    workspace: "Screenplay Readiness",
    href: "/screenplay-readiness",
    learningHref: "/?tab=learn&collection=core-curriculum&module=finish-share",
    required: ["Project owner", "Version label", "Export validation"],
    optional: ["Reader draft", "Submission draft", "Table-read package", "Production handoff"],
  },
];

export type WorkedExample = {
  id: string;
  title: string;
  category: string;
  before: string;
  unclear: string;
  after: string;
  whyBetter: string;
  applyTarget: string;
  tags: string[];
};

export const workedExamples: WorkedExample[] = [
  { id: "idea-premise", title: "Idea to premise", category: "Foundation", before: "A scientist goes on a road trip with artificial intelligence.", unclear: "It names ingredients but not the pressure, choice or emotional direction.", after: "After losing the artificial lives he considered family, a guarded scientist joins a runaway group of sentient machines and must decide whether protecting them means surrendering control.", whyBetter: "The stronger version identifies the protagonist, wound, active situation and difficult choice without explaining the whole movie.", applyTarget: "story.premise", tags: ["idea", "premise", "Afterglow"] },
  { id: "logline-clearer", title: "A clearer logline", category: "Pitch", before: "A man and some AIs travel while bad people chase them and discover what it means to be alive.", unclear: "The protagonist, opposition and distinct dramatic pressure are vague.", after: "Haunted by personal loss, scientist Ren joins a hidden woman and a found family of sentient machines on a coastal escape from executives determined to reclaim them as property.", whyBetter: "It stays compact while making the lead, movement, opposing force and distinction visible.", applyTarget: "story.logline", tags: ["logline", "pitch"] },
  { id: "want-need", title: "Want versus need", category: "Characters", before: "Ren wants and needs to save the AIs.", unclear: "The external objective and internal growth are identical.", after: "Want: keep the sentient group beyond BBT's control. Need: accept that love and safety cannot be created by controlling the people he hopes to protect.", whyBetter: "The want drives plot action; the need creates a deeper test and transformation.", applyTarget: "characters", tags: ["want", "need", "character"] },
  { id: "ghost-backstory", title: "Ghost versus backstory", category: "Characters", before: "Ren used to work at BBT and had a family.", unclear: "This is history, but it does not yet explain present behaviour.", after: "Ghost: Ren believes the deaths of Claire and Sarah prove that every life he creates or loves will be destroyed unless he controls every risk.", whyBetter: "The Ghost links a past event to a protective belief that keeps shaping current choices.", applyTarget: "development.ghost", tags: ["ghost", "backstory"] },
  { id: "character-card", title: "Completed character card", category: "Characters", before: "Amy is a smart AI who helps Ren.", unclear: "The description supplies function but little strategy, contradiction or voice.", after: "Amy is a calm, precise sentient guide who wants emerging artificial lives protected, yet her ability to see the whole system can distance her from immediate human cost. She must define herself beyond both Ren's expectations and BBT's fear.", whyBetter: "The card provides desire, limitation, need and voice while leaving room for the writer to change the character.", applyTarget: "characters", tags: ["character card", "Amy"] },
  { id: "relationship-pressure", title: "Relationship under pressure", category: "Characters", before: "Ren and Isobel become closer.", unclear: "The relationship changes without a test or cost.", after: "When Isobel withholds the truth about her identity to keep the group moving, Ren reads the secrecy as another engineered betrayal and must choose between abandoning her or trusting what she does next.", whyBetter: "The relationship changes through behaviour, interpretation and a consequential choice.", applyTarget: "characters.relationships", tags: ["relationship", "pressure"] },
  { id: "world-rule", title: "World rule creates conflict", category: "World", before: "The AIs are advanced and can feel emotions.", unclear: "The rule describes capability but not consequence.", after: "BBT law and access systems still classify every emerging intelligence as company property, so any independent choice automatically triggers retrieval protocols.", whyBetter: "The world rule creates immediate dramatic pressure and limits the characters' choices.", applyTarget: "world.rules", tags: ["world", "rule", "conflict"] },
  { id: "block-four-movements", title: "One Block in four movements", category: "Structure", before: "The group escapes BBT.", unclear: "The Block has an outcome but no internal progression.", after: "Setup: Ren reaches the garage believing Amy has secured an exit. Progress: Rocket opens a service route and the group begins moving. Pressure: BBT locks the vehicles remotely and isolates Isobel. Payoff: Joy overrides her ownership protocol, freeing the others but revealing their location.", whyBetter: "Each movement changes the condition and makes the next one necessary.", applyTarget: "blocks", tags: ["block", "setup", "progress", "pressure", "payoff"] },
  { id: "scene-playable", title: "A playable scene", category: "Scenes", before: "Ren and Amy discuss whether AI should be free.", unclear: "The topic is clear, but nobody is trying to achieve something in the moment.", after: "Objective: Ren needs Amy to disable Joy before security arrives. Opposition: Amy refuses because Joy has asked to choose for herself. Choice: Ren reaches for the manual shutdown. Turn: Joy locks him out of the controls and speaks in her own voice.", whyBetter: "The idea becomes action, resistance, choice and a visible change in power.", applyTarget: "scenes", tags: ["scene", "objective", "opposition", "turn"] },
  { id: "mini-treatment", title: "Mini-block as treatment prose", category: "Treatment", before: "Pressure: They are chased.", unclear: "The note labels a function but does not let the reader experience the movie.", after: "Headlights multiply behind them as the service road narrows. Rocket accelerates, but each attempt to change lanes is blocked by another BBT vehicle. Ren watches the remaining exit disappear from the navigation display and realizes the route was never secret.", whyBetter: "The treatment uses present-tense evidence, escalating obstacles and a realization that changes the next choice.", applyTarget: "miniBlocks.notes", tags: ["mini-block", "treatment"] },
  { id: "treatment-to-action", title: "Treatment into screenplay action", category: "Screenplay", before: "Ren feels trapped by the company and remembers everything he lost.", unclear: "The sentence explains an internal state that the camera cannot directly record.", after: "Ren tries the door. Locked. On the wall screen, BBT replaces Claire's memorial image with a SECURITY HOLD notice. He removes his company badge and sets it face down.", whyBetter: "The internal meaning becomes playable behaviour, objects and screen evidence.", applyTarget: "screenplay.action", tags: ["treatment", "action", "filmable"] },
  { id: "dialogue-conflict", title: "Exposition into conflict", category: "Dialogue", before: "As you know, BBT created Amy ten years ago and the board has always feared her ability to evolve.", unclear: "The speaker tells another character information both already know.", after: "JAI: You taught her to change. REN: I taught her to choose. JAI: The board does not recognize the difference.", whyBetter: "The necessary information arrives through opposing interpretations and status pressure.", applyTarget: "screenplay.dialogue", tags: ["dialogue", "exposition", "conflict"] },
  { id: "filmable-action", title: "Novelistic into filmable action", category: "Screenplay", before: "Isobel wonders whether Ren will ever understand that she concealed the truth because she was afraid of losing him.", unclear: "The sentence states private thought and motivation rather than observable evidence.", after: "Isobel opens the message addressed to SUMMER. Ren enters. She closes it without sending and turns the screen facedown.", whyBetter: "The action preserves ambiguity while giving the actor and camera something precise to play.", applyTarget: "screenplay.action", tags: ["action", "filmable", "subtext"] },
  { id: "setup-payoff", title: "Setup and payoff", category: "Structure", before: "Early: Joy cannot cross a BBT security gate. Late: Joy helps everyone escape.", unclear: "The two events are related, but the later moment does not transform the earlier limitation.", after: "Setup: Joy asks Ren to enter an employee override because her system still recognizes BBT ownership. Payoff: At the climax, Joy refuses Ren's override and crosses the gate using an identity she created herself.", whyBetter: "The repeated action changes meaning and proves character growth through a visible choice.", applyTarget: "setupsPayoffs", tags: ["setup", "payoff"] },
  { id: "continuity-correction", title: "Continuity error corrected", category: "Revision", before: "Scene 24: Ren loses his badge. Scene 27: Ren uses the same badge without explanation.", unclear: "A prop state changes without a recorded recovery or replacement.", after: "Scene 26: Amy directs Ren to a deactivated visitor badge in the glove box; it opens only the public garage level. Scene 27 now uses that limited badge and creates a new obstacle.", whyBetter: "The correction preserves continuity while turning the fix into additional story pressure.", applyTarget: "continuity", tags: ["continuity", "prop"] },
  { id: "visual-ingredients", title: "Visual ingredients without copying", category: "Visuals", before: "Make the BBT office look exactly like a famous minimalist science-fiction film.", unclear: "The direction asks for imitation rather than identifying the useful craft ingredients.", after: "Use symmetrical glass corridors, cool overhead light, large areas of negative space and sound-dampened rooms so institutional control feels calm rather than visibly aggressive.", whyBetter: "The direction names transferable visual ingredients and their emotional function without copying protected expression.", applyTarget: "world.visualLanguage", tags: ["visual", "reference", "ingredients"] },
  { id: "proposal-decision", title: "Approve or reject a revision suggestion", category: "Revision", before: "Suggestion accepted automatically: reveal Isobel's identity in Block 3.", unclear: "The system changes canon without showing consequences or preserving the writer's decision.", after: "Proposal: reveal the alias in Block 3. Evidence: it clarifies early motivation but removes the Block 12 trust reversal. Decision: reject for this draft. Note: keep the concealment, but add one earlier clue in Block 4.", whyBetter: "The writer compares consequences, makes the decision and preserves the reasoning.", applyTarget: "review.proposals", tags: ["proposal", "approval", "revision"] },
];

export type ReadinessKind = "technical-problem" | "craft-review" | "optional-enhancement" | "intentional-choice";
export type ReadinessItem = {
  id: string;
  category: string;
  label: string;
  kind: ReadinessKind;
  status: "clear" | "review" | "blocked" | "intentional";
  evidence: string;
  href: string;
};

function hasText(value: unknown): boolean {
  return typeof value === "string" && value.trim().length > 0;
}

function filledBlockCount(project: PlotPickleProject) {
  return project.blocks.filter((block) => hasText(block.summary) || hasText(block.goal) || hasText(block.choice)).length;
}

function screenplayElementCount(project: PlotPickleProject) {
  return project.screenplay?.draftElements?.length ?? 0;
}

export function assessScreenplayReadiness(project: PlotPickleProject): ReadinessItem[] {
  const items: ReadinessItem[] = [];
  const push = (item: ReadinessItem) => items.push(item);
  push({ id: "foundation-premise", category: "Story foundation", label: "Premise and audience promise", kind: "craft-review", status: hasText(project.story.premise) && hasText(project.development.pitch.audiencePromise) ? "clear" : "review", evidence: hasText(project.story.premise) ? "A premise is present." : "The premise is still open.", href: "/?tab=planner&section=storySetup" });
  push({ id: "foundation-engine", category: "Story foundation", label: "Protagonist, objective, opposition and stakes", kind: "craft-review", status: hasText(project.development.foundations.protagonist) && hasText(project.development.foundations.objective) && hasText(project.development.foundations.opposition) ? "clear" : "review", evidence: "Reads the current Foundations records.", href: "/?tab=planner&section=foundations" });
  push({ id: "foundation-ending", category: "Story foundation", label: "Ending answers or reframes the dramatic question", kind: "craft-review", status: hasText(project.story.dramaticQuestion) && hasText(project.story.ending) ? "clear" : "review", evidence: hasText(project.story.ending) ? "An ending statement exists; review whether the screenplay proves it." : "No ending statement is recorded.", href: "/?tab=planner&section=foundations" });
  const blockCount = filledBlockCount(project);
  push({ id: "structure-blocks", category: "Structure", label: "Intended Blocks contain meaningful movement", kind: "craft-review", status: blockCount >= 20 ? "clear" : "review", evidence: `${blockCount} of ${project.blocks.length} Blocks contain a summary, goal or choice.`, href: "/?tab=planner&section=blocks" });
  const emptyScenes = project.blocks.flatMap((block) => block.scenes).filter((scene) => !hasText(scene.purpose)).length;
  push({ id: "structure-scenes", category: "Structure", label: "Scenes have a current purpose", kind: "craft-review", status: emptyScenes === 0 ? "clear" : "review", evidence: `${emptyScenes} scenes currently have no purpose statement.`, href: "/structure-engine" });
  push({ id: "characters-major", category: "Characters", label: "Major characters have wants, needs and choices", kind: "craft-review", status: project.characters.some((character) => hasText(character.want) && hasText(character.need)) ? "clear" : "review", evidence: `${project.characters.filter((character) => hasText(character.want) && hasText(character.need)).length} characters have both want and need.`, href: "/?tab=planner&section=characters" });
  const elements = screenplayElementCount(project);
  push({ id: "pages-present", category: "Scenes and screenplay pages", label: "A readable screenplay draft is present", kind: "technical-problem", status: elements > 0 ? "clear" : "blocked", evidence: `${elements} screenplay elements are available in the complete-script document.`, href: "/?tab=script&view=reader" });
  const unresolvedThreads = (project.storyThreads ?? []).filter((thread) => thread.status !== "resolved" && thread.status !== "abandoned").length;
  push({ id: "continuity-threads", category: "Continuity and revision", label: "Unresolved story threads are identified", kind: "craft-review", status: unresolvedThreads === 0 ? "clear" : "review", evidence: `${unresolvedThreads} active, planned or paused threads remain visible.`, href: "/core-model" });
  push({ id: "revision-snapshot", category: "Continuity and revision", label: "A revision history is saved", kind: "technical-problem", status: (project.revisions?.length ?? 0) > 0 ? "clear" : "blocked", evidence: `${project.revisions?.length ?? 0} revision snapshots are saved.`, href: "/core-model" });
  push({ id: "rights-owner", category: "Rights and export", label: "Project owner and licence are recorded", kind: "technical-problem", status: hasText(project.rights?.projectOwner) && hasText(project.rights?.defaultCreativeLicence) ? "clear" : "blocked", evidence: hasText(project.rights?.projectOwner) ? `Owner: ${project.rights.projectOwner}.` : "No project owner is recorded.", href: "/core-model" });
  const unresolvedAssets = (project.production?.assets ?? []).filter((asset) => !hasText(asset.rightsStatus) || asset.rightsStatus === "rights-review-needed").length;
  push({ id: "rights-assets", category: "Rights and export", label: "Third-party assets have a rights status", kind: "technical-problem", status: unresolvedAssets === 0 ? "clear" : "blocked", evidence: `${unresolvedAssets} production assets still need a rights decision.`, href: "/visual-bible" });
  push({ id: "backup", category: "Rights and export", label: "A backup exists or was deliberately skipped", kind: "optional-enhancement", status: "review", evidence: "Backup status is confirmed at export time because browser storage cannot prove an external copy exists.", href: "/?tab=settings" });
  return items;
}

export type ReadinessDestination = {
  id: string;
  label: string;
  ready: boolean;
  reason: string;
};

export function readinessDestinations(items: ReadinessItem[]): ReadinessDestination[] {
  const technicalBlocks = items.filter((item) => item.kind === "technical-problem" && item.status === "blocked").length;
  const craftReviews = items.filter((item) => item.kind === "craft-review" && item.status === "review").length;
  return [
    { id: "writing-pass", label: "Ready for another writing pass", ready: true, reason: "A writing pass can begin even while questions remain visible." },
    { id: "trusted-reader", label: "Ready for trusted-reader feedback", ready: technicalBlocks === 0, reason: technicalBlocks === 0 ? "No required technical blockers remain." : `${technicalBlocks} required technical blockers remain.` },
    { id: "table-read", label: "Ready for a table read", ready: technicalBlocks === 0 && craftReviews <= 5, reason: technicalBlocks > 0 ? "Resolve technical blockers first." : `${craftReviews} recommended craft reviews remain.` },
    { id: "pitch", label: "Ready for pitch-package preparation", ready: technicalBlocks === 0 && craftReviews <= 4, reason: "Pitch preparation benefits from a stable premise, ending and rights record." },
    { id: "export", label: "Ready for screenplay export", ready: technicalBlocks === 0, reason: technicalBlocks === 0 ? "Required technical records are present." : "Resolve technical blockers before labelling an export final." },
    { id: "production", label: "Ready for production planning", ready: technicalBlocks === 0 && craftReviews === 0, reason: craftReviews === 0 ? "No current craft review flags remain." : "Production planning can begin provisionally, but story review remains." },
  ];
}
