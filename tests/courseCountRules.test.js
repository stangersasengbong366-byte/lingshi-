import test from "node:test";
import assert from "node:assert/strict";
import {
  getCanonicalProductCourseRules,
  getCourseCountIssues,
  getExpectedCoursePhaseCount,
  getExpectedProductPhaseCount,
} from "../src/domain/courseCountRules.js";

test("高一高二正课阶段数量使用统一标准", () => {
  assert.equal(getExpectedCoursePhaseCount("高一", "live", "暑期"), 10);
  assert.equal(getExpectedCoursePhaseCount("高二", "live", "秋季"), 26);
  assert.equal(getExpectedCoursePhaseCount("高一", "video", "暑期"), 0);
  assert.equal(getExpectedCoursePhaseCount("高二", "video", "春季"), 40);
});

test("产品科目专项视频规则优先于年级通用标准", () => {
  const product = {
    grade: "高一",
    subjectVideoPhaseLimits: { 生物: { 秋季: 0, 寒假: 20 } },
  };
  assert.equal(getExpectedProductPhaseCount(product, "video", "生物", "秋季"), 0);
  assert.equal(getExpectedProductPhaseCount(product, "video", "生物", "寒假"), 20);
});

test("后台能准确报告课程阶段数量不足或超出", () => {
  const rows = [
    ...Array.from({ length: 16 }, () => ({ quarter: "秋季" })),
    ...Array.from({ length: 13 }, () => ({ quarter: "寒假" })),
  ];
  assert.deepEqual(getCourseCountIssues({
    grade: "高一",
    type: "live",
    phases: ["秋季", "寒假"],
    rows,
  }), [
    { grade: "高一", type: "live", phase: "秋季", expected: 26, actual: 16, difference: -10 },
    { grade: "高一", type: "live", phase: "寒假", expected: 10, actual: 13, difference: 3 },
  ]);
});

test("高三名校直通卡固定为一轮16节加二轮18节", () => {
  const product = getCanonicalProductCourseRules({
    grade: "高三",
    name: "高三名校直通卡",
    coveragePhases: ["一轮", "二轮"],
    videoPhases: ["一轮", "二轮"],
    core: {},
  });
  assert.deepEqual(product.livePhases, ["秋季", "寒假", "春季"]);
  assert.deepEqual(product.livePhaseLimits, { 秋季: 16, 寒假: 10, 春季: 8 });
  assert.deepEqual(product.liveCourseSegments, { mini: 16, secondRound: 18 });
  assert.equal(product.core.liveLessons, 34);
  assert.equal(product.core.knowledgeVideos, 120);
});
