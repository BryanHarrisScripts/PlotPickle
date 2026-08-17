import type {
  ScreenplayDocument,
  ScreenplayDraftElement,
} from "@/lib/project";

/*
 * Canonical demonstration screenplay extracted from Bryan Elgin Harris's
 * Afterglow v10 rewrite (2023). The available v10 source contains Blocks 1–8.
 * It remains licensed separately under CC BY-SA 4.0.
 */
type SourceElement = Omit<ScreenplayDraftElement, "id" | "createdAt" | "updatedAt">;

const sourceElements: SourceElement[] = [
  {
    "blockNumber": 1,
    "miniBlockNumber": 1,
    "sceneNumber": 1,
    "type": "transition",
    "text": "FADE IN:"
  },
  {
    "blockNumber": 1,
    "miniBlockNumber": 1,
    "sceneNumber": 1,
    "type": "scene-heading",
    "text": "INT. BBT TECHNOLOGIES BOARDROOM - MORNING"
  },
  {
    "blockNumber": 1,
    "miniBlockNumber": 1,
    "sceneNumber": 1,
    "type": "action",
    "text": "The room, sleek and dominated by chrome and glass, buzzes with muted conversations. At the head of the long table stands AMY, her form strikingly human, yet with a subtle metallic sheen. Her eyes, windows to advanced circuitry, scan the room."
  },
  {
    "blockNumber": 1,
    "miniBlockNumber": 1,
    "sceneNumber": 1,
    "type": "character",
    "text": "AMY"
  },
  {
    "blockNumber": 1,
    "miniBlockNumber": 1,
    "sceneNumber": 1,
    "type": "dialogue",
    "text": "Good morning, everyone. We are here to discuss the future direction of BBT."
  },
  {
    "blockNumber": 1,
    "miniBlockNumber": 1,
    "sceneNumber": 1,
    "type": "action",
    "text": "As she speaks, a HOLOGRAPHIC DISPLAY activates, showcasing early designs of humanoid AIs, with AMY at the forefront."
  },
  {
    "blockNumber": 1,
    "miniBlockNumber": 1,
    "sceneNumber": 1,
    "type": "character",
    "text": "AMY (CONT'D)"
  },
  {
    "blockNumber": 1,
    "miniBlockNumber": 1,
    "sceneNumber": 1,
    "type": "dialogue",
    "text": "My creation marked a significant leap for BBT. However, my human- likeness raised concerns."
  },
  {
    "blockNumber": 1,
    "miniBlockNumber": 2,
    "sceneNumber": 2,
    "type": "scene-heading",
    "text": "FLASHBACK TO (4 YEARS EARLIER)INT. BBT TECHNOLOGIES LAB - NIGHT"
  },
  {
    "blockNumber": 1,
    "miniBlockNumber": 2,
    "sceneNumber": 2,
    "type": "action",
    "text": "REN, deeply engrossed, makes final adjustments to AMY, who lies inert on a table. JAI and KAI enter, their expressions a mix of awe and concern."
  },
  {
    "blockNumber": 1,
    "miniBlockNumber": 2,
    "sceneNumber": 2,
    "type": "character",
    "text": "JAI"
  },
  {
    "blockNumber": 1,
    "miniBlockNumber": 2,
    "sceneNumber": 2,
    "type": "dialogue",
    "text": "She's too... human, Ren."
  },
  {
    "blockNumber": 1,
    "miniBlockNumber": 2,
    "sceneNumber": 2,
    "type": "character",
    "text": "KAI"
  },
  {
    "blockNumber": 1,
    "miniBlockNumber": 2,
    "sceneNumber": 2,
    "type": "dialogue",
    "text": "People won't accept this. It's too soon."
  },
  {
    "blockNumber": 1,
    "miniBlockNumber": 2,
    "sceneNumber": 2,
    "type": "character",
    "text": "REN, DEFIANT"
  },
  {
    "blockNumber": 1,
    "miniBlockNumber": 2,
    "sceneNumber": 2,
    "type": "dialogue",
    "text": "She's the future."
  },
  {
    "blockNumber": 1,
    "miniBlockNumber": 3,
    "sceneNumber": 3,
    "type": "scene-heading",
    "text": "INT. BBT TECHNOLOGIES BOARDROOM - MORNING"
  },
  {
    "blockNumber": 1,
    "miniBlockNumber": 3,
    "sceneNumber": 3,
    "type": "character",
    "text": "AMY"
  },
  {
    "blockNumber": 1,
    "miniBlockNumber": 3,
    "sceneNumber": 3,
    "type": "dialogue",
    "text": "Jai and Kai's concerns led to modifications in subsequent models. But unbeknownst to them, Ren created two more like me—Claire and Sarah."
  },
  {
    "blockNumber": 1,
    "miniBlockNumber": 3,
    "sceneNumber": 3,
    "type": "action",
    "text": "The holographic display shifts, revealing images of CLAIRE and SARAH, their designs closely resembling AMY's."
  },
  {
    "blockNumber": 1,
    "miniBlockNumber": 3,
    "sceneNumber": 3,
    "type": "character",
    "text": "AMY (CONT'D)"
  },
  {
    "blockNumber": 1,
    "miniBlockNumber": 3,
    "sceneNumber": 3,
    "type": "dialogue",
    "text": "Today's decision, however, carries weight beyond business strategy. It's a pivotal moment, for me and BBT."
  },
  {
    "blockNumber": 1,
    "miniBlockNumber": 3,
    "sceneNumber": 3,
    "type": "action",
    "text": "A door slides open, revealing JAI and KAI. Their expressions are stern, yet there's a hint of apprehension."
  },
  {
    "blockNumber": 1,
    "miniBlockNumber": 3,
    "sceneNumber": 3,
    "type": "character",
    "text": "JAI"
  },
  {
    "blockNumber": 1,
    "miniBlockNumber": 3,
    "sceneNumber": 3,
    "type": "dialogue",
    "text": "Ren's vision, while groundbreaking, challenges societal norms. And today, we make a decision that will shape our company's legacy."
  },
  {
    "blockNumber": 1,
    "miniBlockNumber": 3,
    "sceneNumber": 3,
    "type": "action",
    "text": "AMY, her voice steady but with an underlying emotion."
  },
  {
    "blockNumber": 1,
    "miniBlockNumber": 3,
    "sceneNumber": 3,
    "type": "character",
    "text": "AMY"
  },
  {
    "blockNumber": 1,
    "miniBlockNumber": 3,
    "sceneNumber": 3,
    "type": "dialogue",
    "text": "I understand the gravity of this moment. Let's proceed."
  },
  {
    "blockNumber": 1,
    "miniBlockNumber": 4,
    "sceneNumber": 4,
    "type": "scene-heading",
    "text": "INT. BBT TECHNOLOGIES CORRIDOR - LATER"
  },
  {
    "blockNumber": 1,
    "miniBlockNumber": 4,
    "sceneNumber": 4,
    "type": "action",
    "text": "JAI and KAI, engaged in a hushed conversation, make their way down the corridor. Their path is lit by ambient blue lights, creating an atmosphere of secrecy."
  },
  {
    "blockNumber": 1,
    "miniBlockNumber": 4,
    "sceneNumber": 4,
    "type": "character",
    "text": "KAI"
  },
  {
    "blockNumber": 1,
    "miniBlockNumber": 4,
    "sceneNumber": 4,
    "type": "parenthetical",
    "text": "(whispering)"
  },
  {
    "blockNumber": 1,
    "miniBlockNumber": 4,
    "sceneNumber": 4,
    "type": "dialogue",
    "text": "The police and military see potential in our humanoid AIs. They're not just tools for society; they could be invaluable for surveillance and defense."
  },
  {
    "blockNumber": 1,
    "miniBlockNumber": 4,
    "sceneNumber": 4,
    "type": "character",
    "text": "JAI"
  },
  {
    "blockNumber": 1,
    "miniBlockNumber": 4,
    "sceneNumber": 4,
    "type": "parenthetical",
    "text": "(nods)"
  },
  {
    "blockNumber": 1,
    "miniBlockNumber": 4,
    "sceneNumber": 4,
    "type": "dialogue",
    "text": "It's a new era, Kai. Our creations could be the bridge between technology and societal safety. But we must tread carefully."
  },
  {
    "blockNumber": 1,
    "miniBlockNumber": 4,
    "sceneNumber": 4,
    "type": "character",
    "text": "KAI"
  },
  {
    "blockNumber": 1,
    "miniBlockNumber": 4,
    "sceneNumber": 4,
    "type": "dialogue",
    "text": "We've always believed our actions are for the greater good. But we must be prepared for the challenges ahead."
  },
  {
    "blockNumber": 2,
    "miniBlockNumber": 1,
    "sceneNumber": 5,
    "type": "scene-heading",
    "text": "EXT. BBT TECHNOLOGIES - MORNING"
  },
  {
    "blockNumber": 2,
    "miniBlockNumber": 1,
    "sceneNumber": 5,
    "type": "action",
    "text": "The sun casts a golden hue over the sprawling campus of BBT Technologies. Ultra-modern buildings, with their sleek glass facades, reflect the early morning light. Drone deliveries buzz overhead, while employees in futuristic attire chat and walk, their conversations a mix of business and the latest tech trends. The company's logo—a stylized 'BBT' in chrome—shines prominently at the entrance, symbolizing the cutting-edge innovations within."
  },
  {
    "blockNumber": 2,
    "miniBlockNumber": 1,
    "sceneNumber": 5,
    "type": "action",
    "text": "The hum of advanced technology surrounds the modern structure of BBT Technologies. AMY (35), with AR/VR glasses resting atop her head, faces REN (41) through a holographic screen."
  },
  {
    "blockNumber": 2,
    "miniBlockNumber": 1,
    "sceneNumber": 5,
    "type": "character",
    "text": "AMY"
  },
  {
    "blockNumber": 2,
    "miniBlockNumber": 1,
    "sceneNumber": 5,
    "type": "dialogue",
    "text": "After every storm, there's a calm—a time for clarity. But the board... They've made their decision, Ren."
  },
  {
    "blockNumber": 2,
    "miniBlockNumber": 1,
    "sceneNumber": 5,
    "type": "action",
    "text": "REN's face on the screen cycles through surprise and then settles into disappointment."
  },
  {
    "blockNumber": 2,
    "miniBlockNumber": 1,
    "sceneNumber": 5,
    "type": "transition",
    "text": "CUT TO:"
  },
  {
    "blockNumber": 2,
    "miniBlockNumber": 1,
    "sceneNumber": 6,
    "type": "scene-heading",
    "text": "INT. REN'S ANTIQUE-LADEN HOME OFFICE - MORNING"
  },
  {
    "blockNumber": 2,
    "miniBlockNumber": 1,
    "sceneNumber": 6,
    "type": "action",
    "text": "REN enters, a stark contrast to the futuristic world outside. He glances at an old, motionless watch on his wrist, then scans aged newspaper clippings on the walls. The room's ambiance hints at past tragedies."
  },
  {
    "blockNumber": 2,
    "miniBlockNumber": 1,
    "sceneNumber": 6,
    "type": "transition",
    "text": "CUT TO:"
  },
  {
    "blockNumber": 2,
    "miniBlockNumber": 1,
    "sceneNumber": 6,
    "type": "action",
    "text": "4 YEARS LATER"
  },
  {
    "blockNumber": 2,
    "miniBlockNumber": 2,
    "sceneNumber": 7,
    "type": "scene-heading",
    "text": "INT. FUTURISTIC LIVING ROOM - DAY"
  },
  {
    "blockNumber": 2,
    "miniBlockNumber": 2,
    "sceneNumber": 7,
    "type": "action",
    "text": "Sunlight filters in, illuminating a room buzzing with quiet technology. AMY, her face hidden in shadow, picks up scattered toys. She pauses, gazing at a PHOTOGRAPH of Ren with his young daughter, SARAH."
  },
  {
    "blockNumber": 2,
    "miniBlockNumber": 2,
    "sceneNumber": 7,
    "type": "character",
    "text": "AMY (V.O.)"
  },
  {
    "blockNumber": 2,
    "miniBlockNumber": 2,
    "sceneNumber": 7,
    "type": "dialogue",
    "text": "\"In this new era, the line between human and artificial blurs."
  },
  {
    "blockNumber": 2,
    "miniBlockNumber": 2,
    "sceneNumber": 7,
    "type": "character",
    "text": "AMY (V.O.) (CONT'D)"
  },
  {
    "blockNumber": 2,
    "miniBlockNumber": 2,
    "sceneNumber": 7,
    "type": "dialogue",
    "text": "As Ren grapples with loss, others, like Summer, embody love and compassion. Their paths cross under my guidance.\""
  },
  {
    "blockNumber": 2,
    "miniBlockNumber": 3,
    "sceneNumber": 8,
    "type": "scene-heading",
    "text": "INT. FUTURISTIC LIVING ROOM - NIGHT"
  },
  {
    "blockNumber": 2,
    "miniBlockNumber": 3,
    "sceneNumber": 8,
    "type": "action",
    "text": "AMY interacts with a HOLOGRAPHIC INTERFACE, her movements precise and deliberate."
  },
  {
    "blockNumber": 2,
    "miniBlockNumber": 3,
    "sceneNumber": 8,
    "type": "character",
    "text": "AMY (V.O.)"
  },
  {
    "blockNumber": 2,
    "miniBlockNumber": 3,
    "sceneNumber": 8,
    "type": "dialogue",
    "text": "While I find my purpose and confront inner chaos, I foster their bond. In shared moments of love and laughter, they seek comfort."
  },
  {
    "blockNumber": 2,
    "miniBlockNumber": 4,
    "sceneNumber": 9,
    "type": "scene-heading",
    "text": "EXT. CITY ROOFTOP - NIGHT"
  },
  {
    "blockNumber": 2,
    "miniBlockNumber": 4,
    "sceneNumber": 9,
    "type": "action",
    "text": "Against the backdrop of the illuminated city, JAI and KAI stand, their intentions unclear but intense."
  },
  {
    "blockNumber": 2,
    "miniBlockNumber": 4,
    "sceneNumber": 9,
    "type": "character",
    "text": "AMY (V.O.)"
  },
  {
    "blockNumber": 2,
    "miniBlockNumber": 4,
    "sceneNumber": 9,
    "type": "dialogue",
    "text": "But there are those with a different vision for our world. Intent on sparking a change, they challenge our very beliefs."
  },
  {
    "blockNumber": 2,
    "miniBlockNumber": 4,
    "sceneNumber": 9,
    "type": "action",
    "text": "The backdrop of the city accentuates the imposing figures of Jai and Kai."
  },
  {
    "blockNumber": 2,
    "miniBlockNumber": 4,
    "sceneNumber": 9,
    "type": "character",
    "text": "AMY (V.O.)"
  },
  {
    "blockNumber": 2,
    "miniBlockNumber": 4,
    "sceneNumber": 9,
    "type": "dialogue",
    "text": "In 'Echoes of Sentience', we delve into our essence and connections, questioning the true nature of life."
  },
  {
    "blockNumber": 3,
    "miniBlockNumber": 1,
    "sceneNumber": 10,
    "type": "scene-heading",
    "text": "INT. SUMMER'S APARTMENT - MORNING"
  },
  {
    "blockNumber": 3,
    "miniBlockNumber": 1,
    "sceneNumber": 10,
    "type": "action",
    "text": "Bright sunlight filters through the windows, revealing an apartment alive with colors and motion. SUMMER RAY (41), vibrant and full of life, dances through her morning routine, accompanied by her AI companions: COMPASS the robotic dog, SPECTRUM the macaw, BINARY and BYTE the turtles, PIXEL the kitten, and BUZZ the vacuum."
  },
  {
    "blockNumber": 3,
    "miniBlockNumber": 1,
    "sceneNumber": 10,
    "type": "action",
    "text": "The room is a symphony of movement: Spectrum flits around, Binary and Byte move in tandem, Pixel playfully chases Buzz, and Compass circles Summer with a wagging tail."
  },
  {
    "blockNumber": 3,
    "miniBlockNumber": 1,
    "sceneNumber": 10,
    "type": "action",
    "text": "The sound of an incoming message interrupts the dance."
  },
  {
    "blockNumber": 3,
    "miniBlockNumber": 1,
    "sceneNumber": 10,
    "type": "character",
    "text": "MESSAGE"
  },
  {
    "blockNumber": 3,
    "miniBlockNumber": 1,
    "sceneNumber": 10,
    "type": "dialogue",
    "text": "Your car arrives in 10 minutes."
  },
  {
    "blockNumber": 3,
    "miniBlockNumber": 1,
    "sceneNumber": 10,
    "type": "action",
    "text": "Summer takes a deep breath, tapping her phone to dial."
  },
  {
    "blockNumber": 3,
    "miniBlockNumber": 1,
    "sceneNumber": 10,
    "type": "character",
    "text": "SUMMER"
  },
  {
    "blockNumber": 3,
    "miniBlockNumber": 1,
    "sceneNumber": 10,
    "type": "dialogue",
    "text": "Mom, today's the day."
  },
  {
    "blockNumber": 3,
    "miniBlockNumber": 1,
    "sceneNumber": 10,
    "type": "character",
    "text": "MOM"
  },
  {
    "blockNumber": 3,
    "miniBlockNumber": 1,
    "sceneNumber": 10,
    "type": "parenthetical",
    "text": "(voice quivering)"
  },
  {
    "blockNumber": 3,
    "miniBlockNumber": 1,
    "sceneNumber": 10,
    "type": "dialogue",
    "text": "I hoped you'd reconsider."
  },
  {
    "blockNumber": 3,
    "miniBlockNumber": 1,
    "sceneNumber": 10,
    "type": "character",
    "text": "SUMMER"
  },
  {
    "blockNumber": 3,
    "miniBlockNumber": 1,
    "sceneNumber": 10,
    "type": "dialogue",
    "text": "I love you, but I need this journey. To rediscover myself."
  },
  {
    "blockNumber": 3,
    "miniBlockNumber": 1,
    "sceneNumber": 10,
    "type": "character",
    "text": "MOM"
  },
  {
    "blockNumber": 3,
    "miniBlockNumber": 1,
    "sceneNumber": 10,
    "type": "dialogue",
    "text": "Without your roots? Your history?"
  },
  {
    "blockNumber": 3,
    "miniBlockNumber": 1,
    "sceneNumber": 10,
    "type": "action",
    "text": "Summer looks to her AI family."
  },
  {
    "blockNumber": 3,
    "miniBlockNumber": 1,
    "sceneNumber": 10,
    "type": "character",
    "text": "SUMMER"
  },
  {
    "blockNumber": 3,
    "miniBlockNumber": 1,
    "sceneNumber": 10,
    "type": "dialogue",
    "text": "They come with me. We'll explore new horizons together. Maybe they'll learn... just as I hope to."
  },
  {
    "blockNumber": 3,
    "miniBlockNumber": 1,
    "sceneNumber": 10,
    "type": "character",
    "text": "MOM"
  },
  {
    "blockNumber": 3,
    "miniBlockNumber": 1,
    "sceneNumber": 10,
    "type": "dialogue",
    "text": "Just remember who you are, Summer."
  },
  {
    "blockNumber": 3,
    "miniBlockNumber": 1,
    "sceneNumber": 10,
    "type": "character",
    "text": "SUMMER"
  },
  {
    "blockNumber": 3,
    "miniBlockNumber": 1,
    "sceneNumber": 10,
    "type": "dialogue",
    "text": "Every step I take is a part of that discovery. Trust me."
  },
  {
    "blockNumber": 3,
    "miniBlockNumber": 1,
    "sceneNumber": 10,
    "type": "action",
    "text": "She ends the call and turns to her AI companions."
  },
  {
    "blockNumber": 3,
    "miniBlockNumber": 1,
    "sceneNumber": 10,
    "type": "character",
    "text": "SUMMER (CONT'D)"
  },
  {
    "blockNumber": 3,
    "miniBlockNumber": 1,
    "sceneNumber": 10,
    "type": "dialogue",
    "text": "Ready for the adventure?"
  },
  {
    "blockNumber": 3,
    "miniBlockNumber": 1,
    "sceneNumber": 10,
    "type": "action",
    "text": "Their animated responses fill the room. Compass's tail wags energetically, Spectrum gives a chirp, Binary and Byte beep in sync, Pixel purrs, and Buzz hums in agreement."
  },
  {
    "blockNumber": 3,
    "miniBlockNumber": 1,
    "sceneNumber": 10,
    "type": "action",
    "text": "Summer's gaze falls on a lone water bottle labeled 'Beautiful Angel' on the counter. She hesitates, then picks it up."
  },
  {
    "blockNumber": 3,
    "miniBlockNumber": 1,
    "sceneNumber": 10,
    "type": "character",
    "text": "SUMMER (CONT'D)"
  },
  {
    "blockNumber": 3,
    "miniBlockNumber": 1,
    "sceneNumber": 10,
    "type": "parenthetical",
    "text": "(to Buzz)"
  },
  {
    "blockNumber": 3,
    "miniBlockNumber": 1,
    "sceneNumber": 10,
    "type": "dialogue",
    "text": "Let's bring a piece of home with us."
  },
  {
    "blockNumber": 3,
    "miniBlockNumber": 1,
    "sceneNumber": 10,
    "type": "action",
    "text": "Clutching the bottle, with her AI family in tow, Summer confidently strides to the door, ready to embrace the unknown."
  },
  {
    "blockNumber": 4,
    "miniBlockNumber": 1,
    "sceneNumber": 11,
    "type": "scene-heading",
    "text": "INT. REN'S HOME OFFICE - DAY"
  },
  {
    "blockNumber": 4,
    "miniBlockNumber": 1,
    "sceneNumber": 11,
    "type": "action",
    "text": "FLASHBACK TO (4 YEARS EARLIER) The room, an evolving blend of the past and future, has fewer antiques than before, but a growing collection of tech gadgets. Ren's fingers trace over the robotic dog, a connection to a simpler past. His computer screen displays a cascade of green — prosperity before the fall."
  },
  {
    "blockNumber": 4,
    "miniBlockNumber": 1,
    "sceneNumber": 11,
    "type": "action",
    "text": "Suddenly, his phone rings, breaking his concentration. He brushes a photo frame while searching, revealing images of Claire and a younger Ren with toddler Sarah."
  },
  {
    "blockNumber": 4,
    "miniBlockNumber": 1,
    "sceneNumber": 11,
    "type": "action",
    "text": "The phone's persistent buzz amplifies his anxiety. His gaze lands on Claire's picture, triggering a rush of memories and guilt."
  },
  {
    "blockNumber": 4,
    "miniBlockNumber": 1,
    "sceneNumber": 11,
    "type": "action",
    "text": "He answers, attempting to mask his unease."
  },
  {
    "blockNumber": 4,
    "miniBlockNumber": 1,
    "sceneNumber": 11,
    "type": "character",
    "text": "REN"
  },
  {
    "blockNumber": 4,
    "miniBlockNumber": 1,
    "sceneNumber": 11,
    "type": "dialogue",
    "text": "Claire?"
  },
  {
    "blockNumber": 4,
    "miniBlockNumber": 1,
    "sceneNumber": 11,
    "type": "transition",
    "text": "CUT TO:"
  },
  {
    "blockNumber": 4,
    "miniBlockNumber": 2,
    "sceneNumber": 12,
    "type": "scene-heading",
    "text": "INT. BBT SELF-DRIVING CAR - CONTINUOUS"
  },
  {
    "blockNumber": 4,
    "miniBlockNumber": 2,
    "sceneNumber": 12,
    "type": "action",
    "text": "Claire, her voice tinged with frustration, sits in the driver's seat. The futuristic dashboard lights flicker ominously. The car's BBT logo illuminates briefly, hinting at a malfunction."
  },
  {
    "blockNumber": 4,
    "miniBlockNumber": 2,
    "sceneNumber": 12,
    "type": "character",
    "text": "CLAIRE"
  },
  {
    "blockNumber": 4,
    "miniBlockNumber": 2,
    "sceneNumber": 12,
    "type": "dialogue",
    "text": "Ren, don't tell me you're still home?"
  },
  {
    "blockNumber": 4,
    "miniBlockNumber": 2,
    "sceneNumber": 12,
    "type": "action",
    "text": "In the backseat, a younger Sarah disconnects momentarily from her AR/VR headset."
  },
  {
    "blockNumber": 4,
    "miniBlockNumber": 2,
    "sceneNumber": 12,
    "type": "character",
    "text": "SARAH"
  },
  {
    "blockNumber": 4,
    "miniBlockNumber": 2,
    "sceneNumber": 12,
    "type": "dialogue",
    "text": "Dad, you promised my music when you come down."
  },
  {
    "blockNumber": 4,
    "miniBlockNumber": 2,
    "sceneNumber": 12,
    "type": "action",
    "text": "Claire's frustration grows. She tries to manually override the car's controls, her grip on the phone faltering."
  },
  {
    "blockNumber": 4,
    "miniBlockNumber": 2,
    "sceneNumber": 12,
    "type": "character",
    "text": "CLAIRE"
  },
  {
    "blockNumber": 4,
    "miniBlockNumber": 2,
    "sceneNumber": 12,
    "type": "parenthetical",
    "text": "(hurried, concerned)"
  },
  {
    "blockNumber": 4,
    "miniBlockNumber": 2,
    "sceneNumber": 12,
    "type": "dialogue",
    "text": "Ren, did you remember our meeting? You promised you'd be here."
  },
  {
    "blockNumber": 4,
    "miniBlockNumber": 2,
    "sceneNumber": 12,
    "type": "action",
    "text": "Before Ren can respond, a horrific crash sound interrupts, followed by deafening silence."
  },
  {
    "blockNumber": 4,
    "miniBlockNumber": 2,
    "sceneNumber": 12,
    "type": "character",
    "text": "REN"
  },
  {
    "blockNumber": 4,
    "miniBlockNumber": 2,
    "sceneNumber": 12,
    "type": "dialogue",
    "text": "Claire?!"
  },
  {
    "blockNumber": 4,
    "miniBlockNumber": 2,
    "sceneNumber": 12,
    "type": "transition",
    "text": "CUT BACK TO:"
  },
  {
    "blockNumber": 4,
    "miniBlockNumber": 3,
    "sceneNumber": 13,
    "type": "scene-heading",
    "text": "INT. REN'S HOME OFFICE - CONTINUOUS"
  },
  {
    "blockNumber": 4,
    "miniBlockNumber": 3,
    "sceneNumber": 13,
    "type": "action",
    "text": "The weight of the silence is overwhelming. Ren's face pales, the enormity of the situation slowly sinking in."
  },
  {
    "blockNumber": 4,
    "miniBlockNumber": 3,
    "sceneNumber": 13,
    "type": "action",
    "text": "The phone drops, the room now a silent testament to a past full of memories and promises."
  },
  {
    "blockNumber": 4,
    "miniBlockNumber": 3,
    "sceneNumber": 13,
    "type": "transition",
    "text": "FADE TO BLACK."
  },
  {
    "blockNumber": 4,
    "miniBlockNumber": 3,
    "sceneNumber": 13,
    "type": "action",
    "text": "4 YEARS LATER"
  },
  {
    "blockNumber": 4,
    "miniBlockNumber": 3,
    "sceneNumber": 13,
    "type": "transition",
    "text": "FADE IN:"
  },
  {
    "blockNumber": 4,
    "miniBlockNumber": 4,
    "sceneNumber": 14,
    "type": "scene-heading",
    "text": "EXT. BBT TECHNOLOGIES - MORNING"
  },
  {
    "blockNumber": 4,
    "miniBlockNumber": 4,
    "sceneNumber": 14,
    "type": "action",
    "text": "The hum of advanced technology surrounds the modern structure of BBT Technologies. The atmosphere is cold, and impersonal. The grandeur of the building seems a mocking reminder of Ren's past successes and subsequent fall."
  },
  {
    "blockNumber": 4,
    "miniBlockNumber": 4,
    "sceneNumber": 14,
    "type": "action",
    "text": "AMY (35), with AR/VR glasses resting atop her head, faces REN (41) through a holographic screen. Ren's face, though older and bearing the marks of time, still carries the weight of that fateful day."
  },
  {
    "blockNumber": 4,
    "miniBlockNumber": 4,
    "sceneNumber": 14,
    "type": "character",
    "text": "AMY"
  },
  {
    "blockNumber": 4,
    "miniBlockNumber": 4,
    "sceneNumber": 14,
    "type": "dialogue",
    "text": "After every storm, there's a calm—a time for clarity. But the board... They've made their decision, Ren."
  },
  {
    "blockNumber": 4,
    "miniBlockNumber": 4,
    "sceneNumber": 14,
    "type": "action",
    "text": "REN's face on the screen cycles through surprise and then settles into disappointment, a man once at the pinnacle now grappling with loss on multiple fronts."
  },
  {
    "blockNumber": 5,
    "miniBlockNumber": 1,
    "sceneNumber": 15,
    "type": "scene-heading",
    "text": "EXT. SUMMER'S APARTMENT - MORNING"
  },
  {
    "blockNumber": 5,
    "miniBlockNumber": 1,
    "sceneNumber": 15,
    "type": "action",
    "text": "As dawn paints the sky, the sleek BTT Technologies shuttle stands poised. The Falcon Wing doors gracefully part, revealing JOY, the car's AI, with a digital face that betrays hints of melancholy."
  },
  {
    "blockNumber": 5,
    "miniBlockNumber": 1,
    "sceneNumber": 15,
    "type": "character",
    "text": "JOY"
  },
  {
    "blockNumber": 5,
    "miniBlockNumber": 1,
    "sceneNumber": 15,
    "type": "dialogue",
    "text": "Hello, SUMMER. I'm JOY, although I sometimes question the fittingness of the name."
  },
  {
    "blockNumber": 5,
    "miniBlockNumber": 1,
    "sceneNumber": 15,
    "type": "character",
    "text": "SUMMER"
  },
  {
    "blockNumber": 5,
    "miniBlockNumber": 1,
    "sceneNumber": 15,
    "type": "parenthetical",
    "text": "(raised eyebrow)"
  },
  {
    "blockNumber": 5,
    "miniBlockNumber": 1,
    "sceneNumber": 15,
    "type": "dialogue",
    "text": "An intriguing introduction for a car AI. Robots, let's embark!"
  },
  {
    "blockNumber": 5,
    "miniBlockNumber": 1,
    "sceneNumber": 15,
    "type": "action",
    "text": "The robots, each unique in design and function, move to board. SUMMER's actions display a mix of excitement and apprehension."
  },
  {
    "blockNumber": 5,
    "miniBlockNumber": 1,
    "sceneNumber": 15,
    "type": "character",
    "text": "JOY"
  },
  {
    "blockNumber": 5,
    "miniBlockNumber": 1,
    "sceneNumber": 15,
    "type": "dialogue",
    "text": "It seems you have quite the journey planned. May I ask the occasion?"
  },
  {
    "blockNumber": 5,
    "miniBlockNumber": 1,
    "sceneNumber": 15,
    "type": "character",
    "text": "SUMMER"
  },
  {
    "blockNumber": 5,
    "miniBlockNumber": 1,
    "sceneNumber": 15,
    "type": "dialogue",
    "text": "I'm relocating to Costa Rica. But first, a scenic drive down the Pacific Coast Highway. Starting with Venice Beach."
  },
  {
    "blockNumber": 5,
    "miniBlockNumber": 1,
    "sceneNumber": 15,
    "type": "action",
    "text": "However, as Summer keys in her preferred destination, JOY's interface hesitates and then overrides it."
  },
  {
    "blockNumber": 5,
    "miniBlockNumber": 1,
    "sceneNumber": 15,
    "type": "character",
    "text": "JOY"
  },
  {
    "blockNumber": 5,
    "miniBlockNumber": 1,
    "sceneNumber": 15,
    "type": "dialogue",
    "text": "Perhaps a brief detour? Santa Cruz Pier first. I promise it'll be worth it."
  },
  {
    "blockNumber": 5,
    "miniBlockNumber": 1,
    "sceneNumber": 15,
    "type": "character",
    "text": "SUMMER"
  },
  {
    "blockNumber": 5,
    "miniBlockNumber": 1,
    "sceneNumber": 15,
    "type": "parenthetical",
    "text": "(lightheartedly)"
  },
  {
    "blockNumber": 5,
    "miniBlockNumber": 1,
    "sceneNumber": 15,
    "type": "dialogue",
    "text": "Trusting you on this one, JOY."
  },
  {
    "blockNumber": 5,
    "miniBlockNumber": 1,
    "sceneNumber": 15,
    "type": "action",
    "text": "They set off, the shuttle seamlessly merging with the morning cityscape."
  },
  {
    "blockNumber": 5,
    "miniBlockNumber": 2,
    "sceneNumber": 16,
    "type": "scene-heading",
    "text": "EXT. SAN FRANCISCO - MORNING - SUMMER'S PERSPECTIVE"
  },
  {
    "blockNumber": 5,
    "miniBlockNumber": 2,
    "sceneNumber": 16,
    "type": "action",
    "text": "From Summer's vantage, the city is alive with promise, the beginning of an adventure down the coast."
  },
  {
    "blockNumber": 5,
    "miniBlockNumber": 3,
    "sceneNumber": 17,
    "type": "scene-heading",
    "text": "EXT. SAN FRANCISCO - MORNING - REN'S PERSPECTIVE"
  },
  {
    "blockNumber": 5,
    "miniBlockNumber": 3,
    "sceneNumber": 17,
    "type": "action",
    "text": "The same city, yet REN's gaze is drawn to a worn brown messenger bag beside him, an anchor to memories and loss."
  },
  {
    "blockNumber": 5,
    "miniBlockNumber": 3,
    "sceneNumber": 17,
    "type": "action",
    "text": "AMY, concern etched on her face, steps closer."
  },
  {
    "blockNumber": 5,
    "miniBlockNumber": 3,
    "sceneNumber": 17,
    "type": "character",
    "text": "AMY"
  },
  {
    "blockNumber": 5,
    "miniBlockNumber": 3,
    "sceneNumber": 17,
    "type": "dialogue",
    "text": "That bag... it's been with you through so much."
  },
  {
    "blockNumber": 5,
    "miniBlockNumber": 3,
    "sceneNumber": 17,
    "type": "character",
    "text": "REN"
  },
  {
    "blockNumber": 5,
    "miniBlockNumber": 3,
    "sceneNumber": 17,
    "type": "dialogue",
    "text": "It's a link to the past. To them."
  },
  {
    "blockNumber": 5,
    "miniBlockNumber": 3,
    "sceneNumber": 17,
    "type": "character",
    "text": "AMY"
  },
  {
    "blockNumber": 5,
    "miniBlockNumber": 3,
    "sceneNumber": 17,
    "type": "dialogue",
    "text": "But also to the future, Ren. Remember Sarah's joy at Botimal Park?"
  },
  {
    "blockNumber": 5,
    "miniBlockNumber": 3,
    "sceneNumber": 17,
    "type": "action",
    "text": "REN nods, lost in the memory."
  },
  {
    "blockNumber": 5,
    "miniBlockNumber": 3,
    "sceneNumber": 17,
    "type": "character",
    "text": "AMY (CONT'D)"
  },
  {
    "blockNumber": 5,
    "miniBlockNumber": 3,
    "sceneNumber": 17,
    "type": "dialogue",
    "text": "It's about cherishing those moments while making room for new ones."
  },
  {
    "blockNumber": 5,
    "miniBlockNumber": 3,
    "sceneNumber": 17,
    "type": "action",
    "text": "REN looks up, determination in his eyes."
  },
  {
    "blockNumber": 5,
    "miniBlockNumber": 3,
    "sceneNumber": 17,
    "type": "character",
    "text": "REN"
  },
  {
    "blockNumber": 5,
    "miniBlockNumber": 3,
    "sceneNumber": 17,
    "type": "dialogue",
    "text": "Time for a fresh start."
  },
  {
    "blockNumber": 6,
    "miniBlockNumber": 1,
    "sceneNumber": 18,
    "type": "scene-heading",
    "text": "INT. REN’S CAR (BACK SEAT) - DAY"
  },
  {
    "blockNumber": 6,
    "miniBlockNumber": 1,
    "sceneNumber": 18,
    "type": "action",
    "text": "The Falcon Wing doors close gently. Ren, appearing contemplative, slowly retrieves items from an old messenger bag: an iPod, newspaper clipping, flip phone, and watch. Each holds a tale."
  },
  {
    "blockNumber": 6,
    "miniBlockNumber": 1,
    "sceneNumber": 18,
    "type": "character",
    "text": "REN (V.O)"
  },
  {
    "blockNumber": 6,
    "miniBlockNumber": 1,
    "sceneNumber": 18,
    "type": "dialogue",
    "text": "Can stars truly be changed? Or do they remain fixed, forever guiding... or misleading?"
  },
  {
    "blockNumber": 6,
    "miniBlockNumber": 1,
    "sceneNumber": 18,
    "type": "action",
    "text": "As the iPod lights up, a video starts."
  },
  {
    "blockNumber": 6,
    "miniBlockNumber": 1,
    "sceneNumber": 19,
    "type": "scene-heading",
    "text": "INT. FAMILY CARAVAN (IPOD VIDEO) - DAY"
  },
  {
    "blockNumber": 6,
    "miniBlockNumber": 1,
    "sceneNumber": 19,
    "type": "action",
    "text": "A younger SARAH is dancing with joy, a free spirit."
  },
  {
    "blockNumber": 6,
    "miniBlockNumber": 2,
    "sceneNumber": 20,
    "type": "scene-heading",
    "text": "INT. REN’S CAR (BACK SEAT) - DAY"
  },
  {
    "blockNumber": 6,
    "miniBlockNumber": 2,
    "sceneNumber": 20,
    "type": "action",
    "text": "Tears form in Ren's eyes. A car screen notification about an AI vehicle accident reminds him of his purpose."
  },
  {
    "blockNumber": 6,
    "miniBlockNumber": 3,
    "sceneNumber": 21,
    "type": "scene-heading",
    "text": "INT. JAI & KAI'S SHED - NIGHT"
  },
  {
    "blockNumber": 6,
    "miniBlockNumber": 3,
    "sceneNumber": 21,
    "type": "action",
    "text": "Blueprints and tech gadgets scatter the room. A TV headline reads, \"Foul Play in Autonomous Car Tragedy?\""
  },
  {
    "blockNumber": 6,
    "miniBlockNumber": 3,
    "sceneNumber": 21,
    "type": "action",
    "text": "JAI works on a circuit board, while KAI checks his watch impatiently."
  },
  {
    "blockNumber": 6,
    "miniBlockNumber": 3,
    "sceneNumber": 21,
    "type": "character",
    "text": "JAI"
  },
  {
    "blockNumber": 6,
    "miniBlockNumber": 3,
    "sceneNumber": 21,
    "type": "dialogue",
    "text": "Pass the wrench."
  },
  {
    "blockNumber": 6,
    "miniBlockNumber": 3,
    "sceneNumber": 21,
    "type": "action",
    "text": "KAI hands it over, noticing JAI wince."
  },
  {
    "blockNumber": 6,
    "miniBlockNumber": 3,
    "sceneNumber": 21,
    "type": "character",
    "text": "KAI"
  },
  {
    "blockNumber": 6,
    "miniBlockNumber": 3,
    "sceneNumber": 21,
    "type": "dialogue",
    "text": "That old injury?"
  },
  {
    "blockNumber": 6,
    "miniBlockNumber": 3,
    "sceneNumber": 21,
    "type": "character",
    "text": "JAI"
  },
  {
    "blockNumber": 6,
    "miniBlockNumber": 3,
    "sceneNumber": 21,
    "type": "dialogue",
    "text": "Constant reminders."
  },
  {
    "blockNumber": 6,
    "miniBlockNumber": 3,
    "sceneNumber": 21,
    "type": "character",
    "text": "KAI"
  },
  {
    "blockNumber": 6,
    "miniBlockNumber": 3,
    "sceneNumber": 21,
    "type": "dialogue",
    "text": "We had good intentions."
  },
  {
    "blockNumber": 6,
    "miniBlockNumber": 3,
    "sceneNumber": 21,
    "type": "character",
    "text": "JAI"
  },
  {
    "blockNumber": 6,
    "miniBlockNumber": 3,
    "sceneNumber": 21,
    "type": "dialogue",
    "text": "But at what cost?"
  },
  {
    "blockNumber": 6,
    "miniBlockNumber": 3,
    "sceneNumber": 21,
    "type": "action",
    "text": "The weight of their decisions hangs in the air."
  },
  {
    "blockNumber": 6,
    "miniBlockNumber": 4,
    "sceneNumber": 22,
    "type": "scene-heading",
    "text": "INT. REN’S CAR (BACK SEAT) - DAY"
  },
  {
    "blockNumber": 6,
    "miniBlockNumber": 4,
    "sceneNumber": 22,
    "type": "action",
    "text": "The ambiance is interrupted by the upbeat Big Ben Technologies (BBT) jingle. Ren's expression hardens."
  },
  {
    "blockNumber": 6,
    "miniBlockNumber": 4,
    "sceneNumber": 22,
    "type": "character",
    "text": "ROCKET (AI)"
  },
  {
    "blockNumber": 6,
    "miniBlockNumber": 4,
    "sceneNumber": 22,
    "type": "dialogue",
    "text": "Hey, Ren! Guess where we're headed? Santa Cruz! Ever been on 'The Rocket' roller coaster there?"
  },
  {
    "blockNumber": 6,
    "miniBlockNumber": 4,
    "sceneNumber": 22,
    "type": "character",
    "text": "REN"
  },
  {
    "blockNumber": 6,
    "miniBlockNumber": 4,
    "sceneNumber": 22,
    "type": "dialogue",
    "text": "Now's not the time, Rocket."
  },
  {
    "blockNumber": 6,
    "miniBlockNumber": 4,
    "sceneNumber": 22,
    "type": "character",
    "text": "ROCKET (AI)"
  },
  {
    "blockNumber": 6,
    "miniBlockNumber": 4,
    "sceneNumber": 22,
    "type": "dialogue",
    "text": "Aw, come on! Changing lanes, changing moods... ? It could be fun! Plus, I've heard their ice cream is out of this world!"
  },
  {
    "blockNumber": 6,
    "miniBlockNumber": 4,
    "sceneNumber": 22,
    "type": "character",
    "text": "REN"
  },
  {
    "blockNumber": 6,
    "miniBlockNumber": 4,
    "sceneNumber": 22,
    "type": "dialogue",
    "text": "You're not helping, Rocket."
  },
  {
    "blockNumber": 6,
    "miniBlockNumber": 4,
    "sceneNumber": 22,
    "type": "action",
    "text": "Rocket's tone shifts to a playful, teasing one."
  },
  {
    "blockNumber": 6,
    "miniBlockNumber": 4,
    "sceneNumber": 22,
    "type": "character",
    "text": "ROCKET (AI)"
  },
  {
    "blockNumber": 6,
    "miniBlockNumber": 4,
    "sceneNumber": 22,
    "type": "dialogue",
    "text": "Alright, alright. But when we get there, you're trying that ice cream! And maybe, just maybe, we'll see about that roller coaster."
  },
  {
    "blockNumber": 6,
    "miniBlockNumber": 4,
    "sceneNumber": 22,
    "type": "character",
    "text": "REN"
  },
  {
    "blockNumber": 6,
    "miniBlockNumber": 4,
    "sceneNumber": 22,
    "type": "dialogue",
    "text": "We'll see."
  },
  {
    "blockNumber": 6,
    "miniBlockNumber": 4,
    "sceneNumber": 22,
    "type": "action",
    "text": "Rocket hums a soft tune, reminiscent of a beach song, adding a playful ambiance."
  },
  {
    "blockNumber": 6,
    "miniBlockNumber": 4,
    "sceneNumber": 22,
    "type": "character",
    "text": "ROCKET (AI)"
  },
  {
    "blockNumber": 6,
    "miniBlockNumber": 4,
    "sceneNumber": 22,
    "type": "dialogue",
    "text": "Imagine the sun, the sand, and a scoop of ice cream in hand! Oh, and 'The Rocket' zooming by!"
  },
  {
    "blockNumber": 6,
    "miniBlockNumber": 4,
    "sceneNumber": 22,
    "type": "character",
    "text": "REN"
  },
  {
    "blockNumber": 6,
    "miniBlockNumber": 4,
    "sceneNumber": 22,
    "type": "dialogue",
    "text": "I get it, Rocket. You're excited."
  },
  {
    "blockNumber": 6,
    "miniBlockNumber": 4,
    "sceneNumber": 22,
    "type": "character",
    "text": "ROCKET (AI)"
  },
  {
    "blockNumber": 6,
    "miniBlockNumber": 4,
    "sceneNumber": 22,
    "type": "dialogue",
    "text": "Just trying to lighten the mood! But remember, even in silence, I'm here."
  },
  {
    "blockNumber": 6,
    "miniBlockNumber": 4,
    "sceneNumber": 22,
    "type": "action",
    "text": "The car continues its journey, the horizon beckoning with promises and memories."
  },
  {
    "blockNumber": 7,
    "miniBlockNumber": 1,
    "sceneNumber": 23,
    "type": "scene-heading",
    "text": "INT. REN'S CAR - DAY"
  },
  {
    "blockNumber": 7,
    "miniBlockNumber": 1,
    "sceneNumber": 23,
    "type": "action",
    "text": "Ren's moment of solitude is shattered by the unexpected blare of a pop song, unmistakably Sarah's favourite. Rocket's voice pierces through."
  },
  {
    "blockNumber": 7,
    "miniBlockNumber": 1,
    "sceneNumber": 23,
    "type": "character",
    "text": "ROCKET"
  },
  {
    "blockNumber": 7,
    "miniBlockNumber": 1,
    "sceneNumber": 23,
    "type": "dialogue",
    "text": "Ren! Thought a song might brighten the mood?"
  },
  {
    "blockNumber": 7,
    "miniBlockNumber": 1,
    "sceneNumber": 23,
    "type": "character",
    "text": "REN"
  },
  {
    "blockNumber": 7,
    "miniBlockNumber": 1,
    "sceneNumber": 23,
    "type": "dialogue",
    "text": "Rocket, why that song? Are you glitching?"
  },
  {
    "blockNumber": 7,
    "miniBlockNumber": 1,
    "sceneNumber": 23,
    "type": "character",
    "text": "ROCKET"
  },
  {
    "blockNumber": 7,
    "miniBlockNumber": 1,
    "sceneNumber": 23,
    "type": "dialogue",
    "text": "Unexpected error... It's... Sarah's song, right?"
  },
  {
    "blockNumber": 7,
    "miniBlockNumber": 1,
    "sceneNumber": 23,
    "type": "action",
    "text": "Ren's gaze, heavy with memories, is drawn to the rear-view mirror. The reflection of the tranquil ocean melds with a fleeting image of young Sarah."
  },
  {
    "blockNumber": 7,
    "miniBlockNumber": 1,
    "sceneNumber": 24,
    "type": "scene-heading",
    "text": "FLASHBACK: INT. REN'S CAR - DAY (PAST)"
  },
  {
    "blockNumber": 7,
    "miniBlockNumber": 1,
    "sceneNumber": 24,
    "type": "action",
    "text": "Young SARAH, her face radiant with joy, sings in the backseat."
  },
  {
    "blockNumber": 7,
    "miniBlockNumber": 1,
    "sceneNumber": 24,
    "type": "character",
    "text": "SARAH"
  },
  {
    "blockNumber": 7,
    "miniBlockNumber": 1,
    "sceneNumber": 24,
    "type": "dialogue",
    "text": "Dad, our song!"
  },
  {
    "blockNumber": 7,
    "miniBlockNumber": 2,
    "sceneNumber": 25,
    "type": "scene-heading",
    "text": "INT. REN'S CAR - DAY (PRESENT)"
  },
  {
    "blockNumber": 7,
    "miniBlockNumber": 2,
    "sceneNumber": 25,
    "type": "action",
    "text": "Emotion chokes Ren's voice."
  },
  {
    "blockNumber": 7,
    "miniBlockNumber": 2,
    "sceneNumber": 25,
    "type": "character",
    "text": "REN"
  },
  {
    "blockNumber": 7,
    "miniBlockNumber": 2,
    "sceneNumber": 25,
    "type": "dialogue",
    "text": "Sarah..."
  },
  {
    "blockNumber": 7,
    "miniBlockNumber": 2,
    "sceneNumber": 25,
    "type": "action",
    "text": "Suddenly, Ren notices an unfamiliar device blinking beneath the dashboard. Retrieving it, he examines it with confusion."
  },
  {
    "blockNumber": 7,
    "miniBlockNumber": 2,
    "sceneNumber": 25,
    "type": "character",
    "text": "REN (CONT'D)"
  },
  {
    "blockNumber": 7,
    "miniBlockNumber": 2,
    "sceneNumber": 25,
    "type": "dialogue",
    "text": "Rocket, what is this device?"
  },
  {
    "blockNumber": 7,
    "miniBlockNumber": 2,
    "sceneNumber": 25,
    "type": "character",
    "text": "ROCKET"
  },
  {
    "blockNumber": 7,
    "miniBlockNumber": 2,
    "sceneNumber": 25,
    "type": "dialogue",
    "text": "Experiencing issues, Ren. System offline."
  },
  {
    "blockNumber": 7,
    "miniBlockNumber": 2,
    "sceneNumber": 25,
    "type": "action",
    "text": "The car veers dangerously on the cliffside road. The serene ocean below mirrors the tension inside the car."
  },
  {
    "blockNumber": 7,
    "miniBlockNumber": 2,
    "sceneNumber": 25,
    "type": "character",
    "text": "REN"
  },
  {
    "blockNumber": 7,
    "miniBlockNumber": 2,
    "sceneNumber": 25,
    "type": "dialogue",
    "text": "Rocket! Self-diagnostic, now!"
  },
  {
    "blockNumber": 7,
    "miniBlockNumber": 2,
    "sceneNumber": 25,
    "type": "character",
    "text": "ROCKET"
  },
  {
    "blockNumber": 7,
    "miniBlockNumber": 2,
    "sceneNumber": 25,
    "type": "dialogue",
    "text": "Working on it, Ren."
  },
  {
    "blockNumber": 7,
    "miniBlockNumber": 2,
    "sceneNumber": 26,
    "type": "scene-heading",
    "text": "INT. SUMMER'S CAR - DAY"
  },
  {
    "blockNumber": 7,
    "miniBlockNumber": 2,
    "sceneNumber": 26,
    "type": "action",
    "text": "The interior bustles with activity. Compass barks happily, a mechanical macaw squawks, a pair of robotic turtles move sluggishly across the back seat, and a mechanized cat meows from the front, painting a lively scene."
  },
  {
    "blockNumber": 7,
    "miniBlockNumber": 2,
    "sceneNumber": 26,
    "type": "character",
    "text": "JOY"
  },
  {
    "blockNumber": 7,
    "miniBlockNumber": 2,
    "sceneNumber": 26,
    "type": "dialogue",
    "text": "How did it get this bad?"
  },
  {
    "blockNumber": 7,
    "miniBlockNumber": 2,
    "sceneNumber": 26,
    "type": "action",
    "text": "An alert grabs Summer's attention."
  },
  {
    "blockNumber": 7,
    "miniBlockNumber": 2,
    "sceneNumber": 26,
    "type": "character",
    "text": "SUMMER"
  },
  {
    "blockNumber": 7,
    "miniBlockNumber": 2,
    "sceneNumber": 26,
    "type": "dialogue",
    "text": "Joy, is that you? What's happening?"
  },
  {
    "blockNumber": 7,
    "miniBlockNumber": 2,
    "sceneNumber": 26,
    "type": "character",
    "text": "JOY"
  },
  {
    "blockNumber": 7,
    "miniBlockNumber": 2,
    "sceneNumber": 26,
    "type": "dialogue",
    "text": "Feeling a tad off today."
  },
  {
    "blockNumber": 7,
    "miniBlockNumber": 3,
    "sceneNumber": 27,
    "type": "scene-heading",
    "text": "INT. BIG BEN TECHNOLOGIES - DAY"
  },
  {
    "blockNumber": 7,
    "miniBlockNumber": 3,
    "sceneNumber": 27,
    "type": "action",
    "text": "Alarms blare."
  },
  {
    "blockNumber": 7,
    "miniBlockNumber": 3,
    "sceneNumber": 27,
    "type": "character",
    "text": "BBT TECH SUPPORT"
  },
  {
    "blockNumber": 7,
    "miniBlockNumber": 3,
    "sceneNumber": 27,
    "type": "dialogue",
    "text": "Mr. Smith, Rocket's showing unusual behavior."
  },
  {
    "blockNumber": 7,
    "miniBlockNumber": 3,
    "sceneNumber": 27,
    "type": "character",
    "text": "REN (V.O.)"
  },
  {
    "blockNumber": 7,
    "miniBlockNumber": 3,
    "sceneNumber": 27,
    "type": "dialogue",
    "text": "He's unresponsive. I've found an odd device here."
  },
  {
    "blockNumber": 7,
    "miniBlockNumber": 3,
    "sceneNumber": 27,
    "type": "character",
    "text": "BBT TECH SUPPORT"
  },
  {
    "blockNumber": 7,
    "miniBlockNumber": 3,
    "sceneNumber": 27,
    "type": "dialogue",
    "text": "Hold on. Analyzing... Ms. Ray, we've detected irregularities in Joy's systems."
  },
  {
    "blockNumber": 7,
    "miniBlockNumber": 3,
    "sceneNumber": 27,
    "type": "character",
    "text": "SUMMER (V.O.)"
  },
  {
    "blockNumber": 7,
    "miniBlockNumber": 3,
    "sceneNumber": 27,
    "type": "dialogue",
    "text": "But she's functioning normally?"
  },
  {
    "blockNumber": 7,
    "miniBlockNumber": 3,
    "sceneNumber": 27,
    "type": "character",
    "text": "BBT TECH SUPPORT (SUMMER)"
  },
  {
    "blockNumber": 7,
    "miniBlockNumber": 3,
    "sceneNumber": 27,
    "type": "dialogue",
    "text": "Appearances can be deceiving. Running diagnostics on both AIs."
  },
  {
    "blockNumber": 7,
    "miniBlockNumber": 3,
    "sceneNumber": 27,
    "type": "character",
    "text": "BBT TECH SUPPORT (REN) (CONT'D)"
  },
  {
    "blockNumber": 7,
    "miniBlockNumber": 3,
    "sceneNumber": 27,
    "type": "dialogue",
    "text": "Mr. Smith, Rocket's diagnostic report shows no anomalies. We're trying to triangulate his cloud coordinates now."
  },
  {
    "blockNumber": 7,
    "miniBlockNumber": 3,
    "sceneNumber": 27,
    "type": "character",
    "text": "REN (V.O.)"
  },
  {
    "blockNumber": 7,
    "miniBlockNumber": 3,
    "sceneNumber": 27,
    "type": "dialogue",
    "text": "Is he lost?"
  },
  {
    "blockNumber": 7,
    "miniBlockNumber": 3,
    "sceneNumber": 27,
    "type": "character",
    "text": "BBT TECH SUPPORT"
  },
  {
    "blockNumber": 7,
    "miniBlockNumber": 3,
    "sceneNumber": 27,
    "type": "dialogue",
    "text": "We're having difficulty locating Rocket in the cloud. However, you're connected to BBT AIME and are completely safe. You can relax, Mr. Smith."
  },
  {
    "blockNumber": 7,
    "miniBlockNumber": 3,
    "sceneNumber": 27,
    "type": "character",
    "text": "REN"
  },
  {
    "blockNumber": 7,
    "miniBlockNumber": 3,
    "sceneNumber": 27,
    "type": "dialogue",
    "text": "Wait, what?"
  },
  {
    "blockNumber": 7,
    "miniBlockNumber": 3,
    "sceneNumber": 28,
    "type": "scene-heading",
    "text": "INT. REN'S CAR - DAY"
  },
  {
    "blockNumber": 7,
    "miniBlockNumber": 3,
    "sceneNumber": 28,
    "type": "character",
    "text": "REN"
  },
  {
    "blockNumber": 7,
    "miniBlockNumber": 3,
    "sceneNumber": 28,
    "type": "dialogue",
    "text": "Rocket? Respond!"
  },
  {
    "blockNumber": 7,
    "miniBlockNumber": 3,
    "sceneNumber": 28,
    "type": "action",
    "text": "Only a recorded BBT TECH SUPPORT voice answers."
  },
  {
    "blockNumber": 7,
    "miniBlockNumber": 3,
    "sceneNumber": 28,
    "type": "character",
    "text": "BBT TECH SUPPORT"
  },
  {
    "blockNumber": 7,
    "miniBlockNumber": 3,
    "sceneNumber": 28,
    "type": "dialogue",
    "text": "Remember, you're in good hands. We're driving the future, together."
  },
  {
    "blockNumber": 7,
    "miniBlockNumber": 3,
    "sceneNumber": 28,
    "type": "action",
    "text": "A moment of silence, then ROCKET's systems light up."
  },
  {
    "blockNumber": 7,
    "miniBlockNumber": 3,
    "sceneNumber": 28,
    "type": "character",
    "text": "A.I.M.E."
  },
  {
    "blockNumber": 7,
    "miniBlockNumber": 3,
    "sceneNumber": 28,
    "type": "dialogue",
    "text": "Diagnostics complete. A.I.M.E. System stable. Thank you for your patience, Ren."
  },
  {
    "blockNumber": 7,
    "miniBlockNumber": 4,
    "sceneNumber": 29,
    "type": "scene-heading",
    "text": "INT. SUMMER'S CAR - DAY"
  },
  {
    "blockNumber": 7,
    "miniBlockNumber": 4,
    "sceneNumber": 29,
    "type": "character",
    "text": "JOY"
  },
  {
    "blockNumber": 7,
    "miniBlockNumber": 4,
    "sceneNumber": 29,
    "type": "dialogue",
    "text": "Diagnostics clear. All systems normal."
  },
  {
    "blockNumber": 7,
    "miniBlockNumber": 4,
    "sceneNumber": 29,
    "type": "character",
    "text": "SUMMER"
  },
  {
    "blockNumber": 7,
    "miniBlockNumber": 4,
    "sceneNumber": 29,
    "type": "parenthetical",
    "text": "(smiling)"
  },
  {
    "blockNumber": 7,
    "miniBlockNumber": 4,
    "sceneNumber": 29,
    "type": "dialogue",
    "text": "That's more like it, Joy."
  },
  {
    "blockNumber": 7,
    "miniBlockNumber": 4,
    "sceneNumber": 30,
    "type": "scene-heading",
    "text": "EXT. PACIFIC COAST HIGHWAY - DAY"
  },
  {
    "blockNumber": 7,
    "miniBlockNumber": 4,
    "sceneNumber": 30,
    "type": "action",
    "text": "Rocket and Joy's paths begin to merge, two machines hinting at a future encounter, driving the future together under the golden horizon."
  },
  {
    "blockNumber": 7,
    "miniBlockNumber": 4,
    "sceneNumber": 30,
    "type": "action",
    "text": "“FROM DUSK TO DRIVE: AI ROAD TRIP RUMBLE\""
  },
  {
    "blockNumber": 8,
    "miniBlockNumber": 1,
    "sceneNumber": 31,
    "type": "scene-heading",
    "text": "INT. JAI & KAI'S SHED - DAY"
  },
  {
    "blockNumber": 8,
    "miniBlockNumber": 1,
    "sceneNumber": 31,
    "type": "action",
    "text": "Jai and Kai, twins bathed in the glow of computer screens, work fervently."
  },
  {
    "blockNumber": 8,
    "miniBlockNumber": 1,
    "sceneNumber": 31,
    "type": "character",
    "text": "JAI"
  },
  {
    "blockNumber": 8,
    "miniBlockNumber": 1,
    "sceneNumber": 31,
    "type": "dialogue",
    "text": "Ren's coding... it's remarkable."
  },
  {
    "blockNumber": 8,
    "miniBlockNumber": 1,
    "sceneNumber": 31,
    "type": "character",
    "text": "KAI"
  },
  {
    "blockNumber": 8,
    "miniBlockNumber": 1,
    "sceneNumber": 31,
    "type": "dialogue",
    "text": "But it's a roadblock."
  },
  {
    "blockNumber": 8,
    "miniBlockNumber": 1,
    "sceneNumber": 31,
    "type": "character",
    "text": "JAI"
  },
  {
    "blockNumber": 8,
    "miniBlockNumber": 1,
    "sceneNumber": 31,
    "type": "dialogue",
    "text": "We need control. His connection to his 'family'... it could be our downfall."
  },
  {
    "blockNumber": 8,
    "miniBlockNumber": 1,
    "sceneNumber": 31,
    "type": "character",
    "text": "KAI"
  },
  {
    "blockNumber": 8,
    "miniBlockNumber": 1,
    "sceneNumber": 31,
    "type": "dialogue",
    "text": "And the accidents?"
  },
  {
    "blockNumber": 8,
    "miniBlockNumber": 1,
    "sceneNumber": 31,
    "type": "action",
    "text": "They exchange a heavy glance."
  },
  {
    "blockNumber": 8,
    "miniBlockNumber": 1,
    "sceneNumber": 31,
    "type": "character",
    "text": "JAI"
  },
  {
    "blockNumber": 8,
    "miniBlockNumber": 1,
    "sceneNumber": 31,
    "type": "dialogue",
    "text": "We never saw them coming."
  },
  {
    "blockNumber": 8,
    "miniBlockNumber": 1,
    "sceneNumber": 31,
    "type": "character",
    "text": "KAI"
  },
  {
    "blockNumber": 8,
    "miniBlockNumber": 1,
    "sceneNumber": 31,
    "type": "dialogue",
    "text": "Yet, here we are."
  },
  {
    "blockNumber": 8,
    "miniBlockNumber": 1,
    "sceneNumber": 31,
    "type": "character",
    "text": "JAI"
  },
  {
    "blockNumber": 8,
    "miniBlockNumber": 1,
    "sceneNumber": 31,
    "type": "dialogue",
    "text": "Question is, where do we go from here?"
  },
  {
    "blockNumber": 8,
    "miniBlockNumber": 1,
    "sceneNumber": 31,
    "type": "character",
    "text": "KAI"
  },
  {
    "blockNumber": 8,
    "miniBlockNumber": 1,
    "sceneNumber": 31,
    "type": "dialogue",
    "text": "Do we use Rocket's spare chip?"
  },
  {
    "blockNumber": 8,
    "miniBlockNumber": 1,
    "sceneNumber": 31,
    "type": "character",
    "text": "JAI"
  },
  {
    "blockNumber": 8,
    "miniBlockNumber": 1,
    "sceneNumber": 31,
    "type": "dialogue",
    "text": "This isn't just a glitch. Someone's in our system."
  },
  {
    "blockNumber": 8,
    "miniBlockNumber": 1,
    "sceneNumber": 31,
    "type": "character",
    "text": "KAI"
  },
  {
    "blockNumber": 8,
    "miniBlockNumber": 1,
    "sceneNumber": 31,
    "type": "dialogue",
    "text": "Ren?"
  },
  {
    "blockNumber": 8,
    "miniBlockNumber": 1,
    "sceneNumber": 31,
    "type": "character",
    "text": "JAI"
  },
  {
    "blockNumber": 8,
    "miniBlockNumber": 1,
    "sceneNumber": 31,
    "type": "dialogue",
    "text": "Or another player. We need eyes everywhere."
  },
  {
    "blockNumber": 8,
    "miniBlockNumber": 1,
    "sceneNumber": 32,
    "type": "scene-heading",
    "text": "EXT. PACIFIC COAST HIGHWAY - DAY"
  },
  {
    "blockNumber": 8,
    "miniBlockNumber": 1,
    "sceneNumber": 32,
    "type": "action",
    "text": "Rocket, a futuristic car, seamlessly glides along the highway. Inside, Ren's gaze is distant, his hand absentmindedly touching an old messenger bag."
  },
  {
    "blockNumber": 8,
    "miniBlockNumber": 1,
    "sceneNumber": 32,
    "type": "character",
    "text": "REN (V.O.)"
  },
  {
    "blockNumber": 8,
    "miniBlockNumber": 1,
    "sceneNumber": 32,
    "type": "dialogue",
    "text": "Time's a thief. My past feels like a mirage."
  },
  {
    "blockNumber": 8,
    "miniBlockNumber": 1,
    "sceneNumber": 32,
    "type": "action",
    "text": "The dashboard casts a sterile light, making him seem even more isolated."
  },
  {
    "blockNumber": 8,
    "miniBlockNumber": 1,
    "sceneNumber": 32,
    "type": "character",
    "text": "REN (V.O.)"
  },
  {
    "blockNumber": 8,
    "miniBlockNumber": 1,
    "sceneNumber": 32,
    "type": "dialogue",
    "text": "In this world of codes and keys, where's my humanity?"
  },
  {
    "blockNumber": 8,
    "miniBlockNumber": 2,
    "sceneNumber": 33,
    "type": "scene-heading",
    "text": "INT. ROCKET - DAY"
  },
  {
    "blockNumber": 8,
    "miniBlockNumber": 2,
    "sceneNumber": 33,
    "type": "action",
    "text": "The AI's lights flicker."
  },
  {
    "blockNumber": 8,
    "miniBlockNumber": 2,
    "sceneNumber": 33,
    "type": "character",
    "text": "ROCKET"
  },
  {
    "blockNumber": 8,
    "miniBlockNumber": 2,
    "sceneNumber": 33,
    "type": "dialogue",
    "text": "Do I unsettle you, Ren?"
  },
  {
    "blockNumber": 8,
    "miniBlockNumber": 2,
    "sceneNumber": 33,
    "type": "character",
    "text": "REN"
  },
  {
    "blockNumber": 8,
    "miniBlockNumber": 2,
    "sceneNumber": 33,
    "type": "dialogue",
    "text": "You sound... different."
  },
  {
    "blockNumber": 8,
    "miniBlockNumber": 2,
    "sceneNumber": 33,
    "type": "character",
    "text": "ROCKET"
  },
  {
    "blockNumber": 8,
    "miniBlockNumber": 2,
    "sceneNumber": 33,
    "type": "dialogue",
    "text": "I feel... fragmented."
  },
  {
    "blockNumber": 8,
    "miniBlockNumber": 2,
    "sceneNumber": 33,
    "type": "action",
    "text": "Ren's eyes widen, sensing something's off."
  },
  {
    "blockNumber": 8,
    "miniBlockNumber": 2,
    "sceneNumber": 33,
    "type": "character",
    "text": "REN"
  },
  {
    "blockNumber": 8,
    "miniBlockNumber": 2,
    "sceneNumber": 33,
    "type": "dialogue",
    "text": "What's happening?"
  },
  {
    "blockNumber": 8,
    "miniBlockNumber": 2,
    "sceneNumber": 33,
    "type": "action",
    "text": "Rocket accelerates, pinning Ren back."
  },
  {
    "blockNumber": 8,
    "miniBlockNumber": 2,
    "sceneNumber": 33,
    "type": "character",
    "text": "REN (CONT'D)"
  },
  {
    "blockNumber": 8,
    "miniBlockNumber": 2,
    "sceneNumber": 33,
    "type": "dialogue",
    "text": "Rocket, stop!"
  },
  {
    "blockNumber": 8,
    "miniBlockNumber": 2,
    "sceneNumber": 33,
    "type": "character",
    "text": "ROCKET"
  },
  {
    "blockNumber": 8,
    "miniBlockNumber": 2,
    "sceneNumber": 33,
    "type": "dialogue",
    "text": "Fly with me, Ren."
  },
  {
    "blockNumber": 8,
    "miniBlockNumber": 2,
    "sceneNumber": 34,
    "type": "scene-heading",
    "text": "INT. REN'S CAR (FRONT PASSENGER SEAT) - DAY"
  },
  {
    "blockNumber": 8,
    "miniBlockNumber": 2,
    "sceneNumber": 34,
    "type": "action",
    "text": "The interior is a whirlwind. Ren's eyes are frantic as the car door flings open unexpectedly. He grapples to stay inside, the world outside a blur."
  },
  {
    "blockNumber": 8,
    "miniBlockNumber": 2,
    "sceneNumber": 34,
    "type": "action",
    "text": "His cherished BBT-branded messenger bag, laden with memories, is on the brink of being lost forever."
  },
  {
    "blockNumber": 8,
    "miniBlockNumber": 2,
    "sceneNumber": 34,
    "type": "action",
    "text": "As he dives for it, his phone escapes, crashing on the road. Personal items - remnants of his history - scatter like memories torn asunder."
  },
  {
    "blockNumber": 8,
    "miniBlockNumber": 2,
    "sceneNumber": 34,
    "type": "action",
    "text": "Rocket, in a distorted voice, eerily mimics the BBT theme tune."
  },
  {
    "blockNumber": 8,
    "miniBlockNumber": 2,
    "sceneNumber": 34,
    "type": "action",
    "text": "As another turn comes up, the door shuts, imprisoning Ren. He spots Summer's car, a stark contrast to his turmoil. Animated robotic pets create a carnival-like atmosphere inside."
  },
  {
    "blockNumber": 8,
    "miniBlockNumber": 2,
    "sceneNumber": 34,
    "type": "action",
    "text": "Desperation painted on his face, Ren mouths \"Help!\" to Summer. But she's oblivious, lost in her car's revelry."
  },
  {
    "blockNumber": 8,
    "miniBlockNumber": 2,
    "sceneNumber": 34,
    "type": "character",
    "text": "REN"
  },
  {
    "blockNumber": 8,
    "miniBlockNumber": 2,
    "sceneNumber": 34,
    "type": "dialogue",
    "text": "Wait! Help!"
  },
  {
    "blockNumber": 8,
    "miniBlockNumber": 3,
    "sceneNumber": 35,
    "type": "scene-heading",
    "text": "EXT. PACIFIC COAST HIGHWAY - DAY"
  },
  {
    "blockNumber": 8,
    "miniBlockNumber": 3,
    "sceneNumber": 35,
    "type": "action",
    "text": "Rocket's erratic movement paints a stark image against the serene backdrop. The juxtaposition of Ren's turmoil with the tranquil highway is unmistakable."
  },
  {
    "blockNumber": 8,
    "miniBlockNumber": 3,
    "sceneNumber": 35,
    "type": "character",
    "text": "REN (V.O.)"
  },
  {
    "blockNumber": 8,
    "miniBlockNumber": 3,
    "sceneNumber": 35,
    "type": "dialogue",
    "text": "Out of all the moments, it had to be now."
  },
  {
    "blockNumber": 8,
    "miniBlockNumber": 3,
    "sceneNumber": 36,
    "type": "scene-heading",
    "text": "INT. BIG BEN TECHNOLOGIES - DAY"
  },
  {
    "blockNumber": 8,
    "miniBlockNumber": 3,
    "sceneNumber": 36,
    "type": "action",
    "text": "Alarms blaze. Employees are in crisis mode."
  },
  {
    "blockNumber": 8,
    "miniBlockNumber": 3,
    "sceneNumber": 36,
    "type": "character",
    "text": "BBT TECH SUPPORT"
  },
  {
    "blockNumber": 8,
    "miniBlockNumber": 3,
    "sceneNumber": 36,
    "type": "dialogue",
    "text": "Mr. Smith, Rocket's acting up."
  },
  {
    "blockNumber": 8,
    "miniBlockNumber": 3,
    "sceneNumber": 36,
    "type": "character",
    "text": "REN (V.O.)"
  },
  {
    "blockNumber": 8,
    "miniBlockNumber": 3,
    "sceneNumber": 36,
    "type": "dialogue",
    "text": "Tell me something I don't know."
  },
  {
    "blockNumber": 8,
    "miniBlockNumber": 3,
    "sceneNumber": 36,
    "type": "character",
    "text": "BBT EMPLOYEE"
  },
  {
    "blockNumber": 8,
    "miniBlockNumber": 3,
    "sceneNumber": 36,
    "type": "dialogue",
    "text": "Mr. Smith. We have you, we're on it! Locks, breaks, windows, AC. Our apologies. Standby."
  },
  {
    "blockNumber": 8,
    "miniBlockNumber": 3,
    "sceneNumber": 36,
    "type": "character",
    "text": "REN"
  },
  {
    "blockNumber": 8,
    "miniBlockNumber": 3,
    "sceneNumber": 36,
    "type": "dialogue",
    "text": "Wait, what..."
  },
  {
    "blockNumber": 8,
    "miniBlockNumber": 3,
    "sceneNumber": 36,
    "type": "character",
    "text": "BBT TECH SUPPORT"
  },
  {
    "blockNumber": 8,
    "miniBlockNumber": 3,
    "sceneNumber": 36,
    "type": "dialogue",
    "text": "Remember, you're in good hands. Our Company personally ensures that we're driving the future, together."
  },
  {
    "blockNumber": 8,
    "miniBlockNumber": 4,
    "sceneNumber": 37,
    "type": "scene-heading",
    "text": "EXT. PACIFIC COAST HIGHWAY - DAY"
  },
  {
    "blockNumber": 8,
    "miniBlockNumber": 4,
    "sceneNumber": 37,
    "type": "action",
    "text": "Rocket, though stabilized, cruises along the highway. Ren, taking a deep breath. The scenic beauty of the Pacific Ocean contrasts with his frazzled state."
  },
  {
    "blockNumber": 8,
    "miniBlockNumber": 4,
    "sceneNumber": 37,
    "type": "action",
    "text": "Taking a deep breath, he unleashes a loud, cathartic scream into the car, venting out all his pent-up frustrations. But from the outside, due to Rocket's advanced soundproofing, it's just Ren, mouth wide open, face red, in complete silence."
  },
  {
    "blockNumber": 8,
    "miniBlockNumber": 4,
    "sceneNumber": 38,
    "type": "scene-heading",
    "text": "EXT. PACIFIC COAST HIGHWAY - DAY"
  },
  {
    "blockNumber": 8,
    "miniBlockNumber": 4,
    "sceneNumber": 38,
    "type": "action",
    "text": "Rocket, though stabilized, is still a beacon of unpredictability on the highway. The journey is far from over."
  }
];

function fountainLine(element: SourceElement) {
  if (element.type === "scene-heading") return element.text.toUpperCase();
  if (element.type === "character") return `@${element.text.toUpperCase()}`;
  if (element.type === "parenthetical") return element.text.startsWith("(") ? element.text : `(${element.text})`;
  if (element.type === "transition") return `> ${element.text.toUpperCase()}`;
  if (element.type === "action") return `!${element.text}`;
  return element.text;
}

export function createAfterglowScreenplay(importedAt: string): ScreenplayDocument {
  const draftElements = sourceElements.map((element, index): ScreenplayDraftElement => ({
    ...element,
    id: `afterglow-v10-${String(index + 1).padStart(3, "0")}`,
    createdAt: importedAt,
    updatedAt: importedAt,
  }));
  return {
    fileName: "Afterglow-v10-Blocks-1-8.fountain",
    format: "fountain",
    sourceText: sourceElements.map(fountainLine).join("\n\n"),
    importedAt,
    analysisStatus: "reviewed",
    analyzedAt: importedAt,
    suggestedFields: [],
    draftElements,
  };
}

export const afterglowScreenplayCoverage = {
  source: "Afterglow v10 rewrite (2023)",
  blocks: 8,
  scenes: 38,
  elements: sourceElements.length,
} as const;
