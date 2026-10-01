"use client";

import type { KeyboardEvent as ReactKeyboardEvent } from "react";

export type StoryAct = 1 | 2 | 3 | 4;

export const STORY_ACTS: readonly StoryAct[] = [1, 2, 3, 4];

type StoryActShortcutEvent = Pick<ReactKeyboardEvent<HTMLElement>, "key" | "target" | "preventDefault">;

function isEditableStoryActShortcutTarget(target: EventTarget | null) {
  const element = target instanceof HTMLElement ? target : null;
  if (!element) return false;
  return element.isContentEditable || Boolean(element.closest("input, textarea, select, [contenteditable=\"true\"]"));
}

export function handleStoryActShortcut(
  event: StoryActShortcutEvent,
  onOpen: (act: StoryAct) => void,
) {
  if (isEditableStoryActShortcutTarget(event.target)) return;
  const act = Number(event.key);
  if (!STORY_ACTS.some((candidate) => candidate === act)) return;
  event.preventDefault();
  onOpen(act as StoryAct);
}

export function StoryActRail({
  activeAct,
  onOpen,
  ariaLabel = "Story acts",
  choiceDataAttribute,
}: {
  readonly activeAct: number;
  readonly onOpen: (act: StoryAct) => void;
  readonly ariaLabel?: string;
  readonly choiceDataAttribute?: "data-mind-map-act-choice" | "data-world-map-act-choice";
}) {
  return (
    <nav
      aria-label={ariaLabel}
      className="pp-skin-v1-preproduction-stage-rail"
      data-shared-story-act-rail="true"
      data-story-act-rail="four-acts"
      onKeyDown={(event) => handleStoryActShortcut(event, onOpen)}
    >
      {STORY_ACTS.map((act) => {
        const choiceData = choiceDataAttribute ? { [choiceDataAttribute]: act } : {};
        return (
        <button
          {...choiceData}
          key={act}
          type="button"
          aria-current={act === activeAct ? "page" : undefined}
          aria-keyshortcuts={String(act)}
          data-story-act={act}
          onClick={() => onOpen(act)}
        >
          <span aria-hidden="true">[{act}] </span>Act {act}
        </button>
        );
      })}
    </nav>
  );
}
