import { assertAgentProfilesValid } from "../lib/agent-profiles";
import { runStartupAgentDiagnostics as runV5 } from "./startup-agent-diagnostics-runtime-v5";

export async function runStartupAgentDiagnostics(baseUrl: string) {
  assertAgentProfilesValid();
  return runV5(baseUrl);
}
