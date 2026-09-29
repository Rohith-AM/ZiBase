import type { ColumnRule, ColumnType, TableSchema, ViewName } from "./model";

export const ANNOTATION_RE = /<!--\s*zibase:\s*([^\s>]+(?:\s*[^\s>]+)*)\s*-->/i;
export const VIEW_ANNOTATION_RE = /<!--\s*zibase-view:\s*(\w+)(?::([^>]+))?\s*-->/i;
export const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
export const NUMBER_RE = /^-?\d+(\.\d+)?$/;

export const DEFAULT_COLUMN_RULES: ColumnRule[] = [
  { name: "domain", type: "label" },
  { name: "category", type: "label" },
  { name: "tag", type: "label" },
  { name: "tags", type: "multi-select" },
  { name: "type", type: "label" },
  { name: "label", type: "label" },
  { name: "labels", type: "multi-select" },
  { name: "done", type: "toggle" },
  { name: "completed", type: "toggle" },
  { name: "status", type: "select" },
];

export function parseZiBaseSchema(
  lines: string[],
  columnRules: ColumnRule[] = DEFAULT_COLUMN_RULES,
): TableSchema | null {
  if (lines.length < 2) return null;

  const headerCells = splitRow(lines[0]);
  if (headerCells.length === 0) return null;

  if (lines.length >= 3) {
    const schemaCells = splitRow(lines[2]);
    const hasAnnotations = schemaCells.some((c) => ANNOTATION_RE.test(c));
    if (hasAnnotations) {
      const columns = headerCells.map((name, i) => {
        const cell = schemaCells[i] ?? "";
        const match = cell.match(ANNOTATION_RE);
        const typeStr = match ? match[1] : "text";
        return { name: name.trim(), type: parseType(typeStr), index: i };
      });
      return { columns, schemaRowIndex: 2, dataStartIndex: 3, inferred: false };
    }
  }

  if (lines.length < 3) return null;

  const dataLines = lines.slice(2).filter((l) => l.trim() && l.includes("|"));
  if (dataLines.length === 0) return null;

  const colValues: string[][] = headerCells.map(() => []);
  dataLines.forEach((line) => {
    const cells = splitRow(line);
    headerCells.forEach((_, i) => {
      const v = (cells[i] ?? "").trim();
      if (v) colValues[i].push(v);
    });
  });

  const columns = headerCells.map((name, i) => ({
    name: name.trim(),
    type: inferType(name.trim(), colValues[i], columnRules),
    index: i,
  }));
  return { columns, schemaRowIndex: null, dataStartIndex: 2, inferred: true };
}

export function parseViewAnnotation(
  lines: string[],
): { view: ViewName; groupBy: string | null } | null {
  for (let i = 0; i < Math.min(lines.length, 3); i++) {
    const match = lines[i].match(VIEW_ANNOTATION_RE);
    if (match) {
      return { view: match[1].toLowerCase() as ViewName, groupBy: match[2] ? match[2].trim() : null };
    }
  }
  return null;
}

function inferType(colName: string, values: string[], columnRules: ColumnRule[]): ColumnType {
  if (values.length === 0) return { kind: "text" };
  if (values.every((v) => v.toLowerCase() === "true" || v.toLowerCase() === "false")) {
    return { kind: "toggle" };
  }
  if (values.every((v) => DATE_RE.test(v))) return { kind: "date" };
  if (values.every((v) => NUMBER_RE.test(v))) return { kind: "number" };

  const rule = columnRules.find((r) => r.name.toLowerCase() === colName.toLowerCase());
  if (rule) return parseType(rule.type);

  const unique = [...new Set(values.map((v) => v.toLowerCase()))];
  const allShort = values.every((v) => v.length <= 20);
  const isRepeated =
    values.length >= 2 &&
    unique.length <= Math.max(2, Math.floor(values.length * 0.75)) &&
    unique.length <= 10;
  if (isRepeated && allShort) {
    const seen = new Map<string, string>();
    values.forEach((v) => {
      if (!seen.has(v.toLowerCase())) seen.set(v.toLowerCase(), v);
    });
    return { kind: "select", options: [...seen.values()] };
  }
  return { kind: "text" };
}

export function parseType(typeStr: string): ColumnType {
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
    case "multi-select":
    case "tags":
      return { kind: "multi-select" };
    case "number":
      return { kind: "number" };
    case "date":
      return { kind: "date" };
    case "select":
      return { kind: "select", options: [] };
    case "formula":
      return { kind: "formula", expression: "" };
    default:
      return { kind: "text" };
  }
}

export function splitRow(row: string): string[] {
  const stripped = row.replace(/^\||\|$/g, "");
  const cells: string[] = [];
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

export function serializeRow(cells: string[]): string {
  return "| " + cells.join(" | ") + " |";
}

export function parseBool(val: string): boolean {
  return val.trim().toLowerCase() === "true";
}

export function serializeBool(val: boolean): string {
  return val ? "true" : "false";
}

export function parseMultiSelect(val: string): string[] {
  if (!val) return [];
  return val.split(",").map((s) => s.trim()).filter((s) => s.length > 0);
}

export function isDataRow(line: string): boolean {
  return Boolean(line.trim() && line.includes("|") && !/<!--\s*zibase:/.test(line) && !/<!--\s*zibase-view:/.test(line));
}

export function filterDataRows(rows: string[], query: string): string[] {
  if (!query) return rows;
  const q = query.toLowerCase();
  return rows.filter((line) => splitRow(line).some((cell) => cell.toLowerCase().includes(q)));
}
