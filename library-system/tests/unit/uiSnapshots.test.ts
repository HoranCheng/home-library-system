import { describe, expect, it } from "vitest";
import { buildHomeUiSnapshot, buildSettingsUiSnapshot, handleManualEntrySubmit, handleScanFailure, getHomeSummary, switchHomeMode } from "../../src/app/ui";
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
    // verify persisted: book appears in loaded state
    const loaded = loadState(s);
    expect(loaded.books).toHaveLength(1);
    expect(loaded.books[0]?.title).toBe("Design Patterns");
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

  it("validateImport returns ok=true for valid exported state", () => {
    const s = mem();
    handleManualEntrySubmit({ title: "The Pragmatic Programmer", author: "Hunt", isbn: "9780135957059" }, s);
    const json = buildSettingsUiSnapshot(s).exportJson();
    const result = buildSettingsUiSnapshot(s).validateImport(json);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.bookCount).toBe(1);
  });
});

describe("handleScanFailure interaction handler", () => {
  it("returns a non-empty message when scan fails without partial isbn", () => {
    const msg = handleScanFailure();
    expect(typeof msg).toBe("string");
    expect(msg.length).toBeGreaterThan(0);
  });

  it("returns a message when scan fails with partial isbn", () => {
    const msg = handleScanFailure("97880");
    expect(typeof msg).toBe("string");
    expect(msg.length).toBeGreaterThan(0);
  });
});

describe("getHomeSummary interaction handler", () => {
  it("returns zero counts for empty library", () => {
    const s = mem();
    const summary = getHomeSummary(s);
    expect(summary.total).toBe(0);
    expect(summary.toBeSorted).toBe(0);
    expect(summary.inLibrary).toBe(0);
  });

  it("counts books after manual entry submission", () => {
    const s = mem();
    handleManualEntrySubmit({ title: "The Mythical Man-Month", author: "Brooks", isbn: "9780201835953" }, s);
    handleManualEntrySubmit({ title: "Code Complete", author: "McConnell", isbn: "9780735619678" }, s);
    const summary = getHomeSummary(s);
    expect(summary.total).toBe(2);
    expect(summary.toBeSorted).toBe(2); // manual entry defaults to to_be_sorted
    expect(summary.inLibrary).toBe(0);
  });
});
