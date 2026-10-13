# #2957 — First-image review, rejection and retry governed by approved truth

## Source authority
Human direction October 13, 2026: implement issue #2957 under
`docs/white-papers/AI_Programming_Evolution_White_Paper.md` v3.
The first-image attempt returned a visually unsuitable candidate; PlotPickle
disabled prompt editing and exposed only Use Image. The Human must be able to
reject, edit, and regenerate without accepting it or changing passages.

## PP-IMG-RETRY-001 / v1.0 — mathematically constrained behavioural truth
For an active (project p, Block b ∈ [1,24], Mini m ∈ [1,4], passage s)
and candidate c with immutable source association `A(c)=(p,b,m,s)`:

1. `Reject(c)` is permitted iff `review(c)=draft` and c is not accepted.
   Its sole intended story mutation is `review(c):=rejected` while the record,
   submitted prompt, provider, model, source linkage and asset URL remain in
   history. Every other Foundations/World/Outline value and accepted asset
   remains unchanged. No deletion.
2. `Regenerate(prompt')` is permitted for an existing source passage with
   the same routing readiness and explicit paid-provider acknowledgement as
   a first request. Success adds a **new** draft candidate with distinct ID,
   recorded exact submitted `prompt'`, same address, and `parentArtifactId`
   referring to the preceding candidate where one exists; the old artifact
   stays as-is. Rejection is not required before proposing another draft.
3. Exactly zero candidates become accepted by Generate/Reject. Only explicit
   Use Image grants acceptance. An accepted first image cannot be rejected or
   silently displaced by a subsequent draft:
   `acceptedFirst(A) ⇒ activeFirst(A)=acceptedFirst(A)`.
4. Selection is isolated by **both** canonical story address and passage.
   Rejected candidates are excluded from active playback; history includes
   draft, accepted and rejected attempts. A failed or stale response does not
   add a new project artifact or change approvals.
5. Prompt edits are local working text until an authorized generation call;
   changing prompts never rewrites screenplay source. Existing unrelated story
   data survives Reject unchanged, including Foundations metadata.
6. Storage and provider failures are surfaced, not called success. Existing
   project-store capacity, external generation quality, actual saved-provider
   output and Windows restart durability require their own observations.

## Negative controls
Reject an accepted first image; reject candidate for a different source slot;
failed provider result; changed project/address during generation; no passage;
unready route or unpaid cloud request; draft regenerated without accepting;
history of multiple previous drafts/rejections; deterministic ordering ties;
unrelated Foundations values retained. Do not silently approve/pay/delete.

## Implementation and evidence
Reuse the existing `foundations.visual.store/discard/accept` authority,
image routing gateway and durable PPF visualArtifacts. Add a pure tested
address-scoped candidate selector, visible review history, actionable controls,
and a focused PR-gate test/build. Add WHITE-PAPER-V3 catalogue entry with
contract, expected outputs, negative controls and scoped evidence.

Engineering can PASS from executable state-model tests, source wiring, types,
build and required seven-layer CI at exact PR revision. Real authenticated
Windows same-story rejected-image persistence, actual model generation,
provider charging and restart are UNPROVEN until independently observed under
#2943; no green CI badge substitutes for those observations.
