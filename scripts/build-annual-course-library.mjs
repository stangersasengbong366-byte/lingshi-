import fs from "node:fs";
import path from "node:path";
import XLSX from "xlsx";
import { parseCourseWorkbookSheets } from "../src/lib/courseWorkbookParser.js";

const [livePath, videoPath] = process.argv.slice(2);
if (!livePath || !videoPath) {
  throw new Error("请提供学法直播全年总表和知识视频全年总表路径");
}

const grades = ["高一", "高二", "高三"];
const subjects = ["语文", "数学", "英语", "物理", "化学", "生物", "历史", "地理", "政治"];

function loadWorkbook(filePath) {
  const workbook = XLSX.readFile(filePath, { cellDates: false });
  return {
    SheetNames: workbook.SheetNames,
    Sheets: workbook.Sheets,
    sheetToRows: (sheet) => XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "", raw: true }),
  };
}

const liveWorkbook = loadWorkbook(livePath);
const videoWorkbook = loadWorkbook(videoPath);
const library = Object.fromEntries(grades.map((grade) => [grade, {
  live: parseCourseWorkbookSheets(liveWorkbook, "live", grade, subjects),
  video: parseCourseWorkbookSheets(videoWorkbook, "video", grade, subjects),
}]));

const output = `export const annualCourseLibraryVersion = "2026-2027-v3";\n\nexport const annualCourseLibrary = ${JSON.stringify(library, null, 2)};\n`;
const outputPath = path.resolve("src/data/annualCourseLibrary.js");
fs.writeFileSync(outputPath, output);

for (const grade of grades) {
  const liveCounts = Object.fromEntries(subjects.map((subject) => [subject, library[grade].live[subject].length]));
  const videoCounts = Object.fromEntries(subjects.map((subject) => [subject, library[grade].video[subject].length]));
  console.log(grade, { liveCounts, videoCounts });
}
