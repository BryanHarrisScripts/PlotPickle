import type { Character, PlotPickleProject, StoryBlock } from "./project";

export const MODULE_FORMAT_VERSION = "2.2.0" as const;

export type ModuleManifestEntry = {
  id: string;
  type: string;
  path: string;
  schemaVersion: string;
  required: boolean;
  dependencies?: string[];
  collection?: { index: string; itemPattern: string };
};

export type ModuleDescriptor = {
  key: string;
  type: string;
  path: string;
  required: boolean;
  dependencies?: string[];
};

export const coreModuleRegistry: ModuleDescriptor[] = [
  { key: "identity", type: "plotpickle.identity", path: "project/identity.json", required: true },
  { key: "story", type: "plotpickle.story", path: "story/story.json", required: true, dependencies: ["identity"] },
  { key: "world", type: "plotpickle.world", path: "world/world.json", required: true, dependencies: ["story"] },
  { key: "characters", type: "plotpickle.characters", path: "characters/index.json", required: true, dependencies: ["story"] },
  { key: "voiceprints", type: "plotpickle.voiceprints", path: "voiceprints/index.json", required: false, dependencies: ["characters"] },
  { key: "screenplay", type: "plotpickle.screenplay", path: "screenplay/module.json", required: true, dependencies: ["characters", "world"] },
  { key: "structure", type: "plotpickle.structure", path: "24-blocks/index.json", required: true, dependencies: ["story", "characters"] },
  { key: "miniBlocks", type: "plotpickle.mini-blocks", path: "96-blocks/index.json", required: false, dependencies: ["structure"] },
  { key: "storyboard", type: "plotpickle.storyboard", path: "storyboard/index.json", required: false, dependencies: ["structure", "screenplay"] },
  { key: "production", type: "plotpickle.production", path: "production/module.json", required: false, dependencies: ["screenplay", "storyboard"] },
  { key: "research", type: "plotpickle.research", path: "research/index.json", required: false },
  { key: "canon", type: "plotpickle.canon", path: "canon/index.json", required: true, dependencies: ["story", "characters", "world"] },
  { key: "dependencies", type: "plotpickle.story-dependencies", path: "dependencies/graph.json", required: true, dependencies: ["story", "characters", "world", "screenplay", "structure", "storyboard", "production", "canon"] },
  { key: "review", type: "plotpickle.review", path: "review/module.json", required: false, dependencies: ["story"] },
  { key: "revisions", type: "plotpickle.revisions", path: "reports/revisions.json", required: false },
  { key: "collaboration", type: "plotpickle.collaboration", path: "collaboration/module.json", required: false },
  { key: "imports", type: "plotpickle.imports", path: "imports/index.json", required: false },
  { key: "plugins", type: "plotpickle.plugins", path: "plugins/registry.json", required: false },
  { key: "rights", type: "plotpickle.rights", path: "canon/rights.json", required: true },
];

export function safeModuleStem(value: string, fallback: string) {
  const stem = value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 80);
  return stem || fallback;
}

function uniqueStem(value: string, used: Set<string>, fallback: string) {
  const base = safeModuleStem(value, fallback);
  let stem = base;
  let count = 2;
  while (used.has(stem)) {
    stem = `${base}-${count}`;
    count += 1;
  }
  used.add(stem);
  return stem;
}

export function characterModuleFiles(characters: Character[]) {
  const used = new Set<string>();
  const items = characters.map((character) => {
    const stem = uniqueStem(character.name, used, "character");
    return { id: character.id, name: character.name, path: `characters/${stem}.json`, value: character };
  });
  return {
    index: { schemaVersion: MODULE_FORMAT_VERSION, items: items.map(({ id, name, path }) => ({ id, name, path })) },
    files: Object.fromEntries(items.map(({ path, value }) => [path, value])),
  };
}

export function voiceprintModuleFiles(characters: Character[]) {
  const used = new Set<string>();
  const items = characters.map((character) => {
    const stem = uniqueStem(character.name, used, "character");
    const voiceprint = {
      characterId: character.id,
      characterName: character.name,
      voice: character.voice,
      originEnvironment: character.originEnvironment ?? "",
      socialContext: character.socialContext ?? "",
      educationExpertise: character.educationExpertise ?? "",
      worldviewBoundaries: character.worldviewBoundaries ?? "",
      rhythmSentenceShape: character.rhythmSentenceShape ?? "",
      vocabularyMetaphors: character.vocabularyMetaphors ?? "",
      verbalFingerprints: character.verbalFingerprints ?? "",
      emotionalAccess: character.emotionalAccess ?? "",
      statusShift: character.statusShift ?? "",
      persuasionStrategy: character.persuasionStrategy ?? "",
    };
    return { id: character.id, path: `voiceprints/${stem}.voice.json`, value: voiceprint };
  });
  return {
    index: { schemaVersion: MODULE_FORMAT_VERSION, items: items.map(({ id, path }) => ({ characterId: id, path })) },
    files: Object.fromEntries(items.map(({ path, value }) => [path, value])),
  };
}

export function blockModuleFiles(blocks: StoryBlock[]) {
  const items = blocks.map((block) => ({ id: block.id, number: block.number, path: `24-blocks/block-${String(block.number).padStart(2, "0")}.json`, value: block }));
  return {
    index: { schemaVersion: MODULE_FORMAT_VERSION, count: items.length, items: items.map(({ id, number, path }) => ({ id, number, path })) },
    files: Object.fromEntries(items.map(({ path, value }) => [path, value])),
  };
}

export function moduleManifestEntries(): Record<string, ModuleManifestEntry> {
  return Object.fromEntries(coreModuleRegistry.map((module) => [module.key, {
    id: `module-${module.key}`,
    type: module.type,
    path: module.path,
    schemaVersion: MODULE_FORMAT_VERSION,
    required: module.required,
    ...(module.dependencies ? { dependencies: module.dependencies } : {}),
    ...(module.key === "characters" ? { collection: { index: module.path, itemPattern: "characters/*.json" } } : {}),
    ...(module.key === "voiceprints" ? { collection: { index: module.path, itemPattern: "voiceprints/*.voice.json" } } : {}),
    ...(module.key === "structure" ? { collection: { index: module.path, itemPattern: "24-blocks/block-*.json" } } : {}),
    ...(module.key === "miniBlocks" ? { collection: { index: module.path, itemPattern: "96-blocks/block-*.json" } } : {}),
  }]));
}

export function fountainText(project: PlotPickleProject) {
  if (project.screenplay.sourceText.trim()) return project.screenplay.sourceText;
  return project.screenplay.draftElements.map((element) => element.text).filter(Boolean).join("\n\n");
}
