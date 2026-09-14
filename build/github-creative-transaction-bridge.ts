import type { PlotPickleProject } from "../lib/projects/project";
import type { StoryProposalGroupId } from "../lib/projects/story/story-proposals";
import type { CreativeChangeSet } from "../lib/creative-transactions/creative-transaction-contract";
import type { GitHubCreativeTransactionBridge, GitHubProposalInspection } from "../lib/creative-transactions/github-creative-transaction-provider";

const API = "/api/local-github";

type FetchLike = typeof fetch;
type ProposalItem = { number: number; state: "open" | "draft" | "approved" | "merged" | "declined" };
type ProposalReview = { proposal: ProposalItem; baseCommit: string; headCommit: string; groups: Array<{ id: StoryProposalGroupId; changed: boolean }> };
type BridgeOptions = {
  resolveProject(changeSet: CreativeChangeSet, artifactRefs: readonly string[]): Promise<PlotPickleProject> | PlotPickleProject;
  fetchImpl?: FetchLike;
};

function providerNumber(value: string) {
  const number = Number(value);
  if (!Number.isInteger(number) || number <= 0) throw new Error("GitHub Story Proposal identity is invalid.");
  return number;
}

async function request(fetchImpl: FetchLike, path: string, method: "GET" | "POST" = "GET", body?: object) {
  const response = await fetchImpl(path, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const type = response.headers.get("content-type") ?? "";
  if (!type.includes("application/json")) throw new Error("GitHub Story Proposals are available only through the local PlotPickle gateway.");
  const value = await response.json() as Record<string, unknown>;
  if (!response.ok) throw new Error(typeof value.message === "string" ? value.message : "GitHub Story Proposal operation failed.");
  return value;
}

function proposalItems(value: unknown): ProposalItem[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const record = item as Record<string, unknown>;
    const number = Number(record.number) || 0;
    const state = String(record.state);
    if (!number || !["open", "draft", "approved", "merged", "declined"].includes(state)) return [];
    return [{ number, state: state as ProposalItem["state"] }];
  });
}

function reviewFrom(value: Record<string, unknown>): ProposalReview {
  const proposalValue = value.proposal && typeof value.proposal === "object" ? value.proposal as Record<string, unknown> : {};
  const number = Number(proposalValue.number) || 0;
  const state = String(proposalValue.state || "open");
  if (!number || !["open", "draft", "approved", "merged", "declined"].includes(state)) throw new Error("GitHub returned an invalid Story Proposal review.");
  const groups = Array.isArray(value.groups) ? value.groups.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const record = item as Record<string, unknown>;
    const id = String(record.id) as StoryProposalGroupId;
    if (!["story", "dialogue", "characters", "scenes", "world", "production", "review", "assets", "rights"].includes(id)) return [];
    return [{ id, changed: Boolean(record.changed) }];
  }) : [];
  return {
    proposal: { number, state: state as ProposalItem["state"] },
    baseCommit: String(value.baseCommit ?? ""),
    headCommit: String(value.headCommit ?? ""),
    groups,
  };
}

export function createLocalGitHubCreativeTransactionBridge(options: BridgeOptions): GitHubCreativeTransactionBridge {
  const fetchImpl = options.fetchImpl ?? fetch;
  return {
    async createProposal({ changeSet, artifactRefs }) {
      const project = await options.resolveProject(changeSet, artifactRefs);
      const baseRevision = project.collaboration.lastPulledCommit;
      if (!baseRevision) throw new Error("Refresh the approved GitHub story before creating an external Creative Transaction.");
      const value = await request(fetchImpl, `${API}/submit-proposal`, "POST", {
        project,
        title: `Creative Transaction: ${changeSet.changeSetId}`,
        note: `PlotPickle Creative Change Set ${changeSet.changeSetId}. Canon remains writer-approved in PPF.`,
        baseRevision,
      });
      const number = Number(value.pullRequestNumber) || 0;
      if (!number) throw new Error("GitHub did not return a Story Proposal number.");
      return {
        providerTransactionId: String(number),
        reviewRef: String(value.pullRequestUrl ?? ""),
        baseRevisionId: String(value.baseRevision ?? baseRevision),
        proposedRevisionId: String(value.commitSha ?? ""),
      };
    },

    async inspectProposal(providerTransactionId): Promise<GitHubProposalInspection> {
      const number = providerNumber(providerTransactionId);
      try {
        const value = await request(fetchImpl, `${API}/proposals`);
        const item = proposalItems(value.proposals).find((proposal) => proposal.number === number);
        if (!item) return { state: "missing", durableRevisionId: "", summary: "The GitHub Story Proposal no longer appears in the configured repository." };
        if (item.state === "declined") return { state: "declined", durableRevisionId: "", summary: "GitHub confirms the Story Proposal was declined." };
        if (item.state === "approved" || item.state === "merged") {
          return {
            state: "committed",
            durableRevisionId: "",
            summary: "GitHub confirms the Story Proposal completed. If local acknowledgement was interrupted, PlotPickle reports the commit/revision gap instead of inventing a durable revision ID.",
          };
        }
        return { state: "open", durableRevisionId: "", summary: "GitHub Story Proposal remains open for review." };
      } catch (error) {
        return { state: "unavailable", durableRevisionId: "", summary: error instanceof Error ? error.message : "GitHub Story Proposal state is unavailable." };
      }
    },

    async commitApprovedProposal({ providerTransactionId }) {
      const number = providerNumber(providerTransactionId);
      const reviewValue = await request(fetchImpl, `${API}/proposal-review?number=${encodeURIComponent(number)}`);
      const review = reviewFrom(reviewValue);
      if (!review.baseCommit) throw new Error("GitHub Story Proposal review did not expose the approved base revision.");
      const selectedGroups = review.groups.filter((group) => group.changed).map((group) => group.id);
      if (!selectedGroups.length) throw new Error("The GitHub Story Proposal contains no changed semantic groups to commit.");
      const value = await request(fetchImpl, `${API}/approve-proposal`, "POST", {
        number,
        expectedBaseCommit: review.baseCommit,
        selectedGroups,
      });
      const durableRevisionId = String(value.remoteCommit ?? "");
      if (!durableRevisionId) throw new Error("GitHub did not return the approved durable revision.");
      return { durableRevisionId };
    },

    async declineProposal({ providerTransactionId }) {
      const number = providerNumber(providerTransactionId);
      await request(fetchImpl, `${API}/decline-proposal`, "POST", { number });
    },

    async requestRevision({ providerTransactionId }) {
      const number = providerNumber(providerTransactionId);
      await request(fetchImpl, `${API}/decline-proposal`, "POST", { number });
    },
  };
}
