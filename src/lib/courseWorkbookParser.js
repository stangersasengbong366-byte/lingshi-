const gradePattern = /高[一二三]/;

export function parseCourseWorkbookSheets(workbook, type, grade, subjects) {
  return Object.fromEntries(subjects.map((subject) => {
    const sheetName = type === "live"
      ? findLiveSheetName(workbook.SheetNames, subject)
      : findVideoSheetName(workbook.SheetNames, grade, subject);
    const sheet = sheetName ? workbook.Sheets[sheetName] : null;
    if (!sheet) return [subject, []];
    const rows = workbook.sheetToRows(sheet);
    const parsed = type === "live"
      ? parseLiveRows(rows, grade)
      : parseVideoRows(rows);
    return [subject, parsed];
  }));
}

export function findLiveSheetName(sheetNames, subject) {
  return sheetNames.find((name) => name === `${subject}-大纲`)
    ?? sheetNames.find((name) => name === subject)
    ?? sheetNames.find((name) => name.includes(subject) && name.includes("大纲") && !name.includes("强基"));
}

export function findVideoSheetName(sheetNames, grade, subject) {
  const exactCandidates = [
    `${subject}-${grade}`,
    `${grade}${subject}`,
    `${grade}-${subject}`,
    `${subject}${grade}`,
    subject,
  ];
  return exactCandidates.find((candidate) => sheetNames.includes(candidate))
    ?? sheetNames.find((name) => name.includes(grade) && name.includes(subject) && !name.includes("强基"));
}

export function parseLiveRows(rows, requestedGrade) {
  const headerRowIndex = rows.findIndex((row) => row.some((cell) => clean(cell) === "年级") && row.some((cell) => clean(cell) === "课程大纲标题"));
  if (headerRowIndex < 0) return parseSimpleLiveRows(rows, requestedGrade);

  const header = rows[headerRowIndex];
  const index = createHeaderIndex(header);
  const gradeIndex = findHeaderIndex(header, ["年级"]);
  const stageIndex = findHeaderIndex(header, ["季度", "季节"], 2);
  const lessonIndex = findHeaderIndex(header, ["课次"], 4);
  const titleIndex = findHeaderIndex(header, ["课程大纲标题", "课程大纲"], 15);
  const dateColumns = header.map((cell, idx) => clean(cell) === "上课日期" ? idx : -1).filter((idx) => idx >= 0);
  const timeColumns = header.map((cell, idx) => clean(cell) === "上课时间" ? idx : -1).filter((idx) => idx >= 0);
  let currentGrade = "";
  let currentPhase = "";
  let currentCard = "";

  return rows.slice(headerRowIndex + 2).map((row, offset) => {
    const gradeCell = clean(row[gradeIndex]);
    const gradeMatch = gradeCell.match(gradePattern)?.[0];
    if (gradeMatch) currentGrade = gradeMatch;
    const cardCell = clean(row[index["学习卡类型"]]);
    if (cardCell) currentCard = cardCell;
    const phaseCell = normalizeCoursePhase(row[stageIndex]);
    if (phaseCell) currentPhase = phaseCell;
    const lessonNo = parseLessonNumber(row[lessonIndex]);
    const title = clean(row[titleIndex]);
    if (currentGrade !== requestedGrade || !title || lessonNo < 1 || !currentPhase) return null;
    const schedules = dateColumns.map((dateColumn, scheduleIndex) => formatSchedule(row[dateColumn], row[timeColumns[scheduleIndex]])).filter(Boolean);
    return {
      id: `annual-live-${requestedGrade}-${offset + 1}`,
      no: lessonNo,
      annualNo: lessonNo,
      grade: currentGrade,
      quarter: currentPhase,
      cardType: currentCard,
      date: formatDate(row[dateColumns[0]]),
      time: clean(row[timeColumns[0]]),
      early: schedules[0] ?? "",
      phase1: schedules[1] ?? "",
      phase2: schedules[2] ?? "",
      phase3: schedules[3] ?? "",
      title,
      live: title,
    };
  }).filter(Boolean);
}

export function parseVideoRows(rows) {
  const detailHeaderIndex = rows.findIndex((row) => row.some((cell) => clean(cell).startsWith("视频名称")));
  if (detailHeaderIndex < 0) return parseSimpleVideoRows(rows);
  const detailHeader = rows[detailHeaderIndex];
  const groupHeader = rows[Math.max(0, detailHeaderIndex - 1)] ?? [];
  const titleIndexes = detailHeader
    .map((cell, index) => clean(cell).startsWith("视频名称") ? index : -1)
    .filter((index) => index >= 0);
  const quarterIndex = findHeaderIndex(groupHeader, ["所属季度"], findHeaderIndex(detailHeader, ["所属季度"]));
  const difficultyIndex = findHeaderIndex(groupHeader, ["难度星级标注"], findHeaderIndex(detailHeader, ["难度星级", "星级难度", "（1星/2星/3星/4星）"]));
  const combinedTrackIndex = findHeaderIndex(detailHeader, ["整合后", "课程层级", "班型"]);
  const layeredIndex = findHeaderIndex(detailHeader, ["是否分层"]);

  return rows.slice(detailHeaderIndex + 1).flatMap((row, offset) => {
    const titles = titleIndexes.map((index) => ({ index, title: clean(row[index]), header: clean(detailHeader[index]) })).filter((item) => item.title);
    if (!titles.length) return [];
    const trackValue = clean(row[combinedTrackIndex]) || clean(row[layeredIndex]);
    const isSplitRow = /是/.test(clean(row[layeredIndex])) && titles.length > 1;
    const selectedTitles = isSplitRow ? titles : [titles[0]];
    return selectedTitles.map((item, titleIndex) => ({
      id: `annual-video-${offset + 1}-${titleIndex + 1}`,
      title: stripOutlineCode(item.title),
      outlineCode: getOutlineCode(item.title),
      difficulty: normalizeDifficulty(row[difficultyIndex]),
      layered: isSplitRow ? normalizeCourseTrack(item.header) : normalizeCourseTrack(trackValue),
      quarter: normalizeCoursePhase(row[quarterIndex]),
    }));
  }).filter((row) => row?.title && row.quarter);
}

export function normalizeCoursePhase(value) {
  const text = clean(value);
  if (!text || /^（.*）$/.test(text)) return "";
  if (/二轮/.test(text)) return "二轮";
  if (/一轮/.test(text)) return "一轮";
  if (/暑.*秋|夏.*秋/.test(text)) return "暑秋";
  if (/寒.*春|冬.*春/.test(text)) return "寒春";
  if (/暑|夏/.test(text)) return "暑期";
  if (/秋/.test(text)) return "秋季";
  if (/寒|冬/.test(text)) return "寒假";
  if (/春/.test(text)) return "春季";
  return "";
}

function parseSimpleLiveRows(rows, requestedGrade) {
  const [header = [], ...body] = rows;
  const index = createHeaderIndex(header);
  let currentGrade = "";
  let currentQuarter = "";
  return body.map((row, rowIndex) => {
    const gradeCell = clean(row[index["年级"]]);
    if (gradeCell) {
      currentGrade = gradeCell.match(gradePattern)?.[0] ?? gradeCell;
      currentQuarter = "";
    }
    const rowQuarter = normalizeCoursePhase(row[index["季度"]] || row[index["季节"]]);
    if (rowQuarter) currentQuarter = rowQuarter;
    const title = clean(row[index["课程大纲"]] || row[index["课程大纲标题"]]);
    if (currentGrade !== requestedGrade || !currentQuarter || !title) return null;
    const quarter = requestedGrade === "高三" && ["暑期", "秋季"].includes(currentQuarter)
      ? "一轮"
      : currentQuarter;
    const scheduleColumns = [
      ["早鸟期-上课日期", "早鸟期-上课时间"],
      ["一期-上课日期", "一期-上课时间"],
      ["二期-上课日期", "二期-上课时间"],
      ["三期-上课日期", "三期-上课时间"],
    ];
    const schedules = scheduleColumns.map(([dateKey, timeKey]) => formatSchedule(row[index[dateKey]], row[index[timeKey]]));
    return {
      id: `uploaded-live-${rowIndex + 1}`,
      no: parseLessonNumber(row[index["课次"]]),
      grade: currentGrade || requestedGrade,
      quarter,
      date: formatDate(row[index["早鸟期-上课日期"]] || row[index["日期"]]),
      time: clean(row[index["早鸟期-上课时间"]] || row[index["上课时间"]]),
      early: schedules[0],
      phase1: schedules[1],
      phase2: schedules[2],
      phase3: schedules[3],
      title,
      live: title,
    };
  }).filter(Boolean).map((row, index) => ({ ...row, no: index + 1, annualNo: index + 1 }));
}

function parseSimpleVideoRows(rows) {
  const [header = [], ...body] = rows;
  const index = createHeaderIndex(header);
  return body.map((row, rowIndex) => {
    const rawTitle = clean(row[index["视频大纲"]] || row[index["视频名称"]]);
    return {
      id: `uploaded-video-${rowIndex + 1}`,
      title: stripOutlineCode(rawTitle),
      outlineCode: getOutlineCode(rawTitle),
      difficulty: normalizeDifficulty(row[index["难度星级"]] || row[index["星级难度"]]),
      layered: normalizeCourseTrack(row[index["整合后"]] || row[index["是否分层"]]),
      quarter: normalizeCoursePhase(row[index["所属季度"]]),
    };
  }).filter((row) => row.title && row.quarter && !/赠课/.test(clean(row[index["所属季度"]])));
}

function createHeaderIndex(header) {
  return header.reduce((map, value, idx) => {
    const key = clean(value);
    if (key) map[key] = idx;
    return map;
  }, {});
}

function findHeaderIndex(header, labels, fallback = -1) {
  const index = header.findIndex((cell) => labels.includes(clean(cell)));
  return index >= 0 ? index : fallback;
}

function parseLessonNumber(value) {
  const text = clean(value);
  return /^\d+$/.test(text) ? Number(text) : 0;
}

function normalizeDifficulty(value) {
  const matched = clean(value).match(/\d+/)?.[0];
  return matched ? Number(matched) : 1;
}

function normalizeCourseTrack(value) {
  const text = clean(value);
  if (/目标/.test(text)) return "目标班";
  if (/菁英|精英/.test(text)) return "精英班";
  return "通用";
}

function getOutlineCode(title) {
  return clean(title).match(/^\d+(?:\.\w+)+/)?.[0] ?? "";
}

function stripOutlineCode(title) {
  return clean(title).replace(/^\d+(?:\.\w+)+\s*/, "").trim();
}

function formatSchedule(date, time) {
  return [formatDate(date), clean(time)].filter(Boolean).join(" ");
}

function formatDate(value) {
  if (!value) return "";
  if (typeof value === "number") {
    const date = new Date(Date.UTC(1899, 11, 30) + Math.round(value * 86400000));
    return `${date.getUTCMonth() + 1}月${date.getUTCDate()}日`;
  }
  if (value instanceof Date) {
    const parts = new Intl.DateTimeFormat("zh-CN", {
      timeZone: "Asia/Shanghai",
      month: "numeric",
      day: "numeric",
    }).formatToParts(value);
    const month = parts.find((part) => part.type === "month")?.value;
    const day = parts.find((part) => part.type === "day")?.value;
    return month && day ? `${month}月${day}日` : clean(value);
  }
  return clean(value);
}

function clean(value) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}
