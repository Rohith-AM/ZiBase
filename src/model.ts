export type ColumnKind =
  | "text"
  | "toggle"
  | "select"
  | "label"
  | "multi-select"
  | "number"
  | "date"
  | "formula";

export type ColumnType =
  | { kind: "text" }
  | { kind: "toggle" }
  | { kind: "select"; options: string[] }
  | { kind: "label" }
  | { kind: "multi-select" }
  | { kind: "number" }
  | { kind: "date" }
  | { kind: "formula"; expression: string };

export interface Column {
  name: string;
  type: ColumnType;
  index: number;
}

export interface TableSchema {
  columns: Column[];
  schemaRowIndex: number | null;
  dataStartIndex: number;
  inferred: boolean;
}

export type ViewName = "table" | "kanban" | "gallery" | "calendar";

export interface ColumnRule {
  name: string;
  type: string;
}

export interface ZiBaseSettings {
  renderInReadingView: boolean;
  inferSchema: boolean;
  columnRules: ColumnRule[];
}

export const COLUMN_TYPE_OPTIONS: ColumnKind[] = [
  "text",
  "toggle",
  "select",
  "label",
  "multi-select",
  "number",
  "date",
  "formula",
];
