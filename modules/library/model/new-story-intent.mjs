/**
 * #2961 — user-selected metadata for a NEW Library PPF project only.
 * This is an intention/target, NOT computed 24x4 structure or footage truth.
 */
export const NEW_STORY_FORMATS = Object.freeze(["Short Film", "Feature"]);
export function validateNewStoryIntent(input) {
  const title = typeof input?.title === "string" ? input.title.trim() : "";
  const format = input?.format;
  const duration = typeof input?.targetMinutes === "number"
    ? input.targetMinutes
    : typeof input?.targetMinutes === "string" && input.targetMinutes.trim()
      ? Number(input.targetMinutes)
      : NaN;
  if (!title) throw new Error("Enter a story title before creating a new Library project.");
  if (title.length > 160) throw new Error("Story titles must be 160 characters or fewer.");
  if (!NEW_STORY_FORMATS.includes(format)) {
    throw new Error("Choose a film format: Short Film or Feature before creating a new Library project.");
  }
  if (!Number.isInteger(duration) || duration < 1 || duration > 240) {
    throw new Error("Enter a target runtime between 1 and 240 whole minutes.");
  }
  return Object.freeze({ title, format, targetMinutes: duration });
}
