import test from "node:test";
import assert from "node:assert/strict";
import { parseLinkedViewConfig } from "./codeblock";

test("parseLinkedViewConfig parses full codeblock configuration", () => {
  const code = [
    "source: [[Projects#Sprint Tasks]]",
    "view: kanban",
    "groupBy: Status",
    "filter: Priority == High",
    "sort: Score desc",
    "table: 2",
  ].join("\n");

  const config = parseLinkedViewConfig(code);
  assert.ok(config);
  assert.equal(config.notePath, "Projects");
  assert.equal(config.subpath, "#Sprint Tasks");
  assert.equal(config.view, "kanban");
  assert.equal(config.groupBy, "Status");
  assert.equal(config.filter, "Priority == High");
  assert.equal(config.sort, "Score desc");
  assert.equal(config.tableIndex, 2);
});

test("parseLinkedViewConfig handles block ID reference and defaults", () => {
  const code = [
    "source: [[Notes#^sprint-table]]",
  ].join("\n");

  const config = parseLinkedViewConfig(code);
  assert.ok(config);
  assert.equal(config.notePath, "Notes");
  assert.equal(config.subpath, "#^sprint-table");
  assert.equal(config.view, "table");
  assert.equal(config.tableIndex, 1);
});

test("parseLinkedViewConfig supports 'from' as alias for 'source'", () => {
  const code = "from: [[Tasks]]\nview: calendar";
  const config = parseLinkedViewConfig(code);
  assert.ok(config);
  assert.equal(config.notePath, "Tasks");
  assert.equal(config.view, "calendar");
});

test("parseLinkedViewConfig returns null when source is missing", () => {
  const code = "view: kanban\ngroupBy: Status";
  const config = parseLinkedViewConfig(code);
  assert.equal(config, null);
});
