export interface CurriculumLesson {
  readonly id: string;
  readonly number: number;
  readonly topic: string;
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
  readonly original: {
    readonly number: number;
    readonly path: string;
  };
  readonly sources: readonly CurriculumSource[];
}

export interface CurriculumSource {
  readonly id: string;
  readonly repository: "24-Blocks" | "Afterglow" | "BryanHarrisScripts.github.io";
  readonly path: string;
  readonly title: string;
  readonly kind: string;
  readonly scopeNote: string;
  readonly url: string;
  readonly content: string;
}
