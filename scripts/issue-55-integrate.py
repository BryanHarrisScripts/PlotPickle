from pathlib import Path


def replace(path: str, old: str, new: str) -> None:
    target = Path(path)
    text = target.read_text()
    if old not in text:
        raise SystemExit(f"Expected marker not found in {path}: {old[:140]!r}")
    target.write_text(text.replace(old, new, 1))


studio = "app/learning-studio.tsx"
replace(
    studio,
    'import { storyCraftLessons, storyCraftSearchText, type StoryCraftLesson } from "./learning-story-craft-essentials";\nimport { learningModules, learningPaths, moduleSearchText, type LearningModule } from "./learning-library";',
    'import { storyCraftLessons, storyCraftSearchText, type StoryCraftLesson } from "./learning-story-craft-essentials";\nimport { coreGuideFor } from "./learning-core-curriculum";\nimport { learningModules, learningPaths, moduleSearchText, type LearningModule } from "./learning-library";',
)
replace(
    studio,
    '''  if (isStoryCraftLesson(module)) return `${base} ${storyCraftSearchText(module)}`;
  if (isCharacterMotionLesson(module)) return `${base} ${characterMotionSearchText(module)}`;
  return base;''',
    '''  if (isStoryCraftLesson(module)) return `${base} ${storyCraftSearchText(module)}`;
  if (isCharacterMotionLesson(module)) return `${base} ${characterMotionSearchText(module)}`;
  const coreGuide = coreGuideFor(module.id);
  if (coreGuide) return `${base} ${coreGuide.sourceTitle} ${coreGuide.sourceAliases.join(" ")} ${coreGuide.adaptation} ${coreGuide.understand} ${coreGuide.seeIt} ${coreGuide.tryIt} ${coreGuide.applyLabel} ${coreGuide.checkLabel} ${coreGuide.deeperLabel} ${coreGuide.commonNextProblem}`;
  return base;''',
)
replace(
    studio,
    '''        const savedWorkflow = window.localStorage.getItem(workflowStorageKey) as WorkflowChoice["id"] | null;
        if (savedWorkflow && workflowChoices.some((choice) => choice.id === savedWorkflow)) {
          setWorkflowChoiceId(savedWorkflow);
          setView("library");
        } else {
          setWorkflowChoiceId(null);
          setView("workflow");
        }''',
    '''        const savedWorkflow = window.localStorage.getItem(workflowStorageKey) as WorkflowChoice["id"] | null;
        const params = new URLSearchParams(window.location.search);
        const requestedView = params.get("view") as ViewMode | null;
        const requestedModule = params.get("module");
        const validViews: ViewMode[] = ["workflow", "guide", "library", "method", "ai-revision", "collaboration", "working-together", "characters", "dialogue", "story-craft"];
        if (requestedView && validViews.includes(requestedView)) {
          setView(requestedView);
        } else if (savedWorkflow && workflowChoices.some((choice) => choice.id === savedWorkflow)) {
          setWorkflowChoiceId(savedWorkflow);
          setView("library");
        } else {
          setWorkflowChoiceId(null);
          setView("workflow");
        }
        if (requestedModule && courseModules.some((module) => module.id === requestedModule)) setSelectedId(requestedModule);''',
)
replace(
    studio,
    '''    if (isStoryCraftLesson(module)) {
      openStoryCraftWorkspace(module);
      return;
    }
    if (module.apply === "Screenplay") onOpenScreenplay();''',
    '''    if (isStoryCraftLesson(module)) {
      openStoryCraftWorkspace(module);
      return;
    }
    const coreGuide = coreGuideFor(module.id);
    if (coreGuide) {
      window.location.assign(coreGuide.applyHref);
      return;
    }
    if (module.apply === "Screenplay") onOpenScreenplay();''',
)
replace(
    studio,
    '''    <section className={styles.anatomy}>
      <div><span>Screenplay anatomy</span><strong>Seven lenses run through the complete course</strong></div>''',
    '''    <section className={styles.anatomy} aria-label="Learning entry points">
      <div><span>Choose your learning view</span><strong>Complete Learning Library or the PlotPickle Core Curriculum</strong></div>
      <ul>
        <li><b>1</b><button type="button" onClick={() => setView("library")}>Complete Learning Library</button></li>
        <li><b>2</b><button type="button" onClick={() => window.location.assign("/core-curriculum")}>Start with the PlotPickle Core Curriculum</button></li>
      </ul>
    </section>

    <section className={styles.anatomy}>
      <div><span>Screenplay anatomy</span><strong>Seven lenses run through the complete course</strong></div>''',
)
replace(
    studio,
    '''      <button type="button" className={view === "library" ? styles.active : ""} onClick={() => setView("library")}>Complete Learning Library</button>
      <button type="button" className={view === "workflow" ? styles.active : ""} onClick={() => setView("workflow")}>Choose Your Workflow</button>''',
    '''      <button type="button" className={view === "library" ? styles.active : ""} onClick={() => setView("library")}>Complete Learning Library</button>
      <button type="button" onClick={() => window.location.assign("/core-curriculum")}>Core Curriculum</button>
      <button type="button" className={view === "workflow" ? styles.active : ""} onClick={() => setView("workflow")}>Choose Your Workflow</button>''',
)
replace(
    studio,
    '''    {isStoryCraftLesson(module) ? <small>{module.collection} · Open {module.workspaceLabel}</small> : null}
    {isCharacterMotionLesson(module) ? <small>{module.collection} · Open {module.workspaceLabel}</small> : null}''',
    '''    {isStoryCraftLesson(module) ? <small>{module.collection} · Open {module.workspaceLabel}</small> : null}
    {coreGuideFor(module.id) ? <small>PlotPickle Core Curriculum · {coreGuideFor(module.id)?.sourceTitle}</small> : null}
    {isCharacterMotionLesson(module) ? <small>{module.collection} · Open {module.workspaceLabel}</small> : null}''',
)
replace(
    studio,
    '''    <header className={styles.readerHeader}><span>Module {module.number} of {courseModules.length} · {module.path} · {module.duration}</span><h2>{module.title}</h2><p>{module.overview}</p>{isMethodLesson(module) || isAiRevisionLesson(module) || isCollaborationLesson(module) || isWorkingTogetherLesson(module) || isDialogueLesson(module) || isStoryCraftLesson(module) || isCharacterMotionLesson(module) ? <small>{module.sourceNote}</small> : null}<button type="button" className={complete ? styles.complete : ""} onClick={onToggle}>{complete ? "Completed — mark incomplete" : "Mark module complete"}</button></header>''',
    '''    <header className={styles.readerHeader}><span>Module {module.number} of {courseModules.length} · {module.path} · {module.duration}</span><h2>{module.title}</h2><p>{module.overview}</p>{isMethodLesson(module) || isAiRevisionLesson(module) || isCollaborationLesson(module) || isWorkingTogetherLesson(module) || isDialogueLesson(module) || isStoryCraftLesson(module) || isCharacterMotionLesson(module) ? <small>{module.sourceNote}</small> : null}{coreGuideFor(module.id) ? <small>Adapted from {coreGuideFor(module.id)?.sourceTitle} and rewritten for PlotPickle's current local-first workflow. Legacy phrases remain searchable.</small> : null}<button type="button" className={complete ? styles.complete : ""} onClick={onToggle}>{complete ? "Completed — mark incomplete" : "Mark module complete"}</button></header>''',
)
replace(
    studio,
    '''        {isCharacterMotionLesson(module) ? <section className={styles.example}><span>Direct application</span><h3>{module.workspaceLabel}</h3><p>The active Block and mini-block travel into the character workspace. Diagnostics compare planned claims with project evidence and remain questions for the writer; no character, relationship, scene or dialogue is rewritten or merged automatically.</p></section> : null}
        <section className={styles.example}><span>Worked example</span>''',
    '''        {isCharacterMotionLesson(module) ? <section className={styles.example}><span>Direct application</span><h3>{module.workspaceLabel}</h3><p>The active Block and mini-block travel into the character workspace. Diagnostics compare planned claims with project evidence and remain questions for the writer; no character, relationship, scene or dialogue is rewritten or merged automatically.</p></section> : null}
        {coreGuideFor(module.id) ? <section className={styles.example}><span>Core-to-workspace path</span><h3>Understand → See it → Try it → Apply it → Check it → Go deeper</h3><p><strong>Understand:</strong> {coreGuideFor(module.id)?.understand}</p><p><strong>See it:</strong> {coreGuideFor(module.id)?.seeIt}</p><p><strong>Try it:</strong> {coreGuideFor(module.id)?.tryIt}</p><p><a href={coreGuideFor(module.id)?.applyHref}>{coreGuideFor(module.id)?.applyLabel}</a> · <a href={coreGuideFor(module.id)?.checkHref}>{coreGuideFor(module.id)?.checkLabel}</a> · <a href={coreGuideFor(module.id)?.deeperHref}>{coreGuideFor(module.id)?.deeperLabel}</a></p><small>Recommended before and useful after relationships are advisory, never locked prerequisites.</small></section> : null}
        <section className={styles.example}><span>Worked example</span>''',
)
replace(
    studio,
    '''<button type="button" onClick={onApply}>Open {isAiRevisionLesson(module) ? module.destination : isCollaborationLesson(module) || isWorkingTogetherLesson(module) || isDialogueLesson(module) || isStoryCraftLesson(module) || isCharacterMotionLesson(module) ? module.workspaceLabel : module.apply}</button>''',
    '''<button type="button" onClick={onApply}>Open {isAiRevisionLesson(module) ? module.destination : isCollaborationLesson(module) || isWorkingTogetherLesson(module) || isDialogueLesson(module) || isStoryCraftLesson(module) || isCharacterMotionLesson(module) ? module.workspaceLabel : coreGuideFor(module.id)?.applyLabel ?? module.apply}</button>''',
)
