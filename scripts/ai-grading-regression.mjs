// Runs scripts/ai-grading-regression/main.ts with the app's "@/" alias, so the regression set uses
// the worker's own request and scoring code. ANTHROPIC_API_KEY comes from the environment.
import path from "node:path";
import { fileURLToPath } from "node:url";

import { createJiti } from "jiti";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const jiti = createJiti(import.meta.url, { alias: { "@": path.join(root, "src") } });
const { main } = await jiti.import("./ai-grading-regression/main.ts");
process.exitCode = await main(process.argv.slice(2));
