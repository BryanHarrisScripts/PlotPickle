import { spawn } from "node:child_process";

export function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function resultText(result) {
  return Array.isArray(result?.content)
    ? result.content.filter((item) => item?.type === "text").map((item) => item.text || "").join("\n")
    : "";
}

export function slug(value) {
  return String(value).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function extractRef(snapshot, label, roles = ["button", "link", "tab", "textbox", "combobox", "spinbutton"]) {
  const lines = String(snapshot || "").split(/\r?\n/);
  const rolePart = roles.map(escapeRegex).join("|");
  const roleToken = new RegExp(`\\b(?:${rolePart})\\b`, "i");
  const exact = new RegExp(`\\b(?:${rolePart})\\s+["']${escapeRegex(label)}["']`, "i");
  const roleCandidates = lines.filter((item) => roleToken.test(item) && item.toLowerCase().includes(String(label).toLowerCase()));
  for (const line of [...lines.filter((item) => exact.test(item)), ...roleCandidates]) {
    const match = line.match(/\[ref=([^\]]+)\]/i) || line.match(/\bref[=:]\s*([A-Za-z0-9_-]+)/i);
    if (match) return match[1];
  }
  return "";
}

function firstJsonObject(text) {
  const raw = String(text || "");
  for (let start = raw.indexOf("{"); start >= 0; start = raw.indexOf("{", start + 1)) {
    let depth = 0;
    let inString = false;
    let escaped = false;
    for (let index = start; index < raw.length; index += 1) {
      const char = raw[index];
      if (inString) {
        if (escaped) escaped = false;
        else if (char === "\\") escaped = true;
        else if (char === '"') inString = false;
        continue;
      }
      if (char === '"') { inString = true; continue; }
      if (char === "{") depth += 1;
      else if (char === "}" && --depth === 0) {
        try { return JSON.parse(raw.slice(start, index + 1)); } catch { break; }
      }
    }
  }
  return null;
}

export function extractPageState(text) {
  const raw = String(text || "");
  const marker = "### Result";
  const index = raw.indexOf(marker);
  const section = index >= 0 ? raw.slice(index + marker.length).split(/\r?\n###\s/)[0] : raw;
  return firstJsonObject(section) || firstJsonObject(raw) || {};
}

export function consoleHasErrors(text) {
  const raw = String(text || "").trim();
  if (!raw) return false;
  const count = raw.match(/\bErrors:\s*(\d+)\b/i);
  if (count) return Number(count[1]) > 0;
  if (/Returning\s+0\s+messages\s+for\s+level\s+["']?error["']?/i.test(raw)) return false;
  return /(?:^|\n)\s*(?:\[?error\]?\s*[:\-]?|Error:|Uncaught\b|Unhandled\b)/im.test(raw);
}

export class McpToolArgumentError extends Error {
  constructor(toolName, missing) {
    super(`${toolName || "MCP tool"} is missing required argument(s): ${missing.join(", ")}.`);
    this.name = "McpToolArgumentError";
    this.code = "PLOTPICKLE_MCP_ARGUMENT_ERROR";
    this.toolName = toolName || "";
    this.missing = [...missing];
  }
}

export function isMcpToolArgumentError(error) {
  return Boolean(error && (error.code === "PLOTPICKLE_MCP_ARGUMENT_ERROR" || error.name === "McpToolArgumentError"));
}

function hasConcreteRequiredValue(value, property = {}) {
  if (value === undefined || value === null) return false;
  if (property?.type === "string" && String(value).trim() === "") return false;
  return true;
}

function requiredScreenshotScale(tool, properties, required, normalized) {
  if (tool?.name !== "browser_take_screenshot" || !required.has("scale") || !("scale" in properties) || "scale" in normalized) return undefined;
  const property = properties.scale || {};
  if (property.default !== undefined) return property.default;
  const allowed = Array.isArray(property.enum) ? property.enum : [];
  return !allowed.length || allowed.includes("css") ? "css" : undefined;
}

export function toolArguments(tool, values) {
  const schema = tool?.inputSchema || {};
  const properties = schema.properties || {};
  const required = new Set(Array.isArray(schema.required) ? schema.required : []);
  const normalized = { ...values };
  if (
    !("target" in normalized)
    && normalized.ref !== undefined
    && "target" in properties
    && (required.has("target") || !("ref" in properties))
  ) {
    normalized.target = normalized.ref;
  }
  const screenshotScale = requiredScreenshotScale(tool, properties, required, normalized);
  if (screenshotScale !== undefined) normalized.scale = screenshotScale;
  const output = Object.fromEntries(Object.entries(normalized).filter(([key, value]) => value !== undefined && key in properties));
  const missing = [...required].filter((key) => !hasConcreteRequiredValue(output[key], properties[key]));
  if (missing.length) throw new McpToolArgumentError(tool?.name || "MCP tool", missing);
  return output;
}

export class McpClient {
  constructor(command, args, options = {}) {
    this.nextId = 1;
    this.pending = new Map();
    this.buffer = "";
    this.stderr = "";
    this.trace = [];
    this.child = spawn(command, args, {
      cwd: options.cwd,
      env: { ...process.env, ...(options.env || {}) },
      stdio: ["pipe", "pipe", "pipe"],
      windowsHide: true,
    });
    this.child.stdout.setEncoding("utf8");
    this.child.stderr.setEncoding("utf8");
    this.child.stdout.on("data", (chunk) => this.onStdout(chunk));
    this.child.stderr.on("data", (chunk) => { this.stderr += chunk; });
    this.child.once("error", (error) => this.rejectAll(error));
    this.child.once("exit", (code) => {
      if (code !== 0 && this.pending.size) this.rejectAll(new Error(`Playwright MCP exited with code ${code}.`));
    });
  }

  onStdout(chunk) {
    this.buffer += chunk;
    let newline;
    while ((newline = this.buffer.indexOf("\n")) >= 0) {
      const line = this.buffer.slice(0, newline).trim();
      this.buffer = this.buffer.slice(newline + 1);
      if (!line.startsWith("{")) continue;
      try {
        const message = JSON.parse(line);
        this.trace.push(message);
        if (message.id && this.pending.has(message.id)) {
          const pending = this.pending.get(message.id);
          this.pending.delete(message.id);
          clearTimeout(pending.timer);
          if (message.error) pending.reject(new Error(message.error.message || JSON.stringify(message.error)));
          else pending.resolve(message.result);
        }
      } catch {}
    }
  }

  rejectAll(error) {
    for (const pending of this.pending.values()) {
      clearTimeout(pending.timer);
      pending.reject(error);
    }
    this.pending.clear();
  }

  request(method, params = {}, timeoutMs = 120000) {
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => { this.pending.delete(id); reject(new Error(`MCP request timed out: ${method}`)); }, timeoutMs);
      this.pending.set(id, { resolve, reject, timer });
      this.trace.push({ direction: "out", jsonrpc: "2.0", id, method, params });
      this.child.stdin.write(`${JSON.stringify({ jsonrpc: "2.0", id, method, params })}\n`);
    });
  }

  async initialize() {
    const result = await this.request("initialize", { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "plotpickle-creative-writer-uat", version: "1.0.0" } });
    this.child.stdin.write(`${JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized", params: {} })}\n`);
    return result;
  }

  async tools() {
    const result = await this.request("tools/list");
    return Array.isArray(result?.tools) ? result.tools : [];
  }

  async call(name, args = {}) {
    const result = await this.request("tools/call", { name, arguments: args });
    if (result?.isError) throw new Error(resultText(result) || `${name} failed.`);
    return result;
  }

  async close() {
    try { this.child.stdin.end(); } catch {}
    await delay(100);
    if (this.child.exitCode === null) this.child.kill();
  }
}
