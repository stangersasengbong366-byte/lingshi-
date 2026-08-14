import test from "node:test";
import assert from "node:assert/strict";
import { isPublicEntrySearch } from "../src/domain/accessRules.js";

test("运营端根路径需要密码验证", () => {
  assert.equal(isPublicEntrySearch(""), false);
  assert.equal(isPublicEntrySearch("?qa=refresh"), false);
});

test("销售端和新旧用户短链不进入运营密码页", () => {
  assert.equal(isPublicEntrySearch("?sales=1"), true);
  assert.equal(isPublicEntrySearch("?s=5w681z5l3"), true);
  assert.equal(isPublicEntrySearch("?s=abc&share=1&product=g1-autumn-card"), true);
  assert.equal(isPublicEntrySearch("?share=1&product=g1-autumn-card"), true);
});

