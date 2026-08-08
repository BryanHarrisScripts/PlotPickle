export const PLOTPICKLE_REPOSITORY_URL = "https://github.com/BryanHarrisScripts/PlotPickle";
export const LEARNING_MODULE_COUNT = 81;

export const PLOTPICKLE_POSITIONING = {
  category: "AI-native visual writing and creative direction studio",
  hero: "Shape the story. See the world. Direct what comes next.",
  summary:
    "PlotPickle lets writers shape words, images and cinematic possibilities as one connected storyworld. Begin with a concept, explore and compare directions, refine the material, approve what belongs, and reuse those decisions across Plan, Write, Edit, Storyboard and Graphic Novel without giving up local canon control.",
  ppf:
    "PPF is the portable creative source of truth that keeps structure, canon, screenplay material, visual decisions, production assets, approvals and provenance connected. The canonical local project folder remains authoritative while .ppf packages carry that same project model for exchange.",
  boundary:
    "PlotPickle develops, visualizes and presents the storyworld before full production. External AI, rendering, repository, scheduling and Buzz services are optional extensions; PlotPickle does not require them or replace a studio production and finishing pipeline.",
} as const;

export const AI_NATIVE_VISUAL_WRITING = {
  programmeIssue: 382,
  foundationIssue: 383,
  thesis:
    "PlotPickle is a visual writing studio where the writer directs words, images and cinematic possibilities as one connected body of creative material.",
  writerRole:
    "The writer supplies concepts, references, intention and constraints; evaluates possibilities; directs revisions; and decides what becomes canon.",
  aiRole:
    "AI provides responsive creative material. It does not provide authorship, automatic approval or silent changes to story canon.",
  visualWritingRule:
    "Character studies, locations, scenes, panels and shot sequences are part of writing because visual discoveries can reveal and reshape the story before production.",
  canonRule:
    "Generated and imported possibilities remain candidates until a person explicitly approves them for the selected story target.",
  routingRule:
    "Creative workspaces expose intent and direction; provider, model, endpoint, workflow and billing configuration remain in Settings.",
} as const;

export const CREATIVE_DIRECTION_LOOP = [
  { id: "concept", label: "Concept", purpose: "Capture the idea, references, emotional purpose, constraints and open creative space." },
  { id: "explore", label: "Explore", purpose: "Create or import multiple connected possibilities without changing canon." },
  { id: "compare", label: "Compare", purpose: "Judge candidates side by side and identify qualities worth carrying forward." },
  { id: "direct", label: "Direct", purpose: "State what to keep, what to change and what new direction to try." },
  { id: "refine", label: "Refine", purpose: "Develop a selected direction while preserving lineage and continuity." },
  { id: "approve", label: "Approve", purpose: "Make a deliberate human decision about what belongs to the storyworld." },
  { id: "reuse", label: "Reuse", purpose: "Carry approved visual and narrative decisions into later connected work." },
] as const;

export const CREATIVE_DIRECTION_ACTIONS = [
  "Keep",
  "Change",
  "Try",
  "Compare",
  "Combine",
  "Approve",
] as const;

export const VISUAL_CANON_CATEGORIES = [
  "character-identity",
  "location",
  "prop",
  "wardrobe",
  "palette",
  "style",
  "composition",
] as const;

export const STORYWORLD_CORE_LOOP = [
  { id: "ppf", status: "available", statusLabel: "Available now", title: "PPF storyworld", summary: "Portable canon, structure, screenplay material, visuals, approvals and provenance remain connected." },
  { id: "storyworld-map", status: "available", statusLabel: "Available now", title: "Interactive Storyworld Map", summary: "See 24 Blocks and 96 mini-blocks with relationships, hooks, turns, arcs, causality and continuity." },
  { id: "visual-development", status: "available", statusLabel: "Available now", title: "Graphic Novel + Storyboard", summary: "Carry approved characters, locations and visual language through panels and frames." },
  { id: "production-preview", status: "available", statusLabel: "Available now", title: "Production Shots + Animatic", summary: "Direct shots, timing, keyframes and sound, then play the visual material already attached to the project." },
  { id: "greenlight-evidence", status: "available", statusLabel: "Available now", title: "Pitch + Reports", summary: "Present story logic, visual direction, continuity, readiness and unresolved decisions for review." },
  { id: "collaboration", status: "available", statusLabel: "Optional connections", title: "Collab + Buzz", summary: "Use GitHub proposals and approvals in Collab, then add optional Buzz rooms, agents and development discussion only after Settings configuration." },
] as const;

export const STORYWORLD_PROTOTYPE_LOOP = STORYWORLD_CORE_LOOP;

export const PLOTPICKLE_DESKTOP_BUILDS = [
  { id: "windows", platform: "Windows", archive: "PlotPickle-Windows.zip", launcher: "Start-PlotPickle.bat", detail: "Guided local launcher with repair and update tools." },
  { id: "macos", platform: "macOS", archive: "PlotPickle-macOS.zip", launcher: "Start-PlotPickle.command", detail: "A complete local-server package for Apple computers." },
  { id: "linux", platform: "Linux", archive: "PlotPickle-Linux.zip", launcher: "start-plotpickle.sh", detail: "A portable local-server package with a shell launcher." },
] as const;

export const OPEN_SOURCE_FOUNDATIONS = [
  { label: "Software", title: "GNU AGPLv3 or later", summary: "Study, modify, share and self-host the PlotPickle software while preserving the licence and source-code obligations." },
  { label: "Method and documentation", title: "Creative Commons BY-SA 4.0", summary: "The 24 Blocks method and reusable learning material remain open with attribution to Bryan Elgin Harris and share-alike terms." },
  { label: "Your creative work", title: "Your story remains yours", summary: "Using PlotPickle does not transfer ownership of your screenplay, characters, images, notes or exported project files." },
  { label: "Open platform", title: "Portable projects, plugins and SDK", summary: "Human-readable project data, portable .ppf exchange packages and permission-controlled extensions reduce lock-in." },
] as const;

export const PRIMARY_WORKFLOW_NAVIGATION = [
  { id: "dashboard", label: "Dashboard", description: "Projects, collaboration and storage", zone: "discovery" },
  { id: "learn", label: "Learn", description: "Study the craft, introduction and terminology", zone: "discovery" },
  { id: "planner", label: "Plan", description: "Simple Start and story planning", zone: "discovery" },
  { id: "visuals", label: "Storyboard", description: "See and preserve the film", zone: "discovery" },
  { id: "script", label: "Write", description: "Outline and write", zone: "discovery" },
  { id: "edit", label: "Edit", description: "Review and improve the canonical screenplay", zone: "discovery" },
  { id: "pitch", label: "Graphic Novel", description: "Generate and review the complete Graphic Novel package", zone: "discovery" },
  { id: "build", label: "Build", description: "Arrange 24 Blocks and 96 mini-blocks", zone: "production" },
  { id: "feedback", label: "Feedback", description: "Review notes, proposals and decisions", zone: "production" },
  { id: "engines", label: "Refine", description: "Refine the story", zone: "production" },
  { id: "reports", label: "Reports", description: "Understand the screenplay", zone: "production" },
] as const;

export const COLLABORATION_NAVIGATION = [
  { id: "collab", label: "Collab", description: "Approvals, meetings, calendar and connected collaborators", zone: "collaboration" },
  { id: "community", label: "Community", description: "Manage the hosted Buzz community and open it in Buzz Desktop", zone: "collaboration" },
] as const;

export const PRODUCT_NAVIGATION = [
  ...PRIMARY_WORKFLOW_NAVIGATION,
  ...COLLABORATION_NAVIGATION,
  { id: "settings", label: "Settings", description: "Workspace, integrations, storage and security", zone: "configuration" },
] as const;

export type PrimaryWorkflowNavigationId = (typeof PRIMARY_WORKFLOW_NAVIGATION)[number]["id"];
export type ProductNavigationId = (typeof PRODUCT_NAVIGATION)[number]["id"] | "instructions";
export type ApplicationShellZone = "discovery" | "production" | "collaboration" | "project-actions" | "configuration";

export const TARGET_CREATIVE_WORKFLOW = PRIMARY_WORKFLOW_NAVIGATION.map((item) => item.label);

export const PROJECT_ACTIONS = [
  { id: "new-project", label: "New Project" },
  { id: "import", label: "Import" },
  { id: "export", label: "Export" },
  { id: "load-afterglow", label: "Load Example" },
] as const;

export const APPLICATION_SHELL_ZONES = [
  { id: "discovery", label: "Discovery & Pre-Production", items: PRIMARY_WORKFLOW_NAVIGATION.filter((item) => item.zone === "discovery").map((item) => item.label) },
  { id: "production", label: "Production & Polishing", items: PRIMARY_WORKFLOW_NAVIGATION.filter((item) => item.zone === "production").map((item) => item.label) },
  { id: "collaboration", label: "Collaboration", items: COLLABORATION_NAVIGATION.map((item) => item.label) },
  { id: "project-actions", label: "Project actions", items: PROJECT_ACTIONS.map((action) => action.label) },
  { id: "configuration", label: "Application configuration", items: ["Settings"] },
] as const;

export const PRODUCT_COMPONENTS = [
  { id: "learn", label: "Learn", title: "Learn the craft", summary: "Use the 81-module learning system and contextual guidance without leaving the active project.", icon: "/brand/components/learn.svg" },
  { id: "plan", label: "Plan", title: "Plan the whole story", summary: "Shape the story through four acts, twelve sequences, twenty-four blocks and ninety-six mini-blocks.", icon: "/brand/components/plan.svg" },
  { id: "write", label: "Write", title: "Write the screenplay", summary: "Move from treatment to a complete screenplay with connected scenes, dialogue and revisions.", icon: "/brand/components/write.svg" },
  { id: "storyboard", label: "Storyboard", title: "See the film", summary: "Carry approved characters, locations and visual continuity through every storyboard position.", icon: "/brand/components/storyboard.svg" },
  { id: "refine", label: "Refine", title: "Refine with purpose", summary: "Use specialist engines, reports and review evidence to improve the story without losing authorship.", icon: "/brand/components/refine.svg" },
] as const;

export const SIMPLE_START = {
  label: "Simple Start",
  destination: "Story Planner",
  purpose: "A deliberate beginner pathway inside the core application, not a required splash screen.",
  returningWriterRule: "Returning writers must be able to open the main workspace in one action.",
} as const;

export const FIVE_KEY_SELLING_POINTS = [
  { id: "complete-studio", title: "Visual storyworld in one PPF", summary: "Keep canon, characters, structure, screenplay material, visuals, shots, sound and provenance connected in one portable creative source of truth." },
  { id: "learning-system", title: "Story logic you can see", moduleCount: LEARNING_MODULE_COUNT, summary: "Use 24 Blocks, 96 mini-blocks and the 81-module learning system to expose hooks, turning points, causality, arcs and continuity." },
  { id: "visual-continuity", title: "Connected visual development", summary: "Carry approved character identities, world references, Graphic Novel panels, storyboard frames and Production Shots through one visual language." },
  { id: "local-first", title: "A clearer case for the movie", summary: "Bring the Storyworld Map, screenplay, Graphic Novel, Storyboard, Production Shots, Animatic, Pitch and Reports together as persuasive previsualization evidence." },
  { id: "distributed-collaboration", title: "Local-first ownership with optional connections", summary: "Keep control of projects, files, canon and approvals while using AI, GitHub, Google, Buzz or future media engines only when deliberately chosen." },
] as const;

export const COLLABORATION_ROLES = ["Writer", "Director", "Producer", "Actor", "Reviewer"] as const;
export type CollaborationRole = (typeof COLLABORATION_ROLES)[number];

export const PLOTPICKLE_SERVER_MODEL = {
  principle: "Every participant uses the same complete PlotPickle product.",
  installations: ["Local PlotPickle server", "Private web-based PlotPickle server"],
  roleRule: "Writer, Director, Producer, Actor and Reviewer are roles within PlotPickle, not separate server editions.",
  canonicalRule: "The repository owner or maintainer decides what becomes canonical through reviewed merges.",
  localRule: "Local work remains local until the user explicitly proposes, publishes or synchronizes it.",
} as const;

export const STORAGE_STATUS_DEFINITIONS = [
  { id: "local-only", label: "Local only", severity: "attention", explanation: "The canonical project is stored on this device and has not been verified in GitHub or an exported backup." },
  { id: "local-with-assets", label: "Local project and local images", severity: "attention", explanation: "The project file and visual assets are stored locally; both need backup protection before an upgrade or device failure." },
  { id: "connected-unpublished", label: "Connected to GitHub — unpublished changes", severity: "review", explanation: "A repository connection exists, but current project or asset changes have not been verified on the remote repository." },
  { id: "synchronized", label: "Synchronized with GitHub", severity: "clear", explanation: "The active local revision matches the verified repository revision." },
  { id: "pull-required", label: "Remote changes available", severity: "review", explanation: "A newer repository revision is available and must be reviewed before contributing or replacing local work." },
  { id: "conflict-review", label: "Conflict or review required", severity: "blocked", explanation: "Local and remote changes diverge and must not be overwritten automatically." },
  { id: "backup-recommended", label: "Backup recommended", severity: "attention", explanation: "The project has no recently verified backup package containing both the project file and required assets." },
] as const;

export type StorageStatusId = (typeof STORAGE_STATUS_DEFINITIONS)[number]["id"];

export const ISSUE_85_IMPLEMENTATION_SEQUENCE = [
  { issue: 87, title: "Simplify core navigation", dependency: "Foundation vocabulary from #85" },
  { issue: 88, title: "Redesign Visual Board navigation", dependency: "Canonical navigation and continuity language" },
  { issue: 89, title: "Add project Dashboard", dependency: "Storage statuses and collaboration roles" },
  { issue: 90, title: "Update front page and collaboration story", dependency: "Five selling points and server model" },
  { issue: 86, title: "Add Lighthouse whole-app audit", dependency: "Final route inventory after navigation changes" },
] as const;
