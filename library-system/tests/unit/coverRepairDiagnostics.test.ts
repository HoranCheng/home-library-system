import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const html = readFileSync(resolve(__dirname, "../../preview/index.html"), "utf8");

describe("manual cover repair diagnostics", () => {
  it("includes specific skip reasons in the preview UI flow", () => {
    expect(html).toContain("ISBN 无效或缺失");
    expect(html).toContain("ISBN 查询未返回可用封面");
    expect(html).toContain("未触发书名/作者兜底");
    expect(html).toContain("书名/作者候选分数过低");
    expect(html).toContain("命中过滤占位图");
    expect(html).toContain("保留原封面：现有评分");
    expect(html).toContain("候选与现有封面相同");
  });

  it("requests diagnostics from the repair candidate lookup before logging skips", () => {
    expect(html).toContain("includeDiagnostics: true");
    expect(html).toContain("const diagnostics = Array.isArray(scan?.diagnostics)");
  });
});
