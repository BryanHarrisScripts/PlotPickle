# BUZZ live round-trip verification

Goal: make PlotPickle prove the configured BUZZ connection works on the local machine instead of inferring that from source contracts or a simple relay health probe.

Acceptance criteria:

- Settings provides one explicit `Test live BUZZ connection` action.
- The action requires the locally encrypted, verified BUZZ identity.
- PlotPickle finds the private `gatehouse` Guildhall room.
- PlotPickle sends a uniquely tagged signed health message to that room and then reads recent room messages back.
- Success is shown only if the exact tag is observed on the read path.
- Settings plainly distinguishes `Not tested yet`, `Testing`, `Signed test message received`, and `Round-trip failed`.
- No GitHub secret is required and no credential is returned to the browser.
- BUZZ Guildhall tests and the normal PlotPickle build/UAT gates must be green before merge.
