import { MarkdownRenderer, type MarkdownPostProcessorContext, type MarkdownSectionInformation } from "obsidian";
import { filterDataRows, parseBool, parseMultiSelect, splitRow } from "../schema";
import type { TableSchema, ZiBaseHost } from "../types";
import { getLabelColor } from "../ui";

export function buildKanbanView(
  host: ZiBaseHost,
  body: HTMLElement,
  schema: TableSchema,
  getDataRows: () => string[],
  rawDataLines: string[],
  context: MarkdownPostProcessorContext,
  sectionInfo: MarkdownSectionInformation,
  filterQuery: string,
): void {
  const groupCol = schema.columns.find(
    (c) => c.type.kind === "select" || c.type.kind === "label" || c.type.kind === "multi-select",
  );
  if (!groupCol) {
    const notice = body.createDiv("zibase-kanban zibase-kanban-notice");
    notice.textContent = "Kanban requires a Select or Label column to group by.";
    return;
  }

  const kanban = body.createDiv("zibase-kanban");
  const dataRows = filterDataRows(getDataRows(), filterQuery);

  const groups = new Map<string, { line: string; cells: string[] }[]>();
  dataRows.forEach((line) => {
    const cells = splitRow(line);
    const rawGroupValue = (cells[groupCol.index] ?? "").trim() || "—";
    let groupValues = [rawGroupValue];
    if (groupCol.type.kind === "multi-select" && rawGroupValue !== "—") {
      groupValues = parseMultiSelect(rawGroupValue);
      if (groupValues.length === 0) groupValues = ["—"];
    }
    groupValues.forEach((gv) => {
      if (!groups.has(gv)) groups.set(gv, []);
      groups.get(gv)!.push({ line, cells });
    });
  });

  let groupKeys: string[];
  if (groupCol.type.kind === "select" && groupCol.type.options) {
    groupKeys = [...groupCol.type.options];
    for (const key of groups.keys()) {
      if (!groupKeys.includes(key)) groupKeys.push(key);
    }
  } else {
    groupKeys = [...groups.keys()];
  }

  const laneContainer = kanban.createDiv("zibase-kanban-lanes");

  groupKeys.forEach((groupValue) => {
    const items = groups.get(groupValue) || [];
    const lane = laneContainer.createDiv("zibase-kanban-lane");
    const color = getLabelColor(groupValue);

    const header = lane.createDiv("zibase-kanban-lane-header");
    header.style.setProperty("--lane-color", color);
    const headerLabel = header.createSpan({ text: groupValue, cls: "zibase-kanban-lane-title" });
    headerLabel.setCssStyles({ color });
    header.createSpan({ text: `${items.length}`, cls: "zibase-kanban-lane-count" });

    const laneBody = lane.createDiv("zibase-kanban-lane-body");
    laneBody.dataset.group = groupValue;

    laneBody.addEventListener("dragover", (e) => {
      e.preventDefault();
      laneBody.classList.add("zibase-kanban-lane-dragover");
    });
    laneBody.addEventListener("dragleave", () => {
      laneBody.classList.remove("zibase-kanban-lane-dragover");
    });
    laneBody.addEventListener("drop", async (e) => {
      e.preventDefault();
      laneBody.classList.remove("zibase-kanban-lane-dragover");
      const fromIdxStr = e.dataTransfer?.getData("text/kanban-row");
      if (!fromIdxStr) return;
      const fromIdx = parseInt(fromIdxStr, 10);
      let newValue = groupValue;
      if (groupCol.type.kind === "multi-select") {
        const rowLine = rawDataLines[fromIdx];
        const rowCells = splitRow(rowLine);
        const currentRaw = (rowCells[groupCol.index] || "").trim();
        const tags = parseMultiSelect(currentRaw);
        if (!tags.includes(groupValue)) tags.push(groupValue);
        newValue = tags.join(", ");
      }
      await host.writeBack(context, sectionInfo, schema.dataStartIndex + fromIdx, groupCol.index, newValue);
    });

    items.forEach(({ line, cells }) => {
      const rawIdx = rawDataLines.findIndex((l) => l === line);
      const card = laneBody.createDiv("zibase-kanban-card");
      card.draggable = true;
      card.addEventListener("dragstart", (e) => {
        e.dataTransfer?.setData("text/kanban-row", rawIdx.toString());
        card.classList.add("zibase-kanban-card-dragging");
      });
      card.addEventListener("dragend", () => {
        card.classList.remove("zibase-kanban-card-dragging");
      });

      schema.columns.forEach((col, colIdx) => {
        if (colIdx === groupCol.index) return;
        const rawValue = (cells[colIdx] ?? "").trim();
        if (!rawValue) return;

        if (col.type.kind === "text") {
          if (!card.querySelector(".zibase-kanban-card-title")) {
            const titleEl = card.createDiv("zibase-kanban-card-title");
            void MarkdownRenderer.renderMarkdown(rawValue, titleEl, context.sourcePath, host.plugin);
            return;
          }
        }

        const field = card.createDiv("zibase-kanban-card-field");
        field.createSpan({ text: col.name, cls: "zibase-kanban-field-label" });

        if (col.type.kind === "label") {
          const chip = field.createSpan({ text: rawValue, cls: "zibase-label zibase-kanban-label" });
          chip.style.setProperty("--lc", getLabelColor(rawValue));
        } else if (col.type.kind === "toggle") {
          field.createSpan({ text: parseBool(rawValue) ? "✅" : "⬜", cls: "zibase-kanban-field-value" });
        } else if (col.type.kind === "number" || col.type.kind === "formula") {
          field.createSpan({ text: rawValue, cls: "zibase-kanban-field-value" });
        } else if (col.type.kind === "date") {
          field.createSpan({ text: rawValue, cls: "zibase-kanban-field-value zibase-date-rendered" });
        } else {
          field.createSpan({ text: rawValue, cls: "zibase-kanban-field-value" });
        }
      });

      if (!card.querySelector(".zibase-kanban-card-title")) {
        const titleEl = createDiv();
        titleEl.className = "zibase-kanban-card-title";
        void MarkdownRenderer.renderMarkdown(cells[0] || "—", titleEl, context.sourcePath, host.plugin);
        card.insertBefore(titleEl, card.firstChild);
      }
    });
  });
}
