export type NewStoryFormat = "Short Film" | "Feature";
export type NewStoryIntent = Readonly<{
  title: string;
  format: NewStoryFormat;
  targetMinutes: number;
}>;
export const NEW_STORY_FORMATS: readonly NewStoryFormat[];
export function validateNewStoryIntent(input: {
  readonly title?: unknown;
  readonly format?: unknown;
  readonly targetMinutes?: unknown;
}): NewStoryIntent;
