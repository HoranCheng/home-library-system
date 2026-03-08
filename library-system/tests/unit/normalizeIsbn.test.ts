import { describe, expect, it } from "vitest";
import { normalizeIsbn } from "../../src/domain/normalize";

describe("normalizeIsbn", () => {
  it("normalizes valid isbn13 with separators", () => {
    expect(normalizeIsbn("978-7-121-15535-2")).toEqual({ ok: true, value: "9787121155352" });
  });

  it("normalizes valid isbn10", () => {
    expect(normalizeIsbn("7111128060")).toEqual({ ok: true, value: "7111128060" });
  });

  it("rejects invalid length", () => {
    const result = normalizeIsbn("123");
    expect(result.ok).toBe(false);
  });

  it("rejects checksum mismatch", () => {
    const result = normalizeIsbn("9787121155353");
    expect(result.ok).toBe(false);
  });
});
