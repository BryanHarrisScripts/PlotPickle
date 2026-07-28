"use client";

import type { ReactNode } from "react";
import {
  PRODUCTION_REPORT_SECTIONS,
  type AiSystemCategory,
  type ProductionReportSection,
  type ProductionReportsModel,
} from "@/lib/production-reports";
import type { ReportTarget } from "@/lib/consolidated-reports";
import styles from "./production-reports-workspace.module.css";

type ProductionReportsWorkspaceProps = {
  report: ProductionReportsModel;
  section: ProductionReportSection;
  onSectionChange: (section: ProductionReportSection) => void;
  onOpenTarget: (target: ReportTarget) => void;
};

function titleCase(value: string) {
  return value.replace(/[-_]+/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function EmptyState({ children }: { children: ReactNode }) {
  return <div className={styles.emptyState}>{children}</div>;
}

function Panel({
  eyebrow,
  title,
  children,
}: {
  eyebrow: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <section className={styles.panel}>
      <header>
        <div>
          <p>{eyebrow}</p>
          <h3>{title}</h3>
        </div>
      </header>
      {children}
    </section>
  );
}

function openScene(onOpenTarget: (target: ReportTarget) => void, scene: { id: string; blockId: string }) {
  onOpenTarget({
    workspace: "write",
    targetId: scene.id,
    blockId: scene.blockId,
    miniBlockId: "",
    sceneId: scene.id,
    characterId: "",
  });
}

export default function ProductionReportsWorkspace({
  report,
  section,
  onSectionChange,
  onOpenTarget,
}: ProductionReportsWorkspaceProps) {
  function renderOverview() {
    const values = [
      ["Scenes", report.overview.scenes],
      ["Pages", report.overview.pages],
      ["Locations", report.overview.locations],
      ["Cast", report.overview.cast],
      ["Shots", report.overview.shots],
      ["Storyboard frames", report.overview.storyboardFrames],
      ["Ready breakdowns", `${report.overview.readyBreakdowns}/${report.overview.breakdowns}`],
      ["Unscheduled scenes", report.overview.unscheduledScenes],
      ["Shooting Script", report.overview.shootingScript.mode === "production" ? "Production draft" : "Writer draft"],
      ["Locked production pages", report.overview.shootingScript.pages],
      ["Changed pages", report.overview.shootingScript.changedPages],
    ];
    return (
      <div className={styles.stack}>
        <div className={styles.metrics}>
          {values.map(([label, value]) => (
            <article key={label}>
              <span>{label}</span>
              <strong>{value}</strong>
            </article>
          ))}
        </div>
        <div className={styles.twoColumn}>
          <Panel eyebrow="Canonical readiness" title="Breakdowns and schedule">
            <dl className={styles.definitionGrid}>
              <div><dt>Breakdowns</dt><dd>{report.overview.breakdowns}</dd></div>
              <div><dt>Ready</dt><dd>{report.overview.readyBreakdowns}</dd></div>
              <div><dt>Blocked</dt><dd>{report.overview.blockedBreakdowns}</dd></div>
              <div><dt>Shooting days</dt><dd>{report.overview.scheduleDays}</dd></div>
              <div><dt>Production revisions</dt><dd>{report.overview.shootingScript.revisionSets}</dd></div>
              <div><dt>Production approvals</dt><dd>{report.overview.shootingScript.approvals}</dd></div>
            </dl>
          </Panel>
          <Panel eyebrow="Planning gaps" title="What to review next">
            <ul className={styles.guidanceList}>
              {report.overview.unscheduledScenes ? <li>{report.overview.unscheduledScenes} scenes are not assigned to a shooting day.</li> : <li>Every scene is assigned to a shooting day.</li>}
              {report.overview.blockedBreakdowns ? <li>{report.overview.blockedBreakdowns} breakdowns are blocked.</li> : <li>No breakdown is marked blocked.</li>}
              {!report.overview.shots ? <li>No canonical shots are available for coverage reporting.</li> : <li>{report.overview.shots} canonical shots feed the coverage report.</li>}
              {!report.overview.locations ? <li>No locations are linked to scenes or breakdowns.</li> : <li>{report.overview.locations} locations are ready for logistics review.</li>}
            </ul>
          </Panel>
        </div>
      </div>
    );
  }

  function renderLocations() {
    return (
      <Panel eyebrow="Location intelligence" title={`${report.locations.length} story and real-location plans`}>
        {report.locations.length ? (
          <div className={styles.tableWrap}>
            <table>
              <thead>
                <tr>
                  <th>Story / real location</th><th>Scenes</th><th>INT/EXT · time</th><th>Cast</th>
                  <th>Props · wardrobe · sound</th><th>Lighting · weather</th><th>Permits · travel</th>
                  <th>Accessibility · availability</th><th>Setup / shoot</th>
                </tr>
              </thead>
              <tbody>
                {report.locations.map((location) => (
                  <tr key={location.id}>
                    <td><strong>{location.storyLocation}</strong><small>{location.realLocation}</small>{location.description ? <small>{location.description}</small> : null}</td>
                    <td>
                      {location.scenes.map((scene) => (
                        <button type="button" key={scene.id} onClick={() => openScene(onOpenTarget, scene)}>#{scene.productionNumber}</button>
                      ))}
                    </td>
                    <td>{location.interiorExterior.join(", ") || "Not specified"}<small>{location.dayNight.join(", ") || "Not specified"}</small></td>
                    <td>{location.characters.join(", ") || "Not recorded"}</td>
                    <td>{location.props.join(", ") || "No props"}<small>{location.wardrobe.join(", ") || "No wardrobe"} · {location.sound.join(", ") || "No sound"}</small></td>
                    <td>{location.lighting}<small>{location.weather}</small></td>
                    <td>{location.permits}<small>{location.travel}</small></td>
                    <td>{location.accessibility}<small>{location.availability}</small></td>
                    <td><strong>{location.setupMinutes ? `${location.setupMinutes} min` : "Not set"}</strong><small>{location.estimatedShootHours ? `${location.estimatedShootHours} hr` : "Not estimated"} · {location.estimateBasis}</small></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <EmptyState>Link locations to scenes or breakdowns to begin production logistics.</EmptyState>}
      </Panel>
    );
  }

  function renderShotTypes() {
    return (
      <div className={styles.shotGrid}>
        {report.shotTypes.map((shotType) => (
          <article key={shotType.id} className={shotType.count ? styles.shotActive : ""}>
            <header><strong>{shotType.label}</strong><b>{shotType.count}</b></header>
            <p>{shotType.plannedShots} planned shots · {shotType.storyboardFrames} storyboard frames</p>
            <span>{shotType.guidance}</span>
            {shotType.scenes.length ? (
              <div className={styles.sceneLinks}>
                {shotType.scenes.slice(0, 8).map((scene) => (
                  <button type="button" key={scene.id} onClick={() => openScene(onOpenTarget, scene)}>Scene {scene.productionNumber}</button>
                ))}
              </div>
            ) : null}
          </article>
        ))}
      </div>
    );
  }

  function renderShootGroups() {
    return report.shootGroups.length ? (
      <div className={styles.groupGrid}>
        {report.shootGroups.map((group) => (
          <article key={group.id} className={styles.groupCard}>
            <header>
              <div><span>Suggested combination</span><h3>{group.label}</h3></div>
              <b className={`${styles.status} ${styles[`status${titleCase(group.status).replace(/\s/g, "")}`]}`}>{titleCase(group.status)}</b>
            </header>
            <p className={styles.groupSummary}>{group.scenes.length} scenes · {group.shotIds.length} shots · {titleCase(group.confidence)} confidence</p>
            <ul className={styles.reasonList}>{group.reasons.map((reason) => <li key={reason}>{reason}</li>)}</ul>
            <fieldset disabled>
              <legend>Saved scene selection</legend>
              {group.scenes.map((scene) => (
                <label key={scene.id}>
                  <input
                    type="checkbox"
                    checked={group.selectedSceneIds.includes(scene.id)}
                    readOnly
                  />
                  <span>Scene {scene.productionNumber} · {scene.title}</span>
                  <button type="button" onClick={() => openScene(onOpenTarget, scene)}>Open</button>
                </label>
              ))}
            </fieldset>
            <label className={styles.notesField}>
              <span>Saved producer note</span>
              <textarea
                key={`${group.id}-${group.notes}`}
                defaultValue={group.notes}
                placeholder="No producer note is recorded."
                readOnly
              />
            </label>
            <p>Reports is read-only. <a href="/production?scope=build&return=build">Open Build Production Planning</a> to adjust or approve shoot groups.</p>
          </article>
        ))}
      </div>
    ) : <EmptyState>No two scenes currently share enough canonical location and story-time data for a shoot-group proposal.</EmptyState>;
  }

  function renderActorSchedule() {
    return (
      <div className={styles.stack}>
        <Panel eyebrow="Actor / character" title={`${report.actorSchedule.actors.length} schedule records`}>
          {report.actorSchedule.actors.length ? (
            <div className={styles.tableWrap}>
              <table>
                <thead><tr><th>Actor / character</th><th>Scenes</th><th>Locations</th><th>Wardrobe / makeup</th><th>Rehearsal</th><th>Days / groups</th><th>Availability / conflicts</th></tr></thead>
                <tbody>
                  {report.actorSchedule.actors.map((actor) => (
                    <tr key={actor.id}>
                      <td><strong>{actor.actor}</strong><small>{actor.character}</small></td>
                      <td>{actor.scenes.map((scene) => <button type="button" key={scene.id} onClick={() => openScene(onOpenTarget, scene)}>#{scene.productionNumber}</button>)}<small>{actor.unscheduledScenes} unscheduled</small></td>
                      <td>{actor.locations.join(", ") || "Not linked"}</td>
                      <td>{actor.wardrobe.join(", ") || "Not recorded"}<small>{actor.makeup.join(", ") || "No makeup record"}</small></td>
                      <td>{actor.rehearsalHours ? `${actor.rehearsalHours} hr` : "Not recorded"}</td>
                      <td>{actor.daysRequired}<small>{actor.groupedScenes.join(", ") || "No proposed groups"}</small></td>
                      <td>{actor.availability.join(", ") || "Not recorded"}<small>{actor.conflicts.length ? `${actor.conflicts.length} conflict(s)` : "No saved conflicts"}</small></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : <EmptyState>Add characters to create actor schedule intelligence.</EmptyState>}
        </Panel>
        <div className={styles.twoColumn}>
          <Panel eyebrow="Shooting day" title="Calls, wraps and daily sides">
            {report.actorSchedule.byDay.length ? (
              <div className={styles.dayList}>
                {report.actorSchedule.byDay.map((day) => (
                  <article key={day.id}>
                    <header><strong>Day {day.dayNumber}{day.date ? ` · ${day.date}` : ""}</strong><b>{day.callTime || "Call not set"}–{day.wrapTime}</b></header>
                    <p>{day.location} · {day.characters.join(", ") || "Cast not resolved"}</p>
                    <small>{day.scenes.join(" · ") || "No canonical scenes"}</small>
                  </article>
                ))}
              </div>
            ) : <EmptyState>No shooting days are scheduled. Actor scenes remain visible above.</EmptyState>}
          </Panel>
          <Panel eyebrow="Conflict check" title={`${report.actorSchedule.conflicts.length} saved availability conflicts`}>
            {report.actorSchedule.conflicts.length ? (
              <div className={styles.dayList}>
                {report.actorSchedule.conflicts.map((conflict) => (
                  <article key={`${conflict.character}-${conflict.dayNumber}`}>
                    <strong>{conflict.actor} · {conflict.character}</strong>
                    <p>Day {conflict.dayNumber} · {conflict.date}</p>
                    <small>{conflict.reason}</small>
                  </article>
                ))}
              </div>
            ) : <EmptyState>No conflict is detectable from saved schedule dates and actor availability.</EmptyState>}
          </Panel>
        </div>
      </div>
    );
  }

  function renderTimeline() {
    return (
      <div className={styles.stack}>
        <div className={styles.timelineGrid}>
          {report.timeline.scenarios.map((scenario) => (
            <article key={scenario.id}>
              <span>{scenario.label}</span>
              <strong>{scenario.shootDays} shoot days</strong>
              <p>{scenario.totalDays} total with prep{scenario.id !== "optimistic" ? " and pickups" : ""}</p>
              <dl><div><dt>Pages/day</dt><dd>{scenario.pagesPerDay}</dd></div><div><dt>Scenes/day</dt><dd>{scenario.scenesPerDay}</dd></div></dl>
              <small>{scenario.assumption}</small>
            </article>
          ))}
        </div>
        <Panel eyebrow="Timeline inputs" title="Canonical load and schedule assumptions">
          <dl className={styles.definitionGrid}>
            <div><dt>Pages</dt><dd>{report.timeline.pages}</dd></div>
            <div><dt>Scenes</dt><dd>{report.timeline.scenes}</dd></div>
            <div><dt>Shots</dt><dd>{report.timeline.shots}</dd></div>
            <div><dt>Cast</dt><dd>{report.timeline.cast}</dd></div>
            <div><dt>Locations</dt><dd>{report.timeline.locations}</dd></div>
            <div><dt>Company moves</dt><dd>{report.timeline.moves}</dd></div>
            <div><dt>Night scenes</dt><dd>{report.timeline.nights}</dd></div>
            <div><dt>Setup hours</dt><dd>{report.timeline.setupHours}</dd></div>
            <div><dt>Lighting plans</dt><dd>{report.timeline.lightingPlans}</dd></div>
            <div><dt>Weather locations</dt><dd>{report.timeline.weatherLocations}</dd></div>
            <div><dt>Child/minor scenes</dt><dd>{report.timeline.childScenes}</dd></div>
            <div><dt>Animal scenes</dt><dd>{report.timeline.animalScenes}</dd></div>
            <div><dt>Stunt scenes</dt><dd>{report.timeline.stuntScenes}</dd></div>
            <div><dt>Effects scenes</dt><dd>{report.timeline.effectsScenes}</dd></div>
            <div><dt>Vehicle scenes</dt><dd>{report.timeline.vehicleScenes}</dd></div>
            <div><dt>Makeup scenes</dt><dd>{report.timeline.makeupScenes}</dd></div>
            <div><dt>Equipment cues</dt><dd>{report.timeline.equipmentSetups}</dd></div>
            <div><dt>Rehearsal hours</dt><dd>{report.timeline.rehearsalHours}</dd></div>
            <div><dt>Planned work</dt><dd>{report.timeline.workloadHours} hr</dd></div>
            <div><dt>Workday</dt><dd>{report.timeline.hoursPerDay} hr</dd></div>
            <div><dt>Prep</dt><dd>{report.timeline.prepDays} day(s)</dd></div>
            <div><dt>Pickups</dt><dd>{report.timeline.pickupDays} day(s)</dd></div>
            <div><dt>Contingency</dt><dd>{report.timeline.contingencyPercent}%</dd></div>
            <div><dt>Saved schedule</dt><dd>{report.timeline.existingScheduleDays} day(s)</dd></div>
          </dl>
        </Panel>
      </div>
    );
  }

  function renderRequirements() {
    return (
      <Panel eyebrow="Cross-department ledger" title="Production requirements">
        <div className={styles.requirementGrid}>
          {report.requirements.map((requirement) => (
            <article key={requirement.id}>
              <header><strong>{requirement.label}</strong><b className={`${styles.status} ${requirement.status === "identified" ? styles.statusAccepted : styles.statusProposed}`}>{titleCase(requirement.status)}</b></header>
              <p>{requirement.items.join(", ") || "Nothing recorded"}</p>
              <span>{requirement.scenes} scene(s) · {requirement.guidance}</span>
            </article>
          ))}
        </div>
      </Panel>
    );
  }

  function renderAiCategory(category: AiSystemCategory, label: string) {
    return (
      <Panel eyebrow={label} title="Three reviewed options">
        <div className={styles.aiGrid}>
          {report.aiSystems.categories[category].map((system, index) => (
            <article key={system.id}>
              <header><span>Option {index + 1}</span><b>{titleCase(system.apiStatus)}</b></header>
              <h4>{system.name}</h4>
              <p>{system.summary}</p>
              <dl>
                <div><dt>Provider</dt><dd>{system.provider}</dd></div>
                <div><dt>System</dt><dd>{system.modelOrService}</dd></div>
                <div><dt>Cost</dt><dd>{system.costModel}</dd></div>
                <div><dt>API / plugin</dt><dd>{titleCase(system.apiStatus)} / {titleCase(system.pluginStatus)}</dd></div>
                <div><dt>Deployment</dt><dd>{titleCase(system.deployment)}</dd></div>
                <div><dt>Rights & privacy</dt><dd>{system.licensingPrivacy}</dd></div>
                <div><dt>PlotPickle use</dt><dd>{system.recommendedUse}</dd></div>
              </dl>
              <div className={styles.sourceLinks}>
                {system.sources.map((source, sourceIndex) => <a key={source} href={source} target="_blank" rel="noreferrer">Source {sourceIndex + 1}</a>)}
              </div>
            </article>
          ))}
        </div>
      </Panel>
    );
  }

  function renderAiSystems() {
    return (
      <div className={styles.stack}>
        <div className={styles.reviewBanner}>
          <div><span>Reviewed</span><strong>{report.aiSystems.reviewedAt}</strong></div>
          <div><span>Next review due</span><strong>{report.aiSystems.nextReviewDue}</strong></div>
          <p>{report.aiSystems.editorialNote}</p>
        </div>
        {renderAiCategory("video", "Video generation")}
        {renderAiCategory("image", "Image generation")}
        {renderAiCategory("aggregator", "Multi-model aggregators")}
      </div>
    );
  }

  const content = section === "overview" ? renderOverview()
    : section === "locations" ? renderLocations()
      : section === "shot-types" ? renderShotTypes()
        : section === "shoot-groups" ? renderShootGroups()
          : section === "actor-schedule" ? renderActorSchedule()
            : section === "shooting-timeline" ? renderTimeline()
              : section === "requirements" ? renderRequirements()
                : renderAiSystems();

  return (
    <div className={styles.workspace}>
      <nav className={styles.submenu} aria-label="Production report sections">
        {PRODUCTION_REPORT_SECTIONS.map((item) => (
          <button
            type="button"
            key={item.id}
            className={section === item.id ? styles.active : ""}
            onClick={() => onSectionChange(item.id)}
          >
            <strong>{item.label}</strong>
            <span>{item.description}</span>
          </button>
        ))}
      </nav>
      <div className={styles.content}>
        <div className={styles.guidance} role="note">
          <strong>Production planning guidance</strong>
          <span>{report.guidance}</span>
        </div>
        {content}
      </div>
    </div>
  );
}
