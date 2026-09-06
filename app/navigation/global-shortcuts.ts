export type RootWorkspace = "learn" | "plan" | "wyrmwood" | "library" | "community" | "settings" | "dashboard" | "build" | "story";

export type GlobalShortcutAction =
  | { readonly kind: "workspace"; readonly workspace: RootWorkspace }
  | { readonly kind: "route"; readonly href: string }
  | { readonly kind: "node" }
  | { readonly kind: "profile" };

export type GlobalShortcut = {
  readonly id: string;
  readonly key: string;
  readonly label: string;
  readonly detail: string;
  readonly relic: string;
  readonly action: GlobalShortcutAction;
};

export const PLOTPICKLE_OPEN_NODE_EVENT = "plotpickle:open-node";
export const PLOTPICKLE_OPEN_PROFILE_EVENT = "plotpickle:open-profile";

export const GLOBAL_SHORTCUTS: readonly GlobalShortcut[] = [
  { id: "node", key: "N", label: "Node", detail: "Profile home", relic: "/brand/plotpickle-ouroboros-v3-transparent.png", action: { kind: "node" } },
  { id: "community", key: "C", label: "Community", detail: "Guildhall", relic: "/assets/workflow-relics/community.svg", action: { kind: "workspace", workspace: "community" } },
  { id: "library", key: "O", label: "Library", detail: "Stories", relic: "/assets/workflow-relics/library.svg", action: { kind: "workspace", workspace: "library" } },
  { id: "learn", key: "L", label: "Learn", detail: "Guides", relic: "/assets/workflow-relics/learn.webp", action: { kind: "workspace", workspace: "learn" } },
  { id: "wyrmwood", key: "G", label: "Wyrmwood", detail: "Game", relic: "/assets/workflow-relics/game.webp", action: { kind: "workspace", workspace: "wyrmwood" } },
  { id: "plan", key: "P", label: "Plan", detail: "Design", relic: "/assets/workflow-relics/plan.webp", action: { kind: "workspace", workspace: "plan" } },
  { id: "build", key: "B", label: "Build", detail: "Assemble", relic: "/assets/workflow-relics/build.webp", action: { kind: "workspace", workspace: "build" } },
  { id: "storyboard", key: "S", label: "Storyboard", detail: "Sketch", relic: "/assets/workflow-relics/storyboard.webp", action: { kind: "route", href: "/storyboard" } },
  { id: "graphic-novel", key: "V", label: "Previs", detail: "Visualize", relic: "/assets/workflow-relics/graphic-novel.webp", action: { kind: "route", href: "/previs" } },
  { id: "write", key: "W", label: "Write", detail: "Draft", relic: "/assets/workflow-relics/write.webp", action: { kind: "route", href: "/pageflow" } },
  { id: "edit", key: "E", label: "Edit", detail: "Polish", relic: "/assets/workflow-relics/edit.webp", action: { kind: "route", href: "/edit" } },
  { id: "feedback", key: "F", label: "Feedback", detail: "Review", relic: "/assets/workflow-relics/feedback.webp", action: { kind: "route", href: "/pitch-review" } },
  { id: "refine", key: "R", label: "Refine", detail: "Decide", relic: "/assets/workflow-relics/refine.webp", action: { kind: "route", href: "/diagnostics" } },
  { id: "reports", key: "D", label: "Reports", detail: "Deliver", relic: "/assets/workflow-relics/reports.webp", action: { kind: "route", href: "/production" } },
  { id: "dashboard", key: "K", label: "Dashboard", detail: "KPI", relic: "/assets/workflow-relics/dashboard.webp", action: { kind: "workspace", workspace: "dashboard" } },
  { id: "settings", key: "T", label: "Settings", detail: "Config", relic: "/assets/workflow-relics/settings.svg", action: { kind: "workspace", workspace: "settings" } },
  { id: "profile", key: "H", label: "Profile", detail: "Human identity", relic: "/assets/workflow-relics/community.svg", action: { kind: "profile" } },
] as const;

export const WORKFLOW_SHORTCUTS = GLOBAL_SHORTCUTS.filter((shortcut) => !["node", "profile"].includes(shortcut.id));

export function shortcutForKey(key: string) {
  const normalized = key.length === 1 ? key.toUpperCase() : "";
  return GLOBAL_SHORTCUTS.find((shortcut) => shortcut.key === normalized) ?? null;
}

export function shortcutForId(id: string) {
  return GLOBAL_SHORTCUTS.find((shortcut) => shortcut.id === id) ?? null;
}

export function isEditableShortcutTarget(target: EventTarget | null) {
  if (!(target instanceof Element)) return false;
  return Boolean(target.closest([
    "input",
    "textarea",
    "select",
    "button",
    "a[href]",
    "summary",
    "[contenteditable='']",
    "[contenteditable='true']",
    "[role='textbox']",
    "[role='searchbox']",
    "[role='combobox']",
    "[role='menu']",
    "[role='listbox']",
    "[role='option']",
    "[role='slider']",
    "[role='spinbutton']",
    "[role='switch']",
    "[data-disable-global-shortcuts='true']",
  ].join(",")));
}

export function globalShortcutBlocked(event: KeyboardEvent) {
  if (event.defaultPrevented || event.repeat) return true;
  if (event.ctrlKey || event.metaKey || event.altKey || event.shiftKey) return true;
  if (isEditableShortcutTarget(event.target)) return true;
  return Boolean(document.querySelector("dialog[open], [role='dialog'][aria-modal='true'], [data-command-palette-open='true']"));
}
