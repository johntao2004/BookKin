import eslint from "@eslint/js";
import tseslint from "typescript-eslint";

export default tseslint.config(
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  {
    ignores: ["dist", "src/theme/generated-tokens.ts", "src/generated/**"],
  },
  {
    files: ["src/**/*.{ts,tsx}"],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      "no-restricted-properties": ["error", { "object": "crypto", "property": "randomUUID", "message": "Use utils/random-id: LAN HTTP does not expose randomUUID." },
        ...["Modal", "AntModal"].flatMap(object => ["confirm", "info", "success", "warning", "error"].map(property => ({
          object, property, message: "Use ui/confirmations useConfirmation() so dialogs inherit the active theme and locale.",
        }))),
      ],
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-unused-vars": ["error", { "argsIgnorePattern": "^_" }]
    }
  }
);
