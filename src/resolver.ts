export interface DetectedTable {
  startLine: number;
  endLine: number;
  lines: string[];
  blockId?: string;
  heading?: string;
}

export interface ResolveTableOptions {
  subpath?: string; // e.g. "^sprint-tasks" or "#Sprint Tasks"
  tableIndex?: number; // 1-based index (e.g. 1, 2, ...)
}

export interface ResolvedTable {
  table: DetectedTable;
  allLines: string[];
}

/**
 * Scan all markdown tables from the file lines.
 * Associates each table with its nearest preceding heading and trailing block ID if any.
 */
export function scanTables(contentLines: string[]): DetectedTable[] {
  const tables: DetectedTable[] = [];
  let currentHeading = "";
  let inTable = false;
  let tableStart = -1;
  let currentTableLines: string[] = [];

  for (let i = 0; i < contentLines.length; i++) {
    const line = contentLines[i];
    const trimmed = line.trim();

    // Track heading
    const headingMatch = trimmed.match(/^(#{1,6})\s+(.+)$/);
    if (headingMatch) {
      if (inTable) {
        // Close table before heading
        tables.push({
          startLine: tableStart,
          endLine: i - 1,
          lines: [...currentTableLines],
          heading: currentHeading,
        });
        inTable = false;
        currentTableLines = [];
      }
      currentHeading = headingMatch[2].trim();
      continue;
    }

    // Check if line looks like a table row: starts and ends with '|' or contains '|'
    const isTableRow = trimmed.startsWith("|") && trimmed.endsWith("|") && trimmed.length > 1;

    if (isTableRow) {
      if (!inTable) {
        // Need to check if next line is a separator or if this is part of table
        // Or if already started
        inTable = true;
        tableStart = i;
        currentTableLines = [line];
      } else {
        currentTableLines.push(line);
      }
    } else {
      if (inTable) {
        // Check if this line is an Obsidian block reference, e.g. ^my-table
        const blockIdMatch = trimmed.match(/^\^([a-zA-Z0-9_-]+)$/);
        let blockId: string | undefined = undefined;
        let endIdx = i - 1;

        if (blockIdMatch) {
          blockId = blockIdMatch[1];
          endIdx = i; // include block ID line in table bounds
        }

        tables.push({
          startLine: tableStart,
          endLine: endIdx,
          lines: [...currentTableLines],
          heading: currentHeading,
          blockId,
        });

        inTable = false;
        currentTableLines = [];
      }
    }
  }

  // If file ends while inside a table
  if (inTable && currentTableLines.length > 0) {
    tables.push({
      startLine: tableStart,
      endLine: contentLines.length - 1,
      lines: [...currentTableLines],
      heading: currentHeading,
    });
  }

  // Filter out any false positive 1-line tables that don't have header separator
  return tables.filter((t) => {
    if (t.lines.length < 2) return false;
    const sep = t.lines[1].trim();
    return /^\|?\s*:?-+:?\s*(\|:?-+:?\s*)+\|?$/.test(sep);
  });
}

/**
 * Resolves a specific table from raw markdown content using:
 * 1. Block ID (^id)
 * 2. Heading (#Heading)
 * 3. Table Index (table: 1, table: 2)
 */
export function resolveTargetTable(
  fileContent: string,
  options: ResolveTableOptions = {},
): ResolvedTable | null {
  const contentLines = fileContent.split("\n");
  const tables = scanTables(contentLines);

  if (tables.length === 0) return null;

  const subpath = options.subpath?.trim();
  const tableIndex = options.tableIndex ?? 1;

  // Case 1: Subpath is a Block ID (^id)
  if (subpath && subpath.startsWith("^")) {
    const rawId = subpath.slice(1).trim().toLowerCase();
    const found = tables.find((t) => t.blockId?.toLowerCase() === rawId);
    if (found) {
      return { table: found, allLines: contentLines };
    }
    // Also check if any line in table contains <!-- zibase-id: id -->
    for (const t of tables) {
      for (const line of t.lines) {
        const commentMatch = line.match(/<!--\s*zibase-id:\s*([a-zA-Z0-9_-]+)\s*-->/i);
        if (commentMatch && commentMatch[1].toLowerCase() === rawId) {
          return { table: t, allLines: contentLines };
        }
      }
    }
    return null;
  }

  // Case 2: Subpath is a Heading (#Heading or Heading)
  if (subpath) {
    const cleanHeading = subpath.startsWith("#") ? subpath.replace(/^#+\s*/, "").trim() : subpath;
    const matchingHeadingTables = tables.filter((t) =>
      t.heading?.toLowerCase() === cleanHeading.toLowerCase(),
    );

    if (matchingHeadingTables.length > 0) {
      const idx = Math.max(0, tableIndex - 1);
      const chosen = matchingHeadingTables[idx] ?? matchingHeadingTables[0];
      return { table: chosen, allLines: contentLines };
    }
  }

  // Case 3: Table index / Default first table
  const idx = Math.max(0, tableIndex - 1);
  if (idx < tables.length) {
    return { table: tables[idx], allLines: contentLines };
  }

  return null;
}
