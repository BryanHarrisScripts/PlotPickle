# UI conformance test principle

Conformance assertions should compare computed rendered values to the active semantic contract, not merely search source text for token names. Source-level regression tests may protect the audit architecture, but the browser audit is authoritative for whether the running surface actually resolves correctly.