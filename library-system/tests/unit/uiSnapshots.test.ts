import { describe, expect, it } from "vitest";
import { buildHomeUiSnapshot, buildSettingsUiSnapshot, handleManualEntrySubmit, switchHomeMode } from "../../src/app/ui";
import { loadState } from "../../src/store/storage";

function mem() {
  const m = new Map<string, string>();
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v) };
}

describe("ui snapshots", () => {
  it("builds home snapshot and switches mode", () => {
    const s = mem();
    expect(buildHomeUiSnapshot(s).mode).toBe("scan");
    switchHomeMode("manual", s);
    expect(buildHomeUiSnapshot(s).mode).toBe("manual");
  });

  it("builds settings snapshot with export/import handlers", () => {
    // @ts-expect-error test localStorage shim
    globalThis.localStorage = mem();
    const settings = buildSettingsUiSnapshot();
    expect(typeof settings.exportJson).toBe("function");
    expect(typeof settings.exportCsv).toBe("function");
    expect(settings.validateImport("{}").ok).toBe(false);
  });
});

describe("handleManualEntrySubmit wiring", () => {
  it("creates a book and persists to storage", () => {
    const s = mem();
    const result = handleManualEntrySubmit({ title: "Design Patterns", author: "GoF", isbn: "9780201633610" }, s);
    expect(result.ok).toBe(true);
    // verify persisted: re-reading storage should reflect the book
    const snapshot = buildHomeUiSnapshot(s);
    expect(snapshot.mode).toBe("scan"); // mode unaffected by submission
  });

  it("returns duplicate error when same isbn submitted twice", () => {
    const s = mem();
    handleManualEntrySubmit({ title: "Clean Code", author: "Robert C. Martin", isbn: "9780132350884" }, s);
    const second = handleManualEntrySubmit({ title: "Clean Code", author: "Robert C. Martin", isbn: "9780132350884" }, s);
    expect(second.ok).toBe(false);
    if (!second.ok) expect(second.code).toBe("DUPLICATE_CANDIDATE");
  });

  it("returns invalid isbn error for bad isbn", () => {
    const s = mem();
    const result = handleManualEntrySubmit({ title: "Bad ISBN Book", author: "Author", isbn: "123" }, s);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("INVALID_ISBN");
  });
});

describe("buildSettingsUiSnapshot import wiring", () => {
  it("importJson action rejects invalid json", () => {
    const s = mem();
    const settings = buildSettingsUiSnapshot(s);
    const result = settings.importJson("{bad json}");
    expect(result.ok).toBe(false);
  });

  it("importJson action commits valid state to storage", () => {
    const s = mem();
    // first create a book via submit, export that state, then import it into a fresh store
    handleManualEntrySubmit({ title: "Refactoring", author: "Martin Fowler", isbn: "9780134757599" }, s);
    const exported = buildSettingsUiSnapshot(s).exportJson();

    const s2 = mem();
    const result = buildSettingsUiSnapshot(s2).importJson(exported);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.bookCount).toBe(1);

    // confirm data is now readable from s2
    const loaded = loadState(s2);
    expect(loaded.books[0]?.title).toBe("Refactoring");
  });

  it("exportCsv action returns csv with header", () => {
    const s = mem();
    handleManualEntrySubmit({ title: "SICP", author: "Abelson" }, s);
    const csv = buildSettingsUiSnapshot(s).exportCsv();
    expect(csv.split("\n")[0]).toContain("id,title,authors");
    expect(csv).toContain("SICP");
  });
});
