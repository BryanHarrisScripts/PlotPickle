import type { PlotPickleProject } from "./project";
import {
  buildStoryKnowledgeGraph,
  type StoryKnowledgeExtractedEntity,
  type StoryKnowledgeExtractedRelation,
  type StoryKnowledgeProvenance,
} from "./story-knowledge-graph";

export const PPF_STORY_KNOWLEDGE_EXTRACTOR = {
  id: "plotpickle-ppf-native",
  version: "1",
  route: "deterministic" as const,
};

export function storyKnowledgeRevisionForProject(project: PlotPickleProject) {
  return `${project.schemaVersion}:${project.metadata.updatedAt}`;
}

function provenance(project: PlotPickleProject, evidenceId: string, evidenceLocation: string): StoryKnowledgeProvenance {
  return {
    sourceId: `ppf:${project.id}`,
    revision: storyKnowledgeRevisionForProject(project),
    evidenceId,
    evidenceLocation,
    extractor: PPF_STORY_KNOWLEDGE_EXTRACTOR,
  };
}

export function extractCanonicalPpfStoryKnowledge(project: PlotPickleProject) {
  const entities: StoryKnowledgeExtractedEntity[] = [];
  const relations: StoryKnowledgeExtractedRelation[] = [];
  const characterNameById = new Map(project.characters.map((character) => [character.id, character.name]));
  const locationNameById = new Map(project.world.locations.map((location) => [location.id, location.name]));

  for (const character of project.characters) {
    entities.push({
      name: character.name,
      type: "CHARACTER",
      description: character.description || character.role,
      provenance: provenance(project, `character:${character.id}`, `characters/${character.id}`),
    });
    for (const relationship of character.relationships) {
      const targetName = characterNameById.get(relationship.characterId);
      if (!targetName) continue;
      relations.push({
        source: character.name,
        sourceType: "CHARACTER",
        predicate: relationship.label || "related to",
        target: targetName,
        targetType: "CHARACTER",
        provenance: provenance(
          project,
          `character:${character.id}:relationship:${relationship.characterId}`,
          `characters/${character.id}/relationships/${relationship.characterId}`,
        ),
      });
    }
  }

  for (const location of project.world.locations) {
    entities.push({
      name: location.name,
      type: "LOCATION",
      description: location.description,
      provenance: provenance(project, `location:${location.id}`, `world/locations/${location.id}`),
    });
  }

  for (const block of project.blocks) {
    const blockName = `Block ${block.number}: ${block.title || "Untitled"}`;
    entities.push({
      name: blockName,
      type: "EVENT",
      description: block.summary || block.purpose,
      provenance: provenance(project, `block:${block.id}`, `blocks/${block.id}`),
    });
    for (const characterId of block.characterIds) {
      const characterName = characterNameById.get(characterId);
      if (!characterName) continue;
      relations.push({
        source: characterName,
        sourceType: "CHARACTER",
        predicate: "appears in",
        target: blockName,
        targetType: "EVENT",
        provenance: provenance(project, `block:${block.id}:character:${characterId}`, `blocks/${block.id}/characterIds`),
      });
    }
    for (const locationId of block.locationIds) {
      const locationName = locationNameById.get(locationId);
      if (!locationName) continue;
      relations.push({
        source: blockName,
        sourceType: "EVENT",
        predicate: "occurs at",
        target: locationName,
        targetType: "LOCATION",
        provenance: provenance(project, `block:${block.id}:location:${locationId}`, `blocks/${block.id}/locationIds`),
      });
    }
  }

  return {
    sourceId: `ppf:${project.id}`,
    revision: storyKnowledgeRevisionForProject(project),
    entities,
    relations,
  } as const;
}

export function buildCanonicalPpfStoryKnowledgeGraph(project: PlotPickleProject) {
  const revision = storyKnowledgeRevisionForProject(project);
  return buildStoryKnowledgeGraph({
    projectId: project.id,
    sourceRevision: revision,
    extractorVersion: `${PPF_STORY_KNOWLEDGE_EXTRACTOR.id}@${PPF_STORY_KNOWLEDGE_EXTRACTOR.version}`,
    generatedAt: project.metadata.updatedAt,
    batches: [extractCanonicalPpfStoryKnowledge(project)],
  });
}
