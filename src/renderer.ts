
import * as import_obsidian from "obsidian";


let LABEL_COLORS = [
  "#4ade80",
  "#60a5fa",
  "#f472b6",
  "#fb923c",
  "#a78bfa",
  "#34d399",
  "#fbbf24",
  "#f87171",
  "#38bdf8",
  "#c084fc",
  "#86efac",
  "#67e8f9",
  "#fdba74",
  "#a3e635",
  "#e879f9",
  "#22d3ee",
  "#ff6b6b",
  "#ffd93d",
  "#6bcb77",
  "#4d96ff"
];
function hashStr(str) {
  let h = 5381;
  for (let i = 0; i < str.length; i++) {
    h = (h << 5) + h ^ str.charCodeAt(i);
    h = h >>> 0;
  }
  return h;
}
function getLabelColor(value) {
  return LABEL_COLORS[hashStr(value.trim().toLowerCase()) % LABEL_COLORS.length];
}
let SelectOptionsModal = class extends import_obsidian.Modal {
  constructor(app, colName, currentOptions, onSubmit) {
    super(app);
    this.colName = colName;
    this.currentOptions = [...currentOptions];
    this.onSubmit = onSubmit;
  }
  onOpen() {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass("zibase-modal");
    contentEl.createEl("h3", { text: `Options for "${this.colName}"`, cls: "zibase-modal-title" });
    const chipsWrap = contentEl.createDiv("zibase-modal-chips");
    const renderChips = () => {
      chipsWrap.empty();
      this.currentOptions.forEach((opt, i) => {
        const chip = chipsWrap.createDiv("zibase-modal-chip");
        chip.createSpan({ text: opt });
        const x = chip.createSpan({ text: "\xD7", cls: "zibase-chip-remove" });
        x.addEventListener("click", () => {
          this.currentOptions.splice(i, 1);
          renderChips();
        });
      });
    };
    renderChips();
    const inputRow = contentEl.createDiv("zibase-modal-input-row");
    const input = inputRow.createEl("input", { type: "text", cls: "zibase-modal-input" });
    input.placeholder = "Add option\u2026";
    const addBtn = inputRow.createEl("button", { text: "Add", cls: "zibase-modal-add-btn" });
    const addOption = () => {
      const val = input.value.trim();
      if (val && !this.currentOptions.includes(val)) {
        this.currentOptions.push(val);
        renderChips();
        input.value = "";
        input.focus();
      }
    };
    addBtn.addEventListener("click", addOption);
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        addOption();
      }
      if (e.key === "Escape")
        this.close();
    });
    const applyBtn = contentEl.createEl("button", { text: "Apply", cls: "zibase-modal-apply-btn" });
    applyBtn.addEventListener("click", () => {
      if (this.currentOptions.length > 0) {
        this.onSubmit(this.currentOptions);
        this.close();
      }
    });
    window.setTimeout(() => input.focus(), 50);
  }
  onClose() {
    this.contentEl.empty();
  }
};
export let ZiBaseTableRenderer = class {
  constructor(app, plugin) {
    this._stylesInjected = false;
    this.app = app;
    this.plugin = plugin;
  }
  processReadingView(element, context) {
    element.querySelectorAll("table").forEach((table) => this.tryRenderTable(table, context));
  }
  tryRenderTable(table, context) {
    const sectionInfo = context.getSectionInfo(table);
    if (!sectionInfo)
      return;
    const lines = sectionInfo.text.split("\n").slice(sectionInfo.lineStart, sectionInfo.lineEnd + 1);
    const schema = parseZiBaseSchema(lines, this.plugin.settings.columnRules);
    if (!schema)
      return;
    table.replaceWith(this.buildRichTable(schema, lines, context, sectionInfo));
  }
  buildRichTable(schema, lines, context, sectionInfo) {
    if (!schema)
      return createDiv();
    let currentView = "table";
    let collapsed = false, filterQuery = "", sortColIdx = null, sortAsc = true;
    const rawDataLines = lines.slice(schema.dataStartIndex);

    // Check for persisted view annotation
    const viewAnnotation = parseViewAnnotation(lines);
    if (viewAnnotation) {
      currentView = viewAnnotation.view;
    }

    const getDataRows = () => rawDataLines.filter((l) => l.trim() && l.includes("|") && !/<!--\s*zibase:/.test(l) && !/<!--\s*zibase-view:/.test(l));
    const wrapper = createDiv();
    wrapper.className = "zibase-wrapper";
    const topbar = wrapper.createDiv("zibase-topbar");
    const collapseBtn = topbar.createEl("button", { cls: "zibase-collapse-btn" });
    collapseBtn.empty(); collapseBtn.insertAdjacentHTML("beforeend", `<svg width="9" height="9" viewBox="0 0 9 9"><path d="M1.5 1.5 L7.5 4.5 L1.5 7.5 Z" fill="currentColor"/></svg>`);
    const topLeft = topbar.createDiv("zibase-topbar-left");
    topLeft.createSpan({ text: "\u27C1", cls: "zibase-logo" });
    const zibaseName = topLeft.createSpan({ text: "ZiBase", cls: "zibase-name zibase-name-btn" });
    const badge = topLeft.createSpan({
      cls: schema.inferred ? "zibase-inferred-badge" : "zibase-annotated-badge",
      text: schema.inferred ? "inferred" : "annotated"
    });
    const topRight = topbar.createDiv("zibase-topbar-right");
    const searchWrap = topRight.createDiv("zibase-search-wrap");
    searchWrap.empty(); searchWrap.insertAdjacentHTML("beforeend", `<svg class="zibase-search-icon" width="11" height="11" viewBox="0 0 16 16"><circle cx="6.5" cy="6.5" r="5" stroke="currentColor" stroke-width="1.5" fill="none"/><line x1="10.5" y1="10.5" x2="14" y2="14" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>`);
    const searchInput = searchWrap.createEl("input", { cls: "zibase-search", type: "text" });
    searchInput.placeholder = "Filter\u2026";
    zibaseName.addEventListener("click", (e) => {
      e.stopPropagation();
      this.showZiBaseMenu(e, schema, lines, context, sectionInfo, rawDataLines, badge, wrapper, currentView, (newView) => {
        currentView = newView;
        renderViewContent();
      });
    });
    const body = wrapper.createDiv("zibase-body");

    // Create footer FIRST so it stays at the bottom after re-renders
    const footer = body.createDiv("zibase-footer");
    const addRowBtn = footer.createEl("button", { cls: "zibase-add-row-btn" });
    addRowBtn.empty(); addRowBtn.insertAdjacentHTML("beforeend", `<svg width="10" height="10" viewBox="0 0 10 10"><line x1="5" y1="1" x2="5" y2="9" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/><line x1="1" y1="5" x2="9" y2="5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg> Add row`);
    addRowBtn.addEventListener("click", async () => await this.addRow(context, sectionInfo, schema));
    const rowCount = footer.createSpan({ cls: "zibase-row-count" });
    const updateCount = () => {
      const total = getDataRows().length;
      const visible = filterQuery ? getDataRows().filter((l) => splitRow(l).some((c) => c.toLowerCase().includes(filterQuery.toLowerCase()))).length : total;
      rowCount.textContent = filterQuery && visible !== total ? `${visible} / ${total} rows` : `${total} rows`;
    };

    // ─── View Rendering Dispatcher ────────────────────────────────────────────
    const renderViewContent = () => {
      body.querySelectorAll(".zibase-table, .zibase-kanban, .zibase-gallery, .zibase-calendar").forEach(el => el.remove());

      // Create a container for the view content, inserted BEFORE footer
      const viewContainer = createDiv();
      switch (currentView) {
        case "kanban":
          this.buildKanbanView(viewContainer, schema, getDataRows, rawDataLines, context, sectionInfo, filterQuery);
          break;
        case "gallery":
          this.buildGalleryView(viewContainer, schema, getDataRows, rawDataLines, context, sectionInfo, filterQuery);
          break;
        case "calendar":
          this.buildCalendarView(viewContainer, schema, getDataRows, rawDataLines, context, sectionInfo, filterQuery);
          break;
        default:
          this.buildTableView(viewContainer, schema, getDataRows, rawDataLines, context, sectionInfo, filterQuery, sortColIdx, sortAsc, badge, (col, asc) => {
            sortColIdx = col;
            sortAsc = asc;
          });
          break;
      }
      // Move children from container into body, before footer
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
    this.injectStyles();
    return wrapper;
  }

  // ─── Table View (existing, extracted) ─────────────────────────────────────────
  buildTableView(body, schema, getDataRows, rawDataLines, context, sectionInfo, filterQuery, sortColIdx, sortAsc, badge, onSortChange) {
    const tableEl = body.createEl("table", { cls: "zibase-table" });
    const thead = tableEl.createEl("thead");
    const headerRow = thead.createEl("tr");
    let statModes = {};
    schema.columns.forEach((col, colIdx) => {
      const th = headerRow.createEl("th", { cls: "zibase-th" });
      th.draggable = true;
      th.addEventListener("dragstart", (e) => { e.stopPropagation(); e.dataTransfer.setData("text/col", colIdx.toString()); });
      th.addEventListener("dragover", (e) => { e.preventDefault(); th.setCssStyles({ borderLeft: "2px solid var(--interactive-accent)" }); });
      th.addEventListener("dragleave", () => { th.setCssStyles({ borderLeft: "" }); });
      th.addEventListener("dragend", () => { thead.querySelectorAll(".zibase-th").forEach(el => el.setCssStyles({ borderLeft: "") }); });
      th.addEventListener("drop", async (e) => {
        e.preventDefault(); e.stopPropagation();
        th.setCssStyles({ borderLeft: "" });
        const fromColStr = e.dataTransfer.getData("text/col");
        if (!fromColStr) return;
        const fromColIdx = parseInt(fromColStr, 10);
        if (fromColIdx === colIdx) return;
        const file = this.app.vault.getAbstractFileByPath(context.sourcePath);
        if (!file) return;
        await this.app.vault.process(file, (content) => {
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
      });
      const thInner = th.createDiv("zibase-th-inner");
      thInner.createSpan({ text: col.name, cls: "zibase-th-name" });
      thInner.createSpan({ text: getTypeIcon(col.type), cls: "zibase-type-icon" });
      thInner.createSpan({ cls: "zibase-sort-arrow", text: "\u2195" });

      // ─── Inline stats badge for number/formula columns ──────────────
      if (col.type.kind === "number" || col.type.kind === "formula") {
        if (!statModes[colIdx]) statModes[colIdx] = "SUM";
        const statBadge = th.createDiv("zibase-th-stat");

        const updateThStat = () => {
          let dataRows = getDataRows();
          if (filterQuery) {
            const q = filterQuery.toLowerCase();
            dataRows = dataRows.filter((line) => splitRow(line).some((cell) => cell.toLowerCase().includes(q)));
          }
          const values = dataRows.map(line => {
            let _a;
            const v = ((_a = splitRow(line)[colIdx]) != null ? _a : "").trim();
            return parseFloat(v);
          }).filter(n => !isNaN(n));

          if (values.length === 0) {
            statBadge.textContent = "";
            return;
          }

          const mode = statModes[colIdx];
          let result;
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
          e.stopPropagation(); // Don't trigger sort
          const modes = ["SUM", "AVG", "MIN", "MAX"];
          const current = modes.indexOf(statModes[colIdx]);
          statModes[colIdx] = modes[(current + 1) % modes.length];
          updateThStat();
        });

        // Store updater for re-render after sort/filter
        th._updateStat = updateThStat;
        updateThStat();
      }

      th.addEventListener("click", () => {
        const newAsc = sortColIdx === colIdx ? !sortAsc : true;
        onSortChange(colIdx, newAsc);
        thead.querySelectorAll(".zibase-sort-arrow").forEach((el, i) => {
          el.textContent = i === colIdx ? newAsc ? "\u2191" : "\u2193" : "\u2195";
          el.classList.toggle("zibase-sort-active", i === colIdx);
        });
        renderRows();
        // Refresh stats after sort (in case filter changed visible rows)
        thead.querySelectorAll(".zibase-th").forEach(thEl => {
          if (thEl._updateStat) thEl._updateStat();
        });
      });
      th.addEventListener("contextmenu", (e) => {
        e.preventDefault();
        this.showTypeMenu(e, colIdx, schema, context, sectionInfo, lines_unused, rawDataLines, badge);
      });
    });
    const tbody = tableEl.createEl("tbody");
    // We need lines for showTypeMenu — store reference via closure
    let lines_unused = [];

    const renderRows = () => {
      let _a, _b;
      tbody.empty();
      let dataRows = getDataRows();
      if (filterQuery) {
        const q = filterQuery.toLowerCase();
        dataRows = dataRows.filter((line) => splitRow(line).some((cell) => cell.toLowerCase().includes(q)));
      }
      if (sortColIdx !== null) {
        const idx = sortColIdx;
        const colType = (_b = (_a = schema.columns[idx]) == null ? void 0 : _a.type.kind) != null ? _b : "text";
        dataRows = [...dataRows].sort((a, b) => {
          let _a2, _b2;
          const av = ((_a2 = splitRow(a)[idx]) != null ? _a2 : "").trim(), bv = ((_b2 = splitRow(b)[idx]) != null ? _b2 : "").trim();
          if (colType === "number" || colType === "formula") {
            const na = parseFloat(av), nb = parseFloat(bv);
            if (!isNaN(na) && !isNaN(nb))
              return sortAsc ? na - nb : nb - na;
          }
          if (colType === "date") {
            const da = new Date(av).getTime(), db = new Date(bv).getTime();
            if (!isNaN(da) && !isNaN(db))
              return sortAsc ? da - db : db - da;
          }
          if (colType === "toggle") {
            const ba = av.toLowerCase() === "true" ? 1 : 0, bb = bv.toLowerCase() === "true" ? 1 : 0;
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
          e.dataTransfer.setData("text/row", rawIdx.toString());
          tr.setCssStyles({ opacity: "0.5" });
        });
        tr.addEventListener("dragend", () => {
          tr.setCssStyles({ opacity: "1" });
          tbody.querySelectorAll(".zibase-row").forEach(el => el.setCssStyles({ borderTop: "") });
        });
        tr.addEventListener("dragover", (e) => {
          e.preventDefault();
          tr.setCssStyles({ borderTop: "2px solid var(--interactive-accent)" });
        });
        tr.addEventListener("dragleave", () => {
          tr.setCssStyles({ borderTop: "" });
        });
        tr.addEventListener("drop", async (e) => {
          e.preventDefault();
          e.stopPropagation();
          tr.setCssStyles({ borderTop: "" });
          const fromIdxStr = e.dataTransfer.getData("text/row");
          if (!fromIdxStr) return;
          const fromIdx = parseInt(fromIdxStr, 10);
          const toIdx = rawIdx;
          if (fromIdx !== toIdx) {
            const file = this.app.vault.getAbstractFileByPath(context.sourcePath);
            if (!file) return;
            await this.app.vault.process(file, (content) => {
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
          }
        });
        schema.columns.forEach((col, colIdx) => {
          let _a2;
          const td = tr.createEl("td", { cls: "zibase-td" });
          const rawValue = (_a2 = cells[colIdx]) != null ? _a2 : "";
          this.renderCell(td, col, rawValue, context, schema, cells, async (newValue) => {
            if (rawIdx !== -1) {
              const updatedCells = splitRow(rawDataLines[rawIdx]);
              updatedCells[colIdx] = ` ${newValue} `;
              rawDataLines[rawIdx] = serializeRow(updatedCells);
            }
            await this.writeBack(context, sectionInfo, schema.dataStartIndex + rawIdx, colIdx, newValue);
          });
        });
      });
    };
    renderRows();
  }

  // ─── Kanban View ──────────────────────────────────────────────────────────────
  buildKanbanView(body, schema, getDataRows, rawDataLines, context, sectionInfo, filterQuery) {
    // Find the first select or label column to group by
    const groupCol = schema.columns.find(c => c.type.kind === "select" || c.type.kind === "label");
    if (!groupCol) {
      const notice = body.createDiv("zibase-kanban zibase-kanban-notice");
      notice.textContent = "Kanban requires a Select or Label column to group by.";
      return;
    }

    const kanban = body.createDiv("zibase-kanban");
    let dataRows = getDataRows();
    if (filterQuery) {
      const q = filterQuery.toLowerCase();
      dataRows = dataRows.filter((line) => splitRow(line).some((cell) => cell.toLowerCase().includes(q)));
    }

    // Gather unique group values
    const groups = new Map();
    dataRows.forEach(line => {
      let _a;
      const cells = splitRow(line);
      const groupValue = ((_a = cells[groupCol.index]) != null ? _a : "").trim() || "—";
      if (!groups.has(groupValue)) groups.set(groupValue, []);
      groups.get(groupValue).push({ line, cells });
    });

    // If select type, use defined options order; otherwise use found order
    let groupKeys;
    if (groupCol.type.kind === "select" && groupCol.type.options) {
      groupKeys = [...groupCol.type.options];
      // Add any values not in options
      for (const key of groups.keys()) {
        if (!groupKeys.includes(key)) groupKeys.push(key);
      }
    } else {
      groupKeys = [...groups.keys()];
    }

    const laneContainer = kanban.createDiv("zibase-kanban-lanes");

    groupKeys.forEach(groupValue => {
      const items = groups.get(groupValue) || [];
      const lane = laneContainer.createDiv("zibase-kanban-lane");
      const color = getLabelColor(groupValue);

      // Lane header
      const header = lane.createDiv("zibase-kanban-lane-header");
      header.style.setProperty("--lane-color", color);
      const headerLabel = header.createSpan({ text: groupValue, cls: "zibase-kanban-lane-title" });
      headerLabel.setCssStyles({ color: color });
      header.createSpan({ text: `${items.length}`, cls: "zibase-kanban-lane-count" });

      // Lane body (droppable)
      const laneBody = lane.createDiv("zibase-kanban-lane-body");
      laneBody.dataset.group = groupValue;

      // Drop zone
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
        const fromIdxStr = e.dataTransfer.getData("text/kanban-row");
        if (!fromIdxStr) return;
        const fromIdx = parseInt(fromIdxStr, 10);
        // Update the group column value in the markdown
        await this.writeBack(context, sectionInfo, schema.dataStartIndex + fromIdx, groupCol.index, groupValue);
      });

      items.forEach(({ line, cells }) => {
        const rawIdx = rawDataLines.findIndex((l) => l === line);
        const card = laneBody.createDiv("zibase-kanban-card");
        card.draggable = true;
        card.addEventListener("dragstart", (e) => {
          e.dataTransfer.setData("text/kanban-row", rawIdx.toString());
          card.classList.add("zibase-kanban-card-dragging");
        });
        card.addEventListener("dragend", () => {
          card.classList.remove("zibase-kanban-card-dragging");
        });

        // Card content — first text column as title, others as fields
        schema.columns.forEach((col, colIdx) => {
          if (colIdx === groupCol.index) return; // skip group column
          let _a;
          const rawValue = ((_a = cells[colIdx]) != null ? _a : "").trim();
          if (!rawValue) return;

          if (col.type.kind === "text") {
            // First text col = title — render markdown for wikilinks
            if (!card.querySelector(".zibase-kanban-card-title")) {
              const titleEl = card.createDiv("zibase-kanban-card-title");
              import_obsidian.MarkdownRenderer.renderMarkdown(rawValue, titleEl, context.sourcePath, this.plugin);
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

        // If no title was found, use the first cell
        if (!card.querySelector(".zibase-kanban-card-title")) {
          const titleEl = createDiv();
          titleEl.className = "zibase-kanban-card-title";
          import_obsidian.MarkdownRenderer.renderMarkdown(cells[0] || "—", titleEl, context.sourcePath, this.plugin);
          card.insertBefore(titleEl, card.firstChild);
        }
      });
    });
  }

  // ─── Gallery View ─────────────────────────────────────────────────────────────
  buildGalleryView(body, schema, getDataRows, rawDataLines, context, sectionInfo, filterQuery) {
    const gallery = body.createDiv("zibase-gallery");
    let dataRows = getDataRows();
    if (filterQuery) {
      const q = filterQuery.toLowerCase();
      dataRows = dataRows.filter((line) => splitRow(line).some((cell) => cell.toLowerCase().includes(q)));
    }

    if (dataRows.length === 0) {
      const empty = gallery.createDiv("zibase-empty");
      empty.textContent = filterQuery ? "No matching rows" : "No data";
      return;
    }

    const grid = gallery.createDiv("zibase-gallery-grid");

    dataRows.forEach(line => {
      const cells = splitRow(line);
      const card = grid.createDiv("zibase-gallery-card");

      // Title — first text column (render markdown for wikilinks)
      const titleCol = schema.columns.find(c => c.type.kind === "text");
      const titleValue = titleCol ? (cells[titleCol.index] || "").trim() : (cells[0] || "").trim();
      const titleDiv = card.createDiv({ cls: "zibase-gallery-card-title" });
      import_obsidian.MarkdownRenderer.renderMarkdown(titleValue || "—", titleDiv, context.sourcePath, this.plugin);

      // Fields
      const fieldsWrap = card.createDiv("zibase-gallery-card-fields");
      schema.columns.forEach((col, colIdx) => {
        // Skip title column
        if (titleCol && colIdx === titleCol.index) return;
        let _a;
        const rawValue = ((_a = cells[colIdx]) != null ? _a : "").trim();
        if (!rawValue && col.type.kind !== "toggle") return;

        const field = fieldsWrap.createDiv("zibase-gallery-field");

        if (col.type.kind === "toggle") {
          field.createSpan({ text: parseBool(rawValue) ? "✅" : "⬜" });
          field.createSpan({ text: " " + col.name, cls: "zibase-gallery-field-name" });
        } else if (col.type.kind === "label") {
          const chip = field.createSpan({ text: rawValue, cls: "zibase-label" });
          chip.style.setProperty("--lc", getLabelColor(rawValue));
        } else if (col.type.kind === "select") {
          field.createSpan({ text: rawValue, cls: "zibase-gallery-field-select" });
        } else if (col.type.kind === "date") {
          field.createSpan({ text: "📅 ", cls: "zibase-gallery-field-icon" });
          field.createSpan({ text: rawValue, cls: "zibase-date-rendered" });
        } else if (col.type.kind === "number" || col.type.kind === "formula") {
          field.createSpan({ text: col.name + ": ", cls: "zibase-gallery-field-name" });
          field.createSpan({ text: rawValue, cls: "zibase-gallery-field-value" });
        } else {
          field.createSpan({ text: rawValue, cls: "zibase-gallery-field-value" });
        }
      });
    });
  }

  // ─── Calendar View ────────────────────────────────────────────────────────────
  buildCalendarView(body, schema, getDataRows, rawDataLines, context, sectionInfo, filterQuery) {
    const dateCol = schema.columns.find(c => c.type.kind === "date");
    if (!dateCol) {
      const notice = body.createDiv("zibase-calendar zibase-calendar-notice");
      notice.textContent = "Calendar requires a Date column.";
      return;
    }

    const calendar = body.createDiv("zibase-calendar");
    let currentDate = new Date();
    let currentMonth = currentDate.getMonth();
    let currentYear = currentDate.getFullYear();

    const renderCalendar = () => {
      calendar.empty();

      // Nav header
      const nav = calendar.createDiv("zibase-calendar-nav");
      const prevBtn = nav.createEl("button", { text: "◀", cls: "zibase-calendar-nav-btn" });
      const monthLabel = nav.createSpan({ cls: "zibase-calendar-month-label" });
      monthLabel.textContent = new Date(currentYear, currentMonth).toLocaleString('default', { month: 'long', year: 'numeric' });
      const nextBtn = nav.createEl("button", { text: "▶", cls: "zibase-calendar-nav-btn" });

      prevBtn.addEventListener("click", () => {
        currentMonth--;
        if (currentMonth < 0) { currentMonth = 11; currentYear--; }
        renderCalendar();
      });
      nextBtn.addEventListener("click", () => {
        currentMonth++;
        if (currentMonth > 11) { currentMonth = 0; currentYear++; }
        renderCalendar();
      });

      // Day headers
      const dayHeaders = calendar.createDiv("zibase-calendar-day-headers");
      ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].forEach(d => {
        dayHeaders.createSpan({ text: d, cls: "zibase-calendar-day-header" });
      });

      // Grid
      const grid = calendar.createDiv("zibase-calendar-grid");
      const firstDay = new Date(currentYear, currentMonth, 1);
      const lastDay = new Date(currentYear, currentMonth + 1, 0);
      const totalDays = lastDay.getDate();

      // Day of week (Mon=0, Sun=6)
      let startDow = firstDay.getDay() - 1;
      if (startDow < 0) startDow = 6;

      // Get data
      let dataRows = getDataRows();
      if (filterQuery) {
        const q = filterQuery.toLowerCase();
        dataRows = dataRows.filter((line) => splitRow(line).some((cell) => cell.toLowerCase().includes(q)));
      }

      // Map date → entries
      const dateMap = new Map();
      dataRows.forEach(line => {
        const cells = splitRow(line);
        const dateStr = (cells[dateCol.index] || "").trim();
        if (!dateStr) return;
        if (!dateMap.has(dateStr)) dateMap.set(dateStr, []);
        // Get a display value — first text column
        const titleCol = schema.columns.find(c => c.type.kind === "text");
        const title = titleCol ? (cells[titleCol.index] || "").trim() : (cells[0] || "").trim();
        const labelCol = schema.columns.find(c => c.type.kind === "label" || c.type.kind === "select");
        const label = labelCol ? (cells[labelCol.index] || "").trim() : null;
        dateMap.get(dateStr).push({ title, label, line });
      });

      const today = new Date();
      const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

      // Blank cells before first day
      for (let i = 0; i < startDow; i++) {
        grid.createDiv("zibase-calendar-cell zibase-calendar-cell-empty");
      }

      // Day cells
      for (let d = 1; d <= totalDays; d++) {
        const dateStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
        const cell = grid.createDiv("zibase-calendar-cell");
        if (dateStr === todayStr) cell.classList.add("zibase-calendar-today");

        cell.createSpan({ text: String(d), cls: "zibase-calendar-day-num" });

        const entries = dateMap.get(dateStr) || [];
        entries.forEach(entry => {
          const pill = cell.createDiv("zibase-calendar-entry");
          import_obsidian.MarkdownRenderer.renderMarkdown(entry.title || "—", pill, context.sourcePath, this.plugin);
          if (entry.label) {
            pill.style.setProperty("--lc", getLabelColor(entry.label));
            pill.classList.add("zibase-calendar-entry-colored");
          }
        });

        // Click empty date → add row with date pre-filled
        if (entries.length === 0) {
          cell.addEventListener("click", async () => {
            const file = this.app.vault.getAbstractFileByPath(context.sourcePath);
            if (!file) return;
            await this.app.vault.process(file, (content) => {
              const allLines = content.split("\n");
              const newCells = schema.columns.map(col => {
                if (col.index === dateCol.index) return ` ${dateStr} `;
                return "   ";
              });
              allLines.splice(sectionInfo.lineEnd + 1, 0, serializeRow(newCells));
              return allLines.join("\n");
            });
          });
          cell.classList.add("zibase-calendar-cell-clickable");
        }
      }
    };

    renderCalendar();
  }

  // ─── ZiBase dropdown menu ──────────────────────────────────────────────────
  showZiBaseMenu(e, schema, lines, context, sectionInfo, rawDataLines, badge, wrapper, currentView, onViewChange) {
    document.querySelectorAll(".zibase-dropdown").forEach((m) => m.remove());
    const menu = createDiv();
    menu.className = "zibase-dropdown";
    const target = e.target;
    const rect = target.getBoundingClientRect();
    menu.setCssStyles({ top: `${rect.bottom + window.scrollY + 4}px` });
    menu.setCssStyles({ left: `${rect.left + window.scrollX}px` });
    const controller = new AbortController();
    const closeMenu = () => {
      menu.remove();
      controller.abort();
    };

    // Export submenu
    const exportItem = menu.createDiv("zibase-dropdown-item zibase-dropdown-has-sub");
    exportItem.createSpan({ text: "Export", cls: "zibase-dropdown-label" });
    exportItem.createSpan({ text: "\u25B6", cls: "zibase-dropdown-arrow" });
    const exportSub = exportItem.createDiv("zibase-dropdown-sub");
    const exportOptions = [
      { icon: "\u{1F4CB}", label: "Copy as Markdown", action: () => this.copyAsMarkdown(schema, lines) },
      { icon: "\u{1F4E4}", label: "Export as CSV", action: () => this.exportCSV(schema, lines, context) },
      { icon: "\u{1F5C4}\uFE0F", label: "Export as JSON", action: () => this.exportJSON(schema, lines, context) }
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

    // ─── View submenu (NEW) ────────────────────────────────────────────────────
    const viewItem = menu.createDiv("zibase-dropdown-item zibase-dropdown-has-sub");
    viewItem.createSpan({ text: "View", cls: "zibase-dropdown-label" });
    viewItem.createSpan({ text: "\u25B6", cls: "zibase-dropdown-arrow" });
    const viewSub = viewItem.createDiv("zibase-dropdown-sub");

    const viewOptions = [
      { icon: "📊", label: "Table", view: "table" },
      { icon: "📋", label: "Kanban", view: "kanban" },
      { icon: "🖼️", label: "Gallery", view: "gallery" },
      { icon: "📅", label: "Calendar", view: "calendar" }
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
          // Persist view annotation
          this.persistViewAnnotation(context, sectionInfo, view, schema);
        }
      });
    });

    // Column Name Rules submenu
    const rulesItem = menu.createDiv("zibase-dropdown-item zibase-dropdown-has-sub");
    rulesItem.createSpan({ text: "Column Name Rules", cls: "zibase-dropdown-label" });
    rulesItem.createSpan({ text: "\u25B6", cls: "zibase-dropdown-arrow" });
    const rulesSub = rulesItem.createDiv("zibase-dropdown-sub zibase-rules-sub");
    this.renderRulesPanel(rulesSub);

    // Settings
    const settingsItem = menu.createDiv("zibase-dropdown-item");
    settingsItem.createSpan({ text: "\u2699\uFE0F", cls: "zibase-dropdown-icon" });
    settingsItem.createSpan({ text: "Open Settings", cls: "zibase-dropdown-label" });
    settingsItem.addEventListener("click", () => {
      closeMenu();
      this.app.setting.open();
      this.app.setting.openTabById("zibase");
    });
    document.body.appendChild(menu);
    window.setTimeout(() => {
      document.addEventListener("click", (ev) => {
        if (!menu.contains(ev.target))
          closeMenu();
      }, { signal: controller.signal });
    }, 10);
  }

  // ─── Persist view annotation ───────────────────────────────────────────────
  async persistViewAnnotation(context, sectionInfo, view, schema) {
    const file = this.app.vault.getAbstractFileByPath(context.sourcePath);
    if (!file) return;
    await this.app.vault.process(file, (content) => {
      const allLines = content.split("\n");
      // Check if a view annotation already exists near the table
      const searchStart = Math.max(0, sectionInfo.lineStart - 1);
      for (let i = searchStart; i <= Math.min(sectionInfo.lineStart, allLines.length - 1); i++) {
        if (VIEW_ANNOTATION_RE.test(allLines[i])) {
          if (view === "table") {
            // Remove annotation for default table view
            allLines.splice(i, 1);
          } else {
            allLines[i] = `<!-- zibase-view: ${view} -->`;
          }
          return allLines.join("\n");
        }
      }
      // No existing annotation — insert one before the table (if not default table view)
      if (view !== "table") {
        allLines.splice(sectionInfo.lineStart, 0, `<!-- zibase-view: ${view} -->`);
      }
      return allLines.join("\n");
    });
  }

  renderRulesPanel(container) {
    container.empty();
    const TYPE_OPTIONS = ["text", "toggle", "select", "label", "number", "date", "formula"];
    const title = container.createDiv("zibase-rules-title");
    title.textContent = "Column \u2192 Type rules";
    this.plugin.settings.columnRules.forEach((rule, idx) => {
      const row = container.createDiv("zibase-rules-row");
      const nameInput = row.createEl("input", { type: "text", cls: "zibase-rules-name", value: rule.name });
      nameInput.placeholder = "name";
      nameInput.addEventListener("change", async () => {
        this.plugin.settings.columnRules[idx].name = nameInput.value.trim();
        await this.plugin.saveSettings();
      });
      row.createSpan({ text: "\u2192", cls: "zibase-rules-arrow" });
      const typeSelect = row.createEl("select", { cls: "zibase-rules-type" });
      TYPE_OPTIONS.forEach((t) => {
        const opt = typeSelect.createEl("option", { text: t, value: t });
        if (t === rule.type)
          opt.selected = true;
      });
      typeSelect.addEventListener("change", async () => {
        this.plugin.settings.columnRules[idx].type = typeSelect.value;
        await this.plugin.saveSettings();
      });
      const removeBtn = row.createEl("button", { text: "\xD7", cls: "zibase-rules-remove" });
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
  // ─── Export functions ──────────────────────────────────────────────────────
  copyAsMarkdown(schema, lines) {
    const dataRows = lines.slice(schema.dataStartIndex).filter((l) => l.trim() && l.includes("|") && !/<!--\s*zibase:/.test(l));
    const header = "| " + schema.columns.map((c) => c.name).join(" | ") + " |";
    const separator = "| " + schema.columns.map(() => "---").join(" | ") + " |";
    const rows = dataRows.map((line) => {
      const cells = splitRow(line);
      return "| " + schema.columns.map((_, i) => {
        let _a;
        return (_a = cells[i]) != null ? _a : "";
      }).join(" | ") + " |";
    });
    const md = [header, separator, ...rows].join("\n");
    navigator.clipboard.writeText(md);
    this.showToast("\u{1F4CB} Copied as Markdown!");
  }
  async exportCSV(schema, lines, context) {
    const dataRows = lines.slice(schema.dataStartIndex).filter((l) => l.trim() && l.includes("|") && !/<!--\s*zibase:/.test(l));
    const escape = (v) => `"${v.replace(/"/g, '""')}"`;
    const header = schema.columns.map((c) => escape(c.name)).join(",");
    const rows = dataRows.map((line) => {
      const cells = splitRow(line);
      return schema.columns.map((_, i) => {
        let _a;
        return escape(((_a = cells[i]) != null ? _a : "").trim());
      }).join(",");
    });
    const csv = [header, ...rows].join("\n");
    const noteName = context.sourcePath.replace(/\.md$/, "");
    await this.saveFile(noteName + ".csv", csv, context);
    this.showToast("\u{1F4E4} Exported as CSV!");
  }
  async exportJSON(schema, lines, context) {
    const dataRows = lines.slice(schema.dataStartIndex).filter((l) => l.trim() && l.includes("|") && !/<!--\s*zibase:/.test(l));
    const records = dataRows.map((line) => {
      const cells = splitRow(line);
      const obj = {};
      schema.columns.forEach((col, i) => {
        let _a;
        const raw = ((_a = cells[i]) != null ? _a : "").trim();
        if (col.type.kind === "toggle")
          obj[col.name] = parseBool(raw);
        else if (col.type.kind === "number")
          obj[col.name] = raw ? parseFloat(raw) : null;
        else
          obj[col.name] = raw;
      });
      return obj;
    });
    const json = JSON.stringify(records, null, 2);
    const noteName = context.sourcePath.replace(/\.md$/, "");
    await this.saveFile(noteName + ".json", json, context);
    this.showToast("\u{1F5C4}\uFE0F Exported as JSON!");
  }
  async saveFile(filename, content, context) {
    let _a, _b, _c;
    const file = this.app.vault.getAbstractFileByPath(context.sourcePath);
    if (!file)
      return;
    const folder = (_b = (_a = file.parent) == null ? void 0 : _a.path) != null ? _b : "";
    const baseName = (_c = filename.split("/").pop()) != null ? _c : filename;
    const fullPath = folder ? `${folder}/${baseName}` : baseName;
    const existing = this.app.vault.getAbstractFileByPath(fullPath);
    if (existing)
      await this.app.vault.modify(existing, content);
    else
      await this.app.vault.create(fullPath, content);
  }
  showToast(message) {
    const toast = createDiv();
    toast.className = "zibase-toast";
    toast.textContent = message;
    document.body.appendChild(toast);
    window.setTimeout(() => toast.classList.add("zibase-toast-show"), 10);
    window.setTimeout(() => {
      toast.classList.remove("zibase-toast-show");
      window.setTimeout(() => toast.remove(), 300);
    }, 2500);
  }
  // ─── Right-click type menu ─────────────────────────────────────────────────
  showTypeMenu(e, colIdx, schema, context, sectionInfo, lines, rawDataLines, badge) {
    let _a, _b;
    document.querySelectorAll(".zibase-context-menu").forEach((m) => m.remove());
    const menu = createDiv();
    menu.className = "zibase-context-menu";
    const x = Math.min(e.clientX, window.innerWidth - 160);
    menu.setCssStyles({ top: `${e.clientY + window.scrollY}px` });
    menu.setCssStyles({ left: `${x}px` });
    const types = [
      { label: "Text", icon: "T", kind: "text" },
      { label: "Toggle", icon: "\u2B1C", kind: "toggle" },
      { label: "Select", icon: "\u25BE", kind: "select" },
      { label: "Label", icon: "\u2B21", kind: "label" },
      { label: "Number", icon: "#", kind: "number" },
      { label: "Date", icon: "\u{1F4C5}", kind: "date" },
      { label: "Formula", icon: "ƒ", kind: "formula" }
    ];
    menu.createDiv("zibase-menu-title").textContent = (_b = (_a = schema.columns[colIdx]) == null ? void 0 : _a.name) != null ? _b : "Column";
    const controller = new AbortController();
    const closeMenu = () => {
      menu.remove();
      controller.abort();
    };
    types.forEach(({ label, icon, kind }) => {
      let _a2;
      const item = menu.createDiv("zibase-menu-item");
      item.createSpan({ text: icon, cls: "zibase-menu-icon" });
      item.createSpan({ text: label, cls: "zibase-menu-label" });
      if (((_a2 = schema.columns[colIdx]) == null ? void 0 : _a2.type.kind) === kind)
        item.classList.add("zibase-menu-active");
      item.addEventListener("click", async () => {
        let _a3, _b2, _c;
        closeMenu();
        if (kind === "select") {
          const currentOpts = ((_a3 = schema.columns[colIdx]) == null ? void 0 : _a3.type.kind) === "select" ? schema.columns[colIdx].type.options : [];
          new SelectOptionsModal(this.app, (_c = (_b2 = schema.columns[colIdx]) == null ? void 0 : _b2.name) != null ? _c : "Column", currentOpts, async (opts) => {
            await this.writeColumnType(context, sectionInfo, schema, colIdx, `select:${opts.join(",")}`, lines, badge);
          }).open();
        } else if (kind === "formula") {
          // Prompt for formula expression
          const colName = (_b2 = schema.columns[colIdx]) == null ? void 0 : _b2.name;
          const currentExpr = ((_a3 = schema.columns[colIdx]) == null ? void 0 : _a3.type.kind) === "formula" ? schema.columns[colIdx].type.expression : "";
          new FormulaInputModal(this.app, colName || "Column", currentExpr, schema.columns, async (expr) => {
            await this.writeColumnType(context, sectionInfo, schema, colIdx, `formula:${expr}`, lines, badge);
          }).open();
        } else {
          await this.writeColumnType(context, sectionInfo, schema, colIdx, kind, lines, badge);
        }
      });
    });
    document.body.appendChild(menu);
    window.setTimeout(() => {
      document.addEventListener("click", (ev) => {
        if (!menu.contains(ev.target))
          closeMenu();
      }, { signal: controller.signal });
    }, 10);
  }
  async writeColumnType(context, sectionInfo, schema, colIdx, typeStr, lines, badge) {
    const file = this.app.vault.getAbstractFileByPath(context.sourcePath);
    if (!file)
      return;
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
      } else {
        const cells = splitRow(allLines[sectionInfo.lineStart + schema.schemaRowIndex]);
        cells[colIdx] = ` <!-- zibase: ${typeStr} --> `;
        allLines[sectionInfo.lineStart + schema.schemaRowIndex] = serializeRow(cells);
      }
      return allLines.join("\n");
    });
  }
  // ─── Cell Renderer ─────────────────────────────────────────────────────────
  renderCell(td, col, rawValue, context, schema, rowCells, onChange) {
    switch (col.type.kind) {
      case "toggle": {
        const checked = parseBool(rawValue);
        const label = td.createEl("label", { cls: "zibase-toggle-label" });
        const input = label.createEl("input", { type: "checkbox" });
        input.checked = checked;
        input.className = "zibase-toggle-input";
        label.createDiv("zibase-toggle-track").createDiv("zibase-toggle-thumb");
        input.addEventListener("change", async () => await onChange(serializeBool(input.checked)));
        break;
      }
      case "select": {
        const select = td.createEl("select", { cls: "zibase-select" });
        select.createEl("option", { value: "", text: "\u2014" });
        col.type.options.forEach((opt) => {
          const o = select.createEl("option", { text: opt, value: opt });
          if (opt === rawValue.trim())
            o.selected = true;
        });
        if (!rawValue.trim())
          select.options[0].selected = true;
        select.addEventListener("change", async () => await onChange(select.value));
        break;
      }
      case "label": {
        const chip = td.createEl("span", { text: rawValue.trim() || "\u2014", cls: "zibase-label" });
        chip.style.setProperty("--lc", getLabelColor(rawValue.trim()));
        chip.addEventListener("click", () => startLabelEdit(chip, rawValue.trim(), onChange));
        break;
      }
      case "number": {
        const input = td.createEl("input", { type: "number", cls: "zibase-number" });
        input.value = rawValue.trim();
        let debounce;
        input.addEventListener("input", () => {
          window.clearTimeout(debounce);
          debounce = window.setTimeout(async () => await onChange(input.value), 400);
        });
        break;
      }
      case "date": {
        const val = rawValue.trim();
        const displaySpan = td.createSpan({ text: val || "\u2014", cls: val ? "zibase-date-rendered" : "zibase-text-empty" });
        td.addEventListener("click", () => {
          if (td.querySelector("input")) return;
          displaySpan.setCssStyles({ display: "none" });
          const input = td.createEl("input", { type: "date", cls: "zibase-date" });
          input.value = val;
          input.focus();
          if (typeof input.showPicker === "function") {
            try { input.showPicker(); } catch (_e) { /* ignored */ }
          }
          const commit = async () => {
            const newVal = input.value;
            input.remove();
            displaySpan.textContent = newVal || "\u2014";
            displaySpan.className = newVal ? "zibase-date-rendered" : "zibase-text-empty";
            displaySpan.setCssStyles({ display: "" });
            await onChange(newVal);
          };
          input.addEventListener("blur", commit);
          input.addEventListener("keydown", (e) => {
            if (e.key === "Enter") commit();
            if (e.key === "Escape") { input.remove(); displaySpan.setCssStyles({ display: "" }); }
          });
        });
        break;
      }
      case "formula": {
        // ─── Formula cell rendering ────────────────────────────────────────
        const val = rawValue.trim();

        // Check for backtick mode → show as plain text
        if (isBackticked(val)) {
          const plainText = stripBackticks(val);
          td.createSpan({ text: plainText, cls: "zibase-formula-source" });
          break;
        }

        // Check if cell has raw math (e.g., "5*10") → auto compute
        if (isSimpleMath(val)) {
          const result = evaluateSimpleMath(val);
          td.createSpan({ text: formatResult(result), cls: "zibase-formula-result" });
          span.title = val; // tooltip shows the expression
          break;
        }

        // Compute from column formula expression
        if (col.type.expression) {
          // Build row data map (case-insensitive keys)
          const rowData = {};
          schema.columns.forEach((c, i) => {
            let _a;
            rowData[c.name] = ((_a = rowCells[i]) != null ? _a : "").trim();
          });
          const result = evaluateFormula(col.type.expression, rowData);
          const displayVal = formatResult(result);
          td.createSpan({ text: displayVal, cls: "zibase-formula-result" });
          span.title = `ƒ ${col.type.expression} = ${displayVal}`;
        } else {
          // No expression defined — show raw value or placeholder
          td.createSpan({ text: val || "ƒ", cls: "zibase-formula-empty" });
        }
        break;
      }
      default: {
        const val = rawValue.trim();
        td.dataset.raw = val;

        // Check for inline math in text cells too
        if (isSimpleMath(val)) {
          const result = evaluateSimpleMath(val);
          td.createSpan({ text: formatResult(result), cls: "zibase-formula-result zibase-text-rendered" });
          span.title = val;
          // Still allow editing
          td.addEventListener("click", (e) => {
            e.preventDefault();
            e.stopPropagation();
            startMarkdownEdit(td, td.dataset.raw || val, context, this, onChange);
          });
          break;
        }

        // Check for backtick in text cell
        if (isBackticked(val)) {
          const plainText = stripBackticks(val);
          td.createSpan({ text: plainText, cls: "zibase-formula-source zibase-text-rendered" });
          td.addEventListener("click", (e) => {
            e.preventDefault();
            e.stopPropagation();
            startMarkdownEdit(td, td.dataset.raw || val, context, this, onChange);
          });
          break;
        }

        const displaySpan = td.createSpan({ cls: "zibase-text-rendered" });
        if (val) {
          import_obsidian.MarkdownRenderer.renderMarkdown(val, displaySpan, context.sourcePath, this.plugin).then(() => {
            displaySpan.querySelectorAll("a").forEach((a) => attachLinkTooltip(a));
            displaySpan.querySelectorAll("a").length > 0;
            td.addEventListener("click", (e) => {
              // Alt+Click → always enter edit mode (even on links)
              if (e.altKey) {
                e.preventDefault();
                e.stopPropagation();
                startMarkdownEdit(td, td.dataset.raw || val, context, this, onChange);
                return;
              }
              // Click directly on a link → let Obsidian navigate
              if (e.target && e.target.closest && e.target.closest("a")) {
                return;
              }
              // Click on non-link content → edit
              e.preventDefault();
              e.stopPropagation();
              startMarkdownEdit(td, td.dataset.raw || val, context, this, onChange);
            }, true);
          });
        } else {
          displaySpan.textContent = "\u2014";
          displaySpan.classList.add("zibase-text-empty");
          td.addEventListener("click", (e) => {
            let _a, _b;
            e.preventDefault();
            e.stopPropagation();
            if (e.altKey || !e.target) {
              startMarkdownEdit(td, (_a = td.dataset.raw) != null ? _a : val, context, this, onChange);
              return;
            }
            startMarkdownEdit(td, (_b = td.dataset.raw) != null ? _b : val, context, this, onChange);
          });
        }
        break;
      }
    }
  }
  // ─── Vault ops ─────────────────────────────────────────────────────────────
  async writeBack(context, sectionInfo, tableRowIndex, colIndex, newValue) {
    const file = this.app.vault.getAbstractFileByPath(context.sourcePath);
    if (!file)
      return;
    await this.app.vault.process(file, (content) => {
      const allLines = content.split("\n");
      const fileLineIndex = sectionInfo.lineStart + tableRowIndex;
      const targetLine = allLines[fileLineIndex];
      if (!targetLine)
        return content;
      const cells = splitRow(targetLine);
      cells[colIndex] = ` ${newValue} `;
      allLines[fileLineIndex] = serializeRow(cells);
      return allLines.join("\n");
    });
  }
  async addRow(context, sectionInfo, schema) {
    const file = this.app.vault.getAbstractFileByPath(context.sourcePath);
    if (!file)
      return;
    await this.app.vault.process(file, (content) => {
      const allLines = content.split("\n");
      allLines.splice(sectionInfo.lineEnd + 1, 0, serializeRow(schema.columns.map(() => "   ")));
      return allLines.join("\n");
    });
  }
  async rerenderTextCell(td, newRaw, context) {
    td.dataset.raw = newRaw;
    const displaySpan = td.querySelector(".zibase-text-rendered");
    if (!displaySpan)
      return;
    displaySpan.empty();
    if (newRaw) {
      await import_obsidian.MarkdownRenderer.renderMarkdown(newRaw, displaySpan, context.sourcePath, this.plugin);
      window.setTimeout(() => {
        displaySpan.querySelectorAll("a").forEach((a) => attachLinkTooltip(a));
      }, 50);
      displaySpan.classList.remove("zibase-text-empty");
    } else {
      displaySpan.textContent = "\u2014";
      displaySpan.classList.add("zibase-text-empty");
    }
  }
  toggleTableAtCursor(editor, view) {
  }
  
};

// ─── Formula Input Modal ────────────────────────────────────────────────────
let FormulaInputModal = class extends import_obsidian.Modal {
  constructor(app, colName, currentExpr, columns, onSubmit) {
    super(app);
    this.colName = colName;
    this.currentExpr = currentExpr;
    this.columns = columns;
    this.onSubmit = onSubmit;
  }
  onOpen() {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass("zibase-modal");
    contentEl.createEl("h3", { text: `Formula for "${this.colName}"`, cls: "zibase-modal-title" });

    contentEl.createEl("p", {
      text: "Use column names to reference values. Case-insensitive.",
      cls: "zibase-settings-desc"
    });

    // Show available columns
    const colList = contentEl.createDiv("zibase-formula-cols");
    colList.createSpan({ text: "Available: ", cls: "zibase-formula-cols-label" });
    this.columns.forEach(col => {
      if (col.name === this.colName) return;
      const chip = colList.createSpan({ text: col.name, cls: "zibase-formula-col-chip" });
      chip.addEventListener("click", () => {
        input.value += col.name;
        input.focus();
      });
    });

    const input = contentEl.createEl("input", { type: "text", cls: "zibase-modal-input" });
    input.value = this.currentExpr;
    input.placeholder = "e.g., Price * Qty";
    input.setCssStyles({ marginTop: "8px" });
    input.setCssStyles({ marginBottom: "12px" });

    const applyBtn = contentEl.createEl("button", { text: "Apply", cls: "zibase-modal-apply-btn" });
    applyBtn.addEventListener("click", () => {
      const expr = input.value.trim();
      if (expr) {
        this.onSubmit(expr);
        this.close();
      }
    });

    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        const expr = input.value.trim();
        if (expr) {
          this.onSubmit(expr);
          this.close();
        }
      }
      if (e.key === "Escape") this.close();
    });

    window.setTimeout(() => { input.focus(); input.select(); }, 50);
  }
  onClose() {
    this.contentEl.empty();
  }
};

function startMarkdownEdit(td, rawValue, context, renderer, onChange) {
  if (td.querySelector(".zibase-inline-input"))
    return;
  const displaySpan = td.querySelector(".zibase-text-rendered");
  if (displaySpan)
    displaySpan.setCssStyles({ display: "none" });
  const input = createEl("input");
  input.className = "zibase-inline-input";
  input.value = rawValue;
  td.appendChild(input);
  input.focus();
  input.select();
  const commit = async () => {
    const newVal = input.value;
    input.remove();
    if (displaySpan)
      displaySpan.setCssStyles({ display: "" });
    await onChange(newVal);
    await renderer.rerenderTextCell(td, newVal, context);
  };
  input.addEventListener("blur", commit);
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      commit();
    }
    if (e.key === "Escape") {
      input.remove();
      if (displaySpan)
        displaySpan.setCssStyles({ display: "" });
    }
  });
}
function attachLinkTooltip(a) {
  let tooltip = null;
  a.addEventListener("mouseenter", () => {
    tooltip = createDiv();
    tooltip.className = "zibase-link-tooltip";
    tooltip.textContent = "Alt+Click to edit";
    document.body.appendChild(tooltip);
    const rect = a.getBoundingClientRect();
    tooltip.setCssStyles({ top: `${rect.bottom + window.scrollY + 4}px` });
    tooltip.setCssStyles({ left: `${rect.left + window.scrollX}px` });
  });
  a.addEventListener("mouseleave", () => {
    tooltip == null ? void 0 : tooltip.remove();
    tooltip = null;
  });
}
function startLabelEdit(chip, current, onChange) {
  const input = createEl("input");
  input.className = "zibase-inline-input";
  input.value = current;
  chip.replaceWith(input);
  input.focus();
  input.select();
  const commit = async () => {
    const newVal = input.value.trim() || current;
    await onChange(newVal);
    chip.textContent = newVal;
    chip.style.setProperty("--lc", getLabelColor(newVal));
    input.replaceWith(chip);
  };
  input.addEventListener("blur", commit);
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter")
      commit();
    if (e.key === "Escape")
      input.replaceWith(chip);
  });
}
function getTypeIcon(type) {
  switch (type.kind) {
    case "toggle":
      return "\u2B1C";
    case "select":
      return "\u25BE";
    case "label":
      return "\u2B21";
    case "number":
      return "#";
    case "date":
      return "\u{1F4C5}";
    case "formula":
      return "ƒ";
    default:
      return "T";
  }
}


