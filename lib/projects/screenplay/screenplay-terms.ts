export type ScreenplayTermCategory = "Writing" | "Formatting" | "Structure" | "Character" | "Production" | "Revision" | "PlotPickle" | "Collaboration";

export type ScreenplayWorkspaceLink = {
  label: string;
  href: string;
};

export type ScreenplayTerm = {
  term: string;
  category: ScreenplayTermCategory;
  definition: string;
  concise: string;
  example?: string;
  related?: string[];
  workspace?: ScreenplayWorkspaceLink;
};

export const screenplayTermCategories: ScreenplayTermCategory[] = ["Writing", "Formatting", "Structure", "Character", "Production", "Revision", "PlotPickle", "Collaboration"];

const term = (item: Omit<ScreenplayTerm, "concise"> & { concise?: string }): ScreenplayTerm => ({
  ...item,
  concise: item.concise ?? item.definition.split(/(?<=[.!?])\s/)[0],
});

export const screenplayTerms: ScreenplayTerm[] = ([
  term({ term: "Action", category: "Writing", definition: "What the audience can see or hear, written in present tense with specific active verbs.", example: "Mara locks the door and pockets the key.", related: ["Show, don't tell", "Visual writing"], workspace: { label: "Open Screenplay", href: "/?workspace=screenplay" } }),
  term({ term: "Act", category: "Structure", definition: "A major movement with its own dramatic job. PlotPickle uses four working acts of six Blocks each.", related: ["Sequence", "Block"], workspace: { label: "Open Structure", href: "/structure" } }),
  term({ term: "Anti-theme", category: "Structure", definition: "The competing belief that challenges the theme and may control the protagonist at the beginning.", related: ["Theme", "Protective lie"] }),
  term({ term: "Beat (pause)", category: "Formatting", definition: "A brief pause or thought change. Write it only when the pause changes performance or meaning.", example: "(beat)" }),
  term({ term: "Beat (story)", category: "Structure", definition: "The smallest dramatic unit: an action, discovery, decision, reversal, or emotional shift.", related: ["Mini-block", "Scene"] }),
  term({ term: "Block", category: "PlotPickle", definition: "One of PlotPickle's 24 story containers, connecting purpose, conflict, choice, consequence, scenes, pages, visuals, and production evidence.", related: ["Mini-block", "Story Clock"], workspace: { label: "Open Structure", href: "/structure" } }),
  term({ term: "Boneyard", category: "Formatting", definition: "Fountain syntax for material kept in the file but excluded from the rendered screenplay.", example: "/* Removed scene */" }),
  term({ term: "Call sheet", category: "Production", definition: "A daily production document listing call times, locations, scenes, cast, crew, weather, contacts, and safety information.", workspace: { label: "Open Production", href: "/production" } }),
  term({ term: "Canon", category: "Revision", definition: "Information accepted as true in the current project version, distinct from proposals, questions, and research.", related: ["Story Bible", "Continuity"], workspace: { label: "Open Specialist Labs", href: "/labs" } }),
  term({ term: "Catalyst", category: "Structure", definition: "The disruptive event that breaks the ordinary pattern and creates the first unavoidable story problem.", related: ["Inciting incident", "Doorway"] }),
  term({ term: "Character arc", category: "Character", definition: "The change, deterioration, or refusal to change proven through increasingly costly choices.", related: ["Want", "Need", "Ghost"], workspace: { label: "Open Core Model", href: "/?workspace=core-model" } }),
  term({ term: "Character cue", category: "Formatting", definition: "The speaker's production name above dialogue, usually capitalized. Extensions clarify delivery location.", example: "MARA (V.O.)" }),
  term({ term: "Choice", category: "Structure", definition: "A decision that reveals character and causes the next story condition. Strong choices have a cost.", related: ["Consequence", "Turn"] }),
  term({ term: "Climax", category: "Structure", definition: "The decisive confrontation where the central conflict and the protagonist's transformation are tested together." }),
  term({ term: "Close-up (CU)", category: "Production", definition: "A tight camera framing emphasizing a face or detail. Use sparingly in a spec screenplay unless essential." }),
  term({ term: "Collaboration proposal", category: "Collaboration", definition: "A local PlotPickle server's complete project change submitted on its own GitHub branch and pull request for owner review.", related: ["Pull request", "Canonical branch"], workspace: { label: "Open GitHub & Backups", href: "/?workspace=collaboration" } }),
  term({ term: "Conflict", category: "Structure", definition: "Opposing wants, forces, values, or circumstances that make a goal difficult and require action." }),
  term({ term: "Consequence", category: "Structure", definition: "The result of an action or choice that changes conditions and carries energy into the next movement." }),
  term({ term: "CONT'D", category: "Formatting", definition: "Continued. It may identify resumed speech after interruption; screenplay software often adds it automatically." }),
  term({ term: "Continuity", category: "Revision", definition: "Consistency of time, place, knowledge, injuries, props, wardrobe, relationships, rules, and visual details.", related: ["Canon", "Story Bible"] }),
  term({ term: "Dialogue", category: "Writing", definition: "Spoken words used as action: a character pursues an objective through rhythm, strategy, status, and subtext.", workspace: { label: "Open Dialogue Lab", href: "/labs" } }),
  term({ term: "Dramatic question", category: "Structure", definition: "The central uncertainty the audience tracks until the ending supplies an answer through action." }),
  term({ term: "Establishing shot", category: "Production", definition: "A view that orients the audience to place, time, scale, or spatial relationships before closer coverage." }),
  term({ term: "EXT.", category: "Formatting", definition: "Exterior. Starts a scene heading when action takes place outside.", example: "EXT. PARKING LOT - NIGHT" }),
  term({ term: "Final Draft FDX", category: "Formatting", definition: "Final Draft's XML screenplay interchange format. PlotPickle imports and exports FDX.", related: ["Fountain"] }),
  term({ term: "Fountain", category: "Formatting", definition: "A portable plain-text screenplay format using simple conventions for headings, characters, dialogue, and transitions." }),
  term({ term: "Ghost", category: "Character", definition: "The unresolved wound, loss, shame, or inherited condition still shaping present behaviour.", related: ["Protective lie", "Need"] }),
  term({ term: "INT.", category: "Formatting", definition: "Interior. Starts a scene heading when action takes place inside.", example: "INT. KITCHEN - MORNING" }),
  term({ term: "Intercut", category: "Formatting", definition: "Alternating between two or more locations or simultaneous actions without repeating every full heading." }),
  term({ term: "Locked", category: "Revision", definition: "A scene or screenplay element protected from casual editing because production or revision dependencies rely on it." }),
  term({ term: "Logline", category: "Writing", definition: "A compact statement of protagonist, disruption, objective, opposition, stakes, and distinction.", workspace: { label: "Open Pitch & Review", href: "/pitch-review" } }),
  term({ term: "Mini-block", category: "PlotPickle", definition: "One of four movements inside each Block: Promise, Progress, Pressure, and Payoff, creating 96 writing positions.", related: ["Block", "Beat"] }),
  term({ term: "Montage", category: "Formatting", definition: "A compressed series of images or moments showing progress, contrast, repetition, or passage of time." }),
  term({ term: "Need", category: "Character", definition: "The deeper internal truth or change a character requires, whether or not they consciously recognize it.", related: ["Want", "Arc"] }),
  term({ term: "O.S.", category: "Formatting", definition: "Off screen. The character is physically in the scene but not visible in the current shot." }),
  term({ term: "Opening image", category: "Writing", definition: "The first meaningful visual impression of world, character condition, tone, theme, or story question." }),
  term({ term: "Parenthetical", category: "Formatting", definition: "A short direction beneath a character cue clarifying delivery or addressee only when necessary.", example: "(to Mara)" }),
  term({ term: "Pickle turn", category: "PlotPickle", definition: "A reversal or pressure move that changes the expected route while preserving the central audience question." }),
  term({ term: "PlotPickle Project File (.ppf)", category: "PlotPickle", definition: "The portable canonical project package containing the complete normalized story and an integrity record, but no credentials." }),
  term({ term: "POV", category: "Production", definition: "Point of view. A shot or passage presented from a particular character's visual perspective." }),
  term({ term: "Premise", category: "Writing", definition: "The core story arrangement expressed as a specific character, situation, conflict, and dramatic possibility." }),
  term({ term: "Production breakdown", category: "Production", definition: "A scene-by-scene inventory of cast, locations, props, wardrobe, vehicles, effects, stunts, extras, makeup, sound, and readiness.", workspace: { label: "Open Production", href: "/production" } }),
  term({ term: "Protagonist", category: "Character", definition: "The character whose pursuit and choices organize the main dramatic journey; not necessarily the most likeable person." }),
  term({ term: "Pull request", category: "Collaboration", definition: "GitHub's review boundary for a proposed branch. The repository owner may inspect, discuss, merge, or close it.", related: ["Collaboration proposal", "Canonical branch"] }),
  term({ term: "Resolution", category: "Structure", definition: "The movement after the climax showing what has settled, changed, been lost, or carried forward." }),
  term({ term: "Revision colour", category: "Revision", definition: "A production convention marking changed screenplay pages or elements across successive revision sets." }),
  term({ term: "Scene", category: "Structure", definition: "A continuous dramatic unit, usually in one place and time, built around objective, opposition, action, and change." }),
  term({ term: "Scene heading (slugline)", category: "Formatting", definition: "The line identifying interior or exterior, location, and time condition.", example: "INT. COMMUNITY HALL - NIGHT" }),
  term({ term: "Sequence", category: "Structure", definition: "A group of scenes pursuing a short-term objective or completing a distinct dramatic movement." }),
  term({ term: "Setup and payoff", category: "Revision", definition: "A planted detail, promise, skill, object, or question that returns later with greater meaning or practical effect." }),
  term({ term: "Shot", category: "Production", definition: "One continuous camera view defined by size, angle, movement, lens, composition, purpose, and duration.", workspace: { label: "Open Production", href: "/production" } }),
  term({ term: "Spec script", category: "Formatting", definition: "A screenplay written to be read or sold before production, normally avoiding unnecessary camera direction." }),
  term({ term: "Stakes", category: "Structure", definition: "What can be gained, lost, damaged, or changed by the outcome, and why it matters now." }),
  term({ term: "Story Bible", category: "Revision", definition: "The living source of truth for premise, characters, world, chronology, tone, terminology, rights, and continuity." }),
  term({ term: "Story Clock", category: "PlotPickle", definition: "PlotPickle's timing map across acts, sequences, Blocks, scenes, mini-blocks, beats, and shots; a guide, not a rule.", workspace: { label: "Open Structure", href: "/structure" } }),
  term({ term: "Story Thread", category: "PlotPickle", definition: "A trackable main plot, subplot, relationship, mystery, theme, or world line linked to scenes and milestones." }),
  term({ term: "Subtext", category: "Character", definition: "What a character means, wants, avoids, or feels beneath the literal words.", workspace: { label: "Open Dialogue Lab", href: "/labs" } }),
  term({ term: "Theme", category: "Structure", definition: "An idea about life tested through opposing choices and consequences rather than merely stated." }),
  term({ term: "Transition", category: "Formatting", definition: "An editing instruction such as CUT TO: or DISSOLVE TO:. Ordinary cuts usually need no written transition." }),
  term({ term: "Treatment", category: "Writing", definition: "A present-tense prose telling of the screen story used to test flow before or alongside screenplay pages." }),
  term({ term: "V.O.", category: "Formatting", definition: "Voice over. The voice is heard outside the speaker's physical delivery in the scene's present space." }),
  term({ term: "Want", category: "Character", definition: "The conscious external goal a character pursues and can usually describe in practical terms.", related: ["Need", "Objective"] }),
  term({ term: "World", category: "PlotPickle", definition: "The places, period, history, cultures, rules, technology, language, and visual limits that shape every choice." }),
] satisfies ScreenplayTerm[]).sort((left, right) => left.term.localeCompare(right.term));
