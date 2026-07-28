import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    files: ["app/visual-storyboard.tsx"],
    rules: {
      // The Visual Board restores browser URL deep links after hydration.
      // This is a deliberate one-time state sync, not a derived-state loop.
      "react-hooks/set-state-in-effect": "off",
      // Product copy includes possessives inside compact JSX headings.
      "react/no-unescaped-entities": "off",
    },
  },
  {
    files: [
      "lib/github-command-outbox.ts",
      "tests/issue-161-github-command-outbox.test.mjs",
      "tests/issue-163-github-recovery-centre.test.mjs",
    ],
    rules: {
      // GitHub recovery is a server-side state machine and filesystem test,
      // not a React render path. These mutations remain locally bounded and
      // are covered by strict TypeScript and behavioural tests.
      "react-hooks/globals": "off",
      "react-hooks/immutability": "off",
      "prefer-const": "off",
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
