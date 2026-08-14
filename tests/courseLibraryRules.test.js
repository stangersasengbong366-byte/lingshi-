import test from "node:test";
import assert from "node:assert/strict";
import { resolveProductCourseLibrary } from "../src/domain/courseLibraryRules.js";

const bundled = { live: { 数学: [{ id: "live-1" }] }, video: { 数学: [{ id: "video-1" }] } };

test("云端年级课程库缺失时使用随版本发布的权威课程源", () => {
  const result = resolveProductCourseLibrary({ courseSourceMode: "grade" }, undefined, bundled);
  assert.equal(result.annualCourseData, bundled);
  assert.equal(result.parsedCourseData, bundled);
  assert.equal(result.courseUploadNames.live, "学法直播.xlsx");
});

test("云端年级课程库存在时保持云端课程为优先来源", () => {
  const cloud = { data: { live: { 数学: [{ id: "cloud-live" }] }, video: {} }, uploadNames: { live: "云端直播.xlsx" } };
  const result = resolveProductCourseLibrary({ courseSourceMode: "grade" }, cloud, bundled);
  assert.equal(result.parsedCourseData, cloud.data);
  assert.equal(result.courseUploadNames.live, "云端直播.xlsx");
});

test("自定义课程模式继续使用产品自己的课程数据", () => {
  const custom = { live: { 物理: [{ id: "custom-live" }] }, video: {} };
  const result = resolveProductCourseLibrary({ courseSourceMode: "custom", customCourseData: custom }, undefined, bundled);
  assert.equal(result.annualCourseData, bundled);
  assert.equal(result.parsedCourseData, custom);
});

