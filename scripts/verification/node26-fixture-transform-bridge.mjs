// Test-only bridge for historical contract fixtures. Node 26 removed
// stripTypeScriptTypes({ mode: "transform" }); retained tests still need
// runtime TypeScript constructs (e.g., enum and parameter properties).
// Compiling with the pinned TypeScript dependency preserves those real
// semantics without changing PlotPickle production runtime or test claims.
import module, { syncBuiltinESMExports } from "node:module";
import ts from "typescript";

const major = Number(process.versions.node.split(".")[0]);
if (major !== 26) {
  throw new Error("The Node 26 legacy fixture bridge is only valid on the verified Node 26 CI runtime.");
}
const nativeStrip = module.stripTypeScriptTypes;
if (typeof nativeStrip !== "function") {
  throw new Error("Node 26 native TypeScript strip function is unavailable.");
}
if (globalThis.__plotpickleNode26LegacyFixtureBridge) {
  throw new Error("Refusing duplicate installation of the Node 26 legacy fixture bridge.");
}

function legacyTransform(source, options = {}) {
  if (options?.mode !== "transform") {
    return nativeStrip(source, options);
  }
  if (typeof source !== "string") {
    throw new TypeError("TypeScript fixture source must be a string.");
  }
  const result = ts.transpileModule(source, {
    fileName: "plotpickle-legacy-fixture.ts",
    reportDiagnostics: true,
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2022,
      jsx: ts.JsxEmit.Preserve,
      strict: true,
      isolatedModules: true,
      sourceMap: false,
      inlineSourceMap: false,
      removeComments: false,
    },
  });
  const failures = (result.diagnostics ?? []).filter((d) => d.category === ts.DiagnosticCategory.Error);
  if (failures.length) {
    const details = ts.formatDiagnosticsWithColorAndContext(failures, {
      getCurrentDirectory: () => process.cwd(),
      getCanonicalFileName: (name) => name,
      getNewLine: () => "\n",
    });
    throw new Error("Node 26 legacy fixture TypeScript compilation failed:\n" + details);
  }
  return result.outputText;
}

module.stripTypeScriptTypes = legacyTransform;
syncBuiltinESMExports();
globalThis.__plotpickleNode26LegacyFixtureBridge = Object.freeze({
  node: process.versions.node,
  compiler: ts.version,
  scope: "test-fixtures-only",
});
