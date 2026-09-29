import {
  MarkdownRenderer,
  TFile,
  type App,
  type MarkdownPostProcessorContext,
  type MarkdownSectionInformation,
} from "obsidian";
import { renderCell } from "./cells";
import { FormulaInputModal, SelectOptionsModal } from "./modals";
import {
  isDataRow,
  parseZiBaseSchema,
  parseViewAnnotation,
  serializeRow,
  splitRow,
  parseBool,
  VIEW_ANNOTATION_RE,
} from "./schema";
import type {
  CellChangeHandler,
  Column,
  TableSchema,
  ViewName,
  ZiBaseHost,
  ZiBasePluginLike,
} from "./types";
import { COLUMN_TYPE_OPTIONS } from "./types";
import { attachLinkTooltip, showToast } from "./ui";
import { buildCalendarView } from "./views/calendar";
import { buildGalleryView } from "./views/gallery";
import { buildKanbanView } from "./views/kanban";
import { buildTableView } from "./views/table";

interface AppWithSettings extends App {
  setting: { open: () => void; openTabById: (id: string) => void };
}

export class ZiBaseTableRenderer implements ZiBaseHost {
  app: App;
  plugin: ZiBasePluginLike;

  constructor(app: App, plugin: ZiBasePluginLike) {
    this.app = app;
    this.plugin = plugin;
  }

  processReadingView(element: HTMLElement, context: MarkdownPostProcessorContext): void {
    element.querySelectorAll("table").forEach((table) => this.tryRenderTable(table, context));
  }

  tryRenderTable(table: HTMLTableElement, context: MarkdownPostProcessorContext): void {
    const sectionInfo = context.getSectionInfo(table);
    if (!sectionInfo) return;
    const lines = sectionInfo.text.split("\n").slice(sectionInfo.lineStart, sectionInfo.lineEnd + 1);
    const schema = parseZiBaseSchema(lines, this.plugin.settings.columnRules);
    if (!schema) return;
    if (schema.inferred && !this.plugin.settings.inferSchema) return;
    table.replaceWith(this.buildRichTable(schema, lines, context, sectionInfo));
  }

  buildRichTable(
    schema: TableSchema,
    lines: string[],
    context: MarkdownPostProcessorContext,
    sectionInfo: MarkdownSectionInformation,
  ): HTMLElement {
    let currentView: ViewName | string = "table";
    let collapsed = false;
    let filterQuery = "";
    let sortColIdx: number | null = null;
    let sortAsc = true;
    const rawDataLines = lines.slice(schema.dataStartIndex);

    const viewAnnotation = parseViewAnnotation(lines);
    if (viewAnnotation) currentView = viewAnnotation.view;

    const getDataRows = () => rawDataLines.filter(isDataRow);
    const wrapper = createDiv();
    wrapper.className = "zibase-wrapper";
    const topbar = wrapper.createDiv("zibase-topbar");
    const collapseBtn = topbar.createEl("button", { cls: "zibase-collapse-btn" });
    collapseBtn.empty();
    collapseBtn.insertAdjacentHTML(
      "beforeend",
      `<svg width="9" height="9" viewBox="0 0 9 9"><path d="M1.5 1.5 L7.5 4.5 L1.5 7.5 Z" fill="currentColor"/></svg>`,
    );
    const topLeft = topbar.createDiv("zibase-topbar-left");
    topLeft.createSpan({ text: "⟁", cls: "zibase-logo" });
    const zibaseName = topLeft.createSpan({ text: "ZiBase", cls: "zibase-name zibase-name-btn" });
    const badge = topLeft.createSpan({
      cls: schema.inferred ? "zibase-inferred-badge" : "zibase-annotated-badge",
      text: schema.inferred ? "inferred" : "annotated",
    });
    const topRight = topbar.createDiv("zibase-topbar-right");
    const searchWrap = topRight.createDiv("zibase-search-wrap");
    searchWrap.empty();
    searchWrap.insertAdjacentHTML(
      "beforeend",
      `<svg class="zibase-search-icon" width="11" height="11" viewBox="0 0 16 16"><circle cx="6.5" cy="6.5" r="5" stroke="currentColor" stroke-width="1.5" fill="none"/><line x1="10.5" y1="10.5" x2="14" y2="14" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>`,
    );
    const searchInput = searchWrap.createEl("input", { cls: "zibase-search", type: "text" });
    searchInput.placeholder = "Filter…";
    zibaseName.addEventListener("click", (e) => {
      e.stopPropagation();
      this.showZiBaseMenu(e, schema, lines, context, sectionInfo, rawDataLines, badge, currentView, (newView) => {
        currentView = newView;
        renderViewContent();
      });
    });
    const body = wrapper.createDiv("zibase-body");

    const footer = body.createDiv("zibase-footer");
    const addRowBtn = footer.createEl("button", { cls: "zibase-add-row-btn" });
    addRowBtn.empty();
    addRowBtn.insertAdjacentHTML(
      "beforeend",
      `<svg width="10" height="10" viewBox="0 0 10 10"><line x1="5" y1="1" x2="5" y2="9" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/><line x1="1" y1="5" x2="9" y2="5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg> Add row`,
    );
    addRowBtn.addEventListener("click", async () => await this.addRow(context, sectionInfo, schema));
    const rowCount = footer.createSpan({ cls: "zibase-row-count" });
    const updateCount = () => {
      const total = getDataRows().length;
      const visible = filterQuery
        ? getDataRows().filter((l) => splitRow(l).some((c) => c.toLowerCase().includes(filterQuery.toLowerCase()))).length
        : total;
      rowCount.textContent = filterQuery && visible !== total ? `${visible} / ${total} rows` : `${total} rows`;
    };

    const renderViewContent = () => {
      body.querySelectorAll(".zibase-table, .zibase-kanban, .zibase-gallery, .zibase-calendar").forEach((el) => el.remove());
      const viewContainer = createDiv();
      switch (currentView) {
        case "kanban":
          buildKanbanView(this, viewContainer, schema, getDataRows, rawDataLines, context, sectionInfo, filterQuery);
          break;
        case "gallery":
          buildGalleryView(this, viewContainer, schema, getDataRows, rawDataLines, context, sectionInfo, filterQuery);
          break;
        case "calendar":
          buildCalendarView(this, viewContainer, schema, getDataRows, rawDataLines, context, sectionInfo, filterQuery);
          break;
        default:
          buildTableView(
            this,
            viewContainer,
            schema,
            getDataRows,
            rawDataLines,
            context,
            sectionInfo,
            filterQuery,
            sortColIdx,
            sortAsc,
            badge,
            (col, asc) => {
              sortColIdx = col;
              sortAsc = asc;
            },
          );
          break;
      }
      while (viewContainer.firstChild) {
        body.insertBefore(viewContainer.firstChild, footer);
      }
    };

    renderViewContent();
    updateCount();
    collapseBtn.addEventListener("click", () => {
      collapsed = !collapsed;
      body.classList.toggle("zibase-body-collapsed", collapsed);
      collapseBtn.classList.toggle("zibase-collapsed", collapsed);
    });
    searchInput.addEventListener("input", () => {
      filterQuery = searchInput.value.trim();
      renderViewContent();
      updateCount();
    });
    return wrapper;
  }

  showZiBaseMenu(
    e: MouseEvent,
    schema: TableSchema,
    lines: string[],
    context: MarkdownPostProcessorContext,
    sectionInfo: MarkdownSectionInformation,
    _rawDataLines: string[],
    _badge: HTMLElement,
    currentView: ViewName | string,
    onViewChange: (view: string) => void,
  ): void {
    document.querySelectorAll(".zibase-dropdown").forEach((m) => m.remove());
    const menu = createDiv();
    menu.className = "zibase-dropdown";
    const target = e.target as HTMLElement;
    const rect = target.getBoundingClientRect();
    menu.setCssStyles({ top: `${rect.bottom + window.scrollY + 4}px` });
    menu.setCssStyles({ left: `${rect.left + window.scrollX}px` });
    const controller = new AbortController();
    const closeMenu = () => {
      menu.remove();
      controller.abort();
    };

    const exportItem = menu.createDiv("zibase-dropdown-item zibase-dropdown-has-sub");
    exportItem.createSpan({ text: "Export", cls: "zibase-dropdown-label" });
    exportItem.createSpan({ text: "▶", cls: "zibase-dropdown-arrow" });
    const exportSub = exportItem.createDiv("zibase-dropdown-sub");
    const exportOptions = [
      { icon: "📋", label: "Copy as Markdown", action: () => this.copyAsMarkdown(schema, lines) },
      { icon: "📤", label: "Export as CSV", action: () => void this.exportCSV(schema, lines, context) },
      { icon: "🗄️", label: "Export as JSON", action: () => void this.exportJSON(schema, lines, context) },
    ];
    exportOptions.forEach(({ icon, label, action }) => {
      const item = exportSub.createDiv("zibase-dropdown-subitem");
      item.createSpan({ text: icon, cls: "zibase-dropdown-icon" });
      item.createSpan({ text: label });
      item.addEventListener("click", () => {
        closeMenu();
        action();
      });
    });

    const viewItem = menu.createDiv("zibase-dropdown-item zibase-dropdown-has-sub");
    viewItem.createSpan({ text: "View", cls: "zibase-dropdown-label" });
    viewItem.createSpan({ text: "▶", cls: "zibase-dropdown-arrow" });
    const viewSub = viewItem.createDiv("zibase-dropdown-sub");
    const viewOptions = [
      { icon: "📊", label: "Table", view: "table" },
      { icon: "📋", label: "Kanban", view: "kanban" },
      { icon: "🖼️", label: "Gallery", view: "gallery" },
      { icon: "📅", label: "Calendar", view: "calendar" },
    ];
    viewOptions.forEach(({ icon, label, view }) => {
      const item = viewSub.createDiv("zibase-dropdown-subitem");
      item.createSpan({ text: icon, cls: "zibase-dropdown-icon" });
      item.createSpan({ text: label });
      if (currentView === view) {
        item.classList.add("zibase-menu-active");
        item.createSpan({ text: " ✓", cls: "zibase-view-check" });
      }
      item.addEventListener("click", () => {
        closeMenu();
        if (currentView !== view) {
          onViewChange(view);
          void this.persistViewAnnotation(context, sectionInfo, view);
        }
      });
    });

    const rulesItem = menu.createDiv("zibase-dropdown-item zibase-dropdown-has-sub");
    rulesItem.createSpan({ text: "Column Name Rules", cls: "zibase-dropdown-label" });
    rulesItem.createSpan({ text: "▶", cls: "zibase-dropdown-arrow" });
    const rulesSub = rulesItem.createDiv("zibase-dropdown-sub zibase-rules-sub");
    this.renderRulesPanel(rulesSub);

    const settingsItem = menu.createDiv("zibase-dropdown-item");
    settingsItem.createSpan({ text: "⚙️", cls: "zibase-dropdown-icon" });
    settingsItem.createSpan({ text: "Open Settings", cls: "zibase-dropdown-label" });
    settingsItem.addEventListener("click", () => {
      closeMenu();
      const app = this.app as AppWithSettings;
      app.setting.open();
      app.setting.openTabById("zibase");
    });
    document.body.appendChild(menu);
    window.setTimeout(() => {
      document.addEventListener("click", (ev) => {
        if (!menu.contains(ev.target as Node)) closeMenu();
      }, { signal: controller.signal });
    }, 10);
  }

  async persistViewAnnotation(
    context: MarkdownPostProcessorContext,
    sectionInfo: MarkdownSectionInformation,
    view: string,
  ): Promise<void> {
    const file = this.app.vault.getAbstractFileByPath(context.sourcePath);
    if (!(file instanceof TFile)) return;
    await this.app.vault.process(file, (content) => {
      const allLines = content.split("\n");
      const searchStart = Math.max(0, sectionInfo.lineStart - 1);
      for (let i = searchStart; i <= Math.min(sectionInfo.lineStart, allLines.length - 1); i++) {
        if (VIEW_ANNOTATION_RE.test(allLines[i])) {
          if (view === "table") allLines.splice(i, 1);
          else allLines[i] = `<!-- zibase-view: ${view} -->`;
          return allLines.join("\n");
        }
      }
      if (view !== "table") {
        allLines.splice(sectionInfo.lineStart, 0, `<!-- zibase-view: ${view} -->`);
      }
      return allLines.join("\n");
    });
  }

  renderRulesPanel(container: HTMLElement): void {
    container.empty();
    const title = container.createDiv("zibase-rules-title");
    title.textContent = "Column → Type rules";
    this.plugin.settings.columnRules.forEach((rule, idx) => {
      const row = container.createDiv("zibase-rules-row");
      const nameInput = row.createEl("input", { type: "text", cls: "zibase-rules-name", value: rule.name });
      nameInput.placeholder = "name";
      nameInput.addEventListener("change", async () => {
        this.plugin.settings.columnRules[idx].name = nameInput.value.trim();
        await this.plugin.saveSettings();
      });
      row.createSpan({ text: "→", cls: "zibase-rules-arrow" });
      const typeSelect = row.createEl("select", { cls: "zibase-rules-type" });
      COLUMN_TYPE_OPTIONS.forEach((t) => {
        const opt = typeSelect.createEl("option", { text: t, value: t });
        if (t === rule.type) opt.selected = true;
      });
      typeSelect.addEventListener("change", async () => {
        this.plugin.settings.columnRules[idx].type = typeSelect.value;
        await this.plugin.saveSettings();
      });
      const removeBtn = row.createEl("button", { text: "×", cls: "zibase-rules-remove" });
      removeBtn.addEventListener("click", async () => {
        this.plugin.settings.columnRules.splice(idx, 1);
        await this.plugin.saveSettings();
        this.renderRulesPanel(container);
      });
    });
    const addRow = container.createDiv("zibase-rules-add");
    const addBtn = addRow.createEl("button", { text: "+ Add rule", cls: "zibase-rules-add-btn" });
    addBtn.addEventListener("click", async () => {
      this.plugin.settings.columnRules.push({ name: "", type: "label" });
      await this.plugin.saveSettings();
      this.renderRulesPanel(container);
    });
  }

  copyAsMarkdown(schema: TableSchema, lines: string[]): void {
    const dataRows = lines.slice(schema.dataStartIndex).filter(isDataRow);
    const header = "| " + schema.columns.map((c) => c.name).join(" | ") + " |";
    const separator = "| " + schema.columns.map(() => "---").join(" | ") + " |";
    const rows = dataRows.map((line) => {
      const cells = splitRow(line);
      return "| " + schema.columns.map((_, i) => cells[i] ?? "").join(" | ") + " |";
    });
    void navigator.clipboard.writeText([header, separator, ...rows].join("\n"));
    showToast("📋 Copied as Markdown!");
  }

  async exportCSV(schema: TableSchema, lines: string[], context: MarkdownPostProcessorContext): Promise<void> {
    const dataRows = lines.slice(schema.dataStartIndex).filter(isDataRow);
    const escape = (v: string) => `"${v.replace(/"/g, '""')}"`;
    const header = schema.columns.map((c) => escape(c.name)).join(",");
    const rows = dataRows.map((line) => {
      const cells = splitRow(line);
      return schema.columns.map((_, i) => escape((cells[i] ?? "").trim())).join(",");
    });
    const noteName = context.sourcePath.replace(/\.md$/, "");
    await this.saveFile(noteName + ".csv", [header, ...rows].join("\n"), context);
    showToast("📤 Exported as CSV!");
  }

  async exportJSON(schema: TableSchema, lines: string[], context: MarkdownPostProcessorContext): Promise<void> {
    const dataRows = lines.slice(schema.dataStartIndex).filter(isDataRow);
    const records = dataRows.map((line) => {
      const cells = splitRow(line);
      const obj: Record<string, string | boolean | number | null> = {};
      schema.columns.forEach((col, i) => {
        const raw = (cells[i] ?? "").trim();
        if (col.type.kind === "toggle") obj[col.name] = parseBool(raw);
        else if (col.type.kind === "number") obj[col.name] = raw ? parseFloat(raw) : null;
        else obj[col.name] = raw;
      });
      return obj;
    });
    const noteName = context.sourcePath.replace(/\.md$/, "");
    await this.saveFile(noteName + ".json", JSON.stringify(records, null, 2), context);
    showToast("🗄️ Exported as JSON!");
  }

  async saveFile(filename: string, content: string, context: MarkdownPostProcessorContext): Promise<void> {
    const file = this.app.vault.getAbstractFileByPath(context.sourcePath);
    if (!(file instanceof TFile)) return;
    const folder = file.parent?.path ?? "";
    const baseName = filename.split("/").pop() ?? filename;
    const fullPath = folder ? `${folder}/${baseName}` : baseName;
    const existing = this.app.vault.getAbstractFileByPath(fullPath);
    if (existing instanceof TFile) await this.app.vault.modify(existing, content);
    else await this.app.vault.create(fullPath, content);
  }

  showTypeMenu(
    e: MouseEvent,
    colIdx: number,
    schema: TableSchema,
    context: MarkdownPostProcessorContext,
    sectionInfo: MarkdownSectionInformation,
    _rawDataLines: string[],
    badge: HTMLElement,
  ): void {
    document.querySelectorAll(".zibase-context-menu").forEach((m) => m.remove());
    const menu = createDiv();
    menu.className = "zibase-context-menu";
    const x = Math.min(e.clientX, window.innerWidth - 160);
    menu.setCssStyles({ top: `${e.clientY + window.scrollY}px` });
    menu.setCssStyles({ left: `${x}px` });
    const types = [
      { label: "Text", icon: "T", kind: "text" },
      { label: "Toggle", icon: "⬜", kind: "toggle" },
      { label: "Select", icon: "▾", kind: "select" },
      { label: "Label", icon: "⬡", kind: "label" },
      { label: "Multi-select", icon: "🏷️", kind: "multi-select" },
      { label: "Number", icon: "#", kind: "number" },
      { label: "Date", icon: "📅", kind: "date" },
      { label: "Formula", icon: "ƒ", kind: "formula" },
    ] as const;
    menu.createDiv("zibase-menu-title").textContent = schema.columns[colIdx]?.name ?? "Column";
    const controller = new AbortController();
    const closeMenu = () => {
      menu.remove();
      controller.abort();
    };
    types.forEach(({ label, icon, kind }) => {
      const item = menu.createDiv("zibase-menu-item");
      item.createSpan({ text: icon, cls: "zibase-menu-icon" });
      item.createSpan({ text: label, cls: "zibase-menu-label" });
      if (schema.columns[colIdx]?.type.kind === kind) item.classList.add("zibase-menu-active");
      item.addEventListener("click", async () => {
        closeMenu();
        if (kind === "select") {
          const currentOpts = schema.columns[colIdx]?.type.kind === "select" ? schema.columns[colIdx].type.options : [];
          new SelectOptionsModal(
            this.app,
            schema.columns[colIdx]?.name ?? "Column",
            currentOpts,
            async (opts) => {
              await this.writeColumnType(context, sectionInfo, schema, colIdx, `select:${opts.join(",")}`, badge);
            },
          ).open();
        } else if (kind === "formula") {
          const colName = schema.columns[colIdx]?.name;
          const currentExpr = schema.columns[colIdx]?.type.kind === "formula" ? schema.columns[colIdx].type.expression : "";
          new FormulaInputModal(this.app, colName || "Column", currentExpr, schema.columns, async (expr) => {
            await this.writeColumnType(context, sectionInfo, schema, colIdx, `formula:${expr}`, badge);
          }).open();
        } else {
          await this.writeColumnType(context, sectionInfo, schema, colIdx, kind, badge);
        }
      });
    });
    document.body.appendChild(menu);
    window.setTimeout(() => {
      document.addEventListener("click", (ev) => {
        if (!menu.contains(ev.target as Node)) closeMenu();
      }, { signal: controller.signal });
    }, 10);
  }

  async writeColumnType(
    context: MarkdownPostProcessorContext,
    sectionInfo: MarkdownSectionInformation,
    schema: TableSchema,
    colIdx: number,
    typeStr: string,
    badge: HTMLElement,
  ): Promise<void> {
    const file = this.app.vault.getAbstractFileByPath(context.sourcePath);
    if (!(file instanceof TFile)) return;
    await this.app.vault.process(file, (content) => {
      const allLines = content.split("\n");
      if (schema.inferred) {
        const annotationCells = schema.columns.map((col, i) => {
          if (i === colIdx) return ` <!-- zibase: ${typeStr} --> `;
          if (col.type.kind === "formula") return ` <!-- zibase: formula:${col.type.expression} --> `;
          return ` <!-- zibase: ${col.type.kind} --> `;
        });
        allLines.splice(sectionInfo.lineStart + 2, 0, "| " + annotationCells.join(" | ") + " |");
        window.setTimeout(() => {
          badge.textContent = "annotated";
          badge.className = "zibase-annotated-badge";
        }, 50);
      } else if (schema.schemaRowIndex !== null) {
        const cells = splitRow(allLines[sectionInfo.lineStart + schema.schemaRowIndex]);
        cells[colIdx] = ` <!-- zibase: ${typeStr} --> `;
        allLines[sectionInfo.lineStart + schema.schemaRowIndex] = serializeRow(cells);
      }
      return allLines.join("\n");
    });
  }

  renderCell(
    td: HTMLTableCellElement,
    col: Column,
    rawValue: string,
    context: MarkdownPostProcessorContext,
    schema: TableSchema,
    rowCells: string[],
    onChange: CellChangeHandler,
  ): void {
    renderCell(this, td, col, rawValue, context, schema, rowCells, onChange);
  }

  async writeBack(
    context: MarkdownPostProcessorContext,
    sectionInfo: MarkdownSectionInformation,
    tableRowIndex: number,
    colIndex: number,
    newValue: string,
  ): Promise<void> {
    const file = this.app.vault.getAbstractFileByPath(context.sourcePath);
    if (!(file instanceof TFile)) return;
    await this.app.vault.process(file, (content) => {
      const allLines = content.split("\n");
      const fileLineIndex = sectionInfo.lineStart + tableRowIndex;
      const targetLine = allLines[fileLineIndex];
      if (!targetLine) return content;
      const cells = splitRow(targetLine);
      cells[colIndex] = ` ${newValue} `;
      allLines[fileLineIndex] = serializeRow(cells);
      return allLines.join("\n");
    });
  }

  async addRow(
    context: MarkdownPostProcessorContext,
    sectionInfo: MarkdownSectionInformation,
    schema: TableSchema,
  ): Promise<void> {
    const file = this.app.vault.getAbstractFileByPath(context.sourcePath);
    if (!(file instanceof TFile)) return;
    await this.app.vault.process(file, (content) => {
      const allLines = content.split("\n");
      allLines.splice(sectionInfo.lineEnd + 1, 0, serializeRow(schema.columns.map(() => "   ")));
      return allLines.join("\n");
    });
  }

  async rerenderTextCell(td: HTMLElement, newRaw: string, context: MarkdownPostProcessorContext): Promise<void> {
    td.dataset.raw = newRaw;
    const displaySpan = td.querySelector(".zibase-text-rendered");
    if (!displaySpan) return;
    displaySpan.empty();
    if (newRaw) {
      await MarkdownRenderer.renderMarkdown(newRaw, displaySpan as HTMLElement, context.sourcePath, this.plugin);
      window.setTimeout(() => {
        displaySpan.querySelectorAll("a").forEach((a) => attachLinkTooltip(a));
      }, 50);
      displaySpan.classList.remove("zibase-text-empty");
    } else {
      displaySpan.textContent = "—";
      displaySpan.classList.add("zibase-text-empty");
    }
  }
}
