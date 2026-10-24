import { conversationStatus, startConversationTest } from "./conversation-service.mjs";
import { gatewayAppSource, privateGatewayRoot } from "./gateway-host.mjs";

const json = (value, status = 200) => Response.json(value, {
  status, headers: { "Cache-Control": "no-store", "Referrer-Policy": "no-referrer",
    "X-Content-Type-Options": "nosniff" },
});
export async function dispatchConversationRequest({ request, authorize,
  source = gatewayAppSource, root = privateGatewayRoot(), platform = process.platform,
} = {}) {
  const mutation = request?.method === "POST";
  if (request?.method !== "GET" && !mutation) return json({ code: "METHOD_NOT_ALLOWED" }, 405);
  let url;
  try { url = new URL(request.url); } catch { return json({ code: "LOCAL_WINDOWS_ONLY" }, 403); }
  const origin = request.headers.get("origin");
  if (platform !== "win32" || url.protocol !== "http:" ||
      !["127.0.0.1", "localhost", "[::1]"].includes(url.hostname) ||
      url.pathname !== "/api/factory/conversation" || url.search || url.hash ||
      url.username || url.password || (origin && origin !== url.origin) ||
      (mutation && (origin !== url.origin ||
        (request.headers.get("sec-fetch-site") && request.headers.get("sec-fetch-site") !== "same-origin") ||
        request.headers.get("content-type")?.split(";")[0].trim().toLowerCase() !== "application/json")))
    return json({ code: "LOCAL_WINDOWS_ONLY" }, 403);
  try { await authorize(request, mutation); }
  catch { return json({ code: "PROFILE_SESSION_REQUIRED" }, 403); }
  const identity = await source();
  if (!identity) return json({ code: "GATEWAY_SOURCE_UNVERIFIED" }, 409);
  if (!mutation) return json(await conversationStatus({ root, source: identity }));
  let body;
  try {
    const text = await request.text();
    if (Buffer.byteLength(text, "utf8") > 128) return json({ code: "ACTION_INVALID" }, 400);
    body = JSON.parse(text);
  } catch { return json({ code: "ACTION_INVALID" }, 400); }
  if (!body || typeof body !== "object" || Array.isArray(body) ||
      Object.keys(body).length !== 2 || body.action !== "test" ||
      typeof body.requestId !== "string" || !/^[a-f0-9]{32}$/.test(body.requestId))
    return json({ code: "ACTION_NOT_AUTHORIZED" }, 400);
  const result = await startConversationTest({ root, source: identity, requestId: body.requestId });
  return json(result, result.questionId ? 202 : 409);
}
