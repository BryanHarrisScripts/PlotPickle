import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

const appearance = fs.readFileSync(new URL('../app/appearance-runtime.css', import.meta.url), 'utf8')
const brief = fs.readFileSync(new URL('../app/graphic-novel-story-brief.module.css', import.meta.url), 'utf8')
const cast = fs.readFileSync(new URL('../app/cast-identity-queue.module.css', import.meta.url), 'utf8')

test('Graphic Novel shell stays inside the active desktop dark theme', () => {
  assert.match(appearance, /data-workspace-id="pitch"/)
  assert.match(appearance, /section\[aria-labelledby="graphic-novel-title"\]/)
  assert.match(appearance, /section\[aria-labelledby="graphic-novel-preflight"\]/)
  assert.match(appearance, /linear-gradient\(145deg,#111b25,#0d1822\)/)
})

test('Graphic Novel Story Brief preserves light mode and adds dark overrides', () => {
  assert.match(brief, /background: linear-gradient\(145deg, rgba\(238, 251, 246/)
  assert.match(brief, /:global\(html\[data-plotpickle-theme="dark"\]\) \.panel/)
  assert.match(brief, /background: linear-gradient\(145deg, #111b25, #0d1822\)/)
  assert.match(brief, /\.grid textarea/)
})

test('cast preparation keeps explicit cost consent while matching the dark workspace', () => {
  assert.match(cast, /\.confirmation/)
  assert.match(cast, /:global\(html\[data-plotpickle-theme="dark"\]\) \.confirmation/)
  assert.match(cast, /background: #2b2415/)
  assert.match(cast, /:global\(html\[data-plotpickle-theme="dark"\]\) \.metrics div/)
})
