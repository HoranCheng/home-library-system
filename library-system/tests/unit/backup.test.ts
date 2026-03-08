import { describe, expect, it } from "vitest";
import { exportCsv, exportJson, validateImportJson } from "../../src/services/data/backup";
import { DEFAULT_STATE } from "../../src/store/schema";

describe("backup/export", () => {
  it("exports valid json", () => {
    const json = exportJson(DEFAULT_STATE);
    expect(validateImportJson(json).ok).toBe(true);
  });

  it("exports csv header", () => {
    const csv = exportCsv(DEFAULT_STATE);
    expect(csv.split("\n")[0]).toContain("id,title,authors");
  });

  it("rejects invalid json", () => {
    const r = validateImportJson("{bad}");
    expect(r.ok).toBe(false);
  });
});
