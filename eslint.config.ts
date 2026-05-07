import js from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";

export default [
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["**/*.{js,cjs,mjs,ts}"],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "module"
    }
  },
  {
    files: ["src/**/*.{js,ts}"],
    languageOptions: {
      globals: {
        ...globals.node,
        fetch: "readonly"
      }
    },
    rules: {
      // Unused vars are errors; prefix with _ to intentionally suppress
      "no-unused-vars": "off",
      "@typescript-eslint/no-unused-vars": ["error", {
        argsIgnorePattern: "^_",
        varsIgnorePattern: "^_",
        caughtErrorsIgnorePattern: "^_"
      }],
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-require-imports": "off",
      "no-console": "off"
    }
  },
  {
    files: ["scripts/**/*.{js,cjs,mjs,ts}", "tests/**/*.{js,cjs,mjs,ts}"],
    languageOptions: {
      globals: {
        ...globals.node,
        fetch: "readonly"
      }
    },
    rules: {
      "no-console": "off"
    }
  },
  {
    files: ["src/dashboard/render.ts", "public/**/*.{js,cjs,mjs,ts}"],
    languageOptions: {
      globals: {
        ...globals.browser
      }
    }
  },
  {
    ignores: [
      ".box-evolution-prompt-cache-lineage/",
      "dist/",
      "node_modules/",
      "state/",
      "tmp_evolution_worktree/",
      "tmp_research/"
    ]
  }
];
