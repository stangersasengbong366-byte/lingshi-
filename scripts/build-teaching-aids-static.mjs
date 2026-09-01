import { execFileSync } from "node:child_process";
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, extname, join, normalize } from "node:path";
import XLSX from "xlsx";

const workbookPath = process.argv[2];
if (!workbookPath) throw new Error("用法：node scripts/build-teaching-aids-static.mjs <xlsx路径>");
const temp = mkdtempSync(join(tmpdir(), "youdao-aids-"));
const outDir = "public/assets/teaching-aids/26h2";
mkdirSync(outDir, { recursive: true });
execFileSync("unzip", ["-q", workbookPath, "-d", temp]);
const rels = (path) => Object.fromEntries([...readFileSync(path, "utf8").matchAll(/<Relationship\b[^>]*\bId="([^"]+)"[^>]*\bTarget="([^"]+)"[^>]*\/?\s*>/g)].map((m) => [m[1], m[2]]));
function images(sheet) {
  try {
    const sheetRels = rels(join(temp, `xl/worksheets/_rels/sheet${sheet}.xml.rels`));
    const drawing = normalize(join(temp, "xl/worksheets", Object.values(sheetRels).find((item) => item.includes("drawings/drawing"))));
    const drawingRels = rels(join(dirname(drawing), "_rels", `${basename(drawing)}.rels`));
    const xml = readFileSync(drawing, "utf8"), result = new Map();
    for (const [anchor] of xml.matchAll(/<xdr:(?:twoCellAnchor|oneCellAnchor)\b[\s\S]*?<\/xdr:(?:twoCellAnchor|oneCellAnchor)>/g)) {
      const row = Number(anchor.match(/<xdr:row>(\d+)<\/xdr:row>/)?.[1]), col = Number(anchor.match(/<xdr:col>(\d+)<\/xdr:col>/)?.[1]);
      const target = drawingRels[anchor.match(/r:embed="([^"]+)"/)?.[1]];
      if (target) result.set(`${row}:${col}`, normalize(join(dirname(drawing), target)));
    }
    return result;
  } catch { return new Map(); }
}
const wb = XLSX.readFile(workbookPath); const items = [];
for (const [index, subjectSheet] of wb.SheetNames.entries()) {
  if (!/^高中(语文|数学|英语|物理|化学|生物|历史|地理|政治)$/.test(subjectSheet)) continue;
  const rows = XLSX.utils.sheet_to_json(wb.Sheets[subjectSheet], { header: 1, defval: "" });
  const groups = rows[1] ?? [], headers = rows[2] ?? [], pictureMap = images(index + 1);
  for (const start of groups.map((value, i) => (/26H2高[一二三]/.test(String(value)) ? i : -1)).filter((i) => i >= 0)) {
    const grade = String(groups[start]).match(/高[一二三]/)?.[0], end = groups.findIndex((value, i) => i > start && /26H2高[一二三]/.test(String(value)));
    const limit = end < 0 ? headers.length : end;
    const find = (label) => headers.findIndex((value, i) => i >= start && i < limit && value === label);
    const typeCol = find("类型"), nameCol = find("名称"), imageCol = find("封面图");
    for (let row = 3; row < rows.length; row += 1) {
      const type = String(rows[row]?.[typeCol] ?? "").trim(), name = String(rows[row]?.[nameCol] ?? "").trim();
      if (!grade || !type || !name) continue;
      const imagePath = pictureMap.get(`${row}:${imageCol}`); let image = "";
      if (imagePath) { const file = `${grade}-${subjectSheet.slice(2)}-${row + 1}${extname(imagePath).toLowerCase()}`; copyFileSync(imagePath, join(outDir, file)); image = `/assets/teaching-aids/26h2/${file}`; }
      items.push({ grade, period: "26H2", subject: subjectSheet.slice(2), type, name, image, source: `${subjectSheet}!${XLSX.utils.encode_cell({ r: row, c: typeCol })}:${XLSX.utils.encode_cell({ r: row, c: imageCol })}` });
    }
  }
}
writeFileSync("src/data/teachingAidCatalog.js", `// Generated from the 26H2 teaching-aid workbook.\nexport const teachingAids = ${JSON.stringify(items, null, 2)};\n`);
rmSync(temp, { recursive: true, force: true });
console.log(`Generated ${items.length} mappings, ${items.filter((item) => item.image).length} images.`);
