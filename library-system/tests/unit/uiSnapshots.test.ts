import { describe, expect, it } from "vitest";
import { buildHomeUiSnapshot, buildSettingsUiSnapshot, switchHomeMode } from "../../src/app/ui";

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
