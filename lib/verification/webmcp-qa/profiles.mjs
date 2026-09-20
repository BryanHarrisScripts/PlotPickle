import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const configUrl = new URL("../../../config/verification/webmcp-qa-profiles.json", import.meta.url);
const parsed = JSON.parse(readFileSync(fileURLToPath(configUrl), "utf8"));

if (parsed?.schemaVersion !== 1 || !Array.isArray(parsed.profiles)) {
  throw new Error("WebMCP QA profile registry requires schemaVersion 1 with profiles[].");
}

const ids = parsed.profiles.map((profile) => String(profile.id || ""));
if (ids.join(",") !== "1,2,3,4,5,6") {
  throw new Error(`WebMCP QA profile registry must define exactly profiles 1 through 6; found ${ids.join(",") || "none"}.`);
}

const byId = new Map(parsed.profiles.map((profile) => [String(profile.id), Object.freeze({
  id: String(profile.id),
  key: String(profile.key || ""),
  label: String(profile.label || ""),
  description: String(profile.description || ""),
  components: Object.freeze((profile.components || []).map(String)),
  capabilities: Object.freeze((profile.capabilities || []).map(String)),
})]));

export const WEBMCP_QA_PROFILE_CONFIG = Object.freeze({
  schemaVersion: 1,
  defaultProfile: String(parsed.defaultProfile || "1"),
  profiles: Object.freeze([...byId.values()]),
});

export const WEBMCP_FULL_QA_ORDER = Object.freeze(["1", "2", "3", "4", "5"]);

export function resolveWebMcpQaProfile(value = WEBMCP_QA_PROFILE_CONFIG.defaultProfile) {
  const normalized = String(value || WEBMCP_QA_PROFILE_CONFIG.defaultProfile).trim().toLowerCase();
  const compact = normalized.replace(/[\s_-]+/gu, "");
  const match = WEBMCP_QA_PROFILE_CONFIG.profiles.find((profile) =>
    profile.id === normalized
    || profile.key.toLowerCase() === normalized
    || profile.label.toLowerCase() === normalized
    || profile.label.toLowerCase().replace(/[\s_-]+/gu, "") === compact,
  );
  if (!match) throw new Error(`Unknown WebMCP QA profile: ${value || "empty"}. Choose 1 through 6.`);
  return match;
}

export function webMcpQaProfileMenuLines() {
  return [
    "WEBMCP QA",
    "",
    ...WEBMCP_QA_PROFILE_CONFIG.profiles.flatMap((profile) => [
      `[${profile.id}] ${profile.label}`,
      `    ${profile.description}`,
      "",
    ]),
  ];
}
