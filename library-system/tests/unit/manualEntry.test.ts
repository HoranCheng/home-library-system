import { describe, expect, it } from "vitest";
import { buildManualEntryDraft } from "../../src/services/books/manualEntry";

describe("manual entry draft", () => {
  it("maps isbn-13 into isbn13 and sets to_be_sorted", () => {
    const draft = buildManualEntryDraft({ isbn: "9787121155352", title: "Foo", author: "Bar" });
    expect(draft.isbn13).toBe("9787121155352");
    expect(draft.isbn10).toBeUndefined();
    expect(draft.status).toBe("to_be_sorted");
    expect(draft.authors).toEqual(["Bar"]);
  });

  it("maps isbn-10 into isbn10", () => {
    const draft = buildManualEntryDraft({ isbn: "7111128060", title: "Foo" });
    expect(draft.isbn10).toBe("7111128060");
    expect(draft.isbn13).toBeUndefined();
  });

  it("rejects empty title", () => {
    expect(() => buildManualEntryDraft({ isbn: "9787" })).toThrow("title is required");
  });
});
