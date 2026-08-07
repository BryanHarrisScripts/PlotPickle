import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const registry = JSON.parse(await readFile(new URL('../config/visual-capture-registry.json', import.meta.url), 'utf8'))
const script = await readFile(new URL('../scripts/visual-capture.mjs', import.meta.url), 'utf8')

const requiredScreens = ['dashboard','learn','plan','storyboard','write','graphic-novel','build','feedback','refine','reports','collab','community','settings']

test('visual capture registry covers canonical primary screens', () => {
  const ids = registry.screens.map((screen) => screen.id)
  for (const id of requiredScreens) assert.ok(ids.includes(id), `missing ${id}`)
})

test('visual capture includes desktop tablet and mobile widths', () => {
  assert.deepEqual(registry.viewports.map((viewport) => viewport.id), ['desktop','tablet','mobile'])
  assert.ok(registry.viewports.find((viewport) => viewport.id === 'mobile').width <= 430)
})

test('capture harness writes a machine-readable manifest and stable filenames', () => {
  assert.match(script, /manifest\.json/)
  assert.match(script, /screen\.id.*viewport\.id/)
  assert.match(script, /--screenshot=/)
})

test('capture harness does not embed credentials or personal paths', () => {
  assert.doesNotMatch(script, /OPENAI_API_KEY|MINIMAX_API_KEY|GITHUB_TOKEN|private key/i)
  assert.doesNotMatch(JSON.stringify(registry), /Users\\|Users\/|AppData|api[_-]?key|token/i)
})

test('capture command supports CI or local pre-launched app base URL', () => {
  assert.match(script, /PLOTPICKLE_VISUAL_BASE_URL/)
  assert.match(script, /127\.0\.0\.1:4173/)
})
