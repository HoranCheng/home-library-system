/**
 * T-015: 移动端 home/manual/settings 流程边界测试
 * 覆盖 P0（全部）+ P1-4、P1-6
 */
import { describe, expect, it } from "vitest";
import { getHomeMode, toggleHomeMode } from "../../src/ui/home/mode";
import { resolveRoute } from "../../src/ui/home/router";
import { handleScanFailure } from "../../src/ui/home/page";
import { buildManualEntryDraft } from "../../src/services/books/manualEntry";
import { validateImportJson, exportCsv } from "../../src/services/data/backup";
import { buildHomeUiSnapshot, buildSettingsUiSnapshot, switchHomeMode } from "../../src/app/ui";
import { importState, getLibrarySummary } from "../../src/app/state";

function mem() {
  const m = new Map<string, string>();
  return {
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => void m.set(k, v)
  };
}

// ─── P0 ────────────────────────────────────────────────────────────────────

describe("P0-1: getHomeMode storage=undefined 安全降级", () => {
  it("返回默认 scan，不抛出异常", () => {
    // 不传 storage，globalThis.localStorage 在 Node 环境不存在
    expect(() => getHomeMode(undefined)).not.toThrow();
    expect(getHomeMode(undefined)).toBe("scan");
  });
});

describe("P0-2: toggleHomeMode 往返幂等", () => {
  it("scan → manual → scan 两次 toggle 回到原值", () => {
    const first = toggleHomeMode("scan");
    expect(first).toBe("manual");
    const second = toggleHomeMode(first);
    expect(second).toBe("scan");
  });
});

describe("P0-3: handleScanFailure 无 ISBN 参数不崩溃", () => {
  it("返回非空提示字符串", () => {
    const msg = handleScanFailure();
    expect(typeof msg).toBe("string");
    expect(msg.length).toBeGreaterThan(0);
  });

  it("返回内容包含可识别的操作提示", () => {
    const msg = handleScanFailure();
    expect(msg).toMatch(/没识别到|重试|条码/);
  });
});

describe("P0-4: validateImportJson 损坏 JSON 返回 ok:false", () => {
  it("传入非 JSON 字符串", () => {
    const result = validateImportJson("not json");
    expect(result.ok).toBe(false);
    expect(result.errors.some(e => e.startsWith("Invalid JSON"))).toBe(true);
  });

  it("传入空字符串", () => {
    const result = validateImportJson("");
    expect(result.ok).toBe(false);
  });

  it("传入缺少 books 字段的 JSON", () => {
    const result = validateImportJson(JSON.stringify({ meta: { schemaVersion: 1, updatedAt: "2024-01-01" } }));
    expect(result.ok).toBe(false);
  });
});

describe("P0-5: importState 成功后 getLibrarySummary 计数正确", () => {
  it("导入 2 本书后 total === 2", () => {
    const s = mem();
    const payload = JSON.stringify({
      books: [
        { id: "b1", title: "Book One", authors: ["A"], status: "in_library", createdAt: "2024-01-01", updatedAt: "2024-01-01" },
        { id: "b2", title: "Book Two", authors: ["B"], status: "to_be_sorted", createdAt: "2024-01-01", updatedAt: "2024-01-01" }
      ],
      meta: { schemaVersion: 1, updatedAt: "2024-01-01" }
    });
    const result = importState(payload, s);
    expect(result.ok).toBe(true);
    const summary = getLibrarySummary(s);
    expect(summary.total).toBe(2);
    expect(summary.inLibrary).toBe(1);
    expect(summary.toBeSorted).toBe(1);
  });
});

describe("P0-6: buildHomeUiSnapshot manual 模式 card title 正确", () => {
  it("写入 manual 后 snapshot 返回手动录入标题", () => {
    const s = mem();
    switchHomeMode("manual", s);
    const snapshot = buildHomeUiSnapshot(s);
    expect(snapshot.mode).toBe("manual");
    expect(snapshot.card.title).toBe("手动录入");
  });
});

// ─── P1（节选）───────────────────────────────────────────────────────────────

describe("P1-1: resolveRoute 未知路由回退到 scan", () => {
  it("传入空字符串回退 scan", () => {
    expect(resolveRoute("")).toBe("scan");
  });

  it("传入随机字符串回退 scan", () => {
    expect(resolveRoute("foobar")).toBe("scan");
  });

  it("search 路由正常解析", () => {
    expect(resolveRoute("search")).toBe("search");
  });
});

describe("P1-4: switchHomeMode 写入后 buildHomeUiSnapshot 即时反映", () => {
  it("切换为 scan 后 snapshot.mode === scan", () => {
    const s = mem();
    switchHomeMode("scan", s);
    expect(buildHomeUiSnapshot(s).mode).toBe("scan");
  });

  it("切换为 manual 后 snapshot.mode === manual", () => {
    const s = mem();
    switchHomeMode("manual", s);
    expect(buildHomeUiSnapshot(s).mode).toBe("manual");
  });
});

describe("P1-6: buildSettingsUiSnapshot 无 storage 时不崩溃", () => {
  it("exportJson() 返回合法 JSON", () => {
    const settings = buildSettingsUiSnapshot(mem());
    const json = settings.exportJson();
    expect(() => JSON.parse(json)).not.toThrow();
  });

  it("exportCsv title 含逗号时正确转义", () => {
    const s = mem();
    const payload = JSON.stringify({
      books: [
        { id: "b1", title: "React, In Depth", authors: ["A"], status: "in_library", createdAt: "2024-01-01", updatedAt: "2024-01-01" }
      ],
      meta: { schemaVersion: 1, updatedAt: "2024-01-01" }
    });
    importState(payload, s);
    const settings = buildSettingsUiSnapshot(s);
    const csv = settings.exportCsv();
    // title 含逗号必须双引号包裹
    expect(csv).toMatch(/"React, In Depth"/);
  });
});
