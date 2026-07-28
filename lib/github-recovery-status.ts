import type { PublicGitHubCommandEntry } from "./github-command-outbox";

export type GitHubRecoveryTone = "ready" | "pending" | "authentication" | "review";

export type GitHubRecoverySummary = {
  tone: GitHubRecoveryTone;
  label: string;
  message: string;
  activeCount: number;
  terminalCount: number;
  counts: {
    pending: number;
    sending: number;
    retryable: number;
    needsAuthentication: number;
    needsReview: number;
  };
};

const TERMINAL_STATES = new Set(["completed", "cancelled"]);

export function activeGitHubRecoveryCommands(entries: PublicGitHubCommandEntry[]) {
  return entries
    .filter((entry) => !TERMINAL_STATES.has(entry.state))
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
}

export function summarizeGitHubRecovery(entries: PublicGitHubCommandEntry[]): GitHubRecoverySummary {
  const active = activeGitHubRecoveryCommands(entries);
  const counts = {
    pending: active.filter((entry) => entry.state === "pending").length,
    sending: active.filter((entry) => entry.state === "sending").length,
    retryable: active.filter((entry) => entry.state === "retryable").length,
    needsAuthentication: active.filter((entry) => entry.state === "needs-authentication").length,
    needsReview: active.filter((entry) => entry.state === "needs-review").length,
  };
  const terminalCount = entries.length - active.length;
  if (counts.needsAuthentication) {
    return {
      tone: "authentication",
      label: "Reconnect GitHub",
      message: "A saved GitHub command needs a fresh connection before the original action can be repeated.",
      activeCount: active.length,
      terminalCount,
      counts,
    };
  }
  if (counts.needsReview) {
    return {
      tone: "review",
      label: "Review required",
      message: "PlotPickle stopped rather than choosing between local and GitHub content automatically.",
      activeCount: active.length,
      terminalCount,
      counts,
    };
  }
  if (active.length) {
    return {
      tone: "pending",
      label: "GitHub work is waiting",
      message: "Local writing remains safe. Retryable commands can be marked ready, but this dashboard never sends them automatically.",
      activeCount: active.length,
      terminalCount,
      counts,
    };
  }
  return {
    tone: "ready",
    label: "Recovery ready",
    message: "No GitHub recovery work is waiting.",
    activeCount: 0,
    terminalCount,
    counts,
  };
}
