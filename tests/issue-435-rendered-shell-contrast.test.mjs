import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const appearanceCss = await readFile(new URL('../app/appearance-runtime.css', import.meta.url), 'utf8')

test('rendered dark Storyboard and Settings headings use theme contrast tokens', () => {
  assert.match(appearanceCss, /data-workspace-id=\"visuals\"/)
  assert.match(appearanceCss, /data-workspace-id=\"settings\"/)
  assert.match(appearanceCss, /\.workspace h1\{color:var\(--ink\)\}/)
  assert.match(appearanceCss, /\.workspace h1\+p\{color:var\(--ink-soft\)\}/)
})
