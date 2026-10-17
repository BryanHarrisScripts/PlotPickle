import ts from "typescript";

const fixtureCompilerVersion = "6.0.3";
if (ts.version !== fixtureCompilerVersion) {
  throw new Error(`TypeScript fixture compiler version mismatch: expected ${fixtureCompilerVersion}, received ${ts.version}.`);
}

/** Compile isolated test fixtures that need emitted enums or parameter properties.
 * This checks syntax, not cross-module semantic types, and never rewrites imports
 * or changes Node's native TypeScript stripping API.
 */
export function transpileTypeScriptFixture(source, { fileName = "plotpickle-test-fixture.ts" } = {}) {
  if (typeof source !== "string") throw new TypeError("TypeScript fixture source must be a string.");
  const result = ts.transpileModule(source, {
    fileName,
    reportDiagnostics: true,
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2022,
      jsx: ts.JsxEmit.Preserve,
      strict: true,
      isolatedModules: true,
      sourceMap: false,
      inlineSourceMap: false,
    },
  });
  const errors = (result.diagnostics ?? []).filter((diagnostic) => diagnostic.category === ts.DiagnosticCategory.Error);
  if (errors.length) {
    const details = ts.formatDiagnostics(errors, {
      getCurrentDirectory: () => process.cwd(),
      getCanonicalFileName: (name) => name,
      getNewLine: () => "\n",
    });
    throw new Error(`TypeScript fixture compilation failed:\n${details}`);
  }
  return result.outputText;
}
