import { randomUUID } from "node:crypto";
import { currentProfileRequestContext } from "../auth/profile-request-context";
import { readCredentialJson, writeCredentialJson } from "../local-credentials";
import { routeExecution } from "../../core/contracts/compute/capability-routes.mjs";

type Stage = "selection" | "preflight" | "submitted" | "polling" | "saved" | "failed";
type Diagnostic = { id: string; at: string; capability: string; route: string; runtime: string; provider: string; stage: Stage; code: string; jobId: string };
const queues = new Map<string, Promise<void>>();
export async function readCapabilityDiagnostics(): Promise<Diagnostic[]> {
  return await readCredentialJson<Diagnostic[]>("capability-diagnostics.json") || [];
}
// Only operational metadata enters this relay. No arbitrary prompt, response or error text.
export async function relayCapabilityDiagnostic(capability: "text" | "image" | "video", route: string, stage: Stage, code: string, jobId = "") {
  const profile = currentProfileRequestContext();
  if (!profile) return;
  const execution = routeExecution(capability, route);
  const record: Diagnostic = { id: randomUUID(), at: new Date().toISOString(), capability, route, runtime: execution.runtimeLocation, provider: execution.provider, stage, code, jobId: jobId.replace(/[^A-Za-z0-9_-]/g, "").slice(0, 160) };
  const previous = queues.get(profile.profileId) || Promise.resolve();
  const write = previous.catch(() => {}).then(async () => {
    const events = await readCapabilityDiagnostics();
    await writeCredentialJson("capability-diagnostics.json", [...events.slice(-79), record]);
  });
  queues.set(profile.profileId, write);
  try { await write; } finally { if (queues.get(profile.profileId) === write) queues.delete(profile.profileId); }
}
