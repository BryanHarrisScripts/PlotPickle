import {
  PLOTPICKLE_NODE_CAPABILITIES,
  PLOTPICKLE_NODE_MODES,
  PLOTPICKLE_NODE_READINESS,
  PLOTPICKLE_NODE_TRUST_SCOPES,
  createLocalDesktopPlotPickleNode as createLocalDesktopNodeCore,
  normalizePlotPickleNodeDescriptor as normalizeNodeCore,
  normalizePlotPickleNodeEndpoint as normalizeEndpointCore,
  selectPlotPickleNode as selectNodeCore,
} from "./plotpickle-node-topology-core.mjs";

export type PlotPickleNodeCapability = "client" | "host" | "text" | "vision" | "image" | "video" | "retrieval" | "agents" | "community";
export type PlotPickleNodeMode = "desktop" | "studio-host" | "compute" | "hybrid";
export type PlotPickleNodeTrustScope = "local" | "lan" | "internet";
export type PlotPickleNodeReadiness = "ready" | "degraded" | "offline" | "unknown";
export type PlotPickleNodeMemoryModel = "system" | "discrete" | "unified" | "unknown";

export type PlotPickleNodeHardwareSummary = {
  platform: string;
  architecture: string;
  cpuModel: string;
  ramGb: number;
  gpuName: string;
  gpuGeneration: string;
  gpuMemoryGb: number;
  memoryModel: PlotPickleNodeMemoryModel;
};

export type PlotPickleNodeDescriptor = {
  id: string;
  label: string;
  mode: PlotPickleNodeMode;
  trustScope: PlotPickleNodeTrustScope;
  endpoint: string;
  enabled: boolean;
  readiness: PlotPickleNodeReadiness;
  capabilities: readonly PlotPickleNodeCapability[];
  hardware: Readonly<PlotPickleNodeHardwareSummary> | null;
};

export type PlotPickleNodeRouteRequest = {
  capabilities: PlotPickleNodeCapability[];
  allowedTrustScopes?: PlotPickleNodeTrustScope[];
  allowInternet?: boolean;
  allowDegraded?: boolean;
};

export type LocalDesktopPlotPickleNodeInput = {
  id?: string;
  label?: string;
  endpoint?: string;
  readiness?: PlotPickleNodeReadiness;
  textReady?: boolean;
  visionReady?: boolean;
  imageReady?: boolean;
  videoReady?: boolean;
  retrievalReady?: boolean;
  hardware?: PlotPickleNodeHardwareSummary | null;
};

export const PLOTPICKLE_NODE_CAPABILITY_VALUES = PLOTPICKLE_NODE_CAPABILITIES as readonly PlotPickleNodeCapability[];
export const PLOTPICKLE_NODE_MODE_VALUES = PLOTPICKLE_NODE_MODES as readonly PlotPickleNodeMode[];
export const PLOTPICKLE_NODE_TRUST_SCOPE_VALUES = PLOTPICKLE_NODE_TRUST_SCOPES as readonly PlotPickleNodeTrustScope[];
export const PLOTPICKLE_NODE_READINESS_VALUES = PLOTPICKLE_NODE_READINESS as readonly PlotPickleNodeReadiness[];

export function normalizePlotPickleNodeEndpoint(value: string, trustScope: PlotPickleNodeTrustScope): string {
  return normalizeEndpointCore(value, trustScope) as string;
}

export function normalizePlotPickleNodeDescriptor(input: PlotPickleNodeDescriptor): PlotPickleNodeDescriptor {
  return normalizeNodeCore(input) as PlotPickleNodeDescriptor;
}

export function createLocalDesktopPlotPickleNode(input: LocalDesktopPlotPickleNodeInput): PlotPickleNodeDescriptor {
  return createLocalDesktopNodeCore(input) as PlotPickleNodeDescriptor;
}

export function selectPlotPickleNode(
  nodes: PlotPickleNodeDescriptor[],
  request: PlotPickleNodeRouteRequest,
): PlotPickleNodeDescriptor | null {
  return selectNodeCore(nodes, request) as PlotPickleNodeDescriptor | null;
}
