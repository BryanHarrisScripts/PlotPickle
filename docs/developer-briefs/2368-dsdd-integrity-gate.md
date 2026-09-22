# #2368 DSDD semantic integrity and Pi grounding gate

## Dogfood evidence

Real DSDD use produced #2366 and #2367. In both cases the Human narration was retained, but the local interpretation degraded into "not a problem" filler. #2366 repeated it pathologically; #2367 then allowed Pi to recover part of the Human request while inventing repository paths.

Those issues are evidence only and are closed as not planned.

## Repair

The repair keeps the accepted three-step flow:

1. Interpret
2. Pi Draft
3. Publish Brief

It adds fail-closed boundaries between those steps.

Interpretations are now evaluated deterministically for repetition, meaningful content, preservation of Human anchors and false no-action conclusions. Invalid output remains in the private DSDD session as evidence but cannot be locked.

Requirements are derived only from non-degenerate interpretation statements and must pass the same meaning-preservation boundary.

Pi Draft now runs through Pi JSON event mode so PlotPickle observes actual read/grep/find/ls tool events. The final technical brief is checked against those observations. Concrete repository paths must have been observed. Code symbols named in the likely-files section must exist in an observed text file. Ungrounded claims reject the draft before it becomes READY.

Publish Brief recomputes semantic integrity and requires a current intent digest plus valid Pi grounding before any GitHub mutation.

## Authority

No source mutation, branch, PR or merge authority is added to DSDD or Pi. The downstream developer workflow remains the implementation authority and GitHub exact-head green remains merge authority.

## Verification

The focused regression uses the real #2366/#2367 narration failures plus valid/no-action controls and synthetic Pi JSON tool events. It is attached to the existing Layer 2 DSDD experience owner and Layer 4 agent-runtime owner; no new permanent gate is introduced.
