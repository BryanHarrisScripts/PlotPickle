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
  readonly exercise: string;
}
