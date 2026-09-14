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

test("班型拆分工作表合并为通用加目标班或菁英班", () => {
  const header = ["模块", "视频大纲", "是否分层", "（1星/2星/3星/4星）", "（夏/秋/冬/春）"];
  const targetRows = [
    header,
    ["函数", "函数通用", "通用", "2星", "秋季"],
    ["函数", "目标函数", "目标+菁英2个班型不同", "3星", "秋季"],
  ];
  const eliteRows = [
    header,
    ["函数", "函数通用", "通用", "2星", "秋季"],
    ["函数", "菁英函数", "目标+菁英2个班型不同", "4星", "秋季"],
  ];
  const parsed = parseCourseWorkbookSheets(workbook(
    ["高一数学-目标", "高一数学-菁英"],
    { "高一数学-目标": targetRows, "高一数学-菁英": eliteRows },
  ), "video", "高一", ["数学"]);
  assert.deepEqual(parsed.数学.map((row) => [row.title, row.layered]), [
    ["函数通用", "通用"],
    ["目标函数", "目标班"],
    ["菁英函数", "精英班"],
  ]);
});

test("高三直播保留底表原始阶段供一轮 mini 和二轮组合", () => {
  const rows = [
    ["年级", "季度", "早鸟期-上课日期", "早鸟期-上课时间", "一期-上课日期", "一期-上课时间", "二期-上课日期", "二期-上课时间", "三期-上课日期", "三期-上课时间", "课程大纲"],
    ["高三", "暑期", "", "", "", "", "", "", "", "", "一轮 mini"],
    ["", "秋季", "", "", "", "", "", "", "", "", "一轮正课"],
    ["", "寒假", "", "", "", "", "", "", "", "", "二轮寒假"],
  ];
  const parsed = parseCourseWorkbookSheets(workbook(["语文"], { 语文: rows }), "live", "高三", ["语文"]);
  assert.deepEqual(parsed.语文.map((row) => row.quarter), ["暑期", "秋季", "寒假"]);
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
