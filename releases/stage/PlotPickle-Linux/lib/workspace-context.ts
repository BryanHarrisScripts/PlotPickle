import type { ProductNavigationId } from "./product-direction";

export type WorkspaceContext = {
  workspace: ProductNavigationId;
  submenu: string;
  blockId: string;
  miniBlockId: string;
  sceneId: string;
  characterId: string;
  feedbackTargetId: string;
  inspector: string;
  filter: string;
  zoom: number;
  boardPosition: { x: number; y: number };
  scrollPosition: number;
};

export const EMPTY_WORKSPACE_CONTEXT: WorkspaceContext = {
  workspace: "dashboard",
  submenu: "overview",
  blockId: "",
  miniBlockId: "",
  sceneId: "",
  characterId: "",
  feedbackTargetId: "",
  inspector: "",
  filter: "",
  zoom: 1,
  boardPosition: { x: 0, y: 0 },
  scrollPosition: 0,
};

export type WorkspaceContextHistory = {
  current: WorkspaceContext;
  previous: WorkspaceContext | null;
};

export function openWorkspaceContext(
  history: WorkspaceContextHistory,
  next: Partial<WorkspaceContext> & Pick<WorkspaceContext, "workspace">,
): WorkspaceContextHistory {
  return {
    previous: history.current,
    current: { ...history.current, ...next },
  };
}

export function restorePreviousContext(history: WorkspaceContextHistory): WorkspaceContextHistory {
  if (!history.previous) return history;
  return {
    current: history.previous,
    previous: history.current,
  };
}

export function updateWorkspaceContext(
  history: WorkspaceContextHistory,
  patch: Partial<WorkspaceContext>,
): WorkspaceContextHistory {
  return {
    ...history,
    current: { ...history.current, ...patch },
  };
}
