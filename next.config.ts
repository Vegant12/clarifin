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
  experimental: {},
};

export default nextConfig;
