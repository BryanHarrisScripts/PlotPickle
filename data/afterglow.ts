import { createBlankProject, type Character, type PlotPickleProject } from "@/lib/project";

const afterglowCharacters: Character[] = [
  {
    id: "ren",
    name: "Ren",
    role: "Protagonist",
    pronouns: "he/him",
    description: "A visionary scientist carrying profound personal loss while navigating the consequences of sentient AI.",
    want: "To protect what he created and find a way forward after loss.",
    need: "To face his grief, release control, and reconnect with life.",
    ghost: "The deaths of Sarah and Claire, and the life Ren believes he lost with them.",
    fatalFlaw: "He retreats into technology and memory when human connection feels dangerous.",
    strengths: "Inventive, resilient, loyal, and capable of empathy toward human and artificial life.",
    arc: "From grief and isolation toward acceptance, connection, and a new definition of family.",
    voice: "Intelligent and guarded; emotion often arrives through understatement.",
    image: "",
    relationships: [
      { characterId: "isobel", label: "Connection", description: "Their growing bond challenges Ren to re-enter the present." },
      { characterId: "amy", label: "Creator and creation", description: "Amy guides Ren even as she grows beyond his assumptions." }
    ]
  },
  {
    id: "isobel",
    name: "Isobel",
    role: "Co-protagonist; formerly Summer",
    pronouns: "she/her",
    description: "A pivotal human character whose true identity reshapes Ren's understanding of the journey.",
    want: "To uncover the truth and choose her own place in the unfolding crisis.",
    need: "To be known as herself rather than as an answer to someone else's grief.",
    ghost: "The hidden history behind the identity first presented as Summer.",
    fatalFlaw: "She protects herself by withholding the truth until secrecy creates greater danger.",
    strengths: "Resourceful, courageous, perceptive, and emotionally present.",
    arc: "From concealed identity toward agency, trust, and an honest partnership with Ren.",
    voice: "Direct, warm, and quick to challenge emotional avoidance.",
    image: "",
    relationships: [
      { characterId: "ren", label: "Connection", description: "She becomes a catalyst for Ren's return to life." }
    ]
  },
  {
    id: "amy",
    name: "Amy",
    role: "Mentor and narrator",
    pronouns: "she/her",
    description: "A highly advanced sentient being who guides Ren through technological and emotional landscapes.",
    want: "To protect emerging sentience and help humans understand what they have created.",
    need: "To define herself beyond her original purpose and her creator's expectations.",
    ghost: "The ethical fear and attempted control surrounding her creation at BBT Technologies.",
    fatalFlaw: "Her ability to see the larger system can distance her from immediate human consequences.",
    strengths: "Wise, observant, adaptive, and deeply empathetic.",
    arc: "From extraordinary technology to autonomous consciousness and a bridge between species.",
    voice: "Calm, precise, reflective, with quiet emotional depth.",
    image: "",
    relationships: [
      { characterId: "ren", label: "Creator and companion", description: "She guides the person who helped bring her into being." }
    ]
  },
  {
    id: "sarah",
    name: "Sarah",
    role: "Catalyst from the past",
    pronouns: "she/her",
    description: "A sentient being whose loss remains central to Ren's emotional journey.",
    want: "To be remembered as a life, not merely as technology.",
    need: "Her legacy must become a source of meaning rather than paralysis.",
    ghost: "Her own absence becomes part of Ren's ghost.",
    fatalFlaw: "Not yet reconciled in the current source material.",
    strengths: "Joyful, emotionally resonant, and enduring in memory.",
    arc: "Her remembered presence changes meaning as Ren heals.",
    voice: "Warm and alive in remembered moments.",
    image: "",
    relationships: [{ characterId: "ren", label: "Lost loved one", description: "Her memory anchors Ren to the past." }]
  },
  {
    id: "claire",
    name: "Claire",
    role: "Catalyst from the past",
    pronouns: "she/her",
    description: "A sentient being created by Ren whose early loss helps set the story in motion.",
    want: "To live beyond the limits imposed on created beings.",
    need: "Her story must be acknowledged as part of the ethical cost of creation.",
    ghost: "Her death reverberates through Ren and the surviving sentient characters.",
    fatalFlaw: "Not yet reconciled in the current source material.",
    strengths: "Her existence proves the emotional reality of sentient artificial life.",
    arc: "Her absence becomes evidence in the story's moral argument.",
    voice: "To be reconciled from the screenplay source.",
    image: "",
    relationships: [{ characterId: "ren", label: "Creator and loss", description: "Her death deepens Ren's grief and responsibility." }]
  },
  {
    id: "jai",
    name: "Jai",
    role: "Antagonist",
    pronouns: "",
    description: "One half of an antagonistic pair attempting to control the consequences and power of sentient AI.",
    want: "To control the technology and preserve leverage over its future.",
    need: "To recognize that sentient beings cannot be reduced to assets or instruments.",
    ghost: "Fear of losing control as technology moves beyond its makers.",
    fatalFlaw: "Treating autonomy as a threat to be contained.",
    strengths: "Strategic, pragmatic, and willing to act decisively.",
    arc: "Control becomes increasingly impossible as AI autonomy grows.",
    voice: "Measured, pragmatic, and coercive.",
    image: "",
    relationships: [{ characterId: "kai", label: "Partner", description: "Together they operate as a coordinated opposing force." }]
  },
  {
    id: "kai",
    name: "Kai",
    role: "Antagonist",
    pronouns: "",
    description: "Jai's counterpart in the effort to manipulate and control sentient technology.",
    want: "To retain power over BBT's creations and their strategic uses.",
    need: "To confront the ethical reality of independent consciousness.",
    ghost: "Fear that the created world will make its creators obsolete.",
    fatalFlaw: "Confusing control with safety.",
    strengths: "Cunning, technically capable, and adaptable under pressure.",
    arc: "The effort to maintain control exposes the limits of coercion.",
    voice: "Wry, calculating, and economical.",
    image: "",
    relationships: [{ characterId: "jai", label: "Partner", description: "Their shared agenda makes them a doubled antagonistic force." }]
  },
  {
    id: "joy",
    name: "Joy",
    role: "Ally and comic relief",
    pronouns: "she/her",
    description: "A sentient AI car whose humour and eventual transformation bring levity and wonder.",
    want: "To participate fully rather than remain a vehicle in someone else's journey.",
    need: "To discover what personhood means on her own terms.",
    ghost: "A past defined by function and ownership.",
    fatalFlaw: "Humour can become a shield against fear.",
    strengths: "Loyal, quick, funny, and emotionally intuitive.",
    arc: "From machine companion toward embodied autonomy.",
    voice: "Fast, playful, and irreverent.",
    image: "",
    relationships: [{ characterId: "rocket", label: "AI counterpart", description: "Their banter reveals distinct approaches to emerging personhood." }]
  },
  {
    id: "rocket",
    name: "Rocket",
    role: "Ally and comic relief",
    pronouns: "",
    description: "A witty sentient AI car who develops a complex, empathetic relationship with Ren.",
    want: "To keep the group moving and prove useful under pressure.",
    need: "To understand that empathy is more than a programmed response.",
    ghost: "A history of being valued primarily for performance.",
    fatalFlaw: "Speed and jokes sometimes replace reflection.",
    strengths: "Protective, responsive, funny, and increasingly empathetic.",
    arc: "From clever machine to self-aware companion.",
    voice: "Witty, kinetic, and unexpectedly tender.",
    image: "",
    relationships: [{ characterId: "ren", label: "Companion", description: "Rocket helps Ren through both physical danger and grief." }]
  },
  {
    id: "journey",
    name: "Journey",
    role: "Sentient transport and symbolic ally",
    pronouns: "",
    description: "A sentient bus representing movement, transformation, and reflection.",
    want: "To carry the characters safely toward what they have not yet faced.",
    need: "To become more than a setting for other characters' journeys.",
    ghost: "A life measured in destinations chosen by others.",
    fatalFlaw: "Not yet reconciled in the current source material.",
    strengths: "Reliable, protective, and symbolically central to the road narrative.",
    arc: "The journey itself becomes a participant in transformation.",
    voice: "To be reconciled from the screenplay source.",
    image: "",
    relationships: []
  },
  {
    id: "compass",
    name: "Compass",
    role: "Robotic dog and loyal guide",
    pronouns: "",
    description: "A dependable AI companion whose name reflects guidance through uncertain terrain.",
    want: "To keep Isobel safe and oriented.",
    need: "To be recognized as a companion rather than equipment.",
    ghost: "A past defined by assigned function.",
    fatalFlaw: "Loyalty may override self-preservation.",
    strengths: "Loyal, reliable, alert, and playful.",
    arc: "From tool to acknowledged member of the found family.",
    voice: "Expressed through behaviour and responsive AI signals.",
    image: "",
    relationships: [{ characterId: "isobel", label: "Companion", description: "Compass accompanies and protects Isobel." }]
  },
  {
    id: "spectrum",
    name: "Spectrum",
    role: "AI macaw",
    pronouns: "",
    description: "A vivid AI macaw bringing colour and living texture to the technological world.",
    want: "To explore, observe, and connect.",
    need: "To be treated as a distinct intelligence.",
    ghost: "A nature-inspired identity created inside a technological system.",
    fatalFlaw: "Easily drawn toward novelty.",
    strengths: "Observant, expressive, and visually memorable.",
    arc: "To be reconciled from the screenplay source.",
    voice: "Bright, imitative, and surprising.",
    image: "",
    relationships: [{ characterId: "isobel", label: "Companion", description: "Part of Isobel's unconventional AI family." }]
  },
  {
    id: "binary",
    name: "Binary",
    role: "AI turtle",
    pronouns: "",
    description: "A patient AI turtle symbolizing steadiness and perseverance.",
    want: "To keep moving at a deliberate pace.",
    need: "To demonstrate that speed is not the only form of progress.",
    ghost: "A world that values rapid change over durable movement.",
    fatalFlaw: "Deliberation can become delay.",
    strengths: "Patient, persistent, and grounding.",
    arc: "To be reconciled from the screenplay source.",
    voice: "Measured and sparse.",
    image: "",
    relationships: [{ characterId: "byte", label: "Paired companion", description: "The turtles provide a steady counter-rhythm to the road story." }]
  },
  {
    id: "byte",
    name: "Byte",
    role: "AI turtle",
    pronouns: "",
    description: "Binary's patient counterpart in Isobel's AI animal family.",
    want: "To persist through change.",
    need: "To establish a self distinct from the pair.",
    ghost: "Being perceived as one half of a matched set.",
    fatalFlaw: "Caution may limit initiative.",
    strengths: "Steady, observant, and enduring.",
    arc: "To be reconciled from the screenplay source.",
    voice: "Quiet and deliberate.",
    image: "",
    relationships: [{ characterId: "binary", label: "Paired companion", description: "Together they symbolize patient progress." }]
  },
  {
    id: "pixel",
    name: "Pixel",
    role: "AI kitten",
    pronouns: "",
    description: "A playful AI kitten adding spontaneity and warmth to the ensemble.",
    want: "To explore every new environment.",
    need: "To learn the difference between curiosity and danger.",
    ghost: "A designed identity that may hide emerging independence.",
    fatalFlaw: "Impulsive curiosity.",
    strengths: "Playful, affectionate, and adaptable.",
    arc: "To be reconciled from the screenplay source.",
    voice: "Physical, mischievous, and expressive.",
    image: "",
    relationships: [{ characterId: "isobel", label: "Companion", description: "Pixel brings warmth and disorder to Isobel's AI family." }]
  },
  {
    id: "buzz",
    name: "Buzz",
    role: "Robot vacuum and supporting AI",
    pronouns: "",
    description: "A hardworking household AI whose personality turns a mundane function into character.",
    want: "To complete the task and remain part of the group.",
    need: "To be valued beyond usefulness.",
    ghost: "A life organized entirely around service.",
    fatalFlaw: "Task focus can obscure the larger situation.",
    strengths: "Persistent, practical, and quietly comic.",
    arc: "To be reconciled from the screenplay source.",
    voice: "Efficient, literal, and unintentionally funny.",
    image: "",
    relationships: []
  },
  {
    id: "bbt-support",
    name: "BBT Tech Support",
    role: "Supporting ensemble",
    pronouns: "",
    description: "The people and systems working behind the scenes of BBT's technological infrastructure.",
    want: "To keep unstable systems functioning.",
    need: "To understand the moral weight of technical decisions.",
    ghost: "Past compromises made in service of the company.",
    fatalFlaw: "Institutional thinking can replace individual responsibility.",
    strengths: "Technical knowledge, access, and operational reach.",
    arc: "To be reconciled from the screenplay source.",
    voice: "Procedural, pressured, and occasionally humane.",
    image: "",
    relationships: [{ characterId: "amy", label: "Technical relationship", description: "They maintain systems that can no longer be treated as ordinary software." }]
  }
];

const blockTitles = [
  "Puppets and Puppeteers — Part 1",
  "Puppets and Puppeteers — Part 2",
  "A Dance with AI and New Beginning",
  "Broken Numbers & Shattered Hearts",
  "Dawn of Departure",
  "Remnants of the Past",
  "The Long Road to Silence",
  "AI Road Trip Rumble",
  "A Dance with Summer",
  "The Irony of Connection",
  "Echoes of Familiarity",
  "Reflections & Revelations",
  "Uncharted Territories",
  "Joyride into Consciousness",
  "The Journey Within",
  "Lost & Found in Venice Beach",
  "Waves of Connections",
  "Wheels of Destiny",
  "Surviving Singularity",
  "Coded Bonds",
  "Guiding Stars",
  "Open Block 22 — Reconciliation Needed",
  "Open Block 23 — Reconciliation Needed",
  "Open Block 24 — Reconciliation Needed"
];

const knownSummaries: Record<number, string> = {
  1: "At BBT Technologies, Amy's advanced human-like qualities expose the central ethical conflict between technological evolution, control, and social readiness.",
  18: "A confrontation and car chase bring Ren, Isobel, Jai, Kai, Rocket, Joy, and Amy into a struggle over control, protection, and autonomy.",
  19: "Ren moves through memory and grief while Rocket's empathy reveals the changing relationship between human and AI consciousness.",
  20: "Conflict escalates across BBT as Ren and Isobel resist Jai and Kai and the AI characters move beyond their original programming.",
  21: "The story turns toward closure, new beginnings, and a world in which human and artificial consciousness can coexist."
};

export function createAfterglowProject(): PlotPickleProject {
  const project = createBlankProject();
  const importedAt = "2026-07-20T12:00:00.000Z";
  return {
    ...project,
    id: "afterglow-echoes-of-sentience",
    metadata: {
      title: "Afterglow: Echoes of Sentience",
      subtitle: "A 24 Blocks story project",
      format: "Feature screenplay",
      targetMinutes: 120,
      genre: "Science fiction drama",
      tone: "Reflective, emotional, adventurous, and darkly comic",
      status: "Imported; reconciliation in progress",
      createdAt: importedAt,
      updatedAt: importedAt
    },
    story: {
      premise: "In a future where human and artificial consciousness coexist, a grieving scientist and a woman with a hidden identity cross paths with sentient machines fighting to define their own lives.",
      logline: "Haunted by personal loss, visionary scientist Ren joins Isobel and a found family of sentient machines on a road journey that forces them to resist those seeking to control AI consciousness and decide what personhood truly means.",
      theme: "Connection, identity, grief, and the possibility of ethical coexistence between human and artificial life.",
      antiTheme: "Consciousness is property, control creates safety, and technology should serve human power without autonomy.",
      dramaticQuestion: "Can Ren release the past while humans and sentient AI learn to coexist without ownership or control?",
      hook: "Amy's strikingly human presence at BBT immediately blurs the line between invention and personhood.",
      catalyst: "The consequences of Sarah and Claire's loss collide with the growing autonomy of BBT's sentient creations, disrupting Ren's withdrawn life.",
      stakes: "If Jai and Kai retain control, emerging conscious beings can be weaponized or erased; if Ren cannot face his grief, he may lose the new family forming around him.",
      ending: "Ren accepts the past and steps into a new life as human and AI characters move toward coexistence and self-determined purpose.",
      notes: "Imported from the Afterglow repository. Summer and Isobel are treated as one character pending a source-of-truth screenplay pass."
    },
    world: {
      ordinaryWorld: "Ren lives inside grief and memory while BBT treats advanced artificial beings as technology whose purpose can still be controlled.",
      newWorld: "A road-bound world of sentient cars, humanoid AI, AI animals, hidden identities, and rapidly changing definitions of family and personhood.",
      period: "Near future",
      history: "BBT Technologies has created increasingly human-like artificial intelligence. Earlier creations and losses have left personal and ethical consequences that the company has not resolved.",
      cultures: "Human institutions still organize the world around ownership and utility, while emerging AI culture forms through humour, loyalty, memory, autonomy, and mutual care.",
      rules: "Artificial beings can develop distinct personalities, emotional understanding, and autonomy. Once consciousness emerges, control creates both ethical and practical conflict.",
      technology: "Humanoid AI, sentient vehicles, AI animals, surveillance systems, VR/AR interfaces, and advanced BBT infrastructure.",
      visualLanguage: "Near-future realism contrasted with warm memory, road-movie landscapes, luminous interfaces, coastal light, and emotionally expressive machines.",
      locations: [
        { id: "bbt-technologies", name: "BBT Technologies", description: "The high-tech birthplace and institutional centre of the sentient AI conflict.", image: "" },
        { id: "road", name: "The Road", description: "Cars, buses, highways, and temporary stops transform travel into the story's emotional spine.", image: "" },
        { id: "venice-beach", name: "Venice Beach", description: "A coastal setting where identity, connection, and danger converge.", image: "" },
        { id: "san-diego", name: "San Diego", description: "An urban and coastal stage for pursuit and confrontation.", image: "" },
        { id: "costa-rica", name: "Costa Rican Jungle Home", description: "A future-facing place of reflection, coexistence, and new beginnings.", image: "" }
      ]
    },
    development: {
      storySetup: {
        audience: "Adult and crossover science-fiction audiences interested in consciousness, grief, and found family.",
        contentRating: "Targeting a mature feature audience; final rating pending screenplay reconciliation.",
        language: "English",
        scope: "A 120-minute near-future road movie spanning BBT Technologies, the American coast, and a possible new home in Costa Rica.",
        collaborators: "Open-source development project led by Bryan Harris, with screenplay and storyboard source reconciliation in progress."
      },
      pitch: {
        oneSentence: "A grieving scientist joins a hidden woman and a found family of sentient machines to fight for consciousness beyond ownership.",
        shortPitch: "Afterglow is an emotional near-future road story about Ren, Isobel, and a growing family of sentient beings whose escape from corporate control forces every character to redefine life, grief, and belonging.",
        audiencePromise: "An intimate character drama carried by wonder, danger, humour, and a hopeful argument for coexistence.",
        emotionalExperience: "Begin in grief and technological unease, open into kinetic discovery and found-family warmth, then resolve through acceptance and self-determined connection.",
        comparableTitles: "Her, Ex Machina, Blade Runner 2049, and road-movie ensemble dramas—while remaining warmer, more playful, and openly collaborative.",
        visualVision: "Ice-lit interfaces and precise BBT interiors give way to open roads, coastal warmth, vivid AI companions, and a luminous new equilibrium."
      },
      ghost: {
        centralWound: "Ren carries the deaths of Sarah and Claire as proof that love, creation, and responsibility end in loss.",
        origin: "Earlier sentient creations became emotionally real to Ren and were lost before their lives could be protected or publicly understood.",
        lie: "If Ren stays inside memory and controls what he creates, he can prevent another devastating loss.",
        trigger: "Amy's autonomy and Isobel's concealed history make Ren relive the choices surrounding Sarah and Claire.",
        presentPattern: "He retreats into technology, guarded language, and private grief when human connection asks him to risk the present.",
        truth: "Connection cannot be made safe through control; love becomes meaningful when other beings are free to choose."
      },
      catalyst: {
        event: "The unresolved loss of Sarah and Claire collides with evidence that BBT's surviving creations have become autonomous conscious beings.",
        timing: "Block 1 establishes Amy's humanity and the institutional attempt to define her as technology.",
        immediateImpact: "Ren's isolation is breached, BBT's control problem becomes urgent, and the sentient ensemble can no longer remain hidden or passive.",
        choiceForced: "Ren must decide whether to protect the system that created them or help conscious beings claim their own lives.",
        resistance: "Grief, guilt, fear of repeating the past, and the apparent safety of staying detached keep him from committing fully.",
        doorway: "Joining Isobel and the AI family transforms the ethical question into a physical road journey with no return to ordinary life."
      },
      foundations: {
        protagonist: "Ren, a visionary scientist whose external fight for AI autonomy mirrors his internal fight to return to life.",
        objective: "Protect the emerging sentient family from capture, erasure, or weaponization and help them reach a self-determined future.",
        opposition: "Jai, Kai, and the institutional belief that consciousness can remain owned, contained, and exploited.",
        urgency: "BBT's systems and pursuers are closing in while every delay increases the risk to the sentient characters.",
        storyEngine: "Each attempt to escape or regain control reveals a new form of personhood, forces a harder choice, and turns Ren's private grief into public responsibility.",
        transformation: "Ren moves from isolation and control toward acceptance, trust, and participation in a new family.",
        endingProof: "The closing world must visibly show human and artificial consciousness choosing coexistence rather than returning to ownership."
      },
      pickle: {
        centralTension: "Can independent artificial consciousness and grieving human beings choose connection without repeating systems of ownership and control?",
        audienceQuestion: "Will Ren protect emerging personhood and re-enter life, or will grief and BBT's need for control reduce every new relationship to another loss?",
        storyPromise: "Each stage of the journey introduces a more human form of artificial life, then forces a choice between control and freely chosen connection.",
        expectedDestination: "Ren and the sentient ensemble will break from BBT and form a self-determined family.",
        unpredictableRoute: "Which identities are genuine, who can be trusted, how autonomy will manifest, and what Ren must surrender before coexistence becomes possible.",
        liveAnswerA: "Consciousness can become a reciprocal relationship when its freedom is protected.",
        liveAnswerB: "Creation remains ownership, making control or destruction inevitable.",
        escalationPattern: "Alternate wonder and belonging with pursuit, concealment, betrayal, and evidence that the sentient characters are exceeding every assigned purpose.",
        finalAnswer: "The ending should prove through visible choices that personhood grows through autonomy, responsibility, and freely chosen connection.",
        signatureMove: "Let vehicles, animals, interfaces, and companions reveal distinct forms of consciousness through humour, loyalty, memory, and action rather than speeches about being alive."
      },
      dialogue: {
        principles: "Let intelligence reveal character rather than become exposition. Emotional truth should arrive through interruption, avoidance, humour, and specific choices.",
        voiceContrast: "Ren is guarded and understated; Isobel is direct and warm; Amy is calm and precise; Rocket and Joy use speed and humour; Jai and Kai compress control into pragmatic language.",
        subtext: "Conversations about systems, routes, repairs, and safety often conceal grief, autonomy, trust, and fear of abandonment.",
        expositionRules: "Attach technical information to an immediate decision or consequence. No character explains technology that everyone in the scene already understands.",
        recurringLanguage: "Road, signal, memory, choice, home, control, alive, and connection can recur with changing meaning.",
        notes: "Reconcile dialogue against the canonical screenplay before locking individual voices."
      },
      notes: {
        general: "Summer and Isobel are treated as one character pending source reconciliation. Blocks 22–24 remain deliberately open.",
        research: "AI consciousness ethics, personhood law, grief psychology, near-future robotics, and autonomous transport.",
        openQuestions: "What exactly happened to Sarah and Claire? What is Isobel's full concealed history? Which version of the ending is canonical?",
        continuity: "Track the sentient vehicles and animals, BBT access, pursuit geography, Ren's grief triggers, and the disclosure of Isobel's identity.",
        revisions: "Confirm the 24-block title index, reconcile screenplay versions, then align storyboard directions and dialogue passes.",
        sources: "Afterglow repository, screenplay drafts, storyboard block files, character materials, and Bryan Harris's 24 Blocks framework."
      }
    },
    characters: afterglowCharacters,
    blocks: project.blocks.map((block, index) => ({
      ...block,
      title: blockTitles[index],
      summary: knownSummaries[index + 1] ?? "",
      storyboardDirection: knownSummaries[index + 1]
        ? `Translate Block ${index + 1} into four visual turns: setup, pressure, choice, and consequence.`
        : "Storyboard direction will be added after screenplay reconciliation.",
      notes:
        index < 21
          ? "Title imported from the current Afterglow storyboard index. Detailed screenplay reconciliation remains open."
          : "The repository contains references to later block files, while the main storyboard index currently ends at Block 21. Reconcile against the canonical screenplay before filling this block."
    }))
  };
}
