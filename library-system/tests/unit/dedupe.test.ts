import { describe, expect, it } from "vitest";
import { dedupeByFingerprint, dedupeByIsbn } from "../../src/domain/dedupe";
import type { Book } from "../../src/domain/book";

const b: Book = {
  id: "1",
  title: "Clean Code",
  authors: ["Robert C. Martin"],
  isbn13: "9780132350884",
  status: "in_library",
  createdAt: new Date(0).toISOString(),
  updatedAt: new Date(0).toISOString()
};

describe("dedupe", () => {
  it("matches strong isbn", () => {
    expect(dedupeByIsbn([b], "9780132350884")).toHaveLength(1);
  });

  it("matches soft fingerprint", () => {
    expect(dedupeByFingerprint([b], "Clean Code", "Robert C. Martin")).toHaveLength(1);
  });
});
