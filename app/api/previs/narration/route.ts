import { withAuthenticatedProfileRequest } from "../../../../build/auth/profile-request-context";
import { getProfileExperienceRuntime, requestBoundary } from "../../../../core/auth/profile-experience/profile-experience-runtime";
import { resolveConfiguredAgentExecutionProfile, resolveConfiguredLocalNarrationProfile } from "../../../../build/writing-assistant-gateway";
import { askPlotPickleAgent } from "../../../../build/mastra-agent-runtime";
import { readCapabilityChoice } from "../../../../build/ai/capabilities/capability-routing-state";
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
    return Response.json({ok:false,code:code || "AUTHORIZATION_REJECTED",stage:"SESSION_AUTH",message},{status:403});
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
    return Response.json({ok:false,code:"INVALID_NARRATION_EVIDENCE",stage:"STORY_EVIDENCE",message:"Narration requires mapped script evidence, a current saved and locked Shot, and an exact 1-Shot request. Review the selected image and story before retrying."},{status:400});
  }
  let profile;
  try {
    profile = (storyboardShot ? await resolveConfiguredLocalNarrationProfile() : await resolveConfiguredAgentExecutionProfile("graphic-novel", "quality")).profile;
  } catch {
    const route = (await readCapabilityChoice()).text;
    return Response.json({ok:false,code:storyboardShot?"LOCAL_WRITER_NOT_READY":"VISUAL_NARRATION_UNAVAILABLE",
      stage:"WRITING_PREFLIGHT",route,
      message:storyboardShot
        ? `Storyboard narration requires a verified local Writing route. Selected: ${route}. Select and Test Writing with Local Runtime or Ollama in Settings → Connections; cloud and Off are not approved for Storyboard bubbles.`
        : `The Graphic Novel provider on the selected Writing route (${route}) is not ready. Test that model and its image capability in Settings.`},{status:503});
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
    return Response.json({ok:false,code:storyboardShot?"LOCAL_WRITER_FAILED":"VISUAL_NARRATION_UNAVAILABLE",
      stage:"PROVIDER_EXECUTION",route:profile?.provider || "unknown",
      message:storyboardShot
        ? `The selected ${profile?.provider || "local"} writer failed during narration inference. Check model availability and Test Writing in Settings → Connections, then retry this Shot; the previous Bubble lock is unchanged.`
        : "The Graphic Novel agent failed during visual narration inference. Check the selected Writing model and verified image-reading capability, then retry."},{status:502});
  }
  try {
    return Response.json({ok:true,panels:storyboardShot ? parseStoryboardNarration(text,input) : parseNarration(text,input)},{headers:{"Cache-Control":"no-store"}});
  } catch (error) {
    if (storyboardShot) {
      const firstFailure = storyboardNarrationOutputFailure(error);
      // One bounded local-only correction. Repeat the same exact one-Shot evidence;
      // do not forward model output or silently change provider/source/approval.
      // The previous locked Bubble stays untouched until Human Save & Lock.
      if (!request.signal.aborted) {
        try {
          const position = input.panels[0].position;
          const repairInstruction = `\\n\\nFORMAT CORRECTION: The preceding response failed validation (${firstFailure.reason}). Re-evaluate the SAME supplied story and Shot facts. Return ONE complete printable expression of at most twelve words OR exact screenplay dialogue. Respond with ONLY this JSON shape, replacing its blank text as appropriate: {"panels":[{"position":${position},"narration":"","bubbles":[]}]}. No code fences, reasoning, markdown or invented dialogue.`;
          const retry = await askPlotPickleAgent({
            profile, agentId:"graphic-novel", tone:"direct",
            message: storyboardNarrationPrompt(input) + repairInstruction,
            signal: request.signal,
          });
          const repaired = parseStoryboardNarration(retry, input);
          return Response.json({ok:true,panels:repaired,repaired:true},{headers:{"Cache-Control":"no-store"}});
        } catch (retryError) {
          const secondFailure = storyboardNarrationOutputFailure(retryError);
          return Response.json({
            ok:false, code:"INVALID_NARRATION_OUTPUT", stage:"OUTPUT_VALIDATION",
            route:profile?.provider || "unknown", reason:secondFailure.reason,
            priorReason:firstFailure.reason, attempts:2,
            message:`The local writer returned invalid narration after one automatic format correction (first: ${firstFailure.reason}; second: ${secondFailure.reason}). The current Shot and all saved Bubble approvals are unchanged. Check the Local Writing test or try Regenerate.`,
          },{status:502,headers:{"Cache-Control":"no-store"}});
        }
      }
      return Response.json({
        ok:false, code:"INVALID_NARRATION_OUTPUT", stage:"OUTPUT_VALIDATION",
        route:profile?.provider || "unknown", reason:firstFailure.reason,
        message:firstFailure.message,
      },{status:502,headers:{"Cache-Control":"no-store"}});
    }
    return Response.json({ok:false,code:"INVALID_NARRATION_OUTPUT",stage:"OUTPUT_VALIDATION",message:
      "The Graphic Novel agent returned an incomplete or invalid story sequence. Retry narration."},{status:502});
  }
}

export async function POST(request: Request) {
  try { return await withAuthenticatedProfileRequest(request, () => handlePost(request)); }
  catch (error) { return Response.json({ ok: false, code: authorizationCode(error) || "AUTHORIZATION_REJECTED", stage: "SESSION_AUTH", message: "Unlock your PlotPickle profile and refresh the session before continuing." }, { status: 403 }); }
}
