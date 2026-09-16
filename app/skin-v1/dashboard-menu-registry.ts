export type DashboardBbsItem = Readonly<{
  id: string;
  shortcut: string;
  label: string;
  description: string;
  group?: string;
}>;

export const DASHBOARD_MENU: readonly DashboardBbsItem[] = [
  { id: "community", shortcut: "C", label: "Community", description: "Share and Collaborate", group: "DEVELOPMENT" },
  { id: "learn", shortcut: "1", label: "Writer's Craft", description: "Learn Story Craft", group: "DEVELOPMENT" },
  { id: "library", shortcut: "L", label: "Library", description: "Load Your Stories", group: "DEVELOPMENT" },
  { id: "plan", shortcut: "O", label: "Outline", description: "Visualize Story Structure", group: "PRE-PRODUCTION" },
  { id: "storyboard", shortcut: "S", label: "Storyboard", description: "Visualize Scenes Before You Write", group: "PRE-PRODUCTION" },
  { id: "previs", shortcut: "P", label: "Previs", description: "Preview Shots, Timing and Camera Motion", group: "PRE-PRODUCTION" },
  { id: "write", shortcut: "W", label: "Write", description: "Write Scenes, Dialogue and Action Blocks", group: "PRODUCTION" },
  { id: "edit", shortcut: "E", label: "Edit", description: "Review and Improve Screenplay Flow", group: "PRODUCTION" },
  { id: "feedback", shortcut: "F", label: "Feedback", description: "Gather Reader Notes and Reactions", group: "PRODUCTION" },
  { id: "refine", shortcut: "R", label: "Refine", description: "Polish Dialogue and Story Choices", group: "PRODUCTION" },
  { id: "reports", shortcut: "A", label: "Analytics", description: "Review Story Health and Coverage Reports", group: "PRODUCTION" },
  { id: "wyrmwood", shortcut: "2", label: "Wyrmwood Game", description: "Practice Narrative Craft", group: "WORKSHOPS" },
  { id: "story", shortcut: "3", label: "The Unwritten", description: "Story Game Engine", group: "WORKSHOPS" },
  { id: "profile", shortcut: "I", label: "Identity", description: "Manage User Profile", group: "CALL SHEET" },
  { id: "settings", shortcut: "M", label: "Manage", description: "Configure PlotPickle", group: "CALL SHEET" },
  { id: "help", shortcut: "B", label: "Bug Report", description: "Prepare a PlotPickle Issue", group: "CALL SHEET" },
  { id: "open-source", shortcut: "N", label: "Notices", description: "Review Open Source Licensing and Attribution", group: "CALL SHEET" },
  { id: "logout", shortcut: "X", label: "Log Off", description: "End This Session", group: "WRAP" },
  { id: "shutdown", shortcut: "Q", label: "Shut Down Node", description: "Safely Close PlotPickle and Local Services", group: "WRAP" },
];

export const CONNECTED_DASHBOARD_ITEM_IDS = new Set([
  "community",
  "settings",
  "profile",
  "open-source",
  "help",
  "logout",
  "shutdown",
  "learn",
  "library",
  "plan",
  "storyboard",
]);

export const DASHBOARD_STARTUP_CHOICES = [
  { id: "dashboard", label: "Dashboard" },
  ...DASHBOARD_MENU
    .filter((item) => !["logout", "shutdown"].includes(item.id) && CONNECTED_DASHBOARD_ITEM_IDS.has(item.id))
    .map((item) => ({ id: item.id, label: item.label })),
] as const;

export type DashboardStartupId = (typeof DASHBOARD_STARTUP_CHOICES)[number]["id"];

export function isDashboardStartupId(value: unknown): value is DashboardStartupId {
  return typeof value === "string" && DASHBOARD_STARTUP_CHOICES.some((item) => item.id === value);
}
