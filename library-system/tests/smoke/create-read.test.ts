import { describe, expect, it } from "vitest";
import { createBook } from "../../src/services/books/createBook";
import { getBookById } from "../../src/services/books/getBook";
import { DEFAULT_STATE } from "../../src/store/schema";

describe("create/read smoke", () => {
  it("creates and reads", () => {
    const state = structuredClone(DEFAULT_STATE);
    const result = createBook(state, { title: "Refactoring", authors: ["Martin Fowler"], status: "in_library" });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    state.books.push(result.book);
    expect(getBookById(state, result.book.id)?.title).toBe("Refactoring");
  });
});
