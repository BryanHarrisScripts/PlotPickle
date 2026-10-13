# Developer brief — #2953 follow-up: Write confirmed Save and Matrix handoff truth

## Existing and new evidence
PR #2963 already merged the original Block 01 → 24 in-Matrix continuity repair. Its unit/history and synthetic WebMCP evidence do not constitute authenticated Windows Brotherly Love acceptance. Review of main revealed an adjacent concrete weakness: the Write Save callback reported "Saved" immediately after synchronous local Library cache mutation, without awaiting the encrypted Human profile acknowledgement or flush. An account/session failure could therefore leave a falsely saved draft, then permit Block change, Dashboard return, PageFlow, LEARN or Outline navigation. Those outward links also bypassed the unsaved editor confirmation.

## Human-approved authority
TRUTH-BLOCK-001: 24 Blocks / 96 Mini-Blocks are addresses inside one selected Human story; changing address never changes imported source evidence, project identity or canon. PP-SAVE-001 T1/T8 and WHITE-PAPER-V3 W8/W9: a rendered "Saved" claim follows authenticated encrypted persistence, not local cache optimism; pending or unconfirmed writes must preserve work and prevent unsafe in-app departure. No automatic source rewrite or fake completed Block.

## Scoped patch
- Retain the one canonical Library project (no new store or client account authority).
- Write Save still prepares a bounded project revision, but remains visibly PENDING until persistActiveProfileProject("", projectId), profile-wide flush, and active project identity check complete. Local optimistic state cannot reset the dirty indicator while a vault result is unknown.
- On server/CSRF/store rejection or project identity mismatch, retain the editor's working text, do not claim "Saved", and allow a deliberate retry. Do not reinterpret local cache as durable vault evidence.
- Block/Mini navigation and Matrix return are blocked during a pending Write Save. Outbound Outline, PageFlow, and Learn links require the same unsaved-editor discard decision as the in-shell address selector. Existing source-evidence panels are never written by this patch.
- Execute the *actual* Write Save handler through a deferred synthetic acknowledgement, successful flush, rejected encrypted write and changed-project negative case. Exercise all 24 x 4 Matrix addresses while keeping source object identity. Register the new checks under the white paper and PP-SAVE and converge within this bounded file set.

## Independent evidence limits
Unit VM fixtures, selected synthetic browser/WebMCP tests and Windows CI build establish these authored behaviours only. They **do not** demonstrate a real user's imported Final Draft bytes, personal vault credentials, a real Windows process restart, or the complete 24-Block film. Those named Human Windows tests and exact original imported screenplay readback remain pending under #2943. Avoid pretending that PR green means completed product acceptance.
