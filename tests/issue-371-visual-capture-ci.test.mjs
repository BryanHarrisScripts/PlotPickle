import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const workflow = await readFile(new URL('../.github/workflows/rendered-visual-capture.yml', import.meta.url), 'utf8')

test('rendered visual capture runs only for UI-relevant pull request changes', () => {
  assert.match(workflow, /Find changed UI files/)
  assert.match(workflow, /has_ui=true/)
  assert.match(workflow, /\.\(html\|css\|scss\|jsx\|tsx\|vue\)/)
})

test('rendered visual capture publishes the manifest and screenshots as an artifact', () => {
  assert.match(workflow, /node scripts\/visual-capture\.mjs/)
  assert.match(workflow, /actions\/upload-artifact@043fb46d1a93c77aae656e7c1c64a875d1fc6a0a/)
  assert.match(workflow, /reports\/visual-capture\//)
  assert.match(workflow, /retention-days: 14/)
})

test('workflow fails instead of pretending visual evidence exists when browser or files are missing', () => {
  assert.match(workflow, /Chrome\/Chromium is unavailable/)
  assert.match(workflow, /if-no-files-found: error/)
})
