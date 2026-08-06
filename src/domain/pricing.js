const defaultHumanitiesSubjects = ["历史", "地理", "政治"];

export function getProductPricing(product, subjectsOrCount) {
  const isGradeOne = String(product.grade ?? "").includes("高一");
  const configuredHumanitiesSubjects = (product.humanitiesSubjects ?? [])
    .filter((subject) => subject !== "生物" || isGradeOne);
  const humanitiesSubjects = new Set([
    ...defaultHumanitiesSubjects,
    ...(isGradeOne ? ["生物"] : []),
    ...configuredHumanitiesSubjects,
  ]);
  const selectedSubjects = Array.isArray(subjectsOrCount) ? subjectsOrCount : [];
  const subjectCount = selectedSubjects.length || Number(subjectsOrCount) || 1;
  const source = product.pricing ?? {};
  const originalPerSubject = Number(source.originalPerSubject) || 5400;
  const singlePerSubject = Number(source.singlePerSubject) || 3980;
  const twoPerSubject = Number(source.twoPerSubject) || 3680;
  const threePlusPerSubject = Number(source.threePlusPerSubject) || 3380;
  const standardCount = selectedSubjects.length
    ? selectedSubjects.filter((subject) => !humanitiesSubjects.has(subject)).length
    : subjectCount;
  const humanitiesCount = selectedSubjects.length
    ? selectedSubjects.filter((subject) => humanitiesSubjects.has(subject)).length
    : 0;
  // 文综一口价科目不参与语数英物化（及其他非文综科目）的阶梯档位。
  // 高一生物是否按文综价由产品 humanitiesSubjects 配置决定；其他年级
  // 未配置生物时，它自然归入 standardCount 并参与阶梯计价。
  const tierSubjectCount = standardCount;
  const selectedPerSubject = tierSubjectCount <= 1
    ? singlePerSubject
    : tierSubjectCount === 2
      ? twoPerSubject
      : threePlusPerSubject;
  const humanitiesOriginal = Number(product.humanitiesPricing?.originalPerSubject) || originalPerSubject;
  const humanitiesCurrent = Number(product.humanitiesPricing?.fixedPerSubject) || selectedPerSubject;

  return {
    originalPerSubject,
    selectedPerSubject,
    originalTotal: originalPerSubject * standardCount + humanitiesOriginal * humanitiesCount,
    currentTotal: selectedPerSubject * standardCount + humanitiesCurrent * humanitiesCount,
    getSubjectOriginal: (subject) => humanitiesSubjects.has(subject) ? humanitiesOriginal : originalPerSubject,
    getSubjectCurrent: (subject) => humanitiesSubjects.has(subject) ? humanitiesCurrent : selectedPerSubject,
    tiers: [
      { label: "单科", subjects: 1, perSubject: singlePerSubject, total: singlePerSubject, active: tierSubjectCount <= 1 },
      { label: "联报两科", subjects: 2, perSubject: twoPerSubject, total: twoPerSubject * 2, active: tierSubjectCount === 2 },
      { label: "联报三科", subjects: 3, perSubject: threePlusPerSubject, total: threePlusPerSubject * Math.max(tierSubjectCount, 3), active: tierSubjectCount >= 3 },
    ],
  };
}

export function formatPrice(value) {
  return Number(value || 0).toLocaleString("zh-CN");
}

export function getNumericValue(value) {
  const match = String(value ?? "").replace(/,/g, "").match(/\d+(?:\.\d+)?/);
  return match ? Number(match[0]) : 0;
}
