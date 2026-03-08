import { describe, expect, it } from "vitest";
import { getBottomNavItems, getHomeMode, setHomeMode, toggleHomeMode } from "../../src/ui/home/mode";

function memoryStorage() {
  const m = new Map<string, string>();
  return {
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => void m.set(k, v)
  };
}

describe("home mode", () => {
  it("defaults to scan", () => {
    expect(getHomeMode(memoryStorage())).toBe("scan");
  });

  it("persists mode", () => {
    const s = memoryStorage();
    setHomeMode("manual", s);
    expect(getHomeMode(s)).toBe("manual");
  });

  it("toggles", () => {
    expect(toggleHomeMode("scan")).toBe("manual");
  });

  it("has fixed bottom nav", () => {
    expect(getBottomNavItems()).toEqual(["scan", "search", "tidy"]);
  });
});
