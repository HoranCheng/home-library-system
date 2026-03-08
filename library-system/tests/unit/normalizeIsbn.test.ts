import { describe, expect, it } from "vitest";
import { normalizeIsbn } from "../../src/domain/normalize";

describe("normalizeIsbn", () => {
  it("normalizes separators", () => {
    expect(normalizeIsbn("978-7-121-15535-2")).toEqual({ ok: true, value: "9787121155352" });
  });

  it("rejects invalid length", () => {
    const result = normalizeIsbn("123");
    expect(result.ok).toBe(false);
  });
});
