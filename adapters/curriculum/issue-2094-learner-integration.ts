import type { CurriculumLesson } from "../../core/contracts/curriculum";

type TopicDocument = {
  readonly schemaVersion: string;
  readonly topic: { readonly id: string; readonly title: string };
  readonly lessonCount: number;
  readonly sourceCount: number;
  readonly lessons: readonly CurriculumLesson[];
};

const FILM_INDUSTRY_ROLE_SECTION: CurriculumLesson["sections"][number] = {
  heading: "What the major organizations actually do",
  paragraphs: [
    "Use organization names as examples of different industry roles, not as a frozen directory. Names, membership, jurisdiction, agreements and eligibility can change, so verify current official information before relying on any organization for a real project decision.",
  ],
  points: [
    "WGA East and WGA West: labour unions for covered writers; collective bargaining, compensation, credits and working conditions depend on the applicable agreement and jurisdiction.",
    "DGA: a labour organization for directors and members of the directorial team on covered work.",
    "SAG-AFTRA: a labour union for performers and other represented media professionals; the applicable agreement and jurisdiction determine coverage.",
    "IATSE: a labour union representing many technicians, artisans and craftspeople across film, television, stage and related entertainment work.",
    "PGA: a professional trade association for the producing community. Despite the word Guild in its name, it is not the labour-union equivalent of WGA, DGA or SAG-AFTRA.",
    "AMPAS: a professional film academy associated with the Academy Awards and other cinema programs; it is not a labour-bargaining body.",
    "ASC and ACE: professional or honorary societies for cinematographers and editors that support craft, education, recognition and professional community rather than general labour bargaining.",
    "BFI and BAFTA: UK institutions with different functions. BFI supports film culture, preservation and development; BAFTA is an arts charity and academy focused on learning, recognition and screen-industry support.",
    "EFA and FERA: European bodies with different purposes. EFA promotes European cinema and recognition; FERA represents directors' organizations in European policy and advocacy.",
    "Cinémathèque Française: a cultural and archival institution that preserves and presents film heritage.",
    "MPA and exhibition trade associations: represent companies or business sectors rather than individual creative workers. Organization names and memberships can change, so verify the current body before acting.",
    "VES: a professional society serving the visual-effects community through recognition, education and professional exchange rather than acting as a general film labour union.",
  ],
};

const FILM_INDUSTRY_ROLE_DEFINITIONS: CurriculumLesson["definitions"] = [
  {
    term: "Trade association",
    meaning: "An organization that represents companies or a business sector rather than bargaining collectively for individual workers.",
  },
  {
    term: "Professional society or academy",
    meaning: "An organization centered on craft, education, recognition, culture or professional community; it is not automatically a labour-bargaining body.",
  },
];

function integrateFilmIndustryLesson(lesson: CurriculumLesson): CurriculumLesson {
  if (lesson.id !== "industry") return lesson;
  return {
    ...lesson,
    sections: lesson.sections.flatMap((section) =>
      section.heading === "Organizations and jurisdiction"
        ? [section, FILM_INDUSTRY_ROLE_SECTION]
        : [section],
    ),
    definitions: [...lesson.definitions, ...FILM_INDUSTRY_ROLE_DEFINITIONS],
  };
}

export function withIssue2094LearnerIntegration(
  documents: readonly TopicDocument[],
): readonly TopicDocument[] {
  return documents.map((document) =>
    document.topic.id === "industry"
      ? { ...document, lessons: document.lessons.map(integrateFilmIndustryLesson) }
      : document,
  );
}
