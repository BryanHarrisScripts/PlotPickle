# Scene Pulse

Scene Pulse is PlotPickle's micro-structure engine. The 24 Blocks define the story's larger causal movements; Scene Lab breaks each block into one or more playable scenes and tests whether each scene creates change of its own.

The model is diagnostic rather than prescriptive. A short scene may perform several functions with one action. A large set piece may carry several prepared revelations at once. What matters is that the scene earns its screen time, reveals character through pressure, and changes what can happen next.

## The six-part pulse

| Part | Fields | Dramatic function |
| --- | --- | --- |
| Scene identity | Title, purpose, point of view, characters, location | Names the scene's single indispensable job and the experience organizing it. |
| Pressure Lock | Immediate desire, counter-desire, hold, revealing choice | Creates collision between incompatible results and explains why the participants cannot simply disengage. |
| Cut Line | Cut in, cut out | Removes routine approach and cleanup so the scene begins at its first essential pressure and leaves on its decisive result. |
| Character Proof | Setting pressure, surface action, undercurrent | Uses an organic place and visible behaviour to expose the deeper negotiation without making dialogue carry everything. |
| Value Flip | Opening value, pivot, tactic shift, closing value | Tracks a live value such as trust, status, control, safety, hope, or belonging and proves that it changed. |
| Focus Signal & Handoff | Focus signal, handoff pressure | Gives the audience a clear takeaway and sends a consequence, decision, question, or unresolved pressure into the next movement. |

## Pressure Lock

A scene becomes active when someone tries to create a specific result and another person, system, circumstance, or inner force requires an incompatible result. The conflict does not have to be loud. Politeness, attraction, concealment, procedure, and physical danger can all carry opposition.

The hold answers a separate question: why does the scene continue? A character may remain because they need information, approval, escape, protection, status, money, love, or time. If everyone can leave without losing anything, the writer should strengthen the hold or question whether the scene is necessary.

The revealing choice records the behavioural proof of character produced by that pressure. It should show a value, flaw, fear, strategy, or emerging change rather than merely restate a profile description.

## Cut Line

Cut in identifies the first moment worth putting on screen. Arrival, greeting, explanation, and routine preparation can usually be removed when the audience can infer them from the conflict already in motion.

Cut out identifies the moment after which the scene would only explain, repeat, or cool down what has already landed. A line, look, action, refusal, discovery, image, or sudden silence can complete the scene and create forward pull.

## Character Proof

The location should be natural to the story and active in the scene. A task, prop, witness, deadline, physical condition, public setting, or environmental rule can make the same exchange more visual, more difficult, and more specific to these characters.

Surface action describes what the participants openly do or discuss. Undercurrent names the emotional, relational, or thematic negotiation beneath it. The two lanes should reinforce each other without requiring every character to state the deeper subject directly.

## Value Flip

Opening value and closing value track the scene's change. Useful values include:

- trust to suspicion;
- control to exposure;
- safety to danger;
- rejection to possibility;
- low status to authority;
- certainty to doubt; and
- separation to connection.

The pivot is the discovery, action, refusal, interruption, or reversal that makes the original approach insufficient. Tactic shift records how the driver adapts. The closing value proves that the scene did not merely transfer information; it changed the emotional, relational, strategic, or practical situation.

## Focus Signal & Handoff

The Focus Signal is the clearest audience takeaway earned by the scene. It can be a fact, realization, emotional truth, changed relationship, clue, or new interpretation. Most scenes benefit from a dominant signal the audience can absorb while continuing to infer the rest. A climax or comic convergence may intentionally combine several signals, provided the story prepared them.

Handoff pressure prevents the scene from becoming a sealed sketch. It identifies what now demands action: a consequence, choice, promise, threat, question, misunderstanding, pursuit, or changed relationship. That handoff can drive the next scene inside the same block or the next block in the 24-part spine.

## Connections to the rest of PlotPickle

- Characters supplies wants, flaws, voices, relationships, and choices.
- World supplies active locations, rules, resources, and constraints.
- Dialogue supplies voice contrast, surface strategy, and undercurrent.
- The Pickle supplies the audience expectation a pivot can confirm, complicate, or reframe.
- 24 Blocks supplies the larger goal, conflict, choice, action, and consequence the scenes must realize.
- Storyboard turns Cut Line, Setting Pressure, Value Flip, and Handoff into visible frames.

## Diagnostic pass

Before keeping a scene, ask:

1. Does at least one participant pursue a result that another force resists?
2. Is the hold strong enough to keep the collision active?
3. Could the scene begin later or end sooner without losing its job?
4. Does a choice reveal character under pressure?
5. Does the location do dramatic work beyond providing a background?
6. Does the pivot change a live value or require a new tactic?
7. Can the audience carry one clear signal and fresh pressure into what follows?

## Workspace and migration

Scene Lab is a shared story column across Instructions, Story Planner, and Visual Board. Scene cards are stored inside their parent block as `blocks[].scenes`, keeping scene order, block purpose, characters, locations, story text, and storyboard material in one canonical project object.

Schema version 1.5.0 adds Scene Pulse. Imports from versions 1.0.0 through 1.4.0 receive empty scene arrays while preserving all existing development fields, characters, blocks, text, notes, and visuals.
