# #2694 — Normal-startup supervisor and service registry

Wire the existing sidecar supervisor into normal startup without delaying core readiness. Register all reviewed runtime services in a bounded static registry. Persist machine-readable lifecycle/evidence under PlotPickle local app data. Unknown services are not launchable. Sidecar failure never terminates PlotPickle. Existing WebMCP Testing and Conversational UAT diagnostics remain available.
