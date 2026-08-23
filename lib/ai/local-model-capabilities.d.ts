export type LocalCapabilityRole = "fast" | "quality" | "deep" | "vision" | "repair";

export type LocalModelCapabilities = {
  completion: boolean;
  vision: boolean;
  tools: boolean;
  thinking: boolean;
  coding: boolean;
  longContext: boolean;
  agentic: boolean;
};

export type LocalModelDescriptor = {
  id: string;
  runtime: string;
  family: string;
  families: string[];
  parameterSize: string;
  parameterB: number;
  quantization: string;
  quantizationBits: number;
  sizeBytes: number;
  contextTokens: number;
  nativeCapabilities: string[];
  capabilities: LocalModelCapabilities;
  metadataSource: string;
};

export type LocalHardwareFit = {
  id: "gpu" | "split" | "cpu" | "too-large" | "unknown";
  label: string;
  workingSetGb: number;
  score: number;
};

export type LocalRoleRecommendation = {
  role: LocalCapabilityRole;
  model: LocalModelDescriptor;
  eligible: boolean;
  score: number;
  fit: LocalHardwareFit;
  reasons: string[];
};

export type CapabilityHardware = {
  ramGb?: number;
  vramGb?: number;
  cpuGpuSplit?: boolean;
};

export function parseParameterBillions(value: unknown): number;
export function parseQuantizationBits(value: unknown): number;
export function normalizeModelDescriptor(input?: Record<string, unknown>): LocalModelDescriptor;
export function modelHardwareFit(model: LocalModelDescriptor | Record<string, unknown>, hardware?: CapabilityHardware): LocalHardwareFit;
export function scoreModelForRole(role: LocalCapabilityRole, model: LocalModelDescriptor | Record<string, unknown>, hardware?: CapabilityHardware): LocalRoleRecommendation;
export function recommendModelsForRoles(models?: Array<LocalModelDescriptor | Record<string, unknown>>, hardware?: CapabilityHardware): Record<LocalCapabilityRole, LocalRoleRecommendation | null>;
export function chooseModelForRole(role: LocalCapabilityRole, models?: Array<LocalModelDescriptor | Record<string, unknown>>, hardware?: CapabilityHardware, preferred?: string): LocalRoleRecommendation | null;
export function probeRuntimeModelCapabilities(input?: { kind?: string; baseUrl?: string; models?: string[]; timeoutMs?: number }): Promise<LocalModelDescriptor[]>;
export const LOCAL_CAPABILITY_ROLES: readonly LocalCapabilityRole[];
