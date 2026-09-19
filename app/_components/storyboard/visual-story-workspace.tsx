"use client";

/* eslint-disable @next/next/no-img-element -- Visual Story renders existing PlotPickle Storyboard artifacts through their current local asset URLs. */

import { useEffect, useMemo, useState } from "react";
import type { SequenceDirectorDraft } from "@/core/contracts/sequence-director";
import type { StoryboardEditorialShot } from "@/core/contracts/storyboard/editorial-shot";
import type { PPFProject } from "@/core/project/project";
import type { LibraryPPFProject } from "@/core/storage/project-library-browser";
import type { PlotPickleProject } from "@/lib/projects/project";
import type { ProviderInstructionBundle } from "@/lib/preproduction/provider-instruction-compiler";
import { inspectProviderInstructionBundle } from "@/lib/preproduction/provider-instruction-inspection";
import { projectVisualStory } from "@/lib/preproduction/visual-story-projection";
import SceneTimelineWorkspace from "./scene-timeline-workspace";
import styles from "./visual-story-workspace.module.css";

function detail(value: string, fallback = "Not authored") {
  return value.trim() || fallback;
}

export default function VisualStoryWorkspace({
  project,
  legacyProject,
  blockNumber,
  miniBlockNumber,
  initialSceneId,
  initialShotId,
  initialView = "story",
  sequenceDirectorDrafts = [],
  editorialShots = [],
  providerInstructions = null,
  onProjectChange,
  onReturnToStoryboard,
}: {
  readonly project: LibraryPPFProject;
  readonly legacyProject: PlotPickleProject | null;
  readonly blockNumber: number;
  readonly miniBlockNumber: number;
  readonly initialSceneId?: string;
  readonly initialShotId?: string;
  readonly initialView?: "story" | "timeline";
  readonly sequenceDirectorDrafts?: readonly SequenceDirectorDraft[];
  readonly editorialShots?: readonly StoryboardEditorialShot[];
  readonly providerInstructions?: ProviderInstructionBundle | null;
  readonly onProjectChange: (project: PPFProject) => void;
  readonly onReturnToStoryboard: () => void;
}) {
  const [selectedSceneId, setSelectedSceneId] = useState(initialSceneId ?? "");
  const [selectedShotId, setSelectedShotId] = useState(initialShotId ?? "");
  const [view, setView] = useState<"story" | "timeline">(initialView);
  const projection = useMemo(() => projectVisualStory({
    project,
    legacyProject,
    blockNumber,
    miniBlockNumber,
    requestedSceneId: selectedSceneId || initialSceneId,
    sequenceDirectorDrafts,
    editorialShots,
  }), [blockNumber, editorialShots, initialSceneId, legacyProject, miniBlockNumber, project, selectedSceneId, sequenceDirectorDrafts]);

  useEffect(() => {
    if (projection.selectedScene && projection.selectedScene.id !== selectedSceneId) {
      setSelectedSceneId(projection.selectedScene.id);
    }
  }, [projection.selectedScene, selectedSceneId]);

  const shots = projection.anchors.flatMap((anchor) => anchor.shots);
  const selectedShot = shots.find((shot) => (
    shot.id === selectedShotId
    || shot.productionShotId === selectedShotId
    || shot.editorialShotId === selectedShotId
  )) ?? shots[0] ?? null;
  const providerInstructionInspection = useMemo(() => {
    if (!providerInstructions) return { inspection: null, error: "" };
    try {
      return {
        inspection: inspectProviderInstructionBundle(providerInstructions, {
          editorialShotId: selectedShot?.editorialShotId,
          productionShotId: selectedShot?.productionShotId,
        }),
        error: "",
      };
    } catch (cause) {
      return {
        inspection: null,
        error: cause instanceof Error ? cause.message : "Generated director instructions could not be inspected.",
      };
    }
  }, [providerInstructions, selectedShot?.editorialShotId, selectedShot?.productionShotId]);

  useEffect(() => {
    if (selectedShot && selectedShot.id !== selectedShotId) setSelectedShotId(selectedShot.id);
    if (!selectedShot && selectedShotId) setSelectedShotId("");
  }, [selectedShot, selectedShotId]);

  const selectedAnchor = projection.anchors.find((anchor) => (
    anchor.blockNumber === blockNumber && anchor.miniBlockNumber === miniBlockNumber
  )) ?? projection.anchors[0] ?? null;
  const showNow = selectedShot?.informationDirectives.filter((directive) => directive.mode === "SHOW_NOW") ?? [];
  const withholdNow = selectedShot?.informationDirectives.filter((directive) => directive.mode === "WITHHOLD_NOW") ?? [];

  if (!projection.selectedScene) {
    return (
      <section className={styles.workspace} data-projection-only="true" data-visual-story="scene-beat-shot-frame">
        <button
          type="button"
          className="pp-skin-v1-return"
          data-skin-v1-return="storyboard"
          onClick={onReturnToStoryboard}
        >Back to Storyboard</button>
        <header className={styles.header}>
          <div>
            <p className={styles.kicker}>Visual Story · Scene → Beat → Shot → Frame</p>
            <h2>Visual {project.title || "Untitled Story"} Screenplay</h2>
          </div>
        </header>

        <nav className={styles.sceneRail} aria-label="Visual pre-production view">
          <button
            aria-pressed={view === "story"}
            data-visual-story-view="story"
            onClick={() => setView("story")}
            type="button"
          >
            Visual Story
          </button>
          <button
            aria-pressed={view === "timeline"}
            data-visual-story-view="timeline"
            onClick={() => setView("timeline")}
            type="button"
          >
            Scene Workspace
          </button>
        </nav>

        {view === "story" ? (
          <>
            <div className={styles.empty} role="status">
              <strong>No related Scene is authored for Block {String(blockNumber).padStart(2, "0")} · Mini-Block {miniBlockNumber}.</strong>
              <p>Visual Story does not manufacture a Scene to fill the surface. Existing Beats, Shots or kept Frames attached directly to this canonical anchor remain visible below without inventing Scene ownership.</p>
              {projection.legacyDetailStatus === "project-id-mismatch" ? <small>The available richer Scene detail belongs to a different project and was intentionally ignored.</small> : null}
            </div>

            {selectedAnchor ? (
              <div className={styles.storyBody} data-anchor-only-projection="true">
                <div className={styles.visualScript}>
                  <section className={styles.anchor} data-anchor-ref={selectedAnchor.anchorRef}>
                    <header className={styles.anchorHeader}>
                      <div>
                        <span>Canonical anchor · Mini-Block {selectedAnchor.blockNumber}.{selectedAnchor.miniBlockNumber}</span>
                        <code>{selectedAnchor.anchorRef}</code>
                      </div>
                      <small>{selectedAnchor.shots.length} Shot{selectedAnchor.shots.length === 1 ? "" : "s"} · {selectedAnchor.frames.length} kept/candidate PPF Frame{selectedAnchor.frames.length === 1 ? "" : "s"}</small>
                    </header>

                    <div className={styles.beatSpan} aria-label={`Beats for ${selectedAnchor.anchorRef}`}>
                      <div className={styles.rowLabel}>BEAT</div>
                      {selectedAnchor.beats.length ? selectedAnchor.beats.map((beat) => (
                        <article className={styles.beat} key={beat.id}>
                          <strong>{String(beat.order).padStart(2, "0")} · {beat.label || beat.id}</strong>
                          <p>{beat.visualAction || beat.purpose || "Beat is authored without visual-action detail."}</p>
                        </article>
                      )) : <p className={styles.unassigned}>No authored Sequence Director Beat is attached to this anchor.</p>}
                    </div>

                    <div className={styles.shotRow} aria-label={`Shots for ${selectedAnchor.anchorRef}`}>
                      <div className={styles.rowLabel}>SHOT</div>
                      {selectedAnchor.shots.length ? selectedAnchor.shots.map((shot) => (
                        <button
                          aria-pressed={selectedShot?.id === shot.id}
                          className={styles.shot}
                          data-shot-source={shot.source}
                          key={shot.id}
                          onClick={() => setSelectedShotId(shot.id)}
                          type="button"
                        >
                          <span className={styles.shotNumber}>SHOT {String(shot.order).padStart(2, "0")}</span>
                          {shot.frames[0] ? <img alt={shot.frames[0].narrativePurpose || `Frame for Shot ${shot.order}`} src={shot.frames[0].assetUrl} /> : <span className={styles.noFrame}>NO LINKED FRAME</span>}
                          <strong>{shot.narrativePurpose || shot.visualIntent || "Shot intent not yet described"}</strong>
                          <small>{[shot.shotSize, shot.angle, shot.movement].filter(Boolean).join(" · ") || "Camera detail not authored"}</small>
                        </button>
                      )) : <p className={styles.unassigned}>No creative Shot exists at this anchor. PlotPickle does not create one to satisfy the 24/96 grid.</p>}
                    </div>

                    <div className={styles.frameRow} aria-label={`Frames for ${selectedAnchor.anchorRef}`}>
                      <div className={styles.rowLabel}>FRAME</div>
                      {selectedAnchor.frames.length ? selectedAnchor.frames.map((frame) => (
                        <figure className={styles.frame} data-accepted={frame.accepted ? "true" : undefined} key={frame.id}>
                          <img alt={frame.narrativePurpose || "Storyboard Frame"} src={frame.assetUrl} />
                          <figcaption>{frame.accepted ? "KEPT" : "CANDIDATE"} · {frame.narrativePurpose || frame.id}</figcaption>
                        </figure>
                      )) : <p className={styles.unassigned}>No kept or stored PPF Frame exists at this anchor yet.</p>}
                    </div>
                  </section>
                </div>

                <aside className={styles.inspector} aria-label="Selected Shot inspector without Scene relationship">
                  <p className={styles.kicker}>Selected Shot · existing authority</p>
                  {selectedShot ? (
                    <>
                      <h3>Shot {String(selectedShot.order).padStart(2, "0")}</h3>
                      <code>{selectedShot.id}</code>
                      <p className={styles.intent}>{selectedShot.narrativePurpose || selectedShot.visualIntent || "No narrative or visual intent has been authored for this Shot."}</p>
                      <dl className={styles.shotFacts}>
                        <div><dt>Size</dt><dd>{detail(selectedShot.shotSize)}</dd></div>
                        <div><dt>Angle</dt><dd>{detail(selectedShot.angle)}</dd></div>
                        <div><dt>Movement</dt><dd>{detail(selectedShot.movement)}</dd></div>
                        <div><dt>Lens</dt><dd>{detail(selectedShot.lens)}</dd></div>
                        <div><dt>Lighting</dt><dd>{detail(selectedShot.lightingIntent)}</dd></div>
                        <div><dt>State</dt><dd>{selectedShot.reviewState}</dd></div>
                      </dl>
                      <section className={styles.informationBoundary}>
                        <h4>AUDIENCE LEARNS NOW</h4>
                        {showNow.length ? showNow.map((directive) => (
                          <article key={directive.id}><strong>{directive.statement}</strong><p>{directive.carrier || "No carrier detail is recorded."}</p></article>
                        )) : <p>No SHOW_NOW information directive is recorded for this Shot.</p>}
                      </section>
                      <section className={styles.informationBoundary}>
                        <h4>AUDIENCE MUST NOT KNOW YET</h4>
                        {withholdNow.length ? withholdNow.map((directive) => (
                          <article key={directive.id}>
                            <strong>{directive.statement}</strong>
                            <p>{directive.protectionIntent || "No protection intent is recorded."}</p>
                            <small>Release: {directive.release.state}{directive.release.reference ? ` · ${directive.release.reference}` : ""}{directive.release.condition ? ` · ${directive.release.condition}` : ""}</small>
                          </article>
                        )) : <p>No WITHHOLD_NOW information directive is recorded for this Shot.</p>}
                      </section>
                    </>
                  ) : <p className={styles.unassigned}>No real Storyboard/Previs Shot is attached. Reveal/withhold intent is not inferred from prose or visual references.</p>}
                </aside>
              </div>
            ) : null}
          </>
        ) : (
          <section
            aria-label="Scene Workspace empty state"
            className={styles.empty}
            data-projection-only="true"
            data-scene-workspace="dialogue-action-shot-audio"
            role="status"
          >
            <strong>No related Scene is authored for Block {String(blockNumber).padStart(2, "0")} · Mini-Block {miniBlockNumber}.</strong>
            <p>Scene Workspace does not manufacture Dialogue, Action, Shot or Audio cues to fill the surface. Add or relate a real Scene through the existing story authority; only real screenplay, Shot, Previs or audio evidence can then occupy the workspace.</p>
          </section>
        )}

        <footer className={styles.boundary}>
          Projection only. Scene, Beat, Shot and Frame identities remain owned by their existing PlotPickle authorities. Visual Story and Scene Workspace share those identities; neither creates canon, approves candidates or converts technical RenderClips into creative Shots.
        </footer>
      </section>
    );
  }

  const instructionInspection = providerInstructionInspection.inspection;

  return (
    <section
      className={styles.workspace}
      data-projection-only="true"
      data-scene-id={projection.selectedScene.id}
      data-visual-story="scene-beat-shot-frame"
    >
      <button
        type="button"
        className="pp-skin-v1-return"
        data-skin-v1-return="storyboard"
        onClick={onReturnToStoryboard}
      >Back to Storyboard</button>
      <header className={styles.header}>
        <div>
          <p className={styles.kicker}>Visual Story · Scene → Beat → Shot → Frame</p>
          <h2>{projection.selectedScene.title}</h2>
          <p>{projection.selectedScene.purpose || "No Scene purpose has been authored yet."}</p>
        </div>
        <div className={styles.counts} aria-label="Visual Story object counts">
          <span>{projection.counts.beats} Beats</span>
          <span>{projection.counts.shots} Shots</span>
          <span>{projection.counts.frames} Frames</span>
        </div>
      </header>

      {projection.scenes.length > 1 ? (
        <nav className={styles.sceneRail} aria-label="Scenes related to the selected Mini-Block">
          {projection.scenes.map((scene) => (
            <button
              aria-pressed={scene.id === projection.selectedScene?.id}
              key={scene.id}
              onClick={() => {
                setSelectedSceneId(scene.id);
                setSelectedShotId("");
              }}
              type="button"
            >
              Scene {scene.id} · {scene.title}
            </button>
          ))}
        </nav>
      ) : null}

      <dl className={styles.sceneFacts}>
        <div><dt>Objective</dt><dd>{detail(projection.selectedScene.objective)}</dd></div>
        <div><dt>Opposition</dt><dd>{detail(projection.selectedScene.opposition)}</dd></div>
        <div><dt>Action</dt><dd>{detail(projection.selectedScene.action)}</dd></div>
        <div><dt>Turn</dt><dd>{detail(projection.selectedScene.turn)}</dd></div>
        <div><dt>Outcome</dt><dd>{detail(projection.selectedScene.outcome)}</dd></div>
      </dl>

      <nav className={styles.sceneRail} aria-label="Visual pre-production view">
        <button
          aria-pressed={view === "story"}
          data-visual-story-view="story"
          onClick={() => setView("story")}
          type="button"
        >
          Visual Story
        </button>
        <button
          aria-pressed={view === "timeline"}
          data-visual-story-view="timeline"
          onClick={() => setView("timeline")}
          type="button"
        >
          Scene Timeline
        </button>
      </nav>

      {view === "story" ? (
        <div className={styles.storyBody}>
          <div className={styles.visualScript}>
            {projection.anchors.map((anchor) => (
              <section className={styles.anchor} data-anchor-ref={anchor.anchorRef} key={anchor.anchorRef}>
                <header className={styles.anchorHeader}>
                  <div>
                    <span>Mini-Block {anchor.blockNumber}.{anchor.miniBlockNumber}</span>
                    <code>{anchor.anchorRef}</code>
                  </div>
                  <small>{anchor.shots.length} Shot{anchor.shots.length === 1 ? "" : "s"} · {anchor.frames.length} Frame{anchor.frames.length === 1 ? "" : "s"}</small>
                </header>

                <div className={styles.beatSpan} aria-label={`Beats for ${anchor.anchorRef}`}>
                  <div className={styles.rowLabel}>BEAT</div>
                  {anchor.beats.length ? anchor.beats.map((beat) => (
                    <article className={styles.beat} key={beat.id}>
                      <strong>{String(beat.order).padStart(2, "0")} · {beat.label || beat.id}</strong>
                      <p>{beat.visualAction || beat.purpose || "Beat is authored without visual-action detail."}</p>
                    </article>
                  )) : (
                    <p className={styles.unassigned}>No authored Sequence Director Beat is attached to this anchor. PlotPickle leaves the Shots unassigned rather than inventing a Beat.</p>
                  )}
                </div>

                <div className={styles.shotRow} aria-label={`Shots for ${anchor.anchorRef}`}>
                  <div className={styles.rowLabel}>SHOT</div>
                  {anchor.shots.length ? anchor.shots.map((shot) => (
                    <button
                      aria-pressed={selectedShot?.id === shot.id}
                      className={styles.shot}
                      data-shot-source={shot.source}
                      key={shot.id}
                      onClick={() => setSelectedShotId(shot.id)}
                      type="button"
                    >
                      <span className={styles.shotNumber}>SHOT {String(shot.order).padStart(2, "0")}</span>
                      {shot.frames[0] ? <img alt={shot.frames[0].narrativePurpose || `Frame for Shot ${shot.order}`} src={shot.frames[0].assetUrl} /> : <span className={styles.noFrame}>NO LINKED FRAME</span>}
                      <strong>{shot.narrativePurpose || shot.visualIntent || "Shot intent not yet described"}</strong>
                      <small>{[shot.shotSize, shot.angle, shot.movement].filter(Boolean).join(" · ") || "Camera detail not authored"}</small>
                    </button>
                  )) : <p className={styles.unassigned}>No creative Shot exists at this Scene address yet. The 2,400 technical RenderClip grid is not used as a substitute.</p>}
                </div>

                <div className={styles.frameRow} aria-label={`Frames for ${anchor.anchorRef}`}>
                  <div className={styles.rowLabel}>FRAME</div>
                  {anchor.frames.length ? anchor.frames.map((frame) => (
                    <figure className={styles.frame} data-accepted={frame.accepted ? "true" : undefined} key={frame.id}>
                      <img alt={frame.narrativePurpose || "Storyboard Frame"} src={frame.assetUrl} />
                      <figcaption>{frame.accepted ? "KEPT" : "CANDIDATE"} · {frame.narrativePurpose || frame.id}</figcaption>
                    </figure>
                  )) : <p className={styles.unassigned}>No Storyboard Frame or visual candidate exists for this anchor yet.</p>}
                </div>

                {anchor.unassignedFrames.length ? (
                  <p className={styles.relationshipNote}>{anchor.unassignedFrames.length} Frame{anchor.unassignedFrames.length === 1 ? " is" : "s are"} attached to the anchor but not explicitly linked to a Shot. Visual Story does not guess that relationship.</p>
                ) : null}
              </section>
            ))}
          </div>

          <aside className={styles.inspector} aria-label="Selected Shot inspector">
            <p className={styles.kicker}>Selected Shot</p>
            {selectedShot ? (
              <>
                <h3>Shot {String(selectedShot.order).padStart(2, "0")}</h3>
                <code>{selectedShot.id}</code>
                <p className={styles.intent}>{selectedShot.narrativePurpose || selectedShot.visualIntent || "No narrative or visual intent has been authored for this Shot."}</p>
                <dl className={styles.shotFacts}>
                  <div><dt>Size</dt><dd>{detail(selectedShot.shotSize)}</dd></div>
                  <div><dt>Angle</dt><dd>{detail(selectedShot.angle)}</dd></div>
                  <div><dt>Movement</dt><dd>{detail(selectedShot.movement)}</dd></div>
                  <div><dt>Lens</dt><dd>{detail(selectedShot.lens)}</dd></div>
                  <div><dt>Timing</dt><dd>{selectedShot.durationSeconds === null ? "Untimed" : `${selectedShot.durationSeconds}s`}</dd></div>
                  <div><dt>State</dt><dd>{selectedShot.reviewState}</dd></div>
                </dl>

                <section className={styles.informationBoundary}>
                  <h4>AUDIENCE LEARNS NOW</h4>
                  {showNow.length ? showNow.map((directive) => (
                    <article key={directive.id}>
                      <strong>{directive.statement}</strong>
                      <p>{directive.carrier ? `Carrier: ${directive.carrier}` : "No carrier detail is recorded."}</p>
                    </article>
                  )) : <p>No SHOW_NOW information directive is recorded for this Shot.</p>}
                </section>

                <section className={styles.informationBoundary}>
                  <h4>AUDIENCE MUST NOT KNOW YET</h4>
                  {withholdNow.length ? withholdNow.map((directive) => (
                    <article key={directive.id}>
                      <strong>{directive.statement}</strong>
                      <p>{directive.protectionIntent || "No protection intent is recorded."}</p>
                      <small>Release: {directive.release.state}{directive.release.reference ? ` · ${directive.release.reference}` : ""}{directive.release.condition ? ` · ${directive.release.condition}` : ""}</small>
                    </article>
                  )) : <p>No WITHHOLD_NOW information directive is recorded for this Shot.</p>}
                </section>

                <details className={styles.informationBoundary} data-provider-instruction-inspection="read-only" id="production-inspection">
                  <summary>View generated director instructions</summary>
                  {instructionInspection ? (
                    <>
                      <p><strong>Disposable provider output — not Story / PPF / canon.</strong> Read-only inspection does not save or promote generated prose.</p>
                      <dl className={styles.shotFacts}>
                        <div><dt>Provider</dt><dd>{instructionInspection.providerId}</dd></div>
                        <div><dt>Strategy</dt><dd>{instructionInspection.strategy}</dd></div>
                        <div><dt>Direction</dt><dd>{instructionInspection.directionLevel}</dd></div>
                        <div><dt>PPF revision</dt><dd>{instructionInspection.canonicalRevision}</dd></div>
                      </dl>
                      {instructionInspection.instructions.length ? instructionInspection.instructions.map((instruction) => (
                        <article key={instruction.id}>
                          <strong>{instruction.scope === "master" ? "Master instruction" : `Shot instruction · ${instruction.editorialShotId || instruction.productionShotId || "selected Shot"}`}</strong>
                          <pre style={{ margin: "6px 0 0", overflowWrap: "anywhere", whiteSpace: "pre-wrap" }}>{instruction.text}</pre>
                        </article>
                      )) : <p>No generated per-shot instruction matches the selected Shot identity.</p>}
                      {instructionInspection.warnings.length ? (
                        <article>
                          <strong>Capability warnings</strong>
                          {instructionInspection.warnings.map((warning) => <p key={warning}>{warning}</p>)}
                        </article>
                      ) : null}
                      {instructionInspection.finishingRequirements.length ? (
                        <article>
                          <strong>Finishing / post requirements</strong>
                          {instructionInspection.finishingRequirements.map((requirement) => (
                            <p key={`${requirement.property}:${requirement.sourceRef || ""}`}>{requirement.property}{requirement.note ? ` — ${requirement.note}` : ""}</p>
                          ))}
                        </article>
                      ) : null}
                    </>
                  ) : (
                    <p>{providerInstructionInspection.error || "No generated provider instructions are available for this Scene yet. They appear after an already-selected provider target receives a Director Spec-ready scene."}</p>
                  )}
                </details>
              </>
            ) : (
              <p className={styles.unassigned}>Select a real Shot when one exists. Visual Story does not create a placeholder Shot merely to populate the inspector.</p>
            )}
          </aside>
        </div>
      ) : null}

      <SceneTimelineWorkspace
        active={view === "timeline"}
        onProjectChange={onProjectChange}
        onSelectShot={setSelectedShotId}
        project={project}
        selectedShotId={selectedShot?.id ?? ""}
        legacyProject={legacyProject}
        visualStory={projection}
      />

      <footer className={styles.boundary}>
        Projection only. Scene, Beat, Shot and Frame identities remain owned by their existing PlotPickle authorities. Visual Story and Scene Workspace share those identities; neither creates canon, approves candidates or converts technical RenderClips into creative Shots.
      </footer>
    </section>
  );
}
