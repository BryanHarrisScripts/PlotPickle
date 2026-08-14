# PR #602 — Remove dormant companion agents from normal startup

PlotPickle's normal Windows startup should open the product, not a collection of developer/test companion windows.

## Current problem

`Start-PlotPickle.bat` currently:

- prompts on every launch to run the Creative Writer UAT;
- starts the independent Full Story Builder agent in a separate window;
- starts the read-only UI Continuity Agent in another separate window;
- reports all three as startup agents even when the user only wants to open PlotPickle.

These helpers are not required by the current LEARN-first product path. Sage Brinewick and PLAN use the embedded Mastra/local AI runtime and must remain available.

## Required change

Normal `Start-PlotPickle.bat` startup must:

- stop auto-starting Full Story Builder;
- stop auto-starting UI Continuity Agent;
- stop prompting to launch Creative Writer UAT;
- stop printing the three-agent startup status messages;
- continue starting the private PlotPickle server normally;
- continue verifying Mastra and the local AI runtime because Sage/PLAN depend on them;
- keep optional companion services available from Settings as before.

## What remains

Do not delete the underlying Full Story Builder, UI Continuity audit, or Creative Writer UAT implementation in this cleanup. They remain dormant/manual developer tools until their product role is deliberately revisited. This avoids breaking legacy references while removing them from the user's normal startup path.

## Acceptance criteria

1. Starting PlotPickle does not open Full Story Builder, UI Continuity, or Creative Writer UAT windows.
2. Starting PlotPickle does not ask whether to run Creative Writer UAT.
3. No `[AGENT 1 OF 3]`, `[AGENT 2 OF 3]`, or `[AGENT 3 OF 3]` lines appear during normal startup.
4. Mastra/local runtime readiness remains part of startup.
5. Sage and PLAN local AI routing are unaffected.
6. Manual/test implementations remain in the repository for deliberate invocation.
7. Windows startup regression tests encode the new clean-start contract.
