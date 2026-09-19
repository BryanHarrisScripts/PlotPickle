import { currentMarketingReference } from "../contracts/build-progress";
import type { CurriculumLesson } from "../contracts/curriculum";
import {
  buildFoundationPlanLessons,
  isUsableFoundationAnswer,
} from "../contracts/foundation-plan";
import { normalizeProjectSourceEvidence } from "../contracts/imported-screenplay-evidence";
import {
  buildWorldPlanLessons,
  isUsableWorldAnswer,
} from "../contracts/world-plan";
import type { LibraryPPFProject } from "../storage/library-project";

export type StoryBibleFactState = "established" | "reference" | "not-established";

export type StoryBibleFact = Readonly<{
  id: string;
  label: string;
  value: string;
  state: StoryBibleFactState;
  source: string;
}>;

export type StoryBibleFactGroup = Readonly<{
  id: string;
  title: string;
  facts: readonly StoryBibleFact[];
}>;

export type StoryBibleCharacter = Readonly<{
  id: string;
  name: string;
  imageUrl: string | null;
  facts: readonly StoryBibleFact[];
}>;

export type StoryBibleBlock = Readonly<{
  number: number;
  actNumber: number;
  sequenceNumber: number;
  title: string;
  summary: string;
  established: boolean;
}>;

export type StoryBibleProjection = Readonly<{
  projectId: string;
  title: string;
  revision: number;
  updatedAt: string;
  posterUrl: string | null;
  posterLabel: string;
  logline: StoryBibleFact;
  premise: StoryBibleFact;
  theme: StoryBibleFact;
  tone: StoryBibleFact;
  stakes: StoryBibleFact;
  foundationGroups: readonly StoryBibleFactGroup[];
  worldGroups: readonly StoryBibleFactGroup[];
  characters: readonly StoryBibleCharacter[];
  blocks: readonly StoryBibleBlock[];
  curriculumScope: readonly string[];
  sourceSummary: readonly StoryBibleFact[];
}>;

const NOT_ESTABLISHED = "Not established yet";

function clean(value: string | null | undefined) {
  return value?.replace(/\s+/g, " ").trim() ?? "";
}

function fallbackFact(id: string, label: string): StoryBibleFact {
  return { id, label, value: NOT_ESTABLISHED, state: "not-established", source: "No canonical project evidence yet" };
}

function curriculumGroups(
  curriculum: readonly CurriculumLesson[],
  project: LibraryPPFProject,
  kind: "foundations" | "world",
): readonly StoryBibleFactGroup[] {
  if (kind === "foundations") {
    return buildFoundationPlanLessons(curriculum).map((lesson) => {
      const saved = project.foundations.lessons[lesson.id]?.answers ?? {};
      return {
        id: `foundations:${lesson.id}`,
        title: lesson.title,
        facts: lesson.fields.map((field) => {
          const value = clean(saved[field.id]);
          return {
            id: `foundations:${lesson.id}:${field.id}`,
            label: field.prompt,
            value: isUsableFoundationAnswer(value) ? value : NOT_ESTABLISHED,
            state: isUsableFoundationAnswer(value) ? "established" as const : "not-established" as const,
            source: `PPF Foundations · ${lesson.title}`,
          };
        }),
      };
    });
  }

  return buildWorldPlanLessons(curriculum).map((lesson) => {
    const saved = project.world.lessons[lesson.id]?.answers ?? {};
    return {
      id: `world:${lesson.id}`,
      title: lesson.title,
      facts: lesson.fields.map((field) => {
        const value = clean(saved[field.id]);
        return {
          id: `world:${lesson.id}:${field.id}`,
          label: field.prompt,
          value: isUsableWorldAnswer(value) ? value : NOT_ESTABLISHED,
          state: isUsableWorldAnswer(value) ? "established" as const : "not-established" as const,
          source: `PPF World · ${lesson.title}`,
        };
      }),
    };
  });
}

function pickFact(
  groups: readonly StoryBibleFactGroup[],
  id: string,
  label: string,
  pattern: RegExp,
): StoryBibleFact {
  for (const group of groups) {
    for (const fact of group.facts) {
      const search = `${group.title} ${fact.label}`;
      if (fact.state === "established" && pattern.test(search)) return { ...fact, id, label };
      pattern.lastIndex = 0;
    }
  }
  return fallbackFact(id, label);
}

function displayCharacterName(characterId: string) {
  const raw = characterId.replace(/^character:/u, "").replace(/[-_]+/gu, " ").trim();
  return raw
    ? raw.replace(/\b\w/gu, (letter) => letter.toUpperCase())
    : "Unknown Character";
}

function characterProjection(project: LibraryPPFProject): readonly StoryBibleCharacter[] {
  const evidence = normalizeProjectSourceEvidence(project.sourceEvidence).characterTruth;
  if (!evidence) return [];

  const ids = evidence.principalCharacterIds.length
    ? evidence.principalCharacterIds
    : [...new Set(evidence.claims.flatMap((claim) => claim.characterIds))];

  return ids.map((characterId) => {
    const claims = evidence.claims.filter((claim) => (
      claim.characterIds.includes(characterId)
      && claim.reviewState !== "rejected"
      && claim.handling === "writer-reference"
      && claim.kind !== "sensitive-source"
    ));
    const identity = claims.find((claim) => claim.kind === "identity");
    const facts = claims
      .filter((claim) => claim.kind !== "identity" && claim.kind !== "visual-reference")
      .map((claim): StoryBibleFact => ({
        id: claim.id,
        label: claim.kind.replaceAll("-", " "),
        value: claim.summary,
        state: "reference",
        source: `Character Truth Evidence · ${claim.reviewState}`,
      }));

    return {
      id: characterId,
      name: identity?.summary || displayCharacterName(characterId),
      imageUrl: null,
      facts,
    };
  });
}

function structureProjection(project: LibraryPPFProject): readonly StoryBibleBlock[] {
  return project.structure.blocks.map((block) => {
    const defaultTitle = `Block ${String(block.number).padStart(2, "0")}`;
    const miniText = block.miniBlocks
      .map((mini) => clean(mini.stages.plan.content) || clean(mini.note))
      .filter(Boolean);
    const summary = clean(block.note) || miniText.join(" ");
    const title = clean(block.title) || defaultTitle;
    return {
      number: block.number,
      actNumber: block.actNumber,
      sequenceNumber: block.sequenceNumber,
      title,
      summary: summary || NOT_ESTABLISHED,
      established: title !== defaultTitle || Boolean(summary),
    };
  });
}

function storyBibleScope(curriculum: readonly CurriculumLesson[]) {
  const lesson = curriculum.find((entry) => entry.id === "story-bible");
  if (!lesson) return [];
  const purpose = lesson.sections.find((section) => section.heading.toLowerCase().includes("purpose"));
  return purpose?.points?.map(clean).filter(Boolean) ?? [];
}

export function projectStoryBible(
  project: LibraryPPFProject,
  curriculum: readonly CurriculumLesson[],
): StoryBibleProjection {
  const foundationGroups = curriculumGroups(curriculum, project, "foundations");
  const worldGroups = curriculumGroups(curriculum, project, "world");
  const allGroups = [...foundationGroups, ...worldGroups];
  const marketingReference = currentMarketingReference(project.build.foundations.visualArtifacts);
  const evidence = normalizeProjectSourceEvidence(project.sourceEvidence);

  const screenplay = evidence.screenplay;
  const sourceSummary: StoryBibleFact[] = [
    screenplay
      ? {
          id: "source-screenplay",
          label: "Screenplay source",
          value: screenplay.sourceFileName || screenplay.sourceFormat || "Imported screenplay evidence",
          state: "reference",
          source: "Imported Screenplay Evidence",
        }
      : fallbackFact("source-screenplay", "Screenplay source"),
    evidence.storyMatrix
      ? {
          id: "source-story-matrix",
          label: "Story evidence matrix",
          value: `${evidence.storyMatrix.blocks.length} structural block records available`,
          state: "reference",
          source: "Story Evidence Matrix",
        }
      : fallbackFact("source-story-matrix", "Story evidence matrix"),
    evidence.characterTruth
      ? {
          id: "source-character-truth",
          label: "Character evidence",
          value: `${evidence.characterTruth.principalCharacterIds.length} principal character records available`,
          state: "reference",
          source: "Character Truth Evidence",
        }
      : fallbackFact("source-character-truth", "Character evidence"),
  ];

  return {
    projectId: project.id,
    title: project.title || "Untitled Story",
    revision: project.revision,
    updatedAt: project.updatedAt,
    posterUrl: marketingReference?.assetUrl ?? null,
    posterLabel: marketingReference ? "Current Marketing Reference" : "No poster yet",
    logline: pickFact(foundationGroups, "spotlight-logline", "Logline", /\blogline\b/iu),
    premise: pickFact(foundationGroups, "spotlight-premise", "Premise / what the movie is about", /\bpremise\b|story promise|what.*(?:movie|story)|\bpitch\b/iu),
    theme: pickFact(allGroups, "spotlight-theme", "Theme", /\btheme\b|anti-theme|dramatic question/iu),
    tone: pickFact(allGroups, "spotlight-tone", "Tone / mood", /\btone\b|\bmood\b|audience promise/iu),
    stakes: pickFact(allGroups, "spotlight-stakes", "Stakes / central conflict", /\bstakes\b|main conflict|central conflict|opposition/iu),
    foundationGroups,
    worldGroups,
    characters: characterProjection(project),
    blocks: structureProjection(project),
    curriculumScope: storyBibleScope(curriculum),
    sourceSummary,
  };
}
