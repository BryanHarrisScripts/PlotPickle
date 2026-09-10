# UI Conformance Authority

PlotPickle uses one layered UI authority model.

`docs/UI-UX-DESIGN-STANDARD.md`
-> `app/design-tokens.css`
-> active Skin definition such as `app/skin-v1-definition.css`
-> rendered component semantics
-> WebMCP conformance observation
-> focused UAT evidence
-> bounded Pi/Cline repair

The higher layer defines intent; lower layers implement and verify it. An active Skin may specialize presentation values but must not create an independent product interaction system. Verification adapters observe and report; they never grant design or mutation authority.
