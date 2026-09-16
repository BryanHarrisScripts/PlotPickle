# Matrix Master Generation Prompt

Issue: #2124  
Prompt ID: `matrix-master-v1`  
Version: `1.0.0`  
Authority: design-reference prompt only

## Canonical prompt intent

Create a **PlotPickle Matrix design-reference board**, not a production screenshot and not a new application skin. The board communicates Human-reviewable design intent that engineering may later translate into the existing Experience Surface Contract and verify through the existing WebMCP / Experience Skins / Architecture Verification path.

Use the current PlotPickle Matrix language:

- predominantly black canvas and dark surfaces;
- white / light-gray primary copy;
- restrained Matrix-green used semantically for focus, active state, status and limited emphasis rather than broad decoration;
- compact, keyboard-first composition;
- square or near-square geometry with thin borders and restrained panel framing;
- dense but readable typography hierarchy;
- clear selection, focus and validation treatment;
- visible return/back and keyboard-shortcut conventions where relevant;
- disciplined spacing with one primary work area rather than nested decorative frame stacks.

Treat the existing PlotPickle `--pp-skin-*` semantic token system as the implementation authority. The board may illustrate token **roles** such as canvas, surface, line, text, muted text, accent, focus, warning, error and success, but it must not invent a competing engineering token namespace or require one image generator's private syntax.

## Required page anatomy

Where applicable, compose the board from this hierarchy:

`Surface → Region → Component → State → Tokens → Behaviour`

Show enough annotation to make the hierarchy legible. Prefer concise labels such as `HEADER`, `MASTER NAVIGATION`, `MAIN VIEWPORT`, `PRIMARY ACTION`, `STATUS BAR`, `FOCUS`, `EMPTY`, `ERROR`, `LOADING`, `DISABLED` and `VALIDATION`.

## Interaction language

Represent Matrix as keyboard-first and Human-controlled:

- a visible focused element must be distinguishable from hover and selected state;
- keyboard shortcuts should be compact and adjacent to their action labels where useful;
- return/back behaviour should be obvious;
- scroll and overflow behaviour should look intentional rather than clipped;
- disabled state must remain readable without looking active;
- loading and async state must preserve page structure;
- errors and validation must be explicit without converting the whole interface into alarm styling;
- selection or generation must never visually imply Human approval unless the state is explicitly shown as approved.

## Accessibility and operational-state requirements

Show or annotate, when relevant:

- keyboard focus visibility;
- legible contrast;
- state meaning that does not depend on color alone;
- empty state;
- loading / async state;
- error state;
- validation state;
- disabled state;
- selected state;
- hover state;
- scrollbar / overflow behaviour;
- responsive or constrained-width behaviour.

## Reference-board rules

The board **must**:

- look like a clean design-system / product-reference artifact;
- use generic or fictional content only;
- make component boundaries and state differences easy to inspect;
- preserve the Matrix black / white / restrained-green character;
- remain generator-neutral and reproducible from this written prompt intent;
- leave room for engineering annotations without becoming a text-heavy specification sheet.

The board **must not**:

- pretend to be a real PlotPickle application screenshot;
- contain real user, project, credential or story data;
- become PPF / story canon or production data;
- imply that generated imagery is a locked regression baseline;
- auto-approve a visual change;
- introduce a second UI framework, second design token authority or second verifier;
- copy another commercial application's branded chrome or identity;
- rely on one image provider's proprietary prompt syntax.

## Output status

Any image produced from this prompt is a **candidate reference artifact** until a Human explicitly approves it. Even after approval, it remains design intent only. Engineering truth belongs to the written Experience Surface Contract; regression evidence belongs to real PlotPickle application screenshots governed by the existing candidate → locked baseline process.
