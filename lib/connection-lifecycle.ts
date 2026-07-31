export const CONNECTION_LIFECYCLE_STATES = [
  "optional",
  "connecting",
  "connected",
  "attention",
  "failed",
] as const;

export type ConnectionLifecycleState = (typeof CONNECTION_LIFECYCLE_STATES)[number];

export type ConnectionLifecycleInput = {
  configured: boolean;
  previouslyConnected: boolean;
  connecting?: boolean;
  connected?: boolean;
  attention?: boolean;
  failed?: boolean;
};

export type ConnectionLifecyclePresentation = {
  state: ConnectionLifecycleState;
  label: string;
  tone: "neutral" | "working" | "healthy" | "attention" | "error";
};

export function connectionLifecycleState(input: ConnectionLifecycleInput): ConnectionLifecycleState {
  if (input.connecting) return "connecting";
  if (input.connected) return "connected";
  if (input.failed && input.previouslyConnected) return "failed";
  if (input.attention || (input.configured && input.failed)) return "attention";
  return "optional";
}

export function connectionLifecyclePresentation(input: ConnectionLifecycleInput): ConnectionLifecyclePresentation {
  const state = connectionLifecycleState(input);
  switch (state) {
    case "connecting":
      return { state, label: "Connecting", tone: "working" };
    case "connected":
      return { state, label: "Connected", tone: "healthy" };
    case "attention":
      return { state, label: "Needs attention", tone: "attention" };
    case "failed":
      return { state, label: "Connection lost", tone: "error" };
    default:
      return { state: "optional", label: "Optional · not configured", tone: "neutral" };
  }
}

export function mayUseErrorTone(input: ConnectionLifecycleInput) {
  return connectionLifecycleState(input) === "failed";
}
