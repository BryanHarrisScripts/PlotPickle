# Developer Brief — #2468 Three explicit PlotPickle runtime modes

## Runtime contract

PlotPickle startup has three canonical modes:

1. `normal` — pristine current product.
2. `webmcp` — isolated autonomous UI QA.
3. `conversational-uat` — Human development session with DSDD/Conversational UAT authority.

The PowerShell launcher keeps the five-second default to normal. Legacy `-HumanTesting` / `--human-testing` remain aliases for normal only.

## Authority boundary

DSDD UI and the DSDD session API require `conversational-uat`. Normal and WebMCP may not expose or invoke that development authority.

WebMCP remains isolated. Normal and Conversational UAT use the governed Human profile/session path.

## Restart / readiness

The selected mode is part of the startup marker so an already-running server in another mode is not silently reused. Source-sync restart inherits the selected mode.

## Voice

Normal and Conversational UAT both prepare the reviewed local dictation runtime. WebMCP does not.

## Verification

Layer 1 owns launcher/composition behavior. Layer 4 protects the DSDD authority boundary. Layer 5 remains a non-regression gate.
