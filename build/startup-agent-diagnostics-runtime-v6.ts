import { mastraRuntimeStatus } from "./mastra-agent-runtime";
import { reportStartupAgentInventory } from "./startup/agent-inventory.mjs";
import { assertAgentProfilesValid } from "../lib/agents/agent-profiles";
import { runStartupAgentDiagnostics as runV5 } from "./startup-agent-diagnostics-runtime-v5";

export async function runStartupAgentDiagnostics(baseUrl: string) {
  assertAgentProfilesValid();
  return runV5(baseUrl);
}

// Normal startup checks registration only. Explicit diagnostics retain the full inference chain above.
export async function runStartupAgentInventory() {
  assertAgentProfilesValid();
  return reportStartupAgentInventory(mastraRuntimeStatus());
}
