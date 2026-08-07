import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

const source = fs.readFileSync(new URL('../app/script-workspace.tsx', import.meta.url), 'utf8')

test('Write assistant starts from story context rather than provider setup', () => {
  assert.match(source, /Develop this exact story moment\./)
  assert.match(source, /PlotPickle already has the current Block, mini-block and character context/)
  assert.match(source, /Block \$\{block\.number\}/)
  assert.match(source, /Mini-block \$\{block\.number\}\.\$\{miniBlockNumber\}/)
  assert.match(source, /Characters: \$\{project\.characters\.map/)
  assert.doesNotMatch(source, /through the provider connected in Settings/)
  assert.doesNotMatch(source, /OpenAI|Ollama|ComfyUI|MiniMax|checkpoint|model selector/i)
})

test('Write assistant keeps suggestions reviewable before screenplay insertion', () => {
  assert.match(source, /Suggest a version/)
  assert.match(source, /Insert as action/)
  assert.match(source, /Insert as dialogue/)
  assert.match(source, /Nothing is added to the screenplay until you choose to insert it/)
  assert.match(source, /if \(!aiSuggestion \|\| aiState === "error"\) return/)
})

test('Write assistant offers one plain-language Settings recovery path', () => {
  assert.match(source, /Writing assistance is unavailable\. Open Settings to check the writing setup\./)
  assert.match(source, /window\.location\.assign\("\/ai-routing"\)/)
  assert.match(source, />Open Settings<\/button>/)
})
