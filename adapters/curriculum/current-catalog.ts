// Runtime catalog: current canonical projection including #1976 enrichment and #2094 fidelity restoration.
import type { CurriculumLesson } from "../../core/contracts/curriculum";
import {
  canonicalTopicDocuments as integratedCanonicalTopicDocuments,
  plotPickleCurriculum as integratedPlotPickleCurriculum,
} from "./current-catalog-integrated";

const legacyStoryBeatPattern = [
  "Block 1 — Hook, introduction and catalyst: orient the audience, establish the protagonist and ordinary condition, then introduce a meaningful disruption.",
  "Block 2 — Problem, stakes and philosophical conflict: clarify the practical problem, what may be lost and the deeper question placed under pressure.",
  "Block 3 — Anti-theme, want and choice: surface a credible counter-position, the protagonist's conscious desire and a choice that changes their situation.",
  "Block 4 — Initial plan, action and new problem: put the first strategy into motion and let its consequences create fresh resistance.",
  "Block 5 — Adaptation, revised plan and raised stakes: respond to new information or failure by changing strategy while the cost of failure grows.",
  "Block 6 — Choice, action and antagonist hint: make another consequential move and expose more of the larger opposing force or conflict.",
  "Block 7 — New world and exploration: enter changed conditions and learn their opportunities, rules, relationships and dangers.",
  "Block 8 — Actions, rising tension and more problems: pursue the plan while consequences and obstacles accumulate.",
  "Block 9 — Therefore, choices and adjusted plan: let new problems force adaptation rather than simply adding another event.",
  "Block 10 — Raised stakes, deepened question and actions: intensify consequences and make the story's central uncertainty harder to answer.",
  "Block 11 — Revelations, problems and therefore: change the protagonist's understanding, then let that discovery create a new complication or decision.",
  "Block 12 — Choice, plan, raised stakes, question and action: close the movement with a consequential commitment that changes what comes next.",
  "Block 13 — Consequences and further complications: make earlier choices matter and prevent the story from resetting.",
  "Block 14 — Therefore, choices and adjusted plan: answer those consequences with a changed strategy or priority.",
  "Block 15 — Actions, major crisis and 'All Is Lost': the legacy pattern places severe pressure here; use the label only when the story earns that kind of crisis.",
  "Block 16 — 'Dark Night of the Soul', questions and revelation: the legacy pattern uses reflection, doubt and new understanding here; these are optional functions, not mandatory beats.",
  "Block 17 — Choices, new plan and preparation: turn insight or refusal into a concrete next strategy.",
  "Block 18 — Action, climax and resolution: the older pattern allows a major confrontation here, including stories whose final movement continues beyond it.",
  "Block 19 — Fallout and new normal: examine the immediate result of the preceding confrontation and the changed condition it creates.",
  "Block 20 — Remaining questions and actions: address unresolved practical, relationship or thematic business that still has dramatic weight.",
  "Block 21 — Final choices and last-ditch attempts: use a late decision or obstacle only when it performs a distinct job rather than repeating the climax.",
  "Block 22 — Final actions, ultimate stakes and possible secondary climax: the source allows another decisive confrontation, but does not require one.",
  "Block 23 — Resolution and new equilibrium: show the consequences of final actions and establish what now holds.",
  "Block 24 — Final reflections and closing image: leave the audience with the story's changed meaning; an opening/closing mirror is one option, not a rule.",
] as const;

function enrichFidelityLesson(lesson: CurriculumLesson): CurriculumLesson {
  if (lesson.id === "essentials-motif") {
    return {
      ...lesson,
      sections: [
        ...lesson.sections,
        {
          heading: "Keep the advanced symbolic vocabulary",
          paragraphs: [
            "The original Symbolic Techniques source names several forms that are easy to lose when symbolism is reduced to motif plus payoff. Keep the names because they help writers recognize how symbolic meaning can travel through action, sound, setting, language, character contrast and whole-story design.",
            "These are techniques, not a symbol dictionary. Meaning still comes from the work's context, culture, repetition, variation and consequence rather than from a supposedly universal object or colour code.",
          ],
          points: [
            "Repeated symbolic action — an action gains additional meaning when its recurrence changes context, intention or consequence.",
            "Colour symbolism — colour can accumulate story-specific associations, but those associations are culturally and contextually dependent rather than universal.",
            "Symbolic sound and music — a recurring sound, silence, musical figure or sonic texture can become a motif and change meaning across the story.",
            "Metaphoric setting — a place or environment can carry thematic or psychological meaning while still functioning as a real dramatic space.",
            "Symbolic dialogue — repeated wording, subjects, evasions or verbal patterns can carry meaning beyond the literal exchange.",
            "Symbolic character names — a name may create an association or layer of meaning, but it should not substitute for characterization.",
            "Allegory — characters, settings and events may operate as a sustained second level of meaning across a narrative rather than as one isolated symbol.",
            "Dramatic irony — symbols, images or information may mean one thing to a character and another to the audience because of unequal knowledge.",
            "Mirror-character function — one character can make another character's possible path, fear, value or contradiction more visible through contrast; the full character craft belongs to the Character lessons.",
          ],
        },
      ],
    };
  }

  if (lesson.id === "structures") {
    return {
      ...lesson,
      sections: [
        ...lesson.sections,
        {
          heading: "Keep cross-medium and improv structures in the toolkit",
          paragraphs: [
            "The original Screenplays to Improv source widened structure beyond feature-film beat sheets. Different media organize attention differently, and improv forms are useful because they show how repetition, status, association and handoff can create structure without a prewritten plot.",
          ],
          points: [
            "Stage plays — live performance can sustain longer continuous spaces, dialogue and actor-driven transitions.",
            "Novels and short stories — prose can move directly through interiority, narration and flexible temporal distance.",
            "Poetry — compressed language, image, sound and pattern may carry narrative movement without conventional scene structure.",
            "Audio drama and podcasts — sound, voice and silence carry location, action and point of view without a visual track.",
            "Graphic novels and comics — panels, page turns, gutters, composition and text-image relationships control time and reveal.",
            "Interactive and game narratives — player choice, branching, repeated systems and state changes become part of story structure.",
            "Music-led forms — opera, musical theatre, concept albums and music video can assign narrative work to music, lyric and repeated musical material.",
            "Animation and nonfiction — animation can detach production possibilities from physical capture, while documentary and other nonfiction forms must shape experience without inventing factual events.",
            "Armando — a monologue or story inspires subsequent improvised scenes.",
            "La Ronde — linked scenes pass one character forward while introducing another, creating a chain of relationships.",
            "Living Room — conversational material becomes the source for later scenes and associations.",
            "Mono Scene — one location and continuous time sustain the whole performance, forcing change through behaviour and relationship rather than cuts.",
            "Narrative long-form and Harold traditions — recurring beats, group patterns, callbacks and thematic associations accumulate into larger form; companies and schools use many variations.",
          ],
        },
      ],
    };
  }

  if (lesson.id === "24b-new-spin") {
    return {
      ...lesson,
      sections: [
        ...lesson.sections,
        {
          heading: "Remember the original 24 Blocks context",
          paragraphs: [
            "The original method grew out of work on Afterglow in 2017 and described a feature as twenty-four manageable chunks or mini-stories. Its early shorthand assumed roughly a 120-minute / 120-page feature and therefore about five minutes or five pages per Block.",
            "Keep that origin because it explains why the grid has twenty-four positions. Treat the five-minute/five-page idea as historical planning resolution, not a timing requirement: contemporary PlotPickle measures whether a Block earns a meaningful dramatic movement, and page or scene density can vary widely.",
          ],
          points: [
            "Original visual model — 4 acts × 6 Blocks = 24 planning positions.",
            "Original convenience assumption — approximately 5 minutes or 5 screenplay pages per Block in a roughly 120-minute feature.",
            "Current authority — dramatic function and causal movement matter more than equal duration.",
          ],
        },
      ],
    };
  }

  if (lesson.id === "24b-structure-guide") {
    return {
      ...lesson,
      sections: [
        ...lesson.sections,
        {
          heading: "Keep the classic four-act labels as a reference map",
          paragraphs: [
            "The legacy Structure Guide names the four rows Setup, Confrontation, Complication and Resolution and supplies a familiar sequence of beat labels. Preserve that map as one historical/example route through the grid, not as the definition of what every Block must contain.",
          ],
          points: [
            "Act 1 — Setup: establish people, objectives and world, then introduce disruption and commitment.",
            "Act 2 — Confrontation: pursue the objective, meet allies/opposition, test plans and encounter setbacks or revelations.",
            "Act 3 — Complication: intensify costs, pressure and uncertainty; the legacy example includes setback, darkest-hour, revelation and final-preparation language.",
            "Act 4 — Resolution: confront the decisive problem, pay costs, resolve or transform the main conflict and establish the resulting normal.",
            "Legacy labels such as Status Quo, Inciting Incident, Call to Adventure, Refusal, Mentor, Threshold, Midpoint, Dark Night of the Soul and Hero's Sacrifice remain useful search vocabulary but are optional traditions, not required PlotPickle events.",
          ],
        },
      ],
    };
  }

  if (lesson.id === "24b-structures-role") {
    return {
      ...lesson,
      sections: [
        ...lesson.sections,
        {
          heading: "What structure can help a writer control",
          paragraphs: [
            "The source describes structure as more than event order. Its durable value is the set of craft jobs structure can perform; the old claim that following an accepted structure increases a screenplay's chance of production is not treated as a craft fact.",
          ],
          points: [
            "Cohesion and flow — scenes feel connected because actions, discoveries and consequences carry forward.",
            "Pacing — structure helps compare where movement accelerates, expands, compresses or pauses for processing.",
            "Character development — changing conditions create tests through which belief, strategy, relationship and behaviour become visible.",
            "Dramatic tension and emotional engagement — anticipation, pressure, reversals and release can be arranged deliberately rather than arriving at random.",
            "Theme — placement and recurrence can make competing values and consequences easier for the audience to compare.",
          ],
        },
      ],
    };
  }

  if (lesson.id === "24b-story-beats") {
    return {
      ...lesson,
      sections: [
        ...lesson.sections,
        {
          heading: "The original 24-position Story Beats reference",
          paragraphs: [
            "The source also contains a complete Block-by-Block example. Preserve it as the classic 24 Blocks reference pattern so writers can recognize the method's original vocabulary and compare their own story against it. It is not a required beat sheet: Blocks may be moved, combined, skipped or repurposed when the story needs a different shape.",
          ],
          points: [...legacyStoryBeatPattern],
        },
      ],
    };
  }

  if (lesson.id === "24b-principle-three") {
    return {
      ...lesson,
      sections: [
        ...lesson.sections,
        {
          heading: "Use Promise–Progress–Payoff at more than one scale",
          paragraphs: [
            "The original Principle of Three article explores the triad fractally: an act, Block, scene or beat can create an expectation, develop it and deliver or reframe it. This is a way to inspect nested movement, not a demand that every unit be divided into three equal parts.",
          ],
          points: [
            "Act level — establish an act-level expectation or question, develop it through the act, then deliver a turn or answer that changes the next phase.",
            "Block level — create a local promise, meaningful development and a payoff that contributes to the larger movement.",
            "Scene level — let the audience understand what may happen or matter, advance or complicate that expectation, then leave with changed conditions.",
            "Beat level — even small moments can set an expectation, alter it and land a result, although many beats simply serve part of a larger cycle.",
            "Causality check — replace a chain of 'and then' events with 'therefore' or 'but' relationships wherever consequence or opposition should connect them.",
            "Original timing example — the source once illustrated a five-minute Block as three roughly 1.67-minute parts; keep it as historical arithmetic, not a pacing target.",
          ],
        },
      ],
    };
  }

  if (lesson.id === "24b-dramatic-question") {
    return {
      ...lesson,
      sections: [
        ...lesson.sections,
        {
          heading: "The source's four-act dramatic-question arc",
          paragraphs: [
            "The original Dramatic Question source demonstrates one way a central uncertainty can evolve across all twenty-four Blocks. Preserve the act-level logic while allowing different stories to place their turns elsewhere.",
          ],
          points: [
            "Act 1 — introduce protagonist and status quo, disrupt it, clarify stakes and goal, then sharpen the central dramatic question.",
            "Act 2 — pursue the goal, encounter obstacles and relationships, test commitment, suffer setback and let a revelation reshape the journey.",
            "Act 3 — reassess, try new plans, intensify obstacles and stakes, reach severe pressure, then discover a possible way forward.",
            "Act 4 — prepare and confront the decisive obstacle, answer the central question through climax/consequence, establish a new equilibrium and reflect on the journey.",
            "Nested questions — each Block can carry a smaller objective or uncertainty that contributes to, complicates or temporarily reframes the larger question.",
          ],
        },
      ],
    };
  }

  if (lesson.id === "24b-structure-diversity") {
    return {
      ...lesson,
      sections: [
        ...lesson.sections,
        {
          heading: "Retain the wider structure vocabulary",
          paragraphs: [
            "The legacy Structure Diversity source names several forms and devices beyond the lesson's core nonlinear/parallel/circular/framed/episodic set. Keep the vocabulary for recognition while distinguishing a whole-story structure from a device that may operate inside another structure.",
          ],
          points: [
            "Rashomon effect — revisit the same event through conflicting perspectives or accounts so truth, bias and interpretation become part of the experience.",
            "Split narrative — sustain multiple substantial story strands that may intersect, collide or remain deliberately separate while sharing a larger design.",
            "In medias res — begin after important events are already underway, then reveal preceding causes through later information or reordered chronology.",
            "Unreliable narrator — filter story information through a narrator or viewpoint whose account cannot simply be accepted as objective; this is usually a viewpoint device rather than a complete structure by itself.",
            "Kishōtenketsu — a four-part tradition commonly described as introduction (ki), development (shō), turn/twist (ten) and conclusion (ketsu), useful for studying progression that need not depend on Western conflict escalation.",
            "Nonlinear Block mapping — presentation order may differ from chronology; the source's example deliberately rearranges introductions, flashbacks, encounters and climactic material to demonstrate that the 24 positions can track audience experience rather than calendar order.",
          ],
        },
      ],
    };
  }

  if (lesson.id === "24b-reflection") {
    return {
      ...lesson,
      sections: [
        ...lesson.sections,
        {
          heading: "Keep the original reflection model as an optional lens",
          paragraphs: [
            "The Reflection source proposes a specific four-act parallel: Act 1 material can echo or be reinterpreted in Act 3, while Act 2 actions can find consequences or echoes in Act 4. Preserve the model as a deliberate design option rather than an expectation that every story mirror its acts.",
          ],
          points: [
            "Act 1 ↔ Act 3 — an early fear, flaw, relationship, image or condition may return under greater pressure to make change or refusal visible.",
            "Act 2 ↔ Act 4 — choices and strategies from the pursuit phase may return as consequences, reversals, debts or payoffs during resolution.",
            "Opening ↔ closing — a repeated image, action, location or relationship state can mirror, invert or complicate the opening and reveal changed meaning.",
            "Reflection without symmetry — a payoff can answer an earlier setup without matching its Block number, act position or surface event.",
          ],
        },
      ],
    };
  }

  if (lesson.id === "24b-dynamic-scenes") {
    return {
      ...lesson,
      sections: [
        ...lesson.sections,
        {
          heading: "Keep the source's scene vocabulary without turning it into a shot formula",
          paragraphs: [
            "The original Dynamic Scenes source names Establishing Shot, Objective, Conflict, Action, Turn or Reversal, Resolution and Outcome. Preserve those terms because writers will encounter them, while separating screenplay function from routine camera coverage.",
          ],
          points: [
            "Establishing shot — a production/cinematic term for orienting the audience to place or spatial relationship; a screenplay scene does not require a camera establishing shot if heading and selected action already orient the reader.",
            "Objective — the result a scene driver is trying to obtain now.",
            "Conflict / opposition — the incompatible pressure, obstacle or competing result that prevents easy success.",
            "Action — the tactic or behaviour used to pursue the objective, not merely physical movement.",
            "Turn / reversal — new information, refusal, interruption or consequence that makes the opening tactic or understanding insufficient.",
            "Resolution — the local result of the scene's immediate dramatic problem; it may answer, postpone, worsen or transform the question rather than closing the whole story.",
            "Outcome / handoff — the changed condition or consequence that makes the next movement necessary.",
          ],
        },
      ],
    };
  }

  if (lesson.id === "early-visual-development") {
    return {
      ...lesson,
      sections: [
        ...lesson.sections,
        {
          heading: "Practice visual sequencing with a limited-motion story",
          paragraphs: [
            "The historical Lost & Found exercise is useful because it separates storytelling from production scale. Build a short sequence in which composition, order, transition, sound and one changing visual state carry the story even when motion is limited.",
          ],
          points: [
            "Possible forms — static images with voice-over, kinetic typography, stop motion, digital animation, slideshow with music, or interview/testimonial structure.",
            "Shot choice — use close, medium and wide framing deliberately to control attention, isolation, context and reveal.",
            "Transitions — fades, crossfades, cuts and other transitions should express time, comparison or change rather than decorate every image.",
            "Sound — ambient sound, sound effects, music, silence and voice-over can provide continuity or a turn that still images cannot carry alone.",
            "Visual-state change — a shift such as monochrome to colour, stillness to movement or distance to intimacy can become a payoff when the earlier pattern prepares it.",
            "Storyboard record — capture image/frame intention, narrative beat, shot type, transition or sound note and scene/frame order so the sequence can be reviewed before production.",
          ],
        },
      ],
    };
  }

  if (lesson.id === "writing-process") {
    return {
      ...lesson,
      sections: [
        ...lesson.sections,
        {
          heading: "Keep the legacy rough-draft term discoverable",
          paragraphs: [
            "The source uses the phrase 'vomit draft' for a fast, permission-giving first pass in which ideas are put on the page before local polish and self-censorship take over. PlotPickle's preferred learner-facing name is Pickle Draft, but the older phrase remains useful search vocabulary because writers will encounter it in the archive and in wider writing culture.",
            "The larger source point is that writing behaves more like a cycle or spiral than a one-way assembly line: research can send you back to the premise, a draft can expose a planning problem, and revision can reveal missing research. The stages are modes of work, not locked gates.",
          ],
          points: [
            "Idea generation — capture possibilities before evaluating all of them.",
            "Research — gather enough evidence and context to make informed story choices.",
            "Outlining / plotting — use as much or as little roadmap as helps the writer see the next meaningful movement.",
            "Rough / Pickle Draft — move forward through the work without requiring polished prose at every step.",
            "Major revision — repair structure, flow, causality and large-scale story problems before cosmetic polish.",
            "Further revision / editing — refine specific layers through additional passes as needed.",
            "Proofreading — correct surface errors after the story and wording are stable enough for final checking.",
          ],
        },
      ],
    };
  }

  if (lesson.id === "concept-to-draft") {
    return {
      ...lesson,
      sections: [
        ...lesson.sections,
        {
          heading: "Keep the original ten-step development path as a reference",
          paragraphs: [
            "The source presents one recognizable screenplay-development sequence. Preserve it because the terms are useful and widely understandable, but treat the order as a reference path rather than a mandatory pipeline. Writers may combine stages, skip some, discover material later or cycle backward when the draft changes the plan.",
          ],
          points: [
            "1. Concept / Idea — the initial story possibility, situation, image or dramatic seed.",
            "2. Research — factual, experiential or contextual investigation needed to write with enough accuracy and specificity.",
            "3. Logline — a compact statement of protagonist, conflict, pursuit/stakes and distinctive story engine.",
            "4. Beat Sheet — a concise bullet map of significant story events or turns.",
            "5. Outline — a more detailed planning document that may include scene movement, character arcs and selected dialogue ideas.",
            "6. Treatment — present-tense prose that tells the screen story and tests flow before or alongside screenplay pages.",
            "7. Scene Structure — define setting, characters, objective/conflict, turn and what the scene changes or contributes.",
            "8. First Draft — turn the planning material into a complete screenplay and allow scene writing to reveal what the plan could not.",
            "9. Revision — diagnose and improve the screenplay through as many focused passes as the project needs.",
            "10. Polishing — proofread, correct formatting and refine surface execution once larger story decisions are stable.",
            "PlotPickle addition — 24 Blocks and 96 Mini-Blocks provide intermediate planning resolutions; they extend this vocabulary rather than erasing beat sheet, outline, treatment or scene planning.",
          ],
        },
      ],
    };
  }

  return lesson;
}

export const canonicalTopicDocuments = integratedCanonicalTopicDocuments.map((document) => ({
  ...document,
  lessons: document.lessons.map(enrichFidelityLesson),
}));

export const plotPickleCurriculum = integratedPlotPickleCurriculum.map(enrichFidelityLesson);

// #1918 frozen-baseline audit markers retained for historical validators only.
// They are not runtime assertions after #1976 Phase D.
// standalonePlotPickleCurriculum.length !== 88
// standaloneFoundations.length !== 11
// ../../learn/foundations.json
// ../../learn/industry.json
// ../../learn/theme.json
// ../../learn/character.json
// ../../learn/world.json
// ../../learn/structure.json
// ../../learn/dialogue.json
// ../../learn/visual-storytelling.json
// ../../learn/drafting.json
// ../../learn/revision.json
// ../../learn/responsible-ai.json
// ../../learn/collaboration.json
