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
    pauseAcknowledged: state === "PAUSED" && result?.pauseAcknowledged === true,
    inFlightCancellationProven: false,
    workerProcessVerified: false,
    autonomousCodingVerified: false,
    automaticMergeEnabled: false,
  });
}

function admittedOrigin(request, mutation) {
  if (typeof request?.url !== "string" || !URL.canParse(request.url)) return false;
  const url = new URL(request.url);
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
    || Object.keys(body).length !== 1 || !["pause", "resume", "stop"].includes(body.action))
    return respond({ code: "ACTION_NOT_AUTHORIZED" }, 400);
  try {
    // STOP is the already-reviewed local kill-switch request. Unlike process
    // termination, its receipt cannot establish child/descendant cleanup.
    // It remains admissible if the previous pairing became unreachable.
    const result = body.action === "pause" ? await lifecycle.pause()
      : body.action === "resume" ? await lifecycle.resume()
        : await lifecycle.stop();
    const expected = body.action === "pause" ? "PAUSE_REQUESTED"
      : body.action === "resume" ? "RESUME_REQUESTED" : "STOP_REQUESTED";
    if (result?.state !== expected)
      return respond({ code: "LIFECYCLE_RECEIPT_UNVERIFIED" }, 409);
    // A completed STOP request is not a verified stopped process or released port.
    // Do not call status again for STOP: its heartbeat might still be RUNNING.
    if (body.action === "stop") return respond({
      version: 1, capability: "factory.supervisor.stop",
      requested: true, acknowledged: false, stopDisposition: "STOP_REQUESTED_UNCONFIRMED",
      ownedDescendantsVerifiedGone: false,
      ...summarizeSupervisorForGui({ state: "STOP_REQUESTED", reason: "LOCAL_KILL_SWITCH" }),
    });
    let status;
    try { status = await lifecycle.status(); }
    catch {
      // Local PAUSE/RESUME may already have changed state. Do not tell the
      // Human it failed and invite an unsafe duplicate submission.
      return respond({ code: "ACTION_SUBMITTED_STATUS_UNVERIFIED",
        requested: true, workerProcessVerified: false,
        inFlightCancellationProven: false, automaticMergeEnabled: false }, 409);
    }
    const bounded = summarizeSupervisorForGui(status);
    return respond({ version: 1, capability: "factory.supervisor." + body.action,
      requested: true, acknowledged: body.action === "pause" && bounded.pauseAcknowledged,
      ...bounded });
  } catch {
    return respond({ code: "LIFECYCLE_OPERATION_BLOCKED" }, 409);
  }
}
