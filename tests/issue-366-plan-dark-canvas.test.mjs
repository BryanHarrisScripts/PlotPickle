import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

const appearance = fs.readFileSync(new URL('../app/appearance-runtime.css', import.meta.url), 'utf8')
const direction = fs.readFileSync(new URL('../lib/product-direction.ts', import.meta.url), 'utf8')

test('Plan keeps its content canvas inside the desktop dark theme', () => {
  assert.match(direction, /\{ id: "planner", label: "Plan"/)
  assert.match(appearance, /data-workspace-id="planner"/)
  assert.match(appearance, /\.planner-content\{background:radial-gradient/)
  assert.match(appearance, /linear-gradient\(180deg,#0b151f,#081018\)/)
  assert.match(appearance, /color:var\(--ink\)/)
})

test('Plan dark canvas is scoped to the active Plan workspace', () => {
  assert.match(appearance, /body:has\(\.application-shell-header \[data-workspace-id="planner"\]\[aria-current="page"\]\) \.planner-content/)
})
