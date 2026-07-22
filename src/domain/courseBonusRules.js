export const bonusEligibleSubjects = ["生物", "历史", "地理", "政治"];
export const bonusPurchaseSubjects = ["语文", "数学", "英语", "物理", "化学"];

export function isG1DecisionCard(product) {
  return product?.grade === "高一" && /全体系决胜/.test(`${product?.name ?? ""}${product?.courseKey ?? ""}`);
}

export function getPurchasedBonusSubjectCount(subjects = []) {
  return subjects.filter((subject) => bonusPurchaseSubjects.includes(subject)).length;
}

export function getRequiredBonusCount(product, subjects = []) {
  if (!isG1DecisionCard(product)) return 0;
  const purchased = getPurchasedBonusSubjectCount(subjects);
  if (purchased <= 0) return 0;
  if (purchased <= 2) return 1;
  return Math.min(purchased - 1, bonusEligibleSubjects.length);
}

export function getBonusCoveragePhases(product, subjects = []) {
  if (!isG1DecisionCard(product)) return [];
  return getPurchasedBonusSubjectCount(subjects) === 1 ? ["暑期"] : ["暑期", "秋季"];
}

export function normalizeBonusSubjects(product, purchasedSubjects = [], selected = []) {
  const required = getRequiredBonusCount(product, purchasedSubjects);
  return [...new Set(selected)].filter((subject) => bonusEligibleSubjects.includes(subject)).slice(0, required);
}
