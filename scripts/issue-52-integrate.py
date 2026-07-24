from pathlib import Path


def replace(path: str, old: str, new: str) -> None:
    target = Path(path)
    text = target.read_text()
    if old not in text:
        raise SystemExit(f"Expected marker not found in {path}: {old[:100]!r}")
    target.write_text(text.replace(old, new, 1))


studio = "app/learning-studio.tsx"
replace(
    studio,
    '''} from "./learning-collaboration-ownership";
import { learningModules, learningPaths, moduleSearchText, type LearningModule } from "./learning-library";''',
    '''} from "./learning-collaboration-ownership";
import { workingTogetherLessons, workingTogetherSearchText, type WorkingTogetherLesson } from "./learning-working-together";
import { learningModules, learningPaths, moduleSearchText, type LearningModule } from "./learning-library";''',
)
replace(
    studio,
    '''type ViewMode = "workflow" | "guide" | "library" | "method" | "ai-revision" | "collaboration" | "characters";
type CourseModule = LearningModule | TwentyFourBlocksLesson | AiRevisionLesson | CollaborationOwnershipLesson | CharacterMotionLesson;''',
    '''type ViewMode = "workflow" | "guide" | "library" | "method" | "ai-revision" | "collaboration" | "working-together" | "characters";
type CourseModule = LearningModule | TwentyFourBlocksLesson | AiRevisionLesson | CollaborationOwnershipLesson | CharacterMotionLesson | WorkingTogetherLesson;''',
)
replace(
    studio,
    '''  ...collaborationOwnershipLessons,
  ...characterMotionLessons,
];''',
    '''  ...collaborationOwnershipLessons,
  ...workingTogetherLessons,
  ...characterMotionLessons,
];''',
)
replace(
    studio,
    '''function isCharacterMotionLesson(module: CourseModule): module is CharacterMotionLesson {
  return "collection" in module && module.collection === "Characters in Motion";
}

function courseSearchText''',
    '''function isCharacterMotionLesson(module: CourseModule): module is CharacterMotionLesson {
  return "collection" in module && module.collection === "Characters in Motion";
}

function isWorkingTogetherLesson(module: CourseModule): module is WorkingTogetherLesson {
  return "collection" in module && module.collection === "Working Together in PlotPickle";
}

function courseSearchText''',
)
replace(
    studio,
    '''  if (isCollaborationLesson(module)) return `${base} ${collaborationOwnershipSearchText(module)}`;
  if (isCharacterMotionLesson(module)) return `${base} ${characterMotionSearchText(module)}`;
  return base;''',
    '''  if (isCollaborationLesson(module)) return `${base} ${collaborationOwnershipSearchText(module)}`;
  if (isWorkingTogetherLesson(module)) return `${base} ${workingTogetherSearchText(module)}`;
  if (isCharacterMotionLesson(module)) return `${base} ${characterMotionSearchText(module)}`;
  return base;''',
)
replace(
    studio,
    '''    if (isCharacterMotionLesson(module)) {
      openCharacterWorkspace(module);
      return;
    }
    if (module.apply === "Screenplay")''',
    '''    if (isCharacterMotionLesson(module)) {
      openCharacterWorkspace(module);
      return;
    }
    if (isWorkingTogetherLesson(module)) {
      window.location.assign(module.workspaceHref);
      return;
    }
    if (module.apply === "Screenplay")''',
)
replace(
    studio,
    '''      <button type="button" className={view === "collaboration" ? styles.active : ""} onClick={() => setView("collaboration")}>Collaboration, Formats & Ownership</button>
      <button type="button" className={view === "guide" ? styles.active : ""} onClick={() => setView("guide")}>Guidance for this Block</button>''',
    '''      <button type="button" className={view === "collaboration" ? styles.active : ""} onClick={() => setView("collaboration")}>Collaboration, Formats & Ownership</button>
      <button type="button" className={view === "working-together" ? styles.active : ""} onClick={() => setView("working-together")}>Working Together</button>
      <button type="button" className={view === "guide" ? styles.active : ""} onClick={() => setView("guide")}>Guidance for this Block</button>''',
)
replace(
    studio,
    '''    </section> : view === "collaboration" ? <section className={styles.library}>
      <div className={styles.sectionIntro}><span>Practical workflow collection</span><h2>Collaboration, Formats & Ownership</h2><p>Five PlotPickled lessons replace eight legacy Blog articles with current local-first workflow choices, owner-controlled collaboration, direct screenplay interchange, careful rights guidance and optional AI, GitHub and public publishing paths.</p></div>
      <main className={styles.moduleGrid}>{collaborationOwnershipLessons.map((module) => <ModuleCard module={module} complete={completed.has(module.id)} recommended={workflowChoices.find((choice) => choice.id === workflowChoiceId)?.lessonId === module.id} onOpen={() => openModule(module.id)} onToggle={() => toggleComplete(module.id)} key={module.id} />)}</main>
    </section> : <section className={styles.library}>''',
    '''    </section> : view === "collaboration" ? <section className={styles.library}>
      <div className={styles.sectionIntro}><span>Practical workflow collection</span><h2>Collaboration, Formats & Ownership</h2><p>Five PlotPickled lessons replace eight legacy Blog articles with current local-first workflow choices, owner-controlled collaboration, direct screenplay interchange, careful rights guidance and optional AI, GitHub and public publishing paths.</p></div>
      <main className={styles.moduleGrid}>{collaborationOwnershipLessons.map((module) => <ModuleCard module={module} complete={completed.has(module.id)} recommended={workflowChoices.find((choice) => choice.id === workflowChoiceId)?.lessonId === module.id} onOpen={() => openModule(module.id)} onToggle={() => toggleComplete(module.id)} key={module.id} />)}</main>
    </section> : view === "working-together" ? <section className={styles.library}>
      <div className={styles.sectionIntro}><span>Contributor onboarding and review handbook</span><h2>Working Together in PlotPickle</h2><p>Nine PlotPickled lessons define collaboration models, roles, briefs, approved-story workflow, proposal packets, anchored review, canon decisions, rights, privacy and scalable creative review without requiring GitHub or public licensing.</p></div>
      <main className={styles.moduleGrid}>{workingTogetherLessons.map((module) => <ModuleCard module={module} complete={completed.has(module.id)} recommended={false} onOpen={() => openModule(module.id)} onToggle={() => toggleComplete(module.id)} key={module.id} />)}</main>
    </section> : <section className={styles.library}>''',
)
replace(
    studio,
    '''    {isCollaborationLesson(module) ? <small>{module.collection} · Open {module.workspaceLabel}</small> : null}
    {isCharacterMotionLesson(module) ? <small>{module.collection} · Open {module.workspaceLabel}</small> : null}''',
    '''    {isCollaborationLesson(module) ? <small>{module.collection} · Open {module.workspaceLabel}</small> : null}
    {isWorkingTogetherLesson(module) ? <small>{module.collection} · Open {module.workspaceLabel}</small> : null}
    {isCharacterMotionLesson(module) ? <small>{module.collection} · Open {module.workspaceLabel}</small> : null}''',
)
replace(
    studio,
    '''    <div className={styles.cardStats}><span>{module.duration}</span><span>{module.sections.length} lessons</span>{isAiRevisionLesson(module) ? <span>{module.defaultOperation}</span> : isCollaborationLesson(module) || isCharacterMotionLesson(module) ? <span>{module.workspaceLabel}</span> : <span>Exercise</span>}</div>''',
    '''    <div className={styles.cardStats}><span>{module.duration}</span><span>{module.sections.length} lessons</span>{isAiRevisionLesson(module) ? <span>{module.defaultOperation}</span> : isCollaborationLesson(module) || isWorkingTogetherLesson(module) || isCharacterMotionLesson(module) ? <span>{module.workspaceLabel}</span> : <span>Exercise</span>}</div>''',
)
replace(
    studio,
    '''<p>{module.overview}</p>{isMethodLesson(module) || isAiRevisionLesson(module) || isCollaborationLesson(module) || isCharacterMotionLesson(module) ? <small>{module.sourceNote}</small> : null}<button''',
    '''<p>{module.overview}</p>{isMethodLesson(module) || isAiRevisionLesson(module) || isCollaborationLesson(module) || isWorkingTogetherLesson(module) || isCharacterMotionLesson(module) ? <small>{module.sourceNote}</small> : null}<button''',
)
replace(
    studio,
    '''        {isCollaborationLesson(module) ? <section className={styles.example}><span>Direct application</span><h3>{module.workspaceLabel}</h3><p>This lesson opens the current PlotPickle workspace rather than an obsolete external workaround. Opening it does not publish, connect, licence, merge or apply story changes automatically.</p></section> : null}
        {isCharacterMotionLesson(module) ?''',
    '''        {isCollaborationLesson(module) ? <section className={styles.example}><span>Direct application</span><h3>{module.workspaceLabel}</h3><p>This lesson opens the current PlotPickle workspace rather than an obsolete external workaround. Opening it does not publish, connect, licence, merge or apply story changes automatically.</p></section> : null}
        {isWorkingTogetherLesson(module) ? <section className={styles.example}><span>Direct application</span><h3>{module.workspaceLabel}</h3><p>Create a project-specific welcome card, contribution brief, proposal packet, anchored review note or decision record. Records stay local until the writer deliberately shares a proposal.</p></section> : null}
        {isCharacterMotionLesson(module) ?''',
)
replace(
    studio,
    '''<button type="button" onClick={onApply}>Open {isAiRevisionLesson(module) ? module.destination : isCollaborationLesson(module) || isCharacterMotionLesson(module) ? module.workspaceLabel : module.apply}</button>''',
    '''<button type="button" onClick={onApply}>Open {isAiRevisionLesson(module) ? module.destination : isCollaborationLesson(module) || isWorkingTogetherLesson(module) || isCharacterMotionLesson(module) ? module.workspaceLabel : module.apply}</button>''',
)

collaboration = "app/github-collaboration.tsx"
replace(
    collaboration,
    '''      </section>

      <div className={styles.architecture} aria-label="Collaboration architecture">''',
    '''      </section>

      <section className={styles.panel}>
        <header><div><p>Contributor onboarding</p><h3>Define the human agreement before connecting the technical queue</h3><span>Choose the collaboration model, creative roles, canon authority, privacy, credit and rights expectations; create a welcome card and bounded contribution brief; then use GitHub only when repository collaboration is desired.</span></div></header>
        <div className={styles.actions}><a href="/working-together">Open contributor onboarding</a><a href="/read-learn">Read the Working Together handbook</a></div>
      </section>

      <div className={styles.architecture} aria-label="Collaboration architecture">''',
)

pitch = "app/pitch-review/page.tsx"
replace(
    pitch,
    '''<div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}><Link href="/labs">Specialist Labs</Link><Link href="/diagnostics">Diagnostics</Link><Link href="/draftlens">DraftLens</Link><Link href="/structure">Structure</Link></div>''',
    '''<div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}><Link href="/working-together">Working Together</Link><Link href="/labs">Specialist Labs</Link><Link href="/diagnostics">Diagnostics</Link><Link href="/draftlens">DraftLens</Link><Link href="/structure">Structure</Link></div>''',
)
