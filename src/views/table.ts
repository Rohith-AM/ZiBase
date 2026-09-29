import { TFile, type MarkdownPostProcessorContext, type MarkdownSectionInformation } from "obsidian";
import { formatResult } from "../formula";
import { filterDataRows, serializeRow, splitRow } from "../schema";
import type { TableSchema, ZiBaseHost } from "../types";
import { getTypeIcon } from "../ui";

interface StatTh extends HTMLTableCellElement {
  _updateStat?: () => void;
}

export function buildTableView(
  host: ZiBaseHost,
  body: HTMLElement,
  schema: TableSchema,
  getDataRows: () => string[],
  rawDataLines: string[],
  context: MarkdownPostProcessorContext,
  sectionInfo: MarkdownSectionInformation,
  filterQuery: string,
  sortColIdx: number | null,
  sortAsc: boolean,
  badge: HTMLElement,
  onSortChange: (col: number, asc: boolean) => void,
): void {
  const tableEl = body.createEl("table", { cls: "zibase-table" });
  const thead = tableEl.createEl("thead");
  const headerRow = thead.createEl("tr");
  const statModes: Record<number, string> = {};

  schema.columns.forEach((col, colIdx) => {
    const th = headerRow.createEl("th", { cls: "zibase-th" }) as StatTh;
    th.draggable = true;
    th.addEventListener("dragstart", (e) => {
      e.stopPropagation();
      e.dataTransfer?.setData("text/col", colIdx.toString());
    });
    th.addEventListener("dragover", (e) => {
      e.preventDefault();
      th.classList.add("zibase-th-drop-target");
    });
    th.addEventListener("dragleave", () => th.classList.remove("zibase-th-drop-target"));
    th.addEventListener("dragend", () => {
      thead.querySelectorAll(".zibase-th").forEach((el) => el.classList.remove("zibase-th-drop-target"));
    });
    th.addEventListener("drop", (e) => {
      e.preventDefault();
      e.stopPropagation();
      th.classList.remove("zibase-th-drop-target");
      const fromColStr = e.dataTransfer?.getData("text/col");
      if (!fromColStr) return;
      const fromColIdx = parseInt(fromColStr, 10);
      if (fromColIdx === colIdx) return;
      void (async () => {
        const file = host.app.vault.getAbstractFileByPath(context.sourcePath);
        if (!(file instanceof TFile)) return;
        await host.app.vault.process(file, (content) => {
          const allLines = content.split("\n");
          for (let i = sectionInfo.lineStart; i <= sectionInfo.lineEnd; i++) {
            const line = allLines[i];
            if (!line.includes("|")) continue;
            const cells = splitRow(line);
            if (cells.length <= fromColIdx || cells.length <= colIdx) continue;
            const draggedCell = cells.splice(fromColIdx, 1)[0];
            let insertIdx = colIdx;
            if (fromColIdx < colIdx) insertIdx--;
            cells.splice(insertIdx, 0, draggedCell);
            allLines[i] = serializeRow(cells);
          }
          return allLines.join("\n");
        });
      })();
    });

    const thInner = th.createDiv("zibase-th-inner");
    thInner.createSpan({ text: col.name, cls: "zibase-th-name" });
    thInner.createSpan({ text: getTypeIcon(col.type), cls: "zibase-type-icon" });
    thInner.createSpan({ cls: "zibase-sort-arrow", text: "↕" });

    if (col.type.kind === "number" || col.type.kind === "formula") {
      if (!statModes[colIdx]) statModes[colIdx] = "SUM";
      const statBadge = th.createDiv("zibase-th-stat");

      const updateThStat = () => {
        const dataRows = filterDataRows(getDataRows(), filterQuery);
        const values = dataRows
          .map((line) => parseFloat((splitRow(line)[colIdx] ?? "").trim()))
          .filter((n) => !Number.isNaN(n));

        if (values.length === 0) {
          statBadge.textContent = "";
          return;
        }

        const mode = statModes[colIdx];
        let result = 0;
        switch (mode) {
          case "SUM": result = values.reduce((a, b) => a + b, 0); break;
          case "AVG": result = values.reduce((a, b) => a + b, 0) / values.length; break;
          case "MIN": result = Math.min(...values); break;
          case "MAX": result = Math.max(...values); break;
          default: result = 0;
        }

        statBadge.empty();
        statBadge.createSpan({ text: mode, cls: "zibase-th-stat-mode" });
        statBadge.createSpan({ text: " " + formatResult(result), cls: "zibase-th-stat-value" });
      };

      statBadge.addEventListener("click", (e) => {
        e.stopPropagation();
        const modes = ["SUM", "AVG", "MIN", "MAX"];
        const current = modes.indexOf(statModes[colIdx]);
        statModes[colIdx] = modes[(current + 1) % modes.length];
        updateThStat();
      });

      th._updateStat = updateThStat;
      updateThStat();
    }

    th.addEventListener("click", () => {
      const newAsc = sortColIdx === colIdx ? !sortAsc : true;
      onSortChange(colIdx, newAsc);
      thead.querySelectorAll(".zibase-sort-arrow").forEach((el, i) => {
        el.textContent = i === colIdx ? (newAsc ? "↑" : "↓") : "↕";
        el.classList.toggle("zibase-sort-active", i === colIdx);
      });
      renderRows();
      thead.querySelectorAll(".zibase-th").forEach((thEl) => {
        const statTh = thEl as StatTh;
        if (statTh._updateStat) statTh._updateStat();
      });
    });
    th.addEventListener("contextmenu", (e) => {
      e.preventDefault();
      host.showTypeMenu(e, colIdx, schema, context, sectionInfo, rawDataLines, badge);
    });
  });

  const tbody = tableEl.createEl("tbody");

  const renderRows = () => {
    tbody.empty();
    let dataRows = filterDataRows(getDataRows(), filterQuery);
    if (sortColIdx !== null) {
      const idx = sortColIdx;
      const colType = schema.columns[idx]?.type.kind ?? "text";
      dataRows = [...dataRows].sort((a, b) => {
        const av = (splitRow(a)[idx] ?? "").trim();
        const bv = (splitRow(b)[idx] ?? "").trim();
        if (colType === "number" || colType === "formula") {
          const na = parseFloat(av);
          const nb = parseFloat(bv);
          if (!Number.isNaN(na) && !Number.isNaN(nb)) return sortAsc ? na - nb : nb - na;
        }
        if (colType === "date") {
          const da = new Date(av).getTime();
          const db = new Date(bv).getTime();
          if (!Number.isNaN(da) && !Number.isNaN(db)) return sortAsc ? da - db : db - da;
        }
        if (colType === "toggle") {
          const ba = av.toLowerCase() === "true" ? 1 : 0;
          const bb = bv.toLowerCase() === "true" ? 1 : 0;
          return sortAsc ? ba - bb : bb - ba;
        }
        return sortAsc ? av.localeCompare(bv) : bv.localeCompare(av);
      });
    }
    if (dataRows.length === 0) {
      const emptyTd = tbody.createEl("tr").createEl("td", { cls: "zibase-empty" });
      emptyTd.colSpan = schema.columns.length;
      emptyTd.textContent = filterQuery ? "No matching rows" : "No data";
      return;
    }
    dataRows.forEach((line) => {
      const rawIdx = rawDataLines.findIndex((l) => l === line);
      const cells = splitRow(line);
      const tr = tbody.createEl("tr", { cls: "zibase-row" });
      tr.draggable = true;
      tr.addEventListener("dragstart", (e) => {
        e.dataTransfer?.setData("text/row", rawIdx.toString());
        tr.classList.add("zibase-row-dragging");
      });
      tr.addEventListener("dragend", () => {
        tr.classList.remove("zibase-row-dragging");
        tbody.querySelectorAll(".zibase-row").forEach((el) => el.classList.remove("zibase-row-drop-target"));
      });
      tr.addEventListener("dragover", (e) => {
        e.preventDefault();
        tr.classList.add("zibase-row-drop-target");
      });
      tr.addEventListener("dragleave", () => tr.classList.remove("zibase-row-drop-target"));
      tr.addEventListener("drop", (e) => {
        e.preventDefault();
        e.stopPropagation();
        tr.classList.remove("zibase-row-drop-target");
        const fromIdxStr = e.dataTransfer?.getData("text/row");
        if (!fromIdxStr) return;
        const fromIdx = parseInt(fromIdxStr, 10);
        const toIdx = rawIdx;
        if (fromIdx !== toIdx) {
          void (async () => {
            const file = host.app.vault.getAbstractFileByPath(context.sourcePath);
            if (!(file instanceof TFile)) return;
            await host.app.vault.process(file, (content) => {
              const allLines = content.split("\n");
              const fileStart = sectionInfo.lineStart + schema.dataStartIndex;
              const dataLines = allLines.slice(fileStart, fileStart + rawDataLines.length);
              const dragged = dataLines.splice(fromIdx, 1)[0];
              let insertIdx = toIdx;
              if (fromIdx < toIdx) insertIdx--;
              dataLines.splice(insertIdx, 0, dragged);
              allLines.splice(fileStart, rawDataLines.length, ...dataLines);
              return allLines.join("\n");
            });
          })();
        }
      });
      schema.columns.forEach((col, colIdx) => {
        const td = tr.createEl("td", { cls: "zibase-td" });
        const rawValue = cells[colIdx] ?? "";
        host.renderCell(td, col, rawValue, context, schema, cells, (newValue) => {
          if (rawIdx !== -1) {
            const updatedCells = splitRow(rawDataLines[rawIdx]);
            updatedCells[colIdx] = ` ${newValue} `;
            rawDataLines[rawIdx] = serializeRow(updatedCells);
          }
          void host.writeBack(context, sectionInfo, schema.dataStartIndex + rawIdx, colIdx, newValue);
        });
      });
    });
  };
  renderRows();
}
