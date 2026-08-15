import test from "node:test";
import assert from "node:assert/strict";
import { applyVideoPhaseLimits } from "../src/domain/coursePhaseRules.js";

const rows = [
  ...Array.from({ length: 55 }, (_, index) => ({ title: `秋${index + 1}`, quarter: "秋季" })),
  ...Array.from({ length: 20 }, (_, index) => ({ title: `寒${index + 1}`, quarter: "寒假" })),
];

test("秋冬衔接卡严格按秋40+寒20取满60条", () => {
  const selected = applyVideoPhaseLimits({ videoPhaseLimits: { 秋季: 40, 寒假: 20 } }, "数学", rows, 60);
  assert.equal(selected.length, 60);
  assert.equal(selected.filter((row) => row.quarter === "秋季").length, 40);
  assert.equal(selected.filter((row) => row.quarter === "寒假").length, 20);
});

test("高一生物独立体系只取寒假20条", () => {
  const selected = applyVideoPhaseLimits({
    videoPhaseLimits: { 秋季: 40, 寒假: 20 },
    subjectVideoPhaseLimits: { 生物: { 秋季: 0, 寒假: 20 } },
  }, "生物", rows, 20);
  assert.equal(selected.length, 20);
  assert.ok(selected.every((row) => row.quarter === "寒假"));
});
