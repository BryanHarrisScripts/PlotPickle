# Runtime Phase 5 Windows convergence

Implement normal startup without a diagnostic choice, defer optional runtime work until canonical core readiness, preserve inventory-only startup provider checks, and confirm owned services and browser have exited before launcher success. Retain optional media output before reporting success and preserve unavailable-engine fallback.

The independent Windows proof launches the actual batch entrypoint, observes the normal profile gate, checks six runtime states and durable session identity, kills each service while checking core availability, and verifies restart and cleanup. It records one warm core comparison with sidecars and a core-only baseline. This comparison is not the ratified multi-sample Afterglow benchmark. Provisioning occurs explicitly before measured startup.

Convergence checks below establish implementation coverage, not observed product success. Merge also requires the exact-head Windows proof and all seven architecture checks. Post-merge CI repeats the critical Windows journey. Real optional native FFrames video rendering is unproven when the prepared binary is absent; retained synthetic fixture bytes do not constitute playable-output evidence.
