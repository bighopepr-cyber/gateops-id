import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  globalIgnores([".next/**", "node_modules/**", "next-env.d.ts", "coverage/**", "playwright-report/**", "test-results/**", "src/generated/prisma/**", "supabase/functions/**"])
 ]);

export default eslintConfig;
