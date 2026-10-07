import { getProfileExperienceRuntime, requestBoundary } from "../../../../core/auth/profile-experience/profile-experience-runtime";
import { resolveConfiguredAgentExecutionProfile } from "../../../../build/writing-assistant-gateway";
import { askPlotPickleAgent } from "../../../../build/mastra-agent-runtime";
import { narrationRequest, narrationPrompt, parseNarration } from "../../../../core/media/previs-narration.mjs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
function authorizationCode(error: unknown) {
  if (!error || typeof error !== "object" || !("code" in error)) return "";
  const code = (error as { code?: unknown }).code;
  return typeof code === "string" ? code : "";
}

export async function POST(request: Request) {
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
  try {
    const raw = await request.text();
    if (raw.length > 3_800_000) throw new Error("Narration request is too large.");
    input = narrationRequest(JSON.parse(raw));
  } catch {
    return Response.json({ok:false,message:"Narration needs a mapped script and readable, locked Storyboard images."},{status:400});
  }
  let text;
  try {
    const { profile } = await resolveConfiguredAgentExecutionProfile("graphic-novel", "quality");
    text = await askPlotPickleAgent({profile,agentId:"graphic-novel",tone:"direct",message:narrationPrompt(input),image:input.image,signal:request.signal});
  } catch {
    return Response.json({ok:false,message:"The Graphic Novel agent could not read the approved images. Check its image-capable model in Settings, then retry."},{status:502});
  }
  try {
    return Response.json({ok:true,panels:parseNarration(text,input)},{headers:{"Cache-Control":"no-store"}});
  } catch { return Response.json({ok:false,message:"The Graphic Novel agent returned an incomplete or invalid story sequence. Retry narration."},{status:502}); }
}
