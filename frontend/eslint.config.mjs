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
    // Serwist が生成する Service Worker 成果物（minify 済み・lint 対象外）。
    "public/sw.js",
    "public/sw.js.map",
    "public/swe-worker-*.js",
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
