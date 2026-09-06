import {
  applyStoryWorkspaceChoice,
  createStoryWorkspaceGame,
  projectStoryWorkspace,
  replayStoryWorkspaceChoices,
} from "@/modules/story-the-unwritten/workspace/playable-starter.mjs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function response(value: unknown, status = 200) {
  return Response.json(value, {
    status,
    headers: { "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" },
  });
}

function normalizeHistory(value: unknown) {
  if (!Array.isArray(value) || value.length > 5 || value.some((item) => typeof item !== "string" || !item.trim())) {
    throw new Error("STORY choice history is invalid.");
  }
  return value as string[];
}

function publicError(error: unknown) {
  return error instanceof Error && error.message ? error.message : "The local STORY request could not be completed.";
}

function payload(game: ReturnType<typeof createStoryWorkspaceGame>, choiceIds: readonly string[]) {
  return {
    workspace: projectStoryWorkspace(game),
    choiceIds: [...choiceIds],
    authority: "deterministic-story-engine",
    persistedServerSession: false,
  };
}

export async function GET() {
  try {
    return response(payload(createStoryWorkspaceGame(), []));
  } catch (error) {
    return response({ code: "STORY_WORKSPACE_REJECTED", message: publicError(error) }, 400);
  }
}

export async function POST(request: Request) {
  try {
    const input = await request.json().catch(() => ({})) as Record<string, unknown>;
    const action = typeof input.action === "string" ? input.action : "";

    if (action === "reset") return response(payload(createStoryWorkspaceGame(), []));

    if (action === "choose") {
      const history = normalizeHistory(input.choiceIds);
      if (history.length >= 5) return response({ code: "STORY_SESSION_COMPLETE", message: "This five-scene STORY session is complete." }, 409);
      const choiceId = typeof input.choiceId === "string" ? input.choiceId.trim() : "";
      if (!choiceId) return response({ code: "STORY_CHOICE_INVALID", message: "A STORY choice is required." }, 400);

      const current = replayStoryWorkspaceChoices(history);
      const next = applyStoryWorkspaceChoice(current, choiceId, {
        proposedAt: `2026-09-06T00:00:0${history.length}.000Z`,
      });
      const choiceIds = [...history, choiceId];
      return response(payload(next, choiceIds));
    }

    if (action === "replay") {
      const history = normalizeHistory(input.choiceIds);
      return response(payload(replayStoryWorkspaceChoices(history), history));
    }

    return response({ code: "STORY_WORKSPACE_ACTION_UNSUPPORTED", message: "That STORY workspace action is unavailable." }, 400);
  } catch (error) {
    return response({ code: "STORY_WORKSPACE_REJECTED", message: publicError(error) }, 400);
  }
}
