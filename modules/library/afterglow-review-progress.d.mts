export type AfterglowReviewProgressItem = Readonly<{
  key:string;id:string;label:string;path?:string;reviewed:boolean;
  status:"current"|"confirmed";
}>;
export type AfterglowReviewProgress = Readonly<{
  sections:readonly Readonly<{id:string;label:string;completed:number;total:number;items:readonly AfterglowReviewProgressItem[]}>[];
  total:number;completed:number;pending:number;allCreativeDecided:boolean;
  needsIndependentReview:readonly Readonly<{groupId:string;id:string;reason:string}>[];
}>;
export function afterglowReviewProgress(input:Readonly<{
  groups:readonly Readonly<{id:string;label:string;items:readonly Readonly<{
    id:string;label:string;reviewPath?:string|null;
  }>[]}>[];
  candidatePaths:readonly string[];
  conflictPaths:readonly string[];
  confirmations:Readonly<Record<string,boolean>>;
  exclusions:readonly string[];
  decisions:Readonly<Record<string,number|"baseline">>;
  extraConflicts:readonly Readonly<{path:string;label?:string}>[];
  imageOptions:readonly Readonly<{key:string;id:string;characterName:string;view:string}>[];
  imageChoices:Readonly<Record<string,"keep"|"exclude">>;
}>):AfterglowReviewProgress;
