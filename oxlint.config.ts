import { defineConfig } from "oxlint"
import core from "ultracite/oxlint/core"
import react from "ultracite/oxlint/react"

const REACT_BANNED_IMPORTS = [
  {
    importNames: [
      "useEffect",
      "useLayoutEffect",
      "useMemo",
      "useCallback",
      "memo",
    ],
    message:
      "Derive state instead of syncing it, and let the React Compiler memoise. Justify any exception with a disable comment.",
    name: "react",
  },
]

export default defineConfig({
  extends: [core, react],
  ignorePatterns: [...(core.ignorePatterns ?? []), "ui/dist/**", ".fallow/**"],
  options: {
    reportUnusedDisableDirectives: "error",
    typeAware: true,
    typeCheck: true,
  },
  overrides: [
    {
      files: ["ui/src/**/*.{ts,tsx}"],
      rules: {
        "no-restricted-imports": ["error", { paths: REACT_BANNED_IMPORTS }],
      },
    },
  ],
  rules: {
    "func-style": ["error", "declaration", { allowArrowFunctions: true }],
    "no-inline-comments": ["error", { ignorePattern: "html" }],
    "no-use-before-define": "off",
    "sort-keys": [
      "error",
      "asc",
      { allowLineSeparatedGroups: true, caseSensitive: false, natural: true },
    ],
    "typescript/no-misused-promises": ["error", { checksVoidReturn: false }],
    "typescript/prefer-nullish-coalescing": [
      "error",
      { ignorePrimitives: { boolean: true } },
    ],
    "unicorn/filename-case": ["error", { case: "kebabCase" }],
  },
})
