export type DashboardBbsItem = Readonly<{
  id: string;
  shortcut: string;
  label: string;
  description: string;
  group?: string;
}>;

export const DASHBOARD_MENU: readonly DashboardBbsItem[] = [
  { id: "learn", shortcut: "1", label: "Learn", description: "Learn Story Craft", group: "EXPLORE" },
  { id: "community", shortcut: "C", label: "Community", description: "Share and Collaborate", group: "EXPLORE" },
  { id: "screening", shortcut: "9", label: "Screening", description: "Screen Stories and Gather Reactions", group: "EXPLORE" },
  { id: "library", shortcut: "L", label: "Library", description: "Load Your Stories", group: "EXPLORE" },
  { id: "reports", shortcut: "A", label: "Reports", description: "Review Story Health and Coverage Reports", group: "EXPLORE" },

  { id: "discovery", shortcut: "G", label: "MindMap", description: "Capture and Map New Story Material", group: "DEVELOP" },
  { id: "story-bible", shortcut: "V", label: "WorldMap", description: "Map the Story World", group: "DEVELOP" },
  { id: "write", shortcut: "W", label: "Write", description: "Write Scenes, Dialogue and Action Blocks", group: "DEVELOP" },
  { id: "edit", shortcut: "E", label: "Edit", description: "Review and Improve Screenplay Flow", group: "DEVELOP" },
  { id: "refine", shortcut: "R", label: "Refine", description: "Polish Dialogue and Story Choices", group: "DEVELOP" },

  { id: "plan", shortcut: "O", label: "Outline", description: "Visualize Story Structure", group: "VISUALIZE" },
  { id: "storyboard", shortcut: "S", label: "Storyboard", description: "Visualize Scenes Before You Write", group: "VISUALIZE" },
  { id: "previs", shortcut: "P", label: "Previs", description: "Preview Shots, Timing and Camera Motion", group: "VISUALIZE" },
  { id: "timeline", shortcut: "T", label: "Timeline", description: "Synchronize Script, Shots, Timing and Audio", group: "VISUALIZE" },
  { id: "production", shortcut: "D", label: "Rough Cut", description: "Review Production Intent and Handoff Readiness", group: "VISUALIZE" },

  { id: "sound-narration", shortcut: "6", label: "Narration", description: "Develop Narration, Voice-Over and Spoken Story", group: "SOUND" },
  { id: "sound-music", shortcut: "7", label: "Music", description: "Develop Score, Music and Ambient Cues", group: "SOUND" },
  { id: "sound-foley", shortcut: "8", label: "Foley", description: "Develop Foley, Room Tone and Environmental Sound", group: "SOUND" },

  { id: "pitch-package", shortcut: "4", label: "Package", description: "Develop the Pitch Package and Presentation Materials", group: "PITCH" },
  { id: "pitch-deck", shortcut: "5", label: "Deck", description: "Generate and Review the Visual Pitch Deck", group: "PITCH" },
  { id: "feedback", shortcut: "F", label: "Feedback", description: "Gather Reader Notes and Reactions", group: "PITCH" },

  { id: "profile", shortcut: "I", label: "Identity", description: "Manage User Profile", group: "PLAY" },
  { id: "wyrmwood", shortcut: "2", label: "Wyrmwood", description: "Practice Narrative Craft", group: "PLAY" },
  { id: "story", shortcut: "3", label: "Written", description: "Story Game Engine", group: "PLAY" },

  { id: "settings", shortcut: "M", label: "Settings", description: "Configure PlotPickle", group: "SYSTEM" },
  { id: "help", shortcut: "B", label: "Service", description: "Prepare a PlotPickle Issue", group: "SYSTEM" },
  { id: "open-source", shortcut: "N", label: "Legal", description: "Open Source Licensing and Attribution", group: "SYSTEM" },
  { id: "logout", shortcut: "X", label: "Log Off", description: "End This Session", group: "SYSTEM" },
  { id: "shutdown", shortcut: "Q", label: "Shut Down", description: "Safely Close PlotPickle and Local Services", group: "SYSTEM" },
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
  "discovery",
  "library",
  "plan",
  "storyboard",
  "previs",
  "timeline",
  "production",
  "story-bible",
]);

export const DASHBOARD_REVIEW_ITEM_IDS = new Set([
  "discovery",
  "plan",
  "storyboard",
  "previs",
  "timeline",
  "production",
]);

export const DASHBOARD_UNAVAILABLE_ITEM_IDS = new Set([
  "screening",
  "sound-narration",
  "sound-music",
  "sound-foley",
  "pitch-package",
  "pitch-deck",
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
