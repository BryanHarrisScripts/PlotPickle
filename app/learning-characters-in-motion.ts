import type { ArcCheckpointKind } from "@/lib/project";
import type { LearningModule } from "./learning-library";

export type CharacterArcShape =
  | "positive-transformation"
  | "steadfast-flat"
  | "negative-corruption"
  | "disillusionment"
  | "tragic-refusal"
  | "recovery-reconciliation"
  | "incomplete-ambiguous"
  | "ensemble-relationship"
  | "custom";

export type CharacterWorkspaceTarget =
  | "character-engine"
  | "proof-dashboard"
  | "inner-journey"
  | "conflict"
  | "opposition"
  | "relationships"
  | "voiceprint"
  | "cast-system";

export type CharacterMotionLesson = LearningModule & {
  collection: "Characters in Motion";
  sourceTitles: string[];
  sourceNote: string;
  workspaceTarget: CharacterWorkspaceTarget;
  workspaceLabel: string;
  workspaceHref: string;
  workspaceSection?: string;
  characterFocus: string[];
};

export const characterArcShapes: { id: CharacterArcShape; label: string; description: string }[] = [
  { id: "positive-transformation", label: "Positive transformation", description: "The character replaces a limiting strategy with a more truthful and effective one." },
  { id: "steadfast-flat", label: "Steadfast or flat", description: "The character holds a tested truth and changes the people or system around them." },
  { id: "negative-corruption", label: "Negative or corruption", description: "Pressure rewards a damaging strategy until the character embraces it." },
  { id: "disillusionment", label: "Disillusionment", description: "The character loses a false belief, but the truth may be painful rather than liberating." },
  { id: "tragic-refusal", label: "Tragic refusal", description: "The character reaches the decisive truth or choice and refuses it at a cost." },
  { id: "recovery-reconciliation", label: "Recovery or reconciliation", description: "Change is demonstrated through repair, renewed trust or a sustainable new practice." },
  { id: "incomplete-ambiguous", label: "Incomplete or ambiguous", description: "The ending provides mixed evidence, partial change or an intentionally unresolved condition." },
  { id: "ensemble-relationship", label: "Ensemble or relationship", description: "Change is distributed across a group or becomes visible through how a relationship reorganizes." },
  { id: "custom", label: "Describe your own", description: "Use the checkpoints without forcing the story into a named arc pattern." },
];

export const characterLegacySourceMap = [
  { source: "Character Guide", lessonIds: ["characters-engine", "characters-relationships", "characters-voiceprint", "characters-cast-system"] },
  { source: "Compelling Characters", lessonIds: ["characters-engine", "characters-choice-proof", "characters-cast-system"] },
  { source: "Character Archetypes", lessonIds: ["characters-opposition", "characters-cast-system"] },
  { source: "Character Development", lessonIds: ["characters-engine", "characters-choice-proof", "characters-inner-journey"] },
  { source: "Inner Journey", lessonIds: ["characters-inner-journey"] },
  { source: "Inner Journey — Four Acts", lessonIds: ["characters-inner-journey"] },
  { source: "Heart of Conflict", lessonIds: ["characters-conflict", "characters-opposition"] },
  { source: "Man vs Himself", lessonIds: ["characters-conflict"] },
  { source: "Dialectical Triad", lessonIds: ["characters-opposition"] },
  { source: "Questions — Act 1", lessonIds: ["characters-inner-journey"] },
  { source: "Questions — Act 2", lessonIds: ["characters-inner-journey"] },
  { source: "Questions — Act 3", lessonIds: ["characters-inner-journey"] },
  { source: "Questions — Act 4", lessonIds: ["characters-inner-journey"] },
] as const;

const sourceTitles = (lessonId: string) => characterLegacySourceMap.filter((entry) => entry.lessonIds.includes(lessonId as never)).map((entry) => entry.source);
const sourceNote = (lessonId: string) => `PlotPickled from the legacy Character archive: ${sourceTitles(lessonId).join(", ")}. The source is consolidated, modernized and connected to current PlotPickle evidence rather than copied as separate articles.`;

export const characterMotionLessons: CharacterMotionLesson[] = [
  {
    id: "characters-engine",
    number: 44,
    path: "Development",
    title: "Build the Character Engine",
    duration: "25–35 min",
    overview: "Connect want, need, Ghost, protective lie, emerging truth, strengths, liabilities, strategy, stakes and contradiction into one playable dramatic engine.",
    objectives: ["Separate a conscious want from an underlying need.", "Translate backstory into present behaviour and access.", "Define a strategy that can be pressured and changed on screen."],
    sections: [
      { heading: "Start with the active strategy", paragraphs: ["A character is not a biography. The useful question is what the person does now to pursue safety, belonging, control, love, status, justice or another need. The current strategy should explain repeated choices while leaving room for contradiction."], points: ["Want: the result the character consciously pursues.", "Need: the truth or capacity required for deeper change.", "Ghost: a formative condition still shaping present interpretation.", "Protective lie: the belief that makes the current strategy feel necessary.", "Emerging truth: the understanding that pressure may prove or reject."] },
      { heading: "Make strengths double-edged", paragraphs: ["A strength becomes dramatic when the same capacity that helps in one condition creates cost in another. Loyalty may become complicity; decisiveness may become control; empathy may become avoidance of necessary conflict."], points: ["Name the strength.", "Name the condition where it works.", "Name the condition where it becomes a liability.", "Show the cost through a choice rather than a label."] },
      { heading: "Use backstory only when it acts", paragraphs: ["Keep backstory that changes what the character notices, fears, knows, can access, withholds, risks or chooses. A fact that never affects present action may be interesting to the writer but is not yet part of the screenplay engine."] },
    ],
    definitions: [
      { term: "Protective lie", meaning: "A limiting belief that makes the character's current survival strategy feel reasonable." },
      { term: "Emerging truth", meaning: "The more accurate understanding the story may test, prove, complicate or reject." },
      { term: "Playable", meaning: "Expressed through observable behaviour, choice, dialogue, silence, access or consequence." },
    ],
    example: { title: "A strength under the wrong pressure", text: "Mara's reliability wins trust at work, but she treats every relationship like a duty roster. When her brother asks for honest disagreement rather than rescue, reliability becomes control until she risks letting him choose badly." },
    checklist: ["Want and need are different.", "The Ghost affects present behaviour.", "The protective lie explains the current strategy.", "A strength can create cost.", "The character contains a useful contradiction.", "The engine can be tested by visible choices."],
    mistakes: ["Writing biography without present consequence.", "Treating flaw as a moral insult.", "Making need a second external goal.", "Explaining the arc before dramatizing it."],
    exercise: "Choose one active character. Complete the sentence: Because of the Ghost, they believe ____, so when pressured they usually ____. Name one strength that helps this strategy and one condition where it becomes costly.",
    apply: "Block plan",
    tags: ["character engine", "want", "need", "ghost", "protective lie", "emerging truth", "strength", "flaw", "strategy", "backstory"],
    collection: "Characters in Motion",
    sourceTitles: sourceTitles("characters-engine"),
    sourceNote: sourceNote("characters-engine"),
    workspaceTarget: "character-engine",
    workspaceLabel: "Characters in Motion",
    workspaceHref: "/characters-in-motion",
    workspaceSection: "engine",
    characterFocus: ["want", "need", "ghost", "protective lie", "emerging truth", "strategy", "contradiction"],
  },
  {
    id: "characters-choice-proof",
    number: 45,
    path: "Craft",
    title: "Prove Character Through Choice",
    duration: "25–35 min",
    overview: "Turn profile claims into a chain of condition, objective, options, pressure, tactic, choice, consequence and changed strategy.",
    objectives: ["Find character evidence in Blocks, scenes, mini-blocks and screenplay elements.", "Distinguish a stated trait from a pressured choice.", "Design increasingly costly proof without requiring a positive transformation."],
    sections: [
      { heading: "Build the evidence chain", paragraphs: ["Character becomes visible when the audience can compare what was available with what the person chose. A useful evidence chain records the condition, objective, meaningful options, pressure, tactic, decision, consequence and next strategy."], points: ["Condition: what is true at the start of the movement.", "Objective: what the character tries to change now.", "Options: at least two live courses of action.", "Choice: the selected action or refusal.", "Consequence: the new pressure created by that decision."] },
      { heading: "Raise the cost, not only the volume", paragraphs: ["An arc does not require louder versions of the same obstacle. Strong proof removes excuses, increases personal cost, changes who is watching or forces the character to sacrifice one value to protect another."] },
      { heading: "Compare plan with draft", paragraphs: ["Use the Character Proof dashboard to compare profile and Arc Matrix claims with linked Blocks, scenes, mini-blocks, checkpoints and screenplay character cues. Gaps are questions for the writer, not permission for automatic rewriting."] },
    ],
    definitions: [
      { term: "Character evidence", meaning: "A linked story event that demonstrates a belief, strategy, choice, consequence, relationship shift or voice pattern." },
      { term: "Costly choice", meaning: "A decision that risks or sacrifices something the character values." },
      { term: "Changed strategy", meaning: "A new method of pursuit produced by prior pressure and consequence." },
    ],
    example: { title: "The same belief at three costs", text: "At first, Eli hides a mistake to protect his job. Later he lets a colleague take blame to protect promotion. At crisis, he must either repeat the strategy and endanger a patient or confess publicly. The cost progression proves the belief before the final choice tests change." },
    checklist: ["The objective is visible.", "More than one option is live.", "Pressure is character-specific.", "The choice creates consequence.", "Later evidence increases cost or removes an excuse.", "The ending proof can be compared with the opening strategy."],
    mistakes: ["Calling a feeling an action.", "Using a final speech as the only proof of change.", "Treating all evidence as equally important.", "Letting diagnostics rewrite scenes automatically."],
    exercise: "Find one current Block or scene containing the selected character. Write the objective, live options, choice and consequence. Then identify what belief or strategy the evidence supports or contradicts.",
    apply: "Screenplay",
    tags: ["character evidence", "choice", "consequence", "objective", "pressure", "tactic", "DraftLens", "scene", "mini-block", "screenplay proof"],
    collection: "Characters in Motion",
    sourceTitles: sourceTitles("characters-choice-proof"),
    sourceNote: sourceNote("characters-choice-proof"),
    workspaceTarget: "proof-dashboard",
    workspaceLabel: "Character Proof dashboard",
    workspaceHref: "/characters-in-motion",
    workspaceSection: "proof",
    characterFocus: ["choice", "consequence", "block evidence", "scene evidence", "screenplay evidence"],
  },
  {
    id: "characters-inner-journey",
    number: 46,
    path: "Development",
    title: "Map the Inner Journey Without Forcing It",
    duration: "30–40 min",
    overview: "Use flexible opening, catalyst, threshold, midpoint, crisis, climax, ending and custom checkpoints across positive, flat, negative, tragic, ambiguous and ensemble arcs.",
    objectives: ["Choose an intended arc shape without treating it as a mandatory template.", "Use checkpoints as evidence locations rather than fixed page prescriptions.", "Ask act-specific questions that adapt to the active character and story position."],
    sections: [
      { heading: "Choose the shape, then test it", paragraphs: ["An arc shape communicates intention; it does not guarantee what the draft proves. Positive transformation is only one option. A steadfast character may hold a truth, a tragic character may refuse it, and an ensemble may distribute change across relationships."], points: characterArcShapes.map((shape) => `${shape.label}: ${shape.description}`) },
      { heading: "Use flexible checkpoints", paragraphs: ["Opening, catalyst, threshold, midpoint, crisis, climax and ending are useful comparison points because they reveal strategy under changing pressure. Custom checkpoints are equally valid when the story's form requires them."], points: ["Opening state", "Catalyst response", "Threshold choice", "Midpoint reinterpretation", "Crisis choice", "Climax proof", "Ending state", "Relationship impact"] },
      { heading: "Let the active story choose the questions", paragraphs: ["Characters in Motion recommends questions from the selected act, Block, scene and checkpoint. The questions diagnose evidence; they do not require a Hero's Journey or fixed Block assignment."] },
    ],
    definitions: [
      { term: "Arc shape", meaning: "The intended pattern of change, refusal, steadfastness, recovery, ambiguity or distributed relationship movement." },
      { term: "Checkpoint", meaning: "A chosen story position used to record belief, strategy, pressure, choice, consequence and evidence." },
      { term: "Climax proof", meaning: "The decisive action that demonstrates change, steadfastness, corruption, refusal or unresolved contradiction." },
    ],
    example: { title: "A flat arc with relationship change", text: "Nadia begins and ends believing the institution must tell the truth. Her checkpoints do not show belief reversal; they show increasing cost, smarter tactics and the gradual conversion of two colleagues who initially oppose her." },
    checklist: ["The arc shape is optional and editable.", "Checkpoints follow the story rather than a rigid page map.", "Each checkpoint contains evidence.", "Crisis and climax choices are distinct.", "The ending state includes relationship or world impact.", "Ambiguity is deliberate rather than missing information."],
    mistakes: ["Forcing every character into positive transformation.", "Treating midpoint as a page number only.", "Writing checkpoint summaries without linked evidence.", "Confusing an incomplete arc with an unfinished draft."],
    exercise: "Select an intended arc shape. Choose the checkpoint nearest the active Block and record belief, strategy, pressure, choice, consequence and one linked piece of evidence.",
    apply: "Block plan",
    tags: ["inner journey", "four acts", "act questions", "arc shape", "flat arc", "negative arc", "tragic arc", "ambiguous arc", "ensemble arc", "checkpoints"],
    collection: "Characters in Motion",
    sourceTitles: sourceTitles("characters-inner-journey"),
    sourceNote: sourceNote("characters-inner-journey"),
    workspaceTarget: "inner-journey",
    workspaceLabel: "Contextual arc guide",
    workspaceHref: "/characters-in-motion",
    workspaceSection: "journey",
    characterFocus: ["arc shape", "checkpoint", "act questions", "climax proof", "ending state"],
  },
  {
    id: "characters-conflict",
    number: 47,
    path: "Craft",
    title: "Join Inner and Outer Conflict",
    duration: "25–35 min",
    overview: "Connect external obstacles to the belief, fear, desire, moral cost and relationship strategy they expose in this specific character.",
    objectives: ["Modernize conflict categories into playable pressures.", "Make the same obstacle produce different choices for different characters.", "Link internal conflict to action, refusal, language, risk and consequence."],
    sections: [
      { heading: "Use a pressure spectrum", paragraphs: ["Conflict may arise from self, another person, a relationship, a group, an institution, a system, environment, technology, time, history, fate or social expectation. The category matters less than how the character interprets and answers it."], points: ["Self versus belief, fear, desire or moral cost.", "Person versus person or relationship.", "Person versus group, institution or system.", "Person versus environment or nature.", "Person versus technology or constructed system.", "Person versus time, history, fate or social expectation."] },
      { heading: "Make internal conflict playable", paragraphs: ["Thoughts and feelings become screenplay conflict when they change what the character notices, withholds, says, refuses, risks or does. An internal dilemma needs live options with meaningful costs."] },
      { heading: "Connect pressure to consequence", paragraphs: ["External pressure should expose or reward the current strategy. Consequence then changes the next available choice, preventing conflict from becoming a sequence of unrelated obstacles."] },
    ],
    definitions: [
      { term: "Inner conflict", meaning: "Competing beliefs, desires, loyalties or moral costs that alter observable behaviour." },
      { term: "Outer conflict", meaning: "Resistance in the world that blocks, redirects or raises the cost of an objective." },
      { term: "Character-specific pressure", meaning: "An obstacle whose meaning and available response depend on this person's history, values, skills and relationships." },
    ],
    example: { title: "One deadline, two characters", text: "A storm traps a rescue team. For the leader, the deadline pressures control and responsibility; for the medic, it pressures a promise never to abandon one patient. The same weather produces incompatible choices because it activates different strategies." },
    checklist: ["The external obstacle is concrete.", "The internal dilemma has live options.", "Pressure activates the character engine.", "The choice is visible.", "The consequence changes later options.", "Conflict is not reduced to argument alone."],
    mistakes: ["Leaving internal conflict entirely in thought.", "Using generic obstacles unrelated to character.", "Repeating the same argument without changed stakes.", "Treating a category name as a scene."],
    exercise: "Take the active Block's conflict. Explain what it means specifically to the selected character, which strategy it activates, the live alternative and the consequence of each option.",
    apply: "Block plan",
    tags: ["heart of conflict", "man vs himself", "internal conflict", "external conflict", "moral dilemma", "system", "nature", "technology", "time"],
    collection: "Characters in Motion",
    sourceTitles: sourceTitles("characters-conflict"),
    sourceNote: sourceNote("characters-conflict"),
    workspaceTarget: "conflict",
    workspaceLabel: "Character conflict guide",
    workspaceHref: "/characters-in-motion",
    workspaceSection: "conflict",
    characterFocus: ["internal conflict", "external pressure", "moral cost", "choice", "consequence"],
  },
  {
    id: "characters-opposition",
    number: 48,
    path: "Craft",
    title: "Build Opposition as a Competing Worldview",
    duration: "25–35 min",
    overview: "Design protagonists, antagonists, rivals, foils and systems around incompatible objectives and persuasive working beliefs rather than simple villain labels.",
    objectives: ["Give the opposing force agency and self-justification.", "Use thesis, antithesis and synthesis as an optional lens.", "Distinguish moral equivalence from dramatic credibility."],
    sections: [
      { heading: "Start with incompatible objectives", paragraphs: ["Opposition becomes active when another person, group, system or condition pursues an objective that cannot coexist with the protagonist's current course. The opposing force should be able to initiate action rather than merely react."], points: ["Protagonist position or working belief.", "Counter-position embodied in action.", "Evidence that makes each position persuasive to its holder.", "Escalation through incompatible objectives.", "Changed understanding, unresolved tension or tragic refusal."] },
      { heading: "Use the dialectical lens carefully", paragraphs: ["Starting belief → counter-pressure → changed understanding is the plain-language version of thesis, antithesis and synthesis. The story may end with synthesis, rejection, stalemate or tragedy; it does not need to declare both sides equally moral."] },
      { heading: "Let foils reveal strategy", paragraphs: ["A foil is useful when a contrasting strategy makes the protagonist's choices legible. It is a temporary dramatic function, not a complete identity or required cast slot."] },
    ],
    definitions: [
      { term: "Opposing force", meaning: "A person, group, system or condition with agency or pressure that blocks the current objective." },
      { term: "Foil", meaning: "A character whose contrasting strategy makes another character's choices easier to perceive." },
      { term: "Dialectical triad", meaning: "An optional lens comparing a starting position, counter-position and resulting changed understanding." },
    ],
    example: { title: "Credible does not mean equivalent", text: "The inspector believes secrecy prevents panic; the journalist believes secrecy enables abuse. Both have evidence and agency, but the screenplay can still judge the inspector's coercion as harmful while understanding why he chooses it." },
    checklist: ["The opposing force has an objective.", "Its actions can change conditions.", "Self-justification is coherent.", "The protagonist is pressured to adapt.", "Foils reveal strategy rather than replace specificity.", "The ending resolves or deliberately preserves the argument."],
    mistakes: ["Writing an antagonist who only waits for the hero.", "Confusing credibility with moral equivalence.", "Treating archetype as personality.", "Forcing a neat synthesis onto a tragic or unresolved ending."],
    exercise: "Write the protagonist's working belief and the strongest counter-position in the active story. Give each one concrete evidence, an objective and one action that escalates incompatibility.",
    apply: "Block plan",
    tags: ["antagonist", "opposition", "foil", "rival", "dialectical triad", "thesis", "antithesis", "synthesis", "worldview"],
    collection: "Characters in Motion",
    sourceTitles: sourceTitles("characters-opposition"),
    sourceNote: sourceNote("characters-opposition"),
    workspaceTarget: "opposition",
    workspaceLabel: "Resonance",
    workspaceHref: "/resonance",
    characterFocus: ["opposing worldview", "agency", "objective", "foil", "theme", "anti-theme"],
  },
  {
    id: "characters-relationships",
    number: 49,
    path: "Development",
    title: "Design Relationships That Change Both People",
    duration: "30–40 min",
    overview: "Define each relationship from both directions, track power and withheld needs, and connect change to shared scenes and arc checkpoints.",
    objectives: ["Compare what each person wants from the other.", "Track status, history, recurring tactics and turning events.", "Use relationship change as character evidence rather than decoration."],
    sections: [
      { heading: "Write both perspectives", paragraphs: ["A relationship is not one shared paragraph. Each person assigns the other a role, wants something different and interprets the same history through a different need. PlotPickle can compare the selected character's relationship record with the reciprocal record on the other character."], points: ["What each wants from the other.", "The role each assigns the other.", "Shared and disputed history.", "Affection, dependence, debt or resentment.", "Status and power.", "What is withheld.", "Recurring tactic and pressure point."] },
      { heading: "Track the turning event", paragraphs: ["A relationship changes when an action alters trust, debt, status, access, expectation or dependence. Link the turning event to a scene, Block or checkpoint so the change can be verified in the story."] },
      { heading: "Allow adaptation in both directions", paragraphs: ["One person's change should force the other to adapt, resist, exploit, grieve or reconsider. The resulting relationship may strengthen, rupture, reverse, stabilize or remain unresolved."] },
    ],
    definitions: [
      { term: "Reciprocal perspective", meaning: "The second character's separate description of the same relationship." },
      { term: "Relationship tactic", meaning: "A repeated method used to gain closeness, control, approval, distance, truth or another relational objective." },
      { term: "Turning event", meaning: "An action that changes trust, status, access, debt, expectation or dependence." },
    ],
    example: { title: "Two descriptions, one marriage", text: "Lena describes Sam as the person she must protect from risk. Sam describes Lena as the person who uses protection to avoid being known. Their midpoint scene changes both perspectives when Sam accepts a danger Lena cannot control." },
    checklist: ["Both perspectives are visible.", "Each person wants something specific.", "Power or status can change.", "Something meaningful is withheld.", "A turning event is linked to story evidence.", "The ending condition reflects both characters' adaptation."],
    mistakes: ["Using one shared relationship description.", "Treating conflict as proof of depth.", "Writing chemistry without objectives or tactics.", "Changing one character while the other remains mechanically unchanged."],
    exercise: "Choose a relationship. Write one sentence from each person's perspective, identify the current power balance and name the next event that could change trust, status or dependence.",
    apply: "Screenplay",
    tags: ["relationship matrix", "romance", "friendship", "family", "mentor", "rival", "status", "power", "chemistry", "two perspectives"],
    collection: "Characters in Motion",
    sourceTitles: sourceTitles("characters-relationships"),
    sourceNote: sourceNote("characters-relationships"),
    workspaceTarget: "relationships",
    workspaceLabel: "Relationship matrix",
    workspaceHref: "/characters-in-motion",
    workspaceSection: "relationships",
    characterFocus: ["reciprocal perspective", "power", "status", "withholding", "turning event", "relationship impact"],
  },
  {
    id: "characters-voiceprint",
    number: 50,
    path: "Craft",
    title: "Give Every Character a Playable Voice",
    duration: "30–40 min",
    overview: "Build voice from worldview, attention, rhythm, vocabulary, verbal fingerprints, emotional access, status shifts, persuasion, silence and relationship pressure.",
    objectives: ["Distinguish voice from accent or demographic shorthand.", "Test Voiceprint claims against screenplay dialogue evidence.", "Research language communities with specificity and informed human review."],
    sections: [
      { heading: "Voice begins before dialogue", paragraphs: ["Voice includes what the character notices, how they frame causality, which emotions they permit, how they manage status and what they do instead of speaking. Dialogue is one expression of a larger strategy."], points: ["Worldview and attention.", "Rhythm and sentence shape.", "Vocabulary and metaphor families.", "Verbal fingerprints.", "Humour and avoidance.", "Emotional access.", "Status shifts and persuasion strategy.", "Silence, interruption and action."] },
      { heading: "Change voice by relationship and pressure", paragraphs: ["A playable Voiceprint is stable enough to recognize and flexible enough to respond to status, intimacy, danger and concealment. Compare how the same character speaks to an authority, rival, dependent and trusted friend."] },
      { heading: "Research without certification claims", paragraphs: ["Avoid phonetic spelling and demographic shortcuts as substitutes for a person. Research variation within language communities, power, context and consent. AI can suggest questions or flag patterns, but it cannot certify lived experience or replace informed human review."] },
    ],
    definitions: [
      { term: "Voiceprint", meaning: "A set of repeatable language, attention, rhythm, emotional and persuasion patterns that remain responsive to context." },
      { term: "Verbal fingerprint", meaning: "A recurring phrase shape, avoidance pattern, metaphor family or conversational move associated with the character." },
      { term: "Naturalistic dialogue", meaning: "Dialogue shaped to feel credible while still serving screenplay pace, conflict and clarity." },
    ],
    example: { title: "Status changes sentence shape", text: "With staff, Omar speaks in clipped decisions. With his mother, he over-explains and asks permission. Under public accusation, both patterns collide: short denials followed by a flood of justification." },
    checklist: ["Worldview affects what is noticed.", "Rhythm is describable without caricature.", "Vocabulary has specific domains.", "Voice changes by relationship and pressure.", "Silence and action are included.", "Representation questions receive informed human review."],
    mistakes: ["Reducing voice to accent.", "Using demographic labels as dialogue instructions.", "Making every line equally polished.", "Asking AI to certify authenticity."],
    exercise: "Select one character and two relationships. Write the same refusal to each person, changing status, emotional access, rhythm, vocabulary and what remains unsaid while preserving the character's core worldview.",
    apply: "Screenplay",
    tags: ["voiceprint", "dialogue", "unique voice", "rhythm", "vocabulary", "metaphor", "status", "persuasion", "silence", "representation"],
    collection: "Characters in Motion",
    sourceTitles: sourceTitles("characters-voiceprint"),
    sourceNote: sourceNote("characters-voiceprint"),
    workspaceTarget: "voiceprint",
    workspaceLabel: "Voiceprint Engine",
    workspaceHref: "/voiceprint",
    characterFocus: ["worldview", "rhythm", "vocabulary", "verbal fingerprints", "emotional access", "status", "persuasion"],
  },
  {
    id: "characters-cast-system",
    number: 51,
    path: "Development",
    title: "Design the Cast as a Dramatic System",
    duration: "30–40 min",
    overview: "Treat archetypes as optional functions, audit cast economy and identify redundant or underpowered roles without automatically merging characters.",
    objectives: ["Assign multiple flexible dramatic functions to characters.", "Identify cast redundancy as a writer question.", "Modernize dated labels into agency, vulnerability and story-function language."],
    sections: [
      { heading: "Use functions, not identity boxes", paragraphs: ["Protagonist, opposing force, ally, pressure ally, foil, mentor, challenger, witness, beneficiary, victim, relationship carrier, subplot carrier, tonal counterforce and community representative are temporary dramatic functions. One character may carry several and a function may transfer or reverse."], points: ["Central point of change.", "Opposing force.", "Ally or pressure ally.", "Foil or contrasting strategy.", "Mentor or inherited worldview.", "Challenger or threshold function.", "Witness, beneficiary or victim of choices.", "Relationship, subplot or community carrier."] },
      { heading: "Audit cast economy", paragraphs: ["Compare the functions, Story Threads, Blocks and scenes carried by each character. Two thin characters may be redundant, or they may need stronger distinctions. The audit should ask questions and preserve writer ownership rather than automatically merging roles."], points: ["Who initiates action?", "Who changes another person's options?", "Who carries information only?", "Who exists only to approve the protagonist?", "Which functions lack a character?", "Which characters have no consequential scene evidence?"] },
      { heading: "Modernize vulnerability and rescue", paragraphs: ["Replace labels such as Damsel with neutral analysis: who has agency, who is endangered, who creates the rescue plan, who pays the cost and how vulnerability changes relationships. A vulnerable character can remain active; a powerful character can still require rescue."] },
      { heading: "Do not promise commercial outcomes", paragraphs: ["Self-sacrifice, antiheroes, forbidden love and other familiar patterns can shape audience experience, but no character device guarantees profitability, recognition or production. Execution, context and the complete work matter."], points: ["Archetypes are optional lenses.", "Representation requires specificity, agency, research and informed review.", "AI may surface questions but cannot certify authenticity or commercial potential."] },
    ],
    definitions: [
      { term: "Cast function", meaning: "A temporary job a character performs in the dramatic system." },
      { term: "Cast economy", meaning: "The balance between distinct character value and the complexity or repetition created by the size of the cast." },
      { term: "Redundancy signal", meaning: "Evidence that two characters may perform the same function without meaningful contrast, consequence or relationship value." },
    ],
    example: { title: "Keep both or combine?", text: "Two detectives deliver clues and agree with the lead. The audit asks whether one can become a procedural loyalist and the other a moral challenger. If no distinct pressure, relationship or thread emerges, combining them becomes a writer option—not an automatic instruction." },
    checklist: ["Every major character initiates or changes something.", "Functions can overlap intentionally.", "Foils have specific lives beyond contrast.", "Thin roles are questioned rather than deleted automatically.", "Vulnerability is separated from passivity.", "No craft pattern is presented as a profitability guarantee."],
    mistakes: ["Treating archetypes as identities.", "Filling required cast slots mechanically.", "Using dated gendered labels.", "Merging characters without reviewing relationships, rights or continuity.", "Claiming a character device predicts commercial success."],
    exercise: "List each active character's two most important functions, linked Story Threads and consequential scenes. Identify one missing function and one possible redundancy, then write the question you need to answer before changing the cast.",
    apply: "Block plan",
    tags: ["character archetypes", "cast design", "cast economy", "supporting characters", "foil", "mentor", "ensemble", "redundancy", "damsel", "agency", "profitability"],
    collection: "Characters in Motion",
    sourceTitles: sourceTitles("characters-cast-system"),
    sourceNote: sourceNote("characters-cast-system"),
    workspaceTarget: "cast-system",
    workspaceLabel: "Cast system audit",
    workspaceHref: "/characters-in-motion",
    workspaceSection: "cast",
    characterFocus: ["cast function", "archetype lens", "story threads", "scene coverage", "redundancy question", "agency"],
  },
];

export type CharacterQuestionContext = {
  act: number;
  blockNumber: number;
  checkpoint: ArcCheckpointKind;
  arcShape: CharacterArcShape;
  characterName: string;
  hasRelationshipEvidence: boolean;
  hasDialogueEvidence: boolean;
};

const actQuestions: Record<number, string[]> = {
  1: [
    "What current strategy protects this character before the story disrupts it?",
    "What does the Catalyst threaten that this character cannot dismiss?",
    "Which threshold choice reveals the cost of remaining unchanged?",
  ],
  2: [
    "What new pressure exposes the current strategy's limits?",
    "How do relationships change the available choices?",
    "What does the midpoint force this character to reinterpret?",
  ],
  3: [
    "Which consequences arise directly from earlier decisions?",
    "Where does a false solution or defensive relapse occur?",
    "What crisis choice exposes the deepest working belief?",
  ],
  4: [
    "What action proves change, steadfastness, corruption, refusal or ambiguity?",
    "Who pays for the final choice?",
    "How does the ending relationship or closing image show the new condition?",
  ],
};

const checkpointQuestions: Record<ArcCheckpointKind, string> = {
  opening: "What opening behaviour establishes belief and strategy without explanation?",
  catalyst: "How does the first response to disruption expose the protective lie?",
  threshold: "What choice makes the old strategy harder to maintain?",
  midpoint: "What evidence changes the character's interpretation of the problem?",
  crisis: "Which live options force the deepest value conflict?",
  climax: "What decisive action provides the strongest proof of the intended arc shape?",
  ending: "What final relationship, behaviour or image confirms or complicates the ending state?",
  custom: "Why is this custom checkpoint the most useful place to compare belief, strategy and evidence?",
};

const shapeQuestions: Record<CharacterArcShape, string> = {
  "positive-transformation": "What costly action demonstrates a more truthful strategy than the opening one?",
  "steadfast-flat": "How does the character hold the tested truth while changing another person or system?",
  "negative-corruption": "Which reward makes the damaging strategy easier to embrace?",
  disillusionment: "What truth is gained, and what hope or identity is lost with it?",
  "tragic-refusal": "Where is the better choice genuinely available before the character refuses it?",
  "recovery-reconciliation": "Which repeated practice or repair proves that change can last beyond one speech?",
  "incomplete-ambiguous": "Which pieces of evidence point in different directions, and is that ambiguity intentional?",
  "ensemble-relationship": "How does one person's change force adaptation across the group or central relationship?",
  custom: "What exact change, refusal or stable condition should the selected checkpoints test?",
};

export function characterQuestionsForContext(context: CharacterQuestionContext) {
  const questions = [
    ...(actQuestions[Math.min(4, Math.max(1, context.act))] ?? actQuestions[1]),
    checkpointQuestions[context.checkpoint],
    shapeQuestions[context.arcShape],
  ];
  if (!context.hasRelationshipEvidence) questions.push(`Which relationship should make ${context.characterName}'s current strategy visible through status, trust or consequence?`);
  if (!context.hasDialogueEvidence) questions.push(`Where should ${context.characterName}'s Voiceprint become audible through dialogue, silence, interruption or action?`);
  questions.push(`What evidence in Block ${context.blockNumber} supports or contradicts the planned character claim?`);
  return [...new Set(questions)];
}

export function characterMotionSearchText(lesson: CharacterMotionLesson) {
  return [
    lesson.collection,
    ...lesson.sourceTitles,
    lesson.sourceNote,
    lesson.workspaceLabel,
    ...lesson.characterFocus,
    ...lesson.tags,
  ].join(" ").toLowerCase();
}
