
var ANNOTATION_RE = /<!--\s*zibase:\s*([^\s>]+(?:\s*[^\s>]+)*)\s*-->/i;
var VIEW_ANNOTATION_RE = /<!--\s*zibase-view:\s*(\w+)(?::([^>]+))?\s*-->/i;
var DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
var NUMBER_RE = /^-?\d+(\.\d+)?$/;
var DEFAULT_COLUMN_RULES = [
  { name: "domain", type: "label" },
  { name: "category", type: "label" },
  { name: "tag", type: "label" },
  { name: "tags", type: "label" },
  { name: "type", type: "label" },
  { name: "label", type: "label" },
  { name: "labels", type: "label" },
  { name: "done", type: "toggle" },
  { name: "completed", type: "toggle" },
  { name: "status", type: "select" }
];
function parseZiBaseSchema(lines, columnRules = DEFAULT_COLUMN_RULES) {
  if (lines.length < 2)
    return null;
  const headerCells = splitRow(lines[0]);
  if (headerCells.length === 0)
    return null;
  if (lines.length >= 3) {
    const schemaCells = splitRow(lines[2]);
    const hasAnnotations = schemaCells.some((c) => ANNOTATION_RE.test(c));
    if (hasAnnotations) {
      const columns2 = headerCells.map((name, i) => {
        var _a;
        const cell = (_a = schemaCells[i]) != null ? _a : "";
        const match = cell.match(ANNOTATION_RE);
        const typeStr = match ? match[1] : "text";
        return { name: name.trim(), type: parseType(typeStr), index: i };
      });
      return { columns: columns2, schemaRowIndex: 2, dataStartIndex: 3, inferred: false };
    }
  }
  if (lines.length < 3)
    return null;
  const dataLines = lines.slice(2).filter((l) => l.trim() && l.includes("|"));
  if (dataLines.length === 0)
    return null;
  const colValues = headerCells.map(() => []);
  dataLines.forEach((line) => {
    const cells = splitRow(line);
    headerCells.forEach((_, i) => {
      var _a;
      const v = ((_a = cells[i]) != null ? _a : "").trim();
      if (v)
        colValues[i].push(v);
    });
  });
  const columns = headerCells.map((name, i) => ({
    name: name.trim(),
    type: inferType(name.trim(), colValues[i], columnRules),
    index: i
  }));
  return { columns, schemaRowIndex: null, dataStartIndex: 2, inferred: true };
}

/**
 * Parse the view annotation from lines above or near the table.
 * Format: <!-- zibase-view: kanban:Status -->
 * Returns { view: "kanban", groupBy: "Status" } or null
 */
function parseViewAnnotation(lines) {
  for (let i = 0; i < Math.min(lines.length, 3); i++) {
    const match = lines[i].match(VIEW_ANNOTATION_RE);
    if (match) {
      return { view: match[1].toLowerCase(), groupBy: match[2] ? match[2].trim() : null };
    }
  }
  return null;
}

function inferType(colName, values, columnRules) {
  if (values.length === 0)
    return { kind: "text" };
  if (values.every((v) => v.toLowerCase() === "true" || v.toLowerCase() === "false"))
    return { kind: "toggle" };
  if (values.every((v) => DATE_RE.test(v)))
    return { kind: "date" };
  if (values.every((v) => NUMBER_RE.test(v)))
    return { kind: "number" };
  const rule = columnRules.find((r) => r.name.toLowerCase() === colName.toLowerCase());
  if (rule)
    return parseType(rule.type);
  const unique = [...new Set(values.map((v) => v.toLowerCase()))];
  const allShort = values.every((v) => v.length <= 20);
  const isRepeated = values.length >= 2 && unique.length <= Math.max(2, Math.floor(values.length * 0.75)) && unique.length <= 10;
  if (isRepeated && allShort) {
    const seen = /* @__PURE__ */ new Map();
    values.forEach((v) => {
      if (!seen.has(v.toLowerCase()))
        seen.set(v.toLowerCase(), v);
    });
    return { kind: "select", options: [...seen.values()] };
  }
  return { kind: "text" };
}
function parseType(typeStr) {
  if (typeStr.startsWith("select:")) {
    const options = typeStr.slice(7).split(",").map((s) => s.trim());
    return { kind: "select", options };
  }
  if (typeStr.startsWith("formula:")) {
    const expression = typeStr.slice(8).trim();
    return { kind: "formula", expression };
  }
  switch (typeStr.toLowerCase()) {
    case "toggle":
      return { kind: "toggle" };
    case "label":
      return { kind: "label" };
    case "number":
      return { kind: "number" };
    case "date":
      return { kind: "date" };
    case "formula":
      return { kind: "formula", expression: "" };
    default:
      return { kind: "text" };
  }
}
function splitRow(row) {
  const stripped = row.replace(/^\||\|$/g, "");
  const cells = [];
  let current = "";
  for (let i = 0; i < stripped.length; i++) {
    if (stripped[i] === "\\" && stripped[i + 1] === "|") {
      current += "|";
      i++;
    } else if (stripped[i] === "|") {
      cells.push(current.trim());
      current = "";
    } else {
      current += stripped[i];
    }
  }
  cells.push(current.trim());
  return cells;
}
function serializeRow(cells) {
  return "| " + cells.join(" | ") + " |";
}
function parseBool(val) {
  return val.trim().toLowerCase() === "true";
}
function serializeBool(val) {
  return val ? "true" : "false";
}

