import type { LearningModule } from "./learning-library";

export type CollaborationModelId =
  | "solo-feedback"
  | "private-review"
  | "invited-contributor"
  | "co-writing"
  | "commissioned"
  | "production-team"
  | "public-feedback"
  | "open-community";

export type WorkingTogetherLesson = LearningModule & {
  collection: "Working Together in PlotPickle";
  sourceAliases: string[];
  sourceNote: string;
  workspaceLabel: string;
  workspaceHref: string;
  focus: "model" | "authority" | "brief" | "proposal" | "review" | "decision" | "rights" | "privacy" | "scale";
};

export const collaborationModels = [
  { id: "solo-feedback", label: "Solo project with occasional feedback", owner: "One project owner", view: "Selected readers or file recipients", comment: "Feedback only", propose: "Only when invited", approve: "Project owner", expectation: "Credit or ownership only when separately agreed", privacy: "Local or private by default", licence: "No open licence implied" },
  { id: "private-review", label: "Private reviewer access", owner: "One project owner", view: "Named reviewers", comment: "Anchored review threads", propose: "Normally no direct rewrite proposal", approve: "Project owner", expectation: "Review credit or fee only when agreed", privacy: "Confidential/private", licence: "No reuse right implied" },
  { id: "invited-contributor", label: "Invited contributor", owner: "One project owner", view: "Named contributor", comment: "Within the brief", propose: "Bounded proposal", approve: "Owner or delegated maintainer", expectation: "Credit, fee or ownership must be documed", privacy: "Defined by the brief", licence: "Only the recorded permission applies" },
  { id: "co-writing", label: "Co-writing partnership", owner: "Shared or contract-defined", view: "Co-writers and approved reviewers", comment: "Shared creative discussion", propose: "Within agreed authority", approve: "Agreement-defined", expectation: "Authorship, ownership and credit require a written understanding", privacy: "Usually private during development", licence: "Joint licensing requires authority from all relevant owners" },
  { id: "commissioned", label: "Commissioned rewrite or specialist service", owner: "Commissioning party or agreement-defined", view: "Commissioned contributor", comment: "Scope and acceptance criteria", propose: "Deliverable proposal", approve: "Commissioning decision-maker", expectation: "Compensation, credit and rights follow the agreement", privacy: "Usually confidential", licence: "Contract or permission controls reuse" },
  { id: "production-team", label: "Production-team collaboration", owner: "Producer, company or agreement-defined", view: "Authorized departments", comment: "Area-specific review", propose: "Specialist assets and changes", approve: "Department lead plus canonical authority", expectation: "Employment, service or licence terms apply", privacy: "Production policy", licence: "Asset-specific permissions required" },
  { id: "public-feedback", label: "Public feedback project", owner: "Named project owner", view: "Public", comment: "Community feedback", propose: "Only when contribution rules permit", approve: "Owner or maintainers", expectation: "Public visibility does not create ownership or reuse rights", privacy: "Public material only", licence: "Separate explicit licence decision" },
  { id: "open-community", label: "Openly licensed community project", owner: "Named owner or governance group", view: "Public", comment: "Public review", propose: "Under contributor rules", approve: "Governance-defined maintainers", expectation: "Attribution and contributor terms must be explicit", privacy: "Public", licence: "Recorded open licence governs covered material only" },
] as const;

export const collaborationRoles = [
  { role: "Project Owner", authority: "Controls canon, repository connection, rights settings and final acceptance unless a written agreement shares authority." },
  { role: "Co-owner / Maintainer", authority: "May share final approval, licence or invitation authority only when explicitly authorized." },
  { role: "Writer / Co-writer", authority: "Creates story or screenplay material within the agreed scope; ownership and approval authority are separate questions." },
  { role: "Contributor", authority: "Proposes bounded additions or changes without automatically controlling canon." },
  { role: "Reviewer", authority: "Comments and identifies questions without changing the approved project." },
  { role: "Story Editor", authority: "Diagnoses and recommends revisions; does not automatically own, approve or merge them." },
  { role: "Research / Continuity Contributor", authority: "Supplies sourced facts, canon checks or continuity findings with provenance." },
  { role: "Visual, Music or Production Contributor", authority: "Supplies specialist assets with permission, credit and provenance information." },
] as const;

export const authorityActions = ["View", "Comment", "Create review threads", "Propose changes", "Edit collaborator records", "Approve specialist assets", "Merge into canon", "Change licences", "Invite or remove collaborators"] as const;

export const feedbackCategories = ["required", "continuity", "rights", "craft", "question", "preference", "praise"] as const;
export const decisionOutcomes = ["accepted", "changes-requested", "question", "deferred", "declined", "superseded", "withdrawn", "resolved-without-change"] as const;

export const contributionBriefTemplates = [
  "Feedback only",
  "Rewrite proposal",
  "Alternative scene or Block",
  "Dialogue pass",
  "Character or world contribution",
  "Research or continuity check",
  "Storyboard, music or production asset",
  "Pitch or marketing material",
] as const;

export const legacyCollaboratorSourceMap = [
  { source: "Your Role and Key Questions", lessonId: "working-together-model" },
  { source: "Process Post-Submission", lessonId: "working-together-canon" },
  { source: "Feedback and Communication", lessonId: "working-together-review" },
  { source: "Unlimited Contributions", lessonId: "working-together-scale" },
  { source: "Evolving Together", lessonId: "working-together-disagreements" },
  { source: "Act review questions", lessonId: "working-together-review" },
  { source: "Afterglow collaborator guide", lessonId: "working-together-model" },
] as const;

const sourceNote = "PlotPickled from the legacy Afterglow collaborator welcome and feedback guide. The original phrases remain searchable, but the method now supports private, commissioned, co-written, production, public-feedback and openly licensed projects.";

function lesson(input: Omit<WorkingTogetherLesson, "collection" | "sourceNote" | "workspaceLabel" | "workspaceHref">): WorkingTogetherLesson {
  return { ...input, collection: "Working Together in PlotPickle", sourceNote, workspaceLabel: "Working Together workspace", workspaceHref: "/working-together" };
}

export const workingTogetherLessons: WorkingTogetherLesson[] = [
  lesson({ id: "working-together-model", number: 52, path: "Industry", title: "Choose the Collaboration Model", duration: "20–30 min", overview: "Define who may see, comment, propose and decide before inviting anyone into the project.", objectives: ["Compare eight valid collaboration models.", "Separate access, contribution, ownership and licensing.", "Record realistic response and confidentiality expectations."], sections: [{ heading: "Start with the operating agreement", paragraphs: ["A collaboration model is the project's operating agreement. It defines who owns the current project, who may view, comment or submit work, who may make canon decisions and what credit, compensation, ownership, confidentiality or licence expectations apply.", "The same technical tools can serve very different relationships. A private GitHub repository does not create a co-writing partnership, and a public repository does not create an open licence."], points: collaborationModels.map((model) => `${model.label}: ${model.owner}; ${model.privacy}; ${model.licence}.`) }, { heading: "Keep optional tools optional", paragraphs: ["Ordinary collaboration can stay local-only or use file exchange. GitHub, public publishing, AI services and an open licence remain deliberate choices, not requirements.", "Access, repository permissions, collaboration status and creative licensing are separate decisions."] }], definitions: [{ term: "Collaboration model", meaning: "The agreed structure for access, contribution, decision authority, privacy, credit, ownership and reuse." }, { term: "Canon authority", meaning: "The person or group authorized to decide what becomes the approved project." }], example: { title: "Two projects, two models", text: "A novelist emails a private .ppf to a trusted reader for feedback only. A separate community project publishes its canonical project under a contributor licence. Both use PlotPickle; only the second is an open contribution project." }, checklist: ["Owner named.", "Canon authority defined.", "View, comment and proposal rights separated.", "Credit, compensation and ownership expectations recorded.", "Confidentiality and sharing status stated.", "Licence decision explicit."], mistakes: ["Inviting someone without defining their role.", "Assuming feedback creates copyright ownership.", "Confusing public visibility with reuse permission."], exercise: "Create the active project's collaboration model and confirm who has final canon authority.", apply: "Treatment", tags: ["Your Role and Key Questions", "Afterglow collaborator guide", "collaboration model", "private review", "co-writing", "commissioned", "production team", "public feedback", "open licence"], sourceAliases: ["Your Role and Key Questions", "Afterglow collaborator guide"], focus: "model" }),
  lesson({ id: "working-together-authority", number: 53, path: "Industry", title: "Define Roles and Decision Authority", duration: "20–30 min", overview: "Translate creative roles into a clear authority matrix without confusing them with GitHub permissions.", objectives: ["Define the owner, maintainer, writer, contributor, reviewer and specialist roles.", "Assign creative decision authority.", "Treat repository permissions as technical enforcement, not the whole operating agreement."], sections: [{ heading: "Roles are about responsibility", paragraphs: ["A role describes what someone is being asked to do and what they can decide. A GitHub permission decribes what an account can technically do. Both matter, but they are not identical."], points: collaborationRoles.map((item) => `${item.role}: ${item.authority}`) }, { heading: "Authority must be explicit", paragraphs: ["The authority matrix should separate view, comment, review-thread creation, proposal submission, rights editing, asset approval, canon merging, licence changes and collaborator invitation.", "The owner retains the final canon decision unless a written collaboration agreement establishes shared or delegated authority."], points: authorityActions.map((action) => `Authority choice: ${action}`) }], definitions: [{ term: "Creative authority", meaning: "The agreed right to make a project decision." }, { term: "Technical permission", meaning: "The capability to perform an action in a tool or repository." }], example: { title: "A story editor with write access", text: "The editor can submit a proposal through GitHub, but the brief says the project owner accepts or declines canon changes. Technical access does not silently override the creative agreement." }, checklist: ["Role named.", "Scope defined.", "Authority matrix recorded.", "GitHub permissions verified separately."], mistakes: ["Assuming write access means merge authority.", "Giving a reviewer an unbounded rewrite role.", "Changing licences without all required authority."], exercise: "For one collaborator, check the authority to view, comment, propose, edit rights, approve assets and merge canon.", apply: "Treatment", tags: ["roles", "authority matrix", "Project Owner", "Co-owner / Maintainer", "Story Editor", "GitHub permissions"], sourceAliases: ["Your Role and Key Questions"], focus: "authority" }),
  lesson({ id: "working-together-brief", number: 54, path: "Industry", title: "Create a Contribution Brief", duration: "25–35 min", overview: "Turn an open-ended invitation into a bounded, reviewable assignment with clear continuity, rights and acceptance expectations.", objectives: ["Problem, purpose, scope and locks.", "Select a template for the requested contribution.", "Link the brief to canonical project elements."], sections: [{ heading: "Brief the problem, not the person", paragraphs: ["A useful brief names the problem to solve, the story purpose and audience effect, the target element, canon facts, locks, freedom, output type, review window, sharing status, credit and acceptance criteria.", "A brief can target an Act, sequence, Block, scene, character, Story Thread, screenplay passage, visual frame, music cue or pitch asset."], points: contributionBriefTemplates.map((template) => `Template: ${template}`) }, { heading: "Continuity and rights belong in the brief", paragraphs: ["List what must not change, new facts that require approval, confidentiality, expected credit, compensation, ownership or licence reference and related review threads or previous proposals."] }], definitions: [{ term: "Contribution brief", meaning: "A structured request defining scope, purpose, locks, freedom, deliverable, rights and acceptance." }, { term: "Continuity lock", meaning: "An approved fact, setup, payoff, relationship, right or production constraint that the contribution must preserve." }], example: { title: "Alternative crisis scene", text: "The brief targets Block 19, names the audience effect, locks the protagonist's earlier betrayal and the Act 4-enabling information, allows freedom in tactic and dialogue, and requires a changed crisis choice with a new consequence." }, checklist: ["Decision-maker named.", "Target anchored.", "Problem and audience effect stated.", "Canon facts and locks listed.", "Acceptance criteria testable.", "Credit, compensation and rights referenced."], mistakes: ["Ask