import type { ViewName } from "./types";

export interface LinkedViewConfig {
  sourceRaw: string;
  notePath: string;
  subpath?: string;
  view: ViewName;
  groupBy?: string;
  filter?: string;
  sort?: string;
  tableIndex: number;
}

/**
 * Parses a ```zibase codeblock configuration.
 * Accepts YAML-style key-values:
 * source: [[Projects#Sprint Tasks]]
 * view: kanban
 * groupBy: Status
 * filter: Priority == High
 * sort: Score desc
 * table: 1
 */
export function parseLinkedViewConfig(sourceText: string): LinkedViewConfig | null {
  const lines = sourceText.split("\n");
  const configMap = new Map<string, string>();

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#") || line.startsWith("//")) continue;

    const colonIdx = line.indexOf(":");
    if (colonIdx === -1) continue;

    const key = line.slice(0, colonIdx).trim().toLowerCase();
    const val = line.slice(colonIdx + 1).trim();
    if (key && val) {
      configMap.set(key, val);
    }
  }

  // "source" or "from" are accepted
  const sourceRaw = configMap.get("source") || configMap.get("from");
  if (!sourceRaw) return null;

  // Extract notePath and subpath from [[Note#Subpath]] or Note#Subpath
  let notePath = sourceRaw;
  let subpath: string | undefined = undefined;

  const wikiMatch = sourceRaw.match(/^\[\[([^\]]+)\]\]$/);
  const targetStr = wikiMatch ? wikiMatch[1].trim() : sourceRaw;

  // Check if targetStr contains #
  const hashIdx = targetStr.indexOf("#");
  if (hashIdx !== -1) {
    notePath = targetStr.slice(0, hashIdx).trim();
    subpath = targetStr.slice(hashIdx).trim(); // includes '#' or '#^'
  } else {
    notePath = targetStr;
  }

  // Parse view (table, kanban, gallery, calendar)
  const rawView = (configMap.get("view") || "table").toLowerCase();
  let view: ViewName = "table";
  let groupBy = configMap.get("groupby") || configMap.get("group_by");

  if (rawView.startsWith("kanban")) {
    view = "kanban";
    if (rawView.includes(":")) {
      const parts = rawView.split(":");
      groupBy = groupBy || parts[1]?.trim();
    }
  } else if (rawView === "gallery") {
    view = "gallery";
  } else if (rawView === "calendar") {
    view = "calendar";
  } else {
    view = "table";
  }

  const tableIndexStr = configMap.get("table") || configMap.get("index");
  const parsedIndex = tableIndexStr ? parseInt(tableIndexStr, 10) : 1;
  const tableIndex = isNaN(parsedIndex) || parsedIndex < 1 ? 1 : parsedIndex;

  return {
    sourceRaw,
    notePath,
    subpath,
    view,
    groupBy,
    filter: configMap.get("filter"),
    sort: configMap.get("sort"),
    tableIndex,
  };
}
