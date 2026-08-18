import test from "node:test";
import assert from "node:assert/strict";
import { isCourseGiftRuleEligible, isGiftRuleEligible } from "../src/domain/giftRules.js";

test("生物与常规科目联报时，仍按完整选科数参与买赠门槛", () => {
  const selectedSubjects = ["数学", "生物"];
  assert.equal(isGiftRuleEligible("买满2科赠", selectedSubjects.length), true);
  assert.equal(isCourseGiftRuleEligible("买满2科赠", selectedSubjects.length), true);
});
