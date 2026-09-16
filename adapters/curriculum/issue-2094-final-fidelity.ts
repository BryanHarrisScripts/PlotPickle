import type { CurriculumLesson } from "../../core/contracts/curriculum";

export function integrateIssue2094FinalFidelity(lesson: CurriculumLesson): CurriculumLesson {
  if (lesson.id === "collaboration-formats-that-travel") {
    return {
      ...lesson,
      sections: [
        ...lesson.sections,
        {
          heading: "Keep the useful Markdown syntax visible",
          paragraphs: [
            "The original Mastering Markdown source taught the actual syntax, not only when Markdown is useful. Keep the syntax in the learner lesson so writers can use Markdown for treatments, notes, documentation, credits and pitch material without reopening the raw source. Markdown remains a documentation and presentation format here, not a replacement for Fountain or FDX screenplay structure.",
            "Standard Markdown is portable; some conveniences below are GitHub Flavored Markdown (GFM) extensions. A receiving tool may support a different subset, so preview the exported document when formatting matters.",
          ],
          points: [
            "Headings — use one to six # marks before heading text, such as # Title or ## Section.",
            "Emphasis — use *text* or _text_ for italics and **text** or __text__ for bold where the renderer supports standard Markdown.",
            "Lists — use - or * for unordered bullets and 1. / 2. / 3. for ordered steps.",
            "Links — use [label](URL) so the readable label and destination stay distinct.",
            "Images — use ![alt text](URL); meaningful alt text preserves context when the image cannot be seen.",
            "Blockquotes — begin quoted or callout text with > when the renderer supports Markdown blockquotes.",
            "Task lists (GFM) — use - [ ] for open work and - [x] for completed work; useful for review or production checklists, not canon authority by themselves.",
            "Tables (common/GFM extension) — separate columns with | and use a hyphen separator row; useful for comparisons, ownership matrices and compact reference material.",
            "Fenced code blocks (GFM/common extension) — triple backticks preserve literal text or technical material; they are rarely needed for screenplay prose but can protect examples or configuration snippets.",
            "Strikethrough (GFM) — wrap text in ~~ when showing deliberately superseded wording in discussion; do not rely on it instead of revision history.",
            "Mentions such as @username are platform-specific collaboration conveniences rather than portable Markdown meaning.",
          ],
        },
      ],
    };
  }

  if (lesson.id === "professional-pitching-and-representation") {
    return {
      ...lesson,
      sections: [
        ...lesson.sections,
        {
          heading: "Keep the legacy copywriting frameworks as optional pitch-copy tools",
          paragraphs: [
            "The original archive also contains seven named copywriting frameworks. They can help shape a marketing email, project page, presentation or call to action after the underlying project facts are known. They are not screenplay structures, guarantees of persuasion or permission to exaggerate audience, market or commercial claims.",
            "Choose a framework only when it matches the communication job and medium, and keep every factual claim truthful and current.",
          ],
          points: [
            "PAS — Problem, Agitation, Solution: identify a problem, show why it matters, then present the proposed solution.",
            "BAB — Before, After, Bridge: contrast the current condition with a desired condition, then explain the credible bridge between them.",
            "AIDA — Attention, Interest, Desire, Action: earn attention, develop relevant interest, make the value concrete, then state the next action.",
            "FAB — Features, Advantages, Benefits: name what something contains or does, why that creates an advantage, and what practical benefit follows for the intended audience.",
            "SOFTEN — Show, Opportunity, Future, Takeaway, Easy, Now: establish the situation, opportunity and possible future, clarify the takeaway and an accessible next step, then make the requested action clear.",
            "QUEST — Qualify, Understand, Educate, Stimulate, Tie it up: identify the appropriate audience, understand the need, explain the relevant information, build justified interest and close with the next decision or action.",
            "AIDA–BAB hybrid — use attention/interest/desire to frame the communication, then make the before/after transformation and bridge explicit before the call to action.",
          ],
        },
      ],
    };
  }

  return lesson;
}
