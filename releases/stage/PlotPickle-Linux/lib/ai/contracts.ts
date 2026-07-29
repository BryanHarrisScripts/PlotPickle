export const AI_CONTRACT_VERSION = "1.0.0" as const;

export type AiCapability =
  | "text"
  | "structured-output"
  | "vision"
  | "image-generation"
  | "image-editing"
  | "embeddings"
  | "knowledge-search"
  | "video-generation"
  | "prompt-export";

export type AiProviderKind = "openai" | "openai-compatible" | "ollama" | "manual" | "disabled";

export type AiSecretSource = "session" | "environment" | "none";

export type AiModelSelection = {
  text?: string;
  vision?: string;
  image?: string;
  embedding?: string;
  video?: string;
};

export type AiProviderConfig = {
  id: string;
  label: string;
  kind: AiProviderKind;
  baseUrl: string;
  enabled: boolean;
  secretSource: AiSecretSource;
  capabilities: AiCapability[];
  models: AiModelSelection;
};

export type AiProviderStatus = {
  ok: boolean;
  providerId: string;
  message: string;
  checkedAt: string;
  models?: string[];
};

export type JsonSchema = Record<string, unknown>;

export type AiTextRequest = {
  instructions: string;
  prompt: string;
  context?: string;
  schema?: {
    name: string;
    value: JsonSchema;
  };
};

export type AiTextResult = {
  text: string;
  parsed?: unknown;
  providerId: string;
  model: string;
  responseId?: string;
};

export type AiImageRequest = {
  prompt: string;
  size?: "1024x1024" | "1024x1536" | "1536x1024" | "auto";
  quality?: "low" | "medium" | "high" | "auto";
  outputFormat?: "png" | "jpeg" | "webp";
  referenceAssets?: AiAssetReference[];
};

export type AiImageResult = {
  providerId: string;
  model: string;
  mimeType: string;
  base64?: string;
  url?: string;
  revisedPrompt?: string;
  responseId?: string;
};

export type AiVideoRequest = {
  prompt: string;
  sourceAsset?: AiAssetReference;
  durationSeconds?: number;
  aspectRatio?: "16:9" | "9:16" | "1:1";
  characterLookIds?: string[];
};

export type AiVideoJob = {
  id: string;
  providerId: string;
  model: string;
  status: "queued" | "running" | "succeeded" | "failed" | "cancelled";
  progress?: number;
  output?: AiAssetReference;
  error?: string;
};

export type AiAssetReference = {
  id: string;
  kind: "image" | "video" | "document" | "audio" | "other";
  uri: string;
  mimeType?: string;
  label?: string;
  contentHash?: string;
};

export type KnowledgeSource = {
  id: string;
  title: string;
  kind: "project" | "document" | "research" | "transcript" | "image-notes" | "other";
  storage: "inline" | "asset-reference" | "provider-index";
  text?: string;
  assetId?: string;
  providerResourceIds?: Record<string, string>;
  sourceLabel?: string;
  contentHash?: string;
  includeByDefault: boolean;
  createdAt: string;
  updatedAt: string;
};

export type CharacterIdentityLock = {
  characterId: string;
  ageRange: string;
  face: string;
  hair: string;
  body: string;
  distinguishingFeatures: string[];
  neverChange: string[];
  avoid: string[];
  canonicalReferenceAssetIds: string[];
};

export type CharacterLook = {
  id: string;
  characterId: string;
  label: string;
  storyPhase: string;
  wardrobe: string;
  grooming: string;
  physicalCondition: string;
  props: string[];
  palette: string[];
  referenceAssetIds: string[];
  approved: boolean;
};

export type ContinuityLock = {
  id: string;
  scope: "project" | "act" | "sequence" | "block" | "scene" | "shot";
  scopeId: string;
  category: "character" | "wardrobe" | "location" | "prop" | "lighting" | "time" | "camera" | "other";
  instruction: string;
  assetIds: string[];
};

export type GenerationProvenance = {
  id: string;
  operation: "text" | "image" | "video" | "analysis";
  providerId: string;
  providerKind: AiProviderKind;
  model: string;
  prompt: string;
  contextSourceIds: string[];
  referenceAssetIds: string[];
  createdAt: string;
  humanEdited: boolean;
  approval: "unreviewed" | "rejected" | "variation" | "approved";
  providerResponseId?: string;
  providerSeed?: string;
};

export type PlotPickleAiExtension = {
  contractVersion: typeof AI_CONTRACT_VERSION;
  knowledge: KnowledgeSource[];
  identityLocks: CharacterIdentityLock[];
  characterLooks: CharacterLook[];
  continuityLocks: ContinuityLock[];
  assets: AiAssetReference[];
  provenance: GenerationProvenance[];
  videoJobs: AiVideoJob[];
};

