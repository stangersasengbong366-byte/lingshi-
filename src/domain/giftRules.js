export function getGiftRuleThreshold(rule) {
  const text = String(rule || "");
  if (
    text.includes("两科及以下")
    || text.includes("直接赠送")
    || text.includes("买即赠对应学科")
    || text.includes("买赠对应")
    || text.includes("买对应学科")
  ) return 1;
  if (/买满\s*3\s*科|3科|三科/.test(text)) return 3;
  if (/买满\s*2\s*科|2科|两科/.test(text) && !text.includes("两科及以下")) return 2;
  return 1;
}

export function normalizeCourseGiftRule(rule) {
  const text = String(rule || "");
  if (text.includes("三科及以上赠全科") && !text.includes("买即赠对应学科")) return "三科及以上赠全科";
  return "买即赠对应学科";
}

export function normalizePhysicalRule(rule) {
  return `买满${getGiftRuleThreshold(rule)}科赠`;
}

export function isGiftRuleEligible(rule, subjectCount) {
  return subjectCount >= getGiftRuleThreshold(rule);
}

export function isCourseGiftRuleEligible(rule, subjectCount) {
  return isGiftRuleEligible(normalizeCourseGiftRule(rule), subjectCount);
}
