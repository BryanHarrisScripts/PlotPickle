import { readFile, writeFile } from "node:fs/promises";

async function replace(path, before, after) {
  const source = await readFile(path, "utf8");
  if (!source.includes(before)) throw new Error(`Pattern not found in ${path}: ${before.slice(0, 100)}`);
  await writeFile(path, source.replace(before, after));
}

await replace(
  "app/collaboration-handbook/page.tsx",
  "  type CollaborationDecision,\n  type CollaborationModelId,\n  type CollaborationPrivacy,",
  "  type CollaborationDecision,\n  type CollaborationPrivacy,",
);

await replace(
  "app/learning-working-together.ts",
  "export type WorkingTogetherLesson = {",
  "type WorkingTogetherLessonSource = {",
);

await replace(
  "app/learning-working-together.ts",
  "};\n\nexport const collaboratorSourceMap",
  `};\n\nexport type WorkingTogetherLesson = WorkingTogetherLessonSource & {\n  collection: \"Working Together in PlotPickle\";\n  path: \"Industry\";\n  sourceNote: string;\n  workspaceLabel: \"Contributor Handbook\";\n  apply: \"Treatment\";\n};\n\nexport const collaboratorSourceMap`,
);

await replace(
  "app/learning-working-together.ts",
  "export const workingTogetherLessons: WorkingTogetherLesson[] = [",
  "const workingTogetherLessonSources: WorkingTogetherLessonSource[] = [",
);

await replace(
  "app/learning-working-together.ts",
  "];\n\nexport function workingTogetherSearchText(lesson: WorkingTogetherLesson) {",
  `];\n\nconst workingTogetherSourceNote = \"PlotPickled from the legacy Collaborators guide: Your Role and Key Questions, Process Post-Submission, Feedback and Communication, Unlimited Contributions, Evolving Together, Act review questions and the Afterglow collaborator guide.\";\n\nexport const workingTogetherLessons: WorkingTogetherLesson[] = workingTogetherLessonSources.map((lesson) => ({\n  ...lesson,\n  collection: \"Working Together in PlotPickle\",\n  path: \"Industry\",\n  sourceNote: workingTogetherSourceNote,\n  workspaceLabel: \"Contributor Handbook\",\n  apply: \"Treatment\",\n}));\n\nexport function workingTogetherSearchText(lesson: WorkingTogetherLesson) {`,
);

await replace(
  "app/learning-studio.tsx",
  'import { twentyFourBlocksLessons, twentyFourBlocksSearchText, type TwentyFourBlocksLesson } from "./learning-24-blocks";\nimport styles from "./learning-studio.module.css";',
  'import { twentyFourBlocksLessons, twentyFourBlocksSearchText, type TwentyFourBlocksLesson } from "./learning-24-blocks";\nimport { workingTogetherLessons, workingTogetherSearchText, type WorkingTogetherLesson } from "./learning-working-together";\nimport styles from "./learning-studio.module.css";',
);

await replace(
  "app/learning-studio.tsx",
  'type ViewMode = "workflow" | "guide" | "library" | "method" | "ai-revision" | "collaboration" | "characters";\ntype CourseModule = LearningModule | TwentyFourBlocksLesson | AiRevisionLesson | CollaborationOwnershipLesson | CharacterMotionLesson;',
  'type ViewMode = "workflow" | "guide" | "library" | "method" | "ai-revision" | "collaboration" | "characters" | "working-together";\ntype CourseModule = LearningModule | TwentyFourBlocksLesson | AiRevisionLesson | CollaborationOwnershipLesson | CharacterMotionLesson | WorkingTogetherLesson;',
);

await replace(
  "app/learning-studio.tsx",
  "  ...collaborationOwnershipLessons,\n  ...characterMotionLessons,\n];",
  "  ...collaborationOwnershipLessons,\n  ...characterMotionLessons,\n  ...workingTogetherLessons,\n];",
);

await replace(
  "app/learning-studio.tsx",
  'function isCharacterMotionLesson(module: CourseModule): module is CharacterMotionLesson {\n  return "collection" in module && module.collection === "Characters in Motion";\n}\n\nfunction courseSearchText',
  'function isCharacterMotionLesson(module: CourseModule): module is CharacterMotionLesson {\n  return "collection" in module && module.collection === "Characters in Motion";\n}\n\nfunction isWorkingTogetherLesson(module: CourseModule): module is WorkingTogetherLesson {\n  return "collection" in module && module.collection === "Working Together in PlotPickle";\n}\n\nfunction courseSearchText',
);

await replace(
  "app/learning-studio.tsx",
  "  if (isCharacterMotionLesson(module)) return `${base} ${characterMotionSearchText(module)}`;\n  return base;",
  "  if (isCharacterMotionLesson(module)) return `${base} ${characterMotionSearchText(module)}`;\n  if (isWorkingTogetherLesson(module)) return `${base} ${workingTogetherSearchText(module)}`;\n  return base;",
);

await replace(
  "app/learning-studio.tsx",
  '    if (isCharacterMotionLesson(module)) {\n      openCharacterWorkspace(module);\n      return;\n    }\n    if (module.apply === "Screenplay")',
  '    if (isCharacterMotionLesson(module)) {\n      openCharacterWorkspace(module);\n      return;\n    }\n    if (isWorkingTogetherLesson(module)) {\n      window.location.assign(module.workspaceTarget);\n      return;\n    }\n    if (module.apply === "Screenplay")',
);

await replace(
  "app/learning-studio.tsx",
  '      <button type="button" className={view === "collaboration" ? styles.active : ""} onClick={() => setView("collaboration")}>Collaboration, Formats & Ownership</button>\n      <button type="button" className={view === "guide" ? styles.active : ""} onClick={() => setView("guide")}>Guidance for this Block</button>',
  '      <button type="button" className={view === "collaboration" ? styles.active : ""} onClick={() => setView("collaboration")}>Collaboration, Formats & Ownership</button>\n      <button type="button" className={view === "working-together" ? styles.active : ""} onClick={() => setView("working-together")}>Working Together</button>\n      <button type="button" className={view === "guide" ? styles.active : ""} onClick={() => setView("guide")}>Guidance for this Block</button>',
);

await replace(
  "app/learning-studio.tsx",
  '    </section> : view === "collaboration" ? <section className={styles.library}>\n      <div className={styles.sectionIntro}><span>Practical workflow collection</span><h2>Collaboration, Formats & Ownership</h2><p>Five PlotPickled lessons replace eight legacy Blog articles with current local-first workflow choices, owner-controlled collaboration, direct screenplay interchange, careful rights guidance and optional AI, GitHub and public publishing paths.</p></div>\n      <main className={styles.moduleGrid}>{collaborationOwnershipLessons.map((module) => <ModuleCard module={module} complete={completed.has(module.id)} recommended={workflowChoices.find((choice) => choice.id === workflowChoiceId)?.lessonId === module.id} onOpen={() => openModule(module.id)} onToggle={() => toggleComplete(module.id)} key={module.id} />)}</main>\n    </section> : <section className={styles.library}>',
  '    </section> : view === "collaboration" ? <section className={styles.library}>\n      <div className={styles.sectionIntro}><span>Practical workflow collection</span><h2>Collaboration, Formats & Ownership</h2><p>Five PlotPickled lessons replace eight legacy Blog articles with current local-first workflow choices, owner-controlled collaboration, direct screenplay interchange, careful rights guidance and optional AI, GitHub and public publishing paths.</p></div>\n      <main className={styles.moduleGrid}>{collaborationOwnershipLessons.map((module) => <ModuleCard module={module} complete={completed.has(module.id)} recommended={workflowChoices.find((choice) => choice.id === workflowChoiceId)?.lessonId === module.id} onOpen={() => openModule(module.id)} onToggle={() => toggleComplete(module.id)} key={module.id} />)}</main>\n    </section> : view === "working-together" ? <section className={styles.library}>\n      <div className={styles.sectionIntro}><span>Contributor onboarding and review handbook</span><h2>Working Together in PlotPickle</h2><p>Eleven PlotPickled lessons define collaboration models, creative authority, contribution briefs, approved-story workflow, proposal packets, categorized reviews, canon decisions, disagreements, credit, privacy and responsible scaling.</p></div>\n      <main className={styles.moduleGrid}>{workingTogetherLessons.map((module) => <ModuleCard module={module} complete={completed.has(module.id)} recommended={false} onOpen={() => openModule(module.id)} onToggle={() => toggleComplete(module.id)} key={module.id} />)}</main>\n    </section> : <section className={styles.library}>',
);

await replace(
  "app/learning-studio.tsx",
  '    {isCharacterMotionLesson(module) ? <small>{module.collection} · Open {module.workspaceLabel}</small> : null}\n    <h3>{module.title}</h3>',
  '    {isCharacterMotionLesson(module) ? <small>{module.collection} · Open {module.workspaceLabel}</small> : null}\n    {isWorkingTogetherLesson(module) ? <small>{module.collection} · Open {module.workspaceLabel}</small> : null}\n    <h3>{module.title}</h3>',
);

await replace(
  "app/learning-studio.tsx",
  '    <div className={styles.cardStats}><span>{module.duration}</span><span>{module.sections.length} lessons</span>{isAiRevisionLesson(module) ? <span>{module.defaultOperation}</span> : isCollaborationLesson(module) || isCharacterMotionLesson(module) ? <span>{module.workspaceLabel}</span> : <span>Exercise</span>}</div>',
  '    <div className={styles.cardStats}><span>{module.duration}</span><span>{module.sections.length} lessons</span>{isAiRevisionLesson(module) ? <span>{module.defaultOperation}</span> : isCollaborationLesson(module) || isCharacterMotionLesson(module) || isWorkingTogetherLesson(module) ? <span>{module.workspaceLabel}</span> : <span>Exercise</span>}</div>',
);

await replace(
  "app/learning-studio.tsx",
  '{isMethodLesson(module) || isAiRevisionLesson(module) || isCollaborationLesson(module) || isCharacterMotionLesson(module) ? <small>{module.sourceNote}</small> : null}',
  '{isMethodLesson(module) || isAiRevisionLesson(module) || isCollaborationLesson(module) || isCharacterMotionLesson(module) || isWorkingTogetherLesson(module) ? <small>{module.sourceNote}</small> : null}',
);

await replace(
  "app/learning-studio.tsx",
  '        {isCharacterMotionLesson(module) ? <section className={styles.example}><span>Direct application</span><h3>{module.workspaceLabel}</h3><p>The active Block and mini-block travel into the character workspace. Diagnostics compare planned claims with project evidence and remain questions for the writer; no character, relationship, scene or dialogue is rewritten or merged automatically.</p></section> : null}\n        <section className={styles.example}><span>Worked example</span>',
  '        {isCharacterMotionLesson(module) ? <section className={styles.example}><span>Direct application</span><h3>{module.workspaceLabel}</h3><p>The active Block and mini-block travel into the character workspace. Diagnostics compare planned claims with project evidence and remain questions for the writer; no character, relationship, scene or dialogue is rewritten or merged automatically.</p></section> : null}\n        {isWorkingTogetherLesson(module) ? <section className={styles.example}><span>Direct application</span><h3>{module.workspaceLabel}</h3><p>The contributor handbook stores agreements, authority, briefs, proposal packets, categorized review notes and decisions in the active project. Opening it grants no repository access, ownership or licence and changes no story material automatically.</p></section> : null}\n        <section className={styles.example}><span>Worked example</span>',
);

await replace(
  "app/learning-studio.tsx",
  'Open {isAiRevisionLesson(module) ? module.destination : isCollaborationLesson(module) || isCharacterMotionLesson(module) ? module.workspaceLabel : module.apply}',
  'Open {isAiRevisionLesson(module) ? module.destination : isCollaborationLesson(module) || isCharacterMotionLesson(module) || isWorkingTogetherLesson(module) ? module.workspaceLabel : module.apply}',
);

const tests = await readFile("tests/issue-52-contributor-handbook.test.mjs", "utf8");
if (!tests.includes("central Read & Learn library")) {
  await writeFile("tests/issue-52-contributor-handbook.test.mjs", `${tests}\n\ntest("issue 52 appears as a first-class collection in the central Read & Learn library", async () => {\n  const studio = await readFile(new URL("../app/learning-studio.tsx", import.meta.url), "utf8");\n  assert.match(studio, /workingTogetherLessons/);\n  assert.match(studio, /Working Together in PlotPickle/);\n  assert.match(studio, /setView\\("working-together"\\)/);\n  assert.match(studio, /isWorkingTogetherLesson/);\n  assert.match(studio, /Contributor Handbook/);\n});\n`);
}

console.log("Working Together learning integration applied.");
