import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const source = await readFile(new URL('../app/creative-director-actions.tsx', import.meta.url), 'utf8')

test('Creative Director normal actions use writer intent instead of provider mechanics', () => {
  assert.match(source, />Illustrate</)
  assert.match(source, />Animate</)
  assert.match(source, />Open Settings</)
  assert.match(source, /Generation and routing details stay out of the creative flow/)
  assert.doesNotMatch(source, />Open generation settings</)
  assert.doesNotMatch(source, /Provider, model, checkpoint and workflow choices stay in Settings/)
})

test('writer-facing generation status removes provider terminology', () => {
  assert.match(source, /function writerFacingMessage/)
  assert.match(source, /provider job\/gi, "generation job"/)
  assert.match(source, /provider request\/gi, "generation request"/)
  assert.match(source, /providers\?\/gi, "routes"/)
})

test('advanced controls remain optional and story context stays automatic', () => {
  assert.match(source, /<summary>Advanced direction<\/summary>/)
  assert.match(source, /PlotPickle already uses the story, character identities, locations and visual language automatically/)
})
