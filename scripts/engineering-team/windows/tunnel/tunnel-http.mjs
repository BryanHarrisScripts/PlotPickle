// Human opt-in local tunnel startup: not a Factory dispatcher or remote-auth oracle.
const LOOPBACK = new Set(["localhost", "127.0.0.1", "[::1]"]);
const json = (body, status = 200) => Response.json(body, {
  status, headers: { "Cache-Control": "no-store",
    "Referrer-Policy": "no-referrer", "X-Content-Type-Options": "nosniff" },
});

function admittedRequest(request, mutation) {
  if (!request || !URL.canParse(request.url)) return false;
  const url = new URL(request.url);
  if (url.protocol !== "http:" || !LOOPBACK.has(url.hostname) ||
      url.username || url.password || url.search || url.hash ||
      url.pathname !== "/api/factory/tunnel") return false;
  const origin = request.headers.get("origin");
  if (origin && origin !== url.origin) return false;
  if (mutation) {
    if (origin !== url.origin) return false;
    if (request.headers.get("sec-fetch-site") &&
        request.headers.get("sec-fetch-site") !== "same-origin") return false;
    if (request.headers.get("content-type")?.split(";")[0]?.trim().toLowerCase() !== "application/json") return false;
  }
  return true;
}

export async function dispatchTunnelRequest({
  request, authorize, status, start, stop, clearStaleSession, platform = process.platform,
} = {}) {
  const mutation = request?.method === "POST";
  if (request?.method !== "GET" && !mutation)
    return json({ code: "METHOD_NOT_ALLOWED" }, 405);
  if (platform !== "win32" || !admittedRequest(request, mutation))
    return json({ code: "LOCAL_WINDOWS_ONLY" }, 403);
  try { await authorize(request, mutation); }
  catch { return json({ code: "PROFILE_SESSION_REQUIRED" }, 403); }
  if (!mutation) {
    try { return json({ capability: "factory.tunnel.observe", ...await status() }); }
    catch { return json({ code: "TUNNEL_OBSERVATION_UNAVAILABLE" }, 503); }
  }
  const length = Number(request.headers.get("content-length") || "0");
  if (!Number.isFinite(length) || length < 0 || length > 128)
    return json({ code: "ACTION_INVALID" }, 400);
  let body;
  try { body = await request.json(); }
  catch { return json({ code: "ACTION_INVALID" }, 400); }
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return json({ code: "ACTION_NOT_AUTHORIZED" }, 400);
  }
  const startAction = body.action === "start" && Object.keys(body).length === 2 && typeof body.engineering === "boolean";
  const control = body.action === "stop" ? stop : body.action === "clear-stale-session" ? clearStaleSession : null;
  if (!startAction && !(Object.keys(body).length === 1 && typeof control === "function"))
    return json({ code: "ACTION_NOT_AUTHORIZED" }, 400);
  try {
    if (!startAction) {
      const result = await control();
      const expected = body.action === "stop" ? "OWNED_LAUNCHER_STOPPED" : "STALE_SESSION_CLEARED";
      if (result?.state !== expected) return json({ state: "BLOCKED",
        code: result?.code || "TUNNEL_CONTROL_UNVERIFIED", remoteAuthorized: false }, 409);
      return json({ ...result, version: 1, capability: "factory.tunnel." + body.action,
        remoteAuthorized: false }, 200);
    }
    const result = await start({ engineering: body.engineering });
    if (result?.state !== "LAUNCH_REQUESTED") {
      return json({ code: result?.code || "TUNNEL_START_BLOCKED",
        state: "BLOCKED", remoteAuthorized: false }, 409);
    }
    return json({ version: 1, capability: "factory.tunnel.start",
      state: "LAUNCH_REQUESTED", remoteAuthorized: false,
      message: "Complete restricted credential entry in the separate PowerShell window. The launcher, not this GUI, verifies remote authorization." }, 202);
  } catch {
    return json({ code: "TERMINAL_LAUNCH_FAILED", state: "BLOCKED",
      remoteAuthorized: false }, 409);
  }
}
