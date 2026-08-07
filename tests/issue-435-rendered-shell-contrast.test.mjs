import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const header = await readFile(new URL('../app/application-shell-header.tsx', import.meta.url), 'utf8')
const navigationCss = await readFile(new URL('../app/minimal-navigation.css', import.meta.url), 'utf8')
const appearanceCss = await readFile(new URL('../app/appearance-runtime.css', import.meta.url), 'utf8')

test('mobile shell exposes every product destination through one explicit menu', () => {
  assert.match(header, /shell-mobile-navigation/)
  assert.match(header, /PRODUCT_NAVIGATION\.map/)
  assert.match(header, /aria-label={`Open application menu/)
  assert.match(navigationCss, /@media \(max-width: 760px\)/)
  assert.match(navigationCss, /shell-mobile-menu-panel/)
})

test('mobile shell removes the clipped desktop navigation zones', () => {
  assert.match(navigationCss, /> \.shell-primary-navigation/)
  assert.match(navigationCss, /> \.shell-zone-project-actions/)
  assert.match(navigationCss, /display: none;/)
  assert.match(navigationCss, /overflow: visible;/)
})

test('mobile menu keeps keyboard focus and minimum touch targets', () => {
  assert.match(navigationCss, /shell-mobile-navigation summary:focus-visible/)
  assert.match(navigationCss, /min-height: 44px/)
})

test('rendered dark Storyboard and Settings headings use theme contrast tokens', () => {
  assert.match(appearanceCss, /data-workspace-id=\"visuals\"/)
  assert.match(appearanceCss, /data-workspace-id=\"settings\"/)
  assert.match(appearanceCss, /\.workspace h1\{color:var\(--ink\)\}/)
  assert.match(appearanceCss, /\.workspace h1\+p\{color:var\(--ink-soft\)\}/)
})
