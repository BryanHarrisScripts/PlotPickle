# #2124 WebMCP complete Matrix surface coverage

This slice closes the verification gap discovered during Human review of the WebMCP screenshot corpus.

The standard WebMCP catalogue now treats the visible Matrix navigation tree as a coverage contract rather than a hand-picked list. Reachable nested surfaces are captured through their real UI navigation paths. Dashboard destinations that are not visual surfaces are classified explicitly instead of silently disappearing from coverage.

Current coverage classes:

- captured: Community, Writer's Craft, Library and its seven directory destinations, Story Map, Visual Story, Scene Timeline, Identity, Settings, General, Story Mode, Local/Cloud/Hybrid Story Mode, Node, Agents, Bug Report, Notices, and the Shut Down Node confirmation;
- non-visual action: Log Off;
- currently unwired placeholders: Previs, Write, Edit, Feedback, Refine, Analytics, Wyrmwood Game, and The Unwritten.

Dashboard remains the sole locked visual baseline. Every newly registered surface is candidate-only until Human review of a real PlotPickle screenshot.

The Visual Director consumes the same standard registry so captured surfaces and Dashboard-continuity review cannot silently diverge.

The PlotPickle Score panel now remains structurally visible when no active story is loaded. It renders NR / NOT RATED and unavailable metric values instead of disappearing, preserving the mathematical Dashboard contract without inventing evidence.

Populated Visual Story and Scene Timeline evidence remains a separate verification-state concern. Empty-state capture is retained because the product correctly refuses to manufacture Scene/Shot/Frame data merely to fill the UI. A future populated-state fixture must enter through an existing story authority and must not become a second production-data model.
