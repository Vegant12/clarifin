import type { NextConfig } from "next";

/**
 * Side-effect import — triggers Zod validation of every required env var at
 * config-load time. If any required var is missing/malformed, Next.js fails
 * to start with a clear error message, satisfying Success Criterion 4.
 *
 * Relative path (not @/* alias) because next.config.ts runs in Node before
 * tsconfig path aliases are wired into the module resolver.
 */
import "./src/lib/env";

const nextConfig: NextConfig = {
  // Prevent Next.js from bundling pdfjs-dist (used by unpdf) through webpack.
  // Bundling it causes WASM/worker reference failures on Vercel's serverless
  // runtime — the module fails to initialise, the parse-batch function crashes
  // before it can update the document status, and uploads get stuck at "parsing".
  serverExternalPackages: ["unpdf"],
  experimental: {},
};

export default nextConfig;
