import type { CurriculumLesson } from "../../core/contracts/curriculum";

type TeachingSection = CurriculumLesson["sections"][number];
type Definition = CurriculumLesson["definitions"][number];

export type FoundationLessonMaterial = {
  readonly sections: readonly TeachingSection[];
  readonly definitions: readonly Definition[];
  readonly storyOutputs: readonly string[];
  readonly exercise?: string;
};

export const FOUNDATION_SEQUENCE = [
  "The Anatomy of a Screenplay",
  "The Screenwriting Essentials Roadmap",
  "Story Essentials: Theme, Plot, Character and Stakes",
  "The Pitch",
  "Loglines That Carry the Movie",
  "Crafting and Testing Loglines",
  "Why PlotPickle Works in Layers",
  "Screenplay Essentials: Structure, Dialogue and Visuals",
  "Pacing and Tone: Storytelling Dynamics",
  "Pitch Components and Project Positioning",
  "Build the Story Experience",
] as const;

export type FoundationLessonTitle = (typeof FOUNDATION_SEQUENCE)[number];

const courseMap = FOUNDATION_SEQUENCE.map((title, index) => `${String(index + 1).padStart(2, "0")} — ${title}`);

export const FOUNDATION_LESSON_MATERIAL: Readonly<Record<FoundationLessonTitle, FoundationLessonMaterial>> = {
  "The Anatomy of a Screenplay": {
    sections: [
      {
        heading: "Welcome to Foundations",
        paragraphs: [
          "Foundations teaches you how the major parts of a screenplay work together before PlotPickle asks you to plan scenes or pages. You do not need a finished idea. You need a story possibility you are willing to test. Across eleven lessons you will turn that possibility into a Foundations Brief: a compact, revisable statement of the protagonist, dramatic pursuit, opposition, stakes, theme, audience promise, tone and ending proof.",
          "Read the lessons in order on your first pass. Each lesson produces a small piece of the brief, and each later lesson tests earlier answers. A weak answer is not failure; it is useful evidence about what the story still needs. Keep uncertain decisions visible instead of disguising them with confident language.",
        ],
        points: courseMap,
      },
      {
        heading: "A screenplay is a connected story system",
        paragraphs: [
          "Structure, character, dialogue, theme, world, pacing, visual storytelling and symbolism are separate study lenses, but an audience experiences them at the same time. When a character enters a locked emergency ward, the location establishes a world rule, the locked door creates structural pressure, the character's response reveals strategy, a line of dialogue changes a relationship, and an alarm can become both pacing device and recurring motif.",
          "Thinking in systems prevents a common beginner problem: solving one category while damaging another. A spectacular location is not useful if it never affects choice. A theme is not dramatic if the plot never forces anyone to choose between credible answers. A character biography is not yet characterization until the audience can infer it from behaviour, relationships and consequence.",
        ],
      },
      {
        heading: "The seven essential craft lenses",
        paragraphs: [
          "Use these lenses as questions, not as boxes to fill. Structure asks how pressure, choice and consequence are arranged through time. Dialogue asks what each speaker is trying to obtain, conceal or change. Character asks whose choices organize the experience and why those choices become costly. Theme asks which human question is being tested. World asks which rules and conditions create options or obstacles. Storytelling dynamics asks how pace and tone shape attention. Symbolic technique asks how repeated images, actions or sounds accumulate meaning.",
        ],
        points: [
          "Structure — What changes, why must the next movement happen, and which options disappear?",
          "Dialogue — What does each person want from the exchange, and what remains unsaid?",
          "Character — What strategy does the protagonist use, and what does that strategy cost?",
          "Theme — Which credible answers collide through choices and consequences?",
          "World — Which physical, social or institutional rules put pressure on the story?",
          "Pacing and tone — What should the audience anticipate, feel and have time to process?",
          "Visual and symbolic technique — What can the audience see or hear, and how does its meaning change?",
        ],
      },
      {
        heading: "Causality is the thread that holds the system together",
        paragraphs: [
          "A screenplay is more than a series of interesting moments. One action changes the conditions for the next. The protagonist chooses because of pressure; the choice produces a consequence; the consequence creates a harder problem or a more specific commitment. This cause-and-effect chain lets character and plot become the same movement rather than parallel tracks.",
          "When reviewing an idea, repeatedly ask three questions: What changed? Who caused or answered that change? What becomes necessary or impossible now? If a scene can be removed without altering later choices, it may be atmospheric material rather than an essential link in the story.",
        ],
      },
      {
        heading: "One example through all eleven lessons",
        paragraphs: [
          "The course will repeatedly use Mara, a cautious paramedic who hears a murder victim's final thought naming a respected police chief. She must prove the chief is a killer before her new ability exposes a crime she buried years ago. The example is deliberately incomplete at first. Each lesson adds pressure, tests an assumption or changes how the same story is expressed.",
          "In one interrogation scene, Mara needs access to sealed evidence. The chief offers access if she publicly discredits the victim. Structure turns because the offer closes an easy path. Character appears in Mara's instinct to protect herself. Dialogue carries threat through polite language. The police archive makes institutional power visible. A failing fluorescent light can create pace and later return as a motif. One scene is doing several jobs, but every job supports the same conflict.",
        ],
      },
      {
        heading: "How to work through Foundations",
        paragraphs: [
          "After each lesson, complete the exercise with your current best answer. Save the output beside the previous work. Do not polish one sentence for hours while the rest of the story remains unknown. At the end of the module you will review the pieces together, find contradictions and decide which claims the ending can actually prove.",
          "Next, the Roadmap lesson shows how to choose a craft lens from the problem you observe. Carry forward one story possibility and a short list of the craft areas you already suspect may need attention.",
        ],
      },
    ],
    definitions: [
      { term: "Story system", meaning: "The connected set of character, structure, world, theme, dialogue and audience-experience choices that produce one causal story." },
      { term: "Causality", meaning: "The relationship in which an action or event changes the conditions and produces a later response or consequence." },
      { term: "Screen evidence", meaning: "Visible, audible or performable material from which an audience can infer story meaning." },
      { term: "Craft lens", meaning: "A focused way of examining the same story evidence, such as structure, character, theme or pacing." },
    ],
    storyOutputs: [
      "A one-paragraph description of the story possibility you will test through Foundations.",
      "The two or three craft systems that currently feel most important or uncertain.",
      "One scene idea annotated for structure, character, world, theme and audience experience.",
    ],
  },
  "The Screenwriting Essentials Roadmap": {
    sections: [
      {
        heading: "Why this lesson follows the Anatomy",
        paragraphs: [
          "You now have names for the major screenplay systems. The Roadmap teaches you how to use those names without turning the curriculum into a rigid checklist. A beginner does not need to master every craft concept before writing. The practical skill is learning to observe a story problem, identify the most likely cause and choose the smallest useful next study or writing action.",
          "A roadmap is not a required drafting order. It is a way to locate yourself. You may discover character while drafting dialogue, revise the premise after testing the ending, or return to world rules when a scene lacks pressure. Foundations gives you a shared source of truth so those discoveries revise one story rather than creating disconnected versions.",
        ],
      },
      {
        heading: "Move from promise to proof",
        paragraphs: [
          "The course moves through four broad questions. First, what experience does the story promise? Second, what human and dramatic engine can sustain that promise? Third, how will the screenplay make the engine visible and audible? Fourth, what ending choice or consequence proves that the story delivered what it promised?",
          "Early answers are hypotheses. A logline may claim that family loyalty is at stake, but later scenes must show relationships changing because of the pursuit. A tone statement may promise dread, but pacing, consequence, image and dialogue must create that dread. The roadmap connects a claim to the evidence that could confirm or contradict it.",
        ],
        points: [
          "Promise — the audience, genre, emotional and dramatic experience being offered.",
          "Engine — protagonist, objective, opposition, urgency, stakes and repeatable conflict.",
          "Expression — structure, scene change, dialogue action, visual evidence, pacing and tone.",
          "Proof — the climax, ending consequence and final emotional after-effect.",
        ],
      },
      {
        heading: "Diagnose the problem before choosing the tool",
        paragraphs: [
          "A symptom is what you notice: the midpoint feels flat, dialogue feels expositional, the antagonist seems weak or the ending feels unearned. A root cause explains why. The midpoint may feel flat because the protagonist repeats the same tactic, the opposition has no leverage, or the relationship story stops affecting the external pursuit. Cutting pages would treat the symptom without necessarily changing the cause.",
          "Gather evidence before deciding. Name the scene, turn, line, choice or missing consequence that produced your reaction. Then use the craft lens most likely to explain it. If two lenses point to the same evidence, the story systems are interacting—as they usually are.",
        ],
      },
      {
        heading: "A beginner's dependency path",
        paragraphs: [
          "Some questions become easier after other questions have working answers. You can test a logline more clearly after naming the protagonist and pursuit. You can judge pacing more clearly after identifying what changes in each movement. You can test theme more clearly after the protagonist faces credible competing values. These are helpful dependencies, not locked prerequisites.",
        ],
        points: [
          "If the story is vague, begin with protagonist, disruption, objective, opposition and stakes.",
          "If the story has events but no momentum, inspect cause, consequence, tactics and turns.",
          "If the story feels emotionally thin, inspect relationships, belief, cost and the ending choice.",
          "If scenes explain rather than dramatize, inspect objectives, subtext and screen evidence.",
          "If the experience feels flat or inconsistent, inspect pacing contrast, tone and consequence.",
          "If revision keeps spreading, return to the Foundations Brief and decide which claim changed.",
        ],
      },
      {
        heading: "Worked diagnosis: Mara's flat midpoint",
        paragraphs: [
          "Suppose Mara spends the first half collecting evidence and then collects more evidence at the midpoint. The symptom is repetition. A structure lens finds no change in available action. A character lens finds that Mara has not risked her protective strategy. A relationship lens finds that no ally has gained leverage over her. A theme lens finds that secrecy and truth have not yet become an unavoidable choice.",
          "A bounded revision experiment could let the chief discover Mara's ability and offer to hide her old crime in exchange for silence. The external investigation changes, the relationship becomes coercive, the theme gains competing answers, and the stakes turn personal. One causal change improves several systems because the diagnosis identified the shared root.",
        ],
      },
      {
        heading: "Build a practical watchlist",
        paragraphs: [
          "Record the three questions most likely to cause expensive rework. For each, name the evidence that would make you more confident. Do not write 'character needs work.' Write 'Mara's fear of exposure must visibly change at least two investigation choices before the climax.' Specific watchlist items can be tested; vague concerns cannot.",
          "Next, Story Essentials gives you the core language for theme, plot, character and stakes. Carry forward your story possibility, its most visible symptom and one suspected root cause.",
        ],
      },
    ],
    definitions: [
      { term: "Symptom", meaning: "The audience or writer experience that signals a possible craft problem, such as a flat midpoint or repetitive scene." },
      { term: "Root cause", meaning: "The underlying story condition producing one or more visible symptoms." },
      { term: "Story evidence", meaning: "A specific event, choice, line, image, relationship change or consequence that supports a craft judgment." },
      { term: "Revision experiment", meaning: "A bounded change used to test a diagnosis without declaring the entire story solved." },
    ],
    storyOutputs: [
      "A promise-to-proof map for the active story.",
      "Three prioritized craft risks written as testable questions.",
      "One bounded revision or discovery experiment for the highest-risk question.",
    ],
  },
  "Story Essentials: Theme, Plot, Character and Stakes": {
    sections: [
      {
        heading: "Why this lesson follows the Roadmap",
        paragraphs: [
          "The Roadmap showed how to diagnose a story. This lesson supplies the central engine you will diagnose: a person pursues something under pressure, competing beliefs shape the available choices, consequences escalate and the meaning of success or failure changes. Theme, plot, character and stakes are not four separate worksheets. They become useful when each one changes the others.",
        ],
      },
      {
        heading: "Turn theme into a question with credible answers",
        paragraphs: [
          "Theme is not merely an underlying message, main idea or slogan pasted onto the plot. Start with a human question that reasonable people could answer differently. If the question is 'Is safety worth surrendering the truth?', secrecy may protect vulnerable people while truth may stop continuing harm. The story becomes dramatic when both answers have real benefits and costs.",
          "The protagonist, opposition and important relationships can embody different strategies rather than delivering speeches about the subject. Plot then tests those strategies. The ending does not need to provide a universal moral, but it should show what this particular character's final choice causes.",
        ],
        points: [
          "Topic — the broad area, such as loyalty, grief, justice or ambition.",
          "Thematic question — the contestable human question the story keeps testing.",
          "Working answer — the value or strategy the protagonist currently trusts.",
          "Competing answer — a credible alternative embodied by another force or relationship.",
          "Ending proof — the final choice and consequence that give the question its last frame.",
        ],
      },
      {
        heading: "Build character from strategy, not biography alone",
        paragraphs: [
          "A protagonist needs a conscious want: the visible result they pursue. They may also need a truth, capacity or relationship they do not yet know how to accept. Between want and need sits a protective strategy—a way of surviving that once helped but now creates cost. Backstory matters when it explains present behaviour; it is not a substitute for present choice.",
          "Mara consciously wants to prove the chief is a murderer. Her deeper need is to accept responsibility without treating exposure as annihilation. Her protective strategy is control through secrecy. That strategy makes her competent under pressure, but it also causes her to withhold information, manipulate an ally and reject help. Strength and flaw can be two consequences of the same adaptation.",
        ],
      },
      {
        heading: "Unify external, internal and relationship stories",
        paragraphs: [
          "The external story supplies visible movement: Mara investigates the chief. The internal story tracks how secrecy shapes her choices. The relationship story gives change a human cost: a detective ally can reward her honesty, expose her deception or become endangered by it. These lines should collide rather than run beside one another.",
          "A useful turn changes more than one line. When Mara lies to obtain evidence, she advances the investigation, reinforces her old strategy and damages trust. Later the damaged relationship can remove an option she needs. The screenplay feels unified because emotional and external consequences share causes.",
        ],
      },
      {
        heading: "Plot is escalating action and reaction",
        paragraphs: [
          "Plot is not everything that happens. It is the causal pattern of attempts, resistance, choices and consequences that changes what can happen next. Escalation is not merely a larger explosion or a louder confrontation. It can mean stronger leverage, narrower time, more personal exposure, a changed objective, irreversible commitment or a truth that makes the old plan impossible.",
          "A plot turn earns its place when it forces reassessment. Mara first treats the final thought as a clue. When the chief proves he knows about her hidden crime, the investigation becomes a negotiation over identity and justice. The same objective now carries different meaning, tactics and risk.",
        ],
        points: [
          "Action — a character attempts to change the situation.",
          "Resistance — another force protects an incompatible result.",
          "Turn — new information, refusal, consequence or commitment invalidates the opening tactic.",
          "Reaction — the character interprets the turn and chooses a new action.",
          "Handoff — the result makes the next movement necessary.",
        ],
      },
      {
        heading: "Let stakes transform",
        paragraphs: [
          "Stakes answer why the outcome matters, to whom and in what way. External stakes may involve lives, evidence or public safety. Personal stakes involve identity, dignity, guilt or belonging. Relationship stakes involve trust, dependence or loss. The strongest escalation often transforms the kind of loss rather than simply increasing its size.",
          "At first Mara risks losing access to evidence. Later she risks an ally's trust. Later still she must choose whether to confess her own crime in order to stop the chief. Urgency comes from the shrinking opportunity to act, not from attaching an arbitrary clock to every story.",
        ],
      },
      {
        heading: "Assemble the story engine",
        paragraphs: [
          "Write one connected paragraph that names the protagonist's want, protective strategy, opposition, escalating consequences, thematic question and likely final choice. Then test every clause against an action the audience could witness. Replace abstract virtues and flaws with behaviour.",
          "Next, The Pitch turns this engine into several useful resolutions. Carry forward the paragraph, the thematic question and the three kinds of stakes that the story must make visible.",
        ],
      },
    ],
    definitions: [
      { term: "Theme", meaning: "A live human question or contested proposition tested through choices and consequences." },
      { term: "Anti-theme", meaning: "A credible competing answer, worldview or survival strategy—not simply an evil opposite." },
      { term: "Protective strategy", meaning: "A learned way of surviving or controlling risk that provides strength while also creating present cost." },
      { term: "External objective", meaning: "The visible result the protagonist actively tries to obtain, stop, prove, escape or protect." },
      { term: "Stakes transformation", meaning: "A change in what failure costs or what success requires as the character learns and commits." },
    ],
    storyOutputs: [
      "A thematic question with at least two credible answers.",
      "The protagonist's conscious want, deeper need or truth, and protective strategy.",
      "A causal engine connecting external, internal and relationship stakes to the final choice.",
    ],
  },
  "The Pitch": {
    sections: [
      {
        heading: "Why this lesson follows Story Essentials",
        paragraphs: [
          "You now have the parts of a story engine. A pitch tests whether those parts form one understandable dramatic experience. It is not advertising copy and it is not a miniature screenplay. It is the smallest model of the movie that still exposes who acts, what changes, what they pursue, what resists them and why failure matters.",
        ],
      },
      {
        heading: "The pitch is the first model of the movie",
        paragraphs: [
          "A reader should be able to identify the protagonist, disruption, active objective, opposition and cost of failure. If you can describe only the setup, the middle may not yet have a repeatable source of conflict. If the protagonist disappears into lore or events, the story may not be organized around choice. If the stakes are generic, the danger may be clear without feeling personal.",
          "Use plain verbs and concrete pressures. 'Mara confronts her past' does not tell us what she does. 'Mara must prove a police chief murdered his witness before he exposes the crime she buried' suggests investigation, counteraction, reversals and an ending choice.",
        ],
        points: [
          "Protagonist — the person whose choices organize the audience's experience.",
          "Disruption — the change that makes the old normal impossible or unstable.",
          "Objective — the visible result the protagonist must pursue.",
          "Opposition — the person, system, environment, belief or relationship able to stop progress.",
          "Stakes — the specific external, personal and relational cost of failure.",
        ],
      },
      {
        heading: "Premise, logline, short pitch and synopsis do different jobs",
        paragraphs: [
          "A premise names the central dramatic possibility. A development logline exposes the engine in one or two sentences. A short pitch adds world, escalation, emotional pressure and tone. A synopsis explains the causal movement of the complete story and normally reveals the ending when an evaluator needs to understand whether the story works.",
          "All four forms should describe the same movie at different resolutions. If the logline centers an investigation, the short pitch centers a romance and the synopsis resolves a mythology problem, the Foundation is unstable. Find the facts that survive every version; those facts are candidates for the canonical story promise.",
        ],
      },
      {
        heading: "Choose the resolution before choosing the wording",
        paragraphs: [
          "Begin by naming what the listener is trying to understand. A writer diagnosing the middle needs enough causal information to see repeated pursuit and resistance. A collaborator deciding whether to read needs the central experience and a clear sense of the movie. Someone evaluating a complete story may need a synopsis that discloses the resolution. Mystery is useful only when it serves the purpose; withholding the engine from yourself is not intrigue.",
          "Genre, tone and audience belong at this stage as promises, not demographic decoration. Saying 'contained supernatural moral thriller' helps a listener anticipate the kind of pressure, uncertainty and consequence the story will deliver. Later positioning work will add current project and market context. Here, keep attention on the experience made by the story itself.",
        ],
      },
      {
        heading: "Mara's story at four resolutions",
        paragraphs: [
          "Premise: A cautious paramedic who hears a victim's final thought must decide whether exposing a powerful murderer is worth exposing herself. Development logline: After a murder victim's final thought names a respected police chief, a risk-averse paramedic must prove he is the killer before her new ability reveals the crime she buried years ago.",
          "A short pitch would add the institutional world, the chief's countermoves, the detective relationship and the claustrophobic moral-thriller tone. A synopsis would trace the causal path through the ending: Mara publicly confesses enough of her past to make the chief's evidence admissible, stopping him but accepting a consequence she spent the movie avoiding.",
        ],
      },
      {
        heading: "Test the promise against the middle and ending",
        paragraphs: [
          "Ask whether the objective can generate multiple tactics and whether opposition can adapt. Then ask what the climax forces the protagonist to do that the opening version of the character would avoid. A pitch that promises transformation should contain the pressure capable of producing it.",
          "Do not hide uncertainty with words such as unique, epic, compelling or cinematic. Mark the uncertain clause. The logline you write here is a provisional baseline, not a polished submission sentence: Lessons 5 and 6 will teach you how to deconstruct, test and deliberately revise it without allowing a formula to invent a different movie.",
        ],
      },
      {
        heading: "Speak from the causal path, not memorized sales copy",
        paragraphs: [
          "A useful spoken pitch is understood rather than recited. Know the engine, the decisive escalation, the emotional relationship and the ending proof well enough to explain them in natural language. If a question exposes an unknown, say what is undecided and what evidence will settle it. False certainty makes later revision feel like contradiction; transparent working choices invite the right kind of collaboration.",
          "Listen for the listener's paraphrase. If they can name the protagonist, pursuit, opposition, personal cost and expected experience, the model is carrying its load. If they repeat only the supernatural hook or the setting, return to the engine before adding more presentation polish.",
        ],
      },
    ],
    definitions: [
      { term: "Premise", meaning: "The central dramatic possibility or condition from which the story can grow." },
      { term: "Story promise", meaning: "The dramatic and emotional experience the project commits to delivering." },
      { term: "Dramatic engine", meaning: "The combination of pursuit, resistance, stakes and changing tactics capable of generating the story's middle." },
      { term: "Synopsis", meaning: "A concise causal account of the complete story, including the ending when evaluation requires it." },
    ],
    storyOutputs: [
      "A plain-language premise.",
      "A named protagonist, disruption, objective, opposition and cost of failure.",
      "A premise, development logline, short pitch and causal synopsis that describe the same story.",
    ],
    exercise: "Write the story in four resolutions: a one-sentence premise, a rough development logline of about 35 words, a 150-word short pitch and a one-paragraph causal synopsis. Treat the logline as a provisional baseline that Lessons 5 and 6 will revise. Underline the story facts that survive all four versions and flag any contradiction for revision.",
  },
  "Loglines That Carry the Movie": {
    sections: [
      {
        heading: "Why this lesson follows The Pitch",
        paragraphs: [
          "The Pitch gave you a complete working model. The logline now tests whether its central engine remains understandable when almost everything else is removed. This is a development tool before it is a marketing sentence. It should help you see what the protagonist repeatedly does, how opposition can answer and what escalating failure costs.",
        ],
      },
      {
        heading: "A development logline must carry the middle",
        paragraphs: [
          "An unusual setup can attract attention without producing a movie. 'A paramedic hears the dead' is a situation. 'A paramedic must prove a police chief is a murderer before he exposes her buried crime' implies continuing action, adaptive opposition and costly choices. The objective gives the middle a verb.",
          "Test the verb across several possible scenes. Can the protagonist attempt it in different ways? Can the opposing force block, tempt, mislead or raise the cost? Does each failure produce a more specific next action? If not, the sentence may describe Act One while leaving the rest of the screenplay unsupported.",
        ],
      },
      {
        heading: "Build from five essential pressures",
        paragraphs: [
          "Most useful development loglines communicate five pressures even when their grammar varies: a specific protagonist, a disruptive situation, an active objective, meaningful opposition and stakes. Distinctive world rules and tone belong when they change how the conflict works, not because every sentence must mention setting and genre.",
        ],
        points: [
          "Specific protagonist — enough identity or contradiction to make the pursuit feel particular.",
          "Disruption — the event or discovery that destabilizes the old condition.",
          "Active objective — a result the audience can recognize as progress or failure.",
          "Opposition — a force with leverage and an incompatible result to protect.",
          "Stakes — what this person, relationship or world loses if the pursuit fails.",
        ],
      },
      {
        heading: "Separate sentence evidence from private knowledge",
        paragraphs: [
          "Hide your notes and read only the sentence. Do not award it clarity because you know the screenplay. Mark the words that identify protagonist, pursuit, resistance and stakes. If a necessary element exists only in your explanation afterward, revise the sentence or decide that the element is deliberately omitted for this version.",
          "Deliberate omission is not vagueness. A development logline may reveal more than a public teaser because its job is diagnosis. The key is to know what the reader can infer and what you intentionally withheld.",
        ],
        points: [
          "Sentence-supported — the words themselves communicate the fact.",
          "Project-only — the fact exists in the Foundation but this sentence does not communicate it.",
          "Intentional omission — the purpose of this version justifies withholding the fact.",
          "Unclear — neither the sentence nor the current project evidence supports a confident answer.",
        ],
      },
      {
        heading: "Use specificity and active language",
        paragraphs: [
          "Specificity replaces praise with evidence. 'A troubled woman faces danger' gives no useful picture. 'A risk-averse paramedic investigates a decorated police chief' supplies role, contradiction and pressure. Active verbs such as prove, rescue, expose, escape, protect or steal make success and resistance easier to imagine.",
          "Avoid stacking clauses until the sentence becomes a synopsis. One clear engine is more valuable than naming every subplot. If removing a clause changes the movie, keep it; if it merely demonstrates how much you know, move it to the short pitch.",
        ],
      },
      {
        heading: "Separate required clarity from optional distinction",
        paragraphs: [
          "The central engine is required for a development logline because it lets the writer test the movie. Irony, urgency, a signature image, genre language, a world rule or a relationship contradiction are optional enhancements. Include one when it sharpens the causal pressure; leave it out when it competes with the objective or requires a second sentence of explanation.",
          "This distinction prevents a detector or template from treating every absence as failure. A sentence can be clear without announcing tone, and a public version can be intriguing while deliberately withholding the culprit. The writer should be able to explain the choice rather than accidentally omitting information the intended reader needs.",
        ],
      },
      {
        heading: "Stress-test Mara's logline",
        paragraphs: [
          "Protagonist: a risk-averse paramedic. Disruption: a victim's final thought names the chief. Objective: prove he is the killer. Opposition: the chief has institutional power and knowledge of Mara's past. Stakes: he can continue killing and expose the crime she buried. Tone and world pressure emerge through the profession, institution and supernatural rule.",
          "Next, Crafting and Testing Loglines separates the development sentence from pitch and public variants. Carry forward one primary logline plus a note explaining what important information it deliberately leaves out.",
        ],
      },
      {
        heading: "Name the primary sentence and its synchronization boundary",
        paragraphs: [
          "The primary development logline is the approved diagnostic statement for the current story. It is not a command to make the tagline, teaser, pitch-deck headline and every one-sentence field identical. Those artifacts can serve different readers as long as they remain compatible with the same canon.",
          "Record which project fields should update when the primary changes. Preserve the prior wording in revision history, and keep a candidate separate until the writer deliberately approves it. Lesson 6 will build and compare the purpose variants; this lesson leaves you with the stable sentence they must not contradict.",
        ],
      },
    ],
    definitions: [
      { term: "Development logline", meaning: "A diagnostic one- or two-sentence statement that exposes the story engine for the writer and collaborators." },
      { term: "Active objective", meaning: "A result expressed through action whose progress, resistance and failure can be dramatized." },
      { term: "Opposition", meaning: "A person, system, environment, relationship or belief protecting a result incompatible with the protagonist's objective." },
      { term: "Deliberate omission", meaning: "Information consciously withheld because it is not required for a particular logline's purpose." },
    ],
    storyOutputs: [
      "One primary development logline that represents the movie being built.",
      "A visible protagonist, objective, opposition and stakes in the sentence itself.",
      "A note identifying important Foundation information deliberately omitted from the logline.",
    ],
    exercise: "Write the development logline, then hide every other project note and deconstruct only the sentence. Mark protagonist, disruption, objective, opposition, stakes, distinctive world pressure and tone. Rewrite anything you were supplying from memory rather than from the words on the page.",
  },
  "Crafting and Testing Loglines": {
    sections: [
      {
        heading: "Why this lesson follows the development logline",
        paragraphs: [
          "You now have a sentence designed to reveal the story engine. This lesson teaches deliberate variation: changing emphasis for a defined reader without changing canon. It also turns familiar logline advice into tests rather than commandments.",
        ],
      },
      {
        heading: "Rules are tests, not commandments",
        paragraphs: [
          "Logline advice often arrives as absolutes: use a fixed word count, never use a name, include irony, always state the setting, signal genre, avoid spoilers. Each may help in a particular context, but none should distort the story. A 35-word target encourages discipline; it does not make the thirty-sixth word wrong.",
          "Use a rule to ask a question. Does the name consume attention without adding identity? Does the setting create conflict or merely decorate? Does revealing the antagonist clarify the engine? Does the sentence sound like the intended experience? Keep the evidence that makes the movie understandable.",
        ],
      },
      {
        heading: "A repeatable testing sequence",
        paragraphs: [
          "Work in passes so you know what each revision is fixing. Do not shorten, add tone and change the protagonist at the same time. Read each version aloud and show it to someone who does not know the project. Ask what movie they expect—not whether they like the sentence.",
        ],
        points: [
          "1. State the purpose and reader for this version.",
          "2. Mark protagonist, disruption, objective, opposition and stakes.",
          "3. Test whether the objective can generate the middle.",
          "4. Replace abstract nouns and praise with specific roles, actions and consequences.",
          "5. Remove names or lore that require explanation without adding pressure.",
          "6. Check whether genre and tone can be inferred from the chosen evidence.",
          "7. Read for causal grammar: after this change, this person must act against this force.",
          "8. Compare the sentence with the intended ending and eliminate false promises.",
          "9. Ask a new reader to paraphrase protagonist, pursuit, resistance and stakes.",
          "10. Record what the version deliberately includes, emphasizes and withholds.",
        ],
      },
      {
        heading: "One project can need several truthful versions",
        paragraphs: [
          "A development logline exposes the engine so the writer can diagnose it. A pitch-deck logline may foreground hook, tone and audience. A public teaser may withhold a late reveal. These are not competing stories if every version remains compatible with the same canonical events and ending.",
          "For Mara, the development version names her buried crime because it creates the central leverage. A public version might say 'before the killer turns her darkest secret against her.' That version withholds the nature of the secret but preserves its dramatic function. A version claiming that Mara races to save her family would be false unless that pursuit actually organizes the movie.",
        ],
      },
      {
        heading: "Compare sentence shapes without surrendering the engine",
        paragraphs: [
          "A sentence shape changes emphasis; it does not supply missing story logic. Try more than one shape when a reader needs a different doorway into the same movie. After every experiment, deconstruct the result and verify that it remains compatible with the approved protagonist, causal pursuit, opposition, stakes and ending.",
        ],
        points: [
          "Causal engine — disruption leads to pursuit, resistance and consequence.",
          "Irony or contradiction — identity and circumstance create productive pressure.",
          "Relationship pressure — incompatible needs threaten a bond that forces contact.",
          "World-rule pressure — an institution, place or rule restricts the available choices.",
          "Mystery or thriller — a discovery forces pursuit of truth before a cost arrives.",
          "Dual protagonist or ensemble — connected objectives collide or converge.",
          "Character first — a protective strategy drives the external pursuit.",
        ],
      },
      {
        heading: "Test hook, irony, tone and world pressure",
        paragraphs: [
          "A hook is the distinctive dramatic invitation, not a random novelty. Irony is a productive contradiction, such as a healer endangered by hearing the dead. Tone comes through diction, consequence and the kind of pressure named. World belongs when its rule changes the pursuit: Mara's ability is relevant because it creates evidence no institution will accept and exposes information she cannot safely know.",
          "Do not cram all four into every version. Add each element, read the cost in clarity, then keep only what performs a necessary job for that reader.",
        ],
      },
      {
        heading: "Use feedback without surrendering the story",
        paragraphs: [
          "When a reader misunderstands the sentence, record exactly what they inferred. Do not immediately adopt their rewrite. Their reaction is evidence about communication; your Foundation determines whether the sentence or the story needs to change. Three readers making the same inference is stronger evidence than one preference.",
          "Keep the reader's paraphrase beside the version they saw. That record helps you distinguish a communication problem from a project problem when you compare candidates and choose a primary sentence.",
        ],
      },
      {
        heading: "Approve a version without erasing the alternatives",
        paragraphs: [
          "Saving a candidate does not silently make it the project's primary logline. Record the version's reader, purpose, sentence shape, evidence and deliberate omissions. When you approve a new primary, preserve the previous wording and decide which downstream fields should synchronize. A useful public teaser can remain beside the development logline without becoming a second canon.",
          "Next, PlotPickle's Layers shows how the stable story promise can be examined at progressively finer resolutions. Carry forward development, pitch and teaser versions plus a record of their different jobs.",
        ],
      },
    ],
    definitions: [
      { term: "Hook", meaning: "The distinctive dramatic invitation that helps a reader imagine why this story and conflict are worth following." },
      { term: "Irony", meaning: "A meaningful contradiction between identity, situation, desire or consequence that creates pressure." },
      { term: "Specificity", meaning: "Concrete identity, action, setting or consequence that communicates story evidence instead of general praise." },
      { term: "Teaser logline", meaning: "A public-facing version that preserves the central promise while deliberately withholding selected reveals." },
    ],
    storyOutputs: [
      "Development, pitch and public-teaser loglines for the same canonical story.",
      "The purpose and intended reader for each version.",
      "Feedback evidence showing what a new reader inferred from the words alone.",
    ],
  },
  "Why PlotPickle Works in Layers": {
    sections: [
      {
        heading: "Why this lesson follows logline testing",
        paragraphs: [
          "The logline gave you a whole-story promise. PlotPickle's layers let you increase detail without losing that promise. Each layer answers a different question about the same causal story; it should not become a separate competing version.",
        ],
      },
      {
        heading: "Different resolutions, one causal story",
        paragraphs: [
          "The concept identifies the dramatic possibility. Acts describe major changes in commitment and available action. Sequences organize sustained pursuits. Blocks make escalation manageable. Scenes turn conditions through playable objectives and opposition. Mini-blocks and beats reveal finer changes. Shots provide visual evidence. Moving closer should reveal how the larger claim happens; moving farther away should reveal why a detail matters.",
        ],
        points: [
          "Whole story — What promise and transformation organize the complete experience?",
          "Act — How do commitment, knowledge, cost or strategy fundamentally change?",
          "Sequence — What sustained objective or problem organizes several movements?",
          "Block — What condition, attempt, resistance and turn create a meaningful unit of escalation?",
          "Scene — Who wants what now, what resists, and what changes by the exit?",
          "Beat or shot — Which action, reaction, image or sound provides observable evidence?",
        ],
      },
      {
        heading: "Use the 24-Block grid as a working resolution, not a timing law",
        paragraphs: [
          "PlotPickle's 24 Blocks offer a repeatable middle distance between a whole-story plan and individual scenes. They help a writer compare structural function, escalation and handoff without requiring twenty-four equal movements, a 120-minute screenplay, five minutes per Block or one scene per Block. A Block may contain several scenes, and a difficult movement may need more space than a simple transition.",
          "The four broad movements are Promise, Progress, Pressure and Payoff. Pressure is PlotPickle's added fourth movement, not a claim that it belonged to the earlier Promise–Progress–Payoff triad. Use the labels to ask how the audience's expectations, pursuit, cost and resolution change. If another structure describes the movie better, preserve the causal functions instead of forcing events into boxes.",
        ],
      },
      {
        heading: "Test alignment above and below every change",
        paragraphs: [
          "When a lower-level idea changes, ask what it changes above it. A new scene that does not alter its Block may be optional texture. A Block turn that cannot be expressed through scenes may still be abstract. A striking shot that contradicts the scene's emotional purpose can weaken the story even if it looks impressive.",
          "Also test downward. If the Foundation says Mara chooses truth over control, identify the Act commitment, the Sequence problem, the Block decision and the visible climax action that prove it. An unsupported high-level claim is an intention, not yet story evidence.",
        ],
      },
      {
        heading: "Use top-down and bottom-up discovery together",
        paragraphs: [
          "Top-down work protects purpose: begin with the promise and decide what each layer must accomplish. Bottom-up discovery respects writing evidence: a scene may reveal that the objective, relationship or theme is different from the plan. Neither direction automatically wins. Compare the discovery with the Foundation, approve a revision deliberately and propagate the consequence.",
        ],
      },
      {
        heading: "Keep canon separate from proposals",
        paragraphs: [
          "Imported interpretation, collaborator feedback and AI output may propose new material, but a proposal is not canonical merely because it appears in a tool. The authorized writer decides what becomes part of the project. Keeping status explicit prevents invisible decisions from accumulating across planning, screenplay and visual development.",
          "When Mara's ally is proposed as the victim's sibling, the idea affects relationship stakes, access to evidence and the ending. Record it as a proposal, test those consequences and approve or reject it before downstream layers treat it as fact.",
        ],
      },
      {
        heading: "Mara from promise to screen evidence",
        paragraphs: [
          "Whole-story claim: Mara must risk truthful accountability to expose institutional violence. Act movement: she moves from secret investigation to public commitment. Sequence objective: obtain the sealed dispatch recording. Block turn: the chief offers the recording in exchange for her public lie. Scene objective: Mara tries to make him reveal where it is. Beat: she stops denying her past. Shot evidence: she places her own sealed disciplinary file beside the victim's recording.",
        ],
      },
      {
        heading: "Carry intention from page to production",
        paragraphs: [
          "The same approved decision may later appear in planning notes, Blocks, screenplay pages, a Storyworld Map, storyboards, production shots, retained assets, an animatic and pitch material. Those artifacts are not identical, but each should be traceable to story evidence and approval history. A visual adaptation may discover a stronger solution; it should propose that change back to canon instead of quietly creating a competing movie.",
          "This traceability is why PlotPickle uses layers. It does not promise automatic filmmaking, require AI or GitHub, or make every artifact public. It gives the writer a way to ask where a decision came from, what it affects and who accepted it.",
          "Next, Screenplay Essentials examines how structure, dialogue and visuals make these layers playable. Carry forward one chain from whole-story claim to a scene and one rule for reviewing downstream changes.",
        ],
      },
    ],
    definitions: [
      { term: "Canon", meaning: "Material explicitly accepted as the current source of truth for the project." },
      { term: "Proposal", meaning: "A possible addition or change that remains non-canonical until an authorized decision accepts it." },
      { term: "Block", meaning: "A manageable unit of story movement organized by a condition, attempt, resistance and meaningful turn." },
      { term: "Beat", meaning: "A small unit of action, reaction, discovery or decision that changes the immediate dramatic condition." },
      { term: "Resolution", meaning: "The level of detail at which the same story is being examined, from whole-story promise to individual evidence." },
    ],
    storyOutputs: [
      "A whole-story statement, major movement statement and repeatable Block-level engine.",
      "A trace from one Foundation claim through Act, Sequence, Block, scene and screen evidence.",
      "A review rule for lower-level discoveries that may change canon.",
    ],
  },
  "Screenplay Essentials: Structure, Dialogue and Visuals": {
    sections: [
      {
        heading: "Why this lesson follows the Layers",
        paragraphs: [
          "Layers showed how a whole-story claim reaches a scene. This lesson examines the scene as screenplay material. Structure creates pressure and change, dialogue carries action through language, and visuals let the audience infer meaning. These are not separate polish passes; they cooperate moment by moment.",
        ],
      },
      {
        heading: "Structure is pressure organized through time",
        paragraphs: [
          "Structure is not the mere presence of an inciting incident, midpoint and climax. Those terms are useful when they name changes in commitment, knowledge, cost or available action. The deeper principle is progressive consequence: each important choice removes easy options and makes the conflict more specific.",
          "Three-act structure is one optional diagnostic map, not a required architecture for every screenplay. A story may use three acts, another named model, PlotPickle's broad movements or a shape discovered from the material. What matters is that pressure, meaningful turns, causality and consequence remain legible; never force a living story into a diagram only to satisfy the diagram.",
          "At scene level, something must become different because the scene happened. The change may be external, relational, informational or internal, but it should affect what can happen next. A scene that only repeats known information can be beautifully written and still stall the story.",
        ],
      },
      {
        heading: "Build a complete scene movement",
        paragraphs: [
          "Enter as late as clarity allows. Identify the scene driver and immediate objective, then give the opposing force an incompatible result to protect. Pressure forces a tactic; resistance makes that tactic insufficient; a discovery, refusal or consequence creates the turn. The exit condition and handoff make the next scene necessary.",
        ],
        points: [
          "Entry condition — what is true and unresolved when the scene begins.",
          "Driver and objective — who is trying to produce which immediate result.",
          "Opposition — what force protects an incompatible result.",
          "Tactic — what the driver does now, not merely what they feel.",
          "Turn — what invalidates the opening tactic or changes understanding.",
          "Exit and handoff — what is now true and what pressure moves forward.",
        ],
      },
      {
        heading: "Dialogue is action under relationship pressure",
        paragraphs: [
          "Characters speak to pursue something: control status, avoid exposure, obtain information, test loyalty, threaten, seduce, deflect or connect. The literal subject may differ from the dramatic action. Subtext is not mysterious hidden poetry; it is the gap between the words spoken and the result being pursued or feared.",
          "Give speakers different information, power and preferred tactics. Let a line change what the other person can safely do. Exposition becomes dramatic when someone needs the information now, another person resists its use and disclosure has consequence.",
        ],
      },
      {
        heading: "Visual writing selects observable evidence",
        paragraphs: [
          "A screenplay cannot simply declare that Mara feels trapped or that trust has broken. Translate the claim into behaviour, spatial distance, object use, interruption, silence, sound or a changed tactic. Selection matters more than exhaustive description. Choose the detail that changes audience understanding.",
          "Camera directions and elaborate imagery are not automatically cinematic. A visual belongs when it carries story work. The chief locking the archive door while speaking gently makes power and threat observable without explaining either one.",
        ],
      },
      {
        heading: "Format the evidence for a reader and production team",
        paragraphs: [
          "A scene heading locates the action in place and time. Action lines present observable behavior in a readable flow. Character cues, dialogue and occasional parentheticals support performance without dictating every inflection. Transitions and shot language are available when the storytelling genuinely depends on them; they are not proof that the writing is cinematic.",
          "Formatting is a communication system. Short, selected action paragraphs can guide attention, but there is no law that every page equals exactly one minute or that every image deserves its own camera instruction. Let layout make objectives, reactions, discoveries and turns easy to follow. Then test whether the scene still creates change when the formatting is stripped of novelty.",
        ],
      },
      {
        heading: "Worked scene: the archive offer",
        paragraphs: [
          "Entry: Mara enters the archive intending to steal a recording. Objective: make the chief leave. Opposition: he intends to recruit her silence. Tactic: she pretends the victim's accusation was delirium. Dialogue action: each person tests how much the other knows while discussing medical reliability. Visual pressure: the chief places Mara's old disciplinary file on top of the recording she wants.",
          "Turn: he offers both files if she publicly discredits the victim. Mara exits without the recording but secretly photographs her own file number. Externally she failed, informationally she gained a lead, relationally the chief now treats her as compromised, and internally she chooses another act of concealment. The next scene must answer what she does with the file number and the ally she has deceived.",
        ],
      },
      {
        heading: "Revise by function and evidence",
        paragraphs: [
          "On revision, first state what must change. Then inspect whether objective, opposition, dialogue tactics and visual evidence all serve that change. Formatting can make a screenplay readable, but correct margins cannot supply conflict. Spectacle can make a moment memorable, but scale cannot replace consequence.",
          "Next, Pacing and Tone asks how the audience experiences these changes over time. Carry forward one complete scene movement, the dialogue action for each speaker and three pieces of observable evidence.",
        ],
      },
    ],
    definitions: [
      { term: "Scene objective", meaning: "The immediate result a scene's driver tries to produce before the scene ends." },
      { term: "Subtext", meaning: "The pressure created by what a character pursues, protects or withholds beneath the literal wording." },
      { term: "Turn", meaning: "A discovery, refusal, reversal or consequence that makes the opening tactic insufficient." },
      { term: "Visual evidence", meaning: "Selected observable action, image, object, space or sound from which the audience can infer meaning." },
      { term: "Handoff", meaning: "The consequence, question, choice or threat that makes the next movement necessary." },
    ],
    storyOutputs: [
      "A rule for what every important scene must change.",
      "A scene map containing entry, objective, opposition, tactic, turn, exit and handoff.",
      "Dialogue and visual-evidence principles tied to character strategy and relationship pressure.",
    ],
  },
  "Pacing and Tone: Storytelling Dynamics": {
    sections: [
      {
        heading: "Why this lesson follows screenplay evidence",
        paragraphs: [
          "A screenplay can contain clear scenes and still produce the wrong experience when their rhythm and attitude are unmanaged. Pacing controls the audience's experience of change, anticipation and processing over time. Tone expresses how the story treats its people, events and consequences. Both emerge from concrete choices, not labels alone.",
        ],
      },
      {
        heading: "Pacing is rhythm, not constant speed",
        paragraphs: [
          "Fast is not automatically engaging and slow is not automatically boring. A quiet signature can change a life in seconds; an action sequence can feel slow when the same obstacle repeats without new information, tactics or cost. Track the frequency and size of meaningful change rather than counting action lines.",
          "Rhythm needs contrast. Compression moves across less important duration. Expansion gives attention to an irreversible action or emotional recognition. Release gives the audience time to absorb consequence. Withholding creates anticipation when the delayed answer matters and pressure continues to change.",
        ],
        points: [
          "Acceleration — changes arrive more frequently or options narrow faster.",
          "Compression — elapsed time or repeated process is represented selectively.",
          "Expansion — a brief event receives more attention because its meaning matters.",
          "Release — intensity drops so consequence, contrast or anticipation can register.",
          "Handoff — the ending of one movement projects the audience into the next.",
        ],
      },
      {
        heading: "Tone is the story's attitude",
        paragraphs: [
          "Tone comes from point of view, narrative distance, consequence, imagery, sound, rhythm, diction and what characters are allowed to treat as serious or absurd. 'Dark' and 'funny' are insufficient until you can identify the behaviour and consequence that create them.",
          "A coherent tone can contain emotional range. Humour can reveal a control strategy inside grief; tenderness can increase danger inside a thriller. Tonal rupture occurs when consequence or point of view suddenly follows different rules without preparation—not whenever the mood changes.",
        ],
      },
      {
        heading: "Distinguish local mood from the governing tone",
        paragraphs: [
          "Mood is the feeling produced in a particular passage: tense, playful, mournful, relieved or uncanny. Tone is the larger stance that determines how the story frames that feeling and its consequences. A hospital corridor can shift from nervous humour to grief while the film's compassionate, unsentimental tone remains coherent.",
          "This distinction gives you useful flexibility. A tonal range can include contrast without becoming arbitrary. Audit the carriers of the shift—whose point of view governs, what behavior is rewarded, how sound and image frame the moment, and whether harm retains its weight. When those governing rules change without story cause, the result is rupture rather than range.",
        ],
      },
      {
        heading: "Use genre as an audience agreement",
        paragraphs: [
          "Genre suggests recurring forms of anticipation, fear, pleasure or recognition. It does not prescribe one speed: action films are not always fast, and dramas are not always slow. Horror may linger to grow dread and accelerate at a breach. Comedy may pause long enough for discomfort to deepen. Drama can move rapidly when choices and relationships change quickly. Choose pacing from the intended effect of this movement.",
          "Write tonal boundaries as consequences you will protect. Mara's story can contain dry medical humour, but violence should not become weightless spectacle. Her supernatural ability can feel uncanny, but it should not solve the investigation without moral cost.",
        ],
      },
      {
        heading: "Map the audience's information and emotion",
        paragraphs: [
          "For a sequence, chart what the audience knows, expects, fears and needs time to process. Suspense requires meaningful risk and uncertainty. Surprise reframes prior evidence. Dramatic irony lets the audience know something a character does not. Contrast sharpens the effect of adjacent movements.",
          "Pacing revision should change the pattern, not merely shorten pages. If three scenes deliver similar evidence, combine or differentiate their tactics and consequences. If a major betrayal is followed immediately by unrelated action, add or relocate processing so its effect can enter later choices.",
        ],
      },
      {
        heading: "Worked rhythm: Mara's archive sequence",
        paragraphs: [
          "Scene one accelerates as Mara enters the archive before a shift change. Scene two expands the chief's quiet offer because every polite line changes leverage. A short silent release follows as Mara washes blood from her hands but cannot remove the ink from her copied file number. The next scene accelerates when her ally recognizes that number and realizes she lied.",
          "The dominant tone is controlled dread: professional language, institutional spaces and withheld emotion make danger feel procedural. The tonal contrast of a mundane ambulance joke gives the relationship warmth, so its later rupture costs more rather than turning the story into comedy.",
        ],
      },
      {
        heading: "Define the final after-effect",
        paragraphs: [
          "Name what you want the audience to carry out of the ending: relief complicated by accountability, exhilaration shadowed by loss, grief opening into connection. Then trace where pacing and tone prepare that after-effect. An ending cannot suddenly manufacture an emotion the rest of the screenplay never rehearsed.",
          "Next, Project Positioning translates the now-defined story experience for specific collaborators or decision-makers. Carry forward a pace-and-tone map, tonal boundaries and the final emotional after-effect.",
        ],
      },
    ],
    definitions: [
      { term: "Pacing", meaning: "The rate and pattern at which meaningful conditions, information, pressure and anticipation change." },
      { term: "Tone", meaning: "The story's attitude toward its people, events and consequences, expressed through observable choices." },
      { term: "Tonal promise", meaning: "The range and treatment of emotion, consequence and point of view an audience is invited to expect." },
      { term: "Release", meaning: "Deliberate space that lets the audience process consequence, feel contrast or anticipate what follows." },
      { term: "Dramatic irony", meaning: "Pressure created when the audience and a character possess meaningfully different knowledge." },
    ],
    storyOutputs: [
      "The dominant tonal promise and boundaries the story should not cross accidentally.",
      "A rough emotional and informational rhythm from opening through ending.",
      "The final emotional after-effect the audience should carry out of the story.",
    ],
  },
  "Pitch Components and Project Positioning": {
    sections: [
      {
        heading: "Why positioning comes after story craft",
        paragraphs: [
          "You have defined and tested the story experience. Now you can decide what a particular listener needs in order to understand the project and take a next step. Positioning should clarify a coherent story, not compensate for an uncertain one with market language.",
        ],
      },
      {
        heading: "Story first, project information second",
        paragraphs: [
          "A complete project pitch may contain title, format, audience, comparable titles, market context, production scale, creator background, distribution thinking and a call to action. Those components matter in some conversations, but they should support the story promise rather than bury it.",
          "Ask who is listening and what decision they can make. A creative collaborator may need character, world and tone. A producer may also need format, audience and scope. A development conversation may need no market language until the dramatic engine is clear. Relevance is more persuasive than completeness.",
        ],
      },
      {
        heading: "Group the possible components by purpose",
        paragraphs: [
          "Do not memorize one universal deck. Select components according to the question being answered. Story components explain the experience. Project components explain form and scope. Positioning components locate audience and comparable experiences. Credibility components explain why the team can execute. The call to action explains what should happen next.",
        ],
        points: [
          "Story — title, premise, logline, protagonist, conflict, world, escalation, ending and emotional promise.",
          "Project — medium, format, length, episodic shape, development status and production scope.",
          "Positioning — intended audience, genre agreement, comparables and relevant market context.",
          "Credibility — creator relationship to the material, relevant experience and collaborators.",
          "Next step — the precise decision, feedback, meeting, attachment, funding or collaboration requested.",
        ],
      },
      {
        heading: "State status, rights and relationships truthfully",
        paragraphs: [
          "Project status should tell the listener what actually exists: concept, treatment, draft, revision, visual material, research or production preparation. An intention to attach an actor is not an attachment. Access to a source is not ownership of adaptation rights. Interest from a collaborator is not a team commitment. Precise language lets the listener evaluate the real next step without discovering hidden uncertainty later.",
          "Creator background belongs when it explains a meaningful relationship to the material or capacity to execute—not because every short conversation needs a biography. Likewise, rights, partners and current materials are selected according to the decision at hand. Keep evidence or a verification task beside every professional claim that another person may rely on.",
        ],
      },
      {
        heading: "Comparables are coordinates, not claims of quality",
        paragraphs: [
          "Each comparable should have a job. One may communicate audience, another tone, narrative shape, visual language or production scale. 'It is the next blockbuster' communicates ambition but no useful coordinate. Explain the axis: intimate institutional dread, contained-location pressure, an investigation organized around moral compromise.",
          "Choose recent or recognizable titles when useful, but verify market claims before external use. Foundations records the intended comparison; it does not freeze changing box office, platform, eligibility or audience data as permanent fact.",
        ],
      },
      {
        heading: "Be specific and honest about production scope",
        paragraphs: [
          "Scope includes locations, cast, period detail, visual effects, stunts, animals, music, specialized access and episodic requirements. You do not need a full budget to acknowledge the choices that shape feasibility. Do not promise a contained production while the story depends on large public disasters and extensive supernatural effects.",
          "Separate confirmed facts from aspirations. If a collaborator, attachment or right is not secured, do not imply otherwise. Truthful uncertainty builds more trust than manufactured certainty.",
        ],
      },
      {
        heading: "Mara pitched to two different listeners",
        paragraphs: [
          "For a co-writer, emphasize Mara's moral engine, the detective relationship, the supernatural rule and the ending choice. Ask whether they want to develop the relationship line and investigation turns. For a producer, begin with the same story promise, then add feature format, adult thriller audience, mostly contained institutional locations, limited supernatural visualization and the request to discuss development feasibility.",
          "The story does not change. The selected evidence and requested decision do. If either pitch makes a promise absent from the Foundations Brief, revise the pitch or deliberately revise the story—never let positioning quietly rewrite canon.",
        ],
      },
      {
        heading: "Omit what this conversation cannot use",
        paragraphs: [
          "A producer, co-writer, actor, publisher, funder and public audience do not ask the same question. Give each listener the story information and project context needed for their available decision. Budget ranges, distribution thinking, season plans, market analysis or detailed biographies may be necessary later, but including them by default can hide the dramatic reason anyone should care.",
          "Before sending or speaking, label every component with its job. Remove a component whose only purpose is to sound complete. If current rates, eligibility rules, organizations, platform data or market figures matter, verify them against an official current source instead of treating Foundations as a permanent industry database.",
        ],
      },
      {
        heading: "Prepare for the capstone",
        paragraphs: [
          "Assemble the smallest truthful project-facing pitch that serves one real listener. Label every market or production statement that needs current verification. End with one action the listener can actually take.",
          "Next, Build the Story Experience combines all ten outputs into the Foundations Brief. Carry forward format, intended audience, comparables with reasons, production scope and the call to action.",
        ],
      },
    ],
    definitions: [
      { term: "Target audience", meaning: "The people most likely to seek and understand the promised experience, described with relevant evidence rather than vague universality." },
      { term: "Comparable title", meaning: "An existing work used to communicate a specific coordinate such as audience, tone, structure, visual language or scale." },
      { term: "Production scope", meaning: "The practical scale implied by locations, cast, period, effects, stunts, access and format." },
      { term: "Call to action", meaning: "The precise next response or decision requested from the listener." },
    ],
    storyOutputs: [
      "Format, intended audience, genre and tonal position.",
      "One or two comparables with an explicit reason for each comparison.",
      "A truthful scope statement and one precise next-step request.",
    ],
  },
  "Build the Story Experience": {
    sections: [
      {
        heading: "Why Foundations ends with synthesis",
        paragraphs: [
          "The previous ten lessons produced connected decisions, not eleven isolated assignments. The capstone turns them into a decision system that later planning, drafting and visual work can test. A Foundations Brief is compact enough to use, detailed enough to expose contradictions and revisable when new story evidence earns a change.",
          "Do not simply paste every prior answer onto one page. Compare them. The protagonist, objective, opposition, stakes, theme, tone, audience promise and ending must describe the same movie. Where two claims disagree, mark a decision rather than smoothing the language until the conflict disappears.",
        ],
      },
      {
        heading: "The complete Foundations Brief",
        paragraphs: [
          "Write the brief in plain language another writer could understand without reading your notebooks. Each part should be testable against later Blocks, scenes or images. Unknowns belong in a separate watchlist so they remain visible without pretending to be canon.",
        ],
        points: [
          "Story promise — premise, development logline and the experience being offered.",
          "Protagonist — conscious want, deeper need or truth, protective strategy and opening condition.",
          "Disruption and objective — what changes and which visible result organizes the pursuit.",
          "Opposition — who or what protects an incompatible result and which leverage can adapt.",
          "Stakes and urgency — external, personal and relationship costs, including how they transform.",
          "Theme — the central question, competing answers and the choices that test them.",
          "World and rules — conditions that create options, obstacles, status and consequence.",
          "Structure and layers — major commitments, repeatable conflict and evidence expected below them.",
          "Audience experience — genre agreement, pacing rhythm, tonal range and final after-effect.",
          "Ending proof — the visible final choice and consequence that test the brief's central claims.",
          "Project position — format, audience, comparables, scope and immediate next step.",
          "Watchlist — unresolved decisions, risks and the evidence that could answer them.",
        ],
      },
      {
        heading: "Assemble the brief in five passes",
        paragraphs: [
          "First, collect the outputs without rewriting them. Second, remove duplicate language while preserving distinct functions. Third, draw links between claims: which wound or strategy shapes the objective, which opposition tests the thematic answer, which stakes make the final choice costly. Fourth, run the contradiction audit. Fifth, revise only the canonical decisions that the audit proves are incompatible.",
        ],
        points: [
          "1. Collect — place all ten lesson outputs side by side.",
          "2. Compress — combine repetition without deleting necessary distinctions.",
          "3. Connect — state the causal relationship between character, plot, theme and experience.",
          "4. Challenge — identify contradictions, unsupported claims and important unknowns.",
          "5. Commit — approve a working brief and record what downstream work must still prove.",
        ],
      },
      {
        heading: "Run the contradiction audit",
        paragraphs: [
          "A contradiction is not merely two different words. It is two claims that cannot both guide the same story. A pitch may promise Mara actively investigates while the structure gives every discovery to her ally. The theme may praise accountability while the ending rewards concealment without consequence. The tone may promise moral dread while the visual strategy treats violence as effortless spectacle.",
          "For each conflict, ask which claim has stronger evidence, which is an aspiration and which change would affect the fewest downstream decisions. Record the decision and the reason. Do not let a tool silently resolve it for you.",
        ],
      },
      {
        heading: "Use the ending as proof",
        paragraphs: [
          "The ending is the strongest stress test because pressure is highest and easy options should be gone. If the Foundation says Mara must value accountability over control, the climax should force a visible choice between those strategies. If the story promises institutional dread, the resolution should show the consequence of confronting or surviving that system rather than ending when the villain is caught.",
          "For every major sentence in the brief, write the ending action, image, line or consequence that could prove it. If you cannot imagine proof, the claim may be too abstract, absent from the story or still an open question.",
        ],
      },
      {
        heading: "Worked example: Mara's Foundations Brief",
        paragraphs: [
          "Promise and engine: After a murder victim's final thought names a respected police chief, Mara, a risk-averse paramedic, must prove he is the killer before her new ability exposes the crime she buried. She investigates through medical access and controlled secrecy while the chief uses institutional trust, evidence control and knowledge of her past to narrow her options.",
          "Character, relationship and theme: Mara wants proof but needs to accept that accountability is not the same as destruction. Her secrecy protects her competence and isolates her from Dev, the detective ally whose trust she needs. The thematic question asks whether safety purchased through concealment can remain moral when silence enables harm. The chief argues that institutions survive through managed truth; Dev argues that trust requires chosen vulnerability.",
          "Experience and ending: The feature is a contained supernatural moral thriller with procedural dread, moments of dry ambulance humour and a rhythm that alternates investigative acceleration with quiet consequence. In the climax Mara releases the victim's evidence together with her own disciplinary record, making the case possible while accepting legal and relational consequences. The ending image returns to the ambulance radio: she answers a call under supervision, no longer controlling which truths can reach her.",
          "Position and watchlist: The story is designed for an adult thriller audience and mostly institutional locations with restrained supernatural visualization. Useful comparables must be verified for tone and scale before an external pitch. Open questions include the exact nature of Mara's earlier crime, the legal mechanism that makes her evidence usable and whether Dev remains beside her after the confession.",
        ],
      },
      {
        heading: "Decide whether the Foundation is ready",
        paragraphs: [
          "Ready does not mean perfect or permanent. It means the brief contains a coherent engine, names its important unknowns and gives the next module enough direction to create evidence. Another writer should be able to describe the protagonist's pursuit, why opposition can sustain the middle, what changes internally and what the ending must prove.",
        ],
        points: [
          "The objective is active, visible and capable of generating varied tactics.",
          "Opposition has leverage, adapts and protects an incompatible result.",
          "External, internal and relationship stories affect one another.",
          "Stakes transform and make the final choice personally costly.",
          "Theme is a contested question tested through action and consequence.",
          "Pacing, tone, genre and visual language support the same audience promise.",
          "The ending provides visible proof for the central character and thematic claims.",
          "Unknowns and proposals are clearly separated from working canon.",
        ],
      },
      {
        heading: "Keep the brief alive",
        paragraphs: [
          "Later Blocks and scenes may reveal that an objective is passive, an opposition lacks leverage or a relationship carries more meaning than expected. Treat that evidence seriously. Revise the Foundation deliberately, record the changed decision and inspect every downstream layer affected by it.",
          "You are ready to leave Foundations when the brief can guide the next work without pretending to answer what the story has not earned. The module's final output is not certainty; it is a coherent, transparent starting point for deeper planning and writing.",
        ],
      },
    ],
    definitions: [
      { term: "Foundations Brief", meaning: "A compact, canonical but revisable model of the story engine, character movement, theme, audience experience and ending proof." },
      { term: "Ending proof", meaning: "A visible final choice, action, image or consequence that tests a major claim in the Foundation." },
      { term: "Contradiction audit", meaning: "A deliberate comparison used to find claims that cannot coherently guide the same story." },
      { term: "Working canon", meaning: "The currently approved story truth, accepted as usable while remaining open to deliberate evidence-based revision." },
      { term: "Readiness test", meaning: "A check that the Foundation can guide downstream work and that important unknowns are explicitly recorded." },
    ],
    storyOutputs: [
      "A complete Foundations Brief another writer can understand without reading all project notes.",
      "A contradiction audit with explicit decisions and unresolved watchlist items.",
      "A visible link between the protagonist's external pursuit, internal transformation, audience promise and ending proof.",
    ],
    exercise: "Use the outputs from Lessons 1–10 to write the complete Foundations Brief. Run the five-pass assembly, contradiction audit and ending-proof test above. Mark every unresolved item as an unknown or proposal rather than hiding it inside polished language.",
  },
};
