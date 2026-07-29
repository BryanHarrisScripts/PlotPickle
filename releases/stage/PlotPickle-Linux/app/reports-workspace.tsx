"use client";

import { useMemo, type ReactNode } from "react";
import styles from "./reports-workspace.module.css";
import ProductionReportsWorkspace from "./production-reports-workspace";
import {
  CONSOLIDATED_REPORT_SECTIONS,
  createConsolidatedReportsModel,
  type ConsolidatedReportSection,
  type ReportMetric,
  type ReportTarget,
  type ReportsRuntimeConnections,
} from "@/lib/consolidated-reports";
import type { PlotPickleProject } from "@/lib/project";
import type { ProductionReportSection } from "@/lib/production-reports";

type ReportsWorkspaceProps = {
  project: PlotPickleProject;
  section: ConsolidatedReportSection;
  onSectionChange: (section: ConsolidatedReportSection) => void;
  productionSection: ProductionReportSection;
  onProductionSectionChange: (section: ProductionReportSection) => void;
  onOpenTarget: (target: ReportTarget) => void;
  runtimeConnections?: ReportsRuntimeConnections;
};

function titleCase(value: string) {
  return value
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function secondsLabel(seconds: number) {
  if (!seconds) return "0 sec";
  const minutes = Math.floor(seconds / 60);
  const remainder = Math.round(seconds % 60);
  return minutes ? `${minutes} min${remainder ? ` ${remainder} sec` : ""}` : `${remainder} sec`;
}

function dateLabel(value: string) {
  if (!value) return "Not recorded";
  const date = new Date(value);
  return Number.isNaN(date.valueOf()) ? value : date.toLocaleString();
}

function EmptyState({ children }: { children: ReactNode }) {
  return <div className={styles.emptyState}>{children}</div>;
}

function SectionCard({
  eyebrow,
  title,
  children,
  className = "",
}: {
  eyebrow: string;
  title: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`${styles.panel} ${className}`}>
      <header className={styles.panelHeading}>
        <div>
          <p>{eyebrow}</p>
          <h2>{title}</h2>
        </div>
      </header>
      {children}
    </section>
  );
}

function MetricGrid({
  metrics,
  onOpen,
}: {
  metrics: ReportMetric[];
  onOpen: (target: ReportTarget) => void;
}) {
  return (
    <div className={styles.metricGrid}>
      {metrics.map((metric) => {
        const content = (
          <>
            <span className={styles.metricTopline}>
              <b>{metric.label}</b>
              <i className={`${styles.signal} ${styles[`signal${titleCase(metric.signal).replace(/\s/g, "")}`]}`}>
                {titleCase(metric.signal)}
              </i>
            </span>
            <strong>{metric.value}</strong>
            <small>{metric.detail}</small>
          </>
        );
        return metric.target ? (
          <button type="button" className={styles.metric} key={metric.id} onClick={() => onOpen(metric.target!)}>
            {content}
            <span className={styles.openLabel}>Open context</span>
          </button>
        ) : (
          <article className={styles.metric} key={metric.id}>{content}</article>
        );
      })}
    </div>
  );
}

function SummaryStrip({ values }: { values: Array<{ label: string; value: string | number; detail?: string }> }) {
  return (
    <div className={styles.summaryStrip}>
      {values.map((item) => (
        <article key={item.label}>
          <span>{item.label}</span>
          <strong>{item.value}</strong>
          {item.detail ? <small>{item.detail}</small> : null}
        </article>
      ))}
    </div>
  );
}

export default function ReportsWorkspace({
  project,
  section,
  onSectionChange,
  productionSection,
  onProductionSectionChange,
  onOpenTarget,
  runtimeConnections = {},
}: ReportsWorkspaceProps) {
  const model = useMemo(
    () => createConsolidatedReportsModel(project, runtimeConnections),
    [project, runtimeConnections],
  );
  const definition = CONSOLIDATED_REPORT_SECTIONS.find((item) => item.id === section) ?? CONSOLIDATED_REPORT_SECTIONS[0];

  function openTarget(target: ReportTarget) {
    if (target.workspace === "reports" && CONSOLIDATED_REPORT_SECTIONS.some((item) => item.id === target.targetId)) {
      onSectionChange(target.targetId as ConsolidatedReportSection);
      return;
    }
    onOpenTarget(target);
  }

  function renderProject() {
    return (
      <div className={styles.reportStack}>
        <MetricGrid metrics={model.project.metrics} onOpen={openTarget} />
        <SectionCard eyebrow="Canonical completeness" title="Population by project area">
          <div className={styles.progressList}>
            {model.project.population.map((item) => {
              const percent = item.total ? Math.round((item.populated / item.total) * 100) : 0;
              return (
                <article key={item.id}>
                  <div>
                    <strong>{item.label}</strong>
                    <span>{item.populated}/{item.total} fields · {percent}%</span>
                  </div>
                  <div className={styles.progressTrack}><i style={{ width: `${percent}%` }} /></div>
                  <b className={`${styles.statusPill} ${styles[`status${titleCase(item.status)}`]}`}>{titleCase(item.status)}</b>
                </article>
              );
            })}
          </div>
        </SectionCard>
      </div>
    );
  }

  function renderStory() {
    const report = model.story;
    return (
      <div className={styles.reportStack}>
        <SummaryStrip values={[
          { label: "Blocks complete", value: `${report.completion.blocks}/${report.completion.totalBlocks}` },
          { label: "Mini-blocks ready", value: `${report.completion.miniBlocks}/${report.completion.totalMiniBlocks}` },
          { label: "Setups", value: report.setupPayoff.setups, detail: `${report.setupPayoff.unresolvedSetups} unresolved` },
          { label: "Payoffs", value: report.setupPayoff.payoffs, detail: `${report.setupPayoff.unresolvedPayoffs} unresolved` },
          { label: "Average shot", value: secondsLabel(report.averageShotSeconds) },
        ]} />
        <div className={styles.twoColumn}>
          <SectionCard eyebrow="Four-act balance" title="Acts">
            <div className={styles.cardList}>
              {report.acts.map((act) => (
                <button type="button" key={act.act} onClick={() => openTarget(act.target)}>
                  <span><b>Act {act.act}</b><small>{act.completedBlocks}/{act.blocks} Blocks complete</small></span>
                  <span><strong>{Math.round(act.sceneSeconds / 60)} min</strong><small>{act.targetMinutes} min target</small></span>
                </button>
              ))}
            </div>
          </SectionCard>
          <SectionCard eyebrow="Structure diagnostics" title={`${report.diagnostics.length} signals`}>
            {report.diagnostics.length ? (
              <div className={styles.warningList}>
                {report.diagnostics.slice(0, 18).map((warning, index) => (
                  <article key={`${warning.kind}-${warning.targetId}-${index}`}>
                    <b>{titleCase(warning.kind)}</b>
                    <span>{warning.message}</span>
                  </article>
                ))}
              </div>
            ) : <EmptyState>No structural warnings are active.</EmptyState>}
          </SectionCard>
        </div>
        <SectionCard eyebrow="Twelve sequences" title="Sequence balance and escalation">
          <div className={styles.tableWrap}>
            <table>
              <thead><tr><th>Sequence</th><th>Act</th><th>Blocks</th><th>Runtime</th><th>Target</th><th>Escalation</th><th /></tr></thead>
              <tbody>
                {report.sequences.map((sequence) => (
                  <tr key={sequence.id}>
                    <td><strong>{sequence.number}. {sequence.title}</strong></td>
                    <td>{sequence.act}</td>
                    <td>{sequence.completedBlocks}/{sequence.blockCount}</td>
                    <td>{Math.round(sequence.sceneSeconds / 60)} min</td>
                    <td>{sequence.targetMinutes} min</td>
                    <td>{sequence.escalation || sequence.turningPoint || "Not described"}</td>
                    <td><button type="button" onClick={() => openTarget(sequence.target)}>Open</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </SectionCard>
        <div className={styles.twoColumn}>
          <SectionCard eyebrow="Character change" title="Arc checkpoints">
            {report.characterArcs.length ? <div className={styles.cardList}>
              {report.characterArcs.map((character) => (
                <button type="button" key={character.id} onClick={() => openTarget(character.target)}>
                  <span><b>{character.name}</b><small>{character.opening || "Opening state not set"} → {character.ending || "Ending state not set"}</small></span>
                  <strong>{character.completedCheckpoints}/{character.checkpoints}</strong>
                </button>
              ))}
            </div> : <EmptyState>Add characters to begin arc reporting.</EmptyState>}
          </SectionCard>
          <SectionCard eyebrow="Storylines" title="Thread coverage">
            {report.storylines.length ? <div className={styles.cardList}>
              {report.storylines.map((thread) => (
                <button type="button" key={thread.id} onClick={() => openTarget(thread.target)}>
                  <span><b>{thread.name}</b><small>{titleCase(thread.kind)} · {thread.scenes} scenes</small></span>
                  <span><strong>{thread.unresolvedMilestones}</strong><small>open milestones</small></span>
                </button>
              ))}
            </div> : <EmptyState>No story threads have been defined.</EmptyState>}
          </SectionCard>
        </div>
      </div>
    );
  }

  function renderCharacters() {
    return (
      <SectionCard eyebrow="Cast intelligence" title={`${model.characters.length} character records`}>
        {model.characters.length ? <div className={styles.tableWrap}>
          <table>
            <thead>
              <tr><th>Character</th><th>Scenes</th><th>Lines / words</th><th>Appearances</th><th>Shared scenes</th><th>Arc</th><th>Visuals</th><th>Actor needs</th><th>Days</th><th /></tr>
            </thead>
            <tbody>
              {model.characters.map((character) => (
                <tr key={character.id}>
                  <td><strong>{character.name}</strong><small>{character.role || "Role not set"}</small></td>
                  <td>{character.scenes}</td>
                  <td>{character.dialogueLines} / {character.words}<small>{secondsLabel(character.speakingSeconds)}</small></td>
                  <td>{character.firstAppearance ?? "—"}–{character.lastAppearance ?? "—"}</td>
                  <td>{character.sharedScenes.slice(0, 2).map((item) => `${item.name} (${item.count})`).join(", ") || "None"}</td>
                  <td>{character.arcProgress}%</td>
                  <td>{character.visualContinuity.identityImage ? "Identity set" : "No identity"}<small>{character.visualContinuity.linkedFrames} linked frames</small></td>
                  <td>{character.actorRequirements.breakdowns} breakdowns<small>{character.actorRequirements.wardrobe} wardrobe · {character.actorRequirements.makeup} makeup · {character.actorRequirements.stunts} stunt</small></td>
                  <td>{character.shootingDays}</td>
                  <td><button type="button" onClick={() => openTarget(character.target)}>Open</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div> : <EmptyState>Add a character in Plan to begin cast reporting.</EmptyState>}
      </SectionCard>
    );
  }

  function renderScenes() {
    return (
      <SectionCard eyebrow="Scene intelligence" title={`${model.scenes.length} canonical scenes`}>
        {model.scenes.length ? <div className={styles.tableWrap}>
          <table>
            <thead><tr><th>Scene</th><th>Block</th><th>Setting</th><th>Location</th><th>Cast</th><th>Pages / runtime</th><th>Storyboard</th><th>Feedback</th><th>Readiness</th><th /></tr></thead>
            <tbody>
              {model.scenes.map((scene) => (
                <tr key={scene.id}>
                  <td><strong>{scene.number}. {scene.title}</strong><small>{scene.status}{scene.locked ? " · Locked" : ""}</small></td>
                  <td>{scene.blockNumber}</td>
                  <td>{scene.interiorExterior} · {scene.dayNight}</td>
                  <td>{scene.location}</td>
                  <td>{scene.characters.join(", ") || "No cast linked"}</td>
                  <td>{scene.pageEstimate || 0} pp<small>{secondsLabel(scene.estimatedSeconds)}</small></td>
                  <td>{scene.storyboardFrames} frames<small>{scene.approvedShots}/{scene.shots} shots approved</small></td>
                  <td>{scene.feedback}</td>
                  <td><b className={`${styles.statusPill} ${scene.readiness === "blocked" ? styles.statusBlocked : ""}`}>{titleCase(scene.readiness)}</b><small>{scene.requirements} requirement groups</small></td>
                  <td><button type="button" onClick={() => openTarget(scene.target)}>Open</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div> : <EmptyState>Add scenes in Build or Write to begin scene reporting.</EmptyState>}
      </SectionCard>
    );
  }

  function renderDialogue() {
    const report = model.dialogue;
    return (
      <div className={styles.reportStack}>
        <SummaryStrip values={[
          { label: "Speaking roles", value: `${report.summary.charactersWithDialogue}/${report.summary.characters}` },
          { label: "Dialogue lines", value: report.summary.dialogueLines },
          { label: "Spoken words", value: report.summary.spokenWords },
          { label: "Speaking time", value: secondsLabel(report.summary.estimatedSpeakingSeconds) },
          { label: "Silent scenes", value: report.silentScenes.length },
        ]} />
        <SectionCard eyebrow="Character dialogue" title="Lines, words, sides and duration">
          {report.characters.length ? <div className={styles.tableWrap}>
            <table>
              <thead><tr><th>Character</th><th>Lines</th><th>Words</th><th>Scenes</th><th>Coverage</th><th>Speaking time</th><th>Side headings</th></tr></thead>
              <tbody>{report.characters.map((character) => (
                <tr key={character.id}>
                  <td><strong>{character.name}</strong><small>{character.role}</small></td>
                  <td>{character.dialogueLines}</td>
                  <td>{character.wordCount}</td>
                  <td>{character.sceneNumbers.length}<small>{character.firstScene ?? "—"}–{character.lastScene ?? "—"}</small></td>
                  <td>{character.speakingSceneCoverage}%</td>
                  <td>{secondsLabel(character.estimatedSpeakingSeconds)}</td>
                  <td>{character.sceneHeadings.slice(0, 2).map((item) => item.heading).join(" · ") || "None"}</td>
                </tr>
              ))}</tbody>
            </table>
          </div> : <EmptyState>No screenplay dialogue is available.</EmptyState>}
        </SectionCard>
        <div className={styles.threeColumn}>
          <SectionCard eyebrow="Longest speeches" title="Dialogue passages">
            {report.longestSpeeches.length ? <div className={styles.rankedList}>{report.longestSpeeches.slice(0, 10).map((speech) => (
              <button type="button" key={speech.id} onClick={() => openTarget(speech.target)}>
                <strong>{speech.words} words · Scene {speech.sceneNumber}</strong>
                <span>{speech.text}</span>
              </button>
            ))}</div> : <EmptyState>No speeches are available.</EmptyState>}
          </SectionCard>
          <SectionCard eyebrow="Scene balance" title="Heavy and silent scenes">
            <div className={styles.rankedList}>
              {report.dialogueHeavyScenes.slice(0, 8).map((scene) => <article key={`heavy-${scene.id}`}><strong>Scene {scene.number} · {scene.words} words</strong><span>{scene.title}</span></article>)}
              {report.silentScenes.slice(0, 8).map((scene) => <article key={`silent-${scene.id}`}><strong>Scene {scene.number} · Silent</strong><span>{scene.title}</span></article>)}
              {!report.dialogueHeavyScenes.length && !report.silentScenes.length ? <EmptyState>No balance exceptions found.</EmptyState> : null}
            </div>
          </SectionCard>
          <SectionCard eyebrow="Voice and repetition" title="Recurring language">
            <div className={styles.rankedList}>
              {report.repeatedPhrases.slice(0, 10).map((item) => <article key={item.phrase}><strong>{item.count} uses</strong><span>“{item.phrase}”</span></article>)}
              {!report.repeatedPhrases.length ? <EmptyState>No recurring three-word phrases found.</EmptyState> : null}
            </div>
            <div className={styles.voiceList}>
              {report.voiceConsistency.map((character) => (
                <button type="button" key={character.id} onClick={() => openTarget(character.target)}>
                  <span>{character.name}</span><b>{character.hasVoiceProfile ? "Voice profile" : "Needs voice work"}</b>
                </button>
              ))}
            </div>
          </SectionCard>
        </div>
      </div>
    );
  }

  function renderProduction() {
    return (
      <ProductionReportsWorkspace
        report={model.production}
        section={productionSection}
        onSectionChange={onProductionSectionChange}
        onOpenTarget={openTarget}
      />
    );
  }

  function renderFeedback() {
    const report = model.feedback;
    return (
      <div className={styles.reportStack}>
        <SummaryStrip values={[
          { label: "All feedback", value: report.counts.total },
          { label: "Active", value: report.counts.active },
          { label: "Resolved", value: report.counts.resolved },
          { label: "AI", value: report.counts.ai },
          { label: "Human", value: report.counts.human },
          { label: "Diagnostics", value: report.counts.diagnostics },
        ]} />
        <div className={styles.threeColumn}>
          <SectionCard eyebrow="Workflow" title="Status">
            <div className={styles.countList}>{report.statuses.map((item) => <article key={item.status}><span>{titleCase(item.status)}</span><strong>{item.count}</strong></article>)}</div>
          </SectionCard>
          <SectionCard eyebrow="Origin" title="Sources and reviewers">
            <div className={styles.countList}>
              {report.sources.map((item) => <article key={item.source}><span>{titleCase(item.source)}</span><strong>{item.count}</strong></article>)}
              {report.reviewers.slice(0, 6).map((item) => <article key={`reviewer-${item.reviewer}`}><span>{item.reviewer}</span><strong>{item.count}</strong></article>)}
            </div>
          </SectionCard>
          <SectionCard eyebrow="Attention" title="Priority and category">
            <div className={styles.countList}>
              {report.priorities.map((item) => <article key={item.priority}><span>{titleCase(item.priority)}</span><strong>{item.count}</strong></article>)}
              {report.categories.slice(0, 6).map((item) => <article key={item.category}><span>{titleCase(item.category)}</span><strong>{item.count}</strong></article>)}
            </div>
          </SectionCard>
        </div>
        <SectionCard eyebrow="Review ledger" title="Active and resolved history">
          {report.records.length ? <div className={styles.feedbackList}>{report.records.map((record) => (
            <article key={record.id}>
              <div>
                <span className={styles.feedbackMeta}>{titleCase(record.source)} · {titleCase(record.priority)} · {titleCase(record.status)}</span>
                <h3>{record.title}</h3>
                <p>{record.body || record.proposedChange || record.resolution || "No written note."}</p>
                <small>{record.author || "Unknown reviewer"} · {record.target.label}</small>
              </div>
              <button type="button" onClick={() => onOpenTarget(record.target)}>Open target</button>
            </article>
          ))}</div> : <EmptyState>No Feedback records are available. Reports remains ready when reviews arrive.</EmptyState>}
        </SectionCard>
      </div>
    );
  }

  function renderProvenance() {
    const records = [...project.rights.aiProvenance].sort((left, right) => right.createdAt.localeCompare(left.createdAt));
    const retained = records.filter((record) => record.retained).length;
    const providers = new Set(records.map((record) => record.provider).filter(Boolean)).size;
    const attached = records.filter((record) => record.attachedTo.length).length;
    return (
      <div className={styles.reportStack}>
        <SummaryStrip values={[
          { label: "AI records", value: records.length },
          { label: "Retained outputs", value: retained },
          { label: "Providers", value: providers },
          { label: "Attached to canon", value: attached },
        ]} />
        <SectionCard eyebrow="Read-only provenance" title="Generated assets and retained human decisions">
          {records.length ? <div className={styles.feedbackList}>{records.map((record) => (
            <article key={record.id}>
              <div>
                <span className={styles.feedbackMeta}>{titleCase(record.operation)} · {record.retained ? "Retained" : "Not retained"} · {dateLabel(record.createdAt)}</span>
                <h3>{record.provider || "Unspecified provider"} · {record.model || "Unspecified model"}</h3>
                <p><strong>Prompt:</strong> {record.promptSummary || "No prompt summary recorded."}</p>
                <p><strong>Output:</strong> {record.outputSummary || "No output summary recorded."}</p>
                <small>Human contribution: {record.humanContribution || "Not recorded"} · Decision: {record.humanDecision || "Not recorded"}</small>
                <small>Attached to: {record.attachedTo.join(", ") || "No canonical target recorded"}</small>
              </div>
            </article>
          ))}</div> : <EmptyState>No AI or generated-asset provenance has been retained. Manual-only projects remain fully supported.</EmptyState>}
        </SectionCard>
        <SectionCard eyebrow="Ownership and rights" title="Human authorship remains explicit">
          <dl className={styles.repositoryGrid}>
            <div><dt>Project owner</dt><dd>{project.rights.projectOwner || "Not recorded"}</dd></div>
            <div><dt>Rights statement</dt><dd>{project.rights.rightsStatement || "Not recorded"}</dd></div>
            <div><dt>Source work</dt><dd>{project.rights.sourceWorkTitle || "Original project"}</dd></div>
            <div><dt>Adaptation status</dt><dd>{titleCase(project.rights.adaptationStatus)}</dd></div>
          </dl>
        </SectionCard>
      </div>
    );
  }

  function renderConnections() {
    const report = model.connections;
    return (
      <div className={styles.reportStack}>
        <SectionCard eyebrow="Optional services" title="Connection health">
          <div className={styles.connectionGrid}>
            {report.rows.map((row) => (
              <article key={row.id}>
                <header><strong>{row.label}</strong><b className={`${styles.statusPill} ${styles[`connection${titleCase(row.status)}`]}`}>{titleCase(row.status)}</b></header>
                <p>{row.detail}</p>
                {row.error ? <span className={styles.connectionError}>{row.error}</span> : null}
                <dl>
                  <div><dt>Last checked</dt><dd>{dateLabel(row.checkedAt)}</dd></div>
                  <div><dt>Last sync</dt><dd>{dateLabel(row.lastSyncAt)}</dd></div>
                </dl>
                <button type="button" onClick={() => openTarget(row.settingsTarget)}>Open Settings</button>
              </article>
            ))}
          </div>
        </SectionCard>
        <SectionCard eyebrow="Project repository" title="Canonical sync metadata">
          <dl className={styles.repositoryGrid}>
            <div><dt>Provider</dt><dd>{titleCase(report.repository.provider)}</dd></div>
            <div><dt>Repository</dt><dd>{report.repository.url || "Not configured"}</dd></div>
            <div><dt>Branch</dt><dd>{report.repository.branch || "Not configured"}</dd></div>
            <div><dt>Project path</dt><dd>{report.repository.projectPath || "Not configured"}</dd></div>
            <div><dt>Sync</dt><dd>{report.repository.syncEnabled ? "Enabled" : "Disabled"}</dd></div>
            <div><dt>Last pull / push</dt><dd>{report.repository.lastPulledCommit || "No pull recorded"} · {report.repository.lastPushedCommit || "No push recorded"}</dd></div>
          </dl>
        </SectionCard>
      </div>
    );
  }

  const content = section === "project" ? renderProject()
    : section === "story" ? renderStory()
      : section === "characters" ? renderCharacters()
        : section === "scenes" ? renderScenes()
          : section === "dialogue" ? renderDialogue()
          : section === "production" ? renderProduction()
              : section === "feedback" ? renderFeedback()
                : section === "provenance" ? renderProvenance()
                  : renderConnections();

  return (
    <div className={styles.workspace}>
      <aside className={styles.submenu}>
        <div className={styles.submenuHeading}>
          <p>Reports</p>
          <strong>One canonical view</strong>
          <span>Read every report without leaving this workspace.</span>
        </div>
        <nav aria-label="Reports sections">
          {CONSOLIDATED_REPORT_SECTIONS.map((item) => (
            <button
              type="button"
              key={item.id}
              className={section === item.id ? styles.activeSection : ""}
              aria-current={section === item.id ? "page" : undefined}
              onClick={() => onSectionChange(item.id)}
            >
              <strong>{item.label}</strong>
              <span>{item.description}</span>
            </button>
          ))}
        </nav>
        <div className={styles.canonicalNote}>
          <span>Canonical project</span>
          <strong>{project.metadata.title}</strong>
          <p>Reports reads the same project used by Plan, Build, Write, Storyboard, Feedback, and production tools. It creates no second report database.</p>
        </div>
      </aside>
      <main className={styles.main}>
        <header className={styles.hero}>
          <div>
            <p>Reports · {definition.label}</p>
            <h1>{definition.label} report</h1>
            <span>{definition.description}</span>
          </div>
          <div className={styles.heroState}>
            <span>Last canonical update</span>
            <strong>{dateLabel(model.generatedAt)}</strong>
            <small>Optional connections may remain disconnected.</small>
          </div>
        </header>
        {content}
      </main>
    </div>
  );
}
