# Developer brief — Issue #2725

Issue: #2725

Outline becomes a selected-Block workspace rather than a six-card reading wall. Act, Block and Mini-Block controls remain navigation. The selected Block uses the available width, while Mini-Block selection swaps the selected slice.

Outline owns two separate visual anchor layers:
- Block Visual Anchor: one representative image for the selected Block.
- Mini-Block Visual Anchor: one representative image for the selected Mini-Block.

Existing Afterglow Block-cover references and existing Mini-Block storyboard references should appear when already available. Human generation, save and lock actions remain explicit. Outline must not surface Storyboard's 25 shot positions.

Mind Map and World Map keep their shared Act/topic navigation but no longer render a second in-surface identity row or second Back to Dashboard control. The application shell remains the single title/return authority.

Focused proof:
- selected Block only in Outline readiness;
- selected Story Card and Written Story occupy full width;
- Block and Mini-Block anchor labels are distinct;
- 25-shot UI remains absent from Outline;
- Mind/World shared header begins with Act navigation and contains no in-surface h1 or Back to Dashboard button.
