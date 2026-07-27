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
    files: ["app/github-recovery-centre.tsx"],
    rules: {
      // Phase 6 deliberately installs and restores one browser-wide fetch interceptor
      // so existing GitHub writes can enter the protected local recovery queue.
      "react-hooks/globals": "off",
      "react-hooks/immutability": "off",
      // Recovery status refreshes are asynchronous local-server reads, not derived render state.
      "react-hooks/set-state-in-effect": "off",
      // PlotPickle's downloaded Vite-compatible local server uses this internal settings route.
      "@next/next/no-html-link-for-pages": "off",
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
