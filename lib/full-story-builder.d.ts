export type FullStoryBrief = {
  readonly title: string;
  readonly premise: string;
  readonly genre: string;
  readonly tone: string;
  readonly protagonist: string;
  readonly protagonistGoal: string;
  readonly opposition: string;
  readonly theme: string;
  readonly setting: string;
  readonly visualLanguage: string;
  readonly audience: string;
  readonly contentRating: string;
  readonly language: string;
  readonly projectOwner: string;
  readonly originalitySeed: string;
};

export function normalizeFullStoryBrief(value?: Record<string, unknown>): FullStoryBrief;
