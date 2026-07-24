import type { PlotPickleProject } from "@/lib/project";
import { learningModules, type LearningModule } from "./learning-library";

export type CoreStageId = "find" | "build" | "write" | "diagnose" | "responsible";
export type CoreRouteId = "idea" | "new-screenplay" | "imported-screenplay" | "focused-problem" | "full-revision" | "collaboration-sharing";
export type CoreProgressState = "not-started" | "read" | "exercise-attempted" | "applied" | "revisit";

export const coreRelationshipNote = "Recommended before and useful after are advisory. No prerequisite is locked.";

export type CoreStage = {
  id: CoreStageId;
  number: number;
  title: string;
  outcome: string;
  moduleIds: string[];
  primaryLinks: string[];
};

export type CoreRoute = {
  id: CoreRouteId;
  label: string;
  summary: string;
  moduleIds: string[];
  destination: string;
};

export type CoreModuleGuide = {
  moduleId: string;
  stageId: CoreStageId;
  sourceTitle: string;
  sourceAliases: string[];
  adaptation: string;
  understand: string;
  seeIt: string;
  tryIt: string;
  applyLabel: string;
  applyHref: string;
  checkLabel: string;
  checkHref: string;
  deeperLabel: string;
  deeperHref: string;
  recommendedBefore: string[];
  usefulAfter: string[];
  commonNextProblem: string;
};

export type CoreRecommendation = {
  moduleId: string;
  reason: string;
  evidence: string[];
  question: string;
};

export const coreStages: CoreStage[] = [
  {
    id: "find",
    number: 1,
    title: "Find the Story",
    outcome: "State the story promise, central character, disruption, objective, opposition, stakes, audience experience, genre agreement and likely structural form.",
    moduleIds: ["pitch", "genres", "structures"],
    primaryLinks: ["Story Setup", "Pitch & Vision", "Foundations", "The Pickle", "Structure Map"],
  },
  {
    id: "build",
    number: 2,
    title: "Build the Story World",
    outcome: "Understand the development path, create usable character and world records, distinguish canon from proposals and increase planning resolution from story to Block, mini-block and scene.",
    moduleIds: ["writing-process", "concept-to-draft", "world-building", "character-bible", "story-bible"],
    primaryLinks: ["World", "Characters", "Ghost", "Catalyst", "Story Planner", "Canon Binder", "Structure", "Story Threads"],
  },
  {
    id: "write",
    number: 3,
    title: "Write the Movie",
    outcome: "Continue a draft without waiting for perfection, translate plans into visible and audible screenplay material and use screenplay elements correctly.",
    moduleIds: ["pickle-draft", "formatting"],
    primaryLinks: ["Treatment", "Screenplay", "Mini-block guidance", "PageFlow", "Import and export"],
  },
  {
    id: "diagnose",
    number: 4,
    title: "Learn and Diagnose",
    outcome: "Study examples without copying, describe reader experience, locate evidence, identify the likely craft layer and choose a focused revision experiment.",
    moduleIds: ["books-scripts", "challenges"],
    primaryLinks: ["Read & Learn", "DraftLens", "Diagnostics", "Scene Pulse", "CraftLoop", "Review threads"],
  },
  {
    id: "responsible",
    number: 5,
    title: "Prepare and Work Responsibly",
    outcome: "Prepare truthful project materials, identify current industry questions, preserve rights and provenance and use optional AI without surrendering authorship or canon control.",
    moduleIds: ["industry", "responsible-ai"],
    primaryLinks: ["Pitch & Review", "Rights and Provenance", "Reports", "Specialist Labs", "AI Setup", "Collaboration"],
  },
];

export const coreRoutes: CoreRoute[] = [
  { id: "idea", label: "I have an idea", summary: "Clarify the promise, audience agreement, story engine and likely form before expanding detail.", moduleIds: ["pitch", "genres", "structures", "concept-to-draft"], destination: "Pitch & Vision" },
  { id: "new-screenplay", label: "I am starting a new screenplay", summary: "Build a useful process, character and world foundation, map the 24 Blocks, begin the Pickle Draft and use screenplay form clearly.", moduleIds: ["writing-process", "character-bible", "world-building", "structures", "pickle-draft", "formatting"], destination: "Story Planner and Screenplay" },
  { id: "imported-screenplay", label: "I already have a screenplay", summary: "Audit the imported project, rebuild the source of truth and diagnose evidence before choosing targeted craft passes.", moduleIds: ["story-bible", "challenges", "character-bible", "formatting"], destination: "Import, Canon Binder and Diagnostics" },
  { id: "focused-problem", label: "I am stuck on one area", summary: "Begin with the Challenges Guide, then branch into character, dialogue, scene, structure, pacing, theme, world, collaboration, formatting or AI depth.", moduleIds: ["challenges", "books-scripts", "writing-process"], destination: "DraftLens and specialist collections" },
  { id: "full-revision", label: "I am revising a complete draft", summary: "Protect first-read evidence, diagnose root causes, run bounded passes and finish with continuity and formatting checks.", moduleIds: ["challenges", "writing-process", "story-bible", "formatting"], destination: "DraftLens, CraftLoop and PageFlow" },
  { id: "collaboration-sharing", label: "I am preparing to collaborate or share", summary: "Confirm canon, professional readiness, rights, contributor expectations and the correct pitch or export package.", moduleIds: ["story-bible", "industry", "responsible-ai", "pitch"], destination: "Rights, Working Together and Pitch & Review" },
];

export const coreSourceMap = [
  { legacy: "General - The Pitch", moduleId: "pitch", change: "Separates logline, short pitch, complete synopsis, audience promise and requested next step; a professional synopsis may include the ending." },
  { legacy: "General - Tropes and Genres", moduleId: "genres", change: "Treats genre as an audience agreement and tropes as tools rather than stereotypes or fixed speed rules." },
  { legacy: "General - Screenplays to Improv", moduleId: "structures", change: "Uses multiple structural traditions and the 24 Blocks as a flexible resolution tool rather than one mandatory act theory." },
  { legacy: "General - The Writing Process", moduleId: "writing-process", change: "Separates discovery, drafting and evaluation while preserving an iterative rather than mandatory sequence." },
  { legacy: "General - Concept to Draft", moduleId: "concept-to-draft", change: "Connects premise, Blocks, mini-blocks, treatment, screenplay and revision through one canonical project." },
  { legacy: "General - World Building", moduleId: "world-building", change: "Applies world-building to every screenplay, including contemporary institutions, geography, labour, language, access and social rules." },
  { legacy: "General - Story Bible - Character", moduleId: "character-bible", change: "Replaces biography warehousing with present behaviour, choices, relationships, Voiceprint and change evidence." },
  { legacy: "General - Story Bible", moduleId: "story-bible", change: "Separates canonical story records from pitch packages, production plans, marketing plans and possible future material." },
  { legacy: "General - The Vomit Draft", moduleId: "pickle-draft", change: "Displays Pickle Draft while preserving Vomit Draft as a search alias; permission to draft imperfectly still requires intention and later diagnosis." },
  { legacy: "Script Formatting", moduleId: "formatting", change: "Uses screenplay-specific elements and portable Fountain, FDX and PDF workflows instead of a static software directory." },
  { legacy: "General - Popular Books", moduleId: "books-scripts", change: "Teaches source-aware deliberate study rather than a popularity list that becomes stale." },
  { legacy: "Screenplay Challenges Guide", moduleId: "challenges", change: "Moves from symptom catalogues to audience experience, evidence, probable root cause and bounded revision experiments." },
  { legacy: "General - The Film Industry", moduleId: "industry", change: "Teaches categories, jurisdiction and verification questions rather than freezing rates, eligibility or organization details." },
  { legacy: "General - AI Framework Ideas", moduleId: "responsible-ai", change: "Uses precise prompt, context, storage, provider-term, provenance and approval language; supplying context is not necessarily model training." },
] as const;

export const coreModuleGuides: CoreModuleGuide[] = [
  { moduleId: "pitch", stageId: "find", sourceTitle: "General - The Pitch", sourceAliases: ["pitch article", "marketing pitch", "producer pitch", "spoiler-free pitch"], adaptation: "A pitch document is selected for its audience: a teaser may avoid spoilers, while a producer or evaluator may need the complete ending.", understand: "A pitch is a clear invitation to a dramatic experience, not one universal document for every audience.", seeIt: "Compare the active logline, audience promise, Pickle and ending proof with the module's worked paramedic example.", tryIt: "Write the 35-word logline and 150-word causal pitch using current project evidence.", applyLabel: "Open Pitch & Review", applyHref: "/pitch-review", checkLabel: "Check Story Experience evidence", checkHref: "/story-craft-essentials#experience", deeperLabel: "Go deeper: Story Craft Essentials", deeperHref: "/story-craft-essentials#experience", recommendedBefore: [], usefulAfter: ["genres", "structures"], commonNextProblem: "The premise is understandable, but the audience promise or repeatable story engine remains vague." },
  { moduleId: "genres", stageId: "find", sourceTitle: "General - Tropes and Genres", sourceAliases: ["genre rules", "genre conventions", "trope list"], adaptation: "Genre is an audience agreement, not a stereotype about pace, seriousness, dialogue or world scale.", understand: "Use conventions for orientation and create freshness through character, context, combination and consequence.", seeIt: "Test the current dominant and secondary genres against what the Blocks actually deliver.", tryIt: "List five expectations and mark fulfil, twist, combine or omit with a reason.", applyLabel: "Open Story Experience", applyHref: "/story-craft-essentials#experience", checkLabel: "Check genre and tone movement", checkHref: "/story-craft-essentials#pacing", deeperLabel: "Go deeper: Story Craft Essentials", deeperHref: "/story-craft-essentials#techniques", recommendedBefore: ["pitch"], usefulAfter: ["structures", "world-building"], commonNextProblem: "The genre label exists, but the screenplay evidence does not yet repeat the promise with variation." },
  { moduleId: "structures", stageId: "find", sourceTitle: "General - Screenplays to Improv", sourceAliases: ["screenplays to improv", "three act", "hero journey", "non-linear structure"], adaptation: "The 24 Blocks provide useful resolution without forcing one act model, page target or beat theory.", understand: "Structure arranges pressure, choice, consequence and revelation so the audience can track change.", seeIt: "Compare three structural forms for the active story and identify which controls the audience's questions most clearly.", tryIt: "Place the eight most important turns across the 24 Blocks.", applyLabel: "Open Structure", applyHref: "/structure", checkLabel: "Check causality and handoffs", checkHref: "/diagnostics", deeperLabel: "Go deeper: The 24 Blocks Method", deeperHref: "/read-learn?view=method&module=24b-structure-guide", recommendedBefore: ["pitch", "genres"], usefulAfter: ["concept-to-draft", "pickle-draft"], commonNextProblem: "The project has events, but pressure, choice and consequence do not yet form a clear causal movement." },
  { moduleId: "writing-process", stageId: "build", sourceTitle: "General - The Writing Process", sourceAliases: ["writing workflow", "idea research outline draft", "proofreading process"], adaptation: "Development is iterative. Concept, research, character, Blocks, treatment and screenplay may revise one another.", understand: "Discovery, drafting and evaluation are different mental jobs and do not need to happen in one rigid order.", seeIt: "Use the module's focused-pass example to separate structural, character, scene, page, dialogue and proofreading work.", tryIt: "Define the next six project deliverables and a visible definition of done for each.", applyLabel: "Open CraftLoop", applyHref: "/craftloop", checkLabel: "Check revision priorities", checkHref: "/draftlens", deeperLabel: "Go deeper: Story Craft Essentials Audit", deeperHref: "/story-craft-essentials#audit", recommendedBefore: [], usefulAfter: ["concept-to-draft", "pickle-draft", "challenges"], commonNextProblem: "Drafting, research and evaluation are competing for the same session without a defined deliverable." },
  { moduleId: "concept-to-draft", stageId: "build", sourceTitle: "General - Concept to Draft", sourceAliases: ["concept to draft", "concept to final draft", "outline to screenplay"], adaptation: "Planning resolution increases from premise to Blocks, mini-blocks, treatment and screenplay while each layer remains part of one project.", understand: "Each development layer should answer a new question without creating disconnected versions of the story.", seeIt: "Follow the memory-rental example from concept through premise, Block, mini-block and scene evidence.", tryIt: "Write condition, attempt, resistance, choice and outcome for the selected mini-block, then expand to treatment prose.", applyLabel: "Open Structure", applyHref: "/structure", checkLabel: "Check the complete draft", checkHref: "/draftlens", deeperLabel: "Go deeper: The 24 Blocks Method", deeperHref: "/read-learn?view=method&module=24b-principle-three", recommendedBefore: ["writing-process", "pitch"], usefulAfter: ["world-building", "character-bible", "pickle-draft"], commonNextProblem: "The project contains attractive planning material, but the condition-attempt-resistance-turn path is unclear." },
  { moduleId: "world-building", stageId: "build", sourceTitle: "General - World Building", sourceAliases: ["world building", "fantasy world", "science fiction world", "setting guide"], adaptation: "Every screenplay has systems, institutions, geography, labour, language, access and social rules—not only fantasy and science fiction.", understand: "World details matter when they create options, obstacles, status, behaviour or consequences.", seeIt: "Compare the active world rules with the module's memory-surrender example and current screenplay consequences.", tryIt: "Define one location's controlling power, public rule, private exception, sensory signature and revealing behaviour.", applyLabel: "Open Story Craft Evidence", applyHref: "/story-craft-essentials#evidence", checkLabel: "Check world and continuity", checkHref: "/diagnostics", deeperLabel: "Go deeper: Story Craft Essentials", deeperHref: "/story-craft-essentials#motifs", recommendedBefore: ["genres"], usefulAfter: ["character-bible", "story-bible"], commonNextProblem: "The world contains information, but its rules are not yet producing choices or visible costs." },
  { moduleId: "character-bible", stageId: "build", sourceTitle: "General - Story Bible - Character", sourceAliases: ["character story bible", "character biography", "character profile"], adaptation: "A character bible predicts present behaviour, choice, relationship and voice rather than storing biography for its own sake.", understand: "Want, need, Ghost, belief, capacity, relationship and Voiceprint become useful when they explain or predict costly action.", seeIt: "Compare planned character claims with current Block, scene, relationship and dialogue evidence.", tryIt: "Complete want, need, Ghost, lie, strength/flaw and final proof, then write two contrasting relationship perspectives.", applyLabel: "Open Characters in Motion", applyHref: "/characters-in-motion", checkLabel: "Check Character Proof", checkHref: "/characters-in-motion#proof", deeperLabel: "Go deeper: Characters in Motion", deeperHref: "/read-learn?view=characters&module=characters-engine", recommendedBefore: ["writing-process"], usefulAfter: ["story-bible", "pickle-draft"], commonNextProblem: "Characters have background material, but current choices, relationship pressure or Voiceprint evidence remain thin." },
  { moduleId: "story-bible", stageId: "build", sourceTitle: "General - Story Bible", sourceAliases: ["story bible", "series bible", "sales bible", "canon binder"], adaptation: "The canonical Story Bible is not automatically a sales bible, pitch package, production plan, marketing plan or future-season document.", understand: "A living source of truth distinguishes canonical facts, proposals, unknowns, research and decisions.", seeIt: "Audit where current screenplay facts disagree with world, character, chronology, Story Threads or planning records.", tryIt: "Record ten canonical facts, three proposals and three important unknowns with downstream consequences.", applyLabel: "Open Working Together", applyHref: "/working-together", checkLabel: "Check continuity", checkHref: "/diagnostics", deeperLabel: "Go deeper: Collaboration, Ownership and Working Together", deeperHref: "/read-learn?view=working-together&module=working-together-canon", recommendedBefore: ["world-building", "character-bible"], usefulAfter: ["pickle-draft", "industry"], commonNextProblem: "Different notes or drafts contain competing facts without a clear canonical decision." },
  { moduleId: "pickle-draft", stageId: "write", sourceTitle: "General - The Vomit Draft", sourceAliases: ["Vomit Draft", "vomit draft", "rough draft", "discovery draft"], adaptation: "PlotPickle displays Pickle Draft. Imperfect forward motion still needs an objective, causal direction, visible placeholders and later revision responsibility.", understand: "A fast draft is a discovery pass, not a quality claim or excuse to abandon intention.", seeIt: "Use the hospital-archive example to preserve an objective and turn while marking research and continuity gaps.", tryIt: "Draft the selected mini-block for twenty uninterrupted minutes and record discoveries, questions and the next entry condition.", applyLabel: "Open Screenplay and PageFlow", applyHref: "/pageflow", checkLabel: "Check visible and playable writing", checkHref: "/pageflow", deeperLabel: "Go deeper: Dialogue and Story Craft", deeperHref: "/dialogue-in-motion", recommendedBefore: ["concept-to-draft"], usefulAfter: ["formatting", "challenges"], commonNextProblem: "The writer is polishing early pages or researching local details before enough story exists to diagnose." },
  { moduleId: "formatting", stageId: "write", sourceTitle: "Script Formatting", sourceAliases: ["screenplay formatting", "sluglines", "Final Draft software list", "screenwriting software"], adaptation: "Formatting is readable screenplay language, not decoration or a permanent software directory.", understand: "Scene headings, action, cues, dialogue, parentheticals, extensions, transitions and specialized forms each serve comprehension and production use.", seeIt: "Compare the active screenplay elements with the module's hospital-archive example and generated Fountain form.", tryIt: "Write a heading, visible action, cues, subtext dialogue and one necessary parenthetical, then remove invisible information.", applyLabel: "Open Advanced Formatting Toolbox", applyHref: "/story-craft-essentials#formatting", checkLabel: "Check PageFlow", checkHref: "/pageflow", deeperLabel: "Go deeper: Dialogue in Motion", deeperHref: "/read-learn?view=dialogue&module=dialogue-speech-silence-action", recommendedBefore: ["pickle-draft"], usefulAfter: ["challenges", "industry"], commonNextProblem: "The draft contains story intention that is not yet expressed as clear, portable screenplay elements." },
  { moduleId: "books-scripts", stageId: "diagnose", sourceTitle: "General - Popular Books", sourceAliases: ["popular books", "screenplay websites", "best screenwriting books", "script directory"], adaptation: "Resource rankings and directories become stale; deliberate study begins by identifying source type, draft status and a specific craft question.", understand: "Read once for experience, then analyze decisions, page-to-screen changes and one transferable technique without copying expression.", seeIt: "Use the scene-study card to track expectation, objective, tactic, turn, exit question and visual carrier.", tryIt: "Analyze five pages from a legally available produced screenplay and apply one technique through original expression.", applyLabel: "Open CraftLoop", applyHref: "/craftloop", checkLabel: "Check the active problem", checkHref: "/draftlens", deeperLabel: "Go deeper: Story Craft Technique Library", deeperHref: "/story-craft-essentials#techniques", recommendedBefore: [], usefulAfter: ["challenges"], commonNextProblem: "The writer is collecting advice or examples without converting one observation into an active-project decision." },
  { moduleId: "challenges", stageId: "diagnose", sourceTitle: "Screenplay Challenges Guide", sourceAliases: ["screenplay problems", "writer block", "sagging middle", "weak opening", "flat character"], adaptation: "A symptom is traced to audience experience, exact evidence, probable root cause and a bounded experiment rather than matched to a generic fix.", understand: "Diagnose the craft layer beneath the symptom before rewriting local text.", seeIt: "Use the Block 14 missing-key example to distinguish repeated information from a missing strategy change.", tryIt: "Record experience, three evidence points, likely root cause, two experiments and continuity consequences.", applyLabel: "Open DraftLens", applyHref: "/draftlens", checkLabel: "Run Essential Craft Audit", checkHref: "/story-craft-essentials#audit", deeperLabel: "Go deeper: AI-Assisted Revision", deeperHref: "/read-learn?view=ai-revision&module=ai-revision-scene-purpose-turn", recommendedBefore: ["books-scripts"], usefulAfter: ["writing-process", "formatting"], commonNextProblem: "A visible problem has attracted several proposed fixes before the underlying cause is agreed." },
  { moduleId: "industry", stageId: "responsible", sourceTitle: "General - The Film Industry", sourceAliases: ["film organizations", "guild directory", "union rates", "industry contacts"], adaptation: "Industry rates, eligibility, membership and jurisdiction rules change; PlotPickle teaches categories and directs writers to authoritative current sources.", understand: "Prepare truthful project, rights and request information, then verify the current rule that actually governs the situation.", seeIt: "Use the module's signatory-and-jurisdiction question instead of relying on an old rate or generic claim.", tryIt: "Create a one-page readiness sheet with status, rights, format, audience, attachments, jurisdiction questions and requested next action.", applyLabel: "Open Pitch & Review", applyHref: "/pitch-review", checkLabel: "Check Rights and Provenance", checkHref: "/working-together#rights", deeperLabel: "Go deeper: Collaboration, Formats and Ownership", deeperHref: "/read-learn?view=collaboration&module=collaboration-ownership", recommendedBefore: ["story-bible", "pitch"], usefulAfter: ["responsible-ai"], commonNextProblem: "The project is being prepared for a conversation, but status, rights, jurisdiction or requested next action is incomplete." },
  { moduleId: "responsible-ai", stageId: "responsible", sourceTitle: "General - AI Framework Ideas", sourceAliases: ["AI Framework Ideas", "AI training", "prompt framework", "AI writing framework"], adaptation: "Supplying relevant project context to a request is not necessarily training the model; prompts, context, storage, provider terms and data controls require precise separate language.", understand: "Optional AI supports bounded questions and alternatives while privacy, rights, continuity, provenance and canon approval remain human responsibilities.", seeIt: "Use the bounded storyboard example to separate task, context, locks, output form, risks and approval.", tryIt: "Write one bounded prompt and a seven-point human-review checklist while preserving a complete manual route.", applyLabel: "Open Specialist Labs", applyHref: "/labs", checkLabel: "Check provenance and privacy", checkHref: "/working-together#rights", deeperLabel: "Go deeper: AI-Assisted Revision", deeperHref: "/read-learn?view=ai-revision&module=ai-revision-foundations", recommendedBefore: ["story-bible"], usefulAfter: ["industry"], commonNextProblem: "The AI task is broader than the available context, success criteria or approval boundary." },
];

export const legacyGeneralAliases = [
  "General - The Pitch", "General - Tropes and Genres", "General - Screenplays to Improv", "General - The Writing Process", "General - Concept to Draft", "General - World Building", "General - Story Bible - Character", "General - Story Bible", "General - The Vomit Draft", "Vomit Draft", "Script Formatting", "General - Popular Books", "Screenplay Challenges Guide", "General - The Film Industry", "General - AI Framework Ideas",
] as const;

function present(value: unknown) {
  return typeof value === "string" ? Boolean(value.trim()) : Boolean(value);
}

function scenes(project: PlotPickleProject) {
  return project.blocks.flatMap((block) => block.scenes);
}

export function coreRecommendations(project: PlotPickleProject, routeId: CoreRouteId): CoreRecommendation[] {
  const route = coreRoutes.find((item) => item.id === routeId) ?? coreRoutes[0];
  const allScenes = scenes(project);
  const missingPivots = allScenes.filter((scene) => !present(scene.reversal) && !present(scene.turn));
  const recommendations: CoreRecommendation[] = [];
  const add = (moduleId: string, reason: string, evidence: string[], question: string) => recommendations.push({ moduleId, reason, evidence: evidence.filter(Boolean), question });

  if (!present(project.development.pitch.audiencePromise) || !present(project.story.logline)) add("pitch", "The story can be developed more efficiently when its audience promise and dramatic invitation are explicit.", [`Logline: ${project.story.logline || "blank"}`, `Audience promise: ${project.development.pitch.audiencePromise || "blank"}`], "What experience should the pitch promise before more detail is added?");
  if (!present(project.metadata.genre)) add("genres", "The active project has no dominant genre agreement to guide audience expectation.", ["Project genre is blank"], "Which emotional promise should repeat with variation across the film?");
  if (project.blocks.filter((block) => present(block.goal) && present(block.choice)).length < 8) add("structures", "Fewer than eight Blocks currently contain both a goal and a choice, so the large causal movement may still be emerging.", [`Blocks with goal and choice: ${project.blocks.filter((block) => present(block.goal) && present(block.choice)).length}/24`], "Which eight decisions most clearly change the story's direction?");
  if (!present(project.development.notes.revisions)) add("writing-process", "The project has no current revision or development-pass note, which can make discovery, drafting and evaluation compete.", ["Development revision note is blank"], "What is the single deliverable for the next writing session?");
  if (project.blocks.filter((block) => present(block.summary)).length < 12) add("concept-to-draft", "Much of the story has not yet been expressed at Block resolution.", [`Blocks with summaries: ${project.blocks.filter((block) => present(block.summary)).length}/24`], "Which planning layer should become more specific next?");
  if (![project.world.rules, project.world.cultures, project.world.visualLanguage].some(present)) add("world-building", "Rules, cultures and visual language are currently sparse, so the world may not yet create enough choice or consequence.", ["World rules, cultures and visual language are mostly blank"], "Which system controls access, behaviour or cost in the active story?");
  if (!project.characters.length || project.characters.some((character) => !present(character.want) || !present(character.need))) add("character-bible", "At least one major character lacks a clear current want or need.", [`Characters: ${project.characters.length}`, `Characters missing want/need: ${project.characters.filter((character) => !present(character.want) || !present(character.need)).length}`], "Which present strategy protects the character and creates a later cost?");
  if (!project.storyThreads.length || !present(project.development.notes.continuity)) add("story-bible", "The project has limited Story Thread or continuity evidence for one living source of truth.", [`Story Threads: ${project.storyThreads.length}`, `Continuity note: ${project.development.notes.continuity ? "present" : "blank"}`], "Which facts, proposals and unknowns need explicit status before the next pass?");
  if (project.screenplay.draftElements.length < 12) add("pickle-draft", "The screenplay contains little page material, so forward discovery may be more useful than local polish.", [`Screenplay elements: ${project.screenplay.draftElements.length}`], "What small scene or mini-block can be completed without stopping for every uncertainty?");
  if (project.screenplay.draftElements.length && project.screenplay.draftElements.some((item) => item.type === "action" && /\b(feels?|thinks?|realizes?|knows?)\b/i.test(item.text))) add("formatting", "Some action text may contain internal claims that need visible, audible or performable evidence.", ["Action elements include internal-state language"], "What can the audience see or hear instead?");
  if (routeId === "focused-problem" && project.screenplay.draftElements.length) add("books-scripts", "A focused comparison with a produced screenplay may provide a specific craft lens without forcing a formula.", [`Active screenplay elements: ${project.screenplay.draftElements.length}`], "Which one craft question should guide the study?");
  if (missingPivots.length >= 3 || routeId === "full-revision" || routeId === "imported-screenplay") add("challenges", "The draft has enough evidence for diagnosis before local rewriting.", [`Scenes without a recorded pivot: ${missingPivots.length}`, `Selected route: ${route.label}`], "What did the reader experience, and which evidence most likely caused it?");
  if (routeId === "collaboration-sharing" && (!present(project.rights.projectOwner) || !present(project.review.pitchPackage.logline))) add("industry", "Professional or collaborative preparation is underway while rights ownership or pitch-package evidence is incomplete.", [`Project owner: ${project.rights.projectOwner || "blank"}`, `Pitch-package logline: ${project.review.pitchPackage.logline || "blank"}`], "What status, rights, jurisdiction and requested next action must be verified?");
  if (routeId === "collaboration-sharing" || project.rights.aiProvenance.length) add("responsible-ai", "Optional AI or sharing work benefits from a precise context, privacy, provenance and approval boundary.", [`AI provenance records: ${project.rights.aiProvenance.length}`], "What information is necessary for the task, and what must remain private or locked?");

  for (const moduleId of route.moduleIds) {
    if (!recommendations.some((item) => item.moduleId === moduleId)) {
      const lesson = learningModules.find((item) => item.id === moduleId);
      if (lesson) add(moduleId, `This lesson is part of the selected “${route.label}” route.`, [`Route destination: ${route.destination}`], `Would ${lesson.title} remove uncertainty from the next project decision?`);
    }
  }
  return recommendations;
}

export function coreGuideFor(moduleId: string) {
  return coreModuleGuides.find((item) => item.moduleId === moduleId);
}

export function coreStageFor(moduleId: string) {
  return coreStages.find((stage) => stage.moduleIds.includes(moduleId));
}

export function coreModule(moduleId: string): LearningModule | undefined {
  return learningModules.find((module) => module.id === moduleId);
}

export function coreCurriculumSearchText() {
  return [
    ...legacyGeneralAliases,
    ...coreSourceMap.flatMap((item) => [item.legacy, item.change]),
    ...coreStages.flatMap((stage) => [stage.title, stage.outcome, ...stage.primaryLinks]),
    ...coreRoutes.flatMap((route) => [route.label, route.summary, route.destination]),
    ...coreModuleGuides.flatMap((guide) => [guide.sourceTitle, ...guide.sourceAliases, guide.adaptation, guide.understand, guide.seeIt, guide.tryIt, guide.applyLabel, guide.checkLabel, guide.deeperLabel, guide.commonNextProblem]),
    "Adapted from the original 24 Blocks General learning archive and rewritten for PlotPickle's current local-first workflow.",
  ].join(" ").toLowerCase();
}
