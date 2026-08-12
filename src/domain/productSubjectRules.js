const humanities = ["历史", "地理", "政治"];
const g1NoVideoSubjects = ["生物", ...humanities];

function includesLabel(product, label) {
  return `${product?.stage ?? ""}${product?.name ?? ""}`.includes(label);
}

export function isAutumnCard(product) {
  return includesLabel(product, "秋实");
}

export function isHalfYearCard(product) {
  return includesLabel(product, "半年") || includesLabel(product, "决胜");
}

export function getSaleableSubjects(product, configuredSubjects, allSubjects = configuredSubjects) {
  const subjects = Array.isArray(configuredSubjects) ? configuredSubjects : [];
  const completeSubjects = Array.isArray(allSubjects) ? allSubjects : subjects;
  const grade = String(product?.grade ?? "");
  // 历史云端数据可能保留“秋实卡”stage，但产品名已经是“决胜卡”；
  // 半年/决胜卡规则优先，避免旧字段把可售科目错误截断。
  if (grade.includes("高一") && isHalfYearCard(product)) return completeSubjects;
  if (grade.includes("高一") && isAutumnCard(product)) {
    return completeSubjects.filter((subject) => !g1NoVideoSubjects.includes(subject));
  }
  if (grade.includes("高二") && isHalfYearCard(product)) return completeSubjects;
  if (grade.includes("高二") && isAutumnCard(product)) {
    return completeSubjects.filter((subject) => !humanities.includes(subject));
  }
  if (grade.includes("高三") && includesLabel(product, "一轮")) return completeSubjects;
  return subjects;
}

export function getVideoAvailabilityOverride(product, subject) {
  if (String(product?.grade ?? "").includes("高一") && isHalfYearCard(product) && g1NoVideoSubjects.includes(subject)) {
    return { hasVideo: false, isLayered: false };
  }
  return null;
}
