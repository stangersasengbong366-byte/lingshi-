import test from "node:test";
import assert from "node:assert/strict";
import { annualCourseLibrary } from "../src/data/annualCourseLibrary.js";
import { filterVideoRowsByTrack, normalizeVideoTrack } from "../src/domain/videoTrackRules.js";

test("高三一轮数学严格按通用加所选班型映射", () => {
  const rows = annualCourseLibrary.高三.video.数学.filter((row) => row.quarter === "一轮");
  const rawCounts = rows.reduce((counts, row) => {
    const track = normalizeVideoTrack(row.layered);
    counts[track] = (counts[track] ?? 0) + 1;
    return counts;
  }, {});

  assert.deepEqual(rawCounts, { 目标班: 25, 通用: 35, 菁英班: 25 });
  assert.equal(filterVideoRowsByTrack(rows, "目标班").length, 60);
  assert.equal(filterVideoRowsByTrack(rows, "菁英班").length, 60);
  assert.ok(filterVideoRowsByTrack(rows, "目标班").every((row) => normalizeVideoTrack(row.layered) !== "菁英班"));
  assert.ok(filterVideoRowsByTrack(rows, "菁英班").every((row) => normalizeVideoTrack(row.layered) !== "目标班"));
});
