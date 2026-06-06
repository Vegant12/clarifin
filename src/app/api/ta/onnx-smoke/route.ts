/**
 * Phase 13 Plan 07 — TA-INFRA-04: ONNX hello-world cold-start smoke route.
 *
 * Lazy-loads onnxruntime-node, creates an InferenceSession from the bundled
 * dummy model, runs one inference, and returns { ok, initMs, inferenceMs }.
 *
 * This route is ONLY for measuring cold INIT_DURATION on a Vercel preview deploy.
 * It is NOT a production endpoint and should be disabled (or left unrouted) in prod.
 *
 * Measurement protocol (Task 4 checkpoint):
 *   1. Wait ≥15 min since last invocation to force cold start.
 *   2. curl {preview}/api/ta/onnx-smoke 5 times.
 *   3. Read Vercel Function logs for INIT_DURATION on the first (cold) call.
 *   4. If INIT_DURATION > 5000ms on ≥3 of 5 cold curls, flag T3 architecture for revisit.
 *
 * Security: runtime="nodejs" is REQUIRED — onnxruntime-node is a native module
 * that cannot run on the edge runtime (T-13-30).
 *
 * outputFileTracingIncludes in next.config.ts bundles public/ta/dummy-model.onnx
 * into the function deployment so the model is accessible via process.cwd().
 */

import path from "node:path";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(): Promise<Response> {
  const t0 = Date.now();

  try {
    // Lazy-load onnxruntime-node — dynamic import measures cold load time.
    const ort = await import("onnxruntime-node");
    const initMs = Date.now() - t0;

    // Resolve model path — process.cwd() is the project root on Vercel.
    const modelPath = path.join(process.cwd(), "public", "ta", "dummy-model.onnx");

    const sessionT0 = Date.now();
    const session = await ort.InferenceSession.create(modelPath);
    const sessionMs = Date.now() - sessionT0;

    // Run a trivial inference: Relu([1.0]) → [1.0]
    const inferenceT0 = Date.now();
    const inputTensor = new ort.Tensor("float32", [1.0], [1]);
    const output = await session.run({ input: inputTensor });
    const inferenceMs = Date.now() - inferenceT0;

    const totalMs = Date.now() - t0;
    const outputValue = (output.output?.data as Float32Array)?.[0] ?? null;

    return NextResponse.json({
      ok: true,
      initMs,
      sessionMs,
      inferenceMs,
      totalMs,
      outputValue,
      inputNames: session.inputNames,
      outputNames: session.outputNames,
    });
  } catch (err) {
    const totalMs = Date.now() - t0;
    console.error("[onnx-smoke] error", err instanceof Error ? err.message : err);
    return NextResponse.json(
      {
        ok: false,
        error: err instanceof Error ? err.message : String(err),
        totalMs,
      },
      { status: 500 },
    );
  }
}
