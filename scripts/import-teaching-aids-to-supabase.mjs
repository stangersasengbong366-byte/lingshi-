import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, extname, join, normalize } from "node:path";
import process from "node:process";
import XLSX from "xlsx";

const workbookPath = process.argv[2];
const dryRun = process.argv.includes("--dry-run");
if (!workbookPath) throw new Error("用法：node scripts/import-teaching-aids-to-supabase.mjs <xlsx路径>");

function readEnvFile(path) {
  try {
    return Object.fromEntries(readFileSync(path, "utf8").split(/\r?\n/).map((line) => {
      const index = line.indexOf("=");
      return index > 0 ? [line.slice(0, index).trim(), line.slice(index + 1).trim()] : [];
    }).filter((entry) => entry.length === 2));
  } catch {
    return {};
  }
}

const env = { ...readEnvFile(".env"), ...process.env };
const supabaseUrl = env.VITE_SUPABASE_URL;
const supabaseKey = env.VITE_SUPABASE_ANON_KEY;
if (!supabaseUrl || !supabaseKey) throw new Error("缺少 VITE_SUPABASE_URL 或 VITE_SUPABASE_ANON_KEY");

const tempDir = mkdtempSync(join(tmpdir(), "youdao-teaching-aids-"));
execFileSync("unzip", ["-q", workbookPath, "-d", tempDir]);

function relationships(path) {
  const xml = readFileSync(path, "utf8");
  return Object.fromEntries([...xml.matchAll(/<Relationship\b[^>]*\bId="([^"]+)"[^>]*\bTarget="([^"]+)"[^>]*\/?\s*>/g)]
    .map((match) => [match[1], match[2]]));
}

function drawingImages(sheetNumber) {
  const sheetRelPath = join(tempDir, `xl/worksheets/_rels/sheet${sheetNumber}.xml.rels`);
  let sheetRels;
  try { sheetRels = relationships(sheetRelPath); } catch { return new Map(); }
  const drawingTarget = Object.values(sheetRels).find((target) => target.includes("drawings/drawing"));
  if (!drawingTarget) return new Map();
  const drawingPath = normalize(join(tempDir, "xl/worksheets", drawingTarget));
  const drawingRelPath = join(dirname(drawingPath), "_rels", `${basename(drawingPath)}.rels`);
  const drawingRels = relationships(drawingRelPath);
  const xml = readFileSync(drawingPath, "utf8");
  const anchors = [...xml.matchAll(/<xdr:(?:twoCellAnchor|oneCellAnchor)\b[\s\S]*?<\/xdr:(?:twoCellAnchor|oneCellAnchor)>/g)];
  const result = new Map();
  anchors.forEach(([anchor]) => {
    const col = Number(anchor.match(/<xdr:col>(\d+)<\/xdr:col>/)?.[1]);
    const row = Number(anchor.match(/<xdr:row>(\d+)<\/xdr:row>/)?.[1]);
    const relId = anchor.match(/r:embed="([^"]+)"/)?.[1];
    const target = drawingRels[relId];
    if (!Number.isFinite(col) || !Number.isFinite(row) || !target) return;
    result.set(`${row}:${col}`, normalize(join(dirname(drawingPath), target)));
  });
  return result;
}

function imageDataUrl(path) {
  if (!path) return "";
  const extension = extname(path).toLowerCase();
  const mime = extension === ".png" ? "image/png" : extension === ".webp" ? "image/webp" : "image/jpeg";
  return `data:${mime};base64,${readFileSync(path).toString("base64")}`;
}

const workbook = XLSX.readFile(workbookPath, { cellStyles: false });
const currentSheets = workbook.SheetNames
  .map((name, index) => ({ name, sheetNumber: index + 1 }))
  .filter(({ name }) => /^高中(语文|数学|英语|物理|化学|生物|历史|地理|政治)$/.test(name));
const items = [];

for (const { name, sheetNumber } of currentSheets) {
  const rows = XLSX.utils.sheet_to_json(workbook.Sheets[name], { header: 1, defval: "" });
  const groupRow = rows[1] ?? [];
  const headerRow = rows[2] ?? [];
  const images = drawingImages(sheetNumber);
  const starts = groupRow.map((value, index) => (/26H2高[一二三]/.test(String(value)) ? index : -1)).filter((index) => index >= 0);
  for (const start of starts) {
    const grade = String(groupRow[start]).match(/高[一二三]/)?.[0];
    const nextStart = starts.find((value) => value > start) ?? headerRow.length;
    const typeCol = headerRow.findIndex((value, index) => index >= start && index < nextStart && value === "类型");
    const nameCol = headerRow.findIndex((value, index) => index >= start && index < nextStart && value === "名称");
    const imageCol = headerRow.findIndex((value, index) => index >= start && index < nextStart && value === "封面图");
    if (!grade || typeCol < 0 || nameCol < 0 || imageCol < 0) continue;
    for (let rowIndex = 3; rowIndex < rows.length; rowIndex += 1) {
      const type = String(rows[rowIndex]?.[typeCol] ?? "").trim();
      const itemName = String(rows[rowIndex]?.[nameCol] ?? "").trim();
      if (!type || !itemName) continue;
      const imagePath = images.get(`${rowIndex}:${imageCol}`);
      items.push({
        grade,
        period: "26H2",
        subject: name.replace(/^高中/, ""),
        type,
        name: itemName,
        image: imageDataUrl(imagePath),
        source: `${name}!${XLSX.utils.encode_cell({ r: rowIndex, c: typeCol })}:${XLSX.utils.encode_cell({ r: rowIndex, c: imageCol })}`,
      });
    }
  }
}

if (dryRun) {
  const summary = items.reduce((result, item) => {
    const key = `${item.grade}-${item.subject}`;
    result[key] = (result[key] ?? 0) + 1;
    return result;
  }, {});
  console.log(JSON.stringify({ total: items.length, withImage: items.filter((item) => item.image).length, summary }, null, 2));
  rmSync(tempDir, { recursive: true, force: true });
  process.exit(0);
}

for (let index = 0; index < items.length; index += 1) {
  const item = items[index];
  const id = `teaching_aid_${item.grade}_26H2_${item.subject}_${String(index + 1).padStart(3, "0")}`;
  const response = await fetch(`${supabaseUrl}/rest/v1/benefit_configs?on_conflict=id`, {
    method: "POST",
    headers: {
      apikey: supabaseKey,
      Authorization: `Bearer ${supabaseKey}`,
      "Content-Type": "application/json",
      Prefer: "resolution=merge-duplicates",
    },
    body: JSON.stringify({ id, payload: item, updated_at: new Date().toISOString() }),
  });
  if (!response.ok) throw new Error(`上传失败 ${id}: ${await response.text()}`);
  process.stdout.write(`\r已上传 ${index + 1}/${items.length}`);
}

rmSync(tempDir, { recursive: true, force: true });
console.log(`\n完成：${items.length} 条 26H2 教辅资料（含云端图片数据）`);
