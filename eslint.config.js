import tsPlugin from "@typescript-eslint/eslint-plugin";
import tsParser from "@typescript-eslint/parser";

export default [
  {
    files: ["src/**/*.ts"],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        project: "./tsconfig.json",
        ecmaVersion: 2022,
        sourceType: "module",
      },
    },
    plugins: {
      "@typescript-eslint": tsPlugin,
    },
    rules: {
      // TYP-06: enforce zero any across the codebase
      // Exception: src/wxp/schema.ts requires z.lazy circular refs (2 commented suppressions)
      "@typescript-eslint/no-explicit-any": "error",
    },
  },
];
