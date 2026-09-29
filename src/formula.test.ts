import { test } from "node:test";
import assert from "node:assert/strict";
import {
  evaluateFormula,
  evaluateSimpleMath,
  formatResult,
  isBackticked,
  isSimpleMath,
  stripBackticks,
} from "./formula";

test("evaluateFormula multiplies column refs", () => {
  assert.equal(evaluateFormula("Price * Qty", { Price: "10", Qty: "5" }), 50);
});

test("evaluateFormula is case-insensitive", () => {
  assert.equal(evaluateFormula("price * qty", { Price: "2", Qty: "3" }), 6);
});

test("evaluateFormula prefers longer column names", () => {
  assert.equal(
    evaluateFormula("Total Price + Price", { "Total Price": "100", Price: "5" }),
    105,
  );
});

test("evaluateFormula returns null for non-numeric refs", () => {
  assert.equal(evaluateFormula("Price * Qty", { Price: "ten", Qty: "5" }), null);
});

test("evaluateFormula returns null for leftover identifiers", () => {
  assert.equal(evaluateFormula("Price * Missing", { Price: "10" }), null);
});

test("evaluateSimpleMath and parentheses", () => {
  assert.equal(evaluateSimpleMath("(2 + 3) * 4"), 20);
  assert.equal(evaluateSimpleMath("10 / 0"), Infinity);
});

test("isSimpleMath / backticks / formatResult", () => {
  assert.equal(isSimpleMath("5*10"), true);
  assert.equal(isSimpleMath("42"), false);
  assert.equal(isBackticked("`keep`"), true);
  assert.equal(stripBackticks("`keep`"), "keep");
  assert.equal(formatResult(1.2300000001), "1.23");
  assert.equal(formatResult(null), "—");
  assert.equal(formatResult(Infinity), "∞");
});
