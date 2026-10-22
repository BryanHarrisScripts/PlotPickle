/**
 * #3142: the same local supervisor capability for CMD and authenticated GUI.
 * This HTTP adapter accepts injected, trusted auth and the existing supervisor
 * functions; it is not another worker, dispatcher, permission source or store.
 */
const LOOPBACK = new Set(["localhost", "127.0.0.1", "[::1]"]);
const STATES = new Set(["OFF", "OFFLINE", "RUNNING", "BLOCKED", "PAUSE_REQUESTED",
  "PAUSED", "RESUME_REQUESTED", "STOP_REQUESTED"]);
const SAFE_REASON = /^[A-Z0-9_]{1,80}$/;
const SHA = /^[a-f0-9]{40}$/;
const respond = (body, status = 200) => Response.json(body, {
  status, headers: { "Cache-Control": "no-store", "Referrer-Policy": "no-referrer",
    "X-Content-Type-Options": "nosniff" },
});

export function summarizeSupervisorForGui(result) {
  const state = STATES.has(result?.state) ? result.state : "BLOCKED";
  const code = typeof result?.reason === "string" && SAFE_REASON.test(result.reason)
    ? result.reason : state === "BLOCKED" ? "SOURCE_UNVERIFIED" : null;
  return Object.freeze({
    state, reason: code,
    sourceHead: SHA.test(result?.exactSha || "") ? result.exactSha : null,
    heartbeatAt: Number.isSafeInteger(result?.checkedAt) && result.checkedAt >= 0
      ? result.checkedAt : null,
    pauseAcknowledged: result?.pauseAcknowledged === true,
    inFlightCancellationProven: false,
    workerProcessVerified: false,
    autonomousCodingVerified: false,
    automaticMergeEnabled: false,
  });
}

function admittedOrigin(request, mutation) {
  let url;
  try { url = new URL(request?.url); } catch { return false; }
  if (url.protocol !== "http:" || !LOOPBACK.has(url.hostname)
    || url.username || url.password || url.search || url.hash) return false;
  const headers = request.headers;
  if (mutation) {
    const origin = headers.get("origin");
    if (!origin || origin !== url.origin) return false;
    if (headers.get("sec-fetch-site") && headers.get("sec-fetch-site") !== "same-origin") return false;
    if (headers.get("content-type")?.split(";")[0]?.trim().toLowerCase() !== "application/json") return false;
  } else if (headers.get("origin") && headers.get("origin") !== url.origin) return false;
  return true;
}

export async function dispatchSupervisorRequest({
  request, authorize, lifecycle, platform = process.platform,
} = {}) {
  const mutation = request?.method === "POST";
  if (request?.method !== "GET" && !mutation)
    return respond({ code: "METHOD_NOT_ALLOWED" }, 405);
  if (platform !== "win32" || !admittedOrigin(request, mutation))
    return respond({ code: "LOCAL_WINDOWS_ONLY" }, 403);
  // Authentication and (POST only) CSRF + recent Human reauthentication must
  // succeed before even reading local worker state or parsing the action.
  try { await authorize(request, mutation); }
  catch { return respond({ code: "PROFILE_SESSION_REQUIRED" }, 403); }
  if (!mutation) {
    try {
      const status = await lifecycle.status();
      return respond({ version: 1, capability: "factory.supervisor.status",
        ...summarizeSupervisorForGui(status) });
    } catch { return respond({ code: "SUPERVISOR_STATE_UNAVAILABLE" }, 503); }
  }

  const length = Number(request.headers.get("content-length") || "0");
  if (!Number.isFinite(length) || length < 0 || length > 256)
    return respond({ code: "ACTION_INVALID" }, 400);
  let body;
  try { body = await request.json(); } catch { return respond({ code: "ACTION_INVALID" }, 400); }
  if (!body || typeof body !== "object" || Array.isArray(body)
    || Object.keys(body).length !== 1 || !["pause", "resume"].includes(body.action))
    return respond({ code: "ACTION_NOT_AUTHORIZED" }, 400);
  try {
    const result = body.action === "pause"
      ? await lifecycle.pause() : await lifecycle.resume();
    if (result?.state !== (body.action === "pause" ? "PAUSE_REQUESTED" : "RESUME_REQUESTED"))
      return respond({ code: "LIFECYCLE_RECEIPT_UNVERIFIED" }, 409);
    const status = await lifecycle.status();
    return respond({ version: 1, capability: "factory.supervisor." + body.action,
      requested: true, acknowledged: body.action === "pause"
        && status.state === "PAUSED" && status.pauseAcknowledged === true,
      ...summarizeSupervisorForGui(status) });
  } catch {
    return respond({ code: "LIFECYCLE_OPERATION_BLOCKED" }, 409);
  }
}
