import { blockWritingEntry } from "../../core/contracts/block-writing";
import { normalizeProjectSourceEvidence } from "../../core/contracts/imported-screenplay-evidence";
import type { ImportedScreenplayPassage } from "../../core/contracts/imported-screenplay-evidence";
import type { OutlineAgentAssessment } from "../../core/contracts/imported-screenplay-evidence/outline-agent-assessment";
import type { LibraryPPFProject } from "../../core/storage/library-project";

const STRUCTURAL = new Set(["covered", "condensed-shared", "gap-underdeveloped", "unresolved"]);
const ARC = new Set(["not-present-no-evidence", "present-arc-neutral", "pressure-introduced", "belief-strategy-reinforced", "belief-strategy-challenged", "meaningful-choice", "consequence", "relationship-movement", "arc-transition", "unresolved-insufficient-evidence"]);
const MINI = new Set(["supported", "partial", "unsupported"]);

/** Fingerprint source and saved planning text so a later edit cannot inherit an old agent claim. */
export function outlineAssessmentFingerprint(project: LibraryPPFProject, blockNumber: number) {
  const block = project.structure.blocks.find((item) => item.number === blockNumber);
  const evidence = normalizeProjectSourceEvidence(project.sourceEvidence);
  const source = JSON.stringify({
    block: block && { title: block.title, note: block.note, mini: block.miniBlocks.map((mini) => ({ title: mini.title, note: mini.note, writing: blockWritingEntry(project.writing, { blockNumber, miniBlockNumber: mini.ordinal })?.text ?? "" })) },
    responsibility: evidence.storyMatrix?.blocks.find((item) => item.blockNumber === blockNumber)?.responsibility ?? "",
    placement: evidence.screenplay?.analysisStatus,
    projectionReviews: evidence.screenplay?.projectionReviews?.filter((item) => item.blockNumber === blockNumber) ?? [],
    characters: evidence.characterTruth?.arcCells.filter((item) => item.blockNumber === blockNumber).map((item) => [item.characterId, item.passageIds]) ?? [],
    passages: evidence.screenplay?.passages.filter((item) => item.blockNumber === blockNumber).map((item) => [item.id, item.text, item.miniBlockNumber]) ?? [],
  });
  let hash = 2166136261;
  for (let i = 0; i < source.length; i += 1) hash = Math.imul(hash ^ source.charCodeAt(i), 16777619);
  return (hash >>> 0).toString(16).padStart(8, "0");
}

export function currentOutlineAssessment(project: LibraryPPFProject, blockNumber: number) {
  return project.sourceEvidence.outlineAssessments?.find((item) => item.blockNumber === blockNumber && item.inputFingerprint === outlineAssessmentFingerprint(project, blockNumber)) ?? null;
}

function samplePassages(passages: readonly ImportedScreenplayPassage[]) {
  // Spread the bounded sample across all four Mini-Blocks, preserving real source IDs.
  return [1, 2, 3, 4].flatMap((ordinal) => {
    const mini = passages.filter((item) => item.miniBlockNumber === ordinal);
    return mini.length <= 6 ? mini : [...mini.slice(0, 3), ...mini.slice(-3)];
  });
}

function parseAgentJson(text: string): Record<string, unknown> {
  const trimmed = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  const candidate = JSON.parse(trimmed) as unknown;
  if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) throw new Error("Story Architect returned an invalid assessment. No finding was saved.");
  return candidate as Record<string, unknown>;
}

function reason(value: unknown, label: string) {
  if (typeof value !== "string" || value.trim().length < 18 || value.length > 900) throw new Error(`${label} needs a concrete evidence-based reason. No finding was saved.`);
  return value.trim();
}

function citations(value: unknown, allowed: ReadonlySet<string>, label: string) {
  if (!Array.isArray(value) || value.some((id) => typeof id !== "string" || !allowed.has(id))) throw new Error(`${label} cited a passage outside this Block. No finding was saved.`);
  return [...new Set(value as string[])];
}

export function validateOutlineAgentAssessment(
  output: string,
  project: LibraryPPFProject,
  blockNumber: number,
  model: string,
  assessedAt: string,
): OutlineAgentAssessment {
  const data = parseAgentJson(output);
  const evidence = normalizeProjectSourceEvidence(project.sourceEvidence);
  const passages = evidence.screenplay?.passages.filter((p) => p.blockNumber === blockNumber) ?? [];
  const sampled = samplePassages(passages);
  const allowed = new Set(sampled.map((p) => p.id));
  const structural = data.structural as Record<string, unknown> | undefined;
  if (!structural || !STRUCTURAL.has(String(structural.state))) throw new Error("Story Architect returned an unknown structural state. No finding was saved.");
  const structuralIds = citations(structural.passageIds, allowed, "Structure");
  if ((structural.state === "covered" || structural.state === "condensed-shared" || (structural.state === "gap-underdeveloped" && passages.length > 0)) && !structuralIds.length) throw new Error("A structural conclusion about supplied screenplay passages requires a citation. No finding was saved.");
  const cells = evidence.characterTruth?.arcCells.filter((cell) => cell.blockNumber === blockNumber) ?? [];
  if (!Array.isArray(data.characters) || !Array.isArray(data.miniBlocks) || data.miniBlocks.length !== 4) throw new Error("Story Architect omitted character or Mini-Block findings. No finding was saved.");
  const characters = data.characters.map((value) => {
    const item = value as Record<string, unknown>;
    const cell = cells.find((candidate) => candidate.characterId === item.characterId);
    if (!cell || !ARC.has(String(item.state))) throw new Error("Story Architect named an unknown character or arc state. No finding was saved.");
    const ids = citations(item.passageIds, new Set(cell.passageIds.filter((id) => allowed.has(id))), "Character arc");
    if (item.state !== "not-present-no-evidence" && item.state !== "unresolved-insufficient-evidence" && !ids.length) throw new Error("A character arc finding requires a cited character passage. No finding was saved.");
    return { characterId: cell.characterId, state: item.state as typeof cell.state, reason: reason(item.reason, "Character arc"), passageIds: ids };
  });
  if (new Set(characters.map((item) => item.characterId)).size !== characters.length || characters.length !== cells.length) throw new Error("Story Architect did not assess each character exactly once. No finding was saved.");
  const block = project.structure.blocks.find((item) => item.number === blockNumber);
  const miniBlocks = data.miniBlocks.map((value) => {
    const item = value as Record<string, unknown>;
    const ordinal = Number(item.ordinal);
    if (!Number.isInteger(ordinal) || ordinal < 1 || ordinal > 4 || !MINI.has(String(item.state))) throw new Error("Story Architect returned an unknown Mini-Block state. No finding was saved.");
    const miniAllowed = new Set(sampled.filter((p) => p.miniBlockNumber === ordinal).map((p) => p.id));
    const ids = citations(item.passageIds, miniAllowed, "Mini-Block");
    const saved = blockWritingEntry(project.writing, { blockNumber, miniBlockNumber: ordinal });
    if ((item.state === "supported" || item.state === "partial") && !ids.length && !saved?.text.trim()) throw new Error("A supported or partial Mini-Block needs cited or saved script. No finding was saved.");
    return { ordinal, state: item.state as "supported" | "partial" | "unsupported", reason: reason(item.reason, "Mini-Block"), passageIds: ids, storyboardCue: typeof item.storyboardCue === "string" ? item.storyboardCue.trim().slice(0, 360) : "" };
  });
  if (!block || new Set(miniBlocks.map((item) => item.ordinal)).size !== 4) throw new Error("Story Architect did not assess all four Mini-Blocks. No finding was saved.");
  return { version: 1, blockNumber, inputFingerprint: outlineAssessmentFingerprint(project, blockNumber), assessedAt, model: model.slice(0, 120), structural: { state: structural.state as OutlineAgentAssessment["structural"]["state"], reason: reason(structural.reason, "Structure"), passageIds: structuralIds }, characters, miniBlocks: miniBlocks.sort((left, right) => left.ordinal - right.ordinal) };
}

function storyArchitectExecutionLabel(result: {
  provider?: string;
  runtimeProvider?: string;
  model?: string;
  modelRole?: string;
  computeSource?: string;
}) {
  const runtime = result.runtimeProvider && result.runtimeProvider !== result.provider
    ? `runtime=${result.runtimeProvider}`
    : "";
  return [
    result.provider ? `provider=${result.provider}` : "",
    runtime,
    result.model ? `model=${result.model}` : "",
    result.modelRole ? `role=${result.modelRole}` : "",
    result.computeSource ? `compute=${result.computeSource}` : "",
  ].filter(Boolean).join(" · ").slice(0, 120) || "configured Story Architect";
}

export async function requestOutlineAgentAssessment(project: LibraryPPFProject, blockNumber: number): Promise<OutlineAgentAssessment> {
  const block = project.structure.blocks.find((item) => item.number === blockNumber);
  if (!block) throw new Error("Choose a valid Story Block.");
  const evidence = normalizeProjectSourceEvidence(project.sourceEvidence);
  const passages = evidence.screenplay?.passages.filter((item) => item.blockNumber === blockNumber) ?? [];
  const sample = samplePassages(passages);
  const responsibility = evidence.storyMatrix?.blocks.find((item) => item.blockNumber === blockNumber)?.responsibility ?? "";
  const characters = evidence.characterTruth?.arcCells.filter((item) => item.blockNumber === blockNumber).map((item) => ({ id: item.characterId, passageIds: item.passageIds.filter((id) => sample.some((p) => p.id === id)) })) ?? [];
  const message = [
    "Assess this ONE Outline Block from the supplied screenplay and saved PPF planning. Return JSON only: {\"structural\":{\"state\":\"covered|condensed-shared|gap-underdeveloped|unresolved\",\"reason\":\"...\",\"passageIds\":[\"...\"]},\"characters\":[{\"characterId\":\"...\",\"state\":\"not-present-no-evidence|present-arc-neutral|pressure-introduced|belief-strategy-reinforced|belief-strategy-challenged|meaningful-choice|consequence|relationship-movement|arc-transition|unresolved-insufficient-evidence\",\"reason\":\"...\",\"passageIds\":[\"...\"]}],\"miniBlocks\":[{\"ordinal\":1,\"state\":\"supported|partial|unsupported\",\"reason\":\"...\",\"passageIds\":[\"...\"],\"storyboardCue\":\"...\"}]}. Include each listed character and all four Mini-Blocks exactly once.",
    "Use only supplied passage IDs. Explain specific causal stakes, change, dramatic pressure, or why the evidence is inconclusive. Do not infer structural coverage from density, page position, a character name mention or generic curriculum guidance. If the limited sample cannot support a conclusion, select unresolved. A storyboardCue is a visual question grounded in the text, not a generated scene or accepted visual. Profile material is not audience-visible evidence. These are proposals, not changes to canon.",
    JSON.stringify({ title: project.title, blockNumber, responsibility, blockTitle: block.title, blockNote: block.note, sourcePlacement: evidence.screenplay?.analysisStatus, sampleIncomplete: sample.length < passages.length || Boolean(evidence.screenplay?.passagesTruncated), miniBlocks: block.miniBlocks.map((mini) => ({ ordinal: mini.ordinal, title: mini.title, note: mini.note, savedWriting: blockWritingEntry(project.writing, { blockNumber, miniBlockNumber: mini.ordinal })?.text.slice(0, 900) ?? "" })), characters, passages: sample.map((p) => ({ id: p.id, mini: p.miniBlockNumber, type: p.type, scene: p.sceneNumber, text: p.text.slice(0, 320) })) }),
  ].join("\n\n");
  const response = await fetch("/api/writing-assistant/chat", { method: "POST", headers: { "Content-Type": "application/json", "X-PlotPickle-Model-Role": "quality" }, body: JSON.stringify({ agentId: "story-architect", modelRole: "quality", tone: "direct", message }), signal: AbortSignal.timeout(60_000) });
  const result = await response.json() as {
    text?: string;
    provider?: string;
    runtimeProvider?: string;
    model?: string;
    modelRole?: string;
    computeSource?: string;
    message?: string;
  };
  if (!response.ok || !result.text) throw new Error(result.message || "Story Architect could not assess this Block. No finding was saved.");
  return validateOutlineAgentAssessment(
    result.text,
    project,
    blockNumber,
    storyArchitectExecutionLabel(result),
    new Date().toISOString(),
  );
}
