import { test } from "node:test";
import assert from "node:assert/strict";
import {
  parseBool,
  parseMultiSelect,
  parseType,
  parseViewAnnotation,
  parseZiBaseSchema,
  serializeBool,
  serializeRow,
  splitRow,
} from "./schema";

test("splitRow handles escaped pipes", () => {
  assert.deepEqual(splitRow("| a \\| b | c |"), ["a | b", "c"]);
});

test("serializeRow round-trips cells", () => {
  assert.equal(serializeRow(["Name", "true"]), "| Name | true |");
});

test("parseZiBaseSchema reads annotated tables", () => {
  const schema = parseZiBaseSchema([
    "| Topic | Done | Priority | Score |",
    "| --- | --- | --- | --- |",
    "| <!-- zibase: text --> | <!-- zibase: toggle --> | <!-- zibase: select:Low,High --> | <!-- zibase: formula:Score --> |",
    "| Cell | true | High |  |",
  ]);
  assert.ok(schema);
  assert.equal(schema.inferred, false);
  assert.equal(schema.dataStartIndex, 3);
  assert.equal(schema.columns[1].type.kind, "toggle");
  assert.equal(schema.columns[2].type.kind, "select");
  if (schema.columns[2].type.kind === "select") {
    assert.deepEqual(schema.columns[2].type.options, ["Low", "High"]);
  }
});

test("parseZiBaseSchema infers types from values and names", () => {
  const schema = parseZiBaseSchema([
    "| Name | Done | Score | Status | Due |",
    "| --- | --- | --- | --- | --- |",
    "| Task A | true | 90 | Open | 2026-06-10 |",
    "| Task B | false | 75 | Open | 2026-06-11 |",
  ]);
  assert.ok(schema);
  assert.equal(schema.inferred, true);
  assert.equal(schema.columns[1].type.kind, "toggle");
  assert.equal(schema.columns[2].type.kind, "number");
  assert.equal(schema.columns[3].type.kind, "select");
  assert.equal(schema.columns[4].type.kind, "date");
});

test("parseViewAnnotation and helpers", () => {
  const view = parseViewAnnotation(["<!-- zibase-view: kanban:Status -->", "| a |"]);
  assert.deepEqual(view, { view: "kanban", groupBy: "Status" });
  assert.equal(parseBool("TRUE"), true);
  assert.equal(serializeBool(false), "false");
  assert.deepEqual(parseMultiSelect("a, b"), ["a", "b"]);
  assert.equal(parseType("multi-select").kind, "multi-select");
  assert.equal(parseType("select").kind, "select");
});
