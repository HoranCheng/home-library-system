import { describe, expect, it } from "vitest";
import { createBook } from "../../src/services/books/createBook";
import { DEFAULT_STATE } from "../../src/store/schema";

describe("saveBookIdempotent", () => {
  it("prevents duplicate by isbn", () => {
    const state = structuredClone(DEFAULT_STATE);
    const first = createBook(state, { title: "TDD", authors: ["Kent Beck"], isbn13: "9780321146533", status: "in_library" });
    expect(first.ok).toBe(true);
    if (first.ok) state.books.push(first.book);

    const second = createBook(state, { title: "TDD", authors: ["Kent Beck"], isbn13: "9780321146533", status: "in_library" });
    expect(second.ok).toBe(false);
  });
});
