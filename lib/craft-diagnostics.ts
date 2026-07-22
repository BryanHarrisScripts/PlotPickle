import type { Character, PlotPickleProject } from "./project";
import type { StoryScene } from "./structure";

export type DiagnosticSeverity = "healthy" | "watch" | "problem";
export type DiagnosticScope = "opening" | "act-one" | "scene" | "thread" | "ledger" | "arc" | "timeline";

export type CraftFinding = {
  id: string;
  scope: DiagnosticScope;
  severity: DiagnosticSeverity;
  title: string;
  reason: string;
  evidence: string[];
  questions: string[];
  blockNumber?: number;
  sceneId?: string;
  characterId?: string;
  threadId?: string;
};

export type DiagnosticScore = {
  score: number;
  complete: number;
  total: number;
  severity: DiagnosticSeverity;
};

export type OpeningEffect = {
  name: "Anchor" | "Grip" | "Compass" | "Question" | "Imprint" | "Echo" | "Handoff";
  present: boolean;
  evidence: string;
  diagnosis: string;
};

export type LaunchSignal = {
  blockNumber: number;
  name: string;
  present: boolean;
  evidence: string;
  diagnosis: string;
};

export type ThreadOverlay = {
  id: string;
  name: string;
  status: string;
  blocks: number[];
  sceneIds: string[];
  milestoneCount: number;
  gapBlocks: number[];
  findings: CraftFinding[];
};

export type LedgerEntry = {
  id: string;
  setupBlock: number | null;
  payoffBlock: number | null;
  reflectionBlock: number | null;
  setup: string;
  payoff: string;
  reflection: string;
  status: "balanced" | "open" | "unearned" | "unreflected";
};

export type ArcCheckpointView = {
  characterId: string;
  characterName: string;
  checkpoints: Array<{ label: string; blockNumber: number | null; sceneId: string; evidence: string }>;
  findings: CraftFinding[];
};

export type TimelineRow = {
  sceneId: string;
  title: string;
  blockNumber: number;
  chronologyPosition: number;
  presentationPosition: number | null;
  presentationDelta: number | null;
  temporalSignal: string;
};

function text(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function evidence(...values: unknown[]) {
  return values.map(text).filter(Boolean);
}

function score(complete: number, total: number): DiagnosticScore {
  const value = total ? Math.round((complete / total) * 100) : 0;
  return { score: value, complete, total, severity: value >= 75 ? "healthy" : value >= 45 ? "watch" : "problem" };
}

function severityFor(count: number): DiagnosticSeverity {
  return count === 0 ? "healthy" : count <= 2 ? "watch" : "problem";
}

function uniqueNumbers(values: number[]) {
  return [...new Set(values)].sort((a, b) => a - b);
}

function projectScenes(project: PlotPickleProject) {
  return project.blocks.flatMap((block) => block.scenes.map((scene) => ({ block, scene })));
}

function nextScene(project: PlotPickleProject, sceneId: string) {
  const rows = projectScenes(project);
  const index = rows.findIndex((row) => row.scene.id === sceneId);
  return index >= 0 ? rows[index + 1] : undefined;
}

function finding(input: Omit<CraftFinding, "id"> & { id?: string }): CraftFinding {
  return {
    ...input,
    id: input.id ?? `${input.scope}-${input.sceneId ?? input.characterId ?? input.threadId ?? input.blockNumber ?? input.title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
  };
}

export function diagnoseScenePulse(project: PlotPickleProject, sceneId: string): { scene: StoryScene | null; score: DiagnosticScore; findings: CraftFinding[] } {
  const row = projectScenes(project).find((item) => item.scene.id === sceneId);
  if (!row) return { scene: null, score: score(0, 7), findings: [] };
  const { block, scene } = row;
  const following = nextScene(project, scene.id);
  const checks = [
    Boolean(text(scene.purpose)),
    Boolean(text(scene.objective)),
    Boolean(text(scene.opposition) || text(scene.conflict)),
    Boolean(text(scene.entryCondition)),
    Boolean(text(scene.reversal) || text(scene.turn)),
    Boolean(text(scene.exitCondition) || text(scene.outcome) || text(scene.resolution)),
    Boolean(following && evidence(scene.outcome, scene.exitCondition).some((value) => evidence(following.scene.entryCondition, following.scene.objective, following.block.goal).some((next) => next.toLowerCase().includes(value.toLowerCase().split(/\s+/).slice(0, 3).join(" "))))),
  ];
  const findings: CraftFinding[] = [];
  if (!text(scene.purpose)) findings.push(finding({ scope: "scene", severity: "problem", title: "Scene has no indispensable job", reason: "Without one dominant purpose, action and dialogue can accumulate without changing the story.", evidence: evidence(block.goal, block.choice, scene.action), questions: ["What would the story lose if this scene disappeared?", "Which single result must this scene create?"], blockNumber: block.number, sceneId: scene.id }));
  if (!text(scene.objective)) findings.push(finding({ scope: "scene", severity: "problem", title: "No immediate pursuit drives the scene", reason: "A scene becomes playable when someone tries to create a specific result now.", evidence: evidence(scene.action, block.goal), questions: ["Who is driving this scene?", "What observable result are they trying to obtain before the cut?"], blockNumber: block.number, sceneId: scene.id }));
  if (!text(scene.opposition) && !text(scene.conflict)) findings.push(finding({ scope: "scene", severity: "problem", title: "Pressure Lock is open", reason: "The objective has no incompatible force resisting it, so the scene may feel like information transfer.", evidence: evidence(scene.objective, scene.characterIds.join(", ")), questions: ["Who or what requires an incompatible result?", "Why can the driver not simply get what they want?"], blockNumber: block.number, sceneId: scene.id }));
  if (!text(scene.entryCondition) || (!text(scene.exitCondition) && !text(scene.outcome))) findings.push(finding({ scope: "scene", severity: "watch", title: "Cut Line is unclear", reason: "The scene may begin before pressure starts or continue after its decisive result.", evidence: evidence(scene.entryCondition, scene.exitCondition, scene.outcome), questions: ["What is the latest possible moment to enter?", "What line, image, action or refusal completes the scene?"], blockNumber: block.number, sceneId: scene.id }));
  if (!text(scene.reversal) && !text(scene.turn)) findings.push(finding({ scope: "scene", severity: "problem", title: "No pivot changes the tactic", reason: "Without discovery, refusal, interruption or reversal, the scene can remain on one dramatic level.", evidence: evidence(scene.action, scene.resolution), questions: ["What makes the opening tactic insufficient?", "How must the driver adapt after the pivot?"], blockNumber: block.number, sceneId: scene.id }));
  if (text(scene.entryCondition) && text(scene.exitCondition) && scene.entryCondition.trim().toLowerCase() === scene.exitCondition.trim().toLowerCase()) findings.push(finding({ scope: "scene", severity: "problem", title: "The scene closes on its opening value", reason: "The practical or emotional situation appears unchanged, so the scene may not earn its screen time.", evidence: [scene.entryCondition, scene.exitCondition], questions: ["Which live value changes: trust, control, safety, status, hope or belonging?", "What evidence proves that change at the cut?"], blockNumber: block.number, sceneId: scene.id }));
  if (!following || (!text(scene.outcome) && !text(scene.exitCondition))) findings.push(finding({ scope: "scene", severity: "watch", title: "Handoff pressure is weak", reason: "The scene does not clearly send a consequence, question, choice or threat into what follows.", evidence: evidence(scene.outcome, following?.scene.entryCondition, following?.scene.objective), questions: ["What now demands action?", "How is the next movement impossible without this result?"], blockNumber: block.number, sceneId: scene.id }));
  return { scene, score: score(checks.filter(Boolean).length, checks.length), findings };
}

export function diagnoseOpeningMove(project: PlotPickleProject): { effects: OpeningEffect[]; score: DiagnosticScore; findings: CraftFinding[] } {
  const block = project.blocks[0];
  const scene = block.scenes[0];
  const lastBlock = project.blocks[23];
  const effects: OpeningEffect[] = [
    { name: "Anchor", present: Boolean(evidence(scene?.characterIds?.length ? scene.characterIds.join(", ") : "", project.development.foundations.protagonist, scene?.objective).length), evidence: evidence(project.development.foundations.protagonist, scene?.objective, block.characterIds.join(", ")).join(" · "), diagnosis: "The audience needs a person, force, value or vulnerability to track." },
    { name: "Grip", present: Boolean(evidence(project.story.hook, block.conflict, scene?.opposition, scene?.conflict).length), evidence: evidence(project.story.hook, block.conflict, scene?.opposition).join(" · "), diagnosis: "Pressure, contrast or an information gap must make the next moment necessary." },
    { name: "Compass", present: Boolean(evidence(project.world.rules, project.world.ordinaryWorld, scene?.entryCondition).length), evidence: evidence(project.world.rules, project.world.ordinaryWorld, scene?.entryCondition).join(" · "), diagnosis: "The opening should let viewers infer a relevant world rule and point of view." },
    { name: "Question", present: Boolean(evidence(project.story.dramaticQuestion, project.development.pickle.audienceQuestion, block.audienceExpectation).length), evidence: evidence(project.story.dramaticQuestion, project.development.pickle.audienceQuestion, block.audienceExpectation).join(" · "), diagnosis: "An active uncertainty should begin before the story explains everything." },
    { name: "Imprint", present: Boolean(evidence(project.metadata.tone, project.story.theme, project.development.pitch.visualVision, block.storyboardDirection).length), evidence: evidence(project.metadata.tone, project.story.theme, project.development.pitch.visualVision).join(" · "), diagnosis: "Tone, theme, rhythm and creative personality should leave a first impression." },
    { name: "Echo", present: Boolean(evidence(project.story.ending, lastBlock.summary, lastBlock.payoff, lastBlock.storyboardDirection).length), evidence: evidence(project.story.ending, lastBlock.payoff, lastBlock.storyboardDirection).join(" · "), diagnosis: "The ending should repeat, reverse or recontextualize the opening signal." },
    { name: "Handoff", present: Boolean(evidence(scene?.outcome, scene?.exitCondition, block.consequence, project.blocks[1]?.goal).length), evidence: evidence(scene?.outcome, block.consequence, project.blocks[1]?.goal).join(" · "), diagnosis: "The opening must causally, emotionally or visually hand the audience into the main story." },
  ];
  const missing = effects.filter((effect) => !effect.present);
  const findings = missing.map((effect) => finding({ scope: "opening", severity: missing.length > 3 ? "problem" : "watch", title: `${effect.name} is not yet doing visible work`, reason: effect.diagnosis, evidence: effect.evidence ? [effect.evidence] : [], questions: [`Which existing opening action could carry the ${effect.name} effect?`, "Would removing the opening damage the story's causal, emotional, visual or thematic design?"], blockNumber: 1, sceneId: scene?.id }));
  return { effects, score: score(effects.length - missing.length, effects.length), findings };
}

export function diagnoseActOneLaunch(project: PlotPickleProject): { signals: LaunchSignal[]; score: DiagnosticScore; downstreamPromises: string[]; findings: CraftFinding[] } {
  const blocks = project.blocks.slice(0, 6);
  const definitions: Array<[number, string, string, unknown[]]> = [
    [1, "Primary Presence", "The opening lacks a clear attention anchor.", [project.development.foundations.protagonist, blocks[0]?.characterIds.length, blocks[0]?.scenes[0]?.objective]],
    [1, "Revealing Contrast", "No relationship, mirror or contradiction exposes strength and missing capacity.", [blocks[0]?.conflict, project.characters.some((character) => character.relationships.length), blocks[0]?.emotionalTurn]],
    [2, "Opposing Pressure", "The force capable of pushing back is not yet active.", [project.development.foundations.opposition, blocks[1]?.conflict, blocks[1]?.scenes.some((scene) => text(scene.opposition))]],
    [2, "Pressure Multiplier", "The initial problem has not become more urgent, costly or personal.", [blocks[1]?.consequence, blocks[1]?.pickleTurn, project.story.stakes]],
    [3, "Disruption Lands", "The disturbance has not visibly overturned normal.", [project.story.catalyst, project.development.catalyst.event, blocks[2]?.action]],
    [3, "Problem Named", "The actionable problem and consequence remain difficult to state.", [project.story.dramaticQuestion, blocks[2]?.goal, project.development.catalyst.immediateImpact]],
    [4, "Outside Push", "No ally, relationship or circumstance pushes the protagonist beyond comfort.", [blocks[3]?.characterIds.length > 1, blocks[3]?.conflict, blocks[3]?.choice]],
    [4, "Inner Lock", "The old strategy or protective lie is not blocking commitment.", [project.development.ghost.lie, project.development.catalyst.resistance, blocks[3]?.emotionalTurn]],
    [5, "Counterstrike", "Opposition has not attacked in a way that activates the dramatic question.", [blocks[4]?.action, blocks[4]?.conflict, blocks[4]?.consequence]],
    [5, "Emotional Anchor", "The goal has no clearly protected relationship, place, value or future.", [project.story.stakes, blocks[4]?.characterIds.length, blocks[4]?.emotionalTurn]],
    [6, "Personal Threat", "The emotional anchor is not at credible risk.", [blocks[5]?.conflict, blocks[5]?.consequence, blocks[5]?.pickleTurn]],
    [6, "Irreversible Step", "Act I does not end with a choice that makes the remaining story necessary.", [blocks[5]?.choice, blocks[5]?.action, project.development.catalyst.doorway]],
  ];
  const signals = definitions.map(([blockNumber, name, diagnosis, values]) => ({ blockNumber, name, present: values.some(Boolean) && values.some((value) => typeof value !== "string" || text(value)), evidence: values.map((value) => typeof value === "boolean" || typeof value === "number" ? (value ? "Linked evidence present" : "") : text(value)).filter(Boolean).join(" · "), diagnosis }));
  const missing = signals.filter((signal) => !signal.present);
  const downstreamPromises = uniqueNumbers(blocks.flatMap((block) => block.setup ? [block.number] : [])).map((number) => `Block ${number}: ${project.blocks[number - 1].setup}`)
    .concat(project.storyThreads.filter((thread) => thread.status !== "resolved").map((thread) => `Thread: ${thread.name} — ${thread.question || thread.summary}`));
  const findings = missing.map((signal) => finding({ scope: "act-one", severity: missing.length >= 5 ? "problem" : "watch", title: `${signal.name} is missing from the launch`, reason: signal.diagnosis, evidence: signal.evidence ? [signal.evidence] : [], questions: ["Is another scene performing this function more powerfully?", "What later movement currently lacks the setup this signal should provide?"], blockNumber: signal.blockNumber }));
  if (!downstreamPromises.length) findings.push(finding({ scope: "act-one", severity: "watch", title: "Act I creates no trackable downstream promises", reason: "Later acts need setups, relationships, images and questions to develop or pay off.", evidence: [], questions: ["Which Act I detail should matter again later?", "What audience promise must the ending prove?"], blockNumber: 6 }));
  return { signals, score: score(signals.length - missing.length, signals.length), downstreamPromises, findings };
}

export function buildStoryThreadOverlays(project: PlotPickleProject): ThreadOverlay[] {
  const sceneRows = projectScenes(project);
  return project.storyThreads.map((thread) => {
    const linkedRows = sceneRows.filter(({ scene }) => thread.sceneIds.includes(scene.id) || scene.threadIds.includes(thread.id));
    const milestoneBlocks = thread.milestones.map((milestone) => milestone.blockNumber);
    const blocks = uniqueNumbers([...linkedRows.map(({ block }) => block.number), ...milestoneBlocks]);
    const gapBlocks: number[] = [];
    for (let index = 1; index < blocks.length; index += 1) if (blocks[index] - blocks[index - 1] > 4) gapBlocks.push(...Array.from({ length: blocks[index] - blocks[index - 1] - 1 }, (_, offset) => blocks[index - 1] + offset + 1));
    const findings: CraftFinding[] = [];
    if (!blocks.length) findings.push(finding({ scope: "thread", severity: "problem", title: `${thread.name} has no story evidence`, reason: "A stored thread that never touches a scene cannot affect the audience experience.", evidence: evidence(thread.summary, thread.question), questions: ["Where is this thread introduced through action?", "Which scene changes because this thread exists?"], threadId: thread.id }));
    if (gapBlocks.length) findings.push(finding({ scope: "thread", severity: gapBlocks.length > 6 ? "problem" : "watch", title: `${thread.name} disappears for ${gapBlocks.length} block${gapBlocks.length === 1 ? "" : "s"}`, reason: "Long absences can make a subplot or mystery feel forgotten rather than suspended.", evidence: [`Active blocks: ${blocks.join(", ")}`], questions: ["Does the audience need a reminder, complication or consequence during the gap?", "Is the absence intentional suspense or accidental disappearance?"], threadId: thread.id }));
    if (thread.status !== "resolved" && blocks.length && blocks.at(-1)! < 20) findings.push(finding({ scope: "thread", severity: "watch", title: `${thread.name} has no late-story resolution evidence`, reason: "The thread remains open but stops before the resolution act.", evidence: [`Last active block: ${blocks.at(-1)}`], questions: ["Where is the final answer, cost or transformed relationship?", "Should the thread be marked abandoned, paused or resolved?"], threadId: thread.id }));
    if (thread.status === "resolved" && !thread.milestones.some((milestone) => milestone.kind === "resolution" || milestone.kind === "payoff")) findings.push(finding({ scope: "thread", severity: "watch", title: `${thread.name} is marked resolved without a payoff milestone`, reason: "The project state says resolved, but the audience-facing evidence is not identified.", evidence: blocks.length ? [`Active blocks: ${blocks.join(", ")}`] : [], questions: ["Which scene proves the resolution?", "What changed because the thread closed?"], threadId: thread.id }));
    return { id: thread.id, name: thread.name, status: thread.status, blocks, sceneIds: linkedRows.map(({ scene }) => scene.id), milestoneCount: thread.milestones.length, gapBlocks, findings };
  });
}

function phraseKey(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9\s]/g, " ").split(/\s+/).filter((word) => word.length > 3 && !["this", "that", "with", "from", "into", "then", "when"].includes(word)).slice(0, 6);
}

function similarity(left: string, right: string) {
  const a = phraseKey(left);
  const b = new Set(phraseKey(right));
  return a.length ? a.filter((word) => b.has(word)).length / a.length : 0;
}

export function buildSetupPayoffReflectionLedger(project: PlotPickleProject): { entries: LedgerEntry[]; findings: CraftFinding[] } {
  const entries: LedgerEntry[] = [];
  const usedPayoffs = new Set<number>();
  project.blocks.forEach((block) => {
    if (!text(block.setup)) return;
    const payoff = project.blocks.slice(block.number).find((candidate) => text(candidate.payoff) && similarity(block.setup, candidate.payoff) >= 0.2);
    if (payoff) usedPayoffs.add(payoff.number);
    const reflection = payoff ? project.blocks.slice(payoff.number).find((candidate) => evidence(candidate.emotionalTurn, candidate.consequence, candidate.notes).length) : undefined;
    entries.push({ id: `setup-${block.number}`, setupBlock: block.number, payoffBlock: payoff?.number ?? null, reflectionBlock: reflection?.number ?? null, setup: block.setup, payoff: payoff?.payoff ?? "", reflection: reflection ? evidence(reflection.emotionalTurn, reflection.consequence, reflection.notes).join(" · ") : "", status: !payoff ? "open" : !reflection ? "unreflected" : "balanced" });
  });
  project.blocks.forEach((block) => {
    if (text(block.payoff) && !usedPayoffs.has(block.number)) entries.push({ id: `payoff-${block.number}`, setupBlock: null, payoffBlock: block.number, reflectionBlock: null, setup: "", payoff: block.payoff, reflection: "", status: "unearned" });
  });
  const findings = entries.filter((entry) => entry.status !== "balanced").map((entry) => finding({ scope: "ledger", severity: entry.status === "unearned" || entry.status === "open" ? "problem" : "watch", title: entry.status === "open" ? `Setup in Block ${entry.setupBlock} has no matched payoff` : entry.status === "unearned" ? `Payoff in Block ${entry.payoffBlock} has no visible setup` : `Payoff in Block ${entry.payoffBlock} has no reflection`, reason: entry.status === "open" ? "The story creates audience memory without completing or transforming it." : entry.status === "unearned" ? "The answer may arrive without enough preparation to feel inevitable in retrospect." : "The event resolves plot information but does not show its emotional, relational or thematic meaning.", evidence: evidence(entry.setup, entry.payoff, entry.reflection), questions: entry.status === "open" ? ["Where will this promise return, transform or be deliberately denied?", "Does the setup still belong in the story?"] : entry.status === "unearned" ? ["Which earlier image, choice or rule should prepare this result?", "What can be planted without telegraphing the answer?"] : ["Who absorbs the meaning of this payoff?", "What changed in behaviour, relationship or worldview?"], blockNumber: entry.payoffBlock ?? entry.setupBlock ?? undefined }));
  return { entries, findings };
}

export function buildCharacterArcCheckpointViews(project: PlotPickleProject): ArcCheckpointView[] {
  return project.characters.map((character) => {
    const matrix = character.arcMatrix;
    const points = [
      { label: "Opening", blockNumber: 1, sceneId: "", evidence: matrix.startingState || character.description },
      { label: "Catalyst", blockNumber: null, sceneId: "", evidence: matrix.protectiveLie || character.ghost },
      ...matrix.checkpoints.map((checkpoint) => ({ label: checkpoint.kind, blockNumber: checkpoint.blockNumber, sceneId: checkpoint.sceneId, evidence: evidence(checkpoint.belief, checkpoint.strategy, checkpoint.choice, checkpoint.consequence, checkpoint.evidence).join(" · ") })),
      { label: "Midpoint", blockNumber: 12, sceneId: "", evidence: matrix.midpointShift },
      { label: "Crisis", blockNumber: 16, sceneId: "", evidence: matrix.crisisChoice },
      { label: "Climax", blockNumber: 22, sceneId: "", evidence: matrix.climaxChoice },
      { label: "Ending", blockNumber: 24, sceneId: "", evidence: matrix.endingState || character.arc },
    ];
    const findings: CraftFinding[] = [];
    if (!text(matrix.startingState) && !text(character.description)) findings.push(arcFinding(character, "Opening state is not observable", "Without a starting strategy or belief, later change cannot be measured.", ["What behaviour proves the character's starting worldview?", "What do they do when pressure first appears?"]));
    if (!text(matrix.midpointShift) && !matrix.checkpoints.some((checkpoint) => checkpoint.kind === "midpoint")) findings.push(arcFinding(character, "No midpoint shift changes the character's strategy", "The plot may escalate while the character keeps solving problems in the same way.", ["What truth or failure makes the old strategy insufficient?", "How does the character act differently after the midpoint?"]));
    if (!text(matrix.crisisChoice) && !matrix.checkpoints.some((checkpoint) => checkpoint.kind === "crisis")) findings.push(arcFinding(character, "The crisis does not force a defining choice", "The low point needs behavioural evidence of the lie, truth or sacrifice under maximum pressure.", ["What does the character choose when both options cost them?", "Which choice reveals what they still believe?"]));
    if (!text(matrix.climaxChoice) && !matrix.checkpoints.some((checkpoint) => checkpoint.kind === "climax")) findings.push(arcFinding(character, "The climax lacks character-proof", "External resolution may occur without proving internal transformation through choice.", ["What can the ending character do that the opening character could not?", "How does the climax choice answer the protective lie?"]));
    if (!text(matrix.endingState) && !text(character.arc)) findings.push(arcFinding(character, "Ending state is not demonstrated", "The audience cannot compare the final behaviour with the starting condition.", ["What visible action proves the new equilibrium?", "Which relationship or value has changed?"], "watch"));
    return { characterId: character.id, characterName: character.name, checkpoints: points, findings };
  });
}

function arcFinding(character: Character, title: string, reason: string, questions: string[], severity: DiagnosticSeverity = "problem") {
  return finding({ scope: "arc", severity, title: `${character.name}: ${title}`, reason, evidence: evidence(character.want, character.need, character.ghost, character.arc), questions, characterId: character.id });
}

export function buildChronologyPresentationView(project: PlotPickleProject): { rows: TimelineRow[]; findings: CraftFinding[] } {
  const chronological = projectScenes(project);
  const firstPresentation = new Map<string, number>();
  project.screenplay.draftElements.forEach((element, index) => {
    if (element.sceneId && !firstPresentation.has(element.sceneId)) firstPresentation.set(element.sceneId, index + 1);
  });
  const orderedPresentation = [...firstPresentation.entries()].sort((left, right) => left[1] - right[1]);
  const presentationRank = new Map(orderedPresentation.map(([sceneId], index) => [sceneId, index + 1]));
  const rows = chronological.map(({ block, scene }, index) => {
    const presentationPosition = presentationRank.get(scene.id) ?? null;
    const temporalSignal = evidence(scene.title, scene.entryCondition, scene.purpose).find((value) => /flashback|flash forward|earlier|later|years? ago|memory|dream|present day/i.test(value)) ?? "";
    return { sceneId: scene.id, title: scene.title || `Scene ${index + 1}`, blockNumber: block.number, chronologyPosition: index + 1, presentationPosition, presentationDelta: presentationPosition === null ? null : presentationPosition - (index + 1), temporalSignal };
  });
  const findings: CraftFinding[] = [];
  const missing = rows.filter((row) => row.presentationPosition === null);
  if (missing.length) findings.push(finding({ scope: "timeline", severity: missing.length > Math.max(4, rows.length / 3) ? "problem" : "watch", title: `${missing.length} planned scene${missing.length === 1 ? " is" : "s are"} absent from screenplay presentation`, reason: "The structure plan and the reader's actual sequence are no longer fully aligned.", evidence: missing.slice(0, 8).map((row) => `Block ${row.blockNumber}: ${row.title}`), questions: ["Are these scenes intentionally unwritten, merged or removed?", "Should the structure plan or screenplay assignment be updated?" ] }));
  const displaced = rows.filter((row) => row.presentationDelta !== null && Math.abs(row.presentationDelta) > 2);
  if (displaced.length) findings.push(finding({ scope: "timeline", severity: displaced.some((row) => !row.temporalSignal) ? "watch" : "healthy", title: `${displaced.length} scene${displaced.length === 1 ? " appears" : "s appear"} outside chronology order`, reason: "Nonlinear presentation needs a readable temporal signal and a dramatic reason, not merely reordered information.", evidence: displaced.slice(0, 8).map((row) => `${row.title}: chronology ${row.chronologyPosition}, presentation ${row.presentationPosition}${row.temporalSignal ? ` — ${row.temporalSignal}` : ""}`), questions: ["What does the audience gain by learning this now?", "Is the temporal shift signalled clearly before it creates confusion?" ] }));
  return { rows, findings };
}

export function diagnoseCraftLayer(project: PlotPickleProject, focus?: { blockNumber?: number; sceneId?: string; characterId?: string }) {
  const opening = diagnoseOpeningMove(project);
  const launch = diagnoseActOneLaunch(project);
  const threads = buildStoryThreadOverlays(project);
  const ledger = buildSetupPayoffReflectionLedger(project);
  const arcs = buildCharacterArcCheckpointViews(project);
  const timeline = buildChronologyPresentationView(project);
  const selectedSceneId = focus?.sceneId ?? (focus?.blockNumber ? project.blocks[focus.blockNumber - 1]?.scenes[0]?.id : project.blocks[0]?.scenes[0]?.id);
  const pulse = selectedSceneId ? diagnoseScenePulse(project, selectedSceneId) : { scene: null, score: score(0, 7), findings: [] };
  const allFindings = [
    ...opening.findings,
    ...launch.findings,
    ...pulse.findings,
    ...threads.flatMap((thread) => thread.findings),
    ...ledger.findings,
    ...arcs.flatMap((arc) => arc.findings),
    ...timeline.findings,
  ];
  const relevant = allFindings.filter((item) => !focus?.blockNumber || item.blockNumber === undefined || item.blockNumber === focus.blockNumber)
    .filter((item) => !focus?.characterId || item.characterId === undefined || item.characterId === focus.characterId)
    .sort((left, right) => ({ problem: 0, watch: 1, healthy: 2 }[left.severity]) - ({ problem: 0, watch: 1, healthy: 2 }[right.severity]));
  const problemCount = allFindings.filter((item) => item.severity === "problem").length;
  const watchCount = allFindings.filter((item) => item.severity === "watch").length;
  return {
    opening,
    launch,
    pulse,
    threads,
    ledger,
    arcs,
    timeline,
    findings: relevant,
    summary: {
      problemCount,
      watchCount,
      severity: severityFor(problemCount),
      score: Math.round((opening.score.score + launch.score.score + pulse.score.score + Math.max(0, 100 - problemCount * 8 - watchCount * 3)) / 4),
    },
  };
}
