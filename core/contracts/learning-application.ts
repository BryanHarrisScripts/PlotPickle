export type LearningApplicationCourse = Readonly<{
  id: string;
  title: string;
  applicationTargets: readonly string[];
}>;

export type LearningApplicationFact = Readonly<{
  id: string;
  label: string;
  value: string;
  source: string;
}>;

export type LearningApplicationView = Readonly<{
  schemaVersion: "phase-7-ea-reflection-v1";
  project: Readonly<{
    id: string;
    title: string;
    revision: number;
  }>;
  lesson: Readonly<{
    id: string;
    title: string;
    topic: string;
    applyInstruction: string;
  }>;
  craftModule: Readonly<{
    id: string;
    title: string;
    applicationTargets: readonly string[];
  }>;
  facts: readonly LearningApplicationFact[];
  authority: Readonly<{
    deterministicFactsOnly: true;
    eaMayReflect: true;
    eaMayGrade: false;
    eaMayMutateCanon: false;
    humanDecides: true;
  }>;
}>;
