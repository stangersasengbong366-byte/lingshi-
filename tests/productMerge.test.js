import test from "node:test";
import assert from "node:assert/strict";
import { mergeCloudProductChanges } from "../src/domain/productMerge.js";

test("保存一个产品时保留云端其他产品的最新下线状态", () => {
  const cloud = [
    { id: "edited", name: "旧名称", status: "在售" },
    { id: "offline", name: "一轮全程班", status: "暂停" },
  ];
  const staleBrowser = [
    { id: "edited", name: "新名称", status: "在售" },
    { id: "offline", name: "一轮全程班", status: "在售" },
  ];
  assert.deepEqual(
    mergeCloudProductChanges(cloud, staleBrowser, { upsertIds: ["edited"] }),
    [
      { id: "edited", name: "新名称", status: "在售" },
      { id: "offline", name: "一轮全程班", status: "暂停" },
    ],
  );
});

test("同年级产品在旧标签页中仍为在售，也不会随本次产品修改被覆盖", () => {
  const cloud = [
    { id: "g3-round", grade: "高三", status: "在售", core: { liveLessons: 26 } },
    { id: "g3-full", grade: "高三", status: "暂停", core: { liveLessons: 26 } },
  ];
  const staleBrowser = [
    { id: "g3-round", grade: "高三", status: "在售", core: { liveLessons: 30 } },
    { id: "g3-full", grade: "高三", status: "在售", core: { liveLessons: 26 } },
  ];
  const merged = mergeCloudProductChanges(cloud, staleBrowser, { upsertIds: ["g3-round"] });
  assert.equal(merged.find((product) => product.id === "g3-round").core.liveLessons, 30);
  assert.equal(merged.find((product) => product.id === "g3-full").status, "暂停");
});

test("新增和删除只影响明确指定的产品", () => {
  const cloud = [{ id: "keep", status: "暂停" }, { id: "remove", status: "在售" }];
  const next = [{ id: "keep", status: "在售" }, { id: "new", status: "待上线" }];
  assert.deepEqual(
    mergeCloudProductChanges(cloud, next, { upsertIds: ["new"], deleteIds: ["remove"] }),
    [{ id: "keep", status: "暂停" }, { id: "new", status: "待上线" }],
  );
});
