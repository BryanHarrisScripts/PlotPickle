import { CAPABILITY_ROUTES, routeExecution, requireSelectedCapability } from "../../../core/contracts/compute/capability-routes.mjs";
import { CONNECTION_PROVIDERS, resolveConnectionJoin, connectionProof } from "../../../core/contracts/compute/connection-join-contract.mjs";

class ConnectionCommandBlocked extends Error {}

const capabilities = { writing: "text", text: "text", images: "image", image: "image", video: "video" };
const HELP = "PlotPickle connections status [local|cloud|hybrid]; connections test <writing|images|video> <route>; connections select <capability> <route>; connections join <capability> <direct|comfy-local|comfy-cloud> <provider>. Tests and changes require a fresh preview and confirmation. Never paste API keys into Command; use the secure provider Setup screen.";

/** Parse bounded connection operations before any user text enters the transcript. */
export function parseConnectionCommand(input) {
  const value = String(input).trim().toLowerCase();
  if (!/^\/?plotpickle\s+connections(?:\s|$)/u.test(value)) return null;
  if (/^\/?plotpickle\s+connections\s+(local|cloud|hybrid)$/u.test(value)) return null; // Existing GUI entry.
  const words = value.replace(/^\/?plotpickle\s+connections\s*/u, "").split(/\s+/u).filter(Boolean);
  if (!words.length || (words[0] === "status" && words.length <= 2 && (!words[1] || ["local", "cloud", "hybrid"].includes(words[1])))) return { action: "status", mode: words[1] || "all" };
  if (words.length === 1 && words[0] === "cancel") return { action: "cancel" };
  if (words[0] === "confirm" && /^[a-f0-9]{16}$/u.test(words[1] || "") && words.slice(2).every(word => ["charges", "share", "performance"].includes(word))) return { action: "confirm", token: words[1], charges: words.includes("charges"), share: words.includes("share"), performance: words.includes("performance") };
  const [action, category, target, provider] = words;
  const capability = capabilities[category];
  if (["test", "select"].includes(action) && words.length === 3 && capability && CAPABILITY_ROUTES[capability].includes(target)) return { action, capability, route: target };
  if (action === "join" && words.length === 4 && capability && ["direct", "comfy-local", "comfy-cloud"].includes(target) && CONNECTION_PROVIDERS[capability].some(item => item.id === provider)) return { action, capability, engine: target, provider };
  return { action: "invalid" };
}

function describeStatus(status, mode = "all") {
  return ["CONNECTIONS Â· current-profile runtime status", ...Object.entries(CAPABILITY_ROUTES).flatMap(([capability]) => {
    const group = status[capability];
    const joined = status.joins?.[capability];
    return [`${capability}: selected ${group.selected}${joined ? `; Join ${joined.engine}/${joined.provider}: ${connectionProof(status, joined).state}` : "; not joined"}`,
      ...Object.entries(group.options).filter(([, option]) => !["local", "cloud"].includes(mode) || option.locality === mode).map(([route, option]) => `  ${route}: configured=${Boolean(option.configured)}; ready=${Boolean(option.ready)}; model=${option.model || "none"}; verified=${option.verifiedAt || "not tested"}${option.error ? `; blocker=${option.error}` : ""}`)];
  }), mode === "hybrid" ? Object.entries(CONNECTION_PROVIDERS).flatMap(([capability, providers]) => providers.flatMap(provider => ["direct", "comfy-local", "comfy-cloud"].map(engine => {
    const resolved = resolveConnectionJoin(capability, engine, provider.id);
    return `${capability} ${engine}/${provider.id}: ${resolved.capable ? resolved.route : resolved.reason}`;
  }))).join("\n") : "", HELP].filter(Boolean).join("\n");
}

function testRequest(capability, route) {
  if (capability === "text" && route !== "off") return { path: "/api/writing-assistant/test", body: { provider: route, ...(route === "local" ? { modelRole: "quality" } : {}) } };
  if (capability === "image" && ["comfyui", "openai", "minimax"].includes(route)) return { path: "/api/media-routing/test/image", body: { route } };
  if (capability === "video" && ["minimax", "minimax-comfyui"].includes(route)) return { path: "/api/media-routing/test/video", body: { route: route === "minimax" ? "minimax-direct" : route }, asynchronous: true };
  if (capability === "video" && route === "comfyui-native") return { path: "/api/media-routing/comfyui/h3/native/test", body: {}, asynchronous: true, performance: true };
  if (capability === "video" && route === "ltx-video") return { path: "/api/local-ai/ltx-video/test", body: { prompt: "A short black-and-white cinematic shot of a person walking slowly through a dim room, subtle motion, steady camera." } };
  throw new ConnectionCommandBlocked("This route has no matching direct capability test. Use its existing Setup screen; no test was submitted.");
}

function identity(status, capability, route) {
  const option = status[capability]?.options?.[route];
  return JSON.stringify({ selected: status[capability]?.selected, join: status.joins?.[capability], option });
}

/** Session-only previews; authenticated GUI endpoints remain the only state and compute owners. */
export function createConnectionCommandSession(services) {
  let pending = null;
  let working = false;
  return { async execute(command) {
    if (working) return "BLOCKED: A connection operation is already running.";
    working = true;
    try {
      if (command.action === "cancel") { pending = null; return "Connection preview cancelled. No request submitted."; }
      if (command.action === "invalid") { pending = null; return `BLOCKED: Unrecognized connection command. Input withheld from transcript. ${HELP}`; }
      const profile = await services.profile();
      if (!profile) throw new ConnectionCommandBlocked("Unlock the current Human profile first.");
      const status = await services.request("/api/ai-routing/status");
      if (command.action === "status") { pending = null; return describeStatus(status, command.mode); }
      if (command.action === "confirm") {
        const preview = pending;
        pending = null; // Consume before side effects; retries never resubmit a paid test.
        if (!preview || preview.token !== command.token || preview.profile !== profile || services.now() > preview.expires || identity(status, preview.command.capability, preview.route) !== preview.identity) throw new ConnectionCommandBlocked("Connection preview expired or profile/configuration changed. Preview the exact operation again.");
        const { command: operation, execution, request } = preview;
        if ((execution.paid && !command.charges) || (execution.dataSharing && !command.share) || (request?.performance && !command.performance)) throw new ConnectionCommandBlocked("Required charge, data-sharing or GPU-performance acknowledgement is missing. Preview again.");
        if (await services.profile() !== profile) throw new ConnectionCommandBlocked("Human profile changed before submission.");
        let result;
        if (operation.action === "test") {
          result = await services.request(request.path, { ...request.body, ...(execution.paid ? { billingAcknowledged: true } : {}), ...(execution.dataSharing ? { dataSharingAcknowledged: true } : {}), ...(request.performance ? { performanceAcknowledged: true } : {}) });
        } else {
          result = await services.request(`/api/ai-routing/${operation.action}`, operation.action === "join" ? { capability: operation.capability, engine: operation.engine, provider: operation.provider } : { capability: operation.capability, route: operation.route });
        }
        if (await services.profile() !== profile) throw new ConnectionCommandBlocked("Profile changed after submission. Inspect Settings; request outcome is uncertain. Do not automatically retry.");
        services.changed();
        const refreshed = await services.request("/api/ai-routing/status");
        if (operation.action === "test") {
          const ready = refreshed[operation.capability]?.options?.[preview.route]?.ready === true;
          return `TEST REQUEST RETURNED: ${operation.capability}/${preview.route}. ${request.asynchronous ? `Job ${result.id || "identifier unavailable"}: ${result.status || "submitted"}; submission is not completed verification. Inspect the existing Setup job status before retrying.` : `Runtime readiness after test: ${ready ? "READY" : "BLOCKED / NOT VERIFIED"}.`} Selected route: ${refreshed[operation.capability]?.selected}. No route selection was requested.`;
        }
        if (operation.action === "select" && refreshed[operation.capability]?.selected !== preview.route) throw new ConnectionCommandBlocked("Selected route read-back differs; inspect Settings before retrying.");
        if (operation.action === "join") {
          const saved = refreshed.joins?.[operation.capability];
          if (!saved || saved.engine !== operation.engine || saved.provider !== operation.provider) throw new ConnectionCommandBlocked("Join read-back differs; inspect Settings before retrying.");
        }
        return describeStatus(refreshed);
      }
      pending = null;
      const resolved = command.action === "join" ? resolveConnectionJoin(command.capability, command.engine, command.provider) : null;
      if (resolved && !resolved.capable) throw new ConnectionCommandBlocked(resolved.reason);
      const route = resolved?.route || command.route;
      const option = status[command.capability]?.options?.[route];
      const execution = routeExecution(command.capability, route);
      if (!option || option.supported === false || (option.disabled && !execution.disabled)) throw new ConnectionCommandBlocked(option?.error || "No supported runtime option exists.");
      if (command.action === "select") {
        try { requireSelectedCapability(status, command.capability, route); }
        catch { throw new ConnectionCommandBlocked("The selected route needs setup and a successful capability test. No selection was submitted."); }
      }
      const request = command.action === "test" ? testRequest(command.capability, route) : null;
      const proof = resolved ? connectionProof(status, { ...resolved }) : null;
      if (proof?.state === "NOT CAPABLE") throw new ConnectionCommandBlocked(proof.reason);
      const token = services.token();
      pending = { command, route, execution, request, profile, token, identity: identity(status, command.capability, route), expires: services.now() + 120_000 };
      return `CONNECTION PREVIEW Â· ${command.action} ${command.capability}/${route}${resolved ? ` via ${command.engine}/${command.provider}; ${proof.state}${proof.reason ? `: ${proof.reason}` : ""}. ${proof.ready ? "Will select verified route." : "Will save Join only; active route stays unchanged."}` : ""}\nCurrently selected: ${status[command.capability].selected}. ${execution.paid ? "Provider requests may incur charges; existing saved provider consent is also required." : "Local compute; no per-request cloud charge."} ${execution.dataSharing ? "Video test prompt/reference may leave this computer." : ""} ${request?.performance ? "Native H3 can require substantial GPU memory; acknowledge performance impact." : ""}\nNo mutation or inference yet. Within two minutes send: PlotPickle connections confirm ${token}${execution.paid ? " charges" : ""}${execution.dataSharing ? " share" : ""}${request?.performance ? " performance" : ""}. Cancel with PlotPickle connections cancel. Never paste API keys into Command.`;
    } catch (error) {
      if (error instanceof ConnectionCommandBlocked) { pending = null; return `BLOCKED: ${error.message}`; }
      // Provider failures can contain secrets or arbitrary payloads. Read safe runtime
      // status through Settings instead of copying raw exception text to the transcript.
      pending = null;
      return "BLOCKED: Connection operation could not be verified. Check current connection status and the existing secure Setup screen for the runtime blocker. No automatic retry was made; if submitted, inspect job status before retrying.";
    } finally { working = false; }
  } };
}
