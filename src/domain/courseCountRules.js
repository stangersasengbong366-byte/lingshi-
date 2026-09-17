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
  const isBridgeCard = /秋冬衔接/.test(`${product.name ?? ""}${product.stage ?? ""}`);
  const isFullSystemCard = /全体系直通/.test(`${product.name ?? ""}${product.stage ?? ""}`);
  const isG3Direct = product.grade === "高三" && /名校直通/.test(`${product.name ?? ""}${product.stage ?? ""}`);
  // 产品的直播阶段不等于全年课表包含的全部阶段：
  // 秋冬衔接只取秋16+寒10，全体系取秋16+寒10+春16；
  // 高三名校直通为一轮 mini 12 + 二轮 18。
  const presetLiveRules = isBridgeCard
    ? { phases: ["秋季", "寒假"], limits: { 秋季: 16, 寒假: 10 }, lessons: 26 }
    : isFullSystemCard
      ? { phases: ["秋季", "寒假", "春季"], limits: { 秋季: 16, 寒假: 10, 春季: 16 }, lessons: 42 }
      : isG3Direct
        ? { phases: ["秋季", "寒假", "春季"], limits: { 秋季: 12, 寒假: 10, 春季: 8 }, lessons: 30 }
        : null;
  const livePhases = presetLiveRules?.phases
    ?? (product.livePhases?.length ? product.livePhases : coveragePhases);
  const videoPhases = product.videoPhases?.length
    ? product.videoPhases
    : product.coveragePhases ?? [];
  const livePhaseLimits = Object.fromEntries(livePhases
    .map((phase) => [phase, gradeRules.live[phase]])
    .filter(([, count]) => Number.isFinite(count)));
  const videoPhaseLimits = Object.fromEntries(videoPhases
    .map((phase) => [phase, gradeRules.video[phase]])
    .filter(([, count]) => Number.isFinite(count)));
  const nextLivePhases = presetLiveRules?.phases ?? livePhases;
  const nextLiveLimits = presetLiveRules?.limits ?? livePhaseLimits;
  const liveLessons = presetLiveRules?.lessons
    ?? (Number.isFinite(Number(product.core?.liveLessons)) && Number(product.core.liveLessons) > 0
      ? Number(product.core.liveLessons)
      : Object.values(nextLiveLimits).reduce((sum, count) => sum + count, 0));
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
      liveCourseSegments: { mini: 12, secondRound: 18 },
    } : {}),
  };
}
