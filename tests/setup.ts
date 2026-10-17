import "@testing-library/jest-dom/vitest";

import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

// Vitest globals are off, so @testing-library/react never registers its own
// afterEach(cleanup). Unmount every rendered tree after each test so pending
// React work cannot outlive the jsdom environment.
afterEach(() => {
  cleanup();
});
