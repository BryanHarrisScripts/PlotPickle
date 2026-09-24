"use client";

import { useState, type DragEvent, type KeyboardEvent } from "react";
import type { CharacterArcEvidenceState } from "@/core/contracts/character-truth-evidence";
import { normalizeProjectSourceEvidence } from "@/core/contracts/imported-screenplay-evidence";
import type { LibraryPPFProject } from "@/core/storage/project-library-browser";
import { loadFoundationProject, saveFoundationProject } from "@/core/storage/foundation-project-browser";
import {
  markCreativeRevisionDependentsStale,
  planCreativeRevisionPropagation,
  type CreativeRevisionPropagationPlan,
  type CreativeRevisionTarget,
} from "@/lib/preproduction/creative-revision-propagation";
import {
  STORY_CARD_MINI_LABELS,
  moveStoryCardContent,
  setStoryCardPlanningLock,
  storyCardActRows,
  storyCardSourceCoverage,
  updateStoryCard,
  updateStoryCardMini,
} from "@/modules/plan/story-card-board";

import { currentOutlineAssessment, outlineAssessmentFingerprint, requestOutlineAgentAssessment } from "@/modules/plan/outline-agent-assessment";
import type { OutlineBlockReadiness } from "@/modules/plan/outline-readiness";
import { outlineTurningPoint } from "@/modules/plan/outline-turning-point";
import type { PreproductionReviewAddress } from "./preproduction-review-surfaces";

type StoryCardFoundationBoardProps = {
  readonly outlineReadiness?: readonly OutlineBlockReadiness[];
  readonly selectedAddress?: PreproductionReviewAddress;
  readonly onSelectAddress?: (address: PreproductionReviewAddress) => void;
  readonly turningPointSelected?: boolean;
  readonly onSelectTurningPoint?: () => void;
  readonly project: LibraryPPFProject;
  readonly onProjectChange: (project: LibraryPPFProject) => void;
  readonly act?: number;
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

const CHARACTER_NAMES: Readonly<Record<string, string>> = {
  ren: "Ren",
  amy: "Amy",
  isobel: "Summer / Isobel",
  joy: "Joy",
  kai: "Kai",
  jai: "Jai",
};

function characterEvidenceLabel(state: CharacterArcEvidenceState) {
  return state
    .replace("not-present-no-evidence", "No observed evidence")
    .replace("present-arc-neutral", "Present / arc-neutral")
    .replace("pressure-introduced", "Pressure introduced")
    .replace("belief-strategy-reinforced", "Belief / strategy reinforced")
    .replace("belief-strategy-challenged", "Belief / strategy challenged")
    .replace("meaningful-choice", "Meaningful choice")
    .replace("consequence", "Consequence")
    .replace("relationship-movement", "Relationship movement")
    .replace("arc-transition", "Arc transition")
    .replace("unresolved-insufficient-evidence", "Unresolved / insufficient evidence");
}

export default function StoryCardFoundationBoard({
  project,
  onProjectChange,
  act,
  outlineReadiness,
  selectedAddress,
  onSelectAddress,
  turningPointSelected,
  onSelectTurningPoint,
}: StoryCardFoundationBoardProps) {
  const [assessing, setAssessing] = useState<number | null>(null);
  const [draggingBlockNumber, setDraggingBlockNumber] = useState<number | null>(null);
  const [message, setMessage] = useState("Story Cards ready. Structural addresses stay fixed while planning content moves.");
  const normalizedSourceEvidence = normalizeProjectSourceEvidence(project.sourceEvidence);
  const screenplayEvidence = normalizedSourceEvidence.screenplay;
  const storyMatrix = normalizedSourceEvidence.storyMatrix;
  const characterTruth = normalizedSourceEvidence.characterTruth;
  const sourcePassages = screenplayEvidence?.passages ?? [];
  const sourceSectionMarkers = screenplayEvidence?.sectionMarkers ?? [];

  function structureRevisionTargets(
    structure: LibraryPPFProject["structure"],
  ): readonly { target: CreativeRevisionTarget; beforeValue: unknown; afterValue: unknown }[] {
    const revisions: { target: CreativeRevisionTarget; beforeValue: unknown; afterValue: unknown }[] = [];
    for (const currentBlock of project.structure.blocks) {
      const nextBlock = structure.blocks.find((candidate) => candidate.number === currentBlock.number);
      if (!nextBlock) continue;

      const blockBefore = { title: currentBlock.title, note: currentBlock.note };
      const blockAfter = { title: nextBlock.title, note: nextBlock.note };
      if (JSON.stringify(blockBefore) !== JSON.stringify(blockAfter)) {
        revisions.push({
          target: { kind: "block-content", blockNumber: currentBlock.number },
          beforeValue: blockBefore,
          afterValue: blockAfter,
        });
      }

      for (const currentMini of currentBlock.miniBlocks) {
        const nextMini = nextBlock.miniBlocks.find((candidate) => candidate.ordinal === currentMini.ordinal);
        if (!nextMini) continue;
        const miniBefore = { title: currentMini.title, note: currentMini.note };
        const miniAfter = { title: nextMini.title, note: nextMini.note };
        if (JSON.stringify(miniBefore) !== JSON.stringify(miniAfter)) {
          revisions.push({
            target: {
              kind: "mini-content",
              blockNumber: currentBlock.number,
              miniBlockNumber: currentMini.ordinal,
            },
            beforeValue: miniBefore,
            afterValue: miniAfter,
          });
        }
      }

      if (currentBlock.planningLockedAt !== nextBlock.planningLockedAt) {
        revisions.push({
          target: { kind: "planning-lock", blockNumber: currentBlock.number },
          beforeValue: currentBlock.planningLockedAt,
          afterValue: nextBlock.planningLockedAt,
        });
      }
    }
    return revisions;
  }

  function revisionPlans(
    structure: LibraryPPFProject["structure"],
    occurredAt: string,
  ): readonly CreativeRevisionPropagationPlan[] {
    return structureRevisionTargets(structure).map((revision, index) =>
        planCreativeRevisionPropagation({
          project,
          target: revision.target,
          beforeValue: revision.beforeValue,
          afterValue: revision.afterValue,
          changeSetId: `story-card-impact-${project.revision}-${index + 1}`,
          summary: "Story Card planning revision",
          occurredAt,
        }),
    );
  }

  function commitStructure(
    structure: LibraryPPFProject["structure"],
    messageText: string,
  ) {
    if (structure === project.structure) {
      setMessage(messageText);
      return;
    }
    const occurredAt = new Date().toISOString();
    const revision = project.revision + 1;
    const plans = revisionPlans(structure, occurredAt);
    const affectedVisualIds = new Set(plans.flatMap((plan) => plan.staleAcceptedVisualArtifactIds));
    const affectedShotIds = new Set(plans.flatMap((plan) => plan.staleProductionShotIds));
    const contentPlans = plans.filter((plan) => plan.target.kind !== "planning-lock");
    const revised: LibraryPPFProject = {
      ...project,
      structure,
      revision,
      updatedAt: occurredAt,
    };
    const next = plans.reduce(
      (current, plan) => markCreativeRevisionDependentsStale(current, plan, revision),
      revised,
    );
    const saved = saveFoundationProject(next) as LibraryPPFProject;
    onProjectChange(saved);
    setMessage(
      `${messageText} `
      + (contentPlans.length
        ? `${affectedVisualIds.size} accepted visual${affectedVisualIds.size === 1 ? "" : "s"} and ${affectedShotIds.size} Previs Shot${affectedShotIds.size === 1 ? "" : "s"} are dependency-affected; unrelated accepted work remains intact. No regeneration was triggered.`
        : "Planning lock state changed without invalidating downstream creative work."),
    );
  }

  function moveCard(sourceBlockNumber: number, targetBlockNumber: number) {
    if (act && (Math.ceil(sourceBlockNumber / 6) !== act || Math.ceil(targetBlockNumber / 6) !== act)) {
      setMessage(`Act ${act} shows Blocks ${(act - 1) * 6 + 1}–${act * 6}. Select the other Act before moving its cards.`);
      return;
    }
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
        : `Unlocked Block ${String(blockNumber).padStart(2, "0")} for Human-authorized revision. No story content changed merely because the lock changed.`,
    );
  }

  async function assessOne(blockNumber: number) {
      const current = loadFoundationProject() as LibraryPPFProject;
      const assessment = await requestOutlineAgentAssessment(current, blockNumber);
      const latest = loadFoundationProject() as LibraryPPFProject;
      if (outlineAssessmentFingerprint(latest, blockNumber) !== assessment.inputFingerprint) throw new Error("The screenplay or plan changed during assessment. Run it again with current evidence.");
      const source = normalizeProjectSourceEvidence(latest.sourceEvidence);
      const saved = saveFoundationProject({
        ...latest,
        revision: latest.revision + 1,
        updatedAt: assessment.assessedAt,
        sourceEvidence: { ...source, outlineAssessments: [...(source.outlineAssessments ?? []).filter((item) => item.blockNumber !== blockNumber), assessment] },
      }) as LibraryPPFProject;
      onProjectChange(saved);
  }

  async function assessBlocks(blockNumbers: readonly number[]) {
    if (assessing !== null) return;
    try {
      for (const blockNumber of blockNumbers) {
        setAssessing(blockNumber);
        setMessage(`Story Architect is assessing Block ${String(blockNumber).padStart(2, "0")} from the screenplay and saved PPF notes…`);
        await assessOne(blockNumber);
      }
      setMessage(`Story Architect assessed ${blockNumbers.length} Block${blockNumbers.length === 1 ? "" : "s"} with cited screenplay passages. Proposals now carry into the Storyboard handoff; screenplay and accepted canon were not rewritten.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Story Architect could not complete this assessment. Remaining Blocks were not assessed.");
    } finally {
      setAssessing(null);
    }
  }

  return (
    <section className="pp-skin-v1-story-card-board" aria-labelledby="story-card-board-title" data-story-card-foundation-board="24x96">
      <header className="pp-skin-v1-story-card-board-heading">
        <div>
          <p>STORY CARDS · FOUNDATION BOARD</p>
          <h2 id="story-card-board-title">{act ? `Plan Act ${act} with six Story Cards.` : "Plan the whole story like a wall of Post-it notes."}</h2>
          <span>Four Acts, six Blocks per Act. Drag with a pointer, or use Move earlier / Move later (Alt+Left / Alt+Right). The stable PPF Block 01–24 and Mini-Block addresses never move; only your planning content does. Screenplay coverage shows how much observed source material is mapped into each card; it does not claim the source was authored as 24 equal Blocks.</span>
        </div>
        <div className="pp-skin-v1-story-card-board-key">
          <strong>{project.title || "Untitled Story"}</strong>
          <small>24 Blocks · 96 Mini-Blocks · PPF revision {project.revision}</small>
        </div>
      </header>

      <p className="pp-skin-v1-story-card-board-status" role="status">{message}</p>
      {act ? <button className="pp-skin-v1-outline-assess-act" type="button" disabled={assessing !== null} onClick={() => void assessBlocks(Array.from({ length: 6 }, (_, index) => (act - 1) * 6 + index + 1))}>{assessing === null ? `Assess Act ${act} with Story Architect` : `Assessing Block ${String(assessing).padStart(2, "0")}…`}</button> : null}

      <div className="pp-skin-v1-story-card-act-stack">
        {storyCardActRows(project.structure).filter((row) => !act || row.actNumber === act).map((row) => (
          <section className="pp-skin-v1-story-card-act" key={row.actNumber} aria-labelledby={`story-card-act-${row.actNumber}`}>
            <header>
              <strong id={`story-card-act-${row.actNumber}`}>ACT {row.actNumber}</strong>
              <span>Blocks {String(row.blocks[0]?.number ?? 1).padStart(2, "0")}–{String(row.blocks.at(-1)?.number ?? 1).padStart(2, "0")}</span>
            </header>
            <div className="pp-skin-v1-story-card-row">
              {row.blocks.map((block) => {
                const readiness = outlineReadiness?.find((item) => item.blockNumber === block.number);
                const assessment = currentOutlineAssessment(project, block.number);
                const locked = Boolean(block.planningLockedAt);
                const authoredTitle = block.title === structuralBlockTitle(block.number) ? "" : block.title;
                const coverage = storyCardSourceCoverage(sourcePassages, block.number);
                const sectionMarkers = sourceSectionMarkers.filter((marker) => marker.blockNumber === block.number);
                const matrixBlock = storyMatrix?.blocks.find((candidate) => candidate.blockNumber === block.number) ?? null;
                const characterCells = characterTruth?.arcCells.filter((cell) => cell.blockNumber === block.number) ?? [];
                const observedCharacterCount = characterCells.filter((cell) => cell.passageIds.length > 0).length;
                return (
                  <article
                    className="pp-skin-v1-story-card"
                    data-locked={locked ? "true" : "false"}
                    data-outline-readiness={readiness?.status}
                    data-selected={!turningPointSelected && selectedAddress?.blockNumber === block.number ? "true" : undefined}
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

                    {readiness ? <p className="pp-skin-v1-outline-status">Outline: {readiness.status === "needs-support" ? "Needs support" : readiness.status === "review" ? "Review" : "Evidence ready"} · {readiness.issues.length} issue{readiness.issues.length === 1 ? "" : "s"}</p> : null}
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

                    <div className="pp-skin-v1-outline-agent-summary" data-agent-structural-state={assessment?.structural.state ?? "pending"}>
                      <strong>Story Architect · {assessment ? assessment.structural.state.replaceAll("-", " / ") : "Not assessed"}</strong>
                      <p>{assessment ? assessment.structural.reason : `Block ${String(block.number).padStart(2, "0")} has ${coverage.passageCount} projected passages across ${coverage.miniBlocksWithEvidence}/4 Mini-Blocks. Passage count and placement cannot establish ${matrixBlock?.responsibility || "structural responsibility"}.`}</p>
                      {assessment ? <small>Provisional, source-cited assessment · {assessment.structural.passageIds.length} cited passages · {assessment.model}</small> : null}
                      {assessment?.structural.passageIds.length ? <details><summary>Screenplay passages behind this finding</summary><ul>{assessment.structural.passageIds.map((id) => { const passage = sourcePassages.find((item) => item.id === id); return <li key={id}><strong>{id}</strong> · {passage?.text.slice(0, 260) || "Source passage unavailable"}</li>; })}</ul></details> : null}
                      {matrixBlock?.structuralFinding.reviewedAt ? <small>Existing reviewed finding: {matrixBlock.structuralFinding.state.replaceAll("-", " / ")} · {matrixBlock.structuralFinding.reason}</small> : null}
                      <button type="button" disabled={assessing !== null} onClick={() => void assessBlocks([block.number])}>{assessing === block.number ? "Assessing…" : assessment ? "Reassess this Block" : "Assess this Block with Story Architect"}</button>
                    </div>
                    {matrixBlock ? <details className="pp-skin-v1-story-card-structural-review">
                      <summary>Structural responsibility and source placement</summary>
                      <p>{matrixBlock.responsibility}</p>
                      <div className="pp-skin-v1-story-card-source-map">{matrixBlock.sourceMappings.map((mapping) => <span key={`${block.id}-${mapping.sourceId}`}>{mapping.sourceVersion.toUpperCase()} · {mapping.mappingMethod.replaceAll("-", " ")}{mapping.candidateOnly ? " · comparison only" : ""}</span>)}</div>
                      <small>Projected placement and density are observations. Agent findings cite screenplay passages and remain proposals.</small>
                    </details> : null}

                    {characterTruth && characterCells.length ? (
                      <details className="pp-skin-v1-story-card-character-review">
                        <summary>Character arc evidence · {observedCharacterCount}/{characterCells.length} observed here</summary>
                        <details><summary>Character source policy</summary><p className="pp-skin-v1-story-card-character-rule">{characterTruth.governingRule}</p></details>
                        <div className="pp-skin-v1-story-card-character-grid">
                          {characterCells.map((cell) => {
                            const profileClaims = characterTruth.claims.filter((claim) => (
                              claim.characterIds.includes(cell.characterId)
                              && claim.handling === "writer-reference"
                            ));
                            const restrictedCount = characterTruth.claims.filter((claim) => (
                              claim.characterIds.includes(cell.characterId)
                              && claim.handling === "restricted-reference"
                            )).length;
                            const checkpointHints = characterTruth.checkpoints.filter((checkpoint) => (
                              checkpoint.characterId === cell.characterId
                              && checkpoint.blockNumbers.includes(block.number)
                            ));
                            return (
                              <article key={`${block.id}-character-${cell.characterId}`} data-character-arc-state={cell.state}>
                                <header>
                                  <strong>{CHARACTER_NAMES[cell.characterId] ?? cell.characterId}</strong>
                                  <span>{cell.passageIds.length} passages · {cell.sceneNumbers.length} scenes</span>
                                </header>
                                <p>{assessment?.characters.find((item) => item.characterId === cell.characterId) ? characterEvidenceLabel(assessment.characters.find((item) => item.characterId === cell.characterId)!.state) : cell.passageIds.length ? "Agent assessment pending · observed mention alone does not establish arc movement" : "No observed character passage here"}</p>
                                {assessment?.characters.find((item) => item.characterId === cell.characterId) ? <p>{assessment.characters.find((item) => item.characterId === cell.characterId)!.reason} · cited passages: {assessment.characters.find((item) => item.characterId === cell.characterId)!.passageIds.join(", ") || "none"}</p> : null}
                                {checkpointHints.length ? (
                                  <p className="pp-skin-v1-story-card-checkpoint-hint">
                                    Flexible checkpoint: {checkpointHints.map((checkpoint) => `${checkpoint.kind} → Arc Matrix.${checkpoint.targetArcField}`).join(" · ")}
                                  </p>
                                ) : null}
                                <details>
                                  <summary>Profile context · source-only</summary>
                                  {profileClaims.slice(0, 4).map((claim) => (
                                    <p key={claim.id}>{claim.summary}</p>
                                  ))}
                                  {restrictedCount ? (
                                    <small>{restrictedCount} restricted historical reference{restrictedCount === 1 ? "" : "s"} retained in provenance and not surfaced as character guidance.</small>
                                  ) : null}
                                </details>
                              </article>
                            );
                          })}
                        </div>
                        <small>Character findings are agent proposals grounded in audience-visible screenplay passages. Profile/backstory is separate source context.</small>
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

                    <details className="pp-skin-v1-story-card-minis" key={`${block.id}-${selectedAddress?.blockNumber === block.number && !turningPointSelected ? selectedAddress?.miniBlockNumber : 0}`}>
                      <summary>4 Mini-Blocks</summary>
                      <ol>
                        {block.miniBlocks.map((mini, index) => {
                          const miniTitle = mini.title === structuralMiniTitle(mini.number) ? "" : mini.title;
                          return (
                            <li key={mini.id} data-mini-address={mini.id} data-selected={!turningPointSelected && selectedAddress?.blockNumber === block.number && selectedAddress?.miniBlockNumber === mini.ordinal ? "true" : undefined}>
                              <div>
                                <button type="button" aria-pressed={!turningPointSelected && selectedAddress?.blockNumber === block.number && selectedAddress?.miniBlockNumber === mini.ordinal} onClick={() => onSelectAddress?.({ blockNumber: block.number, miniBlockNumber: mini.ordinal })}>{index + 1} · {STORY_CARD_MINI_LABELS[index]}</button>
                                <small>{mini.id}</small>
                              </div>
                              {assessment?.miniBlocks.find((item) => item.ordinal === mini.ordinal) ? <p className="pp-skin-v1-outline-agent-mini">Story Architect: {assessment.miniBlocks.find((item) => item.ordinal === mini.ordinal)!.state} · {assessment.miniBlocks.find((item) => item.ordinal === mini.ordinal)!.reason}</p> : null}
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
            {act ? <button className="pp-skin-v1-outline-turning-point" data-selected={turningPointSelected ? "true" : undefined} aria-pressed={Boolean(turningPointSelected)} onClick={onSelectTurningPoint} type="button">
              <strong>{outlineTurningPoint(act).label}</strong><span>After Block {String(act * 6).padStart(2, "0")} · Review the Act change against the six Story Cards. The turning point is a checkpoint, not a seventh Block.</span>
            </button> : null}
          </section>
        ))}
      </div>

      <p className="pp-skin-v1-story-card-board-footnote">Story Cards are a planning projection inside the existing PPF. Screenplay evidence metrics describe mapped source density, not authored Block boundaries. Story Architect proposals cite screenplay evidence and do not rewrite accepted canon. Older reviewed findings remain visible separately. Character Truth stays separate from audience-visible screenplay evidence. Empty cards stay empty; PlotPickle does not manufacture screenplay, Scene, Beat, Shot, Frame or visual content to fill the wall.</p>
    </section>
  );
}
