# Learn Three-Column Creative Room POC

Issue: #567

Contract references: PP-UX-002..007, PP-VIS-001..006, PP-ROOM-001..008, PP-AGENT-001..007, PP-LEARN-001..004, PP-STACK-001..014.

This slice migrates only Learn first. It preserves the existing 81-module curriculum and applies the locked three-column pattern around the active learning canvas:

Story Navigator | Learn Creative Canvas | Creative Room

The Creative Room exposes a selectable Creative Director/specialist role and an independently tunable conversational tone. Until the Mastra/Vercel proof is connected to live story tools, room responses remain advisory/local and never change canon or trigger paid generation.

Candidate runtime dependencies installed for this proof: Vercel AI SDK (`ai` 7.0.59) and Mastra core (`@mastra/core` 1.57.0). These remain replaceable implementation layers under PP-AGENT-007 and PP-STACK-012.

The UI Continuity Agent now closes its Playwright client before cleanup, retries Windows temporary-directory removal, and reports a persistent EBUSY lock as a cleanup warning rather than misclassifying a completed audit as a failed audit.

Gate candidate: the generated implementation and dependency lock are committed on this branch and ready for Quality, Safety, Visual, and Release Readiness validation.

Acceptance requires the existing 30-stage Creative Writer UAT to remain valid, the Learn library to remain discoverable, and all four PlotPickle merge gates to pass.