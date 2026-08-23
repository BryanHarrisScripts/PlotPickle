import Link from "next/link";
import styles from "./workspace-capability-shelf.module.css";

export type CapabilityOwner = "learn" | "plan" | "storyboard" | "write" | "pitch" | "build" | "feedback" | "reports";

type Capability = {
  title: string;
  ownership: string;
  description: string;
  href?: string;
  action?: string;
};

const CAPABILITIES: Record<CapabilityOwner, { label: string; rule: string; items: Capability[] }> = {
  learn: {
    label: "Learn owns instruction and deliberate practice",
    rule: "Lessons explain the method. Practice never changes the story unless the writer deliberately works in an owning workspace.",
    items: [
      { title: "PlotPickle lessons", ownership: "Learn", description: "The complete learning library, terminology and screenplay study remain in this workspace.", action: "Use the learning library below" },
      { title: "CraftLoop", ownership: "Learn", description: "Run the repeatable capstone practice loop without treating it as a Refine editor.", href: "/craftloop?return=learn" },
    ],
  },
  plan: {
    label: "Plan owns story intent, canon and character definitions",
    rule: "These tools define the source material that diagnostic engines read. Their stable project fields are not copied into Refine.",
    items: [
      { title: "Research & Canon", ownership: "Plan", description: "Bind sourced facts and deliberate canon decisions to the active project.", href: "/labs?scope=plan&return=plan" },
      { title: "Story Experience, Theme & Motifs", ownership: "Plan", description: "Define the audience contract, thematic arguments and motif ledger.", href: "/story-craft-essentials?scope=plan&return=plan" },
      { title: "Theme Dialectic", ownership: "Plan", description: "Test the story question against a credible competing answer before Pitch packages it.", href: "/pitch-review?scope=plan&return=plan" },
      { title: "Character voice definitions", ownership: "Plan", description: "Define origin, worldview, rhythm, vocabulary and relationship-dependent speech.", href: "/voiceprint?return=plan" },
    ],
  },
  storyboard: {
    label: "Storyboard owns visual direction, shots and animatic",
    rule: "Visual and shot choices remain attached to stable scenes, mini-blocks and frames in the canonical project.",
    items: [
      { title: "Shot Designer & Animatic", ownership: "Storyboard", description: "Design coverage and play the connected storyboard timeline.", href: "/production?scope=storyboard&return=storyboard" },
      { title: "Visual Bible & Mood Boards", ownership: "Storyboard", description: "Develop a deliberate visual system and review visual proposals.", href: "/labs?scope=storyboard&return=storyboard" },
    ],
  },
  write: {
    label: "Write owns screenplay text",
    rule: "Refine may diagnose and propose. Only Write owns direct screenplay revision and the final wording.",
    items: [
      { title: "Screenplay editor", ownership: "Write", description: "Draft and revise canonical screenplay elements here.", action: "Use the screenplay workspace below" },
      { title: "Approved dialogue handoff", ownership: "Write", description: "A reviewed Dialogue Lab suggestion returns here before it becomes final screenplay text.", action: "Review the proposed line, then write or accept it here" },
    ],
  },
  pitch: {
    label: "Pitch owns the story package",
    rule: "Pitch develops and exports the package. Feedback comments and approval history remain separate.",
    items: [
      { title: "Logline, package & exports", ownership: "Pitch", description: "Develop loglines, editorial pitch content and presentation-ready exports.", href: "/pitch-review?scope=pitch&return=pitch" },
      { title: "AI comic pitch deck", ownership: "Pitch", description: "Generate and review the 24-page, 96-panel comic deck in this workspace.", action: "Use the comic-deck workspace below" },
    ],
  },
  build: {
    label: "Build owns production planning",
    rule: "Build turns canonical story and screenplay evidence into an editable production plan. Reports only summarizes it.",
    items: [
      { title: "Production Planning", ownership: "Build", description: "Own the Sonic Bible, scene breakdowns, scheduling and distribution planning.", href: "/production?scope=build&return=build" },
    ],
  },
  feedback: {
    label: "Feedback owns discussion and approval",
    rule: "Comments, revision comparisons and pass decisions are explicit. Suggestions never overwrite canonical content silently.",
    items: [
      { title: "Anchored reviews & revision compare", ownership: "Feedback", description: "Discuss stable story targets, compare canonical revisions and record decisions in the unified review workspace.", action: "Use the unified review workspace below" },
      { title: "Saved-pass approval", ownership: "Feedback", description: "Review specialist before-and-after evidence and the retained decision trail.", href: "/labs?scope=feedback&return=feedback" },
    ],
  },
  reports: {
    label: "Reports owns read-only summaries",
    rule: "Production and provenance information can be inspected and exported here, but its canonical source is edited only by its owning workspace.",
    items: [
      { title: "Production summary", ownership: "Reports · read only", description: "Summarize shots, cues, breakdowns, schedule and distribution readiness.", action: "Use the production report below" },
      { title: "Provenance summary", ownership: "Reports · read only", description: "Summarize sources, generated assets, providers and retained human decisions.", action: "Use the provenance report below" },
    ],
  },
};

export default function WorkspaceCapabilityShelf({ workspace }: { workspace: CapabilityOwner }) {
  const group = CAPABILITIES[workspace];
  return (
    <section className={styles.shelf} aria-label={`${group.label} capabilities`}>
      <header><div><span>Workspace ownership</span><h2>{group.label}</h2></div><p>{group.rule}</p></header>
      <div className={styles.grid}>
        {group.items.map((item) => (
          <article key={item.title}>
            <span>{item.ownership}</span>
            <h3>{item.title}</h3>
            <p>{item.description}</p>
            {item.href ? <Link href={item.href}>Open in {item.ownership} <b aria-hidden="true">→</b></Link> : <small>{item.action}</small>}
          </article>
        ))}
      </div>
    </section>
  );
}
