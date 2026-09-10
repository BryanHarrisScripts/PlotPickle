import { createApprovedDemoHandoff } from "../../../core/demo-onboarding/demo-boundary.mjs";
import {
  DEMO_STORY_SCENARIO_ID,
  replayStoryDemoWorld,
} from "./world.mjs";

function requireCompletedDecisionIds(decisionIds) {
  if (!Array.isArray(decisionIds) || decisionIds.length !== 5
    || decisionIds.some((item) => typeof item !== "string" || !item.startsWith("demo:decision:"))) {
    const error = new Error("Make This Mine requires one completed five-scene DEMO path.");
    error.code = "DEMO_HANDOFF_INCOMPLETE_PATH";
    throw error;
  }
  return decisionIds;
}

function decisionLabel(world, decisionId) {
  for (const scene of world.scenario.scenes) {
    const decision = scene.decisions.find((item) => item.id === decisionId);
    if (decision) return decision.label;
  }
  const error = new Error("The DEMO handoff contains an unknown story decision.");
  error.code = "DEMO_HANDOFF_UNKNOWN_DECISION";
  throw error;
}

export function createStoryDemoStarterHandoff({ boundary, decisionIds, approved }) {
  const completedPath = requireCompletedDecisionIds(decisionIds);
  const world = replayStoryDemoWorld({ boundary, decisionIds: completedPath });
  if (world.runtime.session.status !== "completed" || world.decisionHistory.length !== 5) {
    const error = new Error("Make This Mine requires a completed DEMO STORY session.");
    error.code = "DEMO_HANDOFF_INCOMPLETE_SESSION";
    throw error;
  }

  const choices = world.decisionHistory.map((entry) => decisionLabel(world, entry.decisionId));
  const starterContent = Object.freeze({
    title: `${world.scenario.title} — My Story`,
    foundationsBrief: [
      `A new story starting point inspired by PlotPickle's “${world.scenario.title}” DEMO.`,
      "",
      "Choices carried forward as creative prompts:",
      ...choices.map((label, index) => `${index + 1}. ${label}`),
      "",
      "This is ordinary Human-owned starter material. No DEMO runtime state, authority, credentials, hidden knowledge, synthetic references, or canon permissions were copied.",
    ].join("\n"),
  });

  return createApprovedDemoHandoff({
    approved,
    sourceDemoId: DEMO_STORY_SCENARIO_ID,
    starterContent,
  });
}
