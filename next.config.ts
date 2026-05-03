import type { NextConfig } from "next";

// Importing env at config-load forces fail-fast validation at build/dev start
// (Plan 02 will create src/lib/env.ts; until then, this import is commented).
// import "@/lib/env";

const nextConfig: NextConfig = {
  experimental: {},
};

export default nextConfig;
