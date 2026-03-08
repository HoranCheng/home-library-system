import { describe, expect, it } from "vitest";
import { getHomePageState, handleScanFailure, switchMode } from "../../src/ui/home/page";

function mem() {
  const m = new Map<string, string>();
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v) };
}

describe("home page", () => {
  it("builds state from mode", () => {
    const s = mem();
    const state = getHomePageState(s);
    expect(state.mode).toBe("scan");
    expect(state.primaryAction).toBe("开始扫描");
  });

  it("switches mode and persists", () => {
    const s = mem();
    const next = switchMode("scan", s);
    expect(next).toBe("manual");
    expect(getHomePageState(s).mode).toBe("manual");
  });

  it("returns scan failure message", () => {
    expect(handleScanFailure("978")).toContain("没识别到条码");
  });
});
