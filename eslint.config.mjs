import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // The service-role client bypasses RLS. Only the HMAC-signed webhooks, the
  // signed grading-form roster and the SePay history sync (permission-checked)
  // may use it.
  {
    files: ["src/**/*.{ts,tsx}"],
    ignores: [
      "src/lib/supabase/**",
      "src/app/api/webhooks/**",
      "src/app/api/integrations/grading-roster/route.ts",
      "src/features/finance/sepay-history-sync-actions.ts",
    ],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "@/lib/supabase/service-role",
              message:
                "Service-role client bypasses RLS. Write through a permission-checked RPC instead.",
            },
          ],
        },
      ],
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
