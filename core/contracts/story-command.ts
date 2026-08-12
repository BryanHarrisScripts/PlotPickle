import type { FoundationBuilderField } from "./foundation-builder";

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
      readonly type: "foundations.field.update";
      readonly field: FoundationBuilderField;
      readonly value: string;
      readonly occurredAt: string;
    };

export interface CommandEnvelope {
  readonly id: string;
  readonly projectId: string;
  readonly expectedRevision: number;
  readonly command: StoryCommand;
}
