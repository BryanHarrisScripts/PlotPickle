# PlotPickle reviewed local dictation model

PlotPickle local dictation uses one reviewed English speech-to-text model by default. The model is downloaded only after explicit Human approval in Settings; it is not silently fetched at runtime and is not stored in a PPF.

- Model: `base.en`
- Format: whisper.cpp GGML
- Repository: `ggerganov/whisper.cpp` on Hugging Face
- Immutable revision: `80da2d8bfee42b0e836fc3a9890373e5defc00a6`
- File: `ggml-base.en.bin`
- Size: `147964211` bytes
- SHA-256: `a03779c86df3323075f5e796cb2ce5029f00ec8869eee3fdfb897afe36c6d002`
- Licence declared by the model repository: MIT
- Canonical PlotPickle pin: `config/local-voice-input.json`

The model is replaceable implementation material behind PlotPickle's local voice-input capability. It does not gain provider, agent, memory, project or canon authority.
