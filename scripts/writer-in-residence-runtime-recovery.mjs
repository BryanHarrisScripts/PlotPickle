import { McpClient } from "./creative-uat/mcp-runtime.mjs";

const nativeFetch = globalThis.fetch.bind(globalThis);

function isWriterChat(input) {
  try {
    const value = typeof input === "string" || input instanceof URL ? String(input) : String(input?.url || "");
    return /\/api\/writing-assistant\/chat(?:$|\?)/.test(value);
  } catch {
    return false;
  }
}

async function responseBody(response) {
  try { return await response.clone().json(); }
  catch { return null; }
}

function usefulWriterText(body) {
  return typeof body?.text === "string" && body.text.trim().length > 0;
}

function retryableEmptyReply(response, body) {
  if (response.ok && !usefulWriterText(body)) return true;
  const message = String(body?.message || body?.error || "");
  return response.status >= 500 && /provider returned no text|no text|empty/i.test(message);
}

function alternateRole(role) {
  return role === "quality" ? "fast" : "quality";
}

// The Writer-in-Residence is intentionally local-only. Real Windows runs showed
// intermittent empty local replies even while Sage/PLAN health was good. Retry the
// same request with the alternate local role, then the preferred role once more.
// This never selects a cloud provider and never changes persisted Settings.
globalThis.fetch = async function plotPickleWriterFetch(input, init = {}) {
  if (!isWriterChat(input) || typeof init?.body !== "string") return nativeFetch(input, init);

  let body;
  try { body = JSON.parse(init.body); } catch { return nativeFetch(input, init); }
  if (body?.provider !== "local" || body?.agentId !== "creative-director") return nativeFetch(input, init);

  const preferred = body.modelRole === "quality" ? "quality" : "fast";
  const roles = [preferred, alternateRole(preferred), preferred];
  let lastResponse = null;

  for (let index = 0; index < roles.length; index += 1) {
    const role = roles[index];
    const response = await nativeFetch(input, {
      ...init,
      body: JSON.stringify({ ...body, provider: "local", modelRole: role }),
    });
    const parsed = await responseBody(response);
    lastResponse = response;
    if (response.ok && usefulWriterText(parsed)) {
      if (index > 0) process.stdout.write(`Writer local recovery ............... PASS  ${preferred} → ${role} on attempt ${index + 1}\n`);
      return response;
    }
    if (!retryableEmptyReply(response, parsed)) return response;
    if (index < roles.length - 1) process.stdout.write(`Writer local recovery ............... RETRY  ${role} returned no usable text\n`);
  }
  return lastResponse;
};

const nativeCall = McpClient.prototype.call;

function normalizeDisclosureLine(line, label) {
  if (!line.toLowerCase().includes(label.toLowerCase())) return line;
  const ref = line.match(/\[ref=([^\]]+)\]/i)?.[1];
  if (!ref) return line;
  return `  - button "${label}" [ref=${ref}]`;
}

function normalizeSettingsDisclosures(text) {
  const labels = [
    "Advanced Setup",
    "Advanced runtime details",
    "Cloud and legacy provider overrides",
  ];
  return String(text || "").split(/\r?\n/).map((line) => {
    for (const label of labels) {
      if (line.toLowerCase().includes(label.toLowerCase()) && /\[ref=[^\]]+\]/i.test(line)) return normalizeDisclosureLine(line, label);
    }
    return line;
  }).join("\n");
}

// Playwright can serialize native <summary> controls with a role shape that the
// writer's deliberately narrow parser does not recognize. Normalize only the three
// known, visible Settings disclosure labels. No hidden DOM/state is exposed.
McpClient.prototype.call = async function plotPickleWriterMcpCall(name, args = {}) {
  const result = await nativeCall.call(this, name, args);
  if (name !== "browser_snapshot" || !Array.isArray(result?.content)) return result;
  return {
    ...result,
    content: result.content.map((item) => item?.type === "text"
      ? { ...item, text: normalizeSettingsDisclosures(item.text) }
      : item),
  };
};
