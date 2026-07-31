import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    files: ["app/visual-storyboard.tsx"],
    rules: {
      "react-hooks/set-state-in-effect": "off",
      "react/no-unescaped-entities": "off",
    },
  },
  {
    files: ["app/buzz-workspace.tsx"],
    rules: {
      // The Buzz workspace returns to the query-driven PlotPickle shell rather
      // than treating the dashboard workspace as a separate Next route.
      "@next/next/no-html-link-for-pages": "off",
    },
  },
  {
    files: [
      "lib/github-command-outbox.ts",
      "lib/github-repository-recovery.ts",
      "tests/issue-161-github-command-outbox.test.mjs",
      "tests/issue-163-github-recovery-centre.test.mjs",
      "tests/issue-165-github-repository-recovery.test.mjs",
    ],
    rules: {
      "react-hooks/globals": "off",
      "react-hooks/immutability": "off",
      "prefer-const": "off",
    },
  },
  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
