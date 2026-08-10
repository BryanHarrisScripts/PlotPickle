function object(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function meaningful(value) {
  if (typeof value === "string") return Boolean(value.trim());
  if (Array.isArray(value)) return value.length > 0;
  if (value && typeof value === "object") return Object.keys(value).length > 0;
  return value !== null && value !== undefined;
}

function identity(item) {
  if (!item || typeof item !== "object") return "";
  return String(item.id || item.name || item.title || item.number || "");
}

function mergeArray(generated, source, path) {
  if (!Array.isArray(source) || source.length === 0) return Array.isArray(generated) ? generated : [];
  if (!Array.isArray(generated) || generated.length === 0) return source;
  if (source.every((item) => item && typeof item === "object") && generated.every((item) => item && typeof item === "object")) {
    const result = generated.map((item) => structuredClone(item));
    source.forEach((item, index) => {
      const key = identity(item);
      const matchIndex = key ? result.findIndex((candidate) => identity(candidate) === key) : index < result.length ? index : -1;
      if (matchIndex >= 0) result[matchIndex] = mergeValue(result[matchIndex], item, `${path}[${matchIndex}]`);
      else result.push(structuredClone(item));
    });
    return result;
  }
  return structuredClone(source);
}

function mergeValue(generated, source, path = "") {
  if (Array.isArray(source)) return mergeArray(generated, source, path);
  if (source && typeof source === "object") {
    const result = { ...object(generated) };
    for (const [key, value] of Object.entries(source)) {
      result[key] = mergeValue(result[key], value, path ? `${path}.${key}` : key);
    }
    return result;
  }
  return meaningful(source) ? source : generated;
}

export function mergeLearnProjectWithFullStory(generatedInput = {}, sourceInput = {}, options = {}) {
  const generated = structuredClone(object(generatedInput));
  const source = object(sourceInput);
  const merged = mergeValue(generated, source);
  const now = typeof options.now === "string" && options.now ? options.now : new Date().toISOString();
  if (meaningful(source.id)) merged.id = source.id;
  merged.metadata = { ...object(generated.metadata), ...object(merged.metadata) };
  if (meaningful(source.metadata?.createdAt)) merged.metadata.createdAt = source.metadata.createdAt;
  merged.metadata.updatedAt = now;
  merged.extensions = { ...object(generated.extensions), ...object(merged.extensions) };
  merged.extensions.fullStoryBuilder = {
    ...object(generated.extensions?.fullStoryBuilder),
    ...object(merged.extensions?.fullStoryBuilder),
    continuedFromLearnProject: true,
    sourceProjectId: String(source.id || ""),
    sourceFileName: String(options.sourceFileName || ""),
    mergedAt: now,
  };
  return merged;
}

export function learnProjectBrief(projectInput = {}, fallback = {}) {
  const project = object(projectInput);
  const story = object(project.story);
  const world = object(project.world);
  const metadata = object(project.metadata);
  const rights = object(project.rights);
  const characters = Array.isArray(project.characters) ? project.characters : [];
  const protagonist = characters.find((character) => /protagonist/i.test(String(character?.role || ""))) || characters[0] || {};
  const locations = Array.isArray(world.locations) ? world.locations : [];
  const location = locations[0] || {};
  const pick = (value, backup) => meaningful(value) ? String(value) : String(backup || "");
  return {
    title: pick(metadata.title || project.title || story.title, fallback.title),
    premise: pick(story.premise || story.logline, fallback.premise),
    genre: pick(metadata.genre || story.genre, fallback.genre),
    tone: pick(story.tone || world.tone, fallback.tone),
    protagonist: pick(protagonist.name, fallback.protagonist),
    protagonistGoal: pick(protagonist.want || story.protagonistGoal, fallback.protagonistGoal),
    opposition: pick(story.opposition || story.antagonist, fallback.opposition),
    theme: pick(story.theme, fallback.theme),
    setting: pick(location.name || world.ordinaryWorld || world.newWorld, fallback.setting),
    visualLanguage: pick(world.visualLanguage, fallback.visualLanguage),
    audience: pick(metadata.audience || story.audience, fallback.audience),
    contentRating: pick(metadata.contentRating, fallback.contentRating),
    language: pick(metadata.language, fallback.language),
    projectOwner: pick(rights.projectOwner, fallback.projectOwner),
  };
}
