import js from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";
import { defineConfig } from "eslint/config";

export default defineConfig([
  // --------------------
  // Ignore folders
  // --------------------
  {
    ignores: ["dist/**", "node_modules/**"],
  },

  // --------------------
  // JavaScript files
  // --------------------
  {
    files: ["**/*.{js,mjs,cjs}"],
    languageOptions: {
      globals: globals.node,
    },
    rules: {
      ...js.configs.recommended.rules,
    },
  },

  // --------------------
  // TypeScript files
  // --------------------
  {
    files: ["**/*.{ts,mts,cts}"],
    languageOptions: {
      globals: globals.node,
      parser: tseslint.parser,
      parserOptions: {
        project: "./tsconfig.json",
      },
    },
    plugins: {
      "@typescript-eslint": tseslint.plugin,
    },
    rules: {
      // TypeScript-friendly rules
      "no-unused-vars": "off",
      "@typescript-eslint/no-unused-vars": "error",
      "no-unused-expressions":"error",
      "prefer-const":"error",
      "no-console":"warn",
      "no-undef":"error"
    },
    // "globals":{
    //   "process":"readonly"
    // }
  },
]);
