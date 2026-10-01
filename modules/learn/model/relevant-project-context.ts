import type { DiscoveryAct } from "../../../core/contracts/discovery";
import type { LibraryPPFProject } from "../../../core/storage/library-project";
import type { StoryDevelopmentFieldDefinition } from "./story-development-fields";

export type RelevantProjectContextItem = Readonly<{
  id: string;
  label: string;
  text: string;
  evidenceRefs: readonly string[];
  reason: string;
}>;

function clean(value: string, limit = 520) {
  return value.replace(/\s+/gu, " ").trim().slice(0, limit);
}

function exactReferenceFixtureContext(
  project: LibraryPPFProject,
  field: StoryDevelopmentFieldDefinition,
): readonly RelevantProjectContextItem[] {
  const evidence = project.sourceEvidence.referenceFixture?.fields.find((item) => (
    item.lessonId === field.lessonId && item.fieldId === field.fieldId
  ));
  if (!evidence?.sourceRefs.length) return [];
  return [{
    id: `fixture:${evidence.key}`,
    label: evidence.kind === "observed" ? "Observed field evidence" : "Reference reasoning",
    text: clean(evidence.reason, 900),
    evidenceRefs: evidence.sourceRefs.slice(0, 8),
    reason: `Exact reference-fixture provenance for ${field.canonicalId}.`,
  }];
}

function foundationsContext(project: LibraryPPFProject): readonly RelevantProjectContextItem[] {
  const text = clean(project.foundations.brief.content, 900);
  return text ? [{
    id: "foundations:brief",
    label: "Foundations Brief",
    text,
    evidenceRefs: ["foundations:brief"],
    reason: "Foundations fields may consult the saved canonical Foundations Brief.",
  }] : [];
}

function worldContext(project: LibraryPPFProject): readonly RelevantProjectContextItem[] {
  const text = clean(project.world.brief.content, 900);
  return text ? [{
    id: "world:brief",
    label: "World Brief",
    text,
    evidenceRefs: ["world:brief"],
    reason: "World fields may consult the saved canonical World Brief.",
  }] : [];
}

function characterContext(project: LibraryPPFProject): readonly RelevantProjectContextItem[] {
  const claims = project.sourceEvidence.characterTruth?.claims ?? [];
  return claims
    .filter((claim) => claim.reviewState !== "rejected" && claim.handling === "writer-reference" && claim.kind !== "sensitive-source")
    .slice(0, 3)
    .map((claim) => ({
      id: `character-truth:${claim.id}`,
      label: claim.characterIds.length ? `Character truth · ${claim.characterIds.join(", ")}` : "Character truth",
      text: clean(claim.summary, 620),
      evidenceRefs: [claim.sourceRef, `character-truth:${claim.id}`],
      reason: "Character fields may consult non-rejected writer-reference character truth.",
    }));
}

function structureContext(project: LibraryPPFProject, act: DiscoveryAct): readonly RelevantProjectContextItem[] {
  return project.structure.blocks
    .filter((block) => block.actNumber === act && (block.note.trim() || !/^Block \d{2}$/u.test(block.title.trim())))
    .slice(0, 3)
    .map((block) => ({
      id: `structure:${block.id}`,
      label: `Act ${act} · Block ${String(block.number).padStart(2, "0")}`,
      text: clean(block.note.trim() ? `${block.title} — ${block.note}` : block.title, 620),
      evidenceRefs: [block.id],
      reason: "Structure fields may consult authored Blocks in the selected Act.",
    }));
}

function draftingContext(project: LibraryPPFProject, act: DiscoveryAct): readonly RelevantProjectContextItem[] {
  const blockNumbers = new Set(project.structure.blocks.filter((block) => block.actNumber === act).map((block) => block.number));
  return project.writing.entries
    .filter((entry) => blockNumbers.has(entry.blockNumber))
    .slice(-3)
    .map((entry) => ({
      id: `drafting:${entry.id}`,
      label: `Written draft · Block ${String(entry.blockNumber).padStart(2, "0")} · Mini ${entry.miniBlockNumber}`,
      text: clean(entry.text, 620),
      evidenceRefs: [entry.id],
      reason: "Drafting fields may consult the Human's saved writing in the selected Act.",
    }));
}

function dialogueContext(project: LibraryPPFProject, act: DiscoveryAct): readonly RelevantProjectContextItem[] {
  const blockNumbers = new Set(project.structure.blocks.filter((block) => block.actNumber === act).map((block) => block.number));
  return (project.sourceEvidence.screenplay?.passages ?? [])
    .filter((passage) => blockNumbers.has(passage.blockNumber) && passage.type.toLowerCase().includes("dialog"))
    .slice(0, 3)
    .map((passage) => ({
      id: `dialogue:${passage.id}`,
      label: `Dialogue evidence · Block ${String(passage.blockNumber).padStart(2, "0")}`,
      text: clean(passage.text, 620),
      evidenceRefs: [passage.id],
      reason: "Dialogue fields may consult imported dialogue passages mapped to the selected Act.",
    }));
}

function previsContext(project: LibraryPPFProject): readonly RelevantProjectContextItem[] {
  return project.worldMap.characterVisuals
    .filter((item) => Boolean(item.lockedVersionId))
    .slice(0, 3)
    .map((item) => {
      const references = item.references.filter((reference) => reference.versionId === item.lockedVersionId && reference.reviewState === "approved");
      return {
        id: `previs:${item.characterId}:${item.lockedVersionId}`,
        label: `Approved character visual · ${item.characterName}`,
        text: `${references.length} approved reference view${references.length === 1 ? "" : "s"} in the locked World Map version.`,
        evidenceRefs: references.map((reference) => reference.id).slice(0, 8),
        reason: "PREVIS fields may consult only locked, approved World Map character references.",
      };
    })
    .filter((item) => item.evidenceRefs.length > 0);
}

export function relevantProjectContextForField(
  project: LibraryPPFProject,
  field: StoryDevelopmentFieldDefinition,
  act: DiscoveryAct,
): readonly RelevantProjectContextItem[] {
  const exact = exactReferenceFixtureContext(project, field);
  if (exact.length) return exact;

  switch (field.topicId) {
    case "foundations":
      return foundationsContext(project);
    case "world":
      return worldContext(project);
    case "character":
      return characterContext(project);
    case "structure":
      return structureContext(project, act);
    case "drafting":
      return draftingContext(project, act);
    case "dialogue":
      return dialogueContext(project, act);
    case "previs":
      return previsContext(project);
    case "theme":
    case "revision":
    case "responsible-ai":
    case "industry":
    case "collaboration":
      return [];
  }
}
