"use client";

import { useState, type DragEvent, type KeyboardEvent } from "react";
import { markImportedScreenplayProjectionStale, normalizeProjectSourceEvidence } from "@/core/contracts/imported-screenplay-evidence";
import {
  reviewStoryEvidenceBlock,
  type StoryStructuralFindingState,
} from "@/core/contracts/story-evidence-matrix";
import type { LibraryPPFProject } from "@/core/storage/project-library-browser";
import { saveFoundationProject } from "@/core/storage/foundation-project-browser";
import {
  STORY_CARD_MINI_LABELS,
  moveStoryCardContent,
  setStoryCardPlanningLock,
  storyCardActRows,
  storyCardAffectedRefs,
  storyCardSourceCoverage,
  updateStoryCard,
  updateStoryCardMini,
} from "@/modules/plan/story-card-board";

type StoryCardFoundationBoardProps = {
  readonly project: LibraryPPFProject;
  readonly onProjectChange: (project: LibraryPPFProject) => void;
};

function structuralBlockTitle(number: number) {
  return `Block ${String(number).padStart(2, "0")}`;
}

function structuralMiniTitle(number: number) {
  return `Mini-Block ${String(number).padStart(2, "0")}`;
}

function actLocalBlockNumber(blockNumber: number) {
  return ((blockNumber - 1) % 6) + 1;
}

export default function StoryCardFoundationBoard({
  project,
  onProjectChange,
}: StoryCardFoundationBoardProps) {
  const [draggingBlockNumber, setDraggingBlockNumber] = useState<number | null>(null);
  const [message, setMessage] = useState("Story Cards ready. Structural addresses stay fixed while planning content moves.");
  const normalizedSourceEvidence = normalizeProjectSourceEvidence(project.sourceEvidence);
  const screenplayEvidence = normalizedSourceEvidence.screenplay;
  const storyMatrix = normalizedSourceEvidence.storyMatrix;
  const sourcePassages = screenplayEvidence?.passages ?? [];
  const sourceSectionMarkers = screenplayEvidence?.sectionMarkers ?? [];

  function commitStructure(
    structure: LibraryPPFProject["structure"],
    messageText: string,
    staleBlockNumbers: readonly number[] = [],
  ) {
    if (structure === project.structure) {
      setMessage(messageText);
      return;
    }
    const occurredAt = new Date().toISOString();
    const revision = project.revision + 1;
    const next: LibraryPPFProject = {
      ...project,
      structure,
      revision,
      updatedAt: occurredAt,
      sourceEvidence: staleBlockNumbers.length
        ? markImportedScreenplayProjectionStale(
          project.sourceEvidence,
          storyCardAffectedRefs(staleBlockNumbers),
          revision,
        )
        : project.sourceEvidence,
    };
    const saved = saveFoundationProject(next) as LibraryPPFProject;
    onProjectChange(saved);
    setMessage(messageText);
  }

  function moveCard(sourceBlockNumber: number, targetBlockNumber: number) {
    const next = moveStoryCardContent(project.structure, sourceBlockNumber, targetBlockNumber);
    if (next === project.structure) {
      setMessage("That move is unavailable. Unlock every Story Card crossed by the move before rearranging it.");
      return;
    }
    commitStructure(
      next,
      `Moved planned content from Block ${String(sourceBlockNumber).padStart(2, "0")} to Block ${String(targetBlockNumber).padStart(2, "0")}. Block and Mini-Block addresses did not move.`,
    );
  }

  function handleDrop(event: DragEvent<HTMLElement>, targetBlockNumber: number) {
    event.preventDefault();
    const source = Number(event.dataTransfer.getData("application/x-plotpickle-story-card") || draggingBlockNumber);
    setDraggingBlockNumber(null);
    if (Number.isInteger(source)) moveCard(source, targetBlockNumber);
  }

  function handleCardKey(event: KeyboardEvent<HTMLElement>, blockNumber: number) {
    if (!event.altKey || (event.key !== "ArrowLeft" && event.key !== "ArrowRight")) return;
    event.preventDefault();
    const target = event.key === "ArrowLeft" ? blockNumber - 1 : blockNumber + 1;
    if (target >= 1 && target <= 24) moveCard(blockNumber, target);
  }

  function saveBlockField(blockNumber: number, field: "title" | "note", value: string) {
    const next = updateStoryCard(project.structure, blockNumber, { [field]: value });
    commitStructure(next, next === project.structure ? "No Story Card change was needed." : `Saved Block ${String(blockNumber).padStart(2, "0")} planning content.`);
  }

  function saveMiniField(blockNumber: number, ordinal: number, field: "title" | "note", value: string) {
    const next = updateStoryCardMini(project.structure, blockNumber, ordinal, { [field]: value });
    commitStructure(next, next === project.structure ? "No Mini-Block change was needed." : `Saved Block ${String(blockNumber).padStart(2, "0")} · Mini-Block ${ordinal} planning content.`);
  }

  function toggleLock(blockNumber: number, locked: boolean) {
    const occurredAt = new Date().toISOString();
    const next = setStoryCardPlanningLock(project.structure, blockNumber, locked, occurredAt);
    commitStructure(
      next,
      locked
        ? `Locked Block ${String(blockNumber).padStart(2, "0")} planning arrangement. Unlock it explicitly before revising or moving it.`
        : `Unlocked Block ${String(blockNumber).padStart(2, "0")} for Human-authorized revision. Dependency-backed screenplay projection is marked for review before changes continue.`,
      locked ? [] : [blockNumber],
    );
  }

  function saveStructuralFinding(
    blockNumber: number,
    state: StoryStructuralFindingState,
    reason: string,
  ) {
    if (!storyMatrix) return;
    const reviewedAt = new Date().toISOString();
    const nextMatrix = reviewStoryEvidenceBlock(storyMatrix, blockNumber, state, reason, reviewedAt);
    const next: LibraryPPFProject = {
      ...project,
      revision: project.revision + 1,
      updatedAt: reviewedAt,
      sourceEvidence: {
        ...normalizedSourceEvidence,
        storyMatrix: nextMatrix,
      },
    };
    const saved = saveFoundationProject(next) as LibraryPPFProject;
    onProjectChange(saved);
    setMessage(`Saved Human structural review for Block ${String(blockNumber).padStart(2, "0")}. No screenplay text or comparison source was changed.`);
  }

  return (
    <section className="pp-skin-v1-story-card-board" aria-labelledby="story-card-board-title" data-story-card-foundation-board="24x96">
      <header className="pp-skin-v1-story-card-board-heading">
        <div>
          <p>STORY CARDS · FOUNDATION BOARD</p>
          <h2 id="story-card-board-title">Plan the whole story like a wall of Post-it notes.</h2>
          <span>Four Acts, six Blocks per Act. Drag with a pointer, or use Move earlier / Move later (Alt+Left / Alt+Right). The stable PPF Block 01–24 and Mini-Block addresses never move; only your planning content does. Screenplay coverage shows how much observed source material is mapped into each card; it does not claim the source was authored as 24 equal Blocks.</span>
        </div>
        <div className="pp-skin-v1-story-card-board-key">
          <strong>{project.title || "Untitled Story"}</strong>
          <small>24 Blocks · 96 Mini-Blocks · PPF revision {project.revision}</small>
        </div>
      </header>

      <p className="pp-skin-v1-story-card-board-status" role="status">{message}</p>

      <div className="pp-skin-v1-story-card-act-stack">
        {storyCardActRows(project.structure).map((row) => (
          <section className="pp-skin-v1-story-card-act" key={row.actNumber} aria-labelledby={`story-card-act-${row.actNumber}`}>
            <header>
              <strong id={`story-card-act-${row.actNumber}`}>ACT {row.actNumber}</strong>
              <span>Blocks {String(row.blocks[0]?.number ?? 1).padStart(2, "0")}–{String(row.blocks.at(-1)?.number ?? 1).padStart(2, "0")}</span>
            </header>
            <div className="pp-skin-v1-story-card-row">
              {row.blocks.map((block) => {
                const locked = Boolean(block.planningLockedAt);
                const authoredTitle = block.title === structuralBlockTitle(block.number) ? "" : block.title;
                const coverage = storyCardSourceCoverage(sourcePassages, block.number);
                const sectionMarkers = sourceSectionMarkers.filter((marker) => marker.blockNumber === block.number);
                const matrixBlock = storyMatrix?.blocks.find((candidate) => candidate.blockNumber === block.number) ?? null;
                return (
                  <article
                    className="pp-skin-v1-story-card"
                    data-locked={locked ? "true" : "false"}
                    data-story-card-address={block.id}
                    draggable={!locked}
                    key={block.id}
                    onDragStart={(event) => {
                      setDraggingBlockNumber(block.number);
                      event.dataTransfer.effectAllowed = "move";
                      event.dataTransfer.setData("application/x-plotpickle-story-card", String(block.number));
                      event.dataTransfer.setData("text/plain", String(block.number));
                    }}
                    onDragEnd={() => setDraggingBlockNumber(null)}
                    onDragOver={(event) => {
                      if (!locked) {
                        event.preventDefault();
                        event.dataTransfer.dropEffect = "move";
                      }
                    }}
                    onDrop={(event) => handleDrop(event, block.number)}
                    onKeyDown={(event) => handleCardKey(event, block.number)}
                  >
                    <header className="pp-skin-v1-story-card-topline">
                      <div>
                        <strong>ACT {block.actNumber} · BLOCK {actLocalBlockNumber(block.number)}</strong>
                        <small>PPF Block {String(block.number).padStart(2, "0")} · S{String(block.sequenceNumber).padStart(2, "0")} · {block.id}</small>
                      </div>
                      <span data-story-card-lock-state={locked ? "locked" : "exploratory"}>{locked ? "LOCKED" : "MOVE"}</span>
                    </header>

                    <div className="pp-skin-v1-story-card-coverage" aria-label={`Mapped screenplay coverage for PPF Block ${block.number}`}>
                      <strong>MAPPED SCREENPLAY EVIDENCE</strong>
                      <span>{coverage.passageCount} passages · {coverage.sceneCount} scenes · {coverage.wordCount} words · {coverage.sourceSharePercent}% of stored source</span>
                      <span>Mini-Blocks with evidence {coverage.miniBlocksWithEvidence}/4 · {coverage.miniPassageCounts.join(" / ")} passages</span>
                      {sectionMarkers.length ? (
                        <span className="pp-skin-v1-story-card-source-sections">
                          Source section{sectionMarkers.length === 1 ? "" : "s"} starting here: {sectionMarkers.map((marker) => `${marker.title} (p.${marker.page})`).join(" · ")}
                        </span>
                      ) : null}
                    </div>

                    {matrixBlock ? (
                      <details className="pp-skin-v1-story-card-structural-review" data-structural-finding={matrixBlock.structuralFinding.state}>
                        <summary>Structural responsibility · {matrixBlock.structuralFinding.state.replace("-", " / ")}</summary>
                        <p>{matrixBlock.responsibility}</p>
                        <div className="pp-skin-v1-story-card-source-map">
                          {matrixBlock.sourceMappings.map((mapping) => (
                            <span key={`${block.id}-${mapping.sourceId}`}>
                              {mapping.sourceVersion.toUpperCase()} · {mapping.sourceRole.replace("-", " ")} · {mapping.mappingMethod.replaceAll("-", " ")}
                              {mapping.candidateOnly ? " · comparison only" : ""}
                            </span>
                          ))}
                        </div>
                        <label>
                          <span>Human structural finding</span>
                          <select
                            defaultValue={matrixBlock.structuralFinding.state}
                            key={`finding-${block.id}-${project.revision}`}
                            onChange={(event) => saveStructuralFinding(
                              block.number,
                              event.currentTarget.value as StoryStructuralFindingState,
                              matrixBlock.structuralFinding.reason,
                            )}
                          >
                            <option value="unresolved">Unresolved</option>
                            <option value="covered">Covered</option>
                            <option value="condensed-shared">Condensed / Shared</option>
                            <option value="gap-underdeveloped">Gap / Underdeveloped</option>
                          </select>
                        </label>
                        <label>
                          <span>Evidence-backed review note</span>
                          <textarea
                            defaultValue={matrixBlock.structuralFinding.reason}
                            key={`finding-note-${block.id}-${project.revision}`}
                            maxLength={2000}
                            onBlur={(event) => {
                              const value = event.currentTarget.value.trim();
                              if (value !== matrixBlock.structuralFinding.reason) {
                                saveStructuralFinding(
                                  block.number,
                                  matrixBlock.structuralFinding.state,
                                  value,
                                );
                              }
                            }}
                            rows={4}
                          />
                        </label>
                        <small>Source density and curriculum guidance do not decide this finding. Human review owns the classification.</small>
                      </details>
                    ) : null}

                    <label>
                      <span>Card title</span>
                      <input
                        key={`title-${block.id}-${project.revision}`}
                        defaultValue={authoredTitle}
                        disabled={locked}
                        maxLength={160}
                        onBlur={(event) => saveBlockField(block.number, "title", event.currentTarget.value)}
                        placeholder="Name this story movement"
                      />
                    </label>

                    <label>
                      <span>Story intent / note</span>
                      <textarea
                        key={`note-${block.id}-${project.revision}`}
                        defaultValue={block.note}
                        disabled={locked}
                        maxLength={1200}
                        onBlur={(event) => saveBlockField(block.number, "note", event.currentTarget.value)}
                        placeholder="What changes in this Block?"
                        rows={4}
                      />
                    </label>

                    <details className="pp-skin-v1-story-card-minis">
                      <summary>4 Mini-Blocks</summary>
                      <ol>
                        {block.miniBlocks.map((mini, index) => {
                          const miniTitle = mini.title === structuralMiniTitle(mini.number) ? "" : mini.title;
                          return (
                            <li key={mini.id} data-mini-address={mini.id}>
                              <div>
                                <strong>{index + 1} · {STORY_CARD_MINI_LABELS[index]}</strong>
                                <small>{mini.id}</small>
                              </div>
                              <input
                                key={`mini-title-${mini.id}-${project.revision}`}
                                aria-label={`Block ${block.number} Mini-Block ${index + 1} title`}
                                defaultValue={miniTitle}
                                disabled={locked}
                                maxLength={160}
                                onBlur={(event) => saveMiniField(block.number, mini.ordinal, "title", event.currentTarget.value)}
                                placeholder="Optional mini title"
                              />
                              <textarea
                                key={`mini-note-${mini.id}-${project.revision}`}
                                aria-label={`Block ${block.number} Mini-Block ${index + 1} note`}
                                defaultValue={mini.note}
                                disabled={locked}
                                maxLength={800}
                                onBlur={(event) => saveMiniField(block.number, mini.ordinal, "note", event.currentTarget.value)}
                                placeholder="Optional short intent"
                                rows={2}
                              />
                            </li>
                          );
                        })}
                      </ol>
                    </details>

                    <div className="pp-skin-v1-story-card-actions">
                      <button type="button" disabled={locked || block.number === 1} onClick={() => moveCard(block.number, block.number - 1)} aria-label={`Move Block ${block.number} planning content earlier`}>Move earlier</button>
                      <button type="button" disabled={locked || block.number === 24} onClick={() => moveCard(block.number, block.number + 1)} aria-label={`Move Block ${block.number} planning content later`}>Move later</button>
                      <button type="button" className="pp-skin-v1-story-card-lock" onClick={() => toggleLock(block.number, !locked)}>{locked ? "Unlock to revise" : "Lock card"}</button>
                    </div>
                  </article>
                );
              })}
            </div>
          </section>
        ))}
      </div>

      <p className="pp-skin-v1-story-card-board-footnote">Story Cards are a planning projection inside the existing PPF. Screenplay evidence metrics describe mapped source density, not authored Block boundaries. Structural findings are Human review states, not creative-quality scores. Empty cards stay empty; PlotPickle does not manufacture screenplay, Scene, Beat, Shot, Frame or visual content to fill the wall.</p>
    </section>
  );
}
