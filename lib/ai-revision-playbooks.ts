export type RevisionLayer = "Story First" | "Craft Layer" | "Polish Layer";

export type RevisionOperation =
  | "Ask me focused questions"
  | "Critique only"
  | "Identify evidence and risks"
  | "Suggest alternatives"
  | "Compare two approaches"
  | "Propose a revision for review"
  | "Build a checklist"
  | "Summarize findings";

export type RevisionScope =
  | "Complete project"
  | "Act or sequence"
  | "Block"
  | "Scene"
  | "Mini-block"
  | "Selected screenplay elements"
  | "Character or relationship"
  | "Story Thread"
  | "Pitch or production material";

export type RevisionDestination =
  | "Structure"
  | "DraftLens"
  | "Voiceprint"
  | "Dialogue Lab"
  | "PageFlow"
  | "Resonance"
  | "Story Planner"
  | "Pitch & Review"
  | "Distribution";

export type AiRevisionPlaybook = {
  id: string;
  layer: RevisionLayer;
  title: string;
  problem: string;
  useWhen: string[];
  avoidWhen: string[];
  reads: RevisionScope[];
  defaultOperation: RevisionOperation;
  promptPattern: string;
  evaluation: string[];
  failureModes: string[];
  destination: RevisionDestination;
  searchTerms: string[];
  sourceResources: string[];
};

export const revisionOperations: RevisionOperation[] = [
  "Ask me focused questions",
  "Critique only",
  "Identify evidence and risks",
  "Suggest alternatives",
  "Compare two approaches",
  "Propose a revision for review",
  "Build a checklist",
  "Summarize findings",
];

export const revisionScopes: RevisionScope[] = [
  "Complete project",
  "Act or sequence",
  "Block",
  "Scene",
  "Mini-block",
  "Selected screenplay elements",
  "Character or relationship",
  "Story Thread",
  "Pitch or production material",
];

const playbook = (input: AiRevisionPlaybook) => input;

export const aiRevisionPlaybooks: AiRevisionPlaybook[] = [
  playbook({
    id: "diagnose-only",
    layer: "Story First",
    title: "Diagnose without rewriting",
    problem: "The writer knows something is weak but does not yet know whether the cause is structural, character-based, tonal or local to a scene.",
    useWhen: ["The symptom is clear but the cause is not.", "A rewrite would be premature.", "The writer wants questions and evidence before options."],
    avoidWhen: ["The writer has already chosen a precise repair.", "The task is purely formatting or copy-editing."],
    reads: ["Complete project", "Act or sequence", "Block", "Scene"],
    defaultOperation: "Identify evidence and risks",
    promptPattern: "Using only the supplied project evidence, identify the strongest symptoms, likely root causes, unanswered questions, canon risks and the smallest useful next diagnostic step. Do not rewrite anything.",
    evaluation: ["Every claim points to project evidence.", "Symptoms are separated from root causes.", "Questions are answerable by the writer.", "No unrequested revision is produced."],
    failureModes: ["Generic screenwriting advice", "Invented story facts", "Treating opinion as evidence", "Jumping directly to a rewrite"],
    destination: "DraftLens",
    searchTerms: ["diagnosis", "evidence", "risks", "root cause", "questions"],
    sourceResources: ["Individual Critical", "Individual Intermediate", "Individual Fine-Tuning"],
  }),
  playbook({
    id: "structure-causality",
    layer: "Story First",
    title: "Structure and causality audit",
    problem: "Events occur, but choices, consequences and handoffs do not create a compelling causal chain.",
    useWhen: ["Blocks feel episodic or interchangeable.", "Act turns do not change the plan.", "The midpoint, climax or resolution feels unearned."],
    avoidWhen: ["The structure is stable and the remaining issue is line-level polish."],
    reads: ["Complete project", "Act or sequence", "Block", "Story Thread"],
    defaultOperation: "Critique only",
    promptPattern: "Audit objective, opposition, choice, consequence and handoff at the selected structural level. Distinguish project evidence, diagnosis, unanswered questions, optional alternatives and canon risks. Do not invent new twists unless explicitly requested.",
    evaluation: ["Causality is traced between units.", "Agency and consequence are explicit.", "Alternatives preserve writer intent.", "Act and sequence promises are respected."],
    failureModes: ["Formulaic beat enforcement", "Invented twists", "Confusing chronology with causality", "Rewriting the entire story"],
    destination: "Structure",
    searchTerms: ["structure", "causality", "acts", "sequences", "blocks", "climax", "resolution"],
    sourceResources: ["Structure and Characters", "Critique and Pacing", "Suggested Additions"],
  }),
  playbook({
    id: "character-choice-arc",
    layer: "Story First",
    title: "Character choice and arc audit",
    problem: "A character is present in the plot but lacks agency, changing tactics, relationship movement or a legible arc.",
    useWhen: ["The protagonist reacts more than chooses.", "Relationships reset between scenes.", "The climax does not complete a character movement."],
    avoidWhen: ["The issue is only diction or dialogue rhythm."],
    reads: ["Complete project", "Character or relationship", "Act or sequence", "Block"],
    defaultOperation: "Ask me focused questions",
    promptPattern: "Trace the selected character's objective, choices, tactics, costs, relationship changes and consequences. Ask focused questions first. Then identify evidence, gaps and optional alternatives without changing canon.",
    evaluation: ["Agency is distinguished from activity.", "Choices create consequences.", "Relationships move under pressure.", "The proposed arc remains compatible with the ending."],
    failureModes: ["Psychological diagnosis", "Invented backstory", "Generic likability advice", "Replacing writer intent with a stock arc"],
    destination: "Story Planner",
    searchTerms: ["character", "agency", "arc", "relationship", "objective", "choice"],
    sourceResources: ["Structure and Characters", "Individual Critical", "Individual Intermediate"],
  }),
  playbook({
    id: "scene-purpose-turn",
    layer: "Craft Layer",
    title: "Scene purpose and turn audit",
    problem: "A scene has material but does not enter with pressure, change conditions or hand off strongly.",
    useWhen: ["The scene starts too early or ends too late.", "The objective and opposition are unclear.", "The scene can be removed without consequence."],
    avoidWhen: ["The scene's function is solid and only wording needs polish."],
    reads: ["Scene", "Mini-block", "Selected screenplay elements"],
    defaultOperation: "Build a checklist",
    promptPattern: "Evaluate entry condition, objective, opposition, tactics, turn, consequence and handoff. Cite exact evidence. Build a repair checklist before suggesting alternatives. Do not rewrite by default.",
    evaluation: ["The scene begins in an active condition.", "A turn changes the dramatic situation.", "The exit creates consequence or pressure.", "Advice is playable and specific."],
    failureModes: ["Scene-summary instead of analysis", "Adding dialogue instead of fixing function", "Mistaking louder conflict for stronger conflict"],
    destination: "DraftLens",
    searchTerms: ["scene purpose", "entry", "turn", "handoff", "objective", "opposition"],
    sourceResources: ["Individual Intermediate", "Critique and Pacing"],
  }),
  playbook({
    id: "conflict-stakes-escalation",
    layer: "Story First",
    title: "Conflict, stakes and escalation audit",
    problem: "Opposition repeats rather than evolving, costs remain abstract, or escalation increases spectacle without changing choices.",
    useWhen: ["The middle plateaus.", "Stakes are stated but not dramatized.", "The antagonist pressure does not alter the protagonist's plan."],
    avoidWhen: ["The conflict architecture works and the issue is pacing on the page."],
    reads: ["Complete project", "Act or sequence", "Block", "Story Thread"],
    defaultOperation: "Compare two approaches",
    promptPattern: "Map current opposition, cost, choice and consequence. Compare two escalation approaches that preserve canon and writer intent. Separate evidence, diagnosis, questions, suggestions and risks.",
    evaluation: ["Escalation changes available choices.", "Costs become concrete and cumulative.", "Opposition adapts.", "Alternatives remain causally earned."],
    failureModes: ["Bigger explosions as default escalation", "Invented villains", "Arbitrary death or trauma", "Ignoring existing consequences"],
    destination: "Structure",
    searchTerms: ["conflict", "stakes", "escalation", "opposition", "pressure", "cost"],
    sourceResources: ["Individual Critical", "Critique and Pacing", "Suggested Additions"],
  }),
  playbook({
    id: "dialogue-voiceprint",
    layer: "Craft Layer",
    title: "Dialogue and Voiceprint pass",
    problem: "Dialogue communicates information but does not sound character-specific, playable or pressured.",
    useWhen: ["Characters sound interchangeable.", "Lines state intention directly.", "Rhythm, vocabulary or sentence shape drift from the approved voiceprint."],
    avoidWhen: ["The scene objective or turn is still unresolved."],
    reads: ["Selected screenplay elements", "Character or relationship", "Scene"],
    defaultOperation: "Suggest alternatives",
    promptPattern: "Using the approved Voiceprint and scene pressure, identify evidence of generic or on-the-nose dialogue. Suggest bounded alternatives that preserve facts, intention and formatting. Keep original and proposed text separate.",
    evaluation: ["Voice distinctions are observable.", "Subtext and status remain playable.", "Facts and intention are preserved.", "Alternatives are small enough to review."],
    failureModes: ["Quippy homogenization", "Invented slang", "Changing story facts", "Rewriting the entire scene"],
    destination: "Dialogue Lab",
    searchTerms: ["dialogue", "voiceprint", "voice", "subtext", "status", "rhythm"],
    sourceResources: ["Dialogue", "Individual Fine-Tuning"],
  }),
  playbook({
    id: "subtext-status-silence",
    layer: "Craft Layer",
    title: "Subtext, status and silence pass",
    problem: "Characters say exactly what they mean, status remains static, or silence carries no dramatic action.",
    useWhen: ["Dialogue explains emotion.", "Power shifts are not audible or visible.", "Pauses and omissions could carry pressure."],
    avoidWhen: ["Clarity is the central requirement and concealment would confuse essential plot facts."],
    reads: ["Scene", "Selected screenplay elements", "Character or relationship"],
    defaultOperation: "Suggest alternatives",
    promptPattern: "Identify where direct statement can become playable subtext, status movement or purposeful silence. Cite evidence and offer limited alternatives. Do not obscure essential story information.",
    evaluation: ["The audience can infer the hidden intention.", "Status changes during the exchange.", "Silence has an objective or consequence.", "Clarity is preserved where required."],
    failureModes: ["Making every line cryptic", "Replacing clarity with vagueness", "Using ellipses as fake subtext", "Ignoring performance context"],
    destination: "Voiceprint",
    searchTerms: ["subtext", "status", "silence", "power", "indirect dialogue"],
    sourceResources: ["Dialogue", "Individual Fine-Tuning"],
  }),
  playbook({
    id: "pacing-repetition",
    layer: "Craft Layer",
    title: "Pacing and repetition pass",
    problem: "The draft repeats information, delays turns or uses similar scene shapes without productive variation.",
    useWhen: ["Readers report drag.", "The same point is made in several scenes.", "Escalation stalls between major turns."],
    avoidWhen: ["The story foundation is still changing substantially."],
    reads: ["Complete project", "Act or sequence", "Block", "Scene", "Selected screenplay elements"],
    defaultOperation: "Identify evidence and risks",
    promptPattern: "Locate repeated information, delayed turns, redundant exchanges and pacing plateaus using page, scene, line, word, duration and structural evidence. Recommend cuts, combines or relocations without applying them.",
    evaluation: ["Every redundancy claim cites evidence.", "Compression preserves setup and payoff.", "Pacing advice respects genre and tone.", "Cuts do not break continuity."],
    failureModes: ["Arbitrary percentage cuts", "Treating all quiet scenes as slow", "Removing deliberate repetition", "Ignoring setup/payoff dependencies"],
    destination: "DraftLens",
    searchTerms: ["pacing", "repetition", "redundancy", "streamlining", "economy", "duration"],
    sourceResources: ["Critique and Pacing", "Redundancy and Streamlining", "Individual Fine-Tuning"],
  }),
  playbook({
    id: "visual-pageflow",
    layer: "Craft Layer",
    title: "Visual action and PageFlow pass",
    problem: "Action lines explain ideas rather than showing playable images, sound, behaviour and spatial change.",
    useWhen: ["Pages read like prose or summary.", "Action paragraphs hide key beats.", "Visual and sound choices do not support the scene turn."],
    avoidWhen: ["The scene's dramatic function is unresolved."],
    reads: ["Scene", "Selected screenplay elements", "Block"],
    defaultOperation: "Suggest alternatives",
    promptPattern: "Identify non-playable explanation, buried visual beats, weak sensory selection and action-line density. Suggest concise alternatives while preserving facts, sequence and writer voice. Keep before and after separate.",
    evaluation: ["Action is filmable.", "Paragraphing supports reading rhythm.", "Visual and sound choices serve the turn.", "No production detail is invented as fact."],
    failureModes: ["Purple prose", "Shot-listing without need", "Invented blocking", "Erasing the writer's voice"],
    destination: "PageFlow",
    searchTerms: ["visual writing", "action lines", "PageFlow", "sound", "sensory", "readability"],
    sourceResources: ["Individual Intermediate", "Individual Fine-Tuning", "Suggested Additions"],
  }),
  playbook({
    id: "theme-motif-foreshadowing",
    layer: "Craft Layer",
    title: "Theme, motif and foreshadowing pass",
    problem: "Theme is stated rather than dramatized, motifs are decorative, or payoffs lack prepared evidence.",
    useWhen: ["The ending carries an idea the earlier story has not earned.", "Motifs repeat without changing meaning.", "Foreshadowing is absent or too obvious."],
    avoidWhen: ["The writer has not yet chosen the story's dramatic question or ending."],
    reads: ["Complete project", "Story Thread", "Act or sequence", "Block"],
    defaultOperation: "Ask me focused questions",
    promptPattern: "Trace dramatic question, thematic pressure, motif appearances, irony, setup and payoff. Ask focused questions, then identify evidence and optional reinforcement points without inventing a theme for the writer.",
    evaluation: ["Theme emerges from choices and consequences.", "Motifs change meaning.", "Foreshadowing remains subtle but legible.", "Payoffs use established evidence."],
    failureModes: ["Declaring a theme as objective truth", "Adding symbols everywhere", "Over-signalling twists", "Replacing ambiguity with explanation"],
    destination: "Resonance",
    searchTerms: ["theme", "motif", "foreshadowing", "irony", "dramatic question", "payoff"],
    sourceResources: ["Suggested Additions", "Individual Intermediate", "Individual Fine-Tuning"],
  }),
  playbook({
    id: "genre-world-continuity",
    layer: "Craft Layer",
    title: "Genre, world and continuity pass",
    problem: "World rules, genre promises or story facts conflict, disappear or fail to shape choices.",
    useWhen: ["Rules change for convenience.", "Genre expectations are promised but not developed.", "Character knowledge, props, locations or chronology drift."],
    avoidWhen: ["The task requires external factual verification rather than internal consistency."],
    reads: ["Complete project", "Story Thread", "Character or relationship", "Act or sequence", "Block"],
    defaultOperation: "Identify evidence and risks",
    promptPattern: "Audit approved world rules, genre promises, chronology, character knowledge and continuity dependencies. Separate internal evidence from facts requiring human research. Do not treat AI output as verification.",
    evaluation: ["Rules are sourced from canon.", "Contradictions are precisely located.", "Genre advice respects the selected project.", "Research questions are clearly marked."],
    failureModes: ["Invented lore", "Genre stereotyping", "Treating plausibility as verified fact", "Changing canon to solve a contradiction"],
    destination: "Story Planner",
    searchTerms: ["genre", "world", "continuity", "canon", "chronology", "rules"],
    sourceResources: ["Structure and Characters", "Suggested Additions", "Individual Intermediate"],
  }),
  playbook({
    id: "representation-research",
    layer: "Craft Layer",
    title: "Representation and research-question pass",
    problem: "The project touches lived experience, culture, identity, history or specialist knowledge that requires informed human review.",
    useWhen: ["The writer needs to identify assumptions or research gaps.", "Authenticity questions should be routed to people and sources."],
    avoidWhen: ["The writer expects AI to certify accuracy, authenticity or cultural safety."],
    reads: ["Complete project", "Character or relationship", "Scene", "Story Thread"],
    defaultOperation: "Build a checklist",
    promptPattern: "Identify statements, portrayals and assumptions that require research or informed human review. Build a question checklist and distinguish project evidence, uncertainty and verification needs. Do not certify authenticity.",
    evaluation: ["Uncertainty is explicit.", "Questions are specific and researchable.", "Human review is required where appropriate.", "No group is treated as monolithic."],
    failureModes: ["Claiming cultural authority", "Stereotype substitution", "False factual certainty", "Using sensitivity language as a guarantee"],
    destination: "Story Planner",
    searchTerms: ["representation", "culture", "research", "authenticity", "verification", "human review"],
    sourceResources: ["Individual Critical", "Suggested Additions", "ChatGPT Tips"],
  }),
  playbook({
    id: "formatting-readability",
    layer: "Polish Layer",
    title: "Formatting and readability pass",
    problem: "Screenplay formatting, action-line density, transitions or element consistency interfere with professional reading.",
    useWhen: ["The story and scene movement are stable.", "Formatting inconsistencies distract from the read.", "The writer wants a bounded technical checklist."],
    avoidWhen: ["The draft still needs structural repair."],
    reads: ["Selected screenplay elements", "Scene", "Complete project"],
    defaultOperation: "Build a checklist",
    promptPattern: "Audit screenplay element types, formatting consistency, action-line density, transitions, voiceover, narration and readability. Return evidence and a checklist. Do not alter story content automatically.",
    evaluation: ["Advice follows screenplay conventions.", "Technical fixes remain separate from creative changes.", "Readability is measured with relevant evidence.", "No arbitrary character-count target is imposed."],
    failureModes: ["Treating one house style as universal law", "Changing wording during a format audit", "Arbitrary length targets", "Ignoring intentional exceptions"],
    destination: "PageFlow",
    searchTerms: ["formatting", "readability", "action-line economy", "transitions", "voiceover", "narration"],
    sourceResources: ["Individual Fine-Tuning", "Redundancy and Streamlining"],
  }),
  playbook({
    id: "pitch-audience-language",
    layer: "Polish Layer",
    title: "Pitch, synopsis and audience-language pass",
    problem: "Audience-facing materials are vague, overlong or disconnected from the approved story promise.",
    useWhen: ["The screenplay direction is stable.", "The writer needs a logline, synopsis, pitch or distribution description."],
    avoidWhen: ["The screenplay itself still needs structural repair.", "Marketing language would be mixed into screenplay editing."],
    reads: ["Pitch or production material", "Complete project"],
    defaultOperation: "Compare two approaches",
    promptPattern: "Using only approved project facts, compare two audience-facing approaches for the selected material. Separate evidence, audience promise, optional language and claims requiring verification. Route approved copy to Pitch & Review or Distribution, never into screenplay pages.",
    evaluation: ["The central promise is accurate.", "No unsupported claim is added.", "Audience language matches the intended destination.", "Screenplay text remains untouched."],
    failureModes: ["Invented accolades or comparisons", "Spoiler-heavy copy", "Generic hype", "Applying marketing copy to screenplay dialogue or action"],
    destination: "Pitch & Review",
    searchTerms: ["pitch", "synopsis", "logline", "audience", "marketing", "distribution"],
    sourceResources: ["Copywriting and Marketing", "ChatGPT Tips"],
  }),
];

export const legacyPromptSourceMap = [
  { source: "ChatGPT Tips", playbooks: ["diagnose-only", "representation-research", "pitch-audience-language"] },
  { source: "Individual Critical", playbooks: ["diagnose-only", "character-choice-arc", "conflict-stakes-escalation", "representation-research"] },
  { source: "Individual Intermediate", playbooks: ["diagnose-only", "scene-purpose-turn", "visual-pageflow", "theme-motif-foreshadowing", "genre-world-continuity"] },
  { source: "Individual Fine-Tuning", playbooks: ["diagnose-only", "dialogue-voiceprint", "subtext-status-silence", "pacing-repetition", "visual-pageflow", "formatting-readability"] },
  { source: "Critique and Pacing", playbooks: ["structure-causality", "scene-purpose-turn", "conflict-stakes-escalation", "pacing-repetition"] },
  { source: "Copywriting and Marketing", playbooks: ["pitch-audience-language"] },
  { source: "Redundancy and Streamlining", playbooks: ["pacing-repetition", "formatting-readability"] },
  { source: "Structure and Characters", playbooks: ["structure-causality", "character-choice-arc", "genre-world-continuity"] },
  { source: "Suggested Additions", playbooks: ["structure-causality", "conflict-stakes-escalation", "visual-pageflow", "theme-motif-foreshadowing", "genre-world-continuity", "representation-research"] },
  { source: "Dialogue", playbooks: ["dialogue-voiceprint", "subtext-status-silence"] },
];

export const revisionResponseContract = [
  "Project evidence",
  "Diagnosis",
  "Unanswered questions",
  "Optional suggestions",
  "Continuity or canon risks",
  "Material requiring human verification",
  "Proposed changes only when requested",
];

export function buildGuidedRevisionPrompt(input: {
  playbook: AiRevisionPlaybook;
  operation: RevisionOperation;
  scopes: RevisionScope[];
  contextSummary: string;
  writerGoal?: string;
  includedFacts?: string[];
  canonLocks?: string[];
}) {
  const revisionRequested = input.operation === "Propose a revision for review";
  return [
    "You are assisting a screenwriter inside PlotPickle. Remain provider-independent and preserve writer authorship.",
    `Pass: ${input.playbook.title}`,
    `Layer: ${input.playbook.layer}`,
    `Operation: ${input.operation}`,
    `Canonical scope: ${input.scopes.join(", ") || "No scope selected"}`,
    `Writer goal: ${input.writerGoal?.trim() || input.playbook.problem}`,
    `Project context:\n${input.contextSummary}`,
    `Included facts: ${(input.includedFacts || []).join("; ") || "Use only the supplied project context."}`,
    `Canon locks: ${(input.canonLocks || []).join("; ") || "Do not change approved facts, identities, relationships, chronology or world rules."}`,
    `Pass instructions: ${input.playbook.promptPattern}`,
    `Return clearly labelled sections for: ${revisionResponseContract.join("; ")}.`,
    revisionRequested
      ? "When proposing a revision, preserve the original, provide the proposed version separately, explain the change, list affected dependencies and state that approval is required before application."
      : "Do not produce replacement screenplay text. Diagnosis and repair remain separate unless the writer explicitly chooses Propose a revision for review.",
    "Never apply changes automatically. Keep manual-copy and no-AI use possible.",
  ].join("\n\n");
}

export function revisionPlaybookSearchText(playbook: AiRevisionPlaybook) {
  return [
    playbook.layer,
    playbook.title,
    playbook.problem,
    ...playbook.useWhen,
    ...playbook.avoidWhen,
    ...playbook.reads,
    playbook.defaultOperation,
    playbook.promptPattern,
    ...playbook.evaluation,
    ...playbook.failureModes,
    playbook.destination,
    ...playbook.searchTerms,
    ...playbook.sourceResources,
  ].join(" ").toLowerCase();
}
