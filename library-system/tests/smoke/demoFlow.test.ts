import { describe, expect, it, beforeEach } from "vitest";
import { runDemoFlow } from "../../src/app/demo";

class MemStorage {
  private m = new Map<string, string>();
  getItem(k: string) { return this.m.get(k) ?? null; }
  setItem(k: string, v: string) { this.m.set(k, v); }
}

describe("demo flow", () => {
  beforeEach(() => {
    // @ts-expect-error
    globalThis.localStorage = new MemStorage();

  });

  it("runs end-to-end demo", () => {
    const out = runDemoFlow();
    expect(out.createdOk).toBe(true);
    expect(out.summary.total).toBe(1);
    expect(out.fallback).toContain("没识别到条码");
  });
});
