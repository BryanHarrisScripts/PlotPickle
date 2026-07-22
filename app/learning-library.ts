export type LearningPath = "Foundations" | "Development" | "Craft" | "Drafting" | "Industry" | "Responsible AI";

export type LearningSection = {
  heading: string;
  paragraphs: string[];
  points?: string[];
};

export type LearningModule = {
  id: string;
  number: number;
  path: LearningPath;
  title: string;
  duration: string;
  overview: string;
  objectives: string[];
  sections: LearningSection[];
  definitions: { term: string; meaning: string }[];
  example: { title: string; text: string };
  checklist: string[];
  mistakes: string[];
  exercise: string;
  apply: "Treatment" | "Screenplay" | "Block plan";
  tags: string[];
};

export const learningModules: LearningModule[] = [
  {
    id: "pitch",
    number: 1,
    path: "Foundations",
    title: "The Pitch",
    duration: "25–35 min",
    overview: "Turn a story idea into a clear invitation: what the story is, whose journey we follow, why it matters, who it is for and why someone should want to read or produce it.",
    objectives: ["Build a logline around character, goal, opposition and stakes.", "Expand the idea into a concise synopsis without losing causality.", "Match the pitch to audience, genre, scope and practical production needs."],
    sections: [
      { heading: "What a pitch must accomplish", paragraphs: ["A pitch is not a compressed screenplay and it is not a list of everything that happens. It is a promise of a dramatic experience. The listener should understand the central character, the disruptive situation, the pursuit, the primary resistance and the cost of failure.", "A useful pitch also communicates tone. A bleak survival thriller and a warm family comedy may share a plot mechanism, but the emotional experience, language and selected details should immediately distinguish them."], points: ["Lead with the human problem, not the mythology.", "Name the engine that can sustain the story.", "Reveal the distinctive element without explaining every rule."] },
      { heading: "Build the pitch in layers", paragraphs: ["Start with a one-sentence logline. Expand it to a short paragraph that includes the catalyst, major escalation and likely endgame without giving a scene-by-scene account. A longer synopsis can then show the complete causal path, including the ending when the reader needs to evaluate the story rather than be marketed to.", "For a spoken or written presentation, add the intended audience, genre, tonal comparison, format, approximate scope and the reason you are the right person to tell it. Comparable titles are coordinates, not claims that your work duplicates an existing success."], points: ["Logline: the dramatic engine in one sentence.", "Short pitch: character, world, conflict, escalation and emotional promise.", "Synopsis: the full movement of the story, including its resolution.", "Call to action: what you want the listener to do next."] },
      { heading: "Presenting with confidence", paragraphs: ["Memorize the shape rather than every word. The strongest delivery sounds like someone who understands the story, not someone reciting sales copy. Anticipate questions about character agency, the middle of the story, audience, budget-sensitive elements and what makes the project distinct.", "Be accurate about development status. If the screenplay, visual board or budget is preliminary, say so. Credibility is more useful than artificial certainty."] }
    ],
    definitions: [{ term: "Logline", meaning: "A one- or two-sentence statement of protagonist, disruptive situation, objective, opposition and stakes." }, { term: "Comparable titles", meaning: "Existing works used to communicate audience, tone, scale or market position." }, { term: "Call to action", meaning: "The specific next step requested from the listener or reader." }],
    example: { title: "From premise to logline", text: "Premise: A cautious paramedic can hear a victim's final thought. Logline: After hearing a murder victim name a respected police chief, a risk-averse paramedic must prove the chief is a killer before the ability exposes her own buried crime." },
    checklist: ["The protagonist is specific.", "The objective is active and visible.", "Opposition and stakes are clear.", "Genre and tone are apparent.", "The middle contains a repeatable source of conflict.", "The requested next step is explicit."],
    mistakes: ["Beginning with backstory instead of the disruptive event.", "Listing events without showing cause and consequence.", "Using vague praise such as unique, epic or compelling in place of evidence.", "Comparing only by popularity rather than tone, audience or scale."],
    exercise: "Write a 35-word logline for the active story. Then expand it to 150 words using the current Catalyst, central conflict, Pickle and ending proof.",
    apply: "Block plan",
    tags: ["pitch", "logline", "synopsis", "audience", "comparables", "budget", "call to action"]
  },
  {
    id: "genres",
    number: 2,
    path: "Foundations",
    title: "Tropes and Genres",
    duration: "30–40 min",
    overview: "Use genre as an audience agreement and tropes as flexible storytelling tools, then create freshness through character, context, consequence and combination.",
    objectives: ["Identify the emotional promise of the chosen genre.", "Distinguish useful conventions from unexamined clichés.", "Combine or invert tropes without breaking the audience contract."],
    sections: [
      { heading: "Genre is a promise", paragraphs: ["Genre tells an audience what kind of emotional journey they are entering. Comedy promises patterned surprise and release; horror promises dread, vulnerability and confrontation with fear; drama promises consequential human choices; thriller promises uncertainty, pursuit and mounting pressure; fantasy promises an extraordinary world governed by intelligible rules; science fiction tests human questions through technology, discovery or changed conditions.", "A story can mix genres, but it still needs a dominant promise. The secondary genre should sharpen the experience rather than create a different movie every twenty minutes."], points: ["Comedy: escalation, contrast, timing and consequence.", "Horror: vulnerability, anticipation, boundary violation and cost.", "Drama: relationships, values, difficult choices and change.", "Thriller: information control, pursuit, reversals and a clock.", "Fantasy: wonder, myth, rules and moral consequence.", "Science fiction: speculation, systems, unintended effects and human meaning."] },
      { heading: "Tropes are tools", paragraphs: ["A trope is a recognizable pattern: the reluctant hero, forbidden room, ticking clock, chosen family, false victory or mentor sacrifice. Recognition gives the writer speed and gives the audience orientation. A cliché appears when the pattern arrives without a story-specific cause, cost or point of view.", "Freshness rarely means eliminating every familiar element. It means asking who experiences it, what this world makes different, what choice it forces and what consequence the familiar version usually avoids."], points: ["Fulfil a convention cleanly when the audience needs orientation.", "Subvert it when the reversal reveals character or theme.", "Combine conventions when their pressures interact.", "Avoid a reversal that exists only to prove the audience wrong."] },
      { heading: "Audit the genre experience", paragraphs: ["Track where the screenplay delivers its genre promise across the 24 Blocks. A horror story cannot rely on one frightening opening and a frightening ending; a comedy needs comic engines that can generate different complications; a mystery must manage clues, interpretations and fair concealment.", "Tone can vary without abandoning genre. Relief, tenderness and stillness often make the next genre beat stronger because contrast resets the audience's attention."] }
    ],
    definitions: [{ term: "Genre convention", meaning: "A recurring feature audiences reasonably expect from a kind of story." }, { term: "Trope", meaning: "A recognizable storytelling pattern that can be used, combined, questioned or inverted." }, { term: "Cliché", meaning: "A familiar device presented without fresh cause, specificity, consequence or insight." }],
    example: { title: "Refreshing a familiar trope", text: "Instead of a detective who breaks rules because he is brilliant, make rule-following his survival strategy. The case forces him to choose between the procedure that once protected him and the witness it now endangers." },
    checklist: ["The dominant genre is clear.", "The emotional promise repeats with variation.", "Major tropes have story-specific causes.", "Genre mixing creates useful pressure.", "The ending satisfies or deliberately reframes the central promise."],
    mistakes: ["Confusing darkness with horror or jokes with comedy.", "Subverting a trope without replacing its dramatic function.", "Changing genre because the middle lacks an engine.", "Using stereotypes as shorthand for character."],
    exercise: "Name the active story's dominant and secondary genres. List five audience expectations, then mark each as fulfil, twist, combine or intentionally omit—and explain why.",
    apply: "Block plan",
    tags: ["genre", "trope", "comedy", "horror", "drama", "thriller", "fantasy", "science fiction", "cliche"]
  },
  {
    id: "structures",
    number: 3,
    path: "Foundations",
    title: "Story Structures: Screenplays to Improv",
    duration: "40–50 min",
    overview: "Understand multiple structural traditions so the 24 Blocks can support the story's natural movement instead of becoming a mechanical formula.",
    objectives: ["Compare act, journey, episodic and non-linear structures.", "Choose structure by dramatic need and audience experience.", "Translate another structure into PlotPickle's 24-block planning grid."],
    sections: [
      { heading: "Structure organizes change", paragraphs: ["Structure is the arrangement of pressure, choice, consequence and revelation. It helps the audience understand what matters now, remember what matters later and feel that the ending was both surprising and prepared.", "The 24 Blocks are a resolution tool: they make movement visible at a useful scale. They do not require every story to have identical turns, equal scene counts or a single theory underneath it."], points: ["Three-act: setup, confrontation and resolution.", "Five-act: introduction, rising action, climax, falling action and resolution.", "Seven-act or sequence approaches: smaller escalating movements with distinct turns.", "Hero's Journey: departure, initiation and return expressed through recurring stages."] },
      { heading: "Alternative forms", paragraphs: ["Non-linear stories reorder events to control meaning, not simply to appear complex. Parallel narratives create comparison or collision between separate lines. Circular stories return to an opening condition with transformed context. Framing devices place one narrative inside another. Episodic structures gain unity through character, theme, setting, task or accumulation rather than one continuous objective.", "Improvisational forms offer useful lessons. Repetition with variation trains escalation. Returning to a shared game or pattern creates cohesion. Status changes, offers and consequences reveal how story can emerge from active listening rather than preplanned explanation."], points: ["Chronology and revelation order are different tools.", "Every parallel line needs its own movement and a reason to share the film.", "A frame must alter how the inner story is understood.", "Episodes need a cumulative promise, not merely separate incidents."] },
      { heading: "Choose and map", paragraphs: ["Select the structure that best controls the audience's questions. A mystery may hide chronology while preserving causal clarity. A relationship drama may use parallel viewpoints. A journey may use repeated trials that progressively expose the protagonist's belief.", "Map major structural turns to Blocks first, then test the movement between them. If a theory demands a turn the story has not earned, revise the map or the theory—not the characters' behaviour merely to hit a label."] }
    ],
    definitions: [{ term: "Causality", meaning: "The relationship in which one decision or event meaningfully produces the next." }, { term: "Non-linear", meaning: "A presentation order that differs from chronological order for a deliberate dramatic effect." }, { term: "Framing device", meaning: "An outer narrative context that contains and changes the interpretation of another story." }],
    example: { title: "One event, three structures", text: "A reunion can be linear as old friends confront a present betrayal; parallel as each travels there with a different secret; or circular as the closing image repeats the group's old photograph after one person has been removed." },
    checklist: ["The structure supports the central dramatic question.", "Each major movement changes conditions.", "Reordered information has a clear purpose.", "Parallel or episodic lines accumulate.", "The ending resolves the form as well as the plot."],
    mistakes: ["Treating structural labels as events.", "Using non-linearity to hide weak causality.", "Giving every movement equal intensity.", "Forcing a character decision only because a template demands a turn."],
    exercise: "Describe the active story in three structural forms. Choose the form that produces the clearest emotional build, then place its eight most important turns across the 24 Blocks.",
    apply: "Block plan",
    tags: ["structure", "three act", "five act", "seven act", "hero journey", "non-linear", "parallel", "circular", "episodic", "improv"]
  },
  {
    id: "writing-process",
    number: 4,
    path: "Development",
    title: "The Writing Process",
    duration: "30–40 min",
    overview: "Move deliberately from idea generation through research, planning, drafting, feedback, rewriting and proofreading without expecting one mental mode to do every job at once.",
    objectives: ["Separate discovery, drafting and evaluation modes.", "Build a repeatable workflow around clear deliverables.", "Use feedback as evidence without surrendering authorship."],
    sections: [
      { heading: "Discovery and selection", paragraphs: ["Ideas often arrive as images, situations, characters, arguments or fragments. Capture them before judging them. Selection comes later: look for an idea with a human problem, an engine that can generate consequences and a question you want to live with through many drafts.", "Research should create dramatic options and prevent avoidable errors. Record sources, separate fact from invention and stop researching when it becomes a way to postpone decisions."], points: ["Capture freely.", "Select by dramatic potential and personal interest.", "Research the world, work, history and lived experience that affect the story.", "Turn discoveries into choices, not an encyclopedia."] },
      { heading: "Plan, draft and finish", paragraphs: ["Planning can include the premise, pitch, world, characters, 24 Blocks and treatment. Plan enough to see the path while leaving room for discoveries made in scenes. During the first draft, prioritize continuity of effort and causal movement over polish.", "A finished imperfect draft can be diagnosed. A perfect opening attached to no ending cannot. Set small, visible targets: a mini-block treatment, one scene, a dialogue pass or a continuity pass."], points: ["Define the purpose of the current pass.", "Keep unresolved questions in notes instead of stopping every scene.", "Finish the full movement before polishing its surface."] },
      { heading: "Feedback and revision", paragraphs: ["Ask readers to report their experience: where attention dropped, what they expected, when they became confused, which choice felt unearned and what stayed with them. These observations are evidence. Suggested fixes are optional hypotheses.", "Revision should move from large to small: concept and engine, structure, character causality, scene purpose, visual action, dialogue, formatting and proofreading. Polishing dialogue in a scene that may be removed is expensive avoidance."] }
    ],
    definitions: [{ term: "Pass", meaning: "A revision cycle focused on one layer or intention." }, { term: "Reader experience", meaning: "A report of attention, expectation, emotion and comprehension while encountering the draft." }, { term: "Proofreading", meaning: "The final correction of spelling, grammar, punctuation and formatting after story revisions." }],
    example: { title: "A focused revision sequence", text: "First pass: ensure every Block causes the next. Second: track the protagonist's choices. Third: remove scenes without a turn. Fourth: strengthen visual action. Fifth: refine dialogue. Sixth: proofread." },
    checklist: ["The current stage has a defined deliverable.", "Research questions are bounded.", "Drafting time is protected from line editing.", "Feedback asks about experience.", "Revision proceeds from structural to cosmetic."],
    mistakes: ["Editing the first pages indefinitely.", "Researching without converting facts into story pressure.", "Combining drafting and harsh evaluation in the same minute.", "Applying every reader's proposed solution."],
    exercise: "Write the active project's next six deliverables in order. Give each a definition of done and identify which can be completed in one writing session.",
    apply: "Treatment",
    tags: ["process", "ideas", "research", "outline", "draft", "feedback", "revision", "proofreading", "workflow"]
  },
  {
    id: "concept-to-draft",
    number: 5,
    path: "Development",
    title: "Concept to Final Draft",
    duration: "45–60 min",
    overview: "Develop a concept through premise, characters, world, beats, treatment, screenplay and layered revision while preserving one clear dramatic spine.",
    objectives: ["Test whether a concept can sustain a feature-length story.", "Build increasingly detailed documents without duplicating disconnected versions.", "Know what question each development stage must answer."],
    sections: [
      { heading: "Concept and premise", paragraphs: ["A concept is the seed; a premise states the dramatic arrangement. Test the protagonist, disruption, pursuit, opposition, stakes and distinctive condition. Then ask whether the situation forces enough different choices to sustain the intended length.", "Theme at this stage is a live question, not a lesson the screenplay plans to announce. The story earns its meaning by placing different answers under pressure."], points: ["Who is forced to act?", "What changes the ordinary pattern?", "What visible result do they pursue?", "Why is success difficult now?", "What is lost if they fail or refuse?"] },
      { heading: "Expansion without drift", paragraphs: ["Character profiles, the world and the structural plan should all serve the same story engine. Each new layer must clarify behaviour, resistance or consequence. Interesting material that does not affect the screenplay can remain in research notes rather than burdening the draft.", "Move from logline to beat spine, from 24 Blocks to 96 mini-blocks, and from treatment prose into formatted scenes. At every scale, preserve condition, attempt, pressure and turn."], points: ["Blocks test the broad causal path.", "Mini-blocks identify the smallest planned story movements.", "Treatment tests flow in readable prose.", "Screenplay converts intention into visible and audible dramatic action."] },
      { heading: "Draft and revise", paragraphs: ["Screenplay pages reveal problems planning can hide: a scene may have no playable objective, dialogue may carry information no one would say, or an emotional turn may have no behaviour to prove it. Allow the draft to teach you about the plan.", "After completion, evaluate the whole before repairing individual lines. Compare the final experience with the original promise, then revise through focused passes and update the treatment or block plan when a discovery becomes canonical."] }
    ],
    definitions: [{ term: "Concept", meaning: "The initial story idea, situation, image or dramatic possibility." }, { term: "Premise", meaning: "The concept expressed as a specific character, situation, conflict and likely movement." }, { term: "Treatment", meaning: "A present-tense prose telling of the screen story used to test flow before or alongside screenplay pages." }],
    example: { title: "Increasing resolution", text: "Concept: Memory can be rented. Premise: A debt collector rents the memory of a crime and recognizes herself. Block turn: she hides the evidence. Mini-block turn: the victim's child recognizes a phrase she repeats. Scene: the child tests her with a private detail." },
    checklist: ["The premise contains an active engine.", "Character and world choices affect plot.", "Every planning scale preserves causality.", "Treatment movements can become scenes.", "Draft discoveries update the project source of truth."],
    mistakes: ["Expanding lore while the central pursuit remains vague.", "Treating an outline as a contract that pages cannot challenge.", "Adding twists that do not alter a character's choice.", "Rewriting locally without updating the larger story logic."],
    exercise: "For the selected mini-block, write one sentence each for condition, attempt, resistance, choice and changed outcome. Expand those five sentences into a 250-word treatment passage.",
    apply: "Treatment",
    tags: ["concept", "premise", "beats", "outline", "treatment", "screenplay", "final draft", "causality"]
  },
  {
    id: "world-building",
    number: 6,
    path: "Development",
    title: "World-Building",
    duration: "40–55 min",
    overview: "Create a world with history, cultures, institutions, rules, geography and language that produces story pressure and appears through lived detail rather than explanation.",
    objectives: ["Define rules and consequences the plot can test.", "Connect place, culture and institutions to character behaviour.", "Reveal the world through action, conflict and selective detail."],
    sections: [
      { heading: "Build the blueprint", paragraphs: ["World-building applies to every genre. A contemporary hospital, a small town, a touring band and an invented planet all have geography, power, routines, values, language and restricted access. Begin with what characters can and cannot do, who benefits from the system and where the story can apply pressure.", "In speculative work, distinguish physical rules, social rules and believed rules. A belief may be false while still controlling behaviour. A physical rule should remain consistent unless the story clearly establishes its exception and cost."], points: ["Environment and geography", "History and collective memory", "Institutions and power", "Economy and everyday labour", "Cultures, rituals and taboos", "Technology, magic or special rules", "Language, symbols and communication"] },
      { heading: "Make the world causal", paragraphs: ["A world detail earns screen time when it changes a choice, creates an obstacle, offers a tool, reveals status or deepens theme. Weather can close a route; an institutional policy can make honesty dangerous; a ritual can force enemies into the same room.", "History should leave present evidence: architecture, prejudice, law, family expectations, damaged land, slang or disputed monuments. Avoid writing a past that no living character carries."], points: ["For every major rule, define who enforces it.", "For every resource, define who controls access.", "For every cultural value, show a character who agrees and one who pays its cost."] },
      { heading: "Reveal without lectures", paragraphs: ["Let the audience infer ordinary rules by watching characters use them. Exposition becomes active when one person needs another to misunderstand, comply, remember, choose or break a rule.", "Balance the extraordinary with the mundane. Meals, repairs, travel, jokes and private habits give scale to invented wonders. Select a few precise sensory details instead of describing the entire environment on first arrival."] }
    ],
    definitions: [{ term: "World rule", meaning: "A consistent physical, social, institutional or supernatural constraint with consequences." }, { term: "Exposition", meaning: "Information the audience needs in order to understand story conditions." }, { term: "Lived detail", meaning: "A specific behaviour, object, routine or consequence that makes the world feel inhabited." }],
    example: { title: "World detail as conflict", text: "Weak: Citizens must surrender memories each year. Dramatic: At renewal, the protagonist finds her mother in the surrender line holding a memory the government says never existed." },
    checklist: ["Rules have visible costs and enforcement.", "History affects present behaviour.", "Cultures contain disagreement and variation.", "Geography changes access or risk.", "Exposition arrives through a current objective.", "Visual details can feed the storyboard."],
    mistakes: ["Explaining the whole world before the story begins.", "Creating rules that change whenever the plot needs an escape.", "Treating a culture as one uniform personality.", "Building fascinating history with no present consequence."],
    exercise: "Choose one active location. Define its controlling power, public rule, private exception, sensory signature and the behaviour that reveals all four without explanatory dialogue.",
    apply: "Block plan",
    tags: ["world", "history", "culture", "society", "rules", "geography", "language", "setting", "show don't tell"]
  },
  {
    id: "character-bible",
    number: 7,
    path: "Development",
    title: "Story Bible: Character",
    duration: "45–60 min",
    overview: "Develop characters as coherent but surprising systems of want, need, wound, belief, skill, contradiction, relationships, voice and choices under pressure.",
    objectives: ["Build a profile that predicts behaviour without making it mechanical.", "Connect backstory to present strategy.", "Track relationships and transformation through choices."],
    sections: [
      { heading: "The dramatic core", paragraphs: ["A useful character profile begins with action. What does this person pursue now? What do they believe will happen if they obtain it? What deeper change do they resist? The Ghost or wound matters because it produced a present protective strategy, not because every detail of childhood must be told.", "Strengths and flaws are often the same strategy in different conditions. Loyalty can become complicity; caution can become paralysis; charm can become manipulation. Pressure changes the cost."], points: ["Want: the conscious, visible objective.", "Need: the change required for a fuller or more truthful life.", "Ghost: the past event or condition still shaping the present.", "Lie or limiting belief: the conclusion that makes the protective strategy feel necessary.", "Capacity: the skill or strength that helps until it creates a new cost."] },
      { heading: "Specificity and voice", paragraphs: ["Background affects language, comfort, assumptions, skills and access, but it should not reduce a person to demographic labels. Record education, work, social context, worldview, rhythm, vocabulary, humour, persuasion strategy and emotional access as playable tendencies.", "Contradictions create dimensionality when both sides have causes. A fearless surgeon may avoid ordinary intimacy; a generous leader may hoard credit. Random inconsistency does not create complexity."], points: ["What does the character notice first?", "How do they seek status or safety?", "What will they joke about but never discuss directly?", "How does their speech change with power, fear or intimacy?"] },
      { heading: "Relationships and arc", paragraphs: ["Define each important relationship from both directions. What does each person want from the other, what role do they assign them and what history remains unresolved? Relationships become dramatic when a change in one character forces the other to adapt.", "Track the arc through decisions at meaningful costs. The final choice should prove change—or prove the tragedy of refusing it—without requiring a speech that announces the theme."] }
    ],
    definitions: [{ term: "Ghost", meaning: "A past wound, loss or condition that continues to shape the character's present behaviour." }, { term: "Character arc", meaning: "The pattern of change, resistance or deterioration proven through choices over the story." }, { term: "Voiceprint", meaning: "The character-specific combination of worldview, rhythm, vocabulary, status and communication strategy." }],
    example: { title: "Strength, flaw and choice", text: "Mara's precision made her a brilliant bomb technician. It also makes her control everyone she loves. In the climax, she must give an untrained witness incomplete instructions and trust him to improvise." },
    checklist: ["Want and need are distinct.", "Backstory creates a present strategy.", "Strength and flaw affect the plot.", "Voice changes appropriately by relationship and status.", "Relationships contain mutual objectives.", "The arc is proven by costly choices."],
    mistakes: ["Writing biography that never affects behaviour.", "Using trauma as decoration or instant depth.", "Giving every character the writer's vocabulary.", "Confusing inconsistency with contradiction.", "Declaring transformation without a different final action."],
    exercise: "Complete the active character's want, need, Ghost, lie, strength/flaw pair and final proof of change. Then write how two other characters would describe that person differently.",
    apply: "Block plan",
    tags: ["character", "profile", "backstory", "relationship", "want", "need", "ghost", "flaw", "arc", "voiceprint"]
  },
  {
    id: "story-bible",
    number: 8,
    path: "Development",
    title: "The Story Bible",
    duration: "35–50 min",
    overview: "Create a living source of truth for premise, world, characters, chronology, tone, themes, terminology and continuity without turning development into an archive no one uses.",
    objectives: ["Choose information that protects consistency and supports decisions.", "Separate canonical facts from possibilities and research.", "Maintain the bible as the screenplay evolves."],
    sections: [
      { heading: "Purpose and scope", paragraphs: ["A story bible keeps collaborators and future drafts aligned. It answers recurring questions about who, where, when, how the world works and what the project is trying to make the audience feel. For a feature, it can be compact. For a series or extensive fictional world, it may include episode engines, long arcs and rules for material not yet written.", "The bible should reduce friction. If a page is never consulted and never changes a decision, it may belong in research notes rather than the canonical bible."], points: ["Project premise, genre, format and audience promise", "Character profiles and relationship map", "World rules, locations and institutions", "Chronology and significant backstory", "Structure, theme, motifs and tone", "Terminology, pronunciation and continuity locks", "Open questions and revision decisions"] },
      { heading: "Canonical, proposed and unknown", paragraphs: ["Mark the status of information. Canonical material is established by the current project. Proposed material is being tested. Unknowns are deliberate questions. Research facts should retain a source. This prevents an attractive possibility from silently becoming a contradiction later.", "When the screenplay changes a fact, update the source of truth. Do not leave three competing answers in separate notes and expect memory to decide which is current."], points: ["Record decisions and their consequences.", "Date major changes when collaboration makes history useful.", "Keep private creative work inside the project rather than in AI prompts or external services by default."] },
      { heading: "Use it during writing", paragraphs: ["Before a scene, consult only the relevant character, location, timeline and rule information. After a writing session, promote new facts that the screenplay established. Continuity review should search for changes in dates, ages, injuries, knowledge, props, geography, wardrobe and relationship status.", "PlotPickle's shared project already connects the planner, treatment, screenplay and storyboard. The goal is one evolving work, not four disconnected copies."] }
    ],
    definitions: [{ term: "Canon", meaning: "Information accepted as true within the current version of the story." }, { term: "Continuity", meaning: "Consistency of facts, time, space, knowledge, objects and conditions across the work." }, { term: "Source of truth", meaning: "The authoritative current record used when different notes conflict." }],
    example: { title: "A usable rule entry", text: "Rule: Memory transfers preserve emotion but not names. Evidence: Block 3 lab test. Cost: recipients misidentify people they love. Open question: can repeated transfers restore a name? Status: proposed until Block 9 is drafted." },
    checklist: ["The premise and audience promise are current.", "Facts have clear status.", "Character and relationship records agree with the draft.", "World rules include costs and exceptions.", "Chronology is testable.", "New screenplay facts are promoted after writing."],
    mistakes: ["Collecting information without status or purpose.", "Keeping contradictory versions in separate documents.", "Treating the bible as fixed when the better story changes.", "Putting every research note into the reader-facing story."],
    exercise: "Audit the active project for ten canonical facts, three proposed facts and three important unknowns. Add a continuity consequence to every canonical fact that could affect a later block.",
    apply: "Block plan",
    tags: ["story bible", "canon", "continuity", "timeline", "research", "world", "character", "source of truth"]
  },
  {
    id: "vomit-draft",
    number: 9,
    path: "Drafting",
    title: "The Vomit Draft",
    duration: "25–35 min",
    overview: "Use a fast, permission-giving first pass to discover the movie from beginning to end, while leaving clear markers for the disciplined revision that follows.",
    objectives: ["Understand speed as a discovery tool rather than a quality standard.", "Finish movements without stopping for every uncertainty.", "Prepare the rough draft for useful diagnosis."],
    sections: [
      { heading: "Permission to be incomplete", paragraphs: ["The phrase describes an intentionally rough first draft produced with forward momentum. Its value is psychological and practical: a writer can discover connections, missing motives and unexpected images only after enough of the story exists together.", "Fast drafting does not mean careless treatment of people, facts or safety. It means postponing sentence perfection and local repair while the larger movement is still emerging."], points: ["Write toward the planned turn.", "Use placeholders for facts, names or research.", "Record a problem without solving it immediately.", "Keep the causal line visible even when language is rough."] },
      { heading: "A productive session", paragraphs: ["Begin with a small target: one mini-block, one scene or one sequence. Review the entry condition, objective, resistance and intended change. Draft until the movement turns, then leave a short note about discoveries and unresolved issues.", "Markers such as [RESEARCH], [CONTINUITY], [BETTER IMAGE] or [MOTIVE?] preserve momentum. They also create a revision inventory instead of allowing vague dissatisfaction to follow the writer everywhere."], points: ["Set a time or movement target.", "Do not reread from page one before each session.", "Stop after recording the next intended action.", "Back up or export at meaningful milestones."] },
      { heading: "From roughness to revision", paragraphs: ["After completing a meaningful span, read it as an audience member and write observations before editing. Identify where the objective disappears, the conflict repeats, the character becomes passive or the turn fails to change anything.", "Preserve discoveries with energy. Revision is not punishment for drafting badly; it is the separate craft of shaping material that drafting made available."] }
    ],
    definitions: [{ term: "Placeholder", meaning: "A visible marker for missing information or language that should be resolved in a later pass." }, { term: "Forward momentum", meaning: "Sustained progress toward completion without repeatedly polishing earlier material." }, { term: "Discovery draft", meaning: "A draft used to learn what the story is before judging its final execution." }],
    example: { title: "Useful roughness", text: "INT. HOSPITAL ARCHIVE – NIGHT. Mara needs the file before security rounds. [RESEARCH: archive access]. The drawer is already open. Inside: her own childhood photograph. She hears the elevator." },
    checklist: ["The session target is small and visible.", "The scene has an objective and turn.", "Unknowns use searchable markers.", "New discoveries are recorded.", "Revision is delayed until a meaningful span exists."],
    mistakes: ["Using speed to excuse a story with no causal intention.", "Stopping for every word choice or factual search.", "Calling the first draft finished because it exists.", "Revising without first identifying the audience experience."],
    exercise: "Draft the selected mini-block for 20 uninterrupted minutes. Use markers instead of stopping. Finish by writing three discoveries, three questions and the next scene's entry condition.",
    apply: "Screenplay",
    tags: ["vomit draft", "first draft", "discovery", "momentum", "placeholder", "writer block", "finish"]
  },
  {
    id: "formatting",
    number: 10,
    path: "Craft",
    title: "Script Formatting",
    duration: "35–45 min",
    overview: "Use screenplay format as a readable production language for location, time, visible action, speakers, performance context and transitions—not as decoration.",
    objectives: ["Use standard screenplay elements correctly.", "Format for clarity, rhythm and production reading.", "Know when specialized elements help and when they distract."],
    sections: [
      { heading: "The core elements", paragraphs: ["A scene heading identifies interior or exterior, the specific location and a useful time condition. Action describes what the audience can see and hear in present tense. Character cues identify speakers. Dialogue contains spoken words. Parentheticals provide brief essential context when performance or addressee would otherwise be unclear. Transitions indicate a significant editorial relationship when the cut itself matters.", "Formatting supports scanning. Readers should quickly perceive a new location, a new speaker and a shift in action. Consistency matters more than ornamental cleverness."], points: ["Scene heading: INT./EXT. – LOCATION – TIME.", "Action: present tense, visible, specific and economical.", "Character cue: the speaking character's production name.", "Parenthetical: short, rare and playable.", "Dialogue: speech, not action directions.", "Transition: use when the edit carries meaning."] },
      { heading: "Page rhythm and readability", paragraphs: ["Screenplay pages create a rough sense of screen time, but one page per minute is a planning convention, not a physical law. Dense action can play quickly; a short exchange can contain long silence. Use paragraph breaks to shape images and shifts in attention.", "Introduce a speaking character clearly, keep action blocks readable and avoid directing every camera angle or performance beat unless it is essential to the story's comprehension."], points: ["One dominant visual idea per action paragraph.", "Capitalize names on useful first introduction, not every appearance.", "Use specific active verbs.", "Remove internal explanation that has no visible evidence."] },
      { heading: "Tools and exports", paragraphs: ["Fountain is a portable plain-text screenplay syntax. Final Draft FDX is a structured interchange format. PDF is the stable reading and submission format. Keep the editable project and an open export rather than relying on one proprietary file.", "PlotPickle assigns every screenplay element to a Block and mini-block, allowing formatting, structure and the visual storyboard to remain connected."] }
    ],
    definitions: [{ term: "Slugline", meaning: "Another name for a scene heading that establishes location and time." }, { term: "Parenthetical", meaning: "A brief direction beneath a character cue used only when necessary to clarify delivery or action." }, { term: "Transition", meaning: "An instruction or phrase describing a meaningful edit between images or scenes." }],
    example: { title: "Formatted movement", text: "INT. HOSPITAL ARCHIVE – NIGHT\n\nMara slips through the closing door. The elevator display climbs: 2... 3...\n\nMARA\n(into phone)\nYou said the file was sealed." },
    checklist: ["Headings establish usable location and time.", "Action is visible, audible and present tense.", "Characters are introduced consistently.", "Parentheticals are necessary and brief.", "Paragraphs shape images and rhythm.", "The editable project and portable export are preserved."],
    mistakes: ["Writing thoughts the audience cannot perceive.", "Directing routine camera coverage.", "Using parentheticals to control every line reading.", "Writing action inside dialogue.", "Treating page count as exact runtime."],
    exercise: "Open the selected screenplay position. Write a heading, three short action paragraphs, two character cues, dialogue with subtext and one necessary parenthetical. Remove anything the audience cannot see or hear.",
    apply: "Screenplay",
    tags: ["formatting", "slugline", "scene heading", "action", "character cue", "dialogue", "parenthetical", "transition", "fountain", "fdx"]
  },
  {
    id: "books-scripts",
    number: 11,
    path: "Craft",
    title: "Books, Screenplays and Deliberate Study",
    duration: "30–45 min",
    overview: "Learn craft by reading produced screenplays, comparing pages with finished scenes and turning books or examples into deliberate practice rather than borrowed formulas.",
    objectives: ["Read screenplays for decisions, not only entertainment.", "Compare different drafts and the finished film intelligently.", "Create exercises from craft resources without copying expression."],
    sections: [
      { heading: "Read like a writer", paragraphs: ["Read the screenplay once for experience. On the second pass, track where your expectation changed, when the protagonist chose, how information was withheld and how each scene exited. On a third pass, examine action paragraphs, dialogue length, white space and recurring images.", "Use legally available scripts and identify whether the file is an early draft, shooting script, transcript or fan reconstruction. These documents serve different purposes and may differ greatly from the release."], points: ["Mark scene objectives and turns.", "Track setups and payoffs.", "Compare character introductions.", "Notice how little or how much description a genre requires.", "Study transitions between scenes, not only scenes themselves."] },
      { heading: "Compare page and screen", paragraphs: ["Watch a scene after reading it. Note what performance, production design, sound, editing and camera added; what the screenplay prepared; and what changed during production. A difference is not automatically an error. Film is collaborative and the screenplay is a blueprint that must survive interpretation.", "Reverse the exercise by describing a finished scene in screenplay action. This trains selection: which visible details carry the dramatic experience and which are coverage or decoration?"], points: ["Separate story function from execution.", "Observe additions and omissions.", "Ask what information remained essential across versions."] },
      { heading: "Use craft books well", paragraphs: ["A craft book offers a lens, vocabulary and set of questions. Test its claims against several very different produced works. Do not force every screenplay to imitate the same page number, beat list or protagonist type.", "Combine reading with practice. One exercise applied to the active story is more valuable than highlighting a chapter without changing a decision."] }
    ],
    definitions: [{ term: "Shooting script", meaning: "A production-oriented screenplay version that may include scene numbers and revisions." }, { term: "Transcript", meaning: "A document created from the finished audio or picture rather than the original screenplay." }, { term: "Deliberate practice", meaning: "Focused work on a specific skill with evidence, repetition and reflection." }],
    example: { title: "A scene study card", text: "Question before scene: Will she confess? Objective: keep her job. Tactic: redirect blame. Turn: the witness repeats her private phrase. Exit question: Who taught the witness? Visual carrier: untouched coffee going cold." },
    checklist: ["The source and draft type are known.", "First reading preserves audience experience.", "Later passes track specific craft decisions.", "Page-to-screen differences are analyzed without assuming failure.", "One lesson is applied to the active project."],
    mistakes: ["Copying surface style or dialogue.", "Treating one successful screenplay as a universal template.", "Studying only films in one genre or era.", "Confusing a transcript with the writer's screenplay."],
    exercise: "Choose one legally available produced screenplay. Analyze a five-page sequence for objective, resistance, turn, visual action and exit question. Apply one discovered technique to the active mini-block using entirely original expression.",
    apply: "Treatment",
    tags: ["books", "scripts", "screenplay library", "reading", "study", "shooting script", "transcript", "deliberate practice"]
  },
  {
    id: "challenges",
    number: 12,
    path: "Craft",
    title: "Screenplay Challenges Guide",
    duration: "60–75 min",
    overview: "Diagnose common problems in story, character, dialogue, world, emotion, process, continuity, research and legal awareness by tracing symptoms back to their dramatic cause.",
    objectives: ["Identify the likely layer beneath a visible screenplay problem.", "Choose a focused revision experiment.", "Handle practical and personal writing challenges without confusing them with story failure."],
    sections: [
      { heading: "Story and structure problems", paragraphs: ["Weak openings often lack a specific condition, disturbance or question. Sagging middles often repeat resistance without changing strategy, knowledge, cost or relationship. Unsatisfying endings may solve the external task without answering the central dramatic question or proving character change.", "Escalation means qualitative change, not simply more noise. Pressure can narrow time, remove options, expose private information, change allies, increase moral cost or force the protagonist to use a dangerous strategy."], points: ["Test cause and consequence between Blocks.", "Remove repetition or make the next attempt meaningfully different.", "Keep at least two plausible outcomes alive.", "Prepare reversals through evidence without advertising them."] },
      { heading: "Character, dialogue and representation", paragraphs: ["A passive protagonist may lack a specific objective, usable options or meaningful consequences. A flat antagonist may represent obstruction without a persuasive worldview. Thin supporting characters often exist only to deliver information or approve the protagonist.", "On-the-nose dialogue usually states shared facts or explains emotion after behaviour already revealed it. Build objectives, tactics, status and withheld information into the exchange. Research identities and experiences outside your own, seek informed readers when appropriate and revise stereotypes rather than defending intention."], points: ["Give each major character an active interpretation of the situation.", "Let relationships change tactics and vocabulary.", "Use subtext and silence as action.", "Represent people as individuals within varied communities."] },
      { heading: "World, emotion and audience", paragraphs: ["Confusing world-building may lack consistent rules or may deliver rules before the audience has a reason to need them. Emotional distance may arise when consequences are abstract, choices are reversible or behaviour does not expose vulnerability.", "Suspense depends on expectation and uncertainty. Give the audience enough information to anticipate danger while controlling what remains unknown. Surprise without preparation produces shock; preparation without uncertainty produces inevitability."], points: ["Make world rules create choices.", "Turn stakes into a cost for a specific person.", "Use empathy through pursuit, vulnerability, competence and contradiction.", "Control information by point of view."] },
      { heading: "The writer's practical challenges", paragraphs: ["Writer's block can describe different problems: fear of evaluation, an unresolved story decision, exhaustion, an oversized task or lack of routine. Name the actual barrier before prescribing discipline. Reduce the target, switch temporarily to questions or treatment prose, or rest when fatigue is the honest cause.", "Rejection is information about fit, timing and execution, not a complete verdict on the writer. Protect motivation through a repeatable process, peer support and multiple sources of meaning beyond one submission."], points: ["Define the next physical writing action.", "Separate identity from the current draft.", "Schedule recovery as part of sustained work.", "Track submissions and feedback without surrendering the project to them."] },
      { heading: "Technical, research and legal awareness", paragraphs: ["Continuity errors involve time, knowledge, injuries, props, geography, wardrobe or relationship state. Use a timeline and story bible. Research should identify sources and areas where expert review is needed.", "Copyright, privacy, defamation, trademarks, life rights and contractual obligations can affect a project. Educational guidance is not legal advice; seek qualified advice when real people, protected material, confidential information or commercial production creates meaningful risk."], points: ["Document sources and permissions.", "Do not assume an internet image, song or text is free to use.", "Distinguish inspiration, fact and protected expression.", "Flag legal questions early enough to revise." ] }
    ],
    definitions: [{ term: "Escalation", meaning: "A meaningful increase or transformation in pressure, cost, uncertainty or consequence." }, { term: "On-the-nose dialogue", meaning: "Speech that states the exact information or feeling without a believable strategy or subtext." }, { term: "Continuity error", meaning: "An unintended contradiction in established time, space, facts, knowledge or physical conditions." }],
    example: { title: "Diagnose beneath the symptom", text: "Symptom: Block 14 feels slow. Evidence: three scenes repeat that the key is missing. Root cause: no one changes strategy or suspects betrayal. Experiment: the second search falsely implicates an ally; the third forces the protagonist to expose why she needs the key." },
    checklist: ["The problem is stated as an audience experience.", "Exact evidence is identified.", "The likely story layer is named.", "A small revision experiment is chosen.", "Continuity and research consequences are checked.", "Legal questions are flagged for qualified advice."],
    mistakes: ["Fixing pacing by cutting moments the audience needs.", "Adding exposition when the real problem is motive.", "Increasing volume instead of changing cost.", "Treating burnout as laziness.", "Assuming creative intention eliminates legal or representational risk."],
    exercise: "Choose one problem in the active story. Record the audience experience, three pieces of evidence, the probable root cause, two possible experiments and the continuity consequences of each.",
    apply: "Treatment",
    tags: ["challenges", "opening", "ending", "conflict", "exposition", "character", "dialogue", "representation", "writer block", "rejection", "continuity", "legal"]
  },
  {
    id: "industry",
    number: 13,
    path: "Industry",
    title: "The Film Industry",
    duration: "35–45 min",
    overview: "Understand the broad roles of guilds, unions, professional associations, funders, festivals, distributors and production collaborators, while verifying current rules with official sources.",
    objectives: ["Distinguish creative, labour, professional and market organizations.", "Identify when jurisdiction and current agreements matter.", "Prepare a project for professional conversations without treating a directory as strategy."],
    sections: [
      { heading: "A collaborative production system", paragraphs: ["A screenplay may pass through development, financing, packaging, pre-production, production, post-production, sales, distribution and exhibition. Writers interact with producers, directors, performers, department heads, editors, agents, managers, lawyers, funders and distributors at different stages.", "Titles can mean different things across budgets and jurisdictions. Ask what authority, deliverable and decision a person actually holds on the project."], points: ["Development tests and packages the project.", "Production plans and captures the work.", "Post-production shapes picture, sound and effects.", "Sales and distribution connect the film with buyers and audiences."] },
      { heading: "Organizations and jurisdiction", paragraphs: ["Guilds and unions represent labour and negotiate agreements or working conditions. Professional associations may provide standards, education, advocacy or recognition. Academies, institutes, cinematheques and festivals can preserve, develop, celebrate or exhibit screen culture. Funders and tax-credit bodies support qualifying work under specific rules.", "Organizations such as the WGA, DGA, SAG-AFTRA, IATSE, PGA, AMPAS, BFI, BAFTA and comparable Canadian and international bodies have different mandates. Eligibility, rates, credits and agreements change. PlotPickle should teach the categories and questions, then direct users to current official information rather than freezing live rules into software."], points: ["Which country, province/state and agreement govern the work?", "Is the body a union, guild, association, funder, regulator, academy or exhibitor?", "Does membership apply to the person, company or production?", "Which current official document controls rates, credit or eligibility?"] },
      { heading: "Professional preparation", paragraphs: ["Before a conversation, know the project's title, format, genre, audience, status, rights position and requested next step. Keep a clean screenplay export, concise pitch, contact information and truthful statement of attachments or financing.", "Do not imply representation, membership, rights or commitments that do not exist. Keep written records of submissions and agreements, and obtain professional legal or business advice for contracts and rights decisions."] }
    ],
    definitions: [{ term: "Guild or union", meaning: "An organization representing workers or creators, often through collective agreements and working standards." }, { term: "Packaging", meaning: "Assembling elements such as script, producer, director, cast, financing or representation to advance a project." }, { term: "Chain of title", meaning: "Documentation showing how the rights required for a production are owned or controlled." }],
    example: { title: "A useful industry question", text: "Instead of asking whether a screenplay is 'WGA approved,' ask whether the hiring company is signatory, which agreement and jurisdiction apply, and which official current schedule governs compensation and credit." },
    checklist: ["Project status and requested next step are clear.", "Rights claims are accurate.", "The relevant jurisdiction is known.", "Current rules are verified through official sources.", "Submissions and agreements are documented.", "Professional advice is sought for material contracts."],
    mistakes: ["Treating every organization as a regulator.", "Relying on old rates, eligibility rules or contact lists.", "Claiming attachments or rights prematurely.", "Sending the same material without regard to role or request."],
    exercise: "Create a one-page professional readiness sheet for the active project: status, rights, format, audience, attachments, jurisdiction questions, five likely collaborators and the exact next action requested.",
    apply: "Treatment",
    tags: ["industry", "guild", "union", "producer", "director", "actor", "funding", "festival", "distribution", "rights", "chain of title"]
  },
  {
    id: "responsible-ai",
    number: 14,
    path: "Responsible AI",
    title: "Responsible AI-Assisted Writing",
    duration: "40–55 min",
    overview: "Use optional AI as a bounded assistant for questions, alternatives, critique and visuals while protecting privacy, authorship, cultural care, continuity and human approval.",
    objectives: ["Choose AI tasks that support rather than replace creative responsibility.", "Build prompts from bounded project context.", "Review outputs for accuracy, bias, originality, consent and continuity."],
    sections: [
      { heading: "Define the job before the prompt", paragraphs: ["AI is most useful when the writer names the exact task: generate five obstacles that obey established world rules, compare two scene objectives, identify repeated exposition or translate an approved character profile into a storyboard prompt. A request to 'make it better' has no shared definition of success.", "Keep authorship decisions human-led. An output is a proposal, not project truth. PlotPickle should insert or save nothing creative until the user reviews and approves it."], points: ["State the role, task and intended audience.", "Provide only the relevant project context.", "List constraints and protected facts.", "Request alternatives or questions when certainty would be false.", "Define how the response will be evaluated."] },
      { heading: "Privacy, rights and provenance", paragraphs: ["Do not include secrets, unnecessary personal information, confidential drafts or third-party material in an external service without understanding its terms and having authority to do so. Keep API keys separate from project data and never place them in prompts, exports or source control.", "Record where generated assets came from, the prompt or settings used and which human approved the result. Do not request imitation of a living artist or use a person's likeness or private material without appropriate rights and consent."], points: ["Minimize shared context.", "Separate connection credentials from creative files.", "Preserve source and generation records.", "Verify licences and permissions for reference material."] },
      { heading: "Bias, culture and human review", paragraphs: ["Generated suggestions can reproduce stereotypes, erase cultural differences or present invented claims as fact. Review whose perspective is treated as normal, who has agency, which traits are associated with harm and whether a community has been flattened into aesthetic decoration.", "Research and informed human readers remain important. AI cannot grant authenticity, consent or permission. It can help surface questions, but the writer remains responsible for choices and consequences."], points: ["Check factual claims against reliable sources.", "Inspect patterns across all characters, not only one response.", "Seek lived-experience or expert review when the stakes warrant it.", "Revise harmful assumptions rather than masking them with softer language."] },
      { heading: "Continuity and approval", paragraphs: ["A strong AI workflow sends a small context pack containing the active Block, mini-block, relevant characters, location, visual language and continuity locks. The writer compares the result with canonical project data before accepting it.", "Maintain an approval boundary: generated, reviewed, revised, approved and canonical are different states. Optional AI must never prevent manual writing, copying a prompt to another provider or working with no AI at all."] }
    ],
    definitions: [{ term: "Context pack", meaning: "A bounded selection of project information relevant to one AI task." }, { term: "Provenance", meaning: "A record of an asset's source, generation process, edits and approval." }, { term: "Human review", meaning: "Deliberate evaluation and responsibility by a person before an output affects the work." }],
    example: { title: "Bounded storyboard request", text: "Task: propose three landscape compositions for Block 8.2. Locks: Mara's approved coat and scar; winter dawn; no new characters. Purpose: show that the ally has become a threat without revealing the weapon. Return composition, lens feel, lighting and continuity risks." },
    checklist: ["The task and success criteria are specific.", "Only necessary context is shared.", "Rights and consent are considered.", "Facts and cultural assumptions are reviewed.", "Continuity locks are checked.", "Nothing becomes canonical without approval.", "A no-AI route remains available."],
    mistakes: ["Sharing an entire private project for a small task.", "Treating fluent output as factual or original by default.", "Using AI to imitate a living creator.", "Accepting a visual that breaks character continuity.", "Hiding AI use where disclosure is required or appropriate."],
    exercise: "Choose one current story task. Write a bounded prompt with goal, context, constraints, approval criteria and privacy exclusions. Then create a seven-point human-review checklist before using any result.",
    apply: "Treatment",
    tags: ["ai", "privacy", "plagiarism", "bias", "culture", "human review", "prompt", "provenance", "continuity", "approval"]
  }
];

export const learningPaths: ("All" | LearningPath)[] = ["All", "Foundations", "Development", "Craft", "Drafting", "Industry", "Responsible AI"];

export function moduleSearchText(module: LearningModule) {
  return [module.title, module.path, module.overview, ...module.objectives, ...module.tags, ...module.sections.flatMap((section) => [section.heading, ...section.paragraphs, ...(section.points ?? [])]), ...module.definitions.flatMap((item) => [item.term, item.meaning]), module.example.title, module.example.text, ...module.checklist, ...module.mistakes, module.exercise].join(" ").toLowerCase();
}
