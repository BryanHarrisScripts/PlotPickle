export type WyrmwoodCampaignId = "fundamentals";

export type WyrmwoodRoundStatus = "ready" | "generating" | "active" | "evaluating" | "resolved";

export type WyrmwoodRank =
  | "Fresh Novice"
  | "Junior Spellscribe"
  | "Master Untangler"
  | "Spicy Arch-Mage"
  | "Grand Fermenter";

export type WyrmwoodRivalId =
  | "aiden-glowhart"
  | "damien-darkmore"
  | "barnaby-barnacle"
  | "master-spirit-talker"
  | "sienna-silvertongue";

export interface WyrmwoodTrial {
  readonly id: string;
  readonly campaignId: WyrmwoodCampaignId;
  readonly curriculumTopic: "foundations";
  readonly lessonId: string;
  readonly lessonNumber: number;
  readonly lessonTitle: string;
  readonly learningTargets: readonly string[];
  readonly keyConcepts: readonly string[];
  readonly lessonReminder: string;
  readonly pickleSeed: string;
}

export interface WyrmwoodCurriculumProgress {
  readonly stage: "Foundations";
  readonly activeLessonId: string;
  readonly completedLessonIds: readonly string[];
  readonly completedInStage: number;
  readonly totalInStage: number;
}

export interface WyrmwoodGeneratedPickle {
  readonly id: string;
  readonly title: string;
  readonly situation: string;
  readonly goal: string;
  readonly constraints: readonly string[];
  readonly establishedElements: readonly string[];
  readonly failurePressure: string;
}

export interface WyrmwoodRivalMove {
  readonly action: string;
  readonly complication: string;
}

export type WyrmwoodRivalMoves = Readonly<Record<WyrmwoodRivalId, WyrmwoodRivalMove>>;

export interface WyrmwoodDirectorTurn {
  readonly trialId: string;
  readonly pickleNumber: number;
  readonly oakenOpening: string;
  readonly pickle: WyrmwoodGeneratedPickle;
  readonly rivals: WyrmwoodRivalMoves;
  readonly model: string;
  readonly generatedAt: string;
}

export interface WyrmwoodPlayerTurn {
  readonly trialId: string;
  readonly pickleId: string;
  readonly pickleNumber: number;
  readonly response: string;
  readonly submittedAt: string;
}

export interface WyrmwoodEvaluationDimensions {
  readonly storyLogic: number;
  readonly lessonApplication: number;
  readonly establishedElements: number;
  readonly consequences: number;
  readonly rivalCounter: number;
  readonly clarity: number;
}

export interface WyrmwoodCurriculumEvaluation {
  readonly dimensions: WyrmwoodEvaluationDimensions;
  readonly whatWorked: readonly string[];
  readonly whatNeedsWork: readonly string[];
  readonly conceptUsed: string;
  readonly teachingDebrief: string;
  readonly model: string;
  readonly evaluatedAt: string;
}

export interface WyrmwoodResolvedRound {
  readonly trialId: string;
  readonly pickleId: string;
  readonly pickleNumber: number;
  readonly score: number;
  readonly spotlightDelta: number;
  readonly brineCoinsEarned: number;
  readonly xpGained: number;
  readonly tropeCounterBonus: boolean;
  readonly dimensions: WyrmwoodEvaluationDimensions;
  readonly whatWorked: readonly string[];
  readonly whatNeedsWork: readonly string[];
  readonly conceptUsed: string;
  readonly teachingDebrief: string;
  readonly rankBefore: WyrmwoodRank;
  readonly rankAfter: WyrmwoodRank;
  readonly levelBefore: number;
  readonly levelAfter: number;
  readonly evaluatedAt: string;
}

export interface WyrmwoodCompletedTurn {
  readonly director: WyrmwoodDirectorTurn;
  readonly player: WyrmwoodPlayerTurn;
  readonly resolution?: WyrmwoodResolvedRound;
}

export interface WyrmwoodGameState {
  readonly schemaVersion: 3;
  readonly campaignId: WyrmwoodCampaignId;
  readonly trialIndex: number;
  readonly pickleIndex: number;
  readonly roundStatus: WyrmwoodRoundStatus;
  readonly spotlight: number;
  readonly brineCoins: number;
  readonly lifetimeBrineCoinsEarned: number;
  readonly xp: number;
  readonly level: number;
  readonly rank: WyrmwoodRank;
  readonly completedTrialIds: readonly string[];
  readonly currentDirectorTurn: WyrmwoodDirectorTurn | null;
  readonly lastResolution: WyrmwoodResolvedRound | null;
  readonly turnHistory: readonly WyrmwoodCompletedTurn[];
}
