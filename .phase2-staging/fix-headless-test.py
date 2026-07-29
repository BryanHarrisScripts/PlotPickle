from pathlib import Path
p = Path('tests/issue-144-connection-trust.test.mjs')
s = p.read_text()
old = '''    await vault.writeCredentialJson("github-connection.json", { version: 1, token: "test-token" });\n    await vault.writeCredentialJson("ai-connection.json", { version: 1, apiKey: "test-key" });\n    await mkdir(path.join(temporaryHome, "projects"), { recursive: true });\n'''
new = '''    const secrets = path.join(temporaryHome, "secrets");\n    await mkdir(secrets, { recursive: true });\n    await writeFile(path.join(secrets, "github-connection.json"), JSON.stringify({ test: true }));\n    await writeFile(path.join(secrets, "ai-connection.json"), JSON.stringify({ test: true }));\n    await mkdir(path.join(temporaryHome, "projects"), { recursive: true });\n'''
if old not in s:
    raise SystemExit('Phase 2 credential boundary test target was not found')
s = s.replace(old, new)
s = s.replace('''    assert.deepEqual(await vault.readCredentialJson("github-connection.json"), { version: 1, token: "test-token" });\n\n''', '')
p.write_text(s)
