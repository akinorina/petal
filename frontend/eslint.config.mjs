import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
  {
    rules: {
      // react-hooks v7 で追加された新ルール。
      // useEffect 内でのデータ取得パターン（fetch → setState）は有効なため警告に留める。
      "react-hooks/set-state-in-effect": "warn",
    },
  },
]);

export default eslintConfig;
