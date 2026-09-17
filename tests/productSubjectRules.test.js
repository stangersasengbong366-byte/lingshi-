import test from "node:test";
import assert from "node:assert/strict";
import { getSaleableSubjects, getVideoAvailabilityOverride } from "../src/domain/productSubjectRules.js";
import { publishedProductSnapshot } from "../src/data/publishedProductSnapshot.js";

const allSubjects = ["语文", "数学", "英语", "物理", "化学", "生物", "历史", "地理", "政治"];

test("高一半年卡全科可售，但生史地政无知识视频", () => {
  const product = { grade: "高一", stage: "决胜卡", name: "新高一全体系决胜卡" };
  assert.deepEqual(getSaleableSubjects(product, ["语文", "数学"], allSubjects), allSubjects);
  for (const subject of ["生物", "历史", "地理", "政治"]) {
    assert.deepEqual(getVideoAvailabilityOverride(product, subject), { hasVideo: false, isLayered: false });
  }
  assert.equal(getVideoAvailabilityOverride(product, "数学"), null);
});

test("高一秋实卡不售卖生史地政", () => {
  const product = { grade: "高一", stage: "秋实卡", name: "新高一秋实卡" };
  assert.deepEqual(getSaleableSubjects(product, allSubjects), ["语文", "数学", "英语", "物理", "化学"]);
});

test("高二半年卡全科可售，高二秋实卡不售卖文综", () => {
  assert.deepEqual(getSaleableSubjects({ grade: "高二", stage: "决胜卡" }, ["数学"], allSubjects), allSubjects);
  assert.deepEqual(
    getSaleableSubjects({ grade: "高二", stage: "秋实卡" }, allSubjects),
    ["语文", "数学", "英语", "物理", "化学", "生物"],
  );
});

test("高三一轮卡全科可售且没有视频禁用覆盖", () => {
  const product = { grade: "高三", stage: "一轮卡" };
  assert.deepEqual(getSaleableSubjects(product, ["语文", "数学"], allSubjects), allSubjects);
  for (const subject of allSubjects) assert.equal(getVideoAvailabilityOverride(product, subject), null);
});

test("高三文综使用自身的一轮二轮视频规则，不继承高一生物规则", () => {
  const product = publishedProductSnapshot.find((item) => item.grade === "高三");
  assert.ok(product);
  assert.equal(product.subjectVideoPhases?.生物, undefined);
  assert.equal(product.subjectVideoPhaseLimits?.生物, undefined);
  assert.deepEqual(product.subjectVideoPhaseLimits?.历史, { 一轮: 30, 二轮: 30 });
  assert.equal(product.subjectProfiles?.humanities?.knowledgeVideos, 60);
});

test("高一高二全体系直通卡全科可售", () => {
  for (const grade of ["高一", "高二"]) {
    const product = { grade, stage: "全体系直通卡", name: `${grade}全体系直通卡` };
    assert.deepEqual(getSaleableSubjects(product, ["数学"], allSubjects), allSubjects);
  }
});

test("秋冬衔接卡仅售非文综，高一生物保留且仅走独立视频体系", () => {
  const highOne = { grade: "高一", stage: "秋冬衔接卡", name: "高一秋冬衔接卡" };
  const highTwo = { grade: "高二", stage: "秋冬衔接卡", name: "高二秋冬衔接卡" };
  const expected = ["语文", "数学", "英语", "物理", "化学", "生物"];
  assert.deepEqual(getSaleableSubjects(highOne, allSubjects), expected);
  assert.deepEqual(getSaleableSubjects(highTwo, allSubjects), expected);
  assert.deepEqual(getVideoAvailabilityOverride(highOne, "生物"), { hasVideo: true, isLayered: false });
  assert.equal(getVideoAvailabilityOverride(highTwo, "生物"), null);
});
