import { cloneProject, type LoglineCandidate, type PlotPickleProject, type RevisionSnapshot } from "./project";

export type LoglinePurpose = "development" | "submission" | "pitch-deck" | "public-teaser" | "collaborator-brief" | "custom";
export type LoglineShape = "causal-engine" | "irony-contradiction" | "relationship-pressure" | "world-rule-pressure" | "mystery-thriller" | "dual-ensemble" | "character-first";
export type LoglineSourceType = "manual" | "workshop" | "imported-suggestion" | "ai-proposal";
export type LoglineReviewStatus = "draft" | "reviewing" | "approved-primary" | "approved-variant" | "superseded";
export type LoglineEvidenceState = "sentence-supported" | "review" | "intentional-omission" | "project-only";
export type LoglineEvidenceGroup = "Core dramatic engine" | "Promise and distinction" | "Clarity and delivery";

export type LoglineIngredients = {
  protagonist: string;
  identity: string;
  disruption: string;
  goal: string;
  opposition: string;
  stakes: string;
  genre: string;
  tone: string;
  worldRule: string;
  relationshipPressure: string;
  urgency: string;
  distinction: string;
  withheld: string;
};

export type LoglineCandidateMetadata = {
  purpose?: LoglinePurpose;
  customPurpose?: string;
  intendedAudience?: string;
  shape?: LoglineShape;
  ingredients?: Partial<LoglineIngredients>;
  rationale?: string;
  linkedProjectEvidence?: string[];
  deliberateOmissions?: string[];
  wordCount?: number;
  writerNotes?: string;
  reviewStatus?: LoglineReviewStatus;
  updatedAt?: string;
  sourceType?: LoglineSourceType;
  importedEvidence?: string[];
  uncertainInterpretations?: string[];
};

export type PurposeAwareLoglineCandidate = LoglineCandidate & LoglineCandidateMetadata;

export type LoglinePurposeDefinition = {
  id: LoglinePurpose;
  label: string;
  audience: string;
  guidance: string;
  disclosure: string;
  suggestedLength: string;
};

export type LoglineShapeDefinition = {
  id: LoglineShape;
  label: string;
  explanation: string;
  bestFor: string;
};

export type LoglineAlternative = {
  shape: LoglineShape;
  label: string;
  text: string;
  rationale: string;
  communicated: string[];
  omitted: string[];
  addedAssumptions: string[];
};

export type LoglineEvidenceItem = {
  id: string;
  group: LoglineEvidenceGroup;
  label: string;
  question: string;
  state: LoglineEvidenceState;
  sentenceEvidence: string;
  projectEvidence: string;
  guidance: string;
  optional: boolean;
};

export type LoglineEvidenceResult = {
  wordCount: number;
  supportedCount: number;
  coreSupportedCount: number;
  label: "Core engine visible" | "Promise developing" | "Review the missing evidence";
  items: LoglineEvidenceItem[];
};

export type LoglineApprovalTargets = {
  primary: boolean;
  oneSentencePitch: boolean;
  pitchPackage: boolean;
  purposeVariant: boolean;
  createRevisionSnapshot: boolean;
};

export const loglinePurposes: LoglinePurposeDefinition[] = [
  { id: "development", label: "Development logline", audience: "Writer and trusted development readers", guidance: "Expose the complete dramatic engine so weaknesses can be tested.", disclosure: "May reveal conflict direction or ending pressure when useful.", suggestedLength: "Usually one clear sentence; length follows diagnostic usefulness." },
  { id: "submission", label: "Submission logline", audience: "Producer, representative, competition or funder", guidance: "Communicate the project, protagonist, pursuit, resistance and stakes quickly.", disclosure: "Reveal enough to evaluate the movie without turning the sentence into a synopsis.", suggestedLength: "Often concise, but no universal word-count pass/fail rule." },
  { id: "pitch-deck", label: "Pitch-deck logline", audience: "A reader seeing title, visuals and supporting pitch information", guidance: "Carry the engine while allowing nearby visuals and sections to provide context.", disclosure: "Can omit details already made clear by the deck.", suggestedLength: "Short enough to scan beside the title and key image." },
  { id: "public-teaser", label: "Public teaser", audience: "Public audience or promotional reader", guidance: "Create interest while intentionally withholding selected information.", disclosure: "Withholding is deliberate and should be recorded, not mistaken for missing craft evidence.", suggestedLength: "Often compact and curiosity-led." },
  { id: "collaborator-brief", label: "Collaborator brief", audience: "Creative or production collaborators", guidance: "Provide enough complete conflict information for aligned work.", disclosure: "May include more explicit direction than public copy.", suggestedLength: "As long as needed to prevent a false understanding of the movie." },
  { id: "custom", label: "Custom purpose", audience: "Writer-defined", guidance: "State who will use the sentence and what decision it must support.", disclosure: "Record what must be communicated and what must remain withheld.", suggestedLength: "Set by the actual use, not a universal target." },
];

export const loglineShapes: LoglineShapeDefinition[] = [
  { id: "causal-engine", label: "Causal engine", explanation: "A disruption causes a pursuit against resistance with consequences.", bestFor: "Clear external story engines and development diagnosis." },
  { id: "irony-contradiction", label: "Irony or contradiction", explanation: "The person least suited to the problem must confront the exact thing they resist.", bestFor: "Character-centred concepts with a defining contradiction." },
  { id: "relationship-pressure", label: "Relationship pressure", explanation: "People with incompatible needs must act together or lose what binds them.", bestFor: "Relationship dramas, romances, families and partnerships." },
  { id: "world-rule-pressure", label: "World-rule pressure", explanation: "A distinctive rule or institution creates the conflict and limits the available choices.", bestFor: "Speculative stories and realistic institutional worlds alike." },
  { id: "mystery-thriller", label: "Mystery or thriller question", explanation: "A discovery forces an investigation, pursuit or prevention before truth creates a cost.", bestFor: "Mystery, thriller, conspiracy and suspense engines." },
  { id: "dual-ensemble", label: "Dual protagonist or ensemble", explanation: "Connected leads pursue intersecting objectives under one central pressure.", bestFor: "Two-handers and ensembles where one lead would misrepresent the movie." },
  { id: "character-first", label: "Character first", explanation: "A wound, strategy or contradiction drives the external pursuit.", bestFor: "Transformation stories where inner strategy shapes every plot choice." },
];

function clean(value: unknown) {
  return typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "";
}

function words(value: string) {
  return value.match(/[\p{L}\p{N}]+(?:['’\-][\p{L}\p{N}]+)*/gu) ?? [];
}

function sentence(value: string) {
  const next = clean(value);
  return next ? /[.!?]$/.test(next) ? next : `${next}.` : "";
}

function phrase(value: string, fallback: string) {
  return clean(value) || fallback;
}

function now() {
  return new Date().toISOString();
}

function makeId(prefix: string) {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return `${prefix}-${crypto.randomUUID()}`;
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function contains(text: string, value: string) {
  const needle = clean(value).toLowerCase();
  return Boolean(needle && text.toLowerCase().includes(needle));
}

function joinParts(parts: string[]) {
  return sentence(parts.map(clean).filter(Boolean).join(" ").replace(/\s+([,.;:!?])/g, "$1"));
}

export function projectLoglineIngredients(project: PlotPickleProject): LoglineIngredients {
  const lead = project.characters[0];
  const relationship = project.characters.slice(0, 2).map((character) => character.relationships?.[0]?.description || "").find(Boolean) || "";
  return {
    protagonist: clean(project.development.foundations.protagonist || lead?.name || lead?.role),
    identity: clean(lead?.description || lead?.role),
    disruption: clean(project.story.catalyst || project.development.catalyst.event),
    goal: clean(project.development.foundations.objective || lead?.want),
    opposition: clean(project.development.foundations.opposition),
    stakes: clean(project.story.stakes),
    genre: clean(project.metadata.genre),
    tone: clean(project.metadata.tone),
    worldRule: clean(project.world.rules || project.world.ordinaryWorld),
    relationshipPressure: clean(relationship),
    urgency: clean(project.development.foundations.urgency),
    distinction: clean(project.development.pickle.signatureMove || project.development.pickle.storyPromise),
    withheld: "",
  };
}

export function buildLoglineAlternative(shape: LoglineShape, ingredientsInput: Partial<LoglineIngredients>): LoglineAlternative {
  const ingredients: LoglineIngredients = { protagonist: "", identity: "", disruption: "", goal: "", opposition: "", stakes: "", genre: "", tone: "", worldRule: "", relationshipPressure: "", urgency: "", distinction: "", withheld: "", ...ingredientsInput };
  const protagonist = phrase(ingredients.protagonist, "A protagonist");
  const identity = clean(ingredients.identity);
  const disruption = phrase(ingredients.disruption, "their ordinary life is disrupted");
  const goal = phrase(ingredients.goal, "pursue a difficult objective");
  const opposition = phrase(ingredients.opposition, "a force determined to stop them");
  const stakes = phrase(ingredients.stakes, "the cost becomes irreversible");
  const worldRule = phrase(ingredients.worldRule, "one rule controls who may act");
  const relationship = phrase(ingredients.relationshipPressure, "their incompatible needs threaten the bond between them");
  const distinction = clean(ingredients.distinction);
  const identityLead = identity ? `${protagonist}, ${identity},` : protagonist;
  const builders: Record<LoglineShape, () => string> = {
    "causal-engine": () => `${identityLead} after ${disruption}, must ${goal} against ${opposition} before ${stakes}`,
    "irony-contradiction": () => `${identityLead} is the last person equipped for the crisis, but when ${disruption}, must ${goal} against ${opposition} before ${stakes}`,
    "relationship-pressure": () => `${identityLead} and the person they cannot afford to trust must ${goal} when ${relationship}, or ${stakes}`,
    "world-rule-pressure": () => `In a world where ${worldRule}, ${identityLead} must ${goal} when ${disruption} turns that rule against them, while ${opposition} closes in`,
    "mystery-thriller": () => `When ${disruption}, ${identityLead} must uncover or stop the truth behind it before ${stakes}, while ${opposition} works to keep it buried`,
    "dual-ensemble": () => `${identityLead} and connected allies with competing objectives must ${goal} after ${disruption}, before ${opposition} makes ${stakes}`,
    "character-first": () => `${identityLead} relies on the very strategy that keeps them trapped until ${disruption} forces them to ${goal} against ${opposition}, or ${stakes}`,
  };
  const communicated = Object.entries(ingredients).filter(([, value]) => clean(value)).map(([key]) => key);
  const optionalEnding = distinction && !builders[shape]().toLowerCase().includes(distinction.toLowerCase()) ? `, with ${distinction}` : "";
  return {
    shape,
    label: loglineShapes.find((item) => item.id === shape)?.label ?? shape,
    text: joinParts([builders[shape](), optionalEnding]),
    rationale: loglineShapes.find((item) => item.id === shape)?.explanation ?? "Alternative sentence structure.",
    communicated,
    omitted: clean(ingredients.withheld) ? ingredients.withheld.split(/[,;\n]/).map(clean).filter(Boolean) : [],
    addedAssumptions: shape === "relationship-pressure" && !clean(ingredients.relationshipPressure) ? ["A relationship conflict was used as scaffolding and must be confirmed."] : [],
  };
}

export function buildLoglineAlternatives(ingredients: Partial<LoglineIngredients>, selectedShapes: LoglineShape[] = loglineShapes.map((item) => item.id)): LoglineAlternative[] {
  return selectedShapes.map((shape) => buildLoglineAlternative(shape, ingredients));
}

function evidenceState(sentenceHas: boolean, projectHas: boolean, omitted: boolean): LoglineEvidenceState {
  if (sentenceHas) return "sentence-supported";
  if (omitted) return "intentional-omission";
  if (projectHas) return "project-only";
  return "review";
}

export function evaluateLoglineEvidence(project: PlotPickleProject, input: string, deliberateOmissions: string[] = []): LoglineEvidenceResult {
  const text = clean(input);
  const lower = text.toLowerCase();
  const ingredients = projectLoglineIngredients(project);
  const omitted = new Set(deliberateOmissions.map((item) => item.toLowerCase()));
  const hasAction = /\b(?:must|tries|seeks|fights|risks|sets out|struggles|races|attempts|pursues|protects|escapes|discovers|confronts|uncover|stop|save|find|expose|survive)\b/i.test(text);
  const hasOppositionLanguage = /\b(?:against|while|but|despite|blocked|threatened|pursued|hunted|resists?)\b/i.test(text) || contains(text, ingredients.opposition);
  const hasStakesLanguage = /\b(?:before|or else|risk|lose|cost|failure|destroy|die|death|forever|last chance)\b/i.test(text) || contains(text, ingredients.stakes);
  const item = (id: string, group: LoglineEvidenceGroup, label: string, question: string, sentenceHas: boolean, projectValue: string, guidance: string, optional = false): LoglineEvidenceItem => ({
    id, group, label, question, state: evidenceState(sentenceHas, Boolean(clean(projectValue)), omitted.has(id) || omitted.has(label.toLowerCase())), sentenceEvidence: sentenceHas ? "The sentence contains evidence for this job." : "The sentence does not clearly communicate this job.", projectEvidence: clean(projectValue), guidance, optional,
  });
  const items: LoglineEvidenceItem[] = [
    item("protagonist", "Core dramatic engine", "Identifiable protagonist", "Who carries the film?", contains(text, ingredients.protagonist) || /\b(?:a|an|the)\s+[\p{L}-]+/iu.test(text), ingredients.protagonist, "Define the person or central subject whose choices drive the movie."),
    item("disruption", "Core dramatic engine", "Catalytic condition", "Why does the story begin now?", contains(text, ingredients.disruption) || /\b(?:after|when|once|following|forced)\b/i.test(text), ingredients.disruption, "Communicate the event or condition that changes the ordinary pattern."),
    item("goal", "Core dramatic engine", "Active objective", "What visible result is pursued?", contains(text, ingredients.goal) || hasAction, ingredients.goal, "Prefer a playable pursuit over an abstract need."),
    item("opposition", "Core dramatic engine", "Meaningful opposition", "What makes success difficult?", hasOppositionLanguage, ingredients.opposition, "Name or imply the person, system, environment or strategy pushing back."),
    item("stakes", "Core dramatic engine", "Consequences", "What can be lost?", hasStakesLanguage, ingredients.stakes, "Clarify personal or external cost when this purpose requires it."),
    item("causality", "Core dramatic engine", "Causal relationship", "Do the ingredients create one movie rather than a list?", /\b(?:after|when|once)\b.+\b(?:must|tries|seeks|races|sets out)\b/i.test(text) || (hasAction && hasOppositionLanguage), project.development.foundations.storyEngine, "Connect disruption, pursuit, resistance and consequence."),
    item("identity", "Promise and distinction", "Specific identity or contradiction", "Why this protagonist for this problem?", contains(text, ingredients.identity), ingredients.identity, "Use identity when it changes the conflict rather than as decoration.", true),
    item("world", "Promise and distinction", "World, arena or rule", "Does the setting change available choices?", contains(text, ingredients.worldRule), ingredients.worldRule, "Include the rule only when the conflict depends on it.", true),
    item("relationship", "Promise and distinction", "Emotional or relationship hook", "What makes the external stakes personal?", contains(text, ingredients.relationshipPressure) || /\b(?:family|mother|father|daughter|son|friend|partner|trust|love|grief|belong)\b/i.test(text), ingredients.relationshipPressure, "A relationship hook is valuable when it carries the audience experience.", true),
    item("urgency", "Promise and distinction", "Urgency or narrowing options", "Why can the lead not wait?", contains(text, ingredients.urgency) || /\b(?:before|within|deadline|last|countdown|until)\b/i.test(text), ingredients.urgency, "Urgency is optional unless the story genuinely contains a clock or shrinking options.", true),
    item("genre-tone", "Promise and distinction", "Genre and tonal expectation", "What kind of experience is promised?", contains(text, ingredients.genre) || contains(text, ingredients.tone), `${ingredients.genre}${ingredients.tone ? ` · ${ingredients.tone}` : ""}`, "Signal experience through chosen language; do not insert labels mechanically.", true),
    item("signature", "Promise and distinction", "Signature feature", "What creates curiosity or distinction?", contains(text, ingredients.distinction), ingredients.distinction, "Irony, mystery or spectacle are possibilities, not universal requirements.", true),
    item("precision", "Clarity and delivery", "Precise nouns and verbs", "Can the reader picture the dramatic action?", text.length > 0 && !/\b(?:something|things|stuff|somehow|various)\b/i.test(text), "", "Replace placeholders with exact people, actions, obstacles and costs."),
    item("playability", "Clarity and delivery", "Visible or playable action", "Could the sentence become scenes?", hasAction, ingredients.goal, "Use behaviour and pursuit rather than announcing theme or internal abstraction."),
    item("readability", "Clarity and delivery", "Readable sentence structure", "Can it be understood on the first hearing?", text.length > 0 && (text.match(/,/g) ?? []).length <= 4, "", "Read aloud and divide overloaded clauses; complexity is guidance, not a grade."),
    item("terminology", "Clarity and delivery", "Controlled names and terminology", "Does the reader need a glossary or cast list?", project.characters.filter((character) => character.name && lower.includes(character.name.toLowerCase())).length <= 2, "", "Use names when they help; prefer roles when several names create friction."),
    item("length", "Clarity and delivery", "Purpose-appropriate length", "Is the length serving this use?", words(text).length > 0, "", "Review word count against the chosen purpose rather than a universal pass range."),
    item("drive", "Clarity and delivery", "Present dramatic drive", "Does the sentence feel active now?", !/\b(?:would|was going to|were going to)\b/i.test(text), "", "Present-tense drive often improves immediacy, but clarity is the actual goal."),
    item("final-pressure", "Clarity and delivery", "Strong final pressure or distinction", "What thought or question does the sentence leave behind?", /(?:before|or|risk|against|while|but|with).{4,}[.!?]?$/i.test(text) || hasStakesLanguage, ingredients.distinction || ingredients.stakes, "End on the most useful cost, question or signature feature for this purpose.", true),
  ];
  const supportedCount = items.filter((entry) => entry.state === "sentence-supported").length;
  const coreItems = items.filter((entry) => entry.group === "Core dramatic engine");
  const coreSupportedCount = coreItems.filter((entry) => entry.state === "sentence-supported").length;
  const label = coreSupportedCount >= 5 ? "Core engine visible" : supportedCount >= 9 ? "Promise developing" : "Review the missing evidence";
  return { wordCount: words(text).length, supportedCount, coreSupportedCount, label, items };
}

export function createPurposeAwareCandidate(textValue: string, metadata: LoglineCandidateMetadata = {}, source = "Logline Lab"): PurposeAwareLoglineCandidate {
  const createdAt = now();
  return {
    id: makeId("logline"), text: clean(textValue), source, selected: false, createdAt,
    ...metadata, wordCount: words(textValue).length, updatedAt: metadata.updatedAt || createdAt,
    reviewStatus: metadata.reviewStatus || "draft", sourceType: metadata.sourceType || "manual",
  };
}

export function savePurposeAwareCandidate(project: PlotPickleProject, candidate: PurposeAwareLoglineCandidate): PlotPickleProject {
  if (!clean(candidate.text)) return project;
  const next = cloneProject(project);
  next.review.loglineCandidates.push(candidate);
  next.metadata.updatedAt = now();
  return next;
}

export function createImportedLoglineSuggestion(project: PlotPickleProject, textValue: string, evidence: string[], uncertainInterpretations: string[]): PlotPickleProject {
  return savePurposeAwareCandidate(project, createPurposeAwareCandidate(textValue, {
    purpose: "development", intendedAudience: "Writer reviewing an imported screenplay", sourceType: "imported-suggestion", reviewStatus: "draft",
    linkedProjectEvidence: evidence, importedEvidence: evidence, uncertainInterpretations,
    rationale: "Derived from imported screenplay evidence and retained as a suggestion until the writer reviews it.",
  }, "Imported screenplay suggestion"));
}

function revisionForApproval(project: PlotPickleProject, candidate: PurposeAwareLoglineCandidate, previous: string, note: string): RevisionSnapshot {
  const createdAt = now();
  return {
    id: makeId("revision"), label: `Logline approval · ${candidate.purpose || "primary"}`, notes: note || `Approved candidate ${candidate.id}; previous primary retained in this snapshot.`, createdAt,
    schemaVersion: "1.7.0", contentHash: `logline-${candidate.id}-${createdAt}`,
    payload: { kind: "logline-approval", candidateId: candidate.id, previousPrimary: previous, approvedText: candidate.text, purpose: candidate.purpose || "development", writerNotes: candidate.writerNotes || note, targets: [] },
  };
}

export function approvePurposeAwareLogline(project: PlotPickleProject, candidateId: string, targets: LoglineApprovalTargets, writerNote = ""): PlotPickleProject {
  const next = cloneProject(project);
  const candidates = next.review.loglineCandidates as PurposeAwareLoglineCandidate[];
  const candidate = candidates.find((entry) => entry.id === candidateId);
  if (!candidate) return project;
  const previous = next.story.logline;
  next.review.loglineCandidates = candidates.map((entry) => ({
    ...entry,
    selected: targets.primary ? entry.id === candidateId : entry.selected,
    reviewStatus: entry.id === candidateId ? (targets.primary ? "approved-primary" : "approved-variant") : targets.primary && entry.selected ? "superseded" : entry.reviewStatus,
    updatedAt: entry.id === candidateId ? now() : entry.updatedAt,
  }));
  if (targets.primary) next.story.logline = candidate.text;
  if (targets.oneSentencePitch) next.development.pitch.oneSentence = candidate.text;
  if (targets.pitchPackage) {
    next.review.pitchPackage.logline = candidate.text;
    next.review.pitchPackage.updatedAt = now();
  }
  if (targets.createRevisionSnapshot) next.revisions.push(revisionForApproval(next, candidate, previous, writerNote));
  next.metadata.updatedAt = now();
  return next;
}

export const loglineLearningAliases = [
  "The Art of Crafting Loglines", "20-step logline guide", "perfect logline", "logline deconstruction", "avoid character names", "irony", "active voice",
];
