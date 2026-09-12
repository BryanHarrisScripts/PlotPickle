# #1973 — Contextual Skin V1 menu/footer feedback

Parent: #1962  
Roadmap: #1918 — Phase 5 remains paused.

## Intent

Finish the pre-Phase-5 UX cleanup by making keyboard navigation self-explanatory at the point of use without changing destination wiring.

The Human should always know which row is selected, whether its destination is available, and what Enter will do.

## Universal status-square contract

The visual language is intentionally simple and has one meaning everywhere:

- **GREEN square = AVAILABLE**
- **GRAY square = UNAVAILABLE**

A gray square never means merely suggested, optional, incomplete, later in sequence, or locked by prerequisites. Contextual copy may explain *why* a destination is unavailable, but the square itself has only the availability meaning above.

This preserves #1918 guided-not-gated authority: sequence and prerequisites do not create gray squares. Only an unavailable destination/content boundary does.

## Menu inventory

The current Skin V1 directory surfaces are not all wired the same way.

### Dashboard

Mixed available/unavailable destinations. It requires contextual selection feedback and the visible status legend.

### Settings

Mixed available/unavailable destinations. It requires the same contextual selection feedback and status legend. Systems order from #1965 remains unchanged.

### Local Story Mode

All current directory rows are connected destinations. Existing all-green row state remains authoritative. This slice does not invent unavailable states or add decorative failure messaging.

### Cloud Story Mode

All current directory rows are connected destinations. Existing all-green row state remains authoritative. This slice does not change provider readiness semantics; directory availability is distinct from whether a provider underneath still needs setup/testing.

### LEARN Journey

The Journey owns richer footer/status text because it also reports curriculum loading, course availability, progress and completion messages. Its row indicators still obey the universal square contract: a wired destination/content path is green; unavailable lesson content is gray. Sequence remains advisory only.

### Not part of the directory-footer contract

Profile, Node Info, Agent Setup and Community are content surfaces, not BBS directory menus. The `/` Agent picker is a popup selector with its own keyboard contract.

## Required behavior

Dashboard and Settings must:

1. retain Up/Down, Home/End, shortcut key, Enter/Space, mouse and Escape behavior;
2. derive footer copy from the currently selected row;
3. say `ENTER → OPEN <DESTINATION>` only when the row is available;
4. say `<DESTINATION> UNAVAILABLE` when the row is gray/unavailable;
5. show `GREEN = AVAILABLE` and `GRAY = UNAVAILABLE` in text so status is not communicated by color alone;
6. expose selection feedback through polite live status semantics;
7. keep every row's accessibility label aligned with available/unavailable state.

## Boundaries

No new navigation destinations are wired. No provider, Agent, BUZZ, identity, persistence, story-authority or curriculum body changes. No #1918 Phase 5 curriculum expansion. Existing LEARN year/semester/course naming remains unchanged in this slice; the non-academic naming pass is the next slice.

## Verification

Focused regression must prove the shared footer contract, Dashboard/Settings contextual ownership, all-green Local/Cloud directory truth, and the existing LEARN availability mapping. Development convergence is guarded so it only applies when `config/development-convergence/1973.json` is part of the diff.

Exact PR head must then pass all seven Architecture Verification layers, including live WebMCP/UI conformance and Visual Director evidence, before Human merge approval is requested.
