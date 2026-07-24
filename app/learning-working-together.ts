import {
  authorityActions,
  briefTemplates,
  collaborationModels,
  collaborationRoles,
  collaborationSourceAliases,
  reviewCategories,
  reviewOutcomes,
} from "@/lib/collaboration-handbook";

type WorkingTogetherLessonSource = {
  id: string;
  number: number;
  title: string;
  duration: string;
  overview: string;
  objectives: string[];
  sections: Array<{ heading: string; paragraphs: string[]; points?: string[] }>;
  definitions: Array<{ term: string; meaning: string }>;
  example: { title: string; text: string };
  checklist: string[];
  mistakes: string[];
  exercise: string;
  workspaceTarget: string;
  aliases: string[];
};

export type WorkingTogetherLesson = WorkingTogetherLessonSource & {
  collection: "Working Together in PlotPickle";
  path: "Industry";
  sourceNote: string;
  workspaceLabel: "Contributor Handbook";
  apply: "Treatment";
};

export const collaboratorSourceMap = [
  { source: "Your Role and Key Questions", lessonIds: ["working-model", "working-authority", "working-brief"] },
  { source: "Process Post-Submission", lessonIds: ["working-proposal", "working-canon", "working-disagreement"] },
  { source: "Feedback and Communication", lessonIds: ["working-review", "working-disagreement"] },
  { source: "Unlimited Contributions", lessonIds: ["working-scale", "working-brief"] },
  { source: "Evolving Together", lessonIds: ["working-canon", "working-credit"] },
  { source: "Act review questions", lessonIds: ["working-review", "working-proposal"] },
  { source: "Afterglow collaborator guide", lessonIds: ["working-model", "working-privacy", "working-scale"] },
] as const;

const workingTogetherLessonSources: WorkingTogetherLessonSource[] = [
  {
    id: "working-model",
    number: 1,
    title: "Choose the Collaboration Model",
    duration: "20–30 min",
    overview: "Decide how people are joining the project before deciding which tool they will use. Privacy, authority, payment, credit, ownership and licensing are separate choices.",
    objectives: ["Compare eight valid collaboration models.", "Separate public visibility from open licensing.", "Document who controls the current canon."],
    sections: [
      {
        heading: "Start with the human agreement",
        paragraphs: [
          "A GitHub repository does not tell a contributor whether they are a reader, co-writer, commissioned editor or community participant. The project owner should name the collaboration model before inviting access, so everyone understands the expected contribution and who decides what becomes canonical.",
          "PlotPickle supports local-only work, file exchange and private or public repositories. None of these automatically transfers copyright, creates co-ownership or applies an open licence.",
        ],
        points: collaborationModels.map((model) => `${model.label}: ${model.summary}`),
      },
      {
        heading: "Record the separate decisions",
        paragraphs: [
          "For the chosen model, record who owns the current project, who may view, comment, propose and approve, whether compensation or credit is expected, whether confidentiality applies and which reuse licence—if any—governs accepted material.",
          "Repository permissions remain the technical authority. The collaboration agreement explains the creative authority those permissions are intended to represent.",
        ],
      },
    ],
    definitions: [
      { term: "Collaboration model", meaning: "The agreed relationship between the project owner and people who review, create or approve material." },
      { term: "Canon", meaning: "The currently approved project version and facts that other work should treat as authoritative." },
      { term: "Open licence", meaning: "A specific permission to reuse material under stated conditions; public access alone is not enough." },
    ],
    example: { title: "Private review is not co-writing", text: "A producer receives a private PDF and adds anchored comments. The owner may accept the notes, but the producer does not gain authorship or merge authority merely by reviewing." },
    checklist: ["The model is named.", "Canon authority is explicit.", "Privacy is explicit.", "Credit, payment and ownership are addressed separately.", "The reuse licence is recorded rather than assumed."],
    mistakes: ["Inviting someone before defining their role.", "Treating a public repository as an open licence.", "Assuming feedback creates ownership.", "Requiring GitHub for a collaboration that only needs private file exchange."],
    exercise: "Choose the active project's collaboration model and write one sentence each for canon authority, privacy, credit, ownership and review timing.",
    workspaceTarget: "/collaboration-handbook#agreement",
    aliases: ["Afterglow collaborator guide", "collaboration model", "open source collaboration", "private review"],
  },
  {
    id: "working-authority",
    number: 2,
    title: "Define Roles and Decision Authority",
    duration: "25–35 min",
    overview: "Give every collaborator a writer-facing role and an explicit authority scope instead of inferring creative power from account access.",
    objectives: ["Distinguish ownership, creative role and technical permission.", "Build an authority matrix.", "Delegate approval without making canon authority ambiguous."],
    sections: [
      {
        heading: "Plain-language roles",
        paragraphs: ["Roles describe the contribution relationship, not personal status. One person may hold several roles, and a role can be limited to one character, scene, production area or review round."],
        points: collaborationRoles.map((role) => `${role.label}: ${role.summary}`),
      },
      {
        heading: "Authority is action-specific",
        paragraphs: ["A reviewer may create comments but not proposals. A co-writer may propose story changes but not change the licence. A production designer may approve visual assets within a delegated scope while the project owner retains screenplay canon authority."],
        points: authorityActions.map((action) => action.label),
      },
    ],
    definitions: [
      { term: "Creative authority", meaning: "The agreed power to make or approve a story, screenplay, rights or production decision." },
      { term: "Technical permission", meaning: "What an account or repository setting allows a person to do in software." },
      { term: "Delegated maintainer", meaning: "A person explicitly authorized to make defined final decisions without becoming the sole project owner." },
    ],
    example: { title: "A narrow delegation", text: "The composer may approve cue metadata and replacement stems, but cannot merge dialogue rewrites or change the screenplay licence. The authority record names that scope." },
    checklist: ["Every collaborator has a role.", "Authority actions are selected individually.", "The scope and delegating person are named.", "Rights records and authority records are not confused.", "GitHub permissions match the intended authority where GitHub is used."],
    mistakes: ["Giving merge access because someone needs to comment.", "Calling every participant a co-writer.", "Leaving licence changes inside a vague owner role.", "Recording credit without recording authority—or authority without an agreement reference."],
    exercise: "Create an authority record for one real or hypothetical collaborator. Select only the actions they genuinely need.",
    workspaceTarget: "/collaboration-handbook#roles",
    aliases: ["Your Role and Key Questions", "role matrix", "creative authority", "GitHub permissions"],
  },
  {
    id: "working-brief",
    number: 3,
    title: "Create a Contribution Brief",
    duration: "30–40 min",
    overview: "Replace the invitation to ‘improve the story’ with a bounded brief that identifies the problem, target, locks, freedom, deliverable and acceptance criteria.",
    objectives: ["Scope a contribution around a concrete target.", "Protect approved canon and continuity.", "Set realistic review and credit expectations."],
    sections: [
      {
        heading: "A brief is a creative container",
        paragraphs: ["The brief tells the contributor what problem they are solving and what success looks like. It should point to a project field, Block, scene, character, Story Thread, screenplay passage or production asset whenever possible."],
        points: briefTemplates.map((template) => template),
      },
      {
        heading: "Locks and freedom belong together",
        paragraphs: ["List facts and dependencies that are already canonical, then identify what may be explored. ‘Bounded freedom’ is often more useful than either exact execution or unrestricted reinvention."],
        points: ["Problem or question", "Story purpose and audience effect", "Canon facts and continuity locks", "Elements that must not change", "Preferred output", "Creative freedom", "Review window", "Credit, compensation, ownership and licence references", "Acceptance criteria"],
      },
    ],
    definitions: [
      { term: "Contribution brief", meaning: "A canonical request describing a bounded contribution, its purpose, target, constraints and acceptance criteria." },
      { term: "Canon lock", meaning: "An approved fact, choice or dependency the contribution must preserve unless the brief explicitly opens it." },
      { term: "Acceptance criteria", meaning: "Observable requirements used to decide whether the contribution solves the requested problem." },
    ],
    example: { title: "Dialogue pass brief", text: "Target: Blocks 8–10, Mara and Tomas. Problem: both voices use the same rhythm. Preserve plot facts and scene outcomes. Deliver revised dialogue only, plus a note on Voiceprint choices. Acceptance: each voice remains identifiable without character cues." },
    checklist: ["The target is anchored.", "The problem is specific.", "Canon locks are listed.", "Creative freedom is named.", "Rights and review expectations are recorded.", "Acceptance criteria are testable."],
    mistakes: ["Using ‘make it better’ as the brief.", "Leaving hidden continuity requirements unstated.", "Requesting a full rewrite when only one problem needs solving.", "Promising a response time the project cannot meet."],
    exercise: "Build a brief for feedback, a rewrite, a continuity check or a specialist asset in the active project.",
    workspaceTarget: "/collaboration-handbook#briefs",
    aliases: ["contribution brief", "Unlimited Contributions", "requested changes", "scope of work"],
  },
  {
    id: "working-base",
    number: 4,
    title: "Start From the Approved Story",
    duration: "15–25 min",
    overview: "Make every proposal from a known canonical base, while keeping drafts, autosaves, prompts and experiments local until intentionally submitted.",
    objectives: ["Follow the canonical pull and comparison sequence.", "Understand stale-base rejection.", "Distinguish human story reconciliation from mechanical file merging."],
    sections: [
      {
        heading: "The PlotPickle sequence",
        paragraphs: ["Connect GitHub only when it helps the chosen model. For a private repository, the owner invites a named contributor, the contributor accepts the invitation and connects their own PlotPickle server. For a public project, a contributor may work from a fork, while an authorized proposal branch keeps the owner’s canon protected. In every case, pull the approved `.ppf`, compare it, deliberately apply it as the local base, read the welcome card, brief and continuity locks, then work locally. Save backups and revision snapshots before submitting a bounded proposal. Repository visibility never substitutes for reuse permission."],
        points: ["Private repository: owner invitation → contributor acceptance → personal PlotPickle connection", "Public project: fork for independent work → proposal branch for review", "Pull approved story", "Compare before applying", "Apply as local base", "Work locally", "Save backup and revision", "Submit proposal—not a direct canon write", "Visibility and reuse permission remain separate"],
      },
      {
        heading: "Stale work needs a story decision",
        paragraphs: ["If another proposal is merged first, the previous base is stale. Pull the new canon and reconsider the proposal against the changed story. Two complete creative versions cannot always be combined safely by line-level merging because the conflict may concern intent, causality or canon rather than text."],
      },
    ],
    definitions: [
      { term: "Canonical base", meaning: "The exact approved project revision from which a local proposal begins." },
      { term: "Stale proposal", meaning: "A proposal based on an older canon revision after another approved change has moved the project forward." },
      { term: "Reconsideration", meaning: "Human review of whether the original intention still works against the new canon." },
    ],
    example: { title: "A stale ending rewrite", text: "A contributor rewrites Block 22 while another proposal changes the protagonist's crisis choice. The ending proposal must be reconsidered against the new choice; copying both versions together would hide the dramatic conflict." },
    checklist: ["The current base revision is known.", "Incoming canon was compared before applying.", "Local drafts remain private.", "The brief and locks were reviewed.", "A snapshot exists before submission."],
    mistakes: ["Editing directly on the canonical branch.", "Assuming the newest file is approved canon.", "Publishing prompts or private assets unintentionally.", "Treating creative conflicts as harmless text conflicts."],
    exercise: "Open Settings → GitHub & Backups and identify the current canonical `.ppf` revision. If none is recorded, define the local or file-based equivalent.",
    workspaceTarget: "/collaboration-handbook#workflow",
    aliases: ["pull approved story", "local draft", "stale base", "canonical version"],
  },
  {
    id: "working-proposal",
    number: 5,
    title: "Submit a Reviewable Proposal",
    duration: "25–35 min",
    overview: "Give the owner enough purpose, scope, evidence, dependency and rights information to understand the change inside PlotPickle before opening GitHub.",
    objectives: ["Build a structured proposal packet.", "Identify affected project dependencies.", "Record provenance and unresolved questions."],
    sections: [
      {
        heading: "Explain the change as a story decision",
        paragraphs: ["A proposal title and a generic note are not enough for a complete `.ppf`. The packet should explain what changed, why, the intended audience effect and the exact project areas affected."],
        points: ["What changed", "Why it changed", "Audience or story effect", "Affected areas", "Before-and-after evidence", "Character and continuity effects", "Runtime or production effects", "Rights and provenance", "New canon assumptions", "Unresolved questions", "Alternatives considered", "Areas to inspect closely"],
      },
      {
        heading: "Make dependencies visible",
        paragraphs: ["A change to one scene may affect a character arc, Story Thread, setup/payoff, production asset or rights record. The packet does not guarantee that every dependency is solved; it makes the review burden visible."],
      },
    ],
    definitions: [
      { term: "Proposal packet", meaning: "A structured explanation of a proposed project change and the evidence and dependencies needed for review." },
      { term: "Affected area", meaning: "A canonical project object, field or production element changed or made dependent by the proposal." },
      { term: "Canon assumption", meaning: "A new fact or interpretation the proposal expects later work to treat as approved." },
    ],
    example: { title: "A complete scene proposal", text: "The contributor replaces a reconciliation with a refusal. The packet identifies Blocks 18 and 23, two relationship checkpoints, a dialogue callback, a music cue and the ending image that now require review." },
    checklist: ["The linked brief is named.", "The base revision is recorded.", "Changed and affected areas are separate.", "Dependencies and unresolved questions are visible.", "Rights and AI provenance are addressed."],
    mistakes: ["Submitting the full project with only ‘updated dialogue’ as the note.", "Listing files instead of story effects.", "Hiding unresolved questions.", "Leaving new third-party material without permission records."],
    exercise: "Create a proposal packet for the active change and copy its summary into the GitHub contributor note.",
    workspaceTarget: "/collaboration-handbook#proposals",
    aliases: ["Process Post-Submission", "proposal summary", "pull request description", "before and after"],
  },
  {
    id: "working-review",
    number: 6,
    title: "Review the Change, Not the Person",
    duration: "25–35 min",
    overview: "Anchor feedback to evidence, name the category and intended outcome, and separate project requirements from personal preference.",
    objectives: ["Categorize review feedback.", "Describe audience experience before prescribing a fix.", "Close the loop with a recorded outcome."],
    sections: [
      {
        heading: "A review note needs a category",
        paragraphs: ["The same sentence feels very different when it is a legal requirement, a continuity conflict, a craft diagnosis or a personal preference. Categorization helps the contributor understand urgency and who has authority to decide."],
        points: reviewCategories.map((category) => category),
      },
      {
        heading: "Anchor observation, evidence and outcome",
        paragraphs: ["Describe what the reader experienced or which fact conflicts, cite the relevant Block, scene, screenplay element or character, explain the intended outcome and invite clarification when the contributor's intention is unclear."],
        points: reviewOutcomes.map((outcome) => outcome),
      },
    ],
    definitions: [
      { term: "Anchored review", meaning: "Feedback attached to a stable canonical project object rather than a vague page reference." },
      { term: "Review category", meaning: "The reason the note matters: required, continuity, rights, craft, question, preference or praise." },
      { term: "Outcome", meaning: "The recorded result of the discussion, such as accepted, changes requested, deferred or declined." },
    ],
    example: { title: "Observation before prescription", text: "Craft note: In Scene 14, the audience learns the betrayal before Mara chooses to trust Tomas, so the choice reads as uninformed rather than costly. Intended outcome: preserve the reveal but give Mara enough evidence to knowingly risk trust." },
    checklist: ["The comment is anchored.", "The category is named.", "Observation comes before solution.", "Evidence and intended outcome are clear.", "Praise and retained choices are acknowledged.", "The final outcome is recorded."],
    mistakes: ["Reviewing the contributor's talent or motives.", "Presenting taste as a requirement.", "Rewriting the line without explaining the problem.", "Leaving a resolved discussion open indefinitely."],
    exercise: "Create one categorized review note for the selected Block or scene. Include observation, evidence and intended outcome.",
    workspaceTarget: "/collaboration-handbook#reviews",
    aliases: ["Feedback and Communication", "constructive feedback", "review category", "anchored comment"],
  },
  {
    id: "working-canon",
    number: 7,
    title: "Make the Canon Decision Explicit",
    duration: "20–30 min",
    overview: "Treat discussion, approval, merging and canonical availability as distinct states, then record the decision and its consequences.",
    objectives: ["Understand the proposal lifecycle.", "Record merge and closure decisions.", "Preserve declined work without confusing it with canon."],
    sections: [
      {
        heading: "The lifecycle",
        paragraphs: ["A locally completed draft is not a submitted proposal. A reviewed proposal is not canon. Approval becomes canon when the authorized owner or maintainer merges or otherwise applies it to the approved project."],
        points: ["Draft locally", "Proposal submitted", "In review", "Changes requested or approved", "Owner or maintainer merges", "Canonical pull becomes available", "Other servers compare and apply"],
      },
      {
        heading: "Record the close",
        paragraphs: ["Review the structured packet, affected project areas and before-and-after evidence inside PlotPickle first. Use GitHub for repository history, discussion and the final technical merge when the project uses it. A merge, decline, defer, withdrawal or supersession should name the decision-maker, date, rationale, accepted and rejected portions, resolved or deferred review threads, revision snapshot, rights updates and follow-up work."],
      },
    ],
    definitions: [
      { term: "Approval", meaning: "A decision that the proposal is acceptable under the project's authority model." },
      { term: "Merge", meaning: "The technical action that incorporates an approved proposal into the canonical GitHub branch." },
      { term: "Decision log", meaning: "A canonical record of the outcome, decision-maker, rationale, revision and follow-up." },
    ],
    example: { title: "Declined without erasure", text: "A proposal is closed because it changes the story's intended moral position. The decision log records the rationale and preserves the packet and review history; the contribution is not canon, but it is not treated as valueless or deleted from history." },
    checklist: ["The authorized decision-maker is named.", "The outcome is explicit.", "Rationale and partial acceptance are recorded.", "A revision snapshot exists.", "Rights and credit records are updated when needed.", "Follow-up work is identified."],
    mistakes: ["Calling a positive review comment a merge.", "Closing a proposal without a reason.", "Deleting declined work to simplify history.", "Forgetting to tell other servers that new canon is available."],
    exercise: "Record a hypothetical merge, decline or defer decision for the latest proposal packet.",
    workspaceTarget: "/collaboration-handbook#decisions",
    aliases: ["owner review", "approved canon", "declined proposal", "decision log"],
  },
  {
    id: "working-disagreement",
    number: 8,
    title: "Resolve Creative Disagreements",
    duration: "20–30 min",
    overview: "Use project goals, evidence and authority to resolve disagreement respectfully without pretending consensus is always possible.",
    objectives: ["Separate canon conflict from craft preference.", "Test alternatives safely.", "Record the final rationale."],
    sections: [
      {
        heading: "A practical sequence",
        paragraphs: ["Restate the project goal and brief, identify the exact disagreement, separate continuity or rights conflict from taste, compare audience effect and causality, test alternatives in temporary revisions, then identify who has final authority."],
        points: ["Restate goal", "Name disagreement", "Classify conflict", "Compare evidence", "Test alternatives", "Apply authority model", "Record decision", "Preserve history"],
      },
      {
        heading: "Authority does not remove respect",
        paragraphs: ["The owner retains the final canon decision unless a written agreement establishes shared authority. A clear decision can still acknowledge the contribution's strengths, explain why it was not selected and identify whether a future version could solve the underlying concern."],
      },
    ],
    definitions: [
      { term: "Creative disagreement", meaning: "A conflict about story intent, execution or project priorities rather than a technical inability to combine text." },
      { term: "Temporary revision", meaning: "A non-canonical version used to test an alternative without replacing the approved story." },
      { term: "Final authority", meaning: "The person or group empowered by the collaboration agreement to decide the disputed issue." },
    ],
    example: { title: "Theme versus surprise", text: "A contributor wants the antagonist redeemed for surprise; the owner believes it breaks the theme and prior choices. Both versions are tested against the crisis, relationship arc and ending. The owner selects the refusal version and records why." },
    checklist: ["The disagreement is stated neutrally.", "Canon, rights, feasibility and preference are separated.", "Alternatives are evaluated against project goals.", "Final authority is known.", "The rationale and history are preserved."],
    mistakes: ["Arguing about taste without naming the project goal.", "Using repository power as the only explanation.", "Forcing consensus after authority is clear.", "Treating a declined idea as a personal rejection."],
    exercise: "Take one open review question and write the decision criteria before discussing solutions.",
    workspaceTarget: "/collaboration-handbook#decisions",
    aliases: ["creative disagreement", "consensus", "owner decision", "alternative revision"],
  },
  {
    id: "working-credit",
    number: 9,
    title: "Record Credit, Ownership and Permissions",
    duration: "25–35 min",
    overview: "Connect accepted work to contributor, credit, agreement, ownership and permission records without treating a pull request as a legal agreement.",
    objectives: ["Distinguish contribution, credit and ownership.", "Link accepted work to rights records.", "Identify questions requiring professional advice."],
    sections: [
      {
        heading: "Record what is actually agreed",
        paragraphs: ["For each contributor, record legal or professional name, credited-as name, role, contribution, ownership share if any, compensation or commissioned status where documented, agreement reference, licence or permission reference and the accepted project areas."],
      },
      {
        heading: "Important distinctions",
        paragraphs: ["Feedback does not automatically create ownership. A contribution does not automatically transfer copyright. A GitHub pull request is not a collaboration, employment, assignment or licence agreement. PlotPickle's software and documentation licences do not automatically apply to a screenplay."],
        points: ["Public access is not an open licence.", "The owner must have authority to accept contributed material.", "Third-party material needs source and permission records.", "Material ownership questions may require appropriate professional advice."],
      },
    ],
    definitions: [
      { term: "Credited-as name", meaning: "The name the contributor wants used in public or project credits." },
      { term: "Ownership share", meaning: "A documented interest in the work; it should not be inferred from participation." },
      { term: "Agreement reference", meaning: "A pointer to the collaboration, commission, assignment, licence or service agreement controlling the contribution." },
    ],
    example: { title: "Accepted research contribution", text: "A historical consultant's sourced corrections are accepted. The rights record names the consultant, contribution and credit; the source records remain attached. No screenplay ownership is recorded because the agreement did not grant it." },
    checklist: ["Contributor and credited-as names are recorded.", "Accepted contribution is described.", "Ownership is explicit or clearly absent.", "Agreement and permission references are linked.", "Rights records are updated after acceptance."],
    mistakes: ["Using ‘contributor’ as an ownership percentage.", "Assuming GitHub history replaces a contract.", "Applying CC BY-SA because the software uses it.", "Accepting material the project lacks authority to use."],
    exercise: "Review one collaborator record and make contribution, credit, ownership and agreement references unambiguous.",
    workspaceTarget: "/collaboration-handbook#roles",
    aliases: ["credit", "ownership", "permissions", "collaboration agreement", "pull request copyright"],
  },
  {
    id: "working-privacy",
    number: 10,
    title: "Protect Privacy and Unfinished Work",
    duration: "15–25 min",
    overview: "Share intentionally: GitHub connection does not upload local autosaves, prompts or private assets, but submitted proposal material and public repositories have real exposure.",
    objectives: ["Understand what remains local.", "Separate repository privacy from project licensing.", "Check provenance before sharing assets."],
    sections: [
      {
        heading: "Local-first boundaries",
        paragraphs: ["Local drafts, autosaves, AI prompts and private assets do not leave the computer merely because GitHub is connected. Only intentionally submitted proposal material is shared through the collaboration engine, and secrets remain outside the `.ppf`."],
      },
      {
        heading: "Define the project's sharing rule",
        paragraphs: ["The owner should state whether contributors may discuss the project publicly, upload material to third-party services, invite additional readers or reuse generated and sourced assets. Private and public repositories create different exposure, but neither determines copyright or reuse permission by itself."],
      },
    ],
    definitions: [
      { term: "Local-first", meaning: "The project is edited and stored on the user's computer unless a deliberate export or proposal shares it." },
      { term: "Confidential material", meaning: "Project, personal or third-party information the contributor is not authorized to disclose." },
      { term: "Provenance", meaning: "The record of where an asset or contribution came from and what permission supports its use." },
    ],
    example: { title: "Connected but private", text: "A writer connects a private repository, generates temporary AI images locally and submits only the approved `.ppf` proposal. The unused prompts and images remain on that computer." },
    checklist: ["Repository privacy is known.", "Public discussion rules are stated.", "Secrets remain outside the project.", "Third-party and generated assets have provenance.", "Only intended proposal material is submitted."],
    mistakes: ["Uploading confidential reference files with a proposal.", "Assuming a private repository creates a licence.", "Putting access tokens inside the project.", "Letting contributors use third-party services without a sharing rule."],
    exercise: "Write a two-sentence confidentiality and external-service rule for the current project.",
    workspaceTarget: "/collaboration-handbook#agreement",
    aliases: ["privacy", "unfinished work", "AI prompts", "private repository", "confidentiality"],
  },
  {
    id: "working-scale",
    number: 11,
    title: "Scale Beyond One Owner and a Few Contributors",
    duration: "20–30 min",
    overview: "Scale by narrowing briefs, assigning review owners and keeping the canon decision path explicit—not by inviting unrestricted edits.",
    objectives: ["Organize contribution queues by project area.", "Limit conflicting simultaneous work.", "Set realistic community response expectations."],
    sections: [
      {
        heading: "Scale the operating system",
        paragraphs: ["Assign briefs rather than unrestricted edit access. Define review owners by story, screenplay, character, continuity, rights, visual, audio or production area. Limit simultaneous proposals affecting the same high-risk dependency and group related changes into review rounds."],
        points: ["Named briefs", "Area review owners", "Proposal dependencies", "Conflict limits", "Review rounds or milestones", "Superseded proposal archive", "Contributor guidelines", "Response expectations"],
      },
      {
        heading: "Community feedback is not authorized contribution",
        paragraphs: ["A public audience may provide useful reactions without gaining permission to edit, reuse or represent the project. Authorized contributions should follow the same brief, provenance, review and decision process as private work."],
      },
    ],
    definitions: [
      { term: "Review owner", meaning: "The person delegated to coordinate or decide feedback in a defined project area." },
      { term: "Proposal dependency", meaning: "Another proposed or canonical change that affects whether a contribution can be evaluated or accepted." },
      { term: "Review round", meaning: "A bounded period or milestone in which related proposals are considered together." },
    ],
    example: { title: "A controlled community round", text: "The owner opens public feedback on Act 1, but accepts proposals only for three posted briefs. A story editor triages craft notes, a continuity lead handles canon conflicts and the owner alone merges canon." },
    checklist: ["Every active proposal has a brief.", "Review ownership is assigned.", "High-risk areas have conflict limits.", "Dependencies and superseded work are visible.", "Response expectations are realistic.", "The final canon path remains short."],
    mistakes: ["Promising detailed feedback to every participant.", "Inviting unlimited edits to the same scene.", "Treating popularity as canon authority.", "Allowing community discussion to bypass rights and provenance checks."],
    exercise: "Design one review round with area owners, open briefs, closed areas, response expectations and the final decision path.",
    workspaceTarget: "/collaboration-handbook#dashboard",
    aliases: ["Unlimited Contributions", "Evolving Together", "million minds", "community collaboration", "review queue"],
  },
];

const workingTogetherSourceNote = "PlotPickled from the legacy Collaborators guide: Your Role and Key Questions, Process Post-Submission, Feedback and Communication, Unlimited Contributions, Evolving Together, Act review questions and the Afterglow collaborator guide.";

export const workingTogetherLessons: WorkingTogetherLesson[] = workingTogetherLessonSources.map((lesson) => ({
  ...lesson,
  collection: "Working Together in PlotPickle",
  path: "Industry",
  sourceNote: workingTogetherSourceNote,
  workspaceLabel: "Contributor Handbook",
  apply: "Treatment",
}));

export function workingTogetherSearchText(lesson: WorkingTogetherLesson) {
  return [
    lesson.title,
    lesson.overview,
    ...lesson.objectives,
    ...lesson.sections.flatMap((section) => [section.heading, ...section.paragraphs, ...(section.points ?? [])]),
    ...lesson.definitions.flatMap((definition) => [definition.term, definition.meaning]),
    lesson.example.title,
    lesson.example.text,
    ...lesson.checklist,
    ...lesson.mistakes,
    lesson.exercise,
    ...lesson.aliases,
    ...collaborationSourceAliases(),
  ].join(" ").toLowerCase();
}
