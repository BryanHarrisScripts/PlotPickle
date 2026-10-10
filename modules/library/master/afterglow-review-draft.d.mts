export type AfterglowReviewSelections = Readonly<{
  decisions: Readonly<Record<string,number|"baseline">>;
  exclusions: readonly string[];
  imageChoices: Readonly<Record<string,"keep"|"exclude">>;
  confirmedCurrent: Readonly<Record<string,true>>;
}>;
export type AfterglowReviewDraft = Readonly<{
  version:1;
  sourceFingerprint:string;
  selections:AfterglowReviewSelections;
  savedAt:string;
}>;
export function normalizeAfterglowReviewDraft(input:unknown,now?:string):AfterglowReviewDraft;
