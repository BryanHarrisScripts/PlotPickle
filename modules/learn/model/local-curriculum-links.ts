import type { CurriculumLesson } from "../../../core/contracts/curriculum";

export type LocalCurriculumSourceTarget = {
  readonly lessonId: string;
  readonly lessonTitle: string;
  readonly sourceId: string;
  readonly sourceTitle: string;
  readonly topic: string;
};

const REPOSITORY_ALIASES: Readonly<Record<string, string>> = {
  "24-blocks-openstorytelling": "24-blocks",
  "24-blocks-openstorystudio": "24-blocks",
};

function decoded(value: string) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

/**
 * Converts a GitHub blob URL into a stable key used only to find the copy of
 * that source already bundled in PlotPickle. Branch names, URL fragments and
 * historical repository aliases are deliberately ignored.
 */
export function localCurriculumSourceKey(value: string) {
  try {
    const url = new URL(value);
    if (url.hostname.toLowerCase() !== "github.com") return "";
    const parts = url.pathname.split("/").filter(Boolean);
    if (parts.length < 5 || parts[2].toLowerCase() !== "blob") return "";
    const owner = parts[0].toLowerCase();
    const repositoryName = parts[1].toLowerCase();
    const repository = REPOSITORY_ALIASES[repositoryName] ?? repositoryName;
    const sourcePath = decoded(parts.slice(4).join("/")).replaceAll("\\", "/").toLowerCase();
    return `${owner}/${repository}/${sourcePath}`;
  } catch {
    return "";
  }
}

export function buildLocalCurriculumSourceIndex(curriculum: readonly CurriculumLesson[]) {
  const index = new Map<string, LocalCurriculumSourceTarget>();
  for (const lesson of curriculum) {
    for (const source of lesson.sources) {
      const key = localCurriculumSourceKey(source.url);
      if (!key || index.has(key)) continue;
      index.set(key, {
        lessonId: lesson.id,
        lessonTitle: lesson.title,
        sourceId: source.id,
        sourceTitle: source.title,
        topic: lesson.topic,
      });
    }
  }
  return index;
}
