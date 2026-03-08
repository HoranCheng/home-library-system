import { describe, expect, it } from "vitest";
import { buildManualEntryDraft } from "../../src/services/books/manualEntry";

describe("manual entry draft", () => {
  it("prefills with partial isbn and sets to_be_sorted", () => {
    const draft = buildManualEntryDraft({ isbn: "9787", author: "Foo" });
    expect(draft.isbn13).toBe("9787");
    expect(draft.status).toBe("to_be_sorted");
    expect(draft.authors).toEqual(["Foo"]);
  });
});
