import test from "node:test";
import assert from "node:assert/strict";
import { preserveGiftPoolOnProductDelete } from "../src/domain/giftPool.js";

test("删除产品时把其赠课迁移到保留产品的共享赠课池", () => {
  const result = preserveGiftPoolOnProductDelete([
    { id: "deleted", grade: "高一", giftPoolDeletedItems: [{ grade: "高一", key: "赠课-旧赠课" }] },
    { id: "carrier", grade: "高二" },
  ], "deleted", [
    { type: "赠课", name: "升学规划课", detail: "已配置内容" },
  ]);

  assert.equal(result.carrierId, "carrier");
  assert.equal(result.products.length, 1);
  assert.deepEqual(result.products[0].giftPoolItems, [
    { type: "赠课", name: "升学规划课", detail: "已配置内容", poolGrade: "高一" },
  ]);
  assert.deepEqual(result.products[0].giftPoolDeletedItems, [{ grade: "高一", key: "赠课-旧赠课" }]);
});
