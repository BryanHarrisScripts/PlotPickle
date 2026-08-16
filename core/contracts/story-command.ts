import type { FoundationDraftProposal } from "./foundation-plan";

export type StoryCommand =
  | {
      readonly type: "lesson.open";
      readonly lessonId: string;
      readonly occurredAt: string;
    }
  | {
      readonly type: "lesson.complete";
      readonly lessonId: string;
      readonly occurredAt: string;
    }
  | {
      readonly type: "lesson.uncomplete";
      readonly lessonId: string;
      readonly occurredAt: string;
    }
  | {
      readonly type: "creative-room.thread.attach";
      readonly threadId: string;
      readonly occurredAt: string;
    }
  | {
      readonly type: "foundations.lesson.open";
      readonly lessonId: string;
      readonly occurredAt: string;
    }
  | {
      readonly type: "foundations.answer.update";
      readonly lessonId: string;
      readonly fieldId: string;
      readonly value: string;
      readonly occurredAt: string;
    }
  | {
      readonly type: "foundations.proposal.store";
      readonly lessonId: string;
      readonly proposal: FoundationDraftProposal;
      readonly occurredAt: string;
    }
  | {
      readonly type: "foundations.proposal.accept";
      readonly lessonId: string;
      readonly occurredAt: string;
    }
  | {
      readonly type: "foundations.proposal.dismiss";
      readonly lessonId: string;
      readonly occurredAt: string;
    }
  | {
      readonly type: "foundations.brief.save";
      readonly content: string;
      readonly occurredAt: string;
    }
  | {
      readonly type: "foundations.visual.accept";
      readonly artifactId: string;
      readonly occurredAt: string;
    }
  | {
      readonly type: "foundations.visual.unaccept";
      readonly artifactId: string;
      readonly occurredAt: string;
    };

export interface CommandEnvelope {
  readonly id: string;
  readonly projectId: string;
  readonly expectedRevision: number;
  readonly command: StoryCommand;
}
