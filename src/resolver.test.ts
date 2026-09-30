import test from "node:test";
import assert from "node:assert/strict";
import { scanTables, resolveTargetTable } from "./resolver";

test("scanTables identifies multiple tables and their headings", () => {
  const content = [
    "# Project Alpha",
    "",
    "## Sprint Tasks",
    "| Task | Status |",
    "|---|---|",
    "| Bug 1 | Done |",
    "| Bug 2 | In Progress |",
    "",
    "## Budget",
    "| Item | Cost |",
    "|---|---|",
    "| Server | 500 |",
  ].join("\n");

  const tables = scanTables(content.split("\n"));
  assert.equal(tables.length, 2);
  assert.equal(tables[0].heading, "Sprint Tasks");
  assert.equal(tables[0].lines.length, 4);
  assert.equal(tables[1].heading, "Budget");
  assert.equal(tables[1].lines.length, 3);
});

test("resolveTargetTable resolves table by block reference ID", () => {
  const content = [
    "# Notes",
    "",
    "| Item | Score |",
    "|---|---|",
    "| Alpha | 100 |",
    "^alpha-table",
    "",
    "| Item | Score |",
    "|---|---|",
    "| Beta | 200 |",
    "^beta-table",
  ].join("\n");

  const result = resolveTargetTable(content, { subpath: "^beta-table" });
  assert.ok(result);
  assert.equal(result.table.blockId, "beta-table");
  assert.ok(result.table.lines[2].includes("Beta"));
});

test("resolveTargetTable resolves by heading", () => {
  const content = [
    "# Main",
    "",
    "## First Section",
    "| A | B |",
    "|---|---|",
    "| 1 | 2 |",
    "",
    "## Second Section",
    "| X | Y |",
    "|---|---|",
    "| 9 | 10 |",
  ].join("\n");

  const result = resolveTargetTable(content, { subpath: "#Second Section" });
  assert.ok(result);
  assert.equal(result.table.heading, "Second Section");
  assert.ok(result.table.lines[2].includes("9"));
});

test("resolveTargetTable handles multiple tables under same heading with tableIndex", () => {
  const content = [
    "## Check_ZiBase",
    "",
    "| Table1 | Col |",
    "|---|---|",
    "| Row 1 | Val |",
    "",
    "| Table2 | Col |",
    "|---|---|",
    "| Row 2 | Val |",
  ].join("\n");

  const res1 = resolveTargetTable(content, { subpath: "#Check_ZiBase", tableIndex: 1 });
  assert.ok(res1);
  assert.ok(res1.table.lines[0].includes("Table1"));

  const res2 = resolveTargetTable(content, { subpath: "#Check_ZiBase", tableIndex: 2 });
  assert.ok(res2);
  assert.ok(res2.table.lines[0].includes("Table2"));
});

test("resolveTargetTable falls back to first table when subpath is not provided", () => {
  const content = [
    "Intro text",
    "| First | Table |",
    "|---|---|",
    "| Hello | World |",
  ].join("\n");

  const result = resolveTargetTable(content);
  assert.ok(result);
  assert.ok(result.table.lines[0].includes("First"));
});
