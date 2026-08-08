import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

const script = fs.readFileSync(new URL('../scripts/visual-capture.mjs', import.meta.url), 'utf8')
const registry = JSON.parse(fs.readFileSync(new URL('../config/visual-capture-registry.json', import.meta.url), 'utf8'))

test('visual capture emits a reviewer-facing evidence index', () => {
  assert.match(script, /function visualEvidenceIndex\(manifest\)/)
  assert.match(script, /PlotPickle rendered visual evidence/)
  assert.match(script, /Workspace \| Viewport \| Size \| Route \| Screenshot/)
  assert.match(script, /writeFile\(path\.join\(outputDirectory, 'REVIEW\.md'\)/)
})

test('evidence index keeps every registered desktop workspace and key story-context state reviewable', () => {
  assert.deepEqual(registry.viewports, [{ id: 'desktop', width: 1440, height: 1000 }])
  assert.equal(registry.screens.length, 19)
  assert.deepEqual(
    registry.screens.filter((screen) => screen.id.startsWith('plan')).map((screen) => screen.path),
    [
      '/?workspace=plan',
      '/?workspace=plan&section=storySetup',
      '/?workspace=plan&section=blocks',
      '/?workspace=plan&section=blocks&block=7',
    ],
  )
  assert.ok(registry.screens.some((screen) => screen.id === 'storyboard-plan-context' && screen.path === '/?workspace=storyboard&block=7&mini=3&visualSection=frames'))
  assert.ok(registry.screens.some((screen) => screen.id === 'storyboard-review-context' && screen.path === '/?workspace=storyboard&block=7&mini=3&visualSection=frames&review=1'))
  assert.ok(registry.screens.some((screen) => screen.id === 'write-plan-context' && screen.path === '/?workspace=write&block=7&mini=3'))
  for (const screen of registry.screens) {
    assert.match(screen.id, /^[a-z0-9-]+$/)
    assert.match(screen.path, /^\//)
  }
})

test('review guidance covers the desktop visual-quality contract without secrets', () => {
  assert.match(script, /hierarchy, spacing, typography, density, contrast, status clarity, discoverability/)
  assert.match(script, /technical-provider leakage/)
  assert.match(script, /do not contain credentials, API keys or private provider payloads/)
  assert.doesNotMatch(script, /process\.env\.(OPENAI_API_KEY|MINIMAX_API_KEY|GITHUB_TOKEN)/)
})
