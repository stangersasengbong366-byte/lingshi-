import test from "node:test";
import assert from "node:assert/strict";
import { parseCourseWorkbookSheets } from "../src/lib/courseWorkbookParser.js";

function workbook(sheetNames, sheets) {
  return { SheetNames: sheetNames, Sheets: sheets, sheetToRows: (sheet) => sheet };
}

test("知识视频固定模板按（夏/秋/冬/春）字段映射阶段", () => {
  const rows = [
    ["模块", "视频大纲", "是否分层", "（1星/2星/3星/4星）", "（夏/秋/冬/春）"],
    ["函数", "函数基础", "目标", "2星", "秋季"],
    ["函数", "函数进阶", "菁英", "3星", "冬"],
  ];
  const parsed = parseCourseWorkbookSheets(workbook(["高一数学"], { 高一数学: rows }), "video", "高一", ["数学"]);
  assert.deepEqual(parsed.数学.map((row) => [row.title, row.quarter, row.layered, row.difficulty]), [
    ["函数基础", "秋季", "目标班", 2],
    ["函数进阶", "寒假", "精英班", 3],
  ]);
});

test("学法直播固定模板缺少表头时按标准列序解析", () => {
  const rows = [
    ["高一", "", "2026/6/27", "14:00-15:00", "", "", "", "", "", "", "学习指南"],
    ["", "秋季", "2026/9/1", "18:00-20:00", "", "", "", "", "", "", "秋季第一讲"],
    ["", "寒假", "2027/1/20", "18:00-20:00", "", "", "", "", "", "", "寒假第一讲"],
  ];
  const parsed = parseCourseWorkbookSheets(workbook(["生物"], { 生物: rows }), "live", "高一", ["生物"]);
  assert.deepEqual(parsed.生物.map((row) => [row.title, row.quarter]), [
    ["秋季第一讲", "秋季"],
    ["寒假第一讲", "寒假"],
  ]);
});
