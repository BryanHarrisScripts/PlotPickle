import type { NavigationAreaId, RootWorkspace } from "./global-shortcuts";

export type SitemapMigrationClass = "canonical" | "contextual" | "public-exception";

export type SitemapShellTarget = {
  readonly migrationClass: Exclude<SitemapMigrationClass, "public-exception">;
  readonly activeShortcutId?: string;
  readonly rootContext: RootWorkspace;
  readonly area: NavigationAreaId;
  readonly contextId?: string;
  readonly contextLabel?: string;
  readonly contextDetail?: string;
  readonly contextScope?: string;
};

export type PublicShellException = {
  readonly path: string;
  readonly label: string;
  readonly reason: "public" | "startup" | "profile";
};

export const PUBLIC_SHELL_EXCEPTIONS: readonly PublicShellException[] = [
  { path: "/welcome", label: "Welcome", reason: "startup" },
  { path: "/start-here", label: "Start Here", reason: "startup" },
  { path: "/about", label: "About", reason: "public" },
  { path: "/legal", label: "Legal", reason: "public" },
  { path: "/suggest-report", label: "Suggest / Report", reason: "public" },
] as const;

export const STATIC_SITEMAP_SHELL_TARGETS: Readonly<Record<string, SitemapShellTarget>> = {
  "/library": {
    migrationClass: "canonical",
    activeShortcutId: "library",
    rootContext: "library",
    area: "home",
  },
  "/afterglow-reconciliation": {
    migrationClass: "contextual",
    activeShortcutId: "dashboard",
    rootContext: "dashboard",
    area: "home",
    contextId: "afterglow-reconciliation",
    contextLabel: "Afterglow Reconciliation",
    contextDetail: "Project recovery and revision reconciliation",
    contextScope: "Project recovery",
  },
  "/core-curriculum": {
    migrationClass: "contextual",
    activeShortcutId: "learn",
    rootContext: "learn",
    area: "create",
    contextId: "core-curriculum",
    contextLabel: "Core Curriculum",
    contextDetail: "81-module learning library",
    contextScope: "Learn",
  },
  "/characters-in-motion": {
    migrationClass: "contextual",
    activeShortcutId: "learn",
    rootContext: "learn",
    area: "create",
    contextId: "characters-in-motion",
    contextLabel: "Characters in Motion",
    contextDetail: "Character craft and visual development",
    contextScope: "Learn",
  },
  "/dialogue-in-motion": {
    migrationClass: "contextual",
    activeShortcutId: "learn",
    rootContext: "learn",
    area: "create",
    contextId: "dialogue-in-motion",
    contextLabel: "Dialogue in Motion",
    contextDetail: "Dialogue craft and scene application",
    contextScope: "Learn",
  },
  "/story-craft-essentials": {
    migrationClass: "contextual",
    activeShortcutId: "learn",
    rootContext: "learn",
    area: "create",
    contextId: "story-craft-essentials",
    contextLabel: "Story Craft Essentials",
    contextDetail: "Core story craft references",
    contextScope: "Learn",
  },
  "/worked-examples": {
    migrationClass: "contextual",
    activeShortcutId: "learn",
    rootContext: "learn",
    area: "create",
    contextId: "worked-examples",
    contextLabel: "Worked Examples",
    contextDetail: "Applied PlotPickle examples",
    contextScope: "Learn",
  },
  "/working-together": {
    migrationClass: "contextual",
    activeShortcutId: "learn",
    rootContext: "learn",
    area: "create",
    contextId: "working-together",
    contextLabel: "Working Together",
    contextDetail: "Collaboration craft and ownership guidance",
    contextScope: "Learn",
  },
  "/structure": {
    migrationClass: "contextual",
    activeShortcutId: "plan",
    rootContext: "plan",
    area: "create",
    contextId: "structure",
    contextLabel: "Structure",
    contextDetail: "Acts, sequences, blocks, scenes and beats",
    contextScope: "Plan",
  },
  "/voiceprint": {
    migrationClass: "contextual",
    activeShortcutId: "plan",
    rootContext: "plan",
    area: "create",
    contextId: "voiceprint",
    contextLabel: "Voiceprint Planner",
    contextDetail: "Plan-owned character voice definitions",
    contextScope: "Plan · Character voice",
  },
  "/storyboard": {
    migrationClass: "canonical",
    activeShortcutId: "storyboard",
    rootContext: "build",
    area: "produce",
  },
  "/previs": {
    migrationClass: "canonical",
    activeShortcutId: "graphic-novel",
    rootContext: "build",
    area: "produce",
  },
  "/pageflow": {
    migrationClass: "canonical",
    activeShortcutId: "write",
    rootContext: "build",
    area: "produce",
    contextId: "pageflow",
    contextLabel: "PageFlow Diagnostics",
    contextDetail: "Refine diagnostic over Write-owned screenplay text",
    contextScope: "Write text · Refine diagnostic",
  },
  "/edit": {
    migrationClass: "canonical",
    activeShortcutId: "edit",
    rootContext: "build",
    area: "produce",
  },
  "/pitch-review": {
    migrationClass: "canonical",
    activeShortcutId: "feedback",
    rootContext: "build",
    area: "review",
  },
  "/diagnostics": {
    migrationClass: "canonical",
    activeShortcutId: "refine",
    rootContext: "build",
    area: "review",
  },
  "/craftloop": {
    migrationClass: "contextual",
    activeShortcutId: "refine",
    rootContext: "build",
    area: "review",
    contextId: "craftloop",
    contextLabel: "CraftLoop",
    contextDetail: "Specialist story refinement loop",
    contextScope: "Refine",
  },
  "/draftlens": {
    migrationClass: "contextual",
    activeShortcutId: "refine",
    rootContext: "build",
    area: "review",
    contextId: "draftlens",
    contextLabel: "DraftLens",
    contextDetail: "Draft-focused diagnostic evidence",
    contextScope: "Refine",
  },
  "/resonance": {
    migrationClass: "contextual",
    activeShortcutId: "refine",
    rootContext: "build",
    area: "review",
    contextId: "resonance",
    contextLabel: "Resonance",
    contextDetail: "Story resonance and audience-effect diagnostics",
    contextScope: "Refine",
  },
  "/screenplay-readiness": {
    migrationClass: "contextual",
    activeShortcutId: "refine",
    rootContext: "build",
    area: "review",
    contextId: "screenplay-readiness",
    contextLabel: "Screenplay Readiness",
    contextDetail: "Canonical screenplay readiness evidence",
    contextScope: "Refine",
  },
  "/production": {
    migrationClass: "canonical",
    activeShortcutId: "reports",
    rootContext: "build",
    area: "review",
  },
  "/git": {
    migrationClass: "contextual",
    activeShortcutId: "git",
    rootContext: "dashboard",
    area: "connect",
    contextId: "git",
    contextLabel: "Native Git",
    contextDetail: "Project revisions, branches and collaboration proposals",
    contextScope: "Collaboration",
  },
  "/buzz": {
    migrationClass: "contextual",
    activeShortcutId: "buzz",
    rootContext: "dashboard",
    area: "connect",
    contextId: "buzz",
    contextLabel: "BUZZ Story Room",
    contextDetail: "Compatibility launch into PlotPickle collaboration",
    contextScope: "Collaboration · BUZZ",
  },
  "/ai-routing": {
    migrationClass: "contextual",
    activeShortcutId: "settings",
    rootContext: "settings",
    area: "settings",
    contextId: "ai-routing",
    contextLabel: "AI Routing",
    contextDetail: "Provider and model routing configuration",
    contextScope: "Settings",
  },
  "/settings/buzz": {
    migrationClass: "contextual",
    activeShortcutId: "settings",
    rootContext: "settings",
    area: "settings",
    contextId: "buzz-settings",
    contextLabel: "BUZZ Settings",
    contextDetail: "BUZZ installation and connection configuration",
    contextScope: "Settings",
  },
} as const;

const LAB_SCOPES = {
  plan: { activeShortcutId: "plan", rootContext: "plan", area: "create", contextScope: "Plan · Specialist Lab" },
  storyboard: { activeShortcutId: "storyboard", rootContext: "build", area: "produce", contextScope: "Storyboard · Specialist Lab" },
  feedback: { activeShortcutId: "feedback", rootContext: "build", area: "review", contextScope: "Feedback · Specialist Lab" },
  refine: { activeShortcutId: "refine", rootContext: "build", area: "review", contextScope: "Refine · Specialist Lab" },
} as const satisfies Readonly<Record<string, Pick<SitemapShellTarget, "activeShortcutId" | "rootContext" | "area" | "contextScope">>>;

export function sitemapShellTarget(pathname: string, search: string | URLSearchParams = "") {
  if (pathname === "/labs") {
    const params = typeof search === "string" ? new URLSearchParams(search) : search;
    const requestedScope = params.get("scope") || params.get("return") || "refine";
    const scope = LAB_SCOPES[requestedScope as keyof typeof LAB_SCOPES] ?? LAB_SCOPES.refine;
    return {
      migrationClass: "contextual",
      ...scope,
      contextId: "labs",
      contextLabel: "Specialist Labs",
      contextDetail: "Contextual specialist tools without a second owner",
    } satisfies SitemapShellTarget;
  }
  return STATIC_SITEMAP_SHELL_TARGETS[pathname] ?? null;
}

export function publicShellException(pathname: string) {
  return PUBLIC_SHELL_EXCEPTIONS.find((entry) => entry.path === pathname) ?? null;
}
