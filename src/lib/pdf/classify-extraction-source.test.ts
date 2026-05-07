import { describe, expect, it } from "vitest";
import { classifyExtractionSource } from "./classify-extraction-source";

describe("classifyExtractionSource", () => {
  it("returns unpdf when fewer than 3 weak pages in first 5", () => {
    const five = Array.from({ length: 5 }, () => "a".repeat(60));
    expect(classifyExtractionSource(five)).toBe("unpdf");
  });

  it("returns gemini_files when all first 5 pages are empty", () => {
    const five = Array.from({ length: 5 }, () => "");
    expect(classifyExtractionSource(five)).toBe("gemini_files");
  });

  it("returns unpdf when only 2 of 5 are weak", () => {
    expect(classifyExtractionSource(["", "", "a".repeat(60), "b".repeat(60), "c".repeat(60)])).toBe(
      "unpdf",
    );
  });

  it("returns gemini_files when 3 of 5 are weak", () => {
    expect(classifyExtractionSource(["", "", "", "a".repeat(60), "b".repeat(60)])).toBe(
      "gemini_files",
    );
  });

  it("counts printable length without whitespace", () => {
    expect(classifyExtractionSource(["   ", "\n\t", "a".repeat(60)])).toBe("unpdf");
  });
});
