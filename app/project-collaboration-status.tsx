import type { PlotPickleProject } from "@/lib/project";
import {
  COLLABORATION_MODE_COPY,
  collaborationModeRequirements,
  normalizeCollaborationModeRecord,
} from "@/lib/collaboration-mode";
import type { BuzzRuntimeStatus } from "@/lib/buzz-runtime";
import styles from "./project-collaboration-status.module.css";

export default function ProjectCollaborationStatus({
  project,
  buzz,
}: {
  project: PlotPickleProject;
  buzz: BuzzRuntimeStatus;
}) {
  const collaboration = normalizeCollaborationModeRecord(project.collaboration);
  const copy = COLLABORATION_MODE_COPY[collaboration.mode];
  const requirements = collaborationModeRequirements(collaboration.mode);
  const githubConnected = Boolean(collaboration.sourceRepositoryUrl || collaboration.repositoryUrl);
  const buzzConnected = buzz.lifecycle === "running";

  return (
    <section className={styles.status} aria-labelledby="project-collaboration-mode-title">
      <header>
        <div>
          <p>Project mode</p>
          <h2 id="project-collaboration-mode-title">{copy.title}</h2>
          <span>{copy.summary}</span>
        </div>
        <strong>PPF remains canonical</strong>
      </header>

      <div className={styles.foundation} aria-label="Project collaboration foundation">
        <article data-state="healthy">
          <span>PPF</span>
          <strong>Local story active</strong>
          <small>Canonical project data on this device</small>
        </article>
        <article data-state="healthy">
          <span>Backups</span>
          <strong>Local protection</strong>
          <small>Required in every project mode</small>
        </article>
        <article data-state={buzzConnected ? "healthy" : "optional"}>
          <span>Buzz</span>
          <strong>{buzzConnected ? "Connected" : requirements.buzz === "required" ? "Ready to configure" : "Optional"}</strong>
          <small>{requirements.buzz === "required" ? "Used for Writers' Room discussion" : "Available when discussion is needed"}</small>
        </article>
        <article data-state={githubConnected ? "healthy" : "optional"}>
          <span>GitHub</span>
          <strong>{githubConnected ? "Repository connected" : requirements.github === "required" ? "Ready to configure" : "Optional"}</strong>
          <small>{requirements.github === "required" ? "Used for repository collaboration" : "Available for proposals and history"}</small>
        </article>
      </div>
    </section>
  );
}
