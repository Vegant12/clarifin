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
  //
  // onnxruntime-node: native module — must not be bundled (same reason as unpdf).
  // runtime="nodejs" on the onnx-smoke route is also required (TA-INFRA-04).
  serverExternalPackages: ["unpdf", "onnxruntime-node"],
  // TA-INFRA-04 finding: onnxruntime-node native binaries (~200 MB) exceed
  // Vercel Hobby's 250 MB uncompressed function size limit. Excluding from file
  // tracing on all routes so the build succeeds. The /api/ta/onnx-smoke route
  // will throw "Cannot find module 'onnxruntime-node'" at runtime — that IS the
  // measurement: server-side ONNX is not viable on Vercel Hobby. T3 must use
  // onnxruntime-web (WASM) or an external inference endpoint instead.
  outputFileTracingExcludes: {
    "*": ["./node_modules/onnxruntime-node/**/*"],
  },
  outputFileTracingIncludes: {
    "/api/ta/onnx-smoke": ["./public/ta/dummy-model.onnx"],
  },
  experimental: {},
};

export default nextConfig;
