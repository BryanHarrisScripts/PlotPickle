import { getProfileExperienceRuntime, requestBoundary } from "../../../../core/auth/profile-experience/profile-experience-runtime";
import { resolveConfiguredAgentExecutionProfile } from "../../../../build/writing-assistant-gateway";
import { askPlotPickleAgent } from "../../../../build/mastra-agent-runtime";
import { narrationRequest, narrationPrompt, parseNarration } from "../../../../core/media/previs-narration.mjs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function POST(request: Request) {
  try {
    const state = await getProfileExperienceRuntime();
    await state.boundaryFor(new URL(request.url).origin).authorizeRequest(requestBoundary(request), { mutation: true });
  } catch { return Response.json({ok:false,message:"Sign in to authorize narration generation."},{status:403}); }
  try {
    const raw = await request.text();
    if (raw.length > 48000) throw new Error("Narration request is too large.");
    const input = narrationRequest(JSON.parse(raw));
    const { profile } = await resolveConfiguredAgentExecutionProfile("graphic-novel", "quality");
    const text = await askPlotPickleAgent({profile,agentId:"graphic-novel",tone:"direct",message:narrationPrompt(input),signal:request.signal});
    return Response.json({ok:true,panels:parseNarration(text,input)},{headers:{"Cache-Control":"no-store"}});
  } catch { return Response.json({ok:false,message:"Narration could not be prepared. Check the mapped script and the Graphic Novel agent's text provider in Settings, then retry."},{status:400}); }
}
