import { createDemoBoundary } from "../../../../core/demo-onboarding/demo-boundary.mjs";
import { getDemoAccessMode } from "../../../../core/demo-onboarding/demo-access-mode.mjs";
import { createStoryDemoShowMe } from "../../../../modules/story-the-unwritten/demo/show-me.mjs";
import {
  DEMO_STORY_SCENARIO_ID,
  DEMO_STORY_SEED,
  assertStoryDemoSyntheticRefs,
  createStoryDemoWorld,
  replayStoryDemoWorld,
} from "../../../../modules/story-the-unwritten/demo/world.mjs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type DemoWorld = ReturnType<typeof createStoryDemoWorld>;

function response(value: unknown, status = 200) {
  return Response.json(value, {
    status,
    headers: { "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" },
  });
}

function demoBoundary() {
  return createDemoBoundary({ demoId: DEMO_STORY_SCENARIO_ID, seed: DEMO_STORY_SEED });
}

function localDemoAllowed() {
  const runtimeState = { accessMode: getDemoAccessMode() };
  return runtimeState.accessMode === "desktop-loopback";
}

function normalizeHistory(value: unknown) {
  if (!Array.isArray(value) || value.length > 5 || value.some((item) => typeof item !== "string" || !item.startsWith("demo:decision:"))) {
    throw new Error("DEMO decision history is invalid.");
  }
  return value as string[];
}

function humanizeRef(value: unknown, pattern: RegExp) {
  return String(value || "unknown").replace(pattern, "").replaceAll("-", " ");
}

function projectWorld(world: DemoWorld) {
  assertStoryDemoSyntheticRefs(world);
  return {
    scenario: {
      title: world.scenario.title,
      summary: world.scenario.summary,
      scenes: world.scenario.scenes.map((scene) => ({
        id: scene.id,
        title: scene.title,
        decisions: scene.decisions.map((decision) => ({ id: decision.id, label: decision.label })),
      })),
    },
    session: {
      currentSceneId: world.runtime.session.currentSceneId,
      status: world.runtime.session.status,
    },
    scenes: world.runtime.scenes.map((scene) => ({ id: scene.id, status: scene.status })),
    evidence: {
      turns: Number(world.state.values["demo:value:turns"] || 0),
      maraLocation: humanizeRef(world.state.characterLocations["demo:character:mara"], /^demo:location:/u),
      maraRowanRelationship: Number(world.state.relationships["demo:relationship:mara-rowan"] || 0),
      brassKeyCustody: humanizeRef(world.state.objectCustody["demo:object:brass-key"], /^demo:(?:character|location):/u),
    },
    decisionHistory: world.decisionHistory.map((decision) => ({
      decisionId: decision.decisionId,
      consequenceKinds: [...decision.consequenceKinds],
    })),
  };
}

function publicError(error: unknown) {
  return error instanceof Error && error.message ? error.message : "The local DEMO request could not be completed.";
}

export async function GET() {
  try {
    if (!localDemoAllowed()) return response({ code: "DEMO_LOCAL_ONLY", message: "DEMO is available only on a local desktop PlotPickle Node." }, 403);
    return response(projectWorld(createStoryDemoWorld({ boundary: demoBoundary() })));
  } catch (error) {
    return response({ code: "DEMO_REQUEST_REJECTED", message: publicError(error) }, 400);
  }
}

export async function POST(request: Request) {
  try {
    if (!localDemoAllowed()) return response({ code: "DEMO_LOCAL_ONLY", message: "DEMO is available only on a local desktop PlotPickle Node." }, 403);
    const input = await request.json().catch(() => ({})) as Record<string, unknown>;
    const action = typeof input.action === "string" ? input.action : "";

    if (action === "reset") return response(projectWorld(createStoryDemoWorld({ boundary: demoBoundary() })));

    if (action === "choose") {
      const history = normalizeHistory(input.decisionIds);
      const decisionId = typeof input.decisionId === "string" ? input.decisionId : "";
      if (!decisionId.startsWith("demo:decision:") || history.length >= 5) {
        return response({ code: "DEMO_DECISION_INVALID", message: "That DEMO decision is unavailable." }, 400);
      }
      const world = replayStoryDemoWorld({ boundary: demoBoundary(), decisionIds: [...history, decisionId] });
      return response(projectWorld(world));
    }

    if (action === "show-me") {
      const history = normalizeHistory(input.decisionIds);
      const world = replayStoryDemoWorld({ boundary: demoBoundary(), decisionIds: history });
      const previousWorld = history.length
        ? replayStoryDemoWorld({ boundary: demoBoundary(), decisionIds: history.slice(0, -1) })
        : null;
      return response({
        showMe: createStoryDemoShowMe(world, {
          view: typeof input.view === "string" ? input.view : "change",
          previousWorld,
        }),
      });
    }

    return response({ code: "DEMO_ACTION_UNSUPPORTED", message: "That DEMO action is unavailable." }, 400);
  } catch (error) {
    return response({ code: "DEMO_REQUEST_REJECTED", message: publicError(error) }, 400);
  }
}