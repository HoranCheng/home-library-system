import { describe, expect, it } from "vitest";
import { getHomeMode, setHomeMode } from "../../src/ui/home/mode";
import { getHomeCard, onScanFailed } from "../../src/ui/home/viewModel";

function mem() {
  const m = new Map<string, string>();
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v) };
}

describe("home flow smoke", () => {
  it("scan -> fail -> manual fallback flow", () => {
    const s = mem();
    setHomeMode("scan", s);
    expect(getHomeMode(s)).toBe("scan");
    const scan = getHomeCard("scan");
    expect(scan.primaryAction).toBe("开始扫描");
    const fallback = onScanFailed("978");
    expect(fallback.canSwitchToManual).toBe(true);
    setHomeMode("manual", s);
    expect(getHomeMode(s)).toBe("manual");
  });
});
