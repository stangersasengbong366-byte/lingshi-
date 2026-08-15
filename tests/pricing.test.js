import test from "node:test";
import assert from "node:assert/strict";
import { getProductPricing } from "../src/domain/pricing.js";

const createProduct = (grade, overrides = {}) => ({
  grade,
  pricing: {
    originalPerSubject: 5400,
    singlePerSubject: 5280,
    twoPerSubject: 5080,
    threePlusPerSubject: 4780,
  },
  humanitiesPricing: {
    originalPerSubject: 5400,
    fixedPerSubject: 2700,
  },
  ...overrides,
});

test("高三一轮卡：数学化学走两科阶梯，政治走一口价", () => {
  const pricing = getProductPricing(createProduct("高三"), ["数学", "化学", "政治"]);
  assert.equal(pricing.getSubjectCurrent("数学"), 5080);
  assert.equal(pricing.getSubjectCurrent("化学"), 5080);
  assert.equal(pricing.getSubjectCurrent("政治"), 2700);
  assert.equal(pricing.currentTotal, 12860);
});

test("三门非文综科目使用三科阶梯，文综价格另行叠加", () => {
  const pricing = getProductPricing(createProduct("高三"), ["数学", "化学", "生物", "政治"]);
  assert.equal(pricing.getSubjectCurrent("数学"), 4780);
  assert.equal(pricing.getSubjectCurrent("生物"), 4780);
  assert.equal(pricing.getSubjectCurrent("政治"), 2700);
  assert.equal(pricing.currentTotal, 17040);
});

test("高一生物与文综科目统一按一口价", () => {
  const pricing = getProductPricing(createProduct("高一"), ["数学", "化学", "生物"]);
  assert.equal(pricing.getSubjectCurrent("数学"), 5080);
  assert.equal(pricing.getSubjectCurrent("化学"), 5080);
  assert.equal(pricing.getSubjectCurrent("生物"), 2700);
  assert.equal(pricing.currentTotal, 12860);
});

test("非高一生物参与非文综阶梯，兼容旧配置残留", () => {
  const product = createProduct("高三", { humanitiesSubjects: ["生物", "历史", "地理", "政治"] });
  const pricing = getProductPricing(product, ["数学", "生物", "政治"]);
  assert.equal(pricing.getSubjectCurrent("数学"), 5080);
  assert.equal(pricing.getSubjectCurrent("生物"), 5080);
  assert.equal(pricing.getSubjectCurrent("政治"), 2700);
  assert.equal(pricing.currentTotal, 12860);
});

test("纯文综组合全部按一口价，不触发非文综阶梯", () => {
  const pricing = getProductPricing(createProduct("高三"), ["历史", "地理", "政治"]);
  assert.equal(pricing.currentTotal, 8100);
});

test("高一秋冬衔接卡生物采用4200原价、2700实付独立体系", () => {
  const product = {
    grade: "高一",
    pricing: { originalPerSubject: 5600, singlePerSubject: 4580, twoPerSubject: 4380, threePlusPerSubject: 4080 },
    humanitiesPricing: { originalPerSubject: 4200, fixedPerSubject: 2700 },
    humanitiesSubjects: ["生物", "历史", "地理", "政治"],
  };
  const pricing = getProductPricing(product, ["生物"]);
  assert.equal(pricing.originalTotal, 4200);
  assert.equal(pricing.currentTotal, 2700);
});
