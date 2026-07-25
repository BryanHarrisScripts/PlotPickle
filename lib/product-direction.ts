export const PLOTPICKLE_REPOSITORY_URL = "https://github.com/BryanHarrisScripts/PlotPickle";
export const LEARNING_MODULE_COUNT = 81;

export const PRODUCT_NAVIGATION = [
  { id: "dashboard", label: "Dashboard", description: "Projects, collaboration and storage" },
  { id: "instructions", label: "Instructions", description: "Learn the method" },
  { id: "learn", label: "Read & Learn", description: "Study the craft and terminology" },
  { id: "planner", label: "Story Planner", description: "Simple Start and story planning" },
  { id: "script", label: "Screenplay", description: "Outline and write" },
  { id: "visuals", label: "Visual Board", description: "See and preserve the film" },
  { id: "engines", label: "Engines", description: "Refine the story" },
  { id: "reports", label: "Reports", description: "Understand the screenplay" },
  { id: "settings", label: "Settings", description: "Preferences and Setup" },
] as const;

export type ProductNavigationId = (typeof PRODUCT_NAVIGATION)[number]["id"];

export const SIMPLE_START = {
  label: "Simple Start",
  destination: "Story Planner",
  purpose: "A deliberate beginner pathway inside the core application, not a required splash screen.",
  returningWriterRule: "Returning writers must be able to open the main workspace in one action.",
} as const;

export const FIVE_KEY_SELLING_POINTS = [
  {
    id: "complete-studio",
    title: "Complete screenplay studio",
    summary: "Move from idea through 24 Blocks, 96 mini-blocks, treatment, screenplay, revision, visuals and production planning in one project.",
  },
  {
    id: "learning-system",
    title: "81-module learning system",
    moduleCount: LEARNING_MODULE_COUNT,
    summary: "Use screenwriting education and in-context guidance directly inside the writing workflow.",
  },
  {
    id: "visual-continuity",
    title: "Visual continuity engine",
    summary: "Carry locked character identities, world references and 96 storyboard frames through one approved visual language.",
  },
  {
    id: "local-first",
    title: "Local-first ownership with optional AI",
    summary: "Keep control of projects, files, providers and every creative decision while using AI only when chosen.",
  },
  {
    id: "distributed-collaboration",
    title: "Distributed PlotPickle collaboration",
    summary: "Coordinate complete local or web-based PlotPickle servers through an owner-controlled GitHub film repository.",
  },
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
  {
    id: "local-only",
    label: "Local only",
    severity: "attention",
    explanation: "The canonical project is stored on this device and has not been verified in GitHub or an exported backup.",
  },
  {
    id: "local-with-assets",
    label: "Local project and local images",
    severity: "attention",
    explanation: "The project file and visual assets are stored locally; both need backup protection before an upgrade or device failure.",
  },
  {
    id: "connected-unpublished",
    label: "Connected to GitHub — unpublished changes",
    severity: "review",
    explanation: "A repository connection exists, but current project or asset changes have not been verified on the remote repository.",
  },
  {
    id: "synchronized",
    label: "Synchronized with GitHub",
    severity: "clear",
    explanation: "The active local revision matches the verified repository revision.",
  },
  {
    id: "pull-required",
    label: "Remote changes available",
    severity: "review",
    explanation: "A newer repository revision is available and must be reviewed before contributing or replacing local work.",
  },
  {
    id: "conflict-review",
    label: "Conflict or review required",
    severity: "blocked",
    explanation: "Local and remote changes diverge and must not be overwritten automatically.",
  },
  {
    id: "backup-recommended",
    label: "Backup recommended",
    severity: "attention",
    explanation: "The project has no recently verified backup package containing both the project file and required assets.",
  },
] as const;

export type StorageStatusId = (typeof STORAGE_STATUS_DEFINITIONS)[number]["id"];

export const ISSUE_85_IMPLEMENTATION_SEQUENCE = [
  { issue: 87, title: "Simplify core navigation", dependency: "Foundation vocabulary from #85" },
  { issue: 88, title: "Redesign Visual Board navigation", dependency: "Canonical navigation and continuity language" },
  { issue: 89, title: "Add project Dashboard", dependency: "Storage statuses and collaboration roles" },
  { issue: 90, title: "Update front page and collaboration story", dependency: "Five selling points and server model" },
  { issue: 86, title: "Add Lighthouse whole-app audit", dependency: "Final route inventory after navigation changes" },
] as const;
