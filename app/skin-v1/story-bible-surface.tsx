"use client";

import Image from "next/image";
import { useMemo, useState } from "react";
import { plotPickleCurriculum } from "../../adapters/curriculum/current-catalog";
import {
  projectStoryBible,
  type StoryBibleCharacter,
  type StoryBibleFact,
} from "../../core/project/story-bible-projection";
import { storyDevelopmentFieldView } from "../../core/project/story-development";
import type { LibraryPPFProject } from "../../core/storage/library-project";
import {
  buildStoryDevelopmentFields,
  storyDevelopmentFieldsForAct,
  type StoryDevelopmentFieldDefinition,
} from "../../modules/learn/model/story-development-fields";
import {
  LEARN_TOPIC_SPINE,
  type LearnTopicSpineId,
} from "../../modules/learn/model/story-learning-context";
import { handleStoryActShortcut, StoryActRail } from "./story-act-rail";
import styles from "./story-bible-surface.module.css";

type WorldMapAct = 1 | 2 | 3 | 4;

function fieldScopeLabel(field: StoryDevelopmentFieldDefinition, act: WorldMapAct) {
  if (field.scope === "project-wide") return "PROJECT-WIDE";
  if (field.scope === "act-specific") return `ACT ${field.validActs.join(" / ")} ONLY`;
  return `ACT ${act}`;
}

function Fact({ fact }: { readonly fact: StoryBibleFact }) {
  return (
    <article className={styles.fact} data-story-bible-fact-state={fact.state}>
      <strong>{fact.label}</strong>
      <p>{fact.value}</p>
      <small>{fact.source}</small>
    </article>
  );
}

function characterDisplayName(character: StoryBibleCharacter) {
  return character.id === "isobel" ? "Summer" : character.name;
}

function CanonicalFieldCard({
  field,
  project,
  act,
  onEditField,
  onOpenLearn,
}: {
  readonly field: StoryDevelopmentFieldDefinition;
  readonly project: LibraryPPFProject;
  readonly act: WorldMapAct;
  readonly onEditField: (topic: LearnTopicSpineId, canonicalFieldId: string, act: WorldMapAct) => void;
  readonly onOpenLearn: (topic: LearnTopicSpineId, lessonId: string | null, act: WorldMapAct) => void;
}) {
  const view = storyDevelopmentFieldView(project, field, act);
  const value = view.value.trim();
  const established = Boolean(value);

  return (
    <article
      className={styles.fact}
      data-story-bible-fact-state={established ? "established" : "not-established"}
      data-world-map-canonical-field={field.canonicalId}
      data-world-map-field-scope={field.scope}
    >
      <strong>{field.lessonTitle}</strong>
      <p>{established ? value : "Not established yet."}</p>
      <small>{fieldScopeLabel(field, act)} · {field.prompt}</small>
      <div className={styles.reviewActions}>
        <button type="button" onClick={() => onOpenLearn(field.topicId, field.lessonId, act)}>Open in Learn</button>
        <button type="button" onClick={() => onEditField(field.topicId, field.canonicalId, act)}>
          Edit in Mind Map
        </button>
      </div>
    </article>
  );
}

function CharacterReview({ character }: { readonly character: StoryBibleCharacter }) {
  const displayName = characterDisplayName(character);
  return (
    <article className={styles.character} data-world-map-character-review={character.id}>
      <div className={styles.characterImage}>
        {character.imageUrl ? (
          <Image src={character.imageUrl} alt={displayName} width={420} height={420} unoptimized />
        ) : (
          <div role="img" aria-label={`No approved image for ${displayName}`}>NO APPROVED CHARACTER IMAGE YET</div>
        )}
      </div>
      <h3>{displayName}</h3>
      {character.facts.length ? (
        <div className={styles.characterFacts}>
          {character.facts.map((fact) => <Fact key={fact.id} fact={fact} />)}
        </div>
      ) : <p className={styles.empty}>Not established yet.</p>}
    </article>
  );
}

export default function StoryBibleSurface({
  project,
  onEditField,
  onOpenLearn,
}: {
  readonly project: LibraryPPFProject;
  readonly onEditField: (topic: LearnTopicSpineId, canonicalFieldId: string, act: WorldMapAct) => void;
  readonly onOpenLearn: (topic: LearnTopicSpineId, lessonId: string | null, act: WorldMapAct) => void;
}) {
  const bible = useMemo(() => projectStoryBible(project, plotPickleCurriculum), [project]);
  const canonicalFields = useMemo(() => buildStoryDevelopmentFields(plotPickleCurriculum), []);
  const [selectedAct, setSelectedAct] = useState<WorldMapAct>(1);
  const [activeTopic, setActiveTopic] = useState<LearnTopicSpineId>("foundations");
  const activeTopicEntry = LEARN_TOPIC_SPINE.find((topic) => topic.id === activeTopic) ?? LEARN_TOPIC_SPINE[0];
  const topicFields = storyDevelopmentFieldsForAct(
    canonicalFields.filter((field) => field.topicId === activeTopic),
    selectedAct,
  );
  const establishedCount = topicFields.filter((field) => storyDevelopmentFieldView(project, field, selectedAct).value.trim()).length;
  const selectedActBlockNumbers = new Set(
    project.structure.blocks.filter((block) => block.actNumber === selectedAct).map((block) => block.number),
  );
  const selectedActWriting = project.writing.entries.filter((entry) => selectedActBlockNumbers.has(entry.blockNumber));

  function openLearnTopic() {
    onOpenLearn(activeTopic, null, selectedAct);
  }

  return (
    <main
      className={styles.surface}
      aria-label="World Map"
      data-story-bible-surface="canonical"
      data-world-map-surface="review"
      data-world-map-act={selectedAct}
      data-world-map-topic={activeTopic}
      data-story-bible-project-id={bible.projectId}
      data-story-bible-read-only="true"
      onKeyDown={(event) => handleStoryActShortcut(event, setSelectedAct)}
    >
      <StoryActRail activeAct={selectedAct} ariaLabel="World Map acts" onOpen={setSelectedAct} />

      <nav className={styles.sectionNav} aria-label="World Map Learn topics" role="tablist">
        {LEARN_TOPIC_SPINE.map((topic, index) => {
          const selected = activeTopic === topic.id;
          return (
            <button
              aria-controls={`world-map-panel-${topic.id}`}
              aria-selected={selected}
              className={selected ? styles.sectionTabActive : styles.sectionTab}
              id={`world-map-tab-${topic.id}`}
              key={topic.id}
              onClick={() => setActiveTopic(topic.id)}
              onKeyDown={(event) => {
                if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
                event.preventDefault();
                const direction = event.key === "ArrowRight" ? 1 : -1;
                const nextIndex = (index + direction + LEARN_TOPIC_SPINE.length) % LEARN_TOPIC_SPINE.length;
                const next = LEARN_TOPIC_SPINE[nextIndex];
                setActiveTopic(next.id);
                const buttons = event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>('[role="tab"]');
                buttons?.[nextIndex]?.focus();
              }}
              role="tab"
              tabIndex={selected ? 0 : -1}
              type="button"
            >
              {topic.label}
            </button>
          );
        })}
      </nav>

      <div className={styles.topicToolbar}>
        <span>Act {selectedAct} · <strong>{activeTopicEntry.label}</strong> · {establishedCount}/{topicFields.length} established</span>
        <button type="button" onClick={openLearnTopic}>Open Topic in Learn</button>
      </div>

      <div className={styles.panelShell}>
        <section
          aria-labelledby={`world-map-tab-${activeTopic}`}
          className={styles.section}
          id={`world-map-panel-${activeTopic}`}
          role="tabpanel"
          data-world-map-canonical-topic={activeTopic}
        >
          <header>
            <p className={styles.kicker}>{activeTopicEntry.label.toUpperCase()} · READ / REVIEW</p>
            <h2>Current canonical project truth</h2>
            <p className={styles.reviewHelp}>
              These are the same canonical fields used by Mind Map. World Map does not edit, approve, or generate them.
            </p>
          </header>
          {!topicFields.length ? <p className={styles.empty}>No {activeTopicEntry.label} fields require separate Act {selectedAct} input.</p> : null}
          <div className={styles.factGrid}>
            {topicFields.map((field) => (
              <CanonicalFieldCard
                field={field}
                key={field.canonicalId}
                project={project}
                act={selectedAct}
                onEditField={onEditField}
                onOpenLearn={onOpenLearn}
              />
            ))}
          </div>
        </section>

        {activeTopic === "character" ? (
          <section className={styles.section} aria-label="Character reference review">
            <header>
              <p className={styles.kicker}>CHARACTER REFERENCE</p>
              <h2>Approved character truth and visual identity</h2>
            </header>
            {bible.characters.length ? (
              <div className={styles.characterGrid}>
                {bible.characters.map((character) => <CharacterReview character={character} key={character.id} />)}
              </div>
            ) : <p className={styles.empty}>Character truth has not been established for this project yet.</p>}
          </section>
        ) : null}

        {activeTopic === "structure" ? (
          <section className={styles.section} aria-label="Structure review">
            <header>
              <p className={styles.kicker}>STRUCTURE · ACT {selectedAct}</p>
              <h2>4 Acts · 12 Sequences · 24 Blocks · 96 Mini-Blocks</h2>
            </header>
            <div className={styles.blockGrid}>
              {bible.blocks.filter((block) => block.actNumber === selectedAct).map((block) => (
                <article key={block.number} className={styles.block} data-story-bible-established={block.established ? "true" : "false"}>
                  <small>ACT {block.actNumber} · SEQUENCE {block.sequenceNumber} · BLOCK {String(block.number).padStart(2, "0")}</small>
                  <strong>{block.title}</strong>
                  <p>{block.summary}</p>
                </article>
              ))}
            </div>
          </section>
        ) : null}

        {activeTopic === "previs" ? (
          <section className={styles.section} aria-label="Previs reference review">
            <header>
              <p className={styles.kicker}>PREVIS REFERENCE</p>
              <h2>Current approved marketing reference</h2>
            </header>
            <div className={styles.posterReview}>
              <div className={styles.posterFrame}>
                {bible.posterUrl ? (
                  <Image
                    src={bible.posterUrl}
                    alt={`${bible.title} poster / marketing reference`}
                    width={640}
                    height={960}
                    unoptimized
                  />
                ) : (
                  <div className={styles.posterEmpty} role="img" aria-label="No poster yet">NO POSTER YET</div>
                )}
              </div>
              <div>
                <h3>{bible.title}</h3>
                <p>{bible.posterLabel}</p>
                <small>Visual creation and revision belong in Mind Map / downstream visual tools, not World Map.</small>
              </div>
            </div>
          </section>
        ) : null}

        {activeTopic === "drafting" ? (
          <section className={styles.section} aria-label="Drafting reference review">
            <header>
              <p className={styles.kicker}>DRAFTING · ACT {selectedAct}</p>
              <h2>Written material currently connected to this Act</h2>
            </header>
            {selectedActWriting.length ? (
              <div className={styles.factGrid}>
                {selectedActWriting.map((entry) => (
                  <article className={styles.fact} key={entry.id}>
                    <strong>Block {entry.blockNumber} · Mini {entry.miniBlockNumber}</strong>
                    <p>{entry.text}</p>
                  </article>
                ))}
              </div>
            ) : <p className={styles.empty}>No Drafting material is established for Act {selectedAct} yet.</p>}
          </section>
        ) : null}

        {activeTopic === "responsible-ai" ? (
          <section className={styles.section} aria-label="Responsible AI provenance review">
            <header>
              <p className={styles.kicker}>RESPONSIBLE AI · PROVENANCE</p>
              <h2>Canonical evidence currently available</h2>
            </header>
            <div className={styles.factGrid}>
              {bible.sourceSummary.map((fact) => <Fact key={fact.id} fact={fact} />)}
            </div>
          </section>
        ) : null}
      </div>
    </main>
  );
}
