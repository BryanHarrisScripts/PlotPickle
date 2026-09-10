# UI conformance violation shape

A deterministic visual violation records only bounded repair evidence:

```json
{
  "surface": "SETTINGS",
  "role": "pill",
  "identity": "agent-provider-openai",
  "property": "borderRadius",
  "actual": "6px",
  "expected": "0px",
  "source": "--pp-skin-radius"
}
```

Element text, story content, prompts, model responses, credentials and hidden reasoning are excluded.