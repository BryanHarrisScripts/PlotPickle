export type ScreenplayTermCategory = "Formatting" | "Story Structure" | "Character" | "Production" | "PlotPickle";

export type ScreenplayTerm = {
  term: string;
  category: ScreenplayTermCategory;
  definition: string;
  example?: string;
};

export const screenplayTermCategories: ScreenplayTermCategory[] = ["Formatting", "Story Structure", "Character", "Production", "PlotPickle"];

export const screenplayTerms: ScreenplayTerm[] = ([
  { term: "Action", category: "Formatting", definition: "What the audience can see or hear, written in the present tense between dialogue passages.", example: "Mara locks the door and pockets the key." },
  { term: "Act", category: "Story Structure", definition: "A major movement of the story with its own dramatic job. PlotPickle divides a feature into four working acts." },
  { term: "Anti-theme", category: "Story Structure", definition: "The competing belief that challenges the story’s theme and may initially control the protagonist." },
  { term: "Beat (pause)", category: "Formatting", definition: "A brief pause or change in a character’s thought, sometimes written in a parenthetical. Use it only when the pause matters." },
  { term: "Beat (story)", category: "Story Structure", definition: "A small unit of dramatic change: an action, discovery, decision, reversal, or emotional shift." },
  { term: "Block", category: "PlotPickle", definition: "One of PlotPickle’s 24 five-minute story containers. A Block joins purpose, conflict, choice, consequence, scenes, and screenplay pages." },
  { term: "Catalyst", category: "Story Structure", definition: "The disruptive event that breaks the ordinary pattern and creates the story’s first unavoidable problem." },
  { term: "Character arc", category: "Character", definition: "The meaningful change—or refusal to change—that a character demonstrates through choices across the story." },
  { term: "Character cue", category: "Formatting", definition: "The character’s name above dialogue, usually capitalized. Extensions such as V.O. or O.S. may clarify where the voice comes from.", example: "MARA (V.O.)" },
  { term: "Choice", category: "Story Structure", definition: "A decision that reveals character and causes the next piece of the story. Strong choices have a cost." },
  { term: "Climax", category: "Story Structure", definition: "The decisive confrontation where the central conflict and the protagonist’s transformation are tested." },
  { term: "Close-up (CU)", category: "Production", definition: "A tight camera framing that emphasizes a face or important detail. Usually used sparingly in a spec screenplay." },
  { term: "Conflict", category: "Story Structure", definition: "Opposing wants, forces, values, or circumstances that make a goal difficult and require action." },
  { term: "Consequence", category: "Story Structure", definition: "The result of an action or choice. Consequences carry story energy forward and prevent scenes from feeling isolated." },
  { term: "CONT’D", category: "Formatting", definition: "Short for continued. It can indicate that the same character resumes speaking after an interruption; screenplay software often adds it automatically." },
  { term: "Dialogue", category: "Formatting", definition: "Words spoken by a character. Effective dialogue also carries intention, pressure, rhythm, and subtext." },
  { term: "Dramatic question", category: "Story Structure", definition: "The central uncertainty the story asks the audience to keep tracking until the ending answers it." },
  { term: "Establishing shot", category: "Production", definition: "A view that orients the audience to a place, time, or spatial relationship before closer coverage." },
  { term: "EXT.", category: "Formatting", definition: "Exterior. Used at the start of a scene heading when the action takes place outside.", example: "EXT. PARKING LOT – NIGHT" },
  { term: "Final Draft FDX", category: "Formatting", definition: "Final Draft’s XML screenplay file format. PlotPickle can import and export FDX for handoff to other screenplay tools." },
  { term: "Fountain", category: "Formatting", definition: "A plain-text screenplay format that uses simple conventions for scene headings, characters, dialogue, and transitions." },
  { term: "Ghost", category: "Character", definition: "The unresolved wound, loss, shame, or past event that still shapes a character’s present behaviour." },
  { term: "INT.", category: "Formatting", definition: "Interior. Used at the start of a scene heading when the action takes place inside.", example: "INT. KITCHEN – MORNING" },
  { term: "Intercut", category: "Formatting", definition: "Alternating between two or more locations or actions, often used for phone calls or simultaneous events." },
  { term: "Logline", category: "Story Structure", definition: "A compact statement of the protagonist, goal, opposition, and stakes that expresses the movie’s central engine." },
  { term: "Mini-block", category: "PlotPickle", definition: "One of four smaller dramatic movements inside each Block. Four mini-blocks per Block create PlotPickle’s 96-part writing path." },
  { term: "Montage", category: "Formatting", definition: "A compressed series of images or short moments that shows progress, contrast, repetition, or the passage of time." },
  { term: "Need", category: "Character", definition: "The deeper internal truth or change a character requires, whether or not they consciously recognize it." },
  { term: "O.S.", category: "Formatting", definition: "Off screen. The character is physically present in the scene but is not visible in the current shot." },
  { term: "Opening image", category: "Story Structure", definition: "The first meaningful visual impression of the story world, character condition, tone, or theme." },
  { term: "Parenthetical", category: "Formatting", definition: "A short direction beneath a character cue that clarifies how a line is delivered or whom it addresses. Use sparingly.", example: "(to Mara)" },
  { term: "Pickle turn", category: "PlotPickle", definition: "A PlotPickle reversal or pressure move that changes the expected route while keeping the audience invested in the same central question." },
  { term: "POV", category: "Production", definition: "Point of view. A shot or passage presented from a particular character’s visual perspective." },
  { term: "Premise", category: "Story Structure", definition: "The core story situation or ‘what if’ idea from which the characters, conflict, and dramatic possibilities grow." },
  { term: "Protagonist", category: "Character", definition: "The character whose pursuit and choices organize the main dramatic journey. This is not always the most likeable character." },
  { term: "Resolution", category: "Story Structure", definition: "The story movement after the climax that shows what has been settled, changed, lost, or carried forward." },
  { term: "Scene", category: "Story Structure", definition: "A continuous dramatic unit, usually in one place and time, built around an immediate objective, conflict, and change." },
  { term: "Scene heading (slugline)", category: "Formatting", definition: "The line that identifies interior or exterior, location, and time of day.", example: "INT. COMMUNITY HALL – NIGHT" },
  { term: "Sequence", category: "Story Structure", definition: "A group of related scenes that pursues a short-term objective or completes a distinct dramatic movement." },
  { term: "Setup and payoff", category: "Story Structure", definition: "A planted detail, promise, skill, object, or question that later returns with greater meaning or practical effect." },
  { term: "Shot", category: "Production", definition: "One continuous camera view. A spec script normally emphasizes story and readable action rather than directing every shot." },
  { term: "Spec script", category: "Formatting", definition: "A screenplay written to be read, considered, or sold before production. It normally avoids unnecessary camera and editing directions." },
  { term: "Stakes", category: "Story Structure", definition: "What can be gained, lost, damaged, or changed by the outcome—and why the result matters now." },
  { term: "Story Clock", category: "PlotPickle", definition: "PlotPickle’s timing view across acts, sequences, Blocks, scenes, mini-blocks, beats, and shots. It is a planning reference, not a rigid rule." },
  { term: "Subtext", category: "Character", definition: "What a character means, wants, avoids, or feels beneath the literal words being spoken." },
  { term: "Theme", category: "Story Structure", definition: "The idea about life or human behaviour that the story tests through choices and consequences rather than merely stating." },
  { term: "Transition", category: "Formatting", definition: "An editing instruction between scenes, such as CUT TO: or DISSOLVE TO:. Most ordinary cuts do not need to be written." },
  { term: "Treatment", category: "Formatting", definition: "A prose telling of the screen story, usually longer than a synopsis but not written as full screenplay pages." },
  { term: "V.O.", category: "Formatting", definition: "Voice over. The speaker’s voice is heard, but the speaker is not physically delivering the line in the scene’s present space." },
  { term: "Want", category: "Character", definition: "The conscious external goal a character pursues and can usually describe in practical terms." },
  { term: "World", category: "PlotPickle", definition: "The story’s places, period, history, cultures, rules, technology, visual language, and limits that must remain consistent." },
] satisfies ScreenplayTerm[]).sort((a, b) => a.term.localeCompare(b.term));
