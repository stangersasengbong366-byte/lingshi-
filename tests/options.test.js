import test from "node:test";
import assert from "node:assert/strict";
import { orderGradeOptions } from "../src/config/options.js";

test("年级始终按高一、高二、高三排序，不受云端产品数组顺序影响", () => {
  assert.deepEqual(orderGradeOptions(["高二", "高三", "高一", "高二"]), ["高一", "高二", "高三"]);
});

test("缺少某年级时保持剩余年级的业务顺序", () => {
  assert.deepEqual(orderGradeOptions(["高三", "高一"]), ["高一", "高三"]);
});

