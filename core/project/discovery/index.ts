import type { LibraryPPFProject } from "../storage/library-project";
import type { DiscoveryCard } from "../contracts/discovery";

function defaultBlockTitle(number: number) {
  return `Block ${String(number).padStart(2, "0")}`;
}

function hasAuthoredBlockEvidence(block: LibraryPPFProject["structure"]["blocks"][number]) {
  if (block.title.trim() !== defaultBlockTitle(block.number)) return true;
  if (block.note.trim()) return true;
  return block.miniBlocks.some((mini) => (
    mini.note.trim()
    || mini.title.trim() !== `Mini-Block ${String(mini.number).padStart(2, "0")}`
    || Object.values(mini.stages).some((stage) => stage.content.trim())
  ));
}

export function projectDiscoveryPins(project: LibraryPPFProject): readonly DiscoveryCard[] {
  return project.structure.blocks
    .filter(hasAuthoredBlockEvidence)
    .map((block): DiscoveryCard => {
      const note = block.note.trim();
      return {
        id: `project:${project.id}:${block.id}`,
        kind: "text",
        content: note ? `${block.title}\n${note}` : block.title,
        assetRef: "",
        sourceState: "project",
        sourceRef: block.id,
        createdAt: project.updatedAt,
        placement: {
          act: block.actNumber,
          lane: "story-plot",
          reason: `Derived deterministically from canonical PPF Block ${String(block.number).padStart(2, "0")}.`,
          evidenceRefs: [block.id],
          classifierId: "deterministic-ppf-address",
          classifierVersion: "1",
          pinnedAt: project.updatedAt,
        },
      };
    });
}
