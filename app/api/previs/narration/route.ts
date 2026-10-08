import { withAuthenticatedProfileRequest } from "../../../../build/auth/profile-request-context";
import { getProfileExperienceRuntime, requestBoundary } from "../../../../core/auth/profile-experience/profile-experience-runtime";
import { resolveConfiguredAgentExecutionProfile, resolveConfiguredLocalNarrationProfile } from "../../../../build/writing-assistant-gateway";
import { askPlotPickleAgent } from "../../../../build/mastra-agent-runtime";
import { narrationRequest, narrationPrompt, parseNarration, storyboardNarrationRequest, storyboardNarrationPrompt, parseStoryboardNarration, storyboardNarrationOutputFailure } from "../../../../core/media/previs-narration.mjs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
function authorizationCode(error: unknown) {
  if (!error || typeof error !== "object" || !("code" in error)) return "";
  const code = (error as { code?: unknown }).code;
  return typeof code === "string" ? code : "";
}

async function handlePost(request: Request) {
  try {
    const state = await getProfileExperienceRuntime();
    await state.boundaryFor(new URL(request.url).origin).authorizeRequest(requestBoundary(request), { mutation: true });
  } catch (error) {
    const code = authorizationCode(error);
    const message = code === "CSRF_REJECTED"
      ? "The active Human session proof is missing or expired. Refresh the page or sign in again."
      : code === "SESSION_REJECTED"
        ? "Sign in to authorize narration generation."
        : "The current Human session could not authorize narration. Retry after PlotPickle finishes loading the active story; if it persists, review the reported authorization code.";
    return Response.json({ok:false,code:code || "AUTHORIZATION_REJECTED",message},{status:403});
  }
  let input;
  let storyboardShot = false;
  try {
    const raw = await request.text();
    if (raw.length > 3_800_000) throw new Error("Narration request is too large.");
    const value = JSON.parse(raw);
    storyboardShot = value?.mode === "storyboard-shot";
    input = storyboardShot ? storyboardNarrationRequest(value) : narrationRequest(value);
  } catch (error) {
    return Response.json({ok:false,code:"INVALID_NARRATION_EVIDENCE",message:error instanceof Error ? error.message : "Narration needs the approved screenplay and locked Shot evidence."},{status:400});
  }
  let profile;
  try {
    profile = (storyboardShot ? await resolveConfiguredLocalNarrationProfile() : await resolveConfiguredAgentExecutionProfile("graphic-novel", "quality")).profile;
  } catch {
    return Response.json({ok:false,code:storyboardShot?"LOCAL_WRITER_NOT_READY":"VISUAL_NARRATION_UNAVAILABLE",message:storyboardShot
      ? "The local writing model is not ready. Verify it in Settings → Local."
      : "The Graphic Novel provider is not ready. Check Settings."},{status:503});
  }
  let text;
  try {
    if (storyboardShot) {
      // Storyboard is a text-writing task. Do not send the locked image to the model.
      text = await askPlotPickleAgent({profile,agentId:"graphic-novel",tone:"direct",message:storyboardNarrationPrompt(input),signal:request.signal});
    } else {
      // Previs retains the existing, explicitly visual contact-sheet adaptation.
      text = await askPlotPickleAgent({profile,agentId:"graphic-novel",tone:"direct",message:narrationPrompt(input),image:input.image,signal:request.signal});
    }
  } catch {
    return Response.json({ok:false,code:storyboardShot?"LOCAL_WRITER_FAILED":"VISUAL_NARRATION_UNAVAILABLE",message:storyboardShot
      ? "The configured Local writing model did not return narration. Check Local diagnostics and retry."
      : "The Graphic Novel agent could not read the approved images. Check its image-capable model in Settings, then retry."},{status:502});
  }
  try {
    return Response.json({ok:true,panels:storyboardShot ? parseStoryboardNarration(text,input) : parseNarration(text,input)},{headers:{"Cache-Control":"no-store"}});
  } catch (error) {
    if (storyboardShot) {
      const failure = storyboardNarrationOutputFailure(error);
      return Response.json({
        ok: false,
        code: "INVALID_NARRATION_OUTPUT",
        reason: failure.reason,
        message: failure.message,
      }, { status: 502, headers: { "Cache-Control": "no-store" } });
    }
    return Response.json({ok:false,code:"INVALID_NARRATION_OUTPUT",message:
      "The Graphic Novel agent returned an incomplete or invalid story sequence. Retry narration."},{status:502});
  }
}

export async function POST(request: Request) {
  try { return await withAuthenticatedProfileRequest(request, () => handlePost(request)); }
  catch (error) { return Response.json({ ok: false, code: authorizationCode(error) || "AUTHORIZATION_REJECTED", message: "Unlock your PlotPickle profile and refresh the session before continuing." }, { status: 403 }); }
}
