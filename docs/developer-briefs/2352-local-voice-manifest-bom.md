# #2352 Windows local dictation installed.json BOM compatibility

## UAT evidence

After #2350 merged green, Human DSDD UAT still reported:

"The local dictation install manifest is missing or unreadable. Repair Local Dictation before using the microphone."

The runtime and base.en model were already present. The failing boundary was the installed.json handoff.

## Root cause

PlotPickle invokes Windows PowerShell through powershell.exe. On Windows PowerShell 5.1, Set-Content -Encoding UTF8 writes a UTF-8 BOM. The local Node runtime read installed.json as UTF-8 and passed the raw string directly to JSON.parse. A leading U+FEFF makes that parse fail, so an otherwise valid reviewed install appeared unreadable.

## Fix

1. New installed.json files are written with System.Text.UTF8Encoding(false), which emits UTF-8 without a BOM.
2. The installer immediately asserts that the file it just wrote does not begin with EF BB BF.
3. The Node runtime strips one leading U+FEFF before JSON.parse so already-installed affected machines recover without re-downloading whisper.cpp/base.en.
4. All existing provenance and SHA-256 validation remains unchanged.
5. The installer remains Layer 6 Provider Runtime owned and the focused regression runs through the existing local-voice provider contract.

## Acceptance

- Existing BOM-prefixed installed.json is parse-compatible.
- Newly created installed.json is BOM-free UTF-8.
- Runtime/model hash verification is unchanged.
- Provenance matching is unchanged.
- Startup-owned provisioning from #2350 is unchanged.
- Windows local voice smoke remains green.
