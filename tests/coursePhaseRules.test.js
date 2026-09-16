import test from "node:test";
import assert from "node:assert/strict";
import { applyLivePhaseLimits, applyVideoPhaseLimits, getAdminCoursePhaseOptions } from "../src/domain/coursePhaseRules.js";

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

test("学法直播按产品各阶段课时上限映射", () => {
  const liveRows = [
    ...Array.from({ length: 16 }, (_, index) => ({ title: `秋${index + 1}`, quarter: "秋季" })),
    ...Array.from({ length: 13 }, (_, index) => ({ title: `寒${index + 1}`, quarter: "寒假" })),
    ...Array.from({ length: 16 }, (_, index) => ({ title: `春${index + 1}`, quarter: "春季" })),
  ];
  const selected = applyLivePhaseLimits({ livePhaseLimits: { 秋季: 16, 寒假: 10, 春季: 16 } }, liveRows, 42);
  assert.equal(selected.length, 42);
  assert.equal(selected.filter((row) => row.quarter === "寒假").length, 10);
  assert.deepEqual(selected.map((row) => row.no), Array.from({ length: 42 }, (_, index) => index + 1));
});

test("所有产品学法直播筛选后统一从1连续编号并保留底表原始课次", () => {
  const selected = applyLivePhaseLimits({}, [
    { no: 13, title: "第一节" },
    { no: 18, title: "第二节" },
    { no: 29, title: "第三节" },
  ], 3);
  assert.deepEqual(selected.map((row) => row.no), [1, 2, 3]);
  assert.deepEqual(selected.map((row) => row.sourceNo), [13, 18, 29]);
});

test("高三直播按暑期12、寒假10、春季8取课，不按总数截断春季内容", () => {
  const liveRows = [
    ...Array.from({ length: 12 }, (_, index) => ({ title: `暑${index + 1}`, quarter: "暑期" })),
    ...Array.from({ length: 13 }, (_, index) => ({ title: `寒${index + 1}`, quarter: "寒假" })),
    ...Array.from({ length: 8 }, (_, index) => ({ title: `春${index + 1}`, quarter: "春季" })),
  ];
  const selected = applyLivePhaseLimits({ livePhaseLimits: { 暑期: 12, 寒假: 10, 春季: 8 } }, liveRows, 30);
  assert.equal(selected.length, 30);
  assert.equal(selected.filter((row) => row.quarter === "寒假").length, 10);
  assert.equal(selected.filter((row) => row.quarter === "春季").length, 8);
});

test("高三名校直通卡取一轮 mini 12节加完整二轮18节并重新编号", () => {
  const liveRows = Array.from({ length: 49 }, (_, index) => ({
    no: index + 1,
    title: `原始第${index + 1}节`,
  }));
  const selected = applyLivePhaseLimits({
    liveCourseMode: "g3-mini-plus-second-round",
    liveCourseSegments: { mini: 12, secondRound: 18 },
  }, liveRows, 30);
  assert.equal(selected.length, 30);
  assert.equal(selected[0].title, "原始第20节");
  assert.equal(selected[0].no, 1);
  assert.equal(selected[0].sourceNo, 20);
  assert.equal(selected[11].courseSegment, "一轮 mini");
  assert.equal(selected[12].courseSegment, "二轮");
  assert.equal(selected[29].no, 30);
  assert.equal(selected[29].title, "原始第49节");
});

test("高三名校直通卡按秋16寒10春8精确截取34节", () => {
  const liveRows = [
    ...Array.from({ length: 16 }, (_, index) => ({ no: index + 1, quarter: "秋季", title: `秋${index + 1}` })),
    ...Array.from({ length: 13 }, (_, index) => ({ no: index + 17, quarter: "寒假", title: `寒${index + 1}` })),
    ...Array.from({ length: 8 }, (_, index) => ({ no: index + 30, quarter: "春季", title: `春${index + 1}` })),
  ];
  const selected = applyLivePhaseLimits({
    liveCourseMode: "g3-mini-plus-second-round",
    liveCourseSegments: { mini: 16, secondRound: 18 },
    livePhaseLimits: { 秋季: 16, 寒假: 10, 春季: 8 },
  }, liveRows, 34);
  assert.equal(selected.length, 34);
  assert.equal(selected.filter((row) => row.quarter === "寒假").length, 10);
  assert.equal(selected.filter((row) => row.quarter === "春季").length, 8);
  assert.equal(selected[0].no, 1);
  assert.equal(selected[33].no, 34);
});

test("高三后台分别按季节筛选直播、按轮次筛选知识视频", () => {
  assert.deepEqual(getAdminCoursePhaseOptions("高三"), {
    split: true,
    live: ["暑期", "秋季", "寒假", "春季"],
    video: ["一轮", "二轮"],
  });
});

test("高一高二继续使用统一季度筛选", () => {
  assert.deepEqual(getAdminCoursePhaseOptions("高二"), {
    split: false,
    live: ["暑期", "秋季", "寒假", "春季"],
    video: ["暑期", "秋季", "寒假", "春季"],
  });
});
