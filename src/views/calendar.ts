import { MarkdownRenderer, TFile, type MarkdownPostProcessorContext, type MarkdownSectionInformation } from "obsidian";
import { filterDataRows, serializeRow, splitRow } from "../schema";
import type { TableSchema, ZiBaseHost } from "../types";
import { getLabelColor } from "../ui";

export function buildCalendarView(
  host: ZiBaseHost,
  body: HTMLElement,
  schema: TableSchema,
  getDataRows: () => string[],
  _rawDataLines: string[],
  context: MarkdownPostProcessorContext,
  sectionInfo: MarkdownSectionInformation,
  filterQuery: string,
): void {
  const dateCol = schema.columns.find((c) => c.type.kind === "date");
  if (!dateCol) {
    const notice = body.createDiv("zibase-calendar zibase-calendar-notice");
    notice.textContent = "Calendar requires a Date column.";
    return;
  }

  const calendar = body.createDiv("zibase-calendar");
  const now = new Date();
  let currentMonth = now.getMonth();
  let currentYear = now.getFullYear();

  const renderCalendar = () => {
    calendar.empty();

    const nav = calendar.createDiv("zibase-calendar-nav");
    const prevBtn = nav.createEl("button", { text: "◀", cls: "zibase-calendar-nav-btn" });
    const monthLabel = nav.createSpan({ cls: "zibase-calendar-month-label" });
    monthLabel.textContent = new Date(currentYear, currentMonth).toLocaleString("default", {
      month: "long",
      year: "numeric",
    });
    const nextBtn = nav.createEl("button", { text: "▶", cls: "zibase-calendar-nav-btn" });

    prevBtn.addEventListener("click", () => {
      currentMonth--;
      if (currentMonth < 0) {
        currentMonth = 11;
        currentYear--;
      }
      renderCalendar();
    });
    nextBtn.addEventListener("click", () => {
      currentMonth++;
      if (currentMonth > 11) {
        currentMonth = 0;
        currentYear++;
      }
      renderCalendar();
    });

    const dayHeaders = calendar.createDiv("zibase-calendar-day-headers");
    ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].forEach((d) => {
      dayHeaders.createSpan({ text: d, cls: "zibase-calendar-day-header" });
    });

    const grid = calendar.createDiv("zibase-calendar-grid");
    const firstDay = new Date(currentYear, currentMonth, 1);
    const lastDay = new Date(currentYear, currentMonth + 1, 0);
    const totalDays = lastDay.getDate();

    let startDow = firstDay.getDay() - 1;
    if (startDow < 0) startDow = 6;

    const dataRows = filterDataRows(getDataRows(), filterQuery);
    const dateMap = new Map<string, { title: string; label: string | null; line: string }[]>();
    dataRows.forEach((line) => {
      const cells = splitRow(line);
      const dateStr = (cells[dateCol.index] || "").trim();
      if (!dateStr) return;
      if (!dateMap.has(dateStr)) dateMap.set(dateStr, []);
      const titleCol = schema.columns.find((c) => c.type.kind === "text");
      const title = titleCol ? (cells[titleCol.index] || "").trim() : (cells[0] || "").trim();
      const labelCol = schema.columns.find((c) => c.type.kind === "label" || c.type.kind === "select");
      const label = labelCol ? (cells[labelCol.index] || "").trim() : null;
      dateMap.get(dateStr)!.push({ title, label, line });
    });

    const today = new Date();
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

    for (let i = 0; i < startDow; i++) {
      grid.createDiv("zibase-calendar-cell zibase-calendar-cell-empty");
    }

    for (let d = 1; d <= totalDays; d++) {
      const dateStr = `${currentYear}-${String(currentMonth + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      const cell = grid.createDiv("zibase-calendar-cell");
      if (dateStr === todayStr) cell.classList.add("zibase-calendar-today");

      cell.createSpan({ text: String(d), cls: "zibase-calendar-day-num" });

      const entries = dateMap.get(dateStr) || [];
      entries.forEach((entry) => {
        const pill = cell.createDiv("zibase-calendar-entry");
        void MarkdownRenderer.render(host.app, entry.title || "—", pill, context.sourcePath, host.plugin);
        if (entry.label) {
          pill.setCssProps({ "--lc": getLabelColor(entry.label) });
          pill.classList.add("zibase-calendar-entry-colored");
        }
      });

      if (entries.length === 0) {
        cell.addEventListener("click", () => {
          void (async () => {
            const file = host.app.vault.getAbstractFileByPath(context.sourcePath);
            if (!(file instanceof TFile)) return;
            await host.app.vault.process(file, (content) => {
              const allLines = content.split("\n");
              const newCells = schema.columns.map((col) => {
                if (col.index === dateCol.index) return ` ${dateStr} `;
                return "   ";
              });
              allLines.splice(sectionInfo.lineEnd + 1, 0, serializeRow(newCells));
              return allLines.join("\n");
            });
          })();
        });
        cell.classList.add("zibase-calendar-cell-clickable");
      }
    }
  };

  renderCalendar();
}
