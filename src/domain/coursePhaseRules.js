const seasonalPhases = ["暑期", "秋季", "寒假", "春季"];
const roundPhases = ["一轮", "二轮"];

function renumberLiveRows(rows) {
  return rows.map((row, index) => ({
    ...row,
    sourceNo: row.sourceNo ?? row.no,
    no: index + 1,
  }));
}

export function getAdminCoursePhaseOptions(grade) {
  if (grade === "高三") {
    return {
      split: true,
      live: seasonalPhases,
      video: roundPhases,
    };
  }
  return {
    split: false,
    live: seasonalPhases,
    video: seasonalPhases,
  };
}

export function applyVideoPhaseLimits(product, subject, rows, entitlement) {
  const limits = product.subjectVideoPhaseLimits?.[subject] ?? product.videoPhaseLimits;
  if (!limits || !Object.keys(limits).length) return rows.slice(0, entitlement || undefined);
  const used = {};
  const selected = rows.filter((row) => {
    const limit = Number(limits[row.quarter]);
    if (!Number.isFinite(limit)) return true;
    used[row.quarter] = used[row.quarter] ?? 0;
    if (used[row.quarter] >= limit) return false;
    used[row.quarter] += 1;
    return true;
  });
  return selected.slice(0, entitlement || undefined);
}

export function applyLivePhaseLimits(product, rows, entitlement) {
  if (product.liveCourseMode === "g3-mini-plus-second-round") {
    const miniCount = Number(product.liveCourseSegments?.mini ?? 12);
    const secondRoundCount = Number(product.liveCourseSegments?.secondRound ?? 18);
    const total = miniCount + secondRoundCount;
    const phaseLimits = product.livePhaseLimits ?? {};
    const used = {};
    const phaseSelected = rows.filter((row) => {
      const limit = Number(phaseLimits[row.quarter]);
      if (!Number.isFinite(limit)) return false;
      used[row.quarter] = used[row.quarter] ?? 0;
      if (used[row.quarter] >= limit) return false;
      used[row.quarter] += 1;
      return true;
    });
    const selected = phaseSelected.length === total ? phaseSelected : rows.slice(-total);
    return renumberLiveRows(selected).map((row, index) => ({
      ...row,
      courseSegment: index < miniCount ? "一轮 mini" : "二轮",
    }));
  }
  const limits = product.livePhaseLimits;
  if (!limits || !Object.keys(limits).length) {
    return renumberLiveRows(rows.slice(0, entitlement || undefined));
  }
  const used = {};
  const selected = rows.filter((row) => {
    const limit = Number(limits[row.quarter]);
    if (!Number.isFinite(limit)) return true;
    used[row.quarter] = used[row.quarter] ?? 0;
    if (used[row.quarter] >= limit) return false;
    used[row.quarter] += 1;
    return true;
  });
  return renumberLiveRows(selected.slice(0, entitlement || undefined));
}
