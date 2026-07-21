const humanitiesSubjects = new Set(["历史", "地理", "政治"]);

export function getProductPricing(product, subjectsOrCount) {
  const selectedSubjects = Array.isArray(subjectsOrCount) ? subjectsOrCount : [];
  const subjectCount = selectedSubjects.length || Number(subjectsOrCount) || 1;
  const source = product.pricing ?? {};
  const originalPerSubject = Number(source.originalPerSubject) || 5400;
  const singlePerSubject = Number(source.singlePerSubject) || 3980;
  const twoPerSubject = Number(source.twoPerSubject) || 3680;
  const threePlusPerSubject = Number(source.threePlusPerSubject) || 3380;
  const selectedPerSubject = subjectCount === 1
    ? singlePerSubject
    : subjectCount === 2
      ? twoPerSubject
      : threePlusPerSubject;
  const standardCount = selectedSubjects.length
    ? selectedSubjects.filter((subject) => !humanitiesSubjects.has(subject)).length
    : subjectCount;
  const humanitiesCount = selectedSubjects.length
    ? selectedSubjects.filter((subject) => humanitiesSubjects.has(subject)).length
    : 0;
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
      { label: "单科", subjects: 1, perSubject: singlePerSubject, total: singlePerSubject, active: subjectCount === 1 },
      { label: "联报两科", subjects: 2, perSubject: twoPerSubject, total: twoPerSubject * 2, active: subjectCount === 2 },
      { label: "联报三科", subjects: 3, perSubject: threePlusPerSubject, total: threePlusPerSubject * Math.max(subjectCount, 3), active: subjectCount >= 3 },
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
