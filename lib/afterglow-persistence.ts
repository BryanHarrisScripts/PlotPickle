export const AFTERGLOW_PROJECT_ID = "afterglow-echoes-of-sentience" as const;
export const AFTERGLOW_PROJECT_TITLE = "Afterglow: Reflections of Sentience" as const;
export const AFTERGLOW_PROJECT_FILE = "afterglow-echoes-of-sentience.ppf" as const;
export const AFTERGLOW_REPOSITORY_OWNER = "BryanHarrisScripts" as const;
export const AFTERGLOW_REPOSITORY_NAME = "Afterglow-Echoes-of-Sentience" as const;
export const AFTERGLOW_REPOSITORY_FULL_NAME = `${AFTERGLOW_REPOSITORY_OWNER}/${AFTERGLOW_REPOSITORY_NAME}` as const;
export const AFTERGLOW_REPOSITORY_URL = `https://github.com/${AFTERGLOW_REPOSITORY_FULL_NAME}` as const;
export const AFTERGLOW_REPOSITORY_PROJECT_PATH = "stories/afterglow.ppf" as const;

function text(value: unknown, maximum = 500) {
  return typeof value === "string" ? value.trim().slice(0, maximum) : "";
}

export function isAfterglowProjectId(value: unknown): value is typeof AFTERGLOW_PROJECT_ID {
  return value === AFTERGLOW_PROJECT_ID;
}

export function isExpectedAfterglowRepository(owner: unknown, repo: unknown) {
  return text(owner).toLowerCase() === AFTERGLOW_REPOSITORY_OWNER.toLowerCase()
    && text(repo).toLowerCase() === AFTERGLOW_REPOSITORY_NAME.toLowerCase();
}
