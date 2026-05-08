import "server-only";

import { env } from "@/lib/env";

/**
 * Gemini API embedding model (Generative Language `v1beta`).
 * `text-embedding-004` is not available on this endpoint (404) — use `gemini-embedding-001`.
 * @see https://ai.google.dev/api/embeddings
 */
export const EMBEDDING_MODEL_ID = "gemini-embedding-001";
export const EMBEDDING_DIMENSIONS = 768;

/** Per official batch limits; chunk if larger. */
export const EMBED_TEXTS_BATCH_SIZE = 100;

const BATCH_URL = `https://generativelanguage.googleapis.com/v1beta/models/${EMBEDDING_MODEL_ID}:batchEmbedContents`;

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function toVectorString(vec: number[]): string {
  return `[${vec.map((n) => (Number.isFinite(n) ? String(n) : "0")).join(",")}]`;
}

function isRetryableStatus(status: number): boolean {
  return status === 429 || (status >= 500 && status <= 599);
}

async function fetchWithBackoff(
  url: string,
  init: RequestInit,
  attempt = 0,
): Promise<Response> {
  const maxRetries = 4;
  const res = await fetch(url, init);
  if (!isRetryableStatus(res.status) || attempt >= maxRetries) {
    return res;
  }
  const base = 200 * 2 ** attempt;
  const delay = Math.min(10_000, base);
  await sleep(delay);
  return fetchWithBackoff(url, init, attempt + 1);
}

type BatchEmbedApiResponse = {
  embeddings?: Array<{ values?: number[] }>;
};

/**
 * Embed many chunk texts in batches (D4-02: content only — no section prefix).
 * Returns one 768-d vector per input string, same order.
 */
export async function embedTextBatch(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) {
    return [];
  }

  const apiKey = env.GEMINI_API_KEY;
  const out: number[][] = [];

  for (let i = 0; i < texts.length; i += EMBED_TEXTS_BATCH_SIZE) {
    const slice = texts.slice(i, i + EMBED_TEXTS_BATCH_SIZE);
    const url = `${BATCH_URL}?key=${encodeURIComponent(apiKey)}`;
    const body = {
      requests: slice.map((text) => ({
        model: `models/${EMBEDDING_MODEL_ID}`,
        content: { parts: [{ text }] },
        /** Matryoshka / MRL: keep DB `vector(768)` without changing pgvector dims. */
        outputDimensionality: EMBEDDING_DIMENSIONS,
      })),
    };

    const res = await fetchWithBackoff(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      throw new Error(
        `Gemini batchEmbedContents failed: ${res.status} ${errText.slice(0, 500)}`,
      );
    }

    const json = (await res.json()) as BatchEmbedApiResponse;
    const embeddings = json.embeddings;
    if (!embeddings || embeddings.length !== slice.length) {
      throw new Error("Gemini batchEmbedContents returned unexpected embedding count");
    }

    for (const emb of embeddings) {
      const values = emb.values;
      if (!values || values.length !== EMBEDDING_DIMENSIONS) {
        throw new Error(`Gemini embedding must be ${EMBEDDING_DIMENSIONS} dimensions`);
      }
      out.push(values);
    }
  }

  return out;
}

/** Single query embedding for RAG (Phase 4 / Phase 10). */
export async function embedQueryText(text: string): Promise<number[]> {
  const [row] = await embedTextBatch([text]);
  if (!row) {
    throw new Error("embedQueryText: empty response");
  }
  return row;
}

export function vectorToPgString(vec: number[]): string {
  if (vec.length !== EMBEDDING_DIMENSIONS) {
    throw new Error(`Expected ${EMBEDDING_DIMENSIONS}-dim vector`);
  }
  return toVectorString(vec);
}
