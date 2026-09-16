export const standardCoursePhaseCounts = {
  高一: {
    live: { 暑期: 10, 秋季: 16, 寒假: 10, 春季: 16 },
    video: { 暑期: 0, 秋季: 40, 寒假: 20, 春季: 40 },
  },
  高二: {
    live: { 暑期: 10, 秋季: 16, 寒假: 10, 春季: 16 },
    video: { 暑期: 0, 秋季: 40, 寒假: 20, 春季: 40 },
  },
  高三: {
    live: { 秋季: 16, 寒假: 10, 春季: 8 },
    video: { 一轮: 60, 二轮: 60 },
  },
};

export function getExpectedCoursePhaseCount(grade, type, phase) {
  const value = standardCoursePhaseCounts[grade]?.[type]?.[phase];
  return Number.isFinite(value) ? value : null;
}

export function getExpectedProductPhaseCount(product, type, subject, phase) {
  if (type === "video") {
    const subjectValue = product?.subjectVideoPhaseLimits?.[subject]?.[phase];
    if (Number.isFinite(Number(subjectValue))) return Number(subjectValue);
  }
  return getExpectedCoursePhaseCount(product?.grade, type, phase);
}

export function getCourseCountIssues({ grade, product, subject, type, phases, rows = [] }) {
  return phases.flatMap((phase) => {
    const expected = product
      ? getExpectedProductPhaseCount(product, type, subject, phase)
      : getExpectedCoursePhaseCount(grade, type, phase);
    if (expected === null) return [];
    const actual = rows.filter((row) => row?.quarter === phase).length;
    if (actual === expected) return [];
    return [{
      grade: product?.grade ?? grade,
      ...(subject ? { subject } : {}),
      type,
      phase,
      expected,
      actual,
      difference: actual - expected,
    }];
  });
}

export function getCanonicalProductCourseRules(product) {
  const gradeRules = standardCoursePhaseCounts[product?.grade];
  if (!gradeRules) return product;
  const coveragePhases = product.coveragePhases ?? [];
  const livePhases = product.grade !== "高三" && coveragePhases.includes("秋季")
    ? ["暑期", ...coveragePhases]
    : (product.livePhases?.length ? product.livePhases : coveragePhases);
  const videoPhases = product.videoPhases?.length
    ? product.videoPhases
    : product.coveragePhases ?? [];
  const livePhaseLimits = Object.fromEntries(livePhases
    .map((phase) => [phase, gradeRules.live[phase]])
    .filter(([, count]) => Number.isFinite(count)));
  const videoPhaseLimits = Object.fromEntries(videoPhases
    .map((phase) => [phase, gradeRules.video[phase]])
    .filter(([, count]) => Number.isFinite(count)));
  const isG3Direct = product.grade === "高三" && /名校直通/.test(`${product.name ?? ""}${product.stage ?? ""}`);
  const nextLivePhases = isG3Direct ? ["秋季", "寒假", "春季"] : livePhases;
  const nextLiveLimits = isG3Direct ? { 秋季: 16, 寒假: 10, 春季: 8 } : livePhaseLimits;
  const liveLessons = Object.values(nextLiveLimits).reduce((sum, count) => sum + count, 0);
  const knowledgeVideos = Object.values(videoPhaseLimits).reduce((sum, count) => sum + count, 0);

  return {
    ...product,
    livePhases: nextLivePhases,
    livePhaseLimits: nextLiveLimits,
    videoPhaseLimits,
    core: {
      ...(product.core ?? {}),
      ...(liveLessons ? { liveLessons } : {}),
      ...(knowledgeVideos || videoPhases.includes("暑期") ? { knowledgeVideos } : {}),
    },
    ...(isG3Direct ? {
      liveCourseMode: "g3-mini-plus-second-round",
      liveCourseSegments: { mini: 16, secondRound: 18 },
    } : {}),
  };
}
