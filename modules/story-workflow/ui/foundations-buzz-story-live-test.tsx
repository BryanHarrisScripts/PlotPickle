"use client";

import { useState } from "react";
import type { CurriculumLesson } from "../../../core/contracts/curriculum";
import { authenticatedProfileFetch } from "../../../core/auth/profile-request-browser";
import type { PPFProject } from "../../../core/project/project";
import type { StoryWorkItem } from "../../../core/story-workflow/story-workflow-core.mjs";
import { loadFoundationProject } from "../../../core/storage/foundation-project-browser";
import { createFoundationsStoryResponsibilityRun } from "../runtime/foundations-story-workflow";

type RunResponse = {
  readonly ok?: boolean;
  readonly message?: string;
};

type BridgeContribution = {
  readonly accepted?: boolean;
  readonly state?: string;
  readonly reason?: string;
  readonly result?: { readonly resultId?: string } | null;
  readonly provenance?: { readonly eventId?: string; readonly signatureVerified?: boolean };
};

type PreparedBridgeRequest = Record<string, unknown> & {
  readonly requestId?: string;
  readonly state?: string;
  readonly stateReason?: string;
  readonly expectedAgentPubkey?: string;
};

type BridgeResponse = {
  readonly ok?: boolean;
  readonly message?: string;
  readonly state?: string;
  readonly executionPath?: string;
  readonly requestId?: string;
  readonly request?: PreparedBridgeRequest;
  readonly idempotent?: boolean;
  readonly contributions?: readonly BridgeContribution[];
  readonly accepted?: readonly BridgeContribution[];
};

async function runRequest(body: Record<string, unknown>) {
  const response = await authenticatedProfileFetch("/api/responsibility-runs", {
    method: "POST",
    cache: "no-store",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(body),
  });
  const value = await response.json() as RunResponse;
  if (!response.ok || !value.ok) throw new Error(value.message || `Responsibility Run returned ${response.status}.`);
}

async function bridgeRequest(body: Record<string, unknown>) {
  const response = await authenticatedProfileFetch("/api/story-workflow/buzz-bridge", {
    method: "POST",
    cache: "no-store",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(body),
  });
  const value = await response.json() as BridgeResponse;
  if (!response.ok || !value.ok) throw new Error(value.message || `BUZZ Story Bridge returned ${response.status}.`);
  return value;
}

function sleep(milliseconds: number) {
  return new Promise<void>((resolve) => window.setTimeout(resolve, milliseconds));
}

export default function FoundationsBuzzStoryLiveTest({
  project,
  curriculum,
  workItem,
  disabled,
  onStatus,
}: {
  readonly project: PPFProject;
  readonly curriculum: readonly CurriculumLesson[];
  readonly workItem: StoryWorkItem | null;
  readonly disabled?: boolean;
  readonly onStatus: (message: string) => void;
}) {
  const [state, setState] = useState<"idle" | "running" | "pass" | "fail">("idle");

  async function runLiveTest() {
    if (disabled || state === "running" || !workItem) return;
    setState("running");
    let runId = "";
    let runCreated = false;
    try {
      const before = loadFoundationProject();
      const task = createFoundationsStoryResponsibilityRun({ project, workItem, curriculum });
      runId = task.run.runId;
      onStatus("BUZZ Story Test · creating the bounded Tamsin Responsibility Run…");
      await runRequest({
        action: "create",
        runId: task.run.runId,
        kind: task.run.kind,
        goal: task.run.goal,
        profileId: task.run.profileId,
        skillUris: task.run.skillUris,
        allowedScopes: task.run.allowedScopes,
        allowedConnectorIds: task.run.allowedConnectorIds,
        context: task.run.context,
        limits: task.run.limits,
        parentRunId: task.run.parentRunId,
      });
      runCreated = true;
      await runRequest({
        action: "start",
        runId: task.run.runId,
        contextCharacters: task.contextPacket.receipt.usedCharacters,
      });

      const prepared = await bridgeRequest({
        action: "prepare",
        project,
        workItem,
        run: task.run,
        contextPacket: task.contextPacket,
      });
      const bridge = prepared.request;
      if (!bridge || bridge.state !== "ready" || !bridge.expectedAgentPubkey) {
        throw new Error(bridge?.stateReason || "Tamsin does not have a usable local BUZZ signer binding.");
      }

      onStatus("BUZZ Story Test · adding Tamsin to the private Story Room and dispatching the bounded task…");
      const dispatched = await bridgeRequest({ action: "dispatch", request: bridge });
      if (dispatched.state !== "sent" || dispatched.executionPath !== "buzz" || dispatched.idempotent === true) {
        throw new Error(dispatched.message || "The first BUZZ dispatch did not produce a new signed Human task event.");
      }

      const retry = await bridgeRequest({ action: "dispatch", request: bridge });
      if (retry.state !== "sent" || retry.idempotent !== true) {
        throw new Error("The reconnect/retry proof failed because the same Story Bridge request was dispatched twice.");
      }

      onStatus("BUZZ Story Test · task sent. Waiting for Tamsin Hearthquill’s signed response…");
      let received: BridgeResponse | null = null;
      for (let attempt = 0; attempt < 45; attempt += 1) {
        if (attempt) await sleep(2_000);
        const candidate = await bridgeRequest({ action: "collect", request: bridge, currentRevision: project.revision });
        if (candidate.accepted?.length) {
          received = candidate;
          break;
        }
        if (candidate.state === "review-required" && candidate.contributions?.length) {
          const reason = candidate.contributions.map((item) => item.reason).filter(Boolean).join(" · ");
          throw new Error(reason || "BUZZ returned a result, but it did not pass the Story Bridge signer/revision boundary.");
        }
      }
      const contribution = received?.accepted?.[0];
      if (!contribution || contribution.provenance?.signatureVerified !== true || !contribution.result?.resultId) {
        throw new Error("No correctly attributed signed Tamsin contribution arrived within 90 seconds.");
      }

      onStatus("BUZZ Story Test · signed result received. Proving stale-revision rejection and no canon mutation…");
      const stale = await bridgeRequest({
        action: "collect",
        request: bridge,
        currentRevision: `${project.revision}:simulated-next-revision`,
      });
      if (stale.accepted?.length || !stale.contributions?.some((item) => item.state === "stale" && item.accepted === false)) {
        throw new Error("The stale-response proof failed: the signed contribution was not rejected after a simulated revision advance.");
      }

      const after = loadFoundationProject();
      if (JSON.stringify(before) !== JSON.stringify(after)) {
        throw new Error("The no-canon-mutation proof failed because the active PPF changed during the BUZZ transport test.");
      }

      await runRequest({
        action: "proposal-ready",
        runId: task.run.runId,
        resultId: contribution.result.resultId,
        ref: contribution.provenance?.eventId ? `buzz-event:${contribution.provenance.eventId}` : `buzz-story-bridge:${bridge.requestId || "unknown"}`,
        producedAt: new Date().toISOString(),
      });
      setState("pass");
      onStatus("BUZZ Story Test PASS · Tamsin signed the bounded result · retry was idempotent · stale response was rejected · PPF/canon stayed unchanged.");
    } catch (error) {
      const reason = error instanceof Error ? error.message : "The BUZZ Story Test failed.";
      if (runCreated && runId) {
        await Promise.allSettled([runRequest({ action: "cancel", runId, reason })]);
      }
      setState("fail");
      onStatus(`BUZZ Story Test FAIL · ${reason}`);
    }
  }

  const label = state === "running"
    ? "Waiting for Tamsin…"
    : state === "pass"
      ? "BUZZ Story Test: PASS"
      : state === "fail"
        ? "Retry BUZZ Story Test"
        : "Run BUZZ Story Test";

  return (
    <button type="button" disabled={Boolean(disabled) || state === "running" || !workItem} onClick={() => void runLiveTest()}>
      {label}
    </button>
  );
}
