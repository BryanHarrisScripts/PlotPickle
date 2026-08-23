import assert from 'node:assert/strict';
import test from 'node:test';

import { toolArguments } from '../scripts/creative-uat/mcp-runtime.mjs';

test('toolArguments maps ref to target for target-only browser schemas', () => {
  const tool = {
    inputSchema: {
      type: 'object',
      properties: {
        target: { type: 'string' },
      },
      required: ['target'],
    },
  };

  assert.deepEqual(toolArguments(tool, { ref: 'button-42' }), { target: 'button-42' });
});

test('toolArguments supplies required target when browser schema exposes both target and ref', () => {
  const tool = {
    inputSchema: {
      type: 'object',
      properties: {
        target: { type: 'string' },
        ref: { type: 'string' },
      },
      required: ['target'],
    },
  };

  assert.deepEqual(toolArguments(tool, { ref: 'button-42' }), {
    ref: 'button-42',
    target: 'button-42',
  });
});

test('toolArguments leaves ref-only calls alone when target is optional', () => {
  const tool = {
    inputSchema: {
      type: 'object',
      properties: {
        target: { type: 'string' },
        ref: { type: 'string' },
      },
      required: ['ref'],
    },
  };

  assert.deepEqual(toolArguments(tool, { ref: 'button-42' }), { ref: 'button-42' });
});

test('toolArguments never overwrites an explicit target', () => {
  const tool = {
    inputSchema: {
      type: 'object',
      properties: {
        target: { type: 'string' },
        ref: { type: 'string' },
      },
      required: ['target'],
    },
  };

  assert.deepEqual(toolArguments(tool, { target: 'explicit-target', ref: 'button-42' }), {
    target: 'explicit-target',
    ref: 'button-42',
  });
});

test('toolArguments supplies CSS scale when current Playwright screenshot schema requires it', () => {
  const tool = {
    name: 'browser_take_screenshot',
    inputSchema: {
      type: 'object',
      properties: {
        type: { type: 'string' },
        filename: { type: 'string' },
        fullPage: { type: 'boolean' },
        scale: { type: 'string', enum: ['css', 'device'] },
      },
      required: ['scale'],
    },
  };

  assert.deepEqual(toolArguments(tool, { type: 'png', filename: 'writer.png', fullPage: true }), {
    type: 'png',
    filename: 'writer.png',
    fullPage: true,
    scale: 'css',
  });
});

test('toolArguments preserves an explicit screenshot scale', () => {
  const tool = {
    name: 'browser_take_screenshot',
    inputSchema: {
      type: 'object',
      properties: { scale: { type: 'string', enum: ['css', 'device'] } },
      required: ['scale'],
    },
  };

  assert.deepEqual(toolArguments(tool, { scale: 'device' }), { scale: 'device' });
});
