import test from "node:test";
import assert from "node:assert/strict";
import { collectPoolDeletedKeys, preserveGiftPoolOnProductDelete } from "../src/domain/giftPool.js";

test("删除产品时把赠课和实物迁移到对应共享资源池", () => {
  const result = preserveGiftPoolOnProductDelete([
    { id: "deleted", grade: "高一", giftPoolDeletedItems: [{ grade: "高一", key: "赠课-旧赠课" }] },
    { id: "carrier", grade: "高二" },
  ], "deleted", [
    { type: "赠课", name: "升学规划课", detail: "已配置内容" },
  ], [
    { type: "实物赠礼", name: "学习礼包", detail: "已配置实物" },
  ]);

  assert.equal(result.carrierId, "carrier");
  assert.equal(result.products.length, 1);
  assert.deepEqual(result.products[0].giftPoolItems, [
    { type: "赠课", name: "升学规划课", detail: "已配置内容", poolGrade: "高一" },
  ]);
  assert.deepEqual(result.products[0].giftPoolDeletedItems, [{ grade: "高一", key: "赠课-旧赠课" }]);
  assert.deepEqual(result.products[0].physicalGiftPoolItems, [
    { type: "实物赠礼", name: "学习礼包", detail: "已配置实物", poolGrade: "高一" },
  ]);
});

test("尚未保存的实物删除记录立即参与资源池过滤", () => {
  const keys = collectPoolDeletedKeys([
    { id: "cloud-copy", grade: "高一", physicalGiftPoolDeletedItems: [] },
  ], {
    id: "editing-draft",
    grade: "高一",
    physicalGiftPoolDeletedItems: [{ grade: "高一", key: "实物赠礼-学习礼包" }],
  }, "physicalGiftPoolDeletedItems");
  assert.deepEqual([...keys], ["实物赠礼-学习礼包"]);
});
