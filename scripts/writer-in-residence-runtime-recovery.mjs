import { McpClient } from "./creative-uat/mcp-runtime.mjs";
import { bestEffortLiveBuzzActivity } from "./buzz-live-activity.mjs";
import { normalizeWriterSnapshot } from "./writer-snapshot-normalizer.mjs";

const nativeFetch = globalThis.fetch.bind(globalThis);

function requestUrl(input) {
  const value = typeof input === "string" || input instanceof URL ? input : input?.url;
  return typeof value === "string" || value instanceof URL ? String(value) : "";
}

function isWriterChat(input) {
  return /\/api\/writing-assistant\/chat(?:$|\?)/.test(requestUrl(input));
}

function responseBody(response) {
  return response.clone().json().then(
    (body) => body,
    () => null,
  );
}

function usefulWriterText(body) {
  return typeof body?.text === "string" && body.text.trim().length > 0;
}

function retryableEmptyReply(response, body) {
  if (response.ok && !usefulWriterText(body)) return true;
  const message = String(body?.message || body?.error || "");
  return !response.ok && /provider returned no text|selected text provider returned no text|no usable text|empty (?:reply|response)/i.test(message);
}

function retryableFetchError(error) {
  if (error instanceof DOMException && (error.name === "AbortError" || error.name === "TimeoutError")) return true;
  const message = error instanceof Error ? error.message : String(error || "");
  return /fetch failed|ECONNRESET|ECONNREFUSED|socket hang up|terminated|timeout/i.test(message);
}

function alternateRole(role) {
  return role === "quality" ? "fast" : "quality";
}

function writerAttemptSignal(role) {
  return AbortSignal.timeout(role === "quality" ? 65_000 : 40_000);
}

function mirrorAveryTurn(role, attempt) {
  void bestEffortLiveBuzzActivity({
    type: "writer.feedback",
    actorId: "avery-north",
    summary: `Avery completed a Writer-in-Residence decision turn using the ${role} local model${attempt > 1 ? ` after ${attempt} attempts` : ""}.`,
    severity: "info",
    target: "writer-in-residence",
    verified: false,
    actionable: false,
  });
}

globalThis.fetch = async function plotPickleWriterFetch(input, init = {}) {
  if (!isWriterChat(input) || typeof init?.body !== "string") return nativeFetch(input, init);

  let body;
  try { body = JSON.parse(init.body); } catch { return nativeFetch(input, init); }
  if (body?.provider !== "local" || body?.agentId !== "creative-director") return nativeFetch(input, init);

  const preferred = body.modelRole === "quality" ? "quality" : "fast";
  const roles = [preferred, alternateRole(preferred), preferred, alternateRole(preferred)];
  let lastResponse = null;

  for (let index = 0; index < roles.length; index += 1) {
    const role = roles[index];
    let response;
    try {
      response = await nativeFetch(input, {
        ...init,
        signal: writerAttemptSignal(role),
        body: JSON.stringify({ ...body, provider: "local", modelRole: role }),
      });
    } catch (error) {
      if (!retryableFetchError(error) || index >= roles.length - 1) throw error;
      process.stdout.write(`Writer local recovery ............... RETRY  ${role} transport failed; trying ${roles[index + 1]}\n`);
      continue;
    }

    const parsed = await responseBody(response);
    lastResponse = response;
    if (response.ok && usefulWriterText(parsed)) {
      if (index > 0) process.stdout.write(`Writer local recovery ............... PASS  ${preferred} → ${role} on attempt ${index + 1}\n`);
      mirrorAveryTurn(role, index + 1);
      return response;
    }
    if (!retryableEmptyReply(response, parsed)) return response;
    if (index < roles.length - 1) process.stdout.write(`Writer local recovery ............... RETRY  ${role} returned no usable text; trying ${roles[index + 1]}\n`);
  }
  return lastResponse;
};

const nativeCall = McpClient.prototype.call;

// Normalize only visible accessibility snapshot labels. Avery still operates on
// rendered UI rather than hidden DOM/state; this wrapper exposes no storage data.
McpClient.prototype.call = async function plotPickleWriterMcpCall(name, args = {}) {
  const result = await nativeCall.call(this, name, args);
  if (name !== "browser_snapshot" || !Array.isArray(result?.content)) return result;
  return {
    ...result,
    content: result.content.map((item) => item?.type === "text"
      ? { ...item, text: normalizeWriterSnapshot(item.text) }
      : item),
  };
};
