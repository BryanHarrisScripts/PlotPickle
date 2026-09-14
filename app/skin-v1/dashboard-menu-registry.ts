export type DashboardBbsItem = Readonly<{
  id: string;
  shortcut: string;
  label: string;
  description: string;
  group?: string;
}>;

export const DASHBOARD_MENU: readonly DashboardBbsItem[] = [
  { id: "community", shortcut: "C", label: "Community", description: "Share and Collaborate" },
  { id: "learn", shortcut: "1", label: "Writer's Craft", description: "Learn Story Craft" },
  { id: "library", shortcut: "L", label: "Library", description: "Load Your Stories" },
  { id: "plan", shortcut: "O", label: "Outline", description: "Visualize Story Structure", group: "STRUCTURING" },
  { id: "storyboard", shortcut: "S", label: "Storyboard", description: "Visualize Scenes Before You Write", group: "STRUCTURING" },
  { id: "previs", shortcut: "P", label: "Previs", description: "Preview Shots, Timing and Camera Motion", group: "STRUCTURING" },
  { id: "write", shortcut: "W", label: "Write", description: "Write Scenes, Dialogue and Action Blocks", group: "DRAFTING" },
  { id: "edit", shortcut: "E", label: "Edit", description: "Review and Improve Screenplay Flow", group: "DRAFTING" },
  { id: "feedback", shortcut: "F", label: "Feedback", description: "Gather Reader Notes and Reactions", group: "DRAFTING" },
  { id: "refine", shortcut: "R", label: "Refine", description: "Polish Dialogue and Story Choices", group: "DRAFTING" },
  { id: "reports", shortcut: "A", label: "Analytics", description: "Review Story Health and Coverage Reports", group: "DRAFTING" },
  { id: "wyrmwood", shortcut: "2", label: "Wyrmwood Game", description: "Practice Narrative Craft", group: "INTERACTIVE LEARNING" },
  { id: "story", shortcut: "3", label: "The Unwritten", description: "Story Game Engine", group: "INTERACTIVE LEARNING" },
  { id: "profile", shortcut: "I", label: "Identity", description: "Manage User Profile", group: "MANAGEMENT" },
  { id: "settings", shortcut: "M", label: "Manage", description: "Configure PlotPickle", group: "MANAGEMENT" },
  { id: "help", shortcut: "B", label: "Bug Report", description: "Prepare a PlotPickle Issue", group: "MANAGEMENT" },
  { id: "open-source", shortcut: "N", label: "Notices", description: "Review Open Source Licensing and Attribution", group: "MANAGEMENT" },
  { id: "logout", shortcut: "X", label: "Log Off", description: "End This Session" },
];

export const CONNECTED_DASHBOARD_ITEM_IDS = new Set([
  "community",
  "settings",
  "profile",
  "open-source",
  "help",
  "logout",
  "learn",
]);

export const DASHBOARD_STARTUP_CHOICES = [
  { id: "dashboard", label: "Dashboard" },
  ...DASHBOARD_MENU
    .filter((item) => item.id !== "logout" && CONNECTED_DASHBOARD_ITEM_IDS.has(item.id))
    .map((item) => ({ id: item.id, label: item.label })),
] as const;

export type DashboardStartupId = (typeof DASHBOARD_STARTUP_CHOICES)[number]["id"];

export function isDashboardStartupId(value: unknown): value is DashboardStartupId {
  return typeof value === "string" && DASHBOARD_STARTUP_CHOICES.some((item) => item.id === value);
}
