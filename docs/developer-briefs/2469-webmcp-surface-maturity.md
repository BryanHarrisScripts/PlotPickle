# Developer Brief — #2469 WebMCP surface maturity awareness

The Human baseline proved that Matrix already renders green LOCKED, yellow IN REVIEW and gray UNAVAILABLE Dashboard states while WebMCP still reported no locked surfaces. It also found four connected in-review destinations missing canonical governance: Screening, Foley, Narration and Music.

This implementation:
- derives maturity from the rendered Dashboard authority rather than creating a second lock list;
- records maturity in WebMCP evidence and console output separately from repository visual-baseline approval;
- brings Screening/Foley/Narration/Music under census-only canonical governance without promoting them from IN REVIEW;
- gives the three Sound surfaces unique rendered canonical ids;
- expands the Dashboard keyboard audit through the full ordered menu, wrap-around, Home and End;
- leaves story/canon authority untouched.

The supplied 2026-09-26 Full QA run remains the before-state. Exact-head Architecture Verification, especially Layer 1 and Layer 5, is required before merge.
