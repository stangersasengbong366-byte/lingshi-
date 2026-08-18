const defaultHumanitiesSubjects = ["历史", "地理", "政治"];

function isG1AutumnWinterBridgeCard(product) {
  return String(product?.grade ?? "").includes("高一")
    && /秋冬衔接/.test(`${product?.stage ?? ""}${product?.name ?? ""}`);
}

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
  const fallbackStandardCount = Math.max(1, Number(subjectsOrCount) || 1);
  const source = product.pricing ?? {};
  const originalPerSubject = Number(source.originalPerSubject) || 5400;
  const singlePerSubject = Number(source.singlePerSubject) || 3980;
  const twoPerSubject = Number(source.twoPerSubject) || 3680;
  const threePlusPerSubject = Number(source.threePlusPerSubject) || 3380;
  const standardCount = selectedSubjects.length
    ? selectedSubjects.filter((subject) => !humanitiesSubjects.has(subject)).length
    : fallbackStandardCount;
  const humanitiesCount = selectedSubjects.length
    ? selectedSubjects.filter((subject) => humanitiesSubjects.has(subject)).length
    : 0;
  // 文综一口价科目不参与语数英物化（及其他非文综科目）的阶梯档位。
  // 高一生物固定按一口价；其他年级生物固定归入 standardCount，
  // 即使历史产品配置残留 humanitiesSubjects 也不会改变这个规则。
  const tierSubjectCount = standardCount;
  const selectedPerSubject = tierSubjectCount <= 1
    ? singlePerSubject
    : tierSubjectCount === 2
      ? twoPerSubject
      : threePlusPerSubject;
  const humanitiesOriginal = Number(product.humanitiesPricing?.originalPerSubject) || originalPerSubject;
  const humanitiesCurrent = Number(product.humanitiesPricing?.fixedPerSubject) || selectedPerSubject;

  if (isG1AutumnWinterBridgeCard(product) && selectedSubjects.length) {
    const standardSubjects = selectedSubjects.filter((subject) => !humanitiesSubjects.has(subject));
    const hasBiology = selectedSubjects.includes("生物");
    const isBiologyOnly = hasBiology && standardSubjects.length === 0;
    const standardOriginalTotal = originalPerSubject * standardSubjects.length;
    const standardCurrentTotal = selectedPerSubject * standardSubjects.length;
    const biologyOriginal = Number(product.humanitiesPricing?.originalPerSubject) || 4200;
    const biologyCurrent = Number(product.humanitiesPricing?.fixedPerSubject) || 2700;
    const needsManualBiologyQuote = hasBiology && !isBiologyOnly;
    return {
      originalPerSubject,
      selectedPerSubject,
      originalTotal: isBiologyOnly ? biologyOriginal : standardOriginalTotal,
      currentTotal: isBiologyOnly ? biologyCurrent : standardCurrentTotal,
      getSubjectOriginal: (subject) => subject === "生物" ? biologyOriginal : originalPerSubject,
      getSubjectCurrent: (subject) => subject === "生物" ? biologyCurrent : selectedPerSubject,
      needsManualBiologyQuote,
      manualQuoteSubjects: needsManualBiologyQuote ? ["生物"] : [],
      pricingNotice: needsManualBiologyQuote
        ? "生物不适用于联报名价格计算体系，请老师单独计算。"
        : isBiologyOnly
          ? "生物单科一口价 ¥2,700。"
        : "语数英物化按所选科数参与联报阶梯优惠。",
      tiers: [
        { label: "单科", subjects: 1, perSubject: singlePerSubject, total: singlePerSubject, active: tierSubjectCount <= 1 },
        { label: "联报两科", subjects: 2, perSubject: twoPerSubject, total: twoPerSubject * 2, active: tierSubjectCount === 2 },
        { label: "联报三科", subjects: 3, perSubject: threePlusPerSubject, total: threePlusPerSubject * Math.max(tierSubjectCount, 3), active: tierSubjectCount >= 3 },
      ],
    };
  }

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
