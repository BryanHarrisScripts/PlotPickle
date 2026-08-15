export type WyrmwoodCampaignId = "fundamentals";

export type WyrmwoodRoundStatus = "ready" | "active" | "resolved";

export interface WyrmwoodTrial {
  readonly id: string;
  readonly campaignId: WyrmwoodCampaignId;
  readonly curriculumTopic: "foundations";
  readonly lessonId: string;
  readonly lessonNumber: number;
  readonly lessonTitle: string;
  readonly learningTargets: readonly string[];
  readonly lessonReminder: string;
  readonly pickleSeed: string;
}

export interface WyrmwoodGameState {
  readonly schemaVersion: 1;
  readonly campaignId: WyrmwoodCampaignId;
  readonly trialIndex: number;
  readonly roundStatus: WyrmwoodRoundStatus;
  readonly spotlight: number;
  readonly brineCoins: number;
  readonly xp: number;
  readonly completedTrialIds: readonly string[];
}

export interface WyrmwoodEvaluationDimensions {
  readonly storyLogic: number;
  readonly lessonApplication: number;
  readonly establishedElements: number;
  readonly consequences: number;
  readonly rivalCounter: number;
  readonly clarity: number;
}

export interface WyrmwoodResolvedRound {
  readonly trialId: string;
  readonly score: number;
  readonly spotlightDelta: number;
  readonly brineCoinsEarned: number;
  readonly xpGained: number;
  readonly dimensions: WyrmwoodEvaluationDimensions;
  readonly teachingDebrief: string;
}
