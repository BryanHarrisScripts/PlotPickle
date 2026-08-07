import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const appearanceCss = await readFile(new URL('../app/appearance-runtime.css', import.meta.url), 'utf8')
const shelfCss = await readFile(new URL('../app/workspace-capability-shelf.module.css', import.meta.url), 'utf8')

test('Learn dark theme scopes instructional surfaces to shared appearance tokens', () => {
  assert.match(appearanceCss, /data-workspace-id=\"learn\"/)
  assert.match(appearanceCss, /\.learn-section-tabs/)
  assert.match(appearanceCss, /\.guide-page/)
  assert.match(appearanceCss, /\.guide-hero/)
  assert.match(appearanceCss, /\.guide-card/)
  assert.match(appearanceCss, /\.questions-card/)
})

test('workspace capability shelf uses shared theme tokens instead of fixed light surfaces', () => {
  assert.match(shelfCss, /border: 1px solid var\(--line\)/)
  assert.match(shelfCss, /color: var\(--ink\)/)
  assert.match(shelfCss, /color: var\(--ink-soft\)/)
  assert.match(shelfCss, /background: color-mix/)
  assert.doesNotMatch(shelfCss, /background: #fff;/)
})
