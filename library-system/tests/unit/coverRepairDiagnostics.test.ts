import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const html = readFileSync(resolve(__dirname, "../../preview/index.html"), "utf8");

describe("manual cover repair diagnostics", () => {
  it("includes explicit isbn and title/author recovery logs in the preview UI flow", () => {
    expect(html).toContain("ISBN 无效或缺失");
    expect(html).toContain("ISBN 查询没有返回可用封面");
    expect(html).toContain("ISBN 失败 → 尝试书名/作者补图");
    expect(html).toContain("fallback-success");
    expect(html).toContain("书名/作者补图成功 → ${meta.source || 'Open Library'}");
    expect(html).toContain("书名/作者补图分数不足");
    expect(html).toContain("未触发书名/作者兜底");
    expect(html).toContain("命中过滤占位图");
    expect(html).toContain("保留原封面：现有评分");
    expect(html).toContain("候选与现有封面相同");
  });

  it("requests diagnostics from the repair candidate lookup before logging skips", () => {
    expect(html).toContain("includeDiagnostics: true");
    expect(html).toContain("const diagnostics = Array.isArray(scan?.diagnostics)");
  });

  it("gates title search fallback behind isbn failure and missing dirty covers", () => {
    expect(html).toContain("const canRunTitleFallback = !book?.coverUrl || currentDirty;");
    expect(html).toContain("if (!bestUrl) {");
    expect(html).toContain("_pushCoverDiag(diagnostics, 'isbn-fallback-started');");
    expect(html).toContain("const minScore = wantedAuthor ? 45 : 40;");
  });
});
