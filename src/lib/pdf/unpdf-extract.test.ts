import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { describe, it } from "vitest";

/**
 * unpdf/pdf.js uses worker `postMessage` with types that Vitest's Vite runner
 * fails to clone. Real extraction is verified via a raw Node subprocess.
 */
describe("unpdf-extract", () => {
  it("passes Node smoke script (per-page text + items)", () => {
    const script = fileURLToPath(new URL("./unpdf-smoke.mjs", import.meta.url));
    execFileSync(process.execPath, [script], { stdio: "inherit" });
  });
});
