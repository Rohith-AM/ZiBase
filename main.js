/*
THIS IS A GENERATED/COMPILED FILE. TO VIEW THE SOURCE, GO TO src/main.ts
*/

var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);


// src/schema.ts

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


// src/formula.ts

// ─── ZiBase Formula Engine v0.6.0 ── ZIYAL (ழியல்) ──────────────────────────
// Safe math evaluator — NO eval(). Recursive descent parser.
// Supports: +, -, *, /, %, parentheses, column references (case-insensitive)

var FORMULA_NUMBER_RE = /^-?\d+(\.\d+)?$/;

/**
 * Check if a raw cell value is wrapped in backticks → plain text mode
 */
function isBackticked(raw) {
  const trimmed = raw.trim();
  return trimmed.startsWith('`') && trimmed.endsWith('`') && trimmed.length >= 2;
}

/**
 * Strip backticks from a value
 */
function stripBackticks(raw) {
  const trimmed = raw.trim();
  return trimmed.slice(1, -1);
}

/**
 * Check if a raw value looks like simple inline math (e.g. "5*10", "100/4+2")
 * Must contain at least one operator and consist only of numbers/operators/parens/spaces
 */
function isSimpleMath(raw) {
  const trimmed = raw.trim();
  if (!trimmed) return false;
  if (FORMULA_NUMBER_RE.test(trimmed)) return false; // plain number, not math
  // Must only contain digits, operators, parens, dots, spaces
  if (!/^[\d\s+\-*/%().]+$/.test(trimmed)) return false;
  // Must contain at least one operator
  if (!/[+\-*/%]/.test(trimmed)) return false;
  // Shouldn't start with an operator (except minus for negative)
  if (/^[+*/%]/.test(trimmed)) return false;
  return true;
}

/**
 * Evaluate a formula expression with column references resolved from row data.
 * @param expression  The formula expression (e.g. "Price * Qty")
 * @param rowData     Map of column name → raw cell value
 * @returns           Computed number or null on error
 */
function evaluateFormula(expression, rowData) {
  if (!expression || !expression.trim()) return null;

  // Replace column references with their numeric values (case-insensitive)
  let resolved = expression;

  // Sort column names by length (longest first) to avoid partial replacement
  // e.g., "Total Price" should be replaced before "Price"
  const colNames = Object.keys(rowData).sort((a, b) => b.length - a.length);

  for (const colName of colNames) {
    // Case-insensitive replacement of column name with its value
    const regex = new RegExp(escapeRegex(colName), 'gi');
    const rawVal = rowData[colName];
    const numVal = parseFloat(rawVal);

    if (isNaN(numVal)) {
      // If referenced column has non-numeric value, can't compute
      if (regex.test(resolved)) {
        // Check if this column name is actually used in the expression
        const testResolved = resolved.replace(regex, '0');
        if (testResolved !== resolved) {
          return null; // Non-numeric reference → can't evaluate
        }
      }
      continue;
    }

    resolved = resolved.replace(regex, numVal.toString());
  }

  // Now `resolved` should be a pure math expression
  try {
    return safeEval(resolved);
  } catch (e) {
    return null;
  }
}

/**
 * Evaluate a simple math expression (no column refs, just numbers and operators)
 */
function evaluateSimpleMath(expression) {
  try {
    return safeEval(expression);
  } catch (e) {
    return null;
  }
}

/**
 * Format a computed result for display
 */
function formatResult(value) {
  if (value === null || value === undefined || isNaN(value)) return '—';
  if (!isFinite(value)) return '∞';
  // Clean up floating point: show up to 6 decimal places, strip trailing zeros
  const str = parseFloat(value.toFixed(6)).toString();
  return str;
}

// ─── Safe Math Parser (Recursive Descent) ────────────────────────────────────
// Grammar:
//   expr     → term (('+' | '-') term)*
//   term     → unary (('*' | '/' | '%') unary)*
//   unary    → '-' unary | primary
//   primary  → NUMBER | '(' expr ')'

function safeEval(expression) {
  const tokens = tokenize(expression);
  const parser = { tokens, pos: 0 };
  const result = parseExpr(parser);

  // Ensure all tokens were consumed
  if (parser.pos < parser.tokens.length) {
    throw new Error('Unexpected token: ' + parser.tokens[parser.pos].value);
  }

  return result;
}

function tokenize(expr) {
  const tokens = [];
  let i = 0;
  const s = expr.trim();

  while (i < s.length) {
    // Skip whitespace
    if (s[i] === ' ' || s[i] === '\t') {
      i++;
      continue;
    }

    // Number (including decimals)
    if ((s[i] >= '0' && s[i] <= '9') || (s[i] === '.' && i + 1 < s.length && s[i + 1] >= '0' && s[i + 1] <= '9')) {
      let num = '';
      while (i < s.length && ((s[i] >= '0' && s[i] <= '9') || s[i] === '.')) {
        num += s[i];
        i++;
      }
      tokens.push({ type: 'number', value: parseFloat(num) });
      continue;
    }

    // Operators
    if ('+-*/%'.includes(s[i])) {
      tokens.push({ type: 'op', value: s[i] });
      i++;
      continue;
    }

    // Parentheses
    if (s[i] === '(') {
      tokens.push({ type: 'lparen', value: '(' });
      i++;
      continue;
    }
    if (s[i] === ')') {
      tokens.push({ type: 'rparen', value: ')' });
      i++;
      continue;
    }

    throw new Error('Unexpected character: ' + s[i]);
  }

  return tokens;
}

function parseExpr(parser) {
  let left = parseTerm(parser);

  while (parser.pos < parser.tokens.length) {
    const tok = parser.tokens[parser.pos];
    if (tok.type === 'op' && (tok.value === '+' || tok.value === '-')) {
      parser.pos++;
      const right = parseTerm(parser);
      left = tok.value === '+' ? left + right : left - right;
    } else {
      break;
    }
  }

  return left;
}

function parseTerm(parser) {
  let left = parseUnary(parser);

  while (parser.pos < parser.tokens.length) {
    const tok = parser.tokens[parser.pos];
    if (tok.type === 'op' && (tok.value === '*' || tok.value === '/' || tok.value === '%')) {
      parser.pos++;
      const right = parseUnary(parser);
      if (tok.value === '*') left = left * right;
      else if (tok.value === '/') left = right === 0 ? Infinity : left / right;
      else left = left % right;
    } else {
      break;
    }
  }

  return left;
}

function parseUnary(parser) {
  if (parser.pos < parser.tokens.length) {
    const tok = parser.tokens[parser.pos];
    if (tok.type === 'op' && tok.value === '-') {
      parser.pos++;
      return -parseUnary(parser);
    }
    if (tok.type === 'op' && tok.value === '+') {
      parser.pos++;
      return parseUnary(parser);
    }
  }
  return parsePrimary(parser);
}

function parsePrimary(parser) {
  if (parser.pos >= parser.tokens.length) {
    throw new Error('Unexpected end of expression');
  }

  const tok = parser.tokens[parser.pos];

  if (tok.type === 'number') {
    parser.pos++;
    return tok.value;
  }

  if (tok.type === 'lparen') {
    parser.pos++; // consume '('
    const result = parseExpr(parser);
    if (parser.pos >= parser.tokens.length || parser.tokens[parser.pos].type !== 'rparen') {
      throw new Error('Missing closing parenthesis');
    }
    parser.pos++; // consume ')'
    return result;
  }

  throw new Error('Unexpected token: ' + tok.value);
}

// ─── Utilities ───────────────────────────────────────────────────────────────

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// src/renderer.ts

var import_obsidian = require("obsidian");


var LABEL_COLORS = [
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
var SelectOptionsModal = class extends import_obsidian.Modal {
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
    setTimeout(() => input.focus(), 50);
  }
  onClose() {
    this.contentEl.empty();
  }
};
var ZiBaseTableRenderer = class {
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
      return document.createElement("div");
    let currentView = "table";
    let collapsed = false, filterQuery = "", sortColIdx = null, sortAsc = true;
    const rawDataLines = lines.slice(schema.dataStartIndex);

    // Check for persisted view annotation
    const viewAnnotation = parseViewAnnotation(lines);
    if (viewAnnotation) {
      currentView = viewAnnotation.view;
    }

    const getDataRows = () => rawDataLines.filter((l) => l.trim() && l.includes("|") && !/<!--\s*zibase:/.test(l) && !/<!--\s*zibase-view:/.test(l));
    const wrapper = document.createElement("div");
    wrapper.className = "zibase-wrapper";
    const topbar = wrapper.createDiv("zibase-topbar");
    const collapseBtn = topbar.createEl("button", { cls: "zibase-collapse-btn" });
    collapseBtn.innerHTML = `<svg width="9" height="9" viewBox="0 0 9 9"><path d="M1.5 1.5 L7.5 4.5 L1.5 7.5 Z" fill="currentColor"/></svg>`;
    const topLeft = topbar.createDiv("zibase-topbar-left");
    topLeft.createSpan({ text: "\u27C1", cls: "zibase-logo" });
    const zibaseName = topLeft.createSpan({ text: "ZiBase", cls: "zibase-name zibase-name-btn" });
    const badge = topLeft.createSpan({
      cls: schema.inferred ? "zibase-inferred-badge" : "zibase-annotated-badge",
      text: schema.inferred ? "inferred" : "annotated"
    });
    const topRight = topbar.createDiv("zibase-topbar-right");
    const searchWrap = topRight.createDiv("zibase-search-wrap");
    searchWrap.innerHTML = `<svg class="zibase-search-icon" width="11" height="11" viewBox="0 0 16 16"><circle cx="6.5" cy="6.5" r="5" stroke="currentColor" stroke-width="1.5" fill="none"/><line x1="10.5" y1="10.5" x2="14" y2="14" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>`;
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

    // ─── View Rendering Dispatcher ────────────────────────────────────────────
    const renderViewContent = () => {
      body.querySelectorAll(".zibase-table, .zibase-kanban, .zibase-gallery, .zibase-calendar, .zibase-stats-row").forEach(el => el.remove());

      switch (currentView) {
        case "kanban":
          this.buildKanbanView(body, schema, getDataRows, rawDataLines, context, sectionInfo, filterQuery);
          break;
        case "gallery":
          this.buildGalleryView(body, schema, getDataRows, rawDataLines, context, sectionInfo, filterQuery);
          break;
        case "calendar":
          this.buildCalendarView(body, schema, getDataRows, rawDataLines, context, sectionInfo, filterQuery);
          break;
        default:
          this.buildTableView(body, schema, getDataRows, rawDataLines, context, sectionInfo, filterQuery, sortColIdx, sortAsc, badge, (col, asc) => {
            sortColIdx = col;
            sortAsc = asc;
          });
          break;
      }
    };

    renderViewContent();

    const footer = body.createDiv("zibase-footer");
    const addRowBtn = footer.createEl("button", { cls: "zibase-add-row-btn" });
    addRowBtn.innerHTML = `<svg width="10" height="10" viewBox="0 0 10 10"><line x1="5" y1="1" x2="5" y2="9" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/><line x1="1" y1="5" x2="9" y2="5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg> Add row`;
    addRowBtn.addEventListener("click", async () => await this.addRow(context, sectionInfo, schema));
    const rowCount = footer.createSpan({ cls: "zibase-row-count" });
    const updateCount = () => {
      const total = getDataRows().length;
      const visible = filterQuery ? getDataRows().filter((l) => splitRow(l).some((c) => c.toLowerCase().includes(filterQuery.toLowerCase()))).length : total;
      rowCount.textContent = filterQuery && visible !== total ? `${visible} / ${total} rows` : `${total} rows`;
    };
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
    schema.columns.forEach((col, colIdx) => {
      const th = headerRow.createEl("th", { cls: "zibase-th" });
      th.draggable = true;
      th.addEventListener("dragstart", (e) => { e.stopPropagation(); e.dataTransfer.setData("text/col", colIdx.toString()); });
      th.addEventListener("dragover", (e) => { e.preventDefault(); th.style.borderLeft = "2px solid var(--interactive-accent)"; });
      th.addEventListener("dragleave", () => { th.style.borderLeft = ""; });
      th.addEventListener("dragend", () => { thead.querySelectorAll(".zibase-th").forEach(el => el.style.borderLeft = ""); });
      th.addEventListener("drop", async (e) => {
         e.preventDefault(); e.stopPropagation();
         th.style.borderLeft = "";
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
      th.addEventListener("click", () => {
        const newAsc = sortColIdx === colIdx ? !sortAsc : true;
        onSortChange(colIdx, newAsc);
        thead.querySelectorAll(".zibase-sort-arrow").forEach((el, i) => {
          el.textContent = i === colIdx ? newAsc ? "\u2191" : "\u2193" : "\u2195";
          el.classList.toggle("zibase-sort-active", i === colIdx);
        });
        renderRows();
      });
      th.addEventListener("contextmenu", (e) => {
        e.preventDefault();
        this.showTypeMenu(e, colIdx, schema, context, sectionInfo, lines_unused, rawDataLines, badge);
      });
    });
    const tbody = tableEl.createEl("tbody");
    // We need lines for showTypeMenu — store reference via closure
    var lines_unused = [];

    const renderRows = () => {
      var _a, _b;
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
          var _a2, _b2;
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
           tr.style.opacity = "0.5";
        });
        tr.addEventListener("dragend", () => {
           tr.style.opacity = "1";
           tbody.querySelectorAll(".zibase-row").forEach(el => el.style.borderTop = "");
        });
        tr.addEventListener("dragover", (e) => {
           e.preventDefault();
           tr.style.borderTop = "2px solid var(--interactive-accent)";
        });
        tr.addEventListener("dragleave", () => {
           tr.style.borderTop = "";
        });
        tr.addEventListener("drop", async (e) => {
           e.preventDefault();
           e.stopPropagation();
           tr.style.borderTop = "";
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
          var _a2;
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

    // ─── Stats Footer ───────────────────────────────────────────────────────────
    this.buildStatsRow(tableEl, schema, getDataRows, filterQuery);
  }

  // ─── Stats Row ──────────────────────────────────────────────────────────────
  buildStatsRow(tableEl, schema, getDataRows, filterQuery) {
    const hasNumbers = schema.columns.some(c => c.type.kind === "number" || c.type.kind === "formula");
    if (!hasNumbers) return;

    const tfoot = tableEl.createEl("tfoot", { cls: "zibase-stats-foot" });
    const tr = tfoot.createEl("tr", { cls: "zibase-stats-row" });
    const statModes = {};

    schema.columns.forEach((col, colIdx) => {
      const td = tr.createEl("td", { cls: "zibase-stats-td" });
      if (col.type.kind !== "number" && col.type.kind !== "formula") {
        td.textContent = "—";
        td.classList.add("zibase-stats-empty");
        return;
      }

      if (!statModes[colIdx]) statModes[colIdx] = "SUM";

      const renderStat = () => {
        let dataRows = getDataRows();
        if (filterQuery) {
          const q = filterQuery.toLowerCase();
          dataRows = dataRows.filter((line) => splitRow(line).some((cell) => cell.toLowerCase().includes(q)));
        }
        const values = dataRows.map(line => {
          var _a;
          const v = ((_a = splitRow(line)[colIdx]) != null ? _a : "").trim();
          return parseFloat(v);
        }).filter(n => !isNaN(n));

        if (values.length === 0) {
          td.textContent = "—";
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

        td.empty();
        const label = td.createSpan({ text: mode, cls: "zibase-stats-label" });
        td.createSpan({ text: " " + formatResult(result), cls: "zibase-stats-value" });
      };

      td.addEventListener("click", () => {
        const modes = ["SUM", "AVG", "MIN", "MAX"];
        const current = modes.indexOf(statModes[colIdx]);
        statModes[colIdx] = modes[(current + 1) % modes.length];
        renderStat();
      });
      td.style.cursor = "pointer";
      renderStat();
    });
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
      var _a;
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
      headerLabel.style.color = color;
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
          var _a;
          const rawValue = ((_a = cells[colIdx]) != null ? _a : "").trim();
          if (!rawValue) return;

          if (col.type.kind === "text") {
            // First text col = title
            if (!card.querySelector(".zibase-kanban-card-title")) {
              const titleEl = card.createDiv("zibase-kanban-card-title");
              titleEl.textContent = rawValue;
              return;
            }
          }

          const field = card.createDiv("zibase-kanban-card-field");
          const fieldLabel = field.createSpan({ text: col.name, cls: "zibase-kanban-field-label" });

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
          const titleEl = document.createElement("div");
          titleEl.className = "zibase-kanban-card-title";
          titleEl.textContent = cells[0] || "—";
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

      // Title — first text column
      const titleCol = schema.columns.find(c => c.type.kind === "text");
      const titleValue = titleCol ? (cells[titleCol.index] || "").trim() : (cells[0] || "").trim();
      card.createDiv({ text: titleValue || "—", cls: "zibase-gallery-card-title" });

      // Fields
      const fieldsWrap = card.createDiv("zibase-gallery-card-fields");
      schema.columns.forEach((col, colIdx) => {
        // Skip title column
        if (titleCol && colIdx === titleCol.index) return;
        var _a;
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

        const dayNum = cell.createSpan({ text: String(d), cls: "zibase-calendar-day-num" });

        const entries = dateMap.get(dateStr) || [];
        entries.forEach(entry => {
          const pill = cell.createDiv("zibase-calendar-entry");
          pill.textContent = entry.title || "—";
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
    const menu = document.createElement("div");
    menu.className = "zibase-dropdown";
    const target = e.target;
    const rect = target.getBoundingClientRect();
    menu.style.top = `${rect.bottom + window.scrollY + 4}px`;
    menu.style.left = `${rect.left + window.scrollX}px`;
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
    setTimeout(() => {
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
        var _a;
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
        var _a;
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
        var _a;
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
    var _a, _b, _c;
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
    const toast = document.createElement("div");
    toast.className = "zibase-toast";
    toast.textContent = message;
    document.body.appendChild(toast);
    setTimeout(() => toast.classList.add("zibase-toast-show"), 10);
    setTimeout(() => {
      toast.classList.remove("zibase-toast-show");
      setTimeout(() => toast.remove(), 300);
    }, 2500);
  }
  // ─── Right-click type menu ─────────────────────────────────────────────────
  showTypeMenu(e, colIdx, schema, context, sectionInfo, lines, rawDataLines, badge) {
    var _a, _b;
    document.querySelectorAll(".zibase-context-menu").forEach((m) => m.remove());
    const menu = document.createElement("div");
    menu.className = "zibase-context-menu";
    const x = Math.min(e.clientX, window.innerWidth - 160);
    menu.style.top = `${e.clientY + window.scrollY}px`;
    menu.style.left = `${x}px`;
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
      var _a2;
      const item = menu.createDiv("zibase-menu-item");
      item.createSpan({ text: icon, cls: "zibase-menu-icon" });
      item.createSpan({ text: label, cls: "zibase-menu-label" });
      if (((_a2 = schema.columns[colIdx]) == null ? void 0 : _a2.type.kind) === kind)
        item.classList.add("zibase-menu-active");
      item.addEventListener("click", async () => {
        var _a3, _b2, _c;
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
    setTimeout(() => {
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
        setTimeout(() => {
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
          clearTimeout(debounce);
          debounce = setTimeout(async () => await onChange(input.value), 400);
        });
        break;
      }
      case "date": {
        const val = rawValue.trim();
        const displaySpan = td.createSpan({ text: val || "\u2014", cls: val ? "zibase-date-rendered" : "zibase-text-empty" });
        td.addEventListener("click", () => {
          if (td.querySelector("input")) return;
          displaySpan.style.display = "none";
          const input = td.createEl("input", { type: "date", cls: "zibase-date" });
          input.value = val;
          input.focus();
          if (typeof input.showPicker === "function") {
             try { input.showPicker(); } catch(e){}
          }
          const commit = async () => {
             const newVal = input.value;
             input.remove();
             displaySpan.textContent = newVal || "\u2014";
             displaySpan.className = newVal ? "zibase-date-rendered" : "zibase-text-empty";
             displaySpan.style.display = "";
             await onChange(newVal);
          };
          input.addEventListener("blur", commit);
          input.addEventListener("keydown", (e) => {
             if (e.key === "Enter") commit();
             if (e.key === "Escape") { input.remove(); displaySpan.style.display = ""; }
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
          const span = td.createSpan({ text: plainText, cls: "zibase-formula-source" });
          break;
        }

        // Check if cell has raw math (e.g., "5*10") → auto compute
        if (isSimpleMath(val)) {
          const result = evaluateSimpleMath(val);
          const span = td.createSpan({ text: formatResult(result), cls: "zibase-formula-result" });
          span.title = val; // tooltip shows the expression
          break;
        }

        // Compute from column formula expression
        if (col.type.expression) {
          // Build row data map (case-insensitive keys)
          const rowData = {};
          schema.columns.forEach((c, i) => {
            var _a;
            rowData[c.name] = ((_a = rowCells[i]) != null ? _a : "").trim();
          });
          const result = evaluateFormula(col.type.expression, rowData);
          const displayVal = formatResult(result);
          const span = td.createSpan({ text: displayVal, cls: "zibase-formula-result" });
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
          const span = td.createSpan({ text: formatResult(result), cls: "zibase-formula-result zibase-text-rendered" });
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
            const hasLinks = displaySpan.querySelectorAll("a").length > 0;
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
            var _a, _b;
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
      setTimeout(() => {
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
  injectStyles() {
    if (this._stylesInjected)
      return;
    this._stylesInjected = true;
    const existing = document.getElementById("zibase-styles-v6");
    if (existing) existing.remove();
    const style = document.createElement("style");
    style.id = "zibase-styles-v6";
    style.textContent = ZIBASE_CSS;
    document.head.appendChild(style);
  }
};

// ─── Formula Input Modal ────────────────────────────────────────────────────
var FormulaInputModal = class extends import_obsidian.Modal {
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
    input.style.marginTop = "8px";
    input.style.marginBottom = "12px";

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

    setTimeout(() => { input.focus(); input.select(); }, 50);
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
    displaySpan.style.display = "none";
  const input = document.createElement("input");
  input.className = "zibase-inline-input";
  input.value = rawValue;
  td.appendChild(input);
  input.focus();
  input.select();
  const commit = async () => {
    const newVal = input.value;
    input.remove();
    if (displaySpan)
      displaySpan.style.display = "";
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
        displaySpan.style.display = "";
    }
  });
}
function attachLinkTooltip(a) {
  let tooltip = null;
  a.addEventListener("mouseenter", () => {
    tooltip = document.createElement("div");
    tooltip.className = "zibase-link-tooltip";
    tooltip.textContent = "Alt+Click to edit";
    document.body.appendChild(tooltip);
    const rect = a.getBoundingClientRect();
    tooltip.style.top = `${rect.bottom + window.scrollY + 4}px`;
    tooltip.style.left = `${rect.left + window.scrollX}px`;
  });
  a.addEventListener("mouseleave", () => {
    tooltip == null ? void 0 : tooltip.remove();
    tooltip = null;
  });
}
function startLabelEdit(chip, current, onChange) {
  const input = document.createElement("input");
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
var ZIBASE_CSS = `
/* ── ZiBase v0.6.0 ── */
.zibase-wrapper { border: 1px solid var(--background-modifier-border); border-radius: 10px; overflow: hidden; margin: 1.2em 0; font-size: 0.88em; background: var(--background-primary); transition: box-shadow 0.2s; }
.zibase-wrapper:hover { box-shadow: 0 2px 14px rgba(0,0,0,0.08); }
.zibase-topbar { display: flex; align-items: center; gap: 8px; padding: 6px 12px; background: var(--background-secondary); border-bottom: 1px solid var(--background-modifier-border); user-select: none; }
.zibase-collapse-btn { background: none; border: none; cursor: pointer; color: var(--text-muted); padding: 2px 3px; border-radius: 4px; display: flex; align-items: center; transition: color 0.15s, background 0.15s; flex-shrink: 0; }
.zibase-collapse-btn svg { transition: transform 0.2s; }
.zibase-collapse-btn.zibase-collapsed svg { transform: rotate(-90deg); }
.zibase-collapse-btn:hover { color: var(--text-normal); background: var(--background-modifier-hover); }
.zibase-topbar-left { display: flex; align-items: center; gap: 6px; flex: 1; }
.zibase-logo { font-size: 1em; color: var(--interactive-accent); }
.zibase-name { font-size: 0.72em; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; color: var(--text-muted); }
.zibase-name-btn { cursor: pointer; border-radius: 3px; padding: 1px 4px; transition: color 0.15s, background 0.15s; }
.zibase-name-btn:hover { color: var(--interactive-accent); background: color-mix(in srgb, var(--interactive-accent) 10%, transparent); }
.zibase-inferred-badge { font-size: 0.65em; font-weight: 600; letter-spacing: 0.06em; text-transform: uppercase; color: var(--interactive-accent); background: color-mix(in srgb, var(--interactive-accent) 12%, transparent); border: 1px solid color-mix(in srgb, var(--interactive-accent) 30%, transparent); border-radius: 999px; padding: 1px 7px; }
.zibase-annotated-badge { font-size: 0.65em; font-weight: 600; letter-spacing: 0.06em; text-transform: uppercase; color: #4ade80; background: color-mix(in srgb, #4ade80 12%, transparent); border: 1px solid color-mix(in srgb, #4ade80 30%, transparent); border-radius: 999px; padding: 1px 7px; }
.zibase-topbar-right { display: flex; align-items: center; }
.zibase-search-wrap { display: flex; align-items: center; gap: 5px; background: var(--background-modifier-form-field); border: 1px solid var(--background-modifier-border); border-radius: 6px; padding: 3px 8px; opacity: 0; pointer-events: none; transition: opacity 0.15s; width: 130px; }
.zibase-wrapper:hover .zibase-search-wrap { opacity: 1; pointer-events: all; }
.zibase-search-icon { color: var(--text-muted); flex-shrink: 0; }
.zibase-search { background: none; border: none; outline: none; color: var(--text-normal); font-size: 0.82em; width: 100%; padding: 0; }
.zibase-search::placeholder { color: var(--text-faint); }
.zibase-body { overflow-x: auto; transition: max-height 0.25s ease, opacity 0.2s; max-height: 4000px; opacity: 1; }
.zibase-body-collapsed { max-height: 0 !important; opacity: 0; overflow: hidden; }
.zibase-table { width: 100%; border-collapse: collapse; background: var(--background-primary); }
.zibase-th { padding: 8px 14px; text-align: left; font-size: 0.78em; font-weight: 600; letter-spacing: 0.05em; text-transform: uppercase; color: var(--text-muted); background: var(--background-secondary-alt); border-bottom: 1px solid var(--background-modifier-border); white-space: nowrap; cursor: pointer; user-select: none; position: relative; }
.zibase-th:hover { background: var(--background-modifier-hover); }
.zibase-th-inner { display: flex; align-items: center; gap: 5px; }
.zibase-th-name { flex: 1; }
.zibase-type-icon { opacity: 0.4; font-size: 0.85em; }
.zibase-sort-arrow { font-size: 0.85em; opacity: 0; transition: opacity 0.15s; color: var(--text-faint); }
.zibase-th:hover .zibase-sort-arrow, .zibase-sort-arrow.zibase-sort-active { opacity: 1; }
.zibase-sort-arrow.zibase-sort-active { color: var(--interactive-accent); }
.zibase-td { padding: 7px 14px; border-bottom: 1px solid var(--background-modifier-border-hover); vertical-align: middle; }
.zibase-table tr:last-child td { border-bottom: none; }
.zibase-row:hover td { background: var(--background-modifier-hover); }
.zibase-empty { text-align: center; color: var(--text-faint); font-style: italic; padding: 20px; font-size: 0.88em; }
.zibase-toggle-label { display: flex; align-items: center; cursor: pointer; }
.zibase-toggle-input { display: none; }
.zibase-toggle-track { width: 28px; height: 16px; background: var(--background-modifier-border); border-radius: 999px; position: relative; transition: background 0.2s; }
.zibase-toggle-input:checked + .zibase-toggle-track { background: var(--interactive-accent); }
.zibase-toggle-thumb { position: absolute; top: 2px; left: 2px; width: 12px; height: 12px; background: white; border-radius: 50%; transition: transform 0.2s; box-shadow: 0 1px 3px rgba(0,0,0,0.2); }
.zibase-toggle-input:checked + .zibase-toggle-track .zibase-toggle-thumb { transform: translateX(12px); }
.zibase-select { background: var(--background-secondary); border: 1px solid var(--background-modifier-border); border-radius: 5px; padding: 3px 6px; color: var(--text-normal); font-size: 0.88em; cursor: pointer; outline: none; max-width: 160px; }
.zibase-select:focus { border-color: var(--interactive-accent); }
.zibase-label { display: inline-block; padding: 2px 10px; border-radius: 999px; font-size: 0.8em; font-weight: 500; background: color-mix(in srgb, var(--lc, #60a5fa) 15%, transparent); color: var(--lc, #60a5fa); border: 1px solid color-mix(in srgb, var(--lc, #60a5fa) 35%, transparent); cursor: pointer; transition: opacity 0.15s; }
.zibase-label:hover { opacity: 0.75; }

/* Fix: text rendered — p tag pointer-events none */
.zibase-text-rendered { display: inline; cursor: default; color: var(--text-normal); }
.zibase-text-rendered p { margin: 0; display: inline; pointer-events: none; }
.zibase-text-rendered a { color: var(--link-color, var(--interactive-accent)); text-decoration: none; pointer-events: all; cursor: pointer; }
.zibase-text-rendered a:hover { text-decoration: underline; }
.zibase-text-empty { color: var(--text-faint); font-style: italic; }

.zibase-number, .zibase-date { background: var(--background-modifier-form-field); border: 1px solid var(--background-modifier-border); border-radius: 5px; padding: 2px 6px; color: var(--text-normal); font-size: 0.88em; outline: none; max-width: 120px; }
.zibase-number:focus, .zibase-date:focus { border-color: var(--interactive-accent); }
.zibase-inline-input { background: var(--background-modifier-form-field); border: 1px solid var(--interactive-accent); border-radius: 5px; padding: 2px 6px; color: var(--text-normal); font-size: 0.88em; outline: none; width: 100%; min-width: 60px; box-sizing: border-box; }
.zibase-footer { display: flex; align-items: center; gap: 10px; padding: 6px 12px; border-top: 1px solid var(--background-modifier-border); background: var(--background-secondary); }
.zibase-add-row-btn { display: flex; align-items: center; gap: 5px; background: none; border: 1px solid var(--background-modifier-border); border-radius: 5px; padding: 3px 10px; color: var(--text-muted); font-size: 0.78em; cursor: pointer; opacity: 0; transition: color 0.15s, border-color 0.15s, background 0.15s, opacity 0.15s; }
.zibase-wrapper:hover .zibase-add-row-btn { opacity: 1; }
.zibase-add-row-btn:hover { color: var(--interactive-accent); border-color: var(--interactive-accent); background: color-mix(in srgb, var(--interactive-accent) 8%, transparent); }
.zibase-row-count { font-size: 0.72em; color: var(--text-faint); margin-left: auto; }

/* ── Formula cells ── */
.zibase-formula-result { font-weight: 600; color: var(--interactive-accent); cursor: default; }
.zibase-formula-source { font-family: var(--font-monospace); font-size: 0.88em; color: var(--text-muted); background: var(--background-secondary); padding: 1px 6px; border-radius: 4px; }
.zibase-formula-empty { color: var(--text-faint); font-style: italic; }
.zibase-formula-cols { display: flex; flex-wrap: wrap; align-items: center; gap: 4px; margin-bottom: 4px; }
.zibase-formula-cols-label { font-size: 0.82em; color: var(--text-muted); }
.zibase-formula-col-chip { font-size: 0.78em; background: var(--background-secondary); border: 1px solid var(--background-modifier-border); border-radius: 4px; padding: 1px 6px; cursor: pointer; transition: border-color 0.15s, color 0.15s; }
.zibase-formula-col-chip:hover { border-color: var(--interactive-accent); color: var(--interactive-accent); }

/* ── Stats footer ── */
.zibase-stats-foot { border-top: 2px solid var(--background-modifier-border); opacity: 0; transition: opacity 0.15s; }
.zibase-wrapper:hover .zibase-stats-foot { opacity: 1; }
.zibase-stats-row { background: var(--background-secondary-alt); }
.zibase-stats-td { padding: 5px 14px; font-size: 0.75em; color: var(--text-muted); border-bottom: none; }
.zibase-stats-empty { color: var(--text-faint); }
.zibase-stats-label { font-weight: 700; font-size: 0.85em; letter-spacing: 0.05em; color: var(--interactive-accent); }
.zibase-stats-value { color: var(--text-normal); font-weight: 500; }

/* ── Dropdown menu ── */
.zibase-dropdown { position: absolute; z-index: 9999; background: var(--background-primary); border: 1px solid var(--background-modifier-border); border-radius: 8px; padding: 4px; min-width: 180px; box-shadow: 0 4px 20px rgba(0,0,0,0.15); animation: zibase-menu-in 0.1s ease; }
.zibase-dropdown-item { display: flex; align-items: center; gap: 8px; padding: 7px 10px; border-radius: 5px; cursor: pointer; transition: background 0.1s; color: var(--text-normal); font-size: 0.88em; position: relative; }
.zibase-dropdown-item:hover { background: var(--background-modifier-hover); }
.zibase-dropdown-item:hover .zibase-dropdown-sub { display: block; }
.zibase-dropdown-label { flex: 1; }
.zibase-dropdown-arrow { font-size: 0.7em; color: var(--text-faint); }
.zibase-dropdown-icon { width: 18px; text-align: center; }
.zibase-dropdown-has-sub { }
.zibase-dropdown-sub { display: none; position: absolute; left: 100%; top: 0; background: var(--background-primary); border: 1px solid var(--background-modifier-border); border-radius: 8px; padding: 4px; min-width: 180px; box-shadow: 0 4px 20px rgba(0,0,0,0.15); z-index: 10000; }
.zibase-dropdown-subitem { display: flex; align-items: center; gap: 8px; padding: 7px 10px; border-radius: 5px; cursor: pointer; transition: background 0.1s; color: var(--text-normal); font-size: 0.88em; }
.zibase-dropdown-subitem:hover { background: var(--background-modifier-hover); }
.zibase-dropdown-subitem.zibase-menu-active { color: var(--interactive-accent); font-weight: 600; }
.zibase-view-check { color: var(--interactive-accent); font-size: 0.9em; }

/* Rules sub panel */
.zibase-rules-sub { min-width: 280px; padding: 8px; }
.zibase-rules-title { font-size: 0.7em; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: var(--text-faint); padding: 2px 4px 8px; border-bottom: 1px solid var(--background-modifier-border); margin-bottom: 6px; }
.zibase-rules-row { display: flex; align-items: center; gap: 6px; margin-bottom: 4px; }
.zibase-rules-name { flex: 1; background: var(--background-modifier-form-field); border: 1px solid var(--background-modifier-border); border-radius: 4px; padding: 3px 6px; color: var(--text-normal); font-size: 0.82em; outline: none; min-width: 0; }
.zibase-rules-name:focus { border-color: var(--interactive-accent); }
.zibase-rules-arrow { color: var(--text-faint); font-size: 0.8em; flex-shrink: 0; }
.zibase-rules-type { background: var(--background-secondary); border: 1px solid var(--background-modifier-border); border-radius: 4px; padding: 3px 4px; color: var(--text-normal); font-size: 0.82em; outline: none; }
.zibase-rules-remove { background: none; border: none; color: var(--text-faint); cursor: pointer; font-size: 1em; padding: 2px 5px; border-radius: 3px; flex-shrink: 0; }
.zibase-rules-remove:hover { color: #ef4444; background: color-mix(in srgb, #ef4444 12%, transparent); }
.zibase-rules-add { margin-top: 6px; padding-top: 6px; border-top: 1px solid var(--background-modifier-border); }
.zibase-rules-add-btn { background: none; border: 1px dashed var(--background-modifier-border); border-radius: 5px; padding: 4px 10px; color: var(--text-muted); font-size: 0.82em; cursor: pointer; width: 100%; }
.zibase-rules-add-btn:hover { border-color: var(--interactive-accent); color: var(--interactive-accent); }

/* Context menu */
.zibase-context-menu { position: absolute; z-index: 9999; background: var(--background-primary); border: 1px solid var(--background-modifier-border); border-radius: 8px; padding: 4px; min-width: 140px; box-shadow: 0 4px 20px rgba(0,0,0,0.15); animation: zibase-menu-in 0.1s ease; }
@keyframes zibase-menu-in { from { opacity: 0; transform: scale(0.95) translateY(-4px); } to { opacity: 1; transform: scale(1) translateY(0); } }
.zibase-menu-title { font-size: 0.7em; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: var(--text-faint); padding: 4px 10px 6px; border-bottom: 1px solid var(--background-modifier-border); margin-bottom: 3px; }
.zibase-menu-item { display: flex; align-items: center; gap: 8px; padding: 6px 10px; border-radius: 5px; cursor: pointer; transition: background 0.1s; color: var(--text-normal); font-size: 0.88em; }
.zibase-menu-item:hover { background: var(--background-modifier-hover); }
.zibase-menu-item.zibase-menu-active { color: var(--interactive-accent); font-weight: 600; }
.zibase-menu-icon { width: 16px; text-align: center; opacity: 0.7; font-size: 0.9em; }

/* Link tooltip */
.zibase-link-tooltip { position: absolute; z-index: 99999; background: var(--background-primary); border: 1px solid var(--background-modifier-border); border-radius: 5px; padding: 3px 8px; font-size: 0.75em; color: var(--text-muted); pointer-events: none; box-shadow: 0 2px 8px rgba(0,0,0,0.12); white-space: nowrap; }

/* Toast */
.zibase-toast { position: fixed; bottom: 24px; right: 24px; z-index: 99999; background: var(--background-primary); border: 1px solid var(--background-modifier-border); border-radius: 8px; padding: 10px 16px; font-size: 0.88em; color: var(--text-normal); box-shadow: 0 4px 20px rgba(0,0,0,0.15); opacity: 0; transform: translateY(8px); transition: opacity 0.2s, transform 0.2s; pointer-events: none; }
.zibase-toast-show { opacity: 1; transform: translateY(0); }

/* Modal */
.zibase-modal { padding: 4px; }
.zibase-modal-title { margin: 0 0 12px; font-size: 1em; font-weight: 600; }
.zibase-modal-chips { display: flex; flex-wrap: wrap; gap: 6px; min-height: 32px; margin-bottom: 12px; padding: 8px; background: var(--background-secondary); border-radius: 6px; border: 1px solid var(--background-modifier-border); }
.zibase-modal-chip { display: flex; align-items: center; gap: 4px; background: color-mix(in srgb, var(--interactive-accent) 15%, transparent); color: var(--interactive-accent); border: 1px solid color-mix(in srgb, var(--interactive-accent) 30%, transparent); border-radius: 999px; padding: 2px 8px; font-size: 0.82em; font-weight: 500; }
.zibase-chip-remove { cursor: pointer; opacity: 0.6; font-size: 1em; margin-left: 2px; }
.zibase-chip-remove:hover { opacity: 1; }
.zibase-modal-input-row { display: flex; gap: 6px; margin-bottom: 12px; }
.zibase-modal-input { flex: 1; background: var(--background-modifier-form-field); border: 1px solid var(--background-modifier-border); border-radius: 6px; padding: 6px 10px; color: var(--text-normal); font-size: 0.9em; outline: none; width: 100%; }
.zibase-modal-input:focus { border-color: var(--interactive-accent); }
.zibase-modal-add-btn { background: var(--background-secondary); border: 1px solid var(--background-modifier-border); border-radius: 6px; padding: 6px 12px; color: var(--text-normal); font-size: 0.88em; cursor: pointer; }
.zibase-modal-add-btn:hover { border-color: var(--interactive-accent); color: var(--interactive-accent); }
.zibase-modal-apply-btn { width: 100%; background: var(--interactive-accent); border: none; border-radius: 6px; padding: 8px; color: white; font-size: 0.9em; cursor: pointer; font-weight: 600; margin-top: 4px; }
.zibase-modal-apply-btn:hover { opacity: 0.85; }

/* Settings tab */
.zibase-settings-desc { color: var(--text-muted); font-size: 0.9em; margin-bottom: 0.5em; }
.zibase-rules-container { margin-bottom: 12px; }
.zibase-rule-row { display: flex; align-items: center; gap: 8px; margin-bottom: 6px; }
.zibase-rule-name { flex: 1; background: var(--background-modifier-form-field); border: 1px solid var(--background-modifier-border); border-radius: 5px; padding: 5px 8px; color: var(--text-normal); font-size: 0.88em; outline: none; }
.zibase-rule-name:focus { border-color: var(--interactive-accent); }
.zibase-rule-arrow { color: var(--text-faint); flex-shrink: 0; }
.zibase-rule-type { background: var(--background-secondary); border: 1px solid var(--background-modifier-border); border-radius: 5px; padding: 5px 6px; color: var(--text-normal); font-size: 0.88em; outline: none; }
.zibase-rule-remove { background: none; border: none; color: var(--text-faint); cursor: pointer; font-size: 1.1em; padding: 2px 6px; border-radius: 3px; }
.zibase-rule-remove:hover { color: #ef4444; background: color-mix(in srgb, #ef4444 12%, transparent); }

/* ── Kanban View ── */
.zibase-kanban { padding: 12px; }
.zibase-kanban-notice { text-align: center; color: var(--text-faint); font-style: italic; padding: 24px; }
.zibase-kanban-lanes { display: flex; gap: 12px; overflow-x: auto; padding-bottom: 8px; align-items: flex-start; }
.zibase-kanban-lane { min-width: 200px; max-width: 280px; flex: 1; background: var(--background-secondary); border-radius: 8px; border: 1px solid var(--background-modifier-border); overflow: hidden; }
.zibase-kanban-lane-header { display: flex; align-items: center; justify-content: space-between; padding: 8px 12px; border-bottom: 2px solid color-mix(in srgb, var(--lane-color, var(--interactive-accent)) 40%, transparent); background: color-mix(in srgb, var(--lane-color, var(--interactive-accent)) 6%, transparent); }
.zibase-kanban-lane-title { font-size: 0.78em; font-weight: 700; letter-spacing: 0.05em; text-transform: uppercase; }
.zibase-kanban-lane-count { font-size: 0.7em; color: var(--text-faint); background: var(--background-modifier-border); border-radius: 999px; padding: 1px 7px; font-weight: 600; }
.zibase-kanban-lane-body { padding: 8px; min-height: 60px; display: flex; flex-direction: column; gap: 8px; transition: background 0.15s; }
.zibase-kanban-lane-dragover { background: color-mix(in srgb, var(--interactive-accent) 8%, transparent); }
.zibase-kanban-card { background: var(--background-primary); border: 1px solid var(--background-modifier-border); border-radius: 6px; padding: 10px 12px; cursor: grab; transition: box-shadow 0.15s, transform 0.15s, opacity 0.15s; }
.zibase-kanban-card:hover { box-shadow: 0 2px 8px rgba(0,0,0,0.1); transform: translateY(-1px); }
.zibase-kanban-card-dragging { opacity: 0.5; transform: rotate(2deg); }
.zibase-kanban-card-title { font-weight: 600; font-size: 0.9em; color: var(--text-normal); margin-bottom: 6px; }
.zibase-kanban-card-field { display: flex; align-items: center; gap: 6px; margin-top: 3px; }
.zibase-kanban-field-label { font-size: 0.7em; color: var(--text-faint); text-transform: uppercase; letter-spacing: 0.04em; font-weight: 600; min-width: 40px; }
.zibase-kanban-field-value { font-size: 0.82em; color: var(--text-muted); }
.zibase-kanban-label { font-size: 0.72em; }

/* ── Gallery View ── */
.zibase-gallery { padding: 12px; }
.zibase-gallery-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 12px; }
.zibase-gallery-card { background: var(--background-secondary); border: 1px solid var(--background-modifier-border); border-radius: 8px; padding: 14px; transition: box-shadow 0.2s, transform 0.2s; cursor: default; }
.zibase-gallery-card:hover { box-shadow: 0 4px 16px rgba(0,0,0,0.1); transform: translateY(-2px); }
.zibase-gallery-card-title { font-weight: 700; font-size: 0.95em; color: var(--text-normal); margin-bottom: 10px; padding-bottom: 8px; border-bottom: 1px solid var(--background-modifier-border); }
.zibase-gallery-card-fields { display: flex; flex-direction: column; gap: 5px; }
.zibase-gallery-field { display: flex; align-items: center; gap: 5px; font-size: 0.82em; }
.zibase-gallery-field-name { color: var(--text-faint); font-size: 0.9em; }
.zibase-gallery-field-value { color: var(--text-muted); }
.zibase-gallery-field-select { color: var(--text-normal); font-weight: 500; }
.zibase-gallery-field-icon { font-size: 0.85em; }

/* ── Calendar View ── */
.zibase-calendar { padding: 12px; }
.zibase-calendar-notice { text-align: center; color: var(--text-faint); font-style: italic; padding: 24px; }
.zibase-calendar-nav { display: flex; align-items: center; justify-content: center; gap: 16px; margin-bottom: 12px; }
.zibase-calendar-nav-btn { background: none; border: 1px solid var(--background-modifier-border); border-radius: 5px; padding: 4px 10px; color: var(--text-muted); cursor: pointer; font-size: 0.85em; transition: color 0.15s, border-color 0.15s; }
.zibase-calendar-nav-btn:hover { color: var(--interactive-accent); border-color: var(--interactive-accent); }
.zibase-calendar-month-label { font-weight: 700; font-size: 0.95em; color: var(--text-normal); min-width: 160px; text-align: center; }
.zibase-calendar-day-headers { display: grid; grid-template-columns: repeat(7, 1fr); gap: 4px; margin-bottom: 4px; }
.zibase-calendar-day-header { text-align: center; font-size: 0.7em; font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase; color: var(--text-faint); padding: 4px; }
.zibase-calendar-grid { display: grid; grid-template-columns: repeat(7, 1fr); gap: 4px; }
.zibase-calendar-cell { min-height: 70px; background: var(--background-secondary); border: 1px solid var(--background-modifier-border); border-radius: 5px; padding: 4px 6px; overflow: hidden; transition: border-color 0.15s; }
.zibase-calendar-cell-empty { background: transparent; border-color: transparent; }
.zibase-calendar-cell-clickable { cursor: pointer; }
.zibase-calendar-cell-clickable:hover { border-color: var(--interactive-accent); background: color-mix(in srgb, var(--interactive-accent) 5%, transparent); }
.zibase-calendar-today { border-color: var(--interactive-accent); box-shadow: inset 0 0 0 1px var(--interactive-accent); }
.zibase-calendar-day-num { font-size: 0.75em; font-weight: 700; color: var(--text-muted); display: block; margin-bottom: 3px; }
.zibase-calendar-today .zibase-calendar-day-num { color: var(--interactive-accent); }
.zibase-calendar-entry { font-size: 0.68em; padding: 2px 5px; border-radius: 3px; margin-bottom: 2px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; background: color-mix(in srgb, var(--interactive-accent) 15%, transparent); color: var(--interactive-accent); font-weight: 500; }
.zibase-calendar-entry-colored { background: color-mix(in srgb, var(--lc, var(--interactive-accent)) 15%, transparent); color: var(--lc, var(--interactive-accent)); }
`;


// src/main.ts

var main_exports = {};
__export(main_exports, {
  default: () => ZiBasePlugin
});
module.exports = __toCommonJS(main_exports);
var import_obsidian2 = require("obsidian");


var DEFAULT_SETTINGS = {
  renderInReadingView: true,
  inferSchema: true,
  columnRules: [...DEFAULT_COLUMN_RULES]
};
var ZiBasePlugin = class extends import_obsidian2.Plugin {
  async onload() {
    
    await this.loadSettings();
    this.renderer = new ZiBaseTableRenderer(this.app, this);
    if (this.settings.renderInReadingView) {
      this.registerMarkdownPostProcessor((element, context) => {
        this.renderer.processReadingView(element, context);
      });
    }
    this.addCommand({
      id: "zibase-insert-table",
      name: "Insert ZiBase annotated table",
      editorCallback: (editor) => {
        const template = [
          "| Name | Status | Priority | Tags |",
          "|------|--------|----------|------|",
          "| <!-- zibase: text --> | <!-- zibase: toggle --> | <!-- zibase: select:Low,Medium,High --> | <!-- zibase: label --> |",
          "| Item 1 | true | High | biology |",
          "| Item 2 | false | Low | chemistry |"
        ].join("\n");
        editor.replaceSelection(template);
      }
    });
    this.addCommand({
      id: "zibase-insert-plain-table",
      name: "Insert plain table (auto-inferred)",
      editorCallback: (editor) => {
        const template = [
          "| Name | Done | Score | Category |",
          "|------|------|-------|----------|",
          "| Task A | true | 90 | Work |",
          "| Task B | false | 75 | Work |",
          "| Task C | true | 82 | Personal |"
        ].join("\n");
        editor.replaceSelection(template);
      }
    });
    this.addCommand({
      id: "zibase-insert-formula-table",
      name: "Insert table with formula column",
      editorCallback: (editor) => {
        const template = [
          "| Item | Price | Qty | Total |",
          "|------|-------|-----|-------|",
          "| <!-- zibase: text --> | <!-- zibase: number --> | <!-- zibase: number --> | <!-- zibase: formula:Price * Qty --> |",
          "| Pen | 10 | 5 |  |",
          "| Book | 250 | 2 |  |",
          "| Eraser | 5 | 10 |  |"
        ].join("\n");
        editor.replaceSelection(template);
      }
    });
    this.addSettingTab(new ZiBaseSettingTab(this.app, this));
    
  }
  onunload() {
    
  }
  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
    if (!this.settings.columnRules || this.settings.columnRules.length === 0) {
      this.settings.columnRules = [...DEFAULT_COLUMN_RULES];
    }
  }
  async saveSettings() {
    await this.saveData(this.settings);
  }
};
var ZiBaseSettingTab = class extends import_obsidian2.PluginSettingTab {
  constructor(app, plugin) {
    super(app, plugin);
    this.plugin = plugin;
  }
  display() {
    const { containerEl } = this;
    containerEl.empty();
    containerEl.createEl("h2", { text: "ZiBase \u2014 \u0BB4\u0BBF\u0BAF\u0BB2\u0BCD" });
    containerEl.createEl("p", {
      text: "Markdown tables as living databases.",
      cls: "zibase-settings-desc"
    });
    containerEl.createEl("h3", { text: "\u2699\uFE0F General" });
    new import_obsidian2.Setting(containerEl).setName("Render in Reading View").setDesc("Show rich UI when viewing notes in reading mode.").addToggle((t) => t.setValue(this.plugin.settings.renderInReadingView).onChange(async (v) => {
      this.plugin.settings.renderInReadingView = v;
      await this.plugin.saveSettings();
    }));
    new import_obsidian2.Setting(containerEl).setName("Auto-infer schema").setDesc("Automatically detect column types from plain markdown tables.").addToggle((t) => t.setValue(this.plugin.settings.inferSchema).onChange(async (v) => {
      this.plugin.settings.inferSchema = v;
      await this.plugin.saveSettings();
    }));
    containerEl.createEl("h3", { text: "\u{1F3F7}\uFE0F Column Name Rules" });
    containerEl.createEl("p", {
      text: "When a column name matches, auto-assign that type. Applied to all inferred tables.",
      cls: "zibase-settings-desc"
    });
    const rulesContainer = containerEl.createDiv("zibase-rules-container");
    this.renderRules(rulesContainer);
    new import_obsidian2.Setting(containerEl).addButton((btn) => btn.setButtonText("+ Add rule").setCta().onClick(async () => {
      this.plugin.settings.columnRules.push({ name: "", type: "label" });
      await this.plugin.saveSettings();
      this.renderRules(rulesContainer);
    }));
    new import_obsidian2.Setting(containerEl).setName("Reset to defaults").setDesc("Restore the original column name rules.").addButton((btn) => btn.setButtonText("Reset").setWarning().onClick(async () => {
      this.plugin.settings.columnRules = [...DEFAULT_COLUMN_RULES];
      await this.plugin.saveSettings();
      this.renderRules(rulesContainer);
    }));
    containerEl.createEl("h3", { text: "\u2139\uFE0F About" });
    containerEl.createEl("p", { text: "ZiBase v0.6.0 \u2014 Built by Rohith A (ZIYAL)", cls: "zibase-settings-desc" });
    containerEl.createEl("p", { text: "Markdown-native database plugin for Obsidian.", cls: "zibase-settings-desc" });
  }
  renderRules(container) {
    container.empty();
    const TYPE_OPTIONS = ["text", "toggle", "select", "label", "number", "date", "formula"];
    this.plugin.settings.columnRules.forEach((rule, idx) => {
      const row = container.createDiv("zibase-rule-row");
      const nameInput = row.createEl("input", { type: "text", cls: "zibase-rule-name", value: rule.name });
      nameInput.placeholder = "column name";
      nameInput.addEventListener("change", async () => {
        this.plugin.settings.columnRules[idx].name = nameInput.value.trim();
        await this.plugin.saveSettings();
      });
      row.createSpan({ text: "\u2192", cls: "zibase-rule-arrow" });
      const typeSelect = row.createEl("select", { cls: "zibase-rule-type" });
      TYPE_OPTIONS.forEach((t) => {
        const opt = typeSelect.createEl("option", { text: t, value: t });
        if (t === rule.type)
          opt.selected = true;
      });
      typeSelect.addEventListener("change", async () => {
        this.plugin.settings.columnRules[idx].type = typeSelect.value;
        await this.plugin.saveSettings();
      });
      const removeBtn = row.createEl("button", { text: "\xD7", cls: "zibase-rule-remove" });
      removeBtn.addEventListener("click", async () => {
        this.plugin.settings.columnRules.splice(idx, 1);
        await this.plugin.saveSettings();
        this.renderRules(container);
      });
    });
  }
};
