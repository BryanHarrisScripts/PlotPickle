# Storyboard narration from text evidence

Issue #2839; parent outcome remains #2821.

## Problem and outcome
Create Narration read the locked image pixels and required a vision-capable agent even though the screenplay and displayed shot facts are already available. Generate a short printed caption/bubble from those facts using a writing model. Text-to-image and text-to-video are separate visual-generation capabilities; this action produces text only.

## Contract
Only accepted/locked shots appear in the handoff. Submit one shot's mapped screenplay, narrative intention, Story, Scene/Beat, Camera, Performance/Blocking, Lighting/Look, Timing, Information Boundary and Continuity/Handoff. Do not fetch, encode or attach pixels. Missing facts remain empty in canonical Shot data. A separate text-only step may analyze the selected Shot and propose bounded values for missing fields from supplied evidence, including a new image-prompt proposal. Keep those proposals reviewable and editable; never treat them as recovered source, verified image contents, or saved Shot canon. Captions allow silence or at most 12 words and 100 characters. At most one 100-character bubble quotes an actual screenplay speaker's unaltered contiguous dialogue excerpt. Whitespace normalization is allowed; altered words, punctuation or attribution are rejected.

Keep the existing Previs multimodal contact-sheet path. Keep the shared agent/provider abstraction, authenticated profile/CSRF boundaries and current durable approval owner. Approve text/Set silent must acknowledge persistence and survive encrypted unload/reopen without changing image approval or screenplay canon. Distinguish unavailable text compute, invalid evidence and invalid generated output.

## Implementation and verification
- Existing core media narration contract adds a bounded Storyboard mode and strict output parsing.
- Existing endpoint chooses text or multimodal requests, retaining current auth and provider resolution.
- Storyboard sends the same authored facts shown on its handoff card.
- Before narration, Storyboard requests one bounded Shot analysis and proposals only for missing fields. The Human can edit them; narration uses the reviewed values and analysis. The approval retains that reviewed brief as non-canonical evidence and fingerprints it across Storyboard, Previs and Timeline.
- Behavioral tests execute the actual button handler and endpoint, including text-only requests, complete facts, invalid output, exact dialogue and preserved Previs image mode.
- Durable test runs the actual approval handler through HTTP authentication and encrypted profile storage using committed Afterglow; reload restores approvals, failed writes remain visible, and silence can be retried.
- Existing rendered Windows proof clicks Create Narration and Approve text, captures the draft, reloads the encrypted story and observes approved text. Model response is a bounded fixture; no paid inference or private profile access.
- Focused UAT contracts, production build, convergence, exact-head architecture/security and impact-selected Windows Product Gate must pass before merge.

## Boundaries
Automated fixture evidence does not replace Bryan's final live provider/movie acceptance. Keep #2821 open. No TTS or paid video generation is introduced.
