import type { LearningModule } from "./learning-library";

export type CollaborationWorkspaceTarget = "settings" | "writer" | "project-overview" | "pitch-review" | "ai-setup";

export type CollaborationOwnershipLesson = LearningModule & {
  collection: "Collaboration, Formats & Ownership";
  sourceAliases: string[];
  sourceNote: string;
  workspaceLabel: string;
  workspaceTarget: CollaborationWorkspaceTarget;
  workspaceHref: string;
};

export type WorkflowChoice = {
  id: "local-only" | "file-exchange" | "ai-assisted" | "private-github" | "public-open";
  title: string;
  summary: string;
  accountRequirement: string;
  lessonId: string;
  workspaceLabel: string;
};

export const workflowChoices: WorkflowChoice[] = [
  {
    id: "local-only",
    title: "Solo and entirely local",
    summary: "Write, plan, revise and back up the project on your own device. No cloud account, GitHub repository or AI provider is required.",
    accountRequirement: "No online account required",
    lessonId: "collaboration-choose-workflow",
    workspaceLabel: "Settings → Local Projects & Backups",
  },
  {
    id: "file-exchange",
    title: "Local with file exchange",
    summary: "Keep one approved project file, exchange named .ppf copies with trusted collaborators and compare changes before adopting them.",
    accountRequirement: "Accounts optional",
    lessonId: "collaboration-source-of-truth",
    workspaceLabel: "Writer → Import & Export",
  },
  {
    id: "ai-assisted",
    title: "Local with optional AI assistance",
    summary: "Connect a provider only for bounded tasks, preserve provenance and require explicit writer approval before retaining suggestions.",
    accountRequirement: "AI provider optional",
    lessonId: "collaboration-ai-github-publishing",
    workspaceLabel: "Settings → AI Setup",
  },
  {
    id: "private-github",
    title: "Private team collaboration",
    summary: "Use an owner-controlled private repository for proposed alternate versions, anchored review and approved merges without making the screenplay public.",
    accountRequirement: "Private GitHub access required",
    lessonId: "collaboration-source-of-truth",
    workspaceLabel: "Settings → GitHub & Backups",
  },
  {
    id: "public-open",
    title: "Public or openly licensed project",
    summary: "Publish or license only after separating access, reuse permission, contributor rights, third-party material and brand restrictions.",
    accountRequirement: "Public publishing is a deliberate choice",
    lessonId: "collaboration-ownership-sharing",
    workspaceLabel: "Project Overview → Rights & Provenance",
  },
];

export const legacyBlogSourceMap = [
  { source: "GitHub for Screenwriters", lessonId: "collaboration-choose-workflow" },
  { source: "GitHub Collaborative Writing", lessonId: "collaboration-source-of-truth" },
  { source: "GitHub Mastering Markdown", lessonId: "collaboration-formats-that-travel" },
  { source: "GitHub Merging Final Draft and Text", lessonId: "collaboration-formats-that-travel" },
  { source: "Open-Sourcing Licensing and Protection", lessonId: "collaboration-ownership-sharing" },
  { source: "Open-Sourcing Your Screenplay", lessonId: "collaboration-ownership-sharing" },
  { source: "LLMs, Twitter, GitHub, and AI", lessonId: "collaboration-ai-github-publishing" },
  { source: "LLMs and AI Navigation", lessonId: "collaboration-ai-github-publishing" },
] as const;

export const writerGitGlossary = [
  { term: "Repository", writerMeaning: "Project home", explanation: "The controlled location that stores the project and its history." },
  { term: "Branch", writerMeaning: "Proposed alternate version", explanation: "A separate line of changes that does not replace the approved version." },
  { term: "Commit", writerMeaning: "Saved change set", explanation: "A named snapshot describing a coherent group of edits." },
  { term: "Pull request", writerMeaning: "Reviewable change proposal", explanation: "A place to compare, discuss and approve a proposed version before adoption." },
  { term: "Merge", writerMeaning: "Owner-approved adoption", explanation: "The deliberate act of adding an approved proposal to the canonical project." },
  { term: "Conflict", writerMeaning: "Competing changes requiring a decision", explanation: "Two edits affect the same material and cannot be combined safely without human judgment." },
] as const;

export const formatGuide = [
  {
    format: ".ppf",
    bestFor: "Complete portable PlotPickle projects and routine project exchange.",
    preserves: "Project structure, story development, screenplay, blocks, notes, provenance and supported assets.",
    cautions: "Treat one named copy as canonical. Confirm version and ownership before replacing an active project.",
  },
  {
    format: ".plotpickle.json",
    bestFor: "Canonical structured project export, inspection, migration and integrations where available.",
    preserves: "Structured PlotPickle data in a readable machine format.",
    cautions: "Manual edits can break schema relationships. Re-import and validate before treating a changed file as authoritative.",
  },
  {
    format: "Markdown",
    bestFor: "Treatments, notes, documentation, credits and presentation-ready pitch text.",
    preserves: "Headings, lists, emphasis, links and readable plain text.",
    cautions: "Markdown is not screenplay formatting. It does not replace Fountain or FDX for screenplay interchange.",
  },
  {
    format: "Fountain",
    bestFor: "Portable plain-text screenplay interchange and version comparison.",
    preserves: "Core screenplay elements when the source follows Fountain conventions.",
    cautions: "Application-specific metadata, complex revisions and some layout choices may not round-trip exactly.",
  },
  {
    format: "FDX",
    bestFor: "Interchange with Final Draft and other applications that support Final Draft XML.",
    preserves: "Screenplay elements and more document structure than plain text.",
    cautions: "Software-specific metadata, revision colours, production data and unsupported extensions can differ after a round trip.",
  },
  {
    format: "PDF",
    bestFor: "Stable reading copies, submissions, review and printing.",
    preserves: "The intended visible page layout at export time.",
    cautions: "PDF is a reading endpoint, not the preferred editable source. Importing it back can be lossy.",
  },
  {
    format: "HTML and Markdown presentation exports",
    bestFor: "Pitch packages, browser viewing and portable presentation material.",
    preserves: "Presentation order, text, links and supported visual references.",
    cautions: "A pitch export is not the complete project and should not be mistaken for the canonical screenplay or rights record.",
  },
] as const;

const ownershipDistinctions = [
  "PlotPickle software: AGPL-3.0-or-later.",
  "Reusable method and educational documentation: CC BY-SA 4.0 unless otherwise marked.",
  "User-created stories and screenplays: remain the user's work and are not automatically licensed to PlotPickle or the public.",
  "Third-party text, images, music, likenesses and reference material: governed by their own permissions and licences.",
  "PlotPickle names, logos and brand assets: governed separately from the software and educational material.",
];

export const collaborationOwnershipLessons: CollaborationOwnershipLesson[] = [
  {
    id: "collaboration-choose-workflow",
    number: 39,
    path: "Development",
    title: "Choose Your PlotPickle Workflow",
    duration: "15–20 min",
    overview: "Compare five valid ways to write with PlotPickle and choose the least complicated workflow that protects the project, supports the people involved and matches the intended level of technology and openness.",
    objectives: [
      "Compare local-only, file exchange, AI-assisted, private GitHub and public/open workflows.",
      "Separate the writing method from optional infrastructure and publishing choices.",
      "Record one canonical project, one owner-approved version and one backup plan.",
    ],
    sections: [
      {
        heading: "Begin with the creative relationship",
        paragraphs: [
          "The correct workflow is not the one with the most tools. It is the smallest system that lets the writer create, recover work, invite the right people and make decisions without losing the source of truth.",
          "Solo local use is a complete PlotPickle workflow. GitHub, an AI provider, a public repository and an open licence are optional paths rather than requirements for normal writing.",
        ],
        points: workflowChoices.map((choice) => `${choice.title}: ${choice.summary}`),
      },
      {
        heading: "Name the canonical project",
        paragraphs: [
          "Choose the file or controlled project home that represents the approved story. Draft copies, review exports and proposed alternatives should be named as such rather than silently replacing it.",
          "A backup protects against loss. A proposal protects against unwanted replacement. A public copy provides access. These are different functions and may use different tools.",
        ],
        points: ["Canonical project", "Named working copy", "Recovery backup", "Review copy", "Publication copy"],
      },
      {
        heading: "Choose only what the project needs",
        paragraphs: [
          "Add file exchange when another person needs to work independently. Add private version control when multiple contributors need reviewable proposals and history. Add AI only for a defined task with bounded context. Publish only when public access is itself part of the plan.",
        ],
        points: ["No online account is required for local writing.", "No AI provider is required for drafting or revision.", "A private collaboration space is not public access.", "Public visibility is not permission to reuse."],
      },
    ],
    definitions: [
      { term: "Canonical project", meaning: "The owner-approved project version treated as the current source of truth." },
      { term: "Workflow", meaning: "The repeatable path used to create, save, review, approve, exchange and publish work." },
      { term: "Infrastructure", meaning: "Optional supporting tools such as cloud storage, GitHub or an AI provider; not the story method itself." },
    ],
    example: {
      title: "A two-writer feature without public access",
      text: "The owner keeps the canonical .ppf project locally, exchanges dated proposal files with the co-writer, uses a private GitHub repository only when review volume grows, and exports PDF copies for readers. The screenplay is never public and no open licence is applied.",
    },
    checklist: ["The owner and decision maker are named.", "The canonical project is identifiable.", "The backup and recovery method is defined.", "Each collaborator knows whether they may edit, comment, approve or publish.", "Optional AI, GitHub and public-sharing choices are documented separately."],
    mistakes: ["Assuming every writer needs GitHub.", "Calling every copy the final version.", "Treating a backup as a collaboration workflow.", "Publishing because sharing privately feels inconvenient.", "Adding AI before defining the task and approval boundary."],
    exercise: "Choose one of the five workflow paths for the active project. Write one sentence naming the canonical file, one sentence naming who can approve changes and one sentence naming the recovery backup.",
    apply: "Treatment",
    tags: ["workflow", "local-first", "file exchange", "AI-assisted", "private GitHub", "public repository", "open licence", "canonical project", "GitHub for Screenwriters"],
    collection: "Collaboration, Formats & Ownership",
    sourceAliases: ["GitHub for Screenwriters"],
    sourceNote: "PlotPickled from the legacy GitHub for Screenwriters article and updated for PlotPickle's local-first, optional-infrastructure workflow.",
    workspaceLabel: "Settings → Local Projects & Backups",
    workspaceTarget: "settings",
    workspaceHref: "/?workspace=settings&section=local-projects-backups",
  },
  {
    id: "collaboration-source-of-truth",
    number: 40,
    path: "Development",
    title: "Collaborate Without Losing the Source of Truth",
    duration: "25–35 min",
    overview: "Turn collaboration into reviewable proposals, anchored discussion and explicit owner approval while preserving attribution, intent, provenance and the approved project version.",
    objectives: [
      "Define owner, writer, reviewer and contributor roles before edits begin.",
      "Translate Git concepts into plain screenwriting decisions.",
      "Compare proposed revisions before accepting, rejecting or combining them.",
    ],
    sections: [
      {
        heading: "Define roles and decision ownership",
        paragraphs: [
          "The owner controls the canonical project and the final adoption decision. A writer may propose changes. A reviewer reports reader experience and craft evidence. A contributor supplies defined material or expertise. One person may hold several roles, but the permissions should still be explicit.",
          "Contribution does not automatically settle ownership, credit, payment or reuse permission. Record those understandings separately and early.",
        ],
        points: ["Owner: controls the canonical version and approval.", "Writer: creates or revises story material.", "Reviewer: comments without silently replacing.", "Contributor: supplies a bounded contribution under agreed terms."],
      },
      {
        heading: "Propose rather than overwrite",
        paragraphs: [
          "Keep the approved version intact while another version is being considered. Use stable anchors, named revisions and before/after comparison so a comment remains connected to the relevant Block, scene, character, Story Thread or screenplay element.",
          "A disagreement should return to evidence, writer intent, continuity and decision ownership. Merging is the final approval step, not the beginning of collaboration.",
        ],
        points: ["State the purpose of the proposal.", "Show the original beside the alternative.", "Identify affected canon and downstream work.", "Resolve comments or record why they remain open.", "Merge only after explicit approval."],
      },
      {
        heading: "Git concepts in writer language",
        paragraphs: ["Git terminology is useful when a team chooses GitHub, but the creative decisions come first. The same principles can be followed through named .ppf files and a written review log."],
        points: writerGitGlossary.map((item) => `${item.term} → ${item.writerMeaning}: ${item.explanation}`),
      },
      {
        heading: "Preserve history and attribution",
        paragraphs: [
          "A useful revision record says who proposed the change, what it intended to solve, what evidence supported it, who approved it and which version adopted it. This history supports continuity and credit, but it does not replace a written rights or compensation agreement.",
        ],
      },
    ],
    definitions: writerGitGlossary.slice(0, 3).map((item) => ({ term: `${item.term} — ${item.writerMeaning}`, meaning: item.explanation })),
    example: {
      title: "Reviewing a new ending",
      text: "A co-writer creates a proposed alternate version rather than replacing the final act. The review identifies three changed setups, compares the emotional proof of each ending and records the owner-approved choice. The rejected version remains in history without becoming canon.",
    },
    checklist: ["Roles and permissions are explicit.", "The canonical project is protected.", "Every proposal has a purpose and author.", "Comments use stable story anchors.", "Before and after versions can be compared.", "Attribution and approval are recorded."],
    mistakes: ["Letting the newest file become canonical by accident.", "Using comments without identifying the affected version.", "Treating reviewer suggestions as instructions.", "Merging unresolved continuity conflicts.", "Assuming version history is a complete ownership agreement."],
    exercise: "Choose one active Block or scene. Name its approved version, create a clearly labelled proposed alternative, list the evidence supporting the proposal and state who can approve its adoption.",
    apply: "Treatment",
    tags: ["collaboration", "source of truth", "branch", "commit", "pull request", "merge", "conflict", "review", "attribution", "GitHub Collaborative Writing"],
    collection: "Collaboration, Formats & Ownership",
    sourceAliases: ["GitHub Collaborative Writing", "GitHub for Screenwriters"],
    sourceNote: "PlotPickled from the legacy GitHub collaboration articles and expressed through PlotPickle's owner-controlled proposals, anchors, snapshots and approval boundaries.",
    workspaceLabel: "Settings → GitHub & Backups",
    workspaceTarget: "settings",
    workspaceHref: "/?workspace=settings&section=github-backups",
  },
  {
    id: "collaboration-formats-that-travel",
    number: 41,
    path: "Drafting",
    title: "Formats That Travel",
    duration: "25–35 min",
    overview: "Choose the right format for complete project exchange, screenplay interchange, stable reading, documentation or presentation without confusing a convenient export with the canonical source.",
    objectives: [
      "Distinguish .ppf, PlotPickle JSON, Markdown, Fountain, FDX, PDF and presentation exports.",
      "Replace outdated Final Draft-to-text workarounds with direct import and export.",
      "Anticipate what may be lost or changed during a round trip.",
    ],
    sections: [
      {
        heading: "Choose by purpose, not familiarity",
        paragraphs: [
          "No single format is best for every task. Use .ppf for a complete PlotPickle project, structured PlotPickle JSON where machine-readable interchange is required, Fountain or FDX for editable screenplay interchange, PDF for stable reading and Markdown or HTML for treatments, notes and pitch presentation.",
        ],
        points: formatGuide.map((item) => `${item.format}: ${item.bestFor}`),
      },
      {
        heading: "Markdown is not screenplay formatting",
        paragraphs: [
          "Markdown is excellent for headings, notes, treatment sections, documentation, credits and pitch copy. It does not encode screenplay elements with the same purpose as Fountain or FDX and should not be taught as a substitute for a screenplay document.",
          "PlotPickle connects the Markdown Treatment to all 96 mini-blocks while keeping screenplay interchange in screenplay formats.",
        ],
      },
      {
        heading: "Use direct Final Draft interchange",
        paragraphs: [
          "PlotPickle can import Final Draft FDX directly and export FDX or Fountain. Writers should not be sent through WriterDuet, copied plain text or Markdown conversion merely to move between Final Draft and a review workflow.",
          "After any interchange, compare scene order, element types, character names, revisions and page-sensitive material before continuing.",
        ],
        points: ["Import FDX directly.", "Export FDX for Final Draft interchange.", "Export Fountain for portable screenplay text.", "Keep the PlotPickle project as the complete source when project-only data matters."],
      },
      {
        heading: "Plan for round trips",
        paragraphs: [
          "A round trip means exporting to another format, editing elsewhere and importing back. Every round trip should have a named source version, a comparison step and a decision about which application-specific information is allowed to be omitted.",
        ],
        points: formatGuide.map((item) => `${item.format} caution: ${item.cautions}`),
      },
    ],
    definitions: [
      { term: "Interchange format", meaning: "A format chosen to move editable material between applications." },
      { term: "Reading format", meaning: "A stable output such as PDF intended for review rather than continued structured editing." },
      { term: "Round trip", meaning: "Exporting, editing in another tool and importing back while checking what changed or was lost." },
    ],
    example: {
      title: "Sending a screenplay to a Final Draft collaborator",
      text: "Export FDX from the named PlotPickle version, let the collaborator revise that copy, import the returned FDX as a proposal and compare it before adoption. Keep the .ppf project as the source for Blocks, notes, provenance and other PlotPickle-only data.",
    },
    checklist: ["The purpose of the export is named.", "The format preserves the required information.", "The canonical project remains identifiable.", "The recipient knows whether the file is editable, review-only or publishable.", "Round-trip differences are reviewed before replacement."],
    mistakes: ["Using Markdown as screenplay formatting.", "Treating PDF as an editable master.", "Assuming all FDX metadata round-trips identically.", "Replacing the complete project with a screenplay-only export.", "Using old text-conversion workarounds when direct import/export exists."],
    exercise: "Choose one active-project exchange task. Select the best format, list what it preserves, list what it omits and define the comparison step required before the returned material can become canonical.",
    apply: "Screenplay",
    tags: ["format chooser", ".ppf", ".plotpickle.json", "Markdown", "Fountain", "FDX", "Final Draft", "PDF", "HTML", "pitch deck", "round trip", "GitHub Mastering Markdown", "GitHub Merging Final Draft and Text"],
    collection: "Collaboration, Formats & Ownership",
    sourceAliases: ["GitHub Mastering Markdown", "GitHub Merging Final Draft and Text", "Final Draft and text"],
    sourceNote: "PlotPickled from the legacy Markdown and Final Draft conversion articles and replaced with PlotPickle's direct project, Fountain, FDX, PDF, HTML and Markdown export guidance.",
    workspaceLabel: "Writer → Import & Export",
    workspaceTarget: "writer",
    workspaceHref: "/?workspace=script&section=import-export",
  },
  {
    id: "collaboration-ownership-sharing",
    number: 42,
    path: "Industry",
    title: "Ownership, Licences and Sharing Choices",
    duration: "30–40 min",
    overview: "Separate copyright ownership, collaboration access, public visibility and reuse permission so a deliberate sharing choice does not accidentally become a claim about rights or protection.",
    objectives: [
      "Distinguish ownership from a licence and access from reuse permission.",
      "Separate software, educational material, user work, third-party material and brand rights.",
      "Document collaborator contributions, permissions and credits before high-stakes sharing or commercial decisions.",
    ],
    sections: [
      {
        heading: "Ownership and licences answer different questions",
        paragraphs: [
          "Copyright ownership concerns who holds rights in a work. A licence is permission from a rights holder for specified uses under stated conditions. Sharing a file, inviting a reviewer, publishing a repository and applying an open licence are separate decisions.",
          "PlotPickle provides practical education, not legal advice. A licence does not guarantee attribution, payment, discovery, production, enforcement or practical control over every reuse.",
        ],
        points: ["Private access does not grant reuse rights.", "Public visibility does not automatically grant reuse rights.", "An open licence grants defined permissions; it is not merely a visibility setting.", "Only someone with the necessary rights should grant a licence."],
      },
      {
        heading: "Keep PlotPickle's rights layers separate",
        paragraphs: [
          "Open-source software does not open-source the user's screenplay. Educational-content terms do not automatically apply to a story. Third-party assets and trademarks may carry restrictions that neither the software licence nor the writer's chosen story licence can override.",
        ],
        points: ownershipDistinctions,
      },
      {
        heading: "Document collaboration before publication",
        paragraphs: [
          "Record who contributed what, whether the contribution was commissioned or collaborative, how credit will appear, who may approve changes, what may be shared and who may grant licences. For music, images, likenesses, research interviews and cultural material, record permissions and limits rather than assuming inclusion proves clearance.",
          "Meaningful commercial, employment, union, privacy, defamation, chain-of-title or licensing decisions should be reviewed by a qualified professional in the relevant jurisdiction.",
        ],
      },
      {
        heading: "Choose access, publication and reuse separately",
        paragraphs: [
          "A private collaborator can receive access without publication. A public reading copy can be visible while remaining conventionally copyrighted. An openly licensed screenplay can permit reuse under specified terms. The project should record which choice was made and by whom.",
        ],
        points: ["Access: who can see or review.", "Publication: whether the work is made public.", "Licence: what reuse is permitted.", "Credit: how contributors and sources are acknowledged.", "Provenance: where retained material came from and who approved it."],
      },
    ],
    definitions: [
      { term: "Copyright", meaning: "The legal rights that may arise in original expression, subject to jurisdiction, authorship and other facts." },
      { term: "Licence", meaning: "Permission from a rights holder for specified uses under stated terms." },
      { term: "Provenance", meaning: "A record of where material came from, who contributed it and how it entered the approved project." },
    ],
    example: {
      title: "Private review without open licensing",
      text: "A writer sends a watermarked PDF to an invited reviewer under a confidentiality agreement, records the reviewer's notes in PlotPickle and retains conventional copyright. The file was shared for review; it was not published and no reuse licence was granted.",
    },
    checklist: ["The rights holder or decision maker is identified.", "Access, publication and reuse permissions are recorded separately.", "Collaborator contributions and credits are documented.", "Third-party material has its own permission record.", "The selected licence matches the intended reuse and is granted by someone with authority.", "High-stakes decisions receive qualified review."],
    mistakes: ["Assuming PlotPickle's AGPL licence applies to a screenplay.", "Using public visibility as a substitute for a licence.", "Applying an open licence without all necessary rights.", "Promising that a licence guarantees payment or practical control.", "Treating a version history as complete chain-of-title documentation."],
    exercise: "For the active project, write separate statements for ownership, private access, public visibility, permitted reuse, collaborator credit and third-party material. Mark every statement that requires professional review.",
    apply: "Treatment",
    tags: ["ownership", "copyright", "licence", "license", "sharing", "public access", "open-source screenplay", "AGPL-3.0-or-later", "CC BY-SA 4.0", "third-party material", "trademark", "brand rights", "Open-Sourcing Licensing and Protection", "Open-Sourcing Your Screenplay"],
    collection: "Collaboration, Formats & Ownership",
    sourceAliases: ["Open-Sourcing Licensing and Protection", "Open-Sourcing Your Screenplay", "open-source screenplay"],
    sourceNote: "PlotPickled from the two legacy open-sourcing articles with careful separation of ownership, access, publication, licensing, third-party rights and PlotPickle's own licence layers.",
    workspaceLabel: "Project Overview → Rights & Provenance",
    workspaceTarget: "project-overview",
    workspaceHref: "/?workspace=planner&section=overview#rights-provenance",
  },
  {
    id: "collaboration-ai-github-publishing",
    number: 43,
    path: "Responsible AI",
    title: "AI, GitHub and Public Publishing as Optional Tools",
    duration: "25–35 min",
    overview: "Use AI assistance, private version control, social serialization and public repositories as separate optional choices while protecting context, consent, continuity, provenance and writer approval.",
    objectives: [
      "Distinguish AI-assisted, AI-generated and no-AI workflows without claiming one universal legal classification.",
      "Use provider-independent AI with bounded context, provenance and explicit approval.",
      "Separate private collaboration from public publishing and promotional serialization.",
    ],
    sections: [
      {
        heading: "Choose the tool after defining the task",
        paragraphs: [
          "AI can ask questions, critique, identify evidence, compare alternatives or propose a revision for review. GitHub can preserve proposed versions and discussion. Social platforms can publish or serialize selected material. None of these tools is required to use the 24 Blocks method or write a screenplay in PlotPickle.",
          "Avoid treating AI-assisted, AI-generated and no-AI as universal legal categories. Record what actually happened: the provider, task, supplied context, output retained, human changes and approval decision.",
        ],
      },
      {
        heading: "Bound context and preserve approval",
        paragraphs: [
          "Share the smallest canonical scope needed for the task. Do not send confidential collaborator material, private research, personal data, culturally sensitive material or third-party content without permission and a reasoned provider choice.",
          "Keep generated output separate from the original. The writer reviews evidence, invented facts, continuity risk, voice drift and rights concerns before retaining anything.",
        ],
        points: ["Provider-independent setup", "Smallest useful context", "Task and operation named", "Provenance recorded", "Original preserved", "Explicit writer approval"],
      },
      {
        heading: "Collaboration is not publication",
        paragraphs: [
          "A private repository supports invited collaboration. A public repository makes material visible. A social post serializes or promotes selected material. An open licence grants stated reuse permissions. These controls should never be collapsed into one public/private switch.",
        ],
        points: ["Private team access", "Public source access", "Promotional publishing", "Openly licensed reuse"],
      },
      {
        heading: "Route craft work to guided revision",
        paragraphs: [
          "Detailed AI craft instruction belongs in PlotPickle's AI-Assisted Revision collection from issue #49. Choose a focused pass, operation and canonical scope, then route only approved work to the relevant specialist engine or lab.",
          "Public publishing decisions should also consider confidentiality, consent, cultural care, continuity, third-party rights, platform terms and whether early disclosure harms later submission or commercial plans.",
        ],
      },
    ],
    definitions: [
      { term: "AI-assisted", meaning: "A workflow in which a person uses an AI system for defined support while retaining responsibility for selection, revision and approval." },
      { term: "Bounded context", meaning: "Only the smallest approved project material needed for the task is supplied to a provider." },
      { term: "Serialization", meaning: "Publishing a work in selected instalments or posts rather than sharing the complete private project." },
    ],
    example: {
      title: "Private diagnosis, no automatic rewrite",
      text: "The writer sends one scene and its character goals to a chosen provider, requests critique only, records the provider and date, rejects an invented backstory and retains two questions. The screenplay remains private; nothing is posted publicly or merged automatically.",
    },
    checklist: ["The task can be explained without naming a model brand.", "The smallest canonical scope is selected.", "Confidentiality, consent and provider terms are considered.", "The original remains visible beside any proposal.", "Retained material has provenance and explicit approval.", "Private collaboration, public publishing and open licensing are separate decisions."],
    mistakes: ["Sending the complete project when one scene is enough.", "Treating confident output as verified evidence.", "Using a public repository for private review by accident.", "Assuming a social post grants or protects rights.", "Repeating generic prompt advice instead of using the guided revision playbooks."],
    exercise: "Choose one optional tool for the active project: AI, private GitHub, public repository or social serialization. State the exact purpose, context boundary, access level, approval step and reason the other tools are not required for this task.",
    apply: "Screenplay",
    tags: ["AI-assisted", "AI-generated", "no-AI", "provider-independent", "bounded context", "GitHub", "public publishing", "serialization", "privacy", "consent", "provenance", "AI-Assisted Revision", "LLMs, Twitter, GitHub, and AI", "LLMs and AI Navigation"],
    collection: "Collaboration, Formats & Ownership",
    sourceAliases: ["LLMs, Twitter, GitHub, and AI", "LLMs and AI Navigation"],
    sourceNote: "PlotPickled from the two legacy AI navigation articles, with dated model assumptions removed and detailed craft prompting routed to AI-Assisted Revision.",
    workspaceLabel: "Settings → AI Setup",
    workspaceTarget: "ai-setup",
    workspaceHref: "/?workspace=settings&section=ai-setup",
  },
];

export function collaborationOwnershipSearchText(lesson: CollaborationOwnershipLesson) {
  const mappedSources = legacyBlogSourceMap.filter((item) => item.lessonId === lesson.id).map((item) => item.source);
  return [
    lesson.collection,
    lesson.workspaceLabel,
    lesson.workspaceHref,
    lesson.sourceNote,
    ...lesson.sourceAliases,
    ...mappedSources,
    ...workflowChoices.flatMap((choice) => [choice.title, choice.summary, choice.accountRequirement]),
    ...writerGitGlossary.flatMap((item) => [item.term, item.writerMeaning, item.explanation]),
    ...formatGuide.flatMap((item) => [item.format, item.bestFor, item.preserves, item.cautions]),
    ...ownershipDistinctions,
  ].join(" ").toLowerCase();
}
