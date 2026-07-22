"use client";

import { useEffect, useMemo, useState } from "react";
import styles from "./preproduction-workspace.module.css";
import {
  buildAnimaticTimeline,
  buildShotCoverage,
  createShotFromFrame,
  createSonicCue,
  ensureProductionWorkspace,
  generateProductionBreakdowns,
  generateProductionSchedule,
  productionCoverage,
  removeProductionShot,
  removeSonicCue,
  updateProductionBreakdown,
  updateProductionShot,
  updateScheduleDay,
  updateSonicCue,
} from "@/lib/preproduction";
import type { PlotPickleProject, ProductionBreakdown, ProductionScheduleDay, ProductionShot, SonicCue } from "@/lib/project";

type View = "shots" | "sonic" | "animatic" | "breakdowns" | "schedule" | "distribution";

const views: Array<{ id: View; label: string; description: string }> = [
  { id: "shots", label: "Shot Designer", description: "Turn scenes and storyboard frames into a coverage plan." },
  { id: "sonic", label: "Sonic Bible", description: "Plan score, source music, atmosphere, sound effects and silence." },
  { id: "animatic", label: "Animatic", description: "Play the storyboard, shots, dialogue and cue labels as one timeline." },
  { id: "breakdowns", label: "Breakdowns", description: "Extract cast, locations, props, effects, sound and production needs." },
  { id: "schedule", label: "Schedule", description: "Group breakdowns into practical shoot days." },
  { id: "distribution", label: "Distribution", description: "Plan positioning, release pathways and marketing materials." },
];

function excerpt(value: string, length = 80) {
  const clean = value.replace(/\s+/g, " ").trim();
  return clean.length > length ? `${clean.slice(0, length)}…` : clean;
}

function numberValue(value: string, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export default function PreproductionWorkspace({ project, onProjectChange }: { project: PlotPickleProject; onProjectChange: (project: PlotPickleProject) => void }) {
  const active = useMemo(() => ensureProductionWorkspace(project), [project]);
  const [view, setView] = useState<View>("shots");
  const [blockNumber, setBlockNumber] = useState(1);
  const [sceneId, setSceneId] = useState(active.blocks[0]?.scenes[0]?.id || "");
  const [frameId, setFrameId] = useState(active.blocks[0]?.visuals[0]?.id || "");
  const [selectedShotId, setSelectedShotId] = useState("");
  const [selectedCueId, setSelectedCueId] = useState("");
  const [animaticIndex, setAnimaticIndex] = useState(0);
  const [playing, setPlaying] = useState(false);

  const block = active.blocks.find((candidate) => candidate.number === blockNumber) ?? active.blocks[0];
  const shots = active.production.shots.filter((shot) => shot.blockNumber === blockNumber);
  const cues = active.production.cues.filter((cue) => cue.blockNumber === blockNumber);
  const selectedShot = active.production.shots.find((shot) => shot.id === selectedShotId) ?? shots[0];
  const selectedCue = active.production.cues.find((cue) => cue.id === selectedCueId) ?? cues[0];
  const coverage = useMemo(() => buildShotCoverage(active), [active]);
  const timeline = useMemo(() => buildAnimaticTimeline(active), [active]);
  const metrics = useMemo(() => productionCoverage(active), [active]);
  const currentFrame = timeline[Math.min(animaticIndex, Math.max(0, timeline.length - 1))];

  useEffect(() => {
    if (!playing || !currentFrame) return;
    const timer = window.setTimeout(() => setAnimaticIndex((index) => index + 1 >= timeline.length ? 0 : index + 1), Math.max(1, currentFrame.durationSeconds) * 1000);
    return () => window.clearTimeout(timer);
  }, [playing, currentFrame, timeline.length]);

  function save(next: PlotPickleProject) {
    onProjectChange(next);
  }

  function chooseBlock(nextNumber: number) {
    const next = active.blocks.find((candidate) => candidate.number === nextNumber) ?? active.blocks[0];
    setBlockNumber(next.number);
    setSceneId(next.scenes[0]?.id || "");
    setFrameId(next.visuals[0]?.id || "");
    setSelectedShotId("");
    setSelectedCueId("");
  }

  function patchShot(patch: Partial<ProductionShot>) {
    if (!selectedShot) return;
    save(updateProductionShot(active, selectedShot.id, patch));
  }

  function patchCue(patch: Partial<SonicCue>) {
    if (!selectedCue) return;
    save(updateSonicCue(active, selectedCue.id, patch));
  }

  const sceneOptions = block?.scenes ?? [];
  const frameOptions = block?.visuals ?? [];

  return (
    <section className={styles.workspace} aria-labelledby="preproduction-title">
      <header className={styles.hero}>
        <div>
          <p>PlotPickle 0.17 · Page to production</p>
          <h1 id="preproduction-title">One continuous pre-production plan.</h1>
          <span>The 24 Blocks, flexible scenes, screenplay, storyboard frames, shots, sound cues, breakdowns, schedule and release plan remain connected through stable project IDs.</span>
        </div>
        <div className={styles.metrics}>
          <article><strong>{metrics.shots}</strong><span>planned shots</span></article>
          <article><strong>{metrics.keyframes}</strong><span>keyframes linked</span></article>
          <article><strong>{metrics.cues}</strong><span>sound cues</span></article>
          <article><strong>{metrics.completedBlocks}/24</strong><span>blocks production-ready</span></article>
          <article><strong>{metrics.breakdowns}/{metrics.sceneCount}</strong><span>scene breakdowns</span></article>
          <article><strong>{metrics.scheduleDays}</strong><span>shoot days</span></article>
        </div>
      </header>

      <nav className={styles.tabs} aria-label="Pre-production workspaces">
        {views.map((item) => <button key={item.id} className={view === item.id ? styles.activeTab : ""} onClick={() => setView(item.id)}><strong>{item.label}</strong><span>{item.description}</span></button>)}
      </nav>

      {view !== "distribution" && view !== "animatic" ? (
        <div className={styles.contextBar}>
          <label>Block<select value={blockNumber} onChange={(event) => chooseBlock(Number(event.target.value))}>{active.blocks.map((item) => <option key={item.id} value={item.number}>{item.number}. {item.title}</option>)}</select></label>
          <label>Scene<select value={sceneId} onChange={(event) => setSceneId(event.target.value)}>{sceneOptions.map((scene) => <option key={scene.id} value={scene.id}>Scene {scene.number}: {scene.title || scene.purpose || "Untitled"}</option>)}</select></label>
          {view === "shots" ? <label>Storyboard frame<select value={frameId} onChange={(event) => setFrameId(event.target.value)}>{frameOptions.map((frame) => <option key={frame.id} value={frame.id}>Mini-block {frame.miniBlockNumber}: {excerpt(frame.caption || frame.alt || "Open visual slot")}</option>)}</select></label> : null}
        </div>
      ) : null}

      {view === "shots" ? (
        <div className={styles.twoColumn}>
          <div className={styles.panel}>
            <div className={styles.panelTitle}><div><p>Coverage plan</p><h2>Shot Designer</h2></div><button className={styles.primary} onClick={() => { const next = createShotFromFrame(active, blockNumber, sceneId, frameId); const created = next.production.shots.at(-1); save(next); if (created) setSelectedShotId(created.id); }}>Add shot from frame</button></div>
            <div className={styles.framePreview}>{frameOptions.find((frame) => frame.id === frameId)?.src ? <img src={frameOptions.find((frame) => frame.id === frameId)?.src} alt={frameOptions.find((frame) => frame.id === frameId)?.alt || "Storyboard frame"} /> : <div><strong>Open keyframe slot</strong><span>Add or approve a visual in the Visual Board, then link it here.</span></div>}</div>
            <div className={styles.cardList}>{shots.length ? shots.map((shot) => <button key={shot.id} className={selectedShot?.id === shot.id ? styles.selectedCard : styles.card} onClick={() => setSelectedShotId(shot.id)}><strong>Shot {shot.shotNumber} · {shot.shotSize}</strong><span>{shot.status} · {shot.durationSeconds}s</span><p>{excerpt(shot.purpose || shot.composition)}</p></button>) : <p className={styles.empty}>No shots are planned for this block.</p>}</div>
          </div>
          <div className={styles.panel}>
            <div className={styles.panelTitle}><div><p>Selected shot</p><h2>{selectedShot ? `Shot ${selectedShot.shotNumber}` : "Choose or add a shot"}</h2></div>{selectedShot ? <button onClick={() => { save(removeProductionShot(active, selectedShot.id)); setSelectedShotId(""); }}>Remove</button> : null}</div>
            {selectedShot ? <div className={styles.formGrid}>
              <label>Shot size<input value={selectedShot.shotSize} onChange={(event) => patchShot({ shotSize: event.target.value })} /></label>
              <label>Angle<input value={selectedShot.angle} onChange={(event) => patchShot({ angle: event.target.value })} /></label>
              <label>Movement<input value={selectedShot.movement} onChange={(event) => patchShot({ movement: event.target.value })} /></label>
              <label>Lens<input value={selectedShot.lens} onChange={(event) => patchShot({ lens: event.target.value })} /></label>
              <label>Status<select value={selectedShot.status} onChange={(event) => patchShot({ status: event.target.value as ProductionShot["status"] })}><option value="planned">Planned</option><option value="approved">Approved</option><option value="captured">Captured</option><option value="omitted">Omitted</option></select></label>
              <label>Duration seconds<input type="number" min="1" value={selectedShot.durationSeconds} onChange={(event) => patchShot({ durationSeconds: numberValue(event.target.value, 1) })} /></label>
              <label className={styles.full}>Composition<textarea value={selectedShot.composition} onChange={(event) => patchShot({ composition: event.target.value })} /></label>
              <label className={styles.full}>Narrative purpose<textarea value={selectedShot.purpose} onChange={(event) => patchShot({ purpose: event.target.value })} /></label>
              <label className={styles.full}>Continuity<textarea value={selectedShot.continuity} onChange={(event) => patchShot({ continuity: event.target.value })} /></label>
              <label className={styles.full}>Keyframe path or data URL<input value={selectedShot.keyframeSrc} onChange={(event) => patchShot({ keyframeSrc: event.target.value })} /></label>
              <label className={styles.full}>Notes<textarea value={selectedShot.notes} onChange={(event) => patchShot({ notes: event.target.value })} /></label>
            </div> : <p className={styles.empty}>Select a shot to edit its production details.</p>}
          </div>
          <div className={`${styles.panel} ${styles.fullWidth}`}><div className={styles.panelTitle}><div><p>24-block coverage</p><h2>Missing coverage alerts</h2></div></div><div className={styles.coverageGrid}>{coverage.map((row) => <button key={row.blockNumber} className={row.complete ? styles.coverageComplete : styles.coverageOpen} onClick={() => chooseBlock(row.blockNumber)}><strong>{row.blockNumber}</strong><span>{row.shots} shots · {row.keyframes}/{row.frames} frames · {row.cues} cues</span><small>{row.complete ? "Ready" : `${row.missingSceneIds.length} scenes and ${row.missingFrameIds.length} frames need coverage`}</small></button>)}</div></div>
        </div>
      ) : null}

      {view === "sonic" ? (
        <div className={styles.twoColumn}>
          <div className={styles.panel}><div className={styles.panelTitle}><div><p>Sound plan</p><h2>Sonic Bible and Cue Sheet</h2></div><button className={styles.primary} onClick={() => { const next = createSonicCue(active, blockNumber, sceneId); const created = next.production.cues.at(-1); save(next); if (created) setSelectedCueId(created.id); }}>Add cue</button></div><p className={styles.help}>Use score, source music, atmosphere, sound effects or deliberate silence. Every cue remains linked to its scene and block.</p><div className={styles.cardList}>{cues.length ? cues.map((cue) => <button key={cue.id} className={selectedCue?.id === cue.id ? styles.selectedCard : styles.card} onClick={() => setSelectedCueId(cue.id)}><strong>{cue.cueNumber} · {cue.title}</strong><span>{cue.type} · {cue.status}</span><p>{excerpt(cue.purpose)}</p></button>) : <p className={styles.empty}>No sound cues are planned for this block.</p>}</div></div>
          <div className={styles.panel}><div className={styles.panelTitle}><div><p>Selected cue</p><h2>{selectedCue?.cueNumber || "Choose or add a cue"}</h2></div>{selectedCue ? <button onClick={() => { save(removeSonicCue(active, selectedCue.id)); setSelectedCueId(""); }}>Remove</button> : null}</div>{selectedCue ? <div className={styles.formGrid}>
            <label>Cue number<input value={selectedCue.cueNumber} onChange={(event) => patchCue({ cueNumber: event.target.value })} /></label><label>Type<select value={selectedCue.type} onChange={(event) => patchCue({ type: event.target.value as SonicCue["type"] })}><option value="score">Score</option><option value="source">Source music</option><option value="atmosphere">Atmosphere</option><option value="sfx">Sound effect</option><option value="silence">Silence</option></select></label>
            <label className={styles.full}>Title<input value={selectedCue.title} onChange={(event) => patchCue({ title: event.target.value })} /></label><label className={styles.full}>Motif or sonic identity<textarea value={selectedCue.motif} onChange={(event) => patchCue({ motif: event.target.value })} /></label>
            <label>Cue in<input value={selectedCue.cueIn} onChange={(event) => patchCue({ cueIn: event.target.value })} /></label><label>Cue out<input value={selectedCue.cueOut} onChange={(event) => patchCue({ cueOut: event.target.value })} /></label>
            <label>Status<select value={selectedCue.status} onChange={(event) => patchCue({ status: event.target.value as SonicCue["status"] })}><option value="temp">Temp</option><option value="original">Original</option><option value="approved">Approved</option><option value="licensed">Licensed</option><option value="clearance-needed">Clearance needed</option></select></label><label>Duration seconds<input type="number" min="0" value={selectedCue.durationSeconds} onChange={(event) => patchCue({ durationSeconds: numberValue(event.target.value) })} /></label>
            <label className={styles.full}>Dramatic purpose<textarea value={selectedCue.purpose} onChange={(event) => patchCue({ purpose: event.target.value })} /></label><label className={styles.full}>Rights and clearance<textarea value={selectedCue.rights} onChange={(event) => patchCue({ rights: event.target.value })} /></label><label className={styles.full}>Notes<textarea value={selectedCue.notes} onChange={(event) => patchCue({ notes: event.target.value })} /></label>
          </div> : <p className={styles.empty}>Select a cue to edit it.</p>}</div>
        </div>
      ) : null}

      {view === "animatic" ? (
        <div className={styles.animaticLayout}>
          <div className={styles.animaticStage}>{currentFrame?.image ? <img src={currentFrame.image} alt={currentFrame.alt || currentFrame.title} /> : <div className={styles.noImage}>No keyframe for this timeline position</div>}<div className={styles.animaticOverlay}><span>{currentFrame ? `${currentFrame.blockNumber}.${currentFrame.miniBlockNumber}` : "—"}</span><h2>{currentFrame?.title || "Animatic timeline"}</h2><p>{currentFrame?.caption}</p>{active.production.animatic.includeDialogue && currentFrame?.dialogue ? <blockquote>{currentFrame.dialogue}</blockquote> : null}{active.production.animatic.showCueLabels && currentFrame?.cues.length ? <div className={styles.cueLabels}>{currentFrame.cues.map((cue) => <small key={cue.id}>{cue.cueNumber} · {cue.title}</small>)}</div> : null}</div></div>
          <aside className={styles.panel}><div className={styles.panelTitle}><div><p>Playback</p><h2>Storyboard animatic</h2></div></div><div className={styles.playControls}><button onClick={() => setAnimaticIndex((index) => Math.max(0, index - 1))}>Previous</button><button className={styles.primary} onClick={() => setPlaying((value) => !value)}>{playing ? "Pause" : "Play"}</button><button onClick={() => setAnimaticIndex((index) => Math.min(timeline.length - 1, index + 1))}>Next</button></div><label>Default frame seconds<input type="number" min="1" value={active.production.animatic.defaultFrameSeconds} onChange={(event) => save({ ...active, production: { ...active.production, animatic: { ...active.production.animatic, defaultFrameSeconds: numberValue(event.target.value, 4), updatedAt: new Date().toISOString() } } })} /></label><label className={styles.check}><input type="checkbox" checked={active.production.animatic.includeDialogue} onChange={(event) => save({ ...active, production: { ...active.production, animatic: { ...active.production.animatic, includeDialogue: event.target.checked, updatedAt: new Date().toISOString() } } })} />Show dialogue excerpts</label><label className={styles.check}><input type="checkbox" checked={active.production.animatic.showCueLabels} onChange={(event) => save({ ...active, production: { ...active.production, animatic: { ...active.production.animatic, showCueLabels: event.target.checked, updatedAt: new Date().toISOString() } } })} />Show cue labels</label><p className={styles.help}>{animaticIndex + 1} of {timeline.length} frames · {currentFrame?.durationSeconds || 0}s</p></aside>
          <div className={`${styles.timeline} ${styles.fullWidth}`}>{timeline.map((item, index) => <button key={item.id} className={index === animaticIndex ? styles.timelineActive : ""} onClick={() => { setAnimaticIndex(index); setPlaying(false); }}>{item.image ? <img src={item.image} alt="" /> : <span>No image</span>}<strong>{item.blockNumber}.{item.miniBlockNumber}</strong><small>{item.shots.length} shots · {item.cues.length} cues</small></button>)}</div>
        </div>
      ) : null}

      {view === "breakdowns" ? <BreakdownView project={active} onChange={save} /> : null}
      {view === "schedule" ? <ScheduleView project={active} onChange={save} /> : null}
      {view === "distribution" ? <DistributionView project={active} onChange={save} /> : null}
    </section>
  );
}

function BreakdownView({ project, onChange }: { project: PlotPickleProject; onChange: (project: PlotPickleProject) => void }) {
  const [selectedId, setSelectedId] = useState(project.production.breakdowns[0]?.id || "");
  const selected = project.production.breakdowns.find((item) => item.id === selectedId) ?? project.production.breakdowns[0];
  function patch(patchValue: Partial<ProductionBreakdown>) { if (selected) onChange(updateProductionBreakdown(project, selected.id, patchValue)); }
  return <div className={styles.twoColumn}><div className={styles.panel}><div className={styles.panelTitle}><div><p>Scene extraction</p><h2>Production Breakdowns</h2></div><button className={styles.primary} onClick={() => onChange(generateProductionBreakdowns(project))}>Generate or refresh</button></div><p className={styles.help}>Breakdowns are derived from stable scenes and preserve manual production notes when refreshed.</p><div className={styles.cardList}>{project.production.breakdowns.length ? project.production.breakdowns.map((item) => { const block = project.blocks[item.blockNumber - 1]; const scene = block?.scenes.find((candidate) => candidate.id === item.sceneId); return <button key={item.id} className={selected?.id === item.id ? styles.selectedCard : styles.card} onClick={() => setSelectedId(item.id)}><strong>B{item.blockNumber} · {scene?.title || `Scene ${scene?.number || ""}`}</strong><span>{item.readiness} · {item.estimatedHours}h</span><p>{item.castIds.length} cast · {item.locationIds.length} locations</p></button>; }) : <p className={styles.empty}>Generate breakdowns from the current scene plan.</p>}</div></div><div className={styles.panel}><div className={styles.panelTitle}><div><p>Selected scene</p><h2>{selected ? `Block ${selected.blockNumber} breakdown` : "No breakdown selected"}</h2></div></div>{selected ? <div className={styles.formGrid}><label>Readiness<select value={selected.readiness} onChange={(event) => patch({ readiness: event.target.value as ProductionBreakdown["readiness"] })}><option value="draft">Draft</option><option value="reviewed">Reviewed</option><option value="ready">Ready</option><option value="blocked">Blocked</option></select></label><label>Estimated hours<input type="number" min="1" value={selected.estimatedHours} onChange={(event) => patch({ estimatedHours: numberValue(event.target.value, 1) })} /></label>{(["props", "wardrobe", "vehicles", "effects", "stunts", "extras", "makeup", "sound", "notes"] as const).map((key) => <label key={key} className={styles.full}>{key[0].toUpperCase() + key.slice(1)}<textarea value={selected[key]} onChange={(event) => patch({ [key]: event.target.value })} /></label>)}</div> : <p className={styles.empty}>Generate and select a breakdown.</p>}</div></div>;
}

function ScheduleView({ project, onChange }: { project: PlotPickleProject; onChange: (project: PlotPickleProject) => void }) {
  function patch(day: ProductionScheduleDay, patchValue: Partial<ProductionScheduleDay>) { onChange(updateScheduleDay(project, day.id, patchValue)); }
  return <div className={styles.panel}><div className={styles.panelTitle}><div><p>Production calendar</p><h2>Breakdown-driven shooting schedule</h2></div><button className={styles.primary} onClick={() => onChange(generateProductionSchedule(project))}>Generate schedule</button></div><p className={styles.help}>The first pass groups scenes by primary location and keeps generated days near ten estimated hours. Adjust dates, call times and company-move realities manually.</p><div className={styles.scheduleGrid}>{project.production.schedule.length ? project.production.schedule.map((day) => <article key={day.id}><header><strong>Day {day.dayNumber}</strong><span>{day.estimatedHours}h · {day.sceneIds.length} scenes</span></header><label>Date<input type="date" value={day.date} onChange={(event) => patch(day, { date: event.target.value })} /></label><label>Call time<input type="time" value={day.callTime} onChange={(event) => patch(day, { callTime: event.target.value })} /></label><label>Status<select value={day.status} onChange={(event) => patch(day, { status: event.target.value as ProductionScheduleDay["status"] })}><option value="planned">Planned</option><option value="confirmed">Confirmed</option><option value="completed">Completed</option><option value="moved">Moved</option></select></label><label>Location<select value={day.locationId} onChange={(event) => patch(day, { locationId: event.target.value })}><option value="location-tbd">Location TBD</option>{project.world.locations.map((location) => <option key={location.id} value={location.id}>{location.name}</option>)}</select></label><label>Notes<textarea value={day.notes} onChange={(event) => patch(day, { notes: event.target.value })} /></label><small>{day.sceneIds.join(", ")}</small></article>) : <p className={styles.empty}>Generate breakdowns, then create the first shooting schedule.</p>}</div></div>;
}

function DistributionView({ project, onChange }: { project: PlotPickleProject; onChange: (project: PlotPickleProject) => void }) {
  const plan = project.production.distribution;
  function patch(key: keyof typeof plan, value: string) { onChange({ ...project, production: { ...project.production, distribution: { ...plan, [key]: value, updatedAt: new Date().toISOString() } } }); }
  const fields: Array<[keyof typeof plan, string, string]> = [
    ["audience", "Core audience", "Who is most likely to care and why?"], ["positioning", "Positioning", "The promise, distinction and market frame"], ["releasePath", "Release pathway", "Festival, sales, distributor, direct or hybrid route"], ["festivalTargets", "Festival targets", "Priority tiers, deadlines and premiere requirements"], ["distributorTargets", "Distributor and sales targets", "Companies, territories and relationships"], ["salesMaterials", "Sales materials", "Screenplay, pitch package, budget, cast, lookbook and screener"], ["trailerPlan", "Trailer plan", "Hook, structure, runtime and required shots"], ["posterPlan", "Poster and key art", "Central image, title treatment and campaign variants"], ["socialCampaign", "Social campaign", "Audience journey, channels, assets and release cadence"], ["pressAngles", "Press angles", "Creator story, themes, technology, cast and production hooks"],
  ];
  return <div className={styles.twoColumn}><div className={styles.panel}><div className={styles.panelTitle}><div><p>Release strategy</p><h2>Distribution and Marketing Planner</h2></div></div><p className={styles.help}>Connect the creative promise to practical sales materials and a release path. This remains planning guidance, not a guarantee of distribution.</p>{fields.slice(0, 5).map(([key, label, help]) => <label key={key}>{label}<span className={styles.fieldHelp}>{help}</span><textarea value={String(plan[key])} onChange={(event) => patch(key, event.target.value)} /></label>)}</div><div className={styles.panel}><div className={styles.panelTitle}><div><p>Campaign materials</p><h2>Market-facing production plan</h2></div></div>{fields.slice(5).map(([key, label, help]) => <label key={key}>{label}<span className={styles.fieldHelp}>{help}</span><textarea value={String(plan[key])} onChange={(event) => patch(key, event.target.value)} /></label>)}</div></div>;
}
