import { describe, expect, it } from "vitest";
import { getHomeCard, offlineDraftHint, onScanFailed } from "../../src/ui/home/viewModel";

describe("home view model", () => {
  it("returns scan card", () => {
    const c = getHomeCard("scan");
    expect(c.primaryAction).toBe("开始扫描");
  });

  it("returns manual card", () => {
    const c = getHomeCard("manual");
    expect(c.primaryAction).toBe("保存图书");
  });

  it("scan fail fallback keeps partial", () => {
    const f = onScanFailed("9787");
    expect(f.keepPartialInput).toBe(true);
    expect(f.canSwitchToManual).toBe(true);
  });

  it("offline hint exists", () => {
    expect(offlineDraftHint()).toContain("暂存");
  });
});
