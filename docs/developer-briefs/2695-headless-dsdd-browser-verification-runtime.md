# #2695 — Auto-start Headless DSDD and Browser Verification

Normal startup initializes DSDD governance and the deterministic Browser Verification broker as background services. DSDD has no ordinary Human-facing UAT workspace. Browser Verification is ready but launches no browser or Full QA until a named governed request arrives. Synthetic verification state remains isolated from the Human profile.
