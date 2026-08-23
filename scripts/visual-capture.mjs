#!/usr/bin/env node

import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import process from 'node:process'

const root = path.resolve(process.argv[2] ?? '.')
const registryPath = path.join(root, 'config', 'visual-capture-registry.json')
const outputDirectory = path.resolve(process.argv[3] ?? path.join(root, 'reports', 'visual-capture'))
const baseUrl = process.env.PLOTPICKLE_VISUAL_BASE_URL || 'http://127.0.0.1:4173'

function browserCandidates() {
  if (process.platform === 'win32') return [
    process.env.CHROME_PATH,
    process.env.EDGE_PATH,
    path.join(process.env.PROGRAMFILES || 'C:\\Program Files', 'Google', 'Chrome', 'Application', 'chrome.exe'),
    path.join(process.env.PROGRAMFILES || 'C:\\Program Files', 'Microsoft', 'Edge', 'Application', 'msedge.exe'),
  ].filter(Boolean)
  if (process.platform === 'darwin') return [
    process.env.CHROME_PATH,
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
  ].filter(Boolean)
  return [process.env.CHROME_PATH, '/usr/bin/google-chrome', '/usr/bin/google-chrome-stable', '/usr/bin/chromium', '/usr/bin/chromium-browser'].filter(Boolean)
}

function findBrowser() {
  const browser = browserCandidates().find((candidate) => existsSync(candidate))
  if (!browser) throw new Error(`Chrome/Edge/Chromium not found. Checked: ${browserCandidates().join(', ')}`)
  return browser
}

function run(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd: root, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true })
    let stderr = ''
    child.stderr.on('data', (chunk) => { stderr += chunk })
    child.once('error', reject)
    child.once('exit', (code) => code === 0 ? resolve() : reject(new Error(`${path.basename(command)} exited ${code}: ${stderr.trim()}`)))
  })
}

async function waitForHttp(url, timeoutMs = 120_000) {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(3000) })
      if (response.ok || response.status < 500) return
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 500))
  }
  throw new Error(`Timed out waiting for ${url}`)
}

async function startServer() {
  if (process.env.PLOTPICKLE_VISUAL_BASE_URL) return null
  const viteEntry = path.join(root, 'node_modules', 'vite', 'bin', 'vite.js')
  if (!existsSync(viteEntry)) throw new Error('Dependencies are not installed; run npm ci first.')
  const child = spawn(process.execPath, [viteEntry, '--host', '127.0.0.1', '--port', '4173'], {
    cwd: root,
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  })
  child.stdout.pipe(process.stdout)
  child.stderr.pipe(process.stderr)
  await waitForHttp(baseUrl)
  return child
}

async function capture(browser, screen, viewport) {
  const filename = `${screen.id}__${viewport.id}.png`
  const filepath = path.join(outputDirectory, filename)
  const url = new URL(screen.path, baseUrl).toString()
  const userDataDirectory = path.join(os.tmpdir(), `plotpickle-visual-${process.pid}-${screen.id}-${viewport.id}`)
  const args = [
    '--headless=new',
    '--disable-gpu',
    '--hide-scrollbars',
    '--force-device-scale-factor=1',
    '--virtual-time-budget=3000',
    '--timeout=10000',
    `--window-size=${viewport.width},${viewport.height}`,
    `--user-data-dir=${userDataDirectory}`,
    `--screenshot=${filepath}`,
    url,
  ]
  await run(browser, args)
  return { screen: screen.id, viewport: viewport.id, width: viewport.width, height: viewport.height, url, file: filename }
}

function visualEvidenceIndex(manifest) {
  const lines = [
    '# PlotPickle rendered visual evidence',
    '',
    'Use this index to review the actual rendered desktop product before approving a UI/UX pull request.',
    '',
    `Generated: ${manifest.generatedAt}`,
    `Browser: ${manifest.browser}`,
    `Captured views: ${manifest.captures.length}`,
    '',
    '| Workspace | Viewport | Size | Route | Screenshot |',
    '| --- | --- | ---: | --- | --- |',
  ]

  for (const capture of manifest.captures) {
    const route = new URL(capture.url).pathname + new URL(capture.url).search
    lines.push(`| ${capture.screen} | ${capture.viewport} | ${capture.width}×${capture.height} | \`${route}\` | [${capture.file}](./${capture.file}) |`)
  }

  lines.push(
    '',
    'Review for hierarchy, spacing, typography, density, contrast, status clarity, discoverability, plain-language recovery and technical-provider leakage.',
    '',
    'The screenshots and manifest are deterministic review evidence; they do not contain credentials, API keys or private provider payloads.',
    '',
  )

  return lines.join('\n')
}

async function main() {
  const registry = JSON.parse(await readFile(registryPath, 'utf8'))
  await mkdir(outputDirectory, { recursive: true })
  const browser = findBrowser()
  const server = await startServer()
  const captures = []
  try {
    for (const screen of registry.screens) {
      for (const viewport of registry.viewports) captures.push(await capture(browser, screen, viewport))
    }
  } finally {
    if (server && server.exitCode === null) server.kill('SIGTERM')
  }
  const manifest = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    browser: path.basename(browser),
    captures,
  }
  await writeFile(path.join(outputDirectory, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`, 'utf8')
  await writeFile(path.join(outputDirectory, 'REVIEW.md'), visualEvidenceIndex(manifest), 'utf8')
  console.log(`Captured ${captures.length} deterministic PlotPickle views in ${outputDirectory}`)
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack : error)
  process.exitCode = 1
})
