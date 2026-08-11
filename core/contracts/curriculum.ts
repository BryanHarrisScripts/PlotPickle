export interface CurriculumLesson {
  readonly id: string;
  readonly number: number;
  readonly path: string;
  readonly title: string;
  readonly duration: string;
  readonly overview: string;
  readonly objectives: readonly string[];
  readonly sections: readonly {
    readonly heading: string;
    readonly paragraphs: readonly string[];
    readonly points?: readonly string[];
  }[];
  readonly definitions: readonly {
    readonly term: string;
    readonly meaning: string;
  }[];
  readonly example: {
    readonly title: string;
    readonly text: string;
  };
  readonly checklist: readonly string[];
  readonly mistakes: readonly string[];
  readonly exercise: string;
  readonly apply: string;
  readonly tags: readonly string[];
}
