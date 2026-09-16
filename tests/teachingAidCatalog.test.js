import test from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { teachingAids } from "../src/data/teachingAidCatalog.js";

test("教辅目录中的图片引用均随静态站点发布", () => {
  const missing = teachingAids
    .filter((item) => item.image)
    .filter((item) => !existsSync(`public${item.image}`))
    .map((item) => `${item.grade}-${item.subject}-${item.name}`);
  assert.deepEqual(missing, []);
});

test("高一生物的合并单元格拆成独立资料并正确归类", () => {
  const biology = teachingAids.filter((item) => item.grade === "高一" && item.subject === "生物");
  assert.deepEqual(
    biology.map(({ type, name }) => ({ type, name })),
    [
      { type: "视频讲义", name: "高一生物精讲精练（下）" },
      { type: "配套习题", name: "高一生物精讲精练（下）·配套习题" },
      { type: "学法课讲义", name: "高一生物学业规划与方法指导·暑期（上）" },
      { type: "学法课讲义", name: "高一生物学业规划与方法指导·秋季（上）" },
    ],
  );
});
