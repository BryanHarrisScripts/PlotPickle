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
    'import { dialogueLessons, dialogueLessonSearchText, type DialogueLesson } from "./learning-dialogue-in-motion";\nimport { learningModules, learningPaths, moduleSearchText, type LearningModule } from "./learning-library";',
    'import { dialogueLessons, dialogueLessonSearchText, type DialogueLesson } from "./learning-dialogue-in-motion";\nimport { storyCraftLessons, storyCraftSearchText, type StoryCraftLesson } from "./learning-story-craft-essentials";\nimport { learningModules, learningPaths, moduleSearchText, type LearningModule } from "./learning-library";',
)
replace(
    studio,
    'type ViewMode = "workflow" | "guide" | "library" | "method" | "ai-revision" | "collaboration" | "working-together" | "characters" | "dialogue";\ntype CourseModule = LearningModule | TwentyFourBlocksLesson | AiRevisionLesson | CollaborationOwnershipLesson | CharacterMotionLesson | WorkingTogetherLesson | DialogueLesson;',
    'type ViewMode = "workflow" | "guide" | "library" | "method" | "ai-revision" | "collaboration" | "working-together" | "characters" | "dialogue" | "story-craft";\ntype CourseModule = LearningModule | TwentyFourBlocksLesson | AiRevisionLesson | CollaborationOwnershipLesson | CharacterMotionLesson | WorkingTogetherLesson | DialogueLesson | StoryCraftLesson;',
)
replace(
    studio,
    '  ...characterMotionLessons,\n  ...dialogueLessons,\n];',
    '  ...characterMotionLessons,\n  ...dialogueLessons,\n  ...storyCraftLessons,\n];',
)
replace(
    studio,
    '''function isDialogueLesson(module: CourseModule): module is DialogueLesson {
  return "collection" in module && module.collection === "Dialogue in Motion";
}

function courseSearchText''',
    '''function isDialogueLesson(module: CourseModule): module is DialogueLesson {
  return "collection" in module && module.collection === "Dialogue in Motion";
}

function isStoryCraftLesson(module: CourseModule): module is StoryCraftLesson {
  return "collection" in module && module.collection === "Story Craft Essentials";
}

function courseSearchText''',
)
replace(
    studio,
    '  if (isDialogueLesson(module)) return `${base} ${dialogueLessonSearchText(module)}`;\n  if (isCharacterMotionLesson(module)) return `${base} ${characterMotionSearchText(module)}`;',
    '  if (isDialogueLesson(module)) return `${base} ${dialogueLessonSearchText(module)}`;\n  if (isStoryCraftLesson(module)) return `${base} ${storyCraftSearchText(module)}`;\n  if (isCharacterMotionLesson(module)) return `${base} ${characterMotionSearchText(module)}`;',
)
replace(
    studio,
    '''  const dialogueByMovement = miniBlockNumber === 1
    ? "dialogue-exposition-genre"
    : miniBlockNumber === 2
      ? "dialogue-voiceprint"
      : miniBlockNumber === 3
        ? "dialogue-conflict"
        : "dialogue-exchange-turn";
  return [...new Set([dialogueByMovement, dialogueByStage, characterByMovement, characterByStage, aiByMovement, aiByStage, byMovement, ...stage])].slice(0, 8);''',
    '''  const dialogueByMovement = miniBlockNumber === 1
    ? "dialogue-exposition-genre"
    : miniBlockNumber === 2
      ? "dialogue-voiceprint"
      : miniBlockNumber === 3
        ? "dialogue-conflict"
        : "dialogue-exchange-turn";
  const essentialsByStage = blockNumber <= 4
    ? "essentials-experience"
    : blockNumber <= 10
      ? "essentials-pacing"
      : blockNumber <= 16
        ? "essentials-theme"
        : blockNumber <= 20
          ? "essentials-motif"
          : "essentials-audit";
  const essentialsByMovement = miniBlockNumber === 1
    ? "essentials-tone"
    : miniBlockNumber === 2
      ? "essentials-screen-evidence"
      : miniBlockNumber === 3
        ? "essentials-scene"
        : "essentials-formatting";
  return [...new Set([essentialsByMovement, essentialsByStage, dialogueByMovement, dialogueByStage, characterByMovement, characterByStage, aiByMovement, aiByStage, byMovement, ...stage])].slice(0, 10);''',
)
replace(
    studio,
    '''  function openDialogueWorkspace(module: DialogueLesson) {
    const queryString = new URLSearchParams({ block: String(block.number), mini: String(mini.number), lesson: module.id });
    const section = module.workspaceSection ? `#${module.workspaceSection}` : "";
    window.location.assign(`${module.workspaceHref}?${queryString.toString()}${section}`);
  }

  function applyModule''',
    '''  function openDialogueWorkspace(module: DialogueLesson) {
    const queryString = new URLSearchParams({ block: String(block.number), mini: String(mini.number), lesson: module.id });
    const section = module.workspaceSection ? `#${module.workspaceSection}` : "";
    window.location.assign(`${module.workspaceHref}?${queryString.toString()}${section}`);
  }

  function openStoryCraftWorkspace(module: StoryCraftLesson) {
    const queryString = new URLSearchParams({ block: String(block.number), mini: String(mini.number), lesson: module.id });
    const section = module.workspaceSection ? `#${module.workspaceSection}` : "";
    window.location.assign(`${module.workspaceHref}?${queryString.toString()}${section}`);
  }

  function applyModule''',
)
replace(
    studio,
    '''    if (isDialogueLesson(module)) {
      openDialogueWorkspace(module);
      return;
    }
    if (module.apply === "Screenplay")''',
    '''    if (isDialogueLesson(module)) {
      openDialogueWorkspace(module);
      return;
    }
    if (isStoryCraftLesson(module)) {
      openStoryCraftWorkspace(module);
      return;
    }
    if (module.apply === "Screenplay")''',
)
replace(
    studio,
    '      <button type="button" className={view === "dialogue" ? styles.active : ""} onClick={() => setView("dialogue")}>Dialogue in Motion</button>\n      <button type="button" className={view === "ai-revision" ? styles.active : ""} onClick={() => setView("ai-revision")}>AI-Assisted Revision</button>',
    '      <button type="button" className={view === "dialogue" ? styles.active : ""} onClick={() => setView("dialogue")}>Dialogue in Motion</button>\n      <button type="button" className={view === "story-craft" ? styles.active : ""} onClick={() => setView("story-craft")}>Story Craft Essentials</button>\n      <button type="button" className={view === "ai-revision" ? styles.active : ""} onClick={() => setView("ai-revision")}>AI-Assisted Revision</button>',
)
replace(
    studio,
    '''    </section> : view === "dialogue" ? <section className={styles.library}>
      <div className={styles.sectionIntro}><span>Playable screenplay dialogue collection</span><h2>Dialogue in Motion</h2><p>Eight PlotPickled lessons connect objectives, tactics, Voiceprint, subtext, conflict, action, silence, exposition, genre, scene turns, revision and table-read evidence to the active project.</p></div>
      <main className={styles.moduleGrid}>{dialogueLessons.map((module) => <ModuleCard module={module} complete={completed.has(module.id)} recommended={recommendedIds.includes(module.id)} onOpen={() => openModule(module.id)} onToggle={() => toggleComplete(module.id)} key={module.id} />)}</main>
    </section> : view === "ai-revision" ?''',
    '''    </section> : view === "dialogue" ? <section className={styles.library}>
      <div className={styles.sectionIntro}><span>Playable screenplay dialogue collection</span><h2>Dialogue in Motion</h2><p>Eight PlotPickled lessons connect objectives, tactics, Voiceprint, subtext, conflict, action, silence, exposition, genre, scene turns, revision and table-read evidence to the active project.</p></div>
      <main className={styles.moduleGrid}>{dialogueLessons.map((module) => <ModuleCard module={module} complete={completed.has(module.id)} recommended={recommendedIds.includes(module.id)} onOpen={() => openModule(module.id)} onToggle={() => toggleComplete(module.id)} key={module.id} />)}</main>
    </section> : view === "story-craft" ? <section className={styles.library}>
      <div className={styles.sectionIntro}><span>Integrated craft path</span><h2>Story Craft Essentials</h2><p>Nine PlotPickled lessons connect audience experience, pacing, tone, thematic argument, scene change, screen evidence, motifs, advanced screenplay forms and an evidence-based craft audit to the active project.</p></div>
      <main className={styles.moduleGrid}>{storyCraftLessons.map((module) => <ModuleCard module={module} complete={completed.has(module.id)} recommended={recommendedIds.includes(module.id)} onOpen={() => openModule(module.id)} onToggle={() => toggleComplete(module.id)} key={module.id} />)}</main>
    </section> : view === "ai-revision" ?''',
)
replace(
    studio,
    'placeholder="Search 24 Blocks, playable dialogue, subtext, Voiceprint, table read, Final Draft, ownership, GitHub, AI revision…"',
    'placeholder="Search 24 Blocks, story experience, pacing, tone, theme, motifs, montage, playable dialogue, Voiceprint, ownership, AI revision…"',
)
replace(
    studio,
    '    {isDialogueLesson(module) ? <small>{module.collection} · Open {module.workspaceLabel}</small> : null}\n    {isCharacterMotionLesson(module) ? <small>{module.collection} · Open {module.workspaceLabel}</small> : null}',
    '    {isDialogueLesson(module) ? <small>{module.collection} · Open {module.workspaceLabel}</small> : null}\n    {isStoryCraftLesson(module) ? <small>{module.collection} · Open {module.workspaceLabel}</small> : null}\n    {isCharacterMotionLesson(module) ? <small>{module.collection} · Open {module.workspaceLabel}</small> : null}',
)
replace(
    studio,
    'isCollaborationLesson(module) || isWorkingTogetherLesson(module) || isDialogueLesson(module) || isCharacterMotionLesson(module) ? <span>{module.workspaceLabel}</span>',
    'isCollaborationLesson(module) || isWorkingTogetherLesson(module) || isDialogueLesson(module) || isStoryCraftLesson(module) || isCharacterMotionLesson(module) ? <span>{module.workspaceLabel}</span>',
)
replace(
    studio,
    'isMethodLesson(module) || isAiRevisionLesson(module) || isCollaborationLesson(module) || isWorkingTogetherLesson(module) || isDialogueLesson(module) || isCharacterMotionLesson(module) ? <small>{module.sourceNote}</small>',
    'isMethodLesson(module) || isAiRevisionLesson(module) || isCollaborationLesson(module) || isWorkingTogetherLesson(module) || isDialogueLesson(module) || isStoryCraftLesson(module) || isCharacterMotionLesson(module) ? <small>{module.sourceNote}</small>',
)
replace(
    studio,
    '        {isDialogueLesson(module) ? <section className={styles.example}><span>Direct application</span><h3>{module.workspaceLabel}</h3><p>The active Block and mini-block travel into the dialogue workspace. Blueprint, proof and table-read records remain reviewable evidence; no screenplay text is rewritten or applied automatically.</p></section> : null}\n        {isCharacterMotionLesson(module) ?',
    '        {isDialogueLesson(module) ? <section className={styles.example}><span>Direct application</span><h3>{module.workspaceLabel}</h3><p>The active Block and mini-block travel into the dialogue workspace. Blueprint, proof and table-read records remain reviewable evidence; no screenplay text is rewritten or applied automatically.</p></section> : null}\n        {isStoryCraftLesson(module) ? <section className={styles.example}><span>Direct application</span><h3>{module.workspaceLabel}</h3><p>The active Block and mini-block travel into the craft workspace. Cards, maps, ledgers and audits remain evidence records; no story or screenplay text is rewritten, formatted or inserted automatically.</p></section> : null}\n        {isCharacterMotionLesson(module) ?',
)
replace(
    studio,
    'isCollaborationLesson(module) || isWorkingTogetherLesson(module) || isDialogueLesson(module) || isCharacterMotionLesson(module) ? module.workspaceLabel',
    'isCollaborationLesson(module) || isWorkingTogetherLesson(module) || isDialogueLesson(module) || isStoryCraftLesson(module) || isCharacterMotionLesson(module) ? module.workspaceLabel',
)

hub = "app/engine-hub.tsx"
replace(
    hub,
    '''  {
    code: "RE",
    title: "Resonance Engine",''',
    '''  {
    code: "ES",
    title: "Story Craft Essentials",
    href: "/story-craft-essentials",
    stage: "Connect the craft",
    question: "How do promise, pacing, tone, theme, scenes, evidence and form work together?",
    summary:
      "Build a Story Experience Card, map pacing and tone, test thematic arguments, learn Scene Pulse terms, translate inner meaning into screen evidence, track motifs, preview advanced screenplay forms and run an evidence-based craft audit.",
    useWhen:
      "Use it when the intention is abstract—make it tense, strengthen the theme, improve the scene—or when several craft layers need one connected why-to-revision path.",
    connects: ["Story Setup and Pitch", "Structure and Scene Pulse", "Resonance", "PageFlow", "DraftLens", "Screenplay formatting"],
    result: "A connected craft diagnosis and set of reviewable cards, maps, ledgers, questions and revision priorities without automatic rewriting.",
  },
  {
    code: "RE",
    title: "Resonance Engine",''',
)
