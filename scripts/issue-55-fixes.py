from pathlib import Path


def replace(path: str, old: str, new: str) -> None:
    target = Path(path)
    text = target.read_text()
    if old not in text:
        raise SystemExit(f"Expected marker not found in {path}: {old[:140]!r}")
    target.write_text(text.replace(old, new, 1))


page = "app/core-curriculum/page.tsx"
replace(
    page,
    '''  useEffect(() => {
    if (!recommendations.length) return;
    const focusModuleId = routeId === "focused-problem" ? focusArea.moduleId : "";
    const preferred = recommendations.find((item) => item.moduleId === focusModuleId) ?? recommendations[0];
    if (preferred && !coreModule(selectedModuleId)) setSelectedModuleId(preferred.moduleId);
  }, [focusArea.moduleId, recommendations, routeId, selectedModuleId]);

  useEffect(() => {
    setExerciseNote(selectedRecord?.exerciseNote ?? "");
    setAppliedEvidence(selectedRecord?.appliedEvidence ?? "");
  }, [selectedModuleId, selectedRecord?.appliedEvidence, selectedRecord?.exerciseNote]);

''',
    '',
)
replace(
    page,
    '''  function selectModule(moduleId: string) {
    setSelectedModuleId(moduleId);
    window.setTimeout(() => document.getElementById("core-module-detail")?.scrollIntoView({ behavior: "smooth", block: "start" }), 0);
  }''',
    '''  function selectModule(moduleId: string) {
    const record = recordByModule.get(moduleId);
    setSelectedModuleId(moduleId);
    setExerciseNote(record?.exerciseNote ?? "");
    setAppliedEvidence(record?.appliedEvidence ?? "");
    window.setTimeout(() => document.getElementById("core-module-detail")?.scrollIntoView({ behavior: "smooth", block: "start" }), 0);
  }''',
)
replace(page, '        const module = coreModule(moduleId);', '        const lesson = coreModule(moduleId);')
replace(page, '        if (!module || !guide) return null;', '        if (!lesson || !guide) return null;')
replace(page, '          <div className={styles.cardMeta}><span>Module {module.number}</span>{recommendation ? <strong>Recommended</strong> : null}</div>', '          <div className={styles.cardMeta}><span>Module {lesson.number}</span>{recommendation ? <strong>Recommended</strong> : null}</div>')
replace(page, '          <h4>{module.title}</h4>', '          <h4>{lesson.title}</h4>')
replace(page, '          <p>{module.overview}</p>', '          <p>{lesson.overview}</p>')

core = "app/learning-core-curriculum.ts"
replace(core, '  const dialogueElements = project.screenplay.draftElements.filter((item) => item.type === "dialogue" || item.type === "dual-dialogue");\n', '')
replace(
    core,
    '''      const module = learningModules.find((item) => item.id === moduleId);
      if (module) add(moduleId, `This lesson is part of the selected “${route.label}” route.`, [`Route destination: ${route.destination}`], `Would ${module.title} remove uncertainty from the next project decision?`);''',
    '''      const lesson = learningModules.find((item) => item.id === moduleId);
      if (lesson) add(moduleId, `This lesson is part of the selected “${route.label}” route.`, [`Route destination: ${route.destination}`], `Would ${lesson.title} remove uncertainty from the next project decision?`);''',
)

studio = "app/learning-studio.tsx"
replace(studio, "PlotPickle's current local-first workflow", "PlotPickle&apos;s current local-first workflow")

package = "package.json"
replace(
    package,
    'tests/issue-49-guided-ai-revision.test.mjs tests/phase-one-core-schema.test.mjs',
    'tests/issue-49-guided-ai-revision.test.mjs tests/issue-55-core-curriculum-router.test.mjs tests/phase-one-core-schema.test.mjs',
)
