export type PlotPickleRecommendedBuzzConfiguration = {
  readonly schemaVersion: 1;
  readonly configurationVersion: "PlotPickle Recommended v1";
  readonly globalDefaults: {
    readonly runtime: { readonly id: "buzz-agent"; readonly label: "Buzz Agent" };
    readonly provider: { readonly id: "openai"; readonly label: "OpenAI" };
    readonly model: "gpt-5.6-luna";
    readonly reasoningEffort: null;
    readonly reasoningLabel: string;
    readonly memory: "none";
    readonly memoryLabel: "PlotPickle Context Only";
    readonly autoRestartOnConfigChange: true;
  };
  readonly agentDefaults: {
    readonly agentType: "local-managed";
    readonly agentTypeLabel: "Local Managed Agent";
    readonly parallelism: 1;
    readonly activation: "explicit-mentions";
    readonly activationLabel: string;
    readonly privateStoryRooms: "automatic";
    readonly privateStoryRoomsLabel: "Automatic";
    readonly startOnBuzzLaunch: true;
    readonly autoRestartOnConfigChange: true;
  };
  readonly authority: {
    readonly creativeTruth: string;
    readonly conversationRecord: string;
    readonly memoryAuthority: string;
    readonly privateKeyCustody: "BUZZ";
  };
  readonly commonInstructions: readonly string[];
  readonly syncSupport: {
    readonly readableFromBuzz: readonly string[];
    readonly ownerReviewedDraftFields: readonly string[];
    readonly unavailableFields: readonly string[];
    readonly noSecretOwnerReviewedSyncAvailable: false;
    readonly unavailableReason: string;
  };
};

export function validatePlotPickleRecommendedBuzzConfig(value: unknown): PlotPickleRecommendedBuzzConfiguration;

export function buildPlotPickleBuzzAgentInstructions(input: {
  readonly configuration: PlotPickleRecommendedBuzzConfiguration;
  readonly profile: {
    readonly displayName: string;
    readonly title: string;
    readonly responsibility: string;
    readonly creativeAuthority: string;
    readonly verificationContract: string;
  };
  readonly publicBio: string;
}): string;
