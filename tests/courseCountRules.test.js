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
  assert.equal(getExpectedCoursePhaseCount("高二", "live", "秋季"), 16);
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
  assert.equal(getExpectedProductPhaseCount(product, "video", "生物", "春季"), 0);
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
    { grade: "高一", type: "live", phase: "寒假", expected: 10, actual: 13, difference: 3 },
  ]);
});

test("秋冬衔接卡直播只取秋16节和寒10节", () => {
  const product = getCanonicalProductCourseRules({
    grade: "高一",
    name: "高一秋冬衔接卡",
    coveragePhases: ["秋季", "寒假"],
    videoPhases: ["秋季", "寒假"],
    core: {},
  });
  assert.deepEqual(product.livePhases, ["秋季", "寒假"]);
  assert.deepEqual(product.livePhaseLimits, { 秋季: 16, 寒假: 10 });
  assert.equal(product.core.liveLessons, 26);
  assert.equal(product.core.knowledgeVideos, 60);
});

test("全体系直通卡会修正旧云端的默认学科权益", () => {
  const product = getCanonicalProductCourseRules({
    grade: "高二",
    name: "高二全体系直通卡",
    coveragePhases: ["秋季", "寒假"],
    videoPhases: ["秋季", "寒假"],
    core: { liveLessons: 16, knowledgeVideos: 80 },
    subjectProfiles: {
      default: { liveLessons: 16, knowledgeVideos: 80 },
      bySubject: {
        数学: { liveLessons: 16, knowledgeVideos: 80 },
        生物: { liveLessons: 42, knowledgeVideos: 50 },
      },
    },
  });
  assert.deepEqual(product.videoPhases, ["秋季", "寒假", "春季"]);
  assert.equal(product.core.liveLessons, 42);
  assert.equal(product.core.knowledgeVideos, 100);
  assert.equal(product.subjectProfiles.default.liveLessons, 42);
  assert.equal(product.subjectProfiles.default.knowledgeVideos, 100);
  assert.equal(product.subjectProfiles.bySubject.数学.liveLessons, 42);
  assert.equal(product.subjectProfiles.bySubject.数学.knowledgeVideos, 100);
  assert.deepEqual(product.subjectProfiles.bySubject.生物, { liveLessons: 42, knowledgeVideos: 50 });
});

test("高三名校直通卡固定为一轮 mini 12节加二轮18节", () => {
  const product = getCanonicalProductCourseRules({
    grade: "高三",
    name: "高三名校直通卡",
    coveragePhases: ["一轮", "二轮"],
    videoPhases: ["一轮", "二轮"],
    core: {},
  });
  assert.deepEqual(product.livePhases, ["秋季", "寒假", "春季"]);
  assert.deepEqual(product.livePhaseLimits, { 秋季: 12, 寒假: 10, 春季: 8 });
  assert.deepEqual(product.liveCourseSegments, { mini: 12, secondRound: 18 });
  assert.deepEqual(product.livePhaseOffsets, { 秋季: 4 });
  assert.equal(product.core.liveLessons, 30);
  assert.equal(product.core.knowledgeVideos, 120);
});
