"use client";

import type { KeyboardEvent as ReactKeyboardEvent } from "react";
import { LEARN_TOPIC_SPINE, type LearnTopicSpineId } from "../../modules/learn/model/story-learning-context";
import { STORY_ACTS, type StoryAct } from "./story-act-rail";
import styles from "./story-development-surface-header.module.css";

type ChoiceDataAttribute = "data-mind-map-act-choice" | "data-world-map-act-choice";

export default function StoryDevelopmentSurfaceHeader({
  surfaceId,
  title,
  activeAct,
  activeTopic,
  onActChange,
  onTopicChange,
  onBackDashboard,
  actChoiceDataAttribute,
}: {
  readonly surfaceId: "mind-map" | "world-map";
  readonly title: string;
  readonly activeAct: StoryAct;
  readonly activeTopic: LearnTopicSpineId;
  readonly onActChange: (act: StoryAct) => void;
  readonly onTopicChange: (topic: LearnTopicSpineId) => void;
  readonly onBackDashboard: () => void;
  readonly actChoiceDataAttribute: ChoiceDataAttribute;
}) {
  const accessibilityLabel = surfaceId === "mind-map" ? "MindMap" : "World Map";
  void title;
  void onBackDashboard;

  function handleTopicKeyDown(event: ReactKeyboardEvent<HTMLButtonElement>, index: number) {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    event.preventDefault();
    const direction = event.key === "ArrowRight" ? 1 : -1;
    const nextIndex = (index + direction + LEARN_TOPIC_SPINE.length) % LEARN_TOPIC_SPINE.length;
    const next = LEARN_TOPIC_SPINE[nextIndex];
    onTopicChange(next.id);
    const buttons = event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>('[role="tab"]');
    buttons?.[nextIndex]?.focus();
  }

  return (
    <header
      className={styles.header}
      data-story-development-surface-header="shared"
      data-story-development-family="mind-world"
      data-story-development-surface={surfaceId}
      data-story-development-header-density="compact"
    >
      <nav className={styles.actRail} aria-label={`${accessibilityLabel} acts`} data-story-development-act-rail="shared">
        {STORY_ACTS.map((act) => {
          const choiceData = { [actChoiceDataAttribute]: act };
          const selected = activeAct === act;
          return (
            <button
              {...choiceData}
              key={act}
              type="button"
              aria-current={selected ? "page" : undefined}
              aria-keyshortcuts={String(act)}
              data-story-development-act={act}
              data-selected={selected ? "true" : "false"}
              onClick={() => onActChange(act)}
            >
              <span aria-hidden="true">[{act}] </span>Act {act}
            </button>
          );
        })}
      </nav>

      <nav
        className={styles.topicRail}
        aria-label={`${accessibilityLabel} Learn topics`}
        data-story-development-topic-rail="canonical"
        role="tablist"
      >
        {LEARN_TOPIC_SPINE.map((topic, index) => {
          const selected = activeTopic === topic.id;
          return (
            <button
              key={topic.id}
              id={`${surfaceId}-topic-tab-${topic.id}`}
              type="button"
              role="tab"
              aria-selected={selected}
              tabIndex={selected ? 0 : -1}
              data-story-development-topic={topic.id}
              data-selected={selected ? "true" : "false"}
              onClick={() => onTopicChange(topic.id)}
              onKeyDown={(event) => handleTopicKeyDown(event, index)}
            >
              {topic.label}
            </button>
          );
        })}
      </nav>
    </header>
  );
}
