import { z } from "zod";

export const extractionResultSchema = z.object({
  numericExtractions: z.array(
    z.object({
      key: z.string().min(1),
      /** Scalar IDR amount (rupiah units, same as ground truth expectations). */
      valueIDR: z.number().finite(),
      sourcePage: z.number().int().positive().optional(),
    }),
  ),
  citedFacts: z.array(
    z.object({
      id: z.string().min(1),
      text: z.string(),
      citedPages: z.array(z.number().int().positive()).min(1),
    }),
  ),
});

export type EvalExtraction = z.infer<typeof extractionResultSchema>;

export const groundTruthFixtureSchema = z.object({
  documentId: z.string().min(1),
  fixtureStatus: z.enum(["placeholder", "ready"]),
  numericExpectations: z.array(
    z.object({
      key: z.string().min(1),
      valueIDR: z.number().finite(),
      tolerancePct: z.number().min(0).max(100),
    }),
  ),
  citationExpectations: z.array(
    z.object({
      id: z.string().min(1),
      allowedPages: z.array(z.number().int().positive()).min(1),
    }),
  ),
});

export type GroundTruthFixture = z.infer<typeof groundTruthFixtureSchema>;

export const manifestSchema = z.object({
  version: z.literal(1),
  documents: z
    .array(
      z.object({
        id: z.string().min(1),
        label: z.string(),
        relativePdf: z.string().min(1),
        relativeGroundTruth: z.string().min(1),
      }),
    )
    .length(9),
});

export type EvalManifest = z.infer<typeof manifestSchema>;
