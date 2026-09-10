import {
  WEBMCP_ALLOWED_TARGETS,
  WEBMCP_FORBIDDEN_CAPABILITIES,
  WEBMCP_TOOL_NAMES,
} from "./webmcp-surface-visual-audit.mjs";

const PURPOSES = Object.freeze({
  get_current_surface: "Read the currently rendered PlotPickle surface.",
  list_available_surfaces: "List bounded surfaces and visible navigation choices available to UAT.",
  open_surface: "Open one bounded surface through the existing visible interface path.",
  go_back: "Return through the existing visible Skin V1 navigation path.",
  inspect_surface_visual_contract: "Read rendered Skin V1 tokens and computed presentation state without mutating product data.",
});

export const WEBMCP_UAT_SKILL_POLICY = Object.freeze({
  role: "independent-verifier",
  executor: "webmcp-surface-visual-audit",
  authority: "read-navigation-visual-only",
  allowedTargets: WEBMCP_ALLOWED_TARGETS,
  forbiddenCapabilities: WEBMCP_FORBIDDEN_CAPABILITIES,
  canonicalScreenshotSurface: "dashboard",
  mayFixCode: false,
  mayMergeCode: false,
  mayPublishToBuzz: false,
  mayMutateCanon: false,
  mayReadCredentials: false,
  mayInvokeProviders: false,
});

export const WEBMCP_UAT_SKILLS = Object.freeze(
  WEBMCP_TOOL_NAMES.map((name) => Object.freeze({
    name,
    purpose: PURPOSES[name],
    executor: "document.modelContext",
    authority: "bounded-uat",
  })),
);

export function listWebMcpUatSkills() {
  return WEBMCP_UAT_SKILLS.map((skill) => ({ ...skill }));
}
