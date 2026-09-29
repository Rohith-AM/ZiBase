"use strict";
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

// src/main.ts
var main_exports = {};
__export(main_exports, {
  default: () => ZiBasePlugin
});
module.exports = __toCommonJS(main_exports);
var import_obsidian8 = require("obsidian");

// src/schema.ts
var ANNOTATION_RE = /<!--\s*zibase:\s*([^\s>]+(?:\s*[^\s>]+)*)\s*-->/i;
var VIEW_ANNOTATION_RE = /<!--\s*zibase-view:\s*(\w+)(?::([^>]+))?\s*-->/i;
var DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
var NUMBER_RE = /^-?\d+(\.\d+)?$/;
var DEFAULT_COLUMN_RULES = [
  { name: "domain", type: "label" },
  { name: "category", type: "label" },
  { name: "tag", type: "label" },
  { name: "tags", type: "multi-select" },
  { name: "type", type: "label" },
  { name: "label", type: "label" },
  { name: "labels", type: "multi-select" },
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
  if (values.every((v) => v.toLowerCase() === "true" || v.toLowerCase() === "false")) {
    return { kind: "toggle" };
  }
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
function parseMultiSelect(val) {
  if (!val)
    return [];
  return val.split(",").map((s) => s.trim()).filter((s) => s.length > 0);
}
function isDataRow(line) {
  return Boolean(line.trim() && line.includes("|") && !/<!--\s*zibase:/.test(line) && !/<!--\s*zibase-view:/.test(line));
}
function filterDataRows(rows, query) {
  if (!query)
    return rows;
  const q = query.toLowerCase();
  return rows.filter((line) => splitRow(line).some((cell) => cell.toLowerCase().includes(q)));
}

// src/renderer.ts
var import_obsidian7 = require("obsidian");

// src/cells.ts
var import_obsidian = require("obsidian");

// src/formula.ts
var FORMULA_NUMBER_RE = /^-?\d+(\.\d+)?$/;
function isBackticked(raw) {
  const trimmed = raw.trim();
  return trimmed.startsWith("`") && trimmed.endsWith("`") && trimmed.length >= 2;
}
function stripBackticks(raw) {
  const trimmed = raw.trim();
  return trimmed.slice(1, -1);
}
function isSimpleMath(raw) {
  const trimmed = raw.trim();
  if (!trimmed)
    return false;
  if (FORMULA_NUMBER_RE.test(trimmed))
    return false;
  if (!/^[\d\s+\-*/%().]+$/.test(trimmed))
    return false;
  if (!/[+\-*/%]/.test(trimmed))
    return false;
  if (/^[+*/%]/.test(trimmed))
    return false;
  return true;
}
function evaluateFormula(expression, rowData) {
  if (!expression || !expression.trim())
    return null;
  let resolved = expression;
  const colNames = Object.keys(rowData).sort((a, b) => b.length - a.length);
  for (const colName of colNames) {
    const regex = new RegExp("\\b" + escapeRegex(colName) + "\\b", "gi");
    if (!regex.test(resolved))
      continue;
    regex.lastIndex = 0;
    const rawVal = rowData[colName];
    const numVal = parseFloat(rawVal);
    if (Number.isNaN(numVal))
      return null;
    resolved = resolved.replace(regex, numVal.toString());
  }
  try {
    return safeEval(resolved);
  } catch (e) {
    return null;
  }
}
function evaluateSimpleMath(expression) {
  try {
    return safeEval(expression);
  } catch (e) {
    return null;
  }
}
function formatResult(value) {
  if (value === null || value === void 0 || Number.isNaN(value))
    return "\u2014";
  if (!Number.isFinite(value))
    return "\u221E";
  return parseFloat(value.toFixed(6)).toString();
}
function safeEval(expression) {
  const tokens = tokenize(expression);
  const parser = { tokens, pos: 0 };
  const result = parseExpr(parser);
  if (parser.pos < parser.tokens.length) {
    throw new Error("Unexpected token: " + String(parser.tokens[parser.pos].value));
  }
  return result;
}
function tokenize(expr) {
  const tokens = [];
  let i = 0;
  const s = expr.trim();
  while (i < s.length) {
    if (s[i] === " " || s[i] === "	") {
      i++;
      continue;
    }
    if (s[i] >= "0" && s[i] <= "9" || s[i] === "." && i + 1 < s.length && s[i + 1] >= "0" && s[i + 1] <= "9") {
      let num = "";
      while (i < s.length && (s[i] >= "0" && s[i] <= "9" || s[i] === ".")) {
        num += s[i];
        i++;
      }
      tokens.push({ type: "number", value: parseFloat(num) });
      continue;
    }
    if ("+-*/%".includes(s[i])) {
      tokens.push({ type: "op", value: s[i] });
      i++;
      continue;
    }
    if (s[i] === "(") {
      tokens.push({ type: "lparen", value: "(" });
      i++;
      continue;
    }
    if (s[i] === ")") {
      tokens.push({ type: "rparen", value: ")" });
      i++;
      continue;
    }
    throw new Error("Unexpected character: " + s[i]);
  }
  return tokens;
}
function parseExpr(parser) {
  let left = parseTerm(parser);
  while (parser.pos < parser.tokens.length) {
    const tok = parser.tokens[parser.pos];
    if (tok.type === "op" && (tok.value === "+" || tok.value === "-")) {
      parser.pos++;
      const right = parseTerm(parser);
      left = tok.value === "+" ? left + right : left - right;
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
    if (tok.type === "op" && (tok.value === "*" || tok.value === "/" || tok.value === "%")) {
      parser.pos++;
      const right = parseUnary(parser);
      if (tok.value === "*")
        left = left * right;
      else if (tok.value === "/")
        left = right === 0 ? Infinity : left / right;
      else
        left = left % right;
    } else {
      break;
    }
  }
  return left;
}
function parseUnary(parser) {
  if (parser.pos < parser.tokens.length) {
    const tok = parser.tokens[parser.pos];
    if (tok.type === "op" && tok.value === "-") {
      parser.pos++;
      return -parseUnary(parser);
    }
    if (tok.type === "op" && tok.value === "+") {
      parser.pos++;
      return parseUnary(parser);
    }
  }
  return parsePrimary(parser);
}
function parsePrimary(parser) {
  if (parser.pos >= parser.tokens.length) {
    throw new Error("Unexpected end of expression");
  }
  const tok = parser.tokens[parser.pos];
  if (tok.type === "number") {
    parser.pos++;
    return tok.value;
  }
  if (tok.type === "lparen") {
    parser.pos++;
    const result = parseExpr(parser);
    if (parser.pos >= parser.tokens.length || parser.tokens[parser.pos].type !== "rparen") {
      throw new Error("Missing closing parenthesis");
    }
    parser.pos++;
    return result;
  }
  throw new Error("Unexpected token: " + String(tok.value));
}
function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// src/colors.ts
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

// src/ui.ts
function getTypeIcon(type) {
  switch (type.kind) {
    case "toggle":
      return "\u2B1C";
    case "select":
      return "\u25BE";
    case "multi-select":
      return "\u{1F3F7}\uFE0F";
    case "label":
      return "\u2B21";
    case "number":
      return "#";
    case "date":
      return "\u{1F4C5}";
    case "formula":
      return "\u0192";
    default:
      return "T";
  }
}
function showToast(message) {
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
  input.addEventListener("blur", () => {
    void commit();
  });
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter")
      void commit();
    if (e.key === "Escape")
      input.replaceWith(chip);
  });
}

// src/cells.ts
function startMarkdownEdit(td, rawValue, context, host, onChange) {
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
    await host.rerenderTextCell(td, newVal, context);
  };
  input.addEventListener("blur", () => {
    void commit();
  });
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      void commit();
    }
    if (e.key === "Escape") {
      input.remove();
      if (displaySpan)
        displaySpan.setCssStyles({ display: "" });
    }
  });
}
function renderCell(host, td, col, rawValue, context, schema, rowCells, onChange) {
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
    case "multi-select": {
      const wrap = td.createDiv("zibase-multi-select-wrap");
      const tags = parseMultiSelect(rawValue);
      if (tags.length === 0) {
        const empty = wrap.createSpan({ text: "\u2014", cls: "zibase-text-empty" });
        empty.addEventListener("click", () => startLabelEdit(wrap, rawValue, onChange));
      } else {
        tags.forEach((tag) => {
          const chip = wrap.createSpan({ text: tag, cls: "zibase-label" });
          chip.style.setProperty("--lc", getLabelColor(tag));
          chip.addEventListener("click", (e) => {
            e.stopPropagation();
            startLabelEdit(wrap, rawValue, onChange);
          });
        });
        wrap.addEventListener("click", () => startLabelEdit(wrap, rawValue, onChange));
      }
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
      let debounce = 0;
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
        if (td.querySelector("input"))
          return;
        displaySpan.setCssStyles({ display: "none" });
        const input = td.createEl("input", { type: "date", cls: "zibase-date" });
        input.value = val;
        input.focus();
        const picker = input;
        if (typeof picker.showPicker === "function") {
          try {
            picker.showPicker();
          } catch (e) {
          }
        }
        const commit = async () => {
          const newVal = input.value;
          input.remove();
          displaySpan.textContent = newVal || "\u2014";
          displaySpan.className = newVal ? "zibase-date-rendered" : "zibase-text-empty";
          displaySpan.setCssStyles({ display: "" });
          await onChange(newVal);
        };
        input.addEventListener("blur", () => {
          void commit();
        });
        input.addEventListener("keydown", (e) => {
          if (e.key === "Enter")
            void commit();
          if (e.key === "Escape") {
            input.remove();
            displaySpan.setCssStyles({ display: "" });
          }
        });
      });
      break;
    }
    case "formula": {
      const val = rawValue.trim();
      if (isBackticked(val)) {
        td.createSpan({ text: stripBackticks(val), cls: "zibase-formula-source" });
        break;
      }
      if (isSimpleMath(val)) {
        const result = evaluateSimpleMath(val);
        const span = td.createSpan({ text: formatResult(result), cls: "zibase-formula-result" });
        span.title = val;
        break;
      }
      if (col.type.expression) {
        const rowData = {};
        schema.columns.forEach((c, i) => {
          var _a;
          rowData[c.name] = ((_a = rowCells[i]) != null ? _a : "").trim();
        });
        const result = evaluateFormula(col.type.expression, rowData);
        const displayVal = formatResult(result);
        const span = td.createSpan({ text: displayVal, cls: "zibase-formula-result" });
        span.title = `\u0192 ${col.type.expression} = ${displayVal}`;
      } else {
        td.createSpan({ text: val || "\u0192", cls: "zibase-formula-empty" });
      }
      break;
    }
    default: {
      const val = rawValue.trim();
      td.dataset.raw = val;
      if (isSimpleMath(val)) {
        const result = evaluateSimpleMath(val);
        const span = td.createSpan({ text: formatResult(result), cls: "zibase-formula-result zibase-text-rendered" });
        span.title = val;
        td.addEventListener("click", (e) => {
          e.preventDefault();
          e.stopPropagation();
          startMarkdownEdit(td, td.dataset.raw || val, context, host, onChange);
        });
        break;
      }
      if (isBackticked(val)) {
        td.createSpan({ text: stripBackticks(val), cls: "zibase-formula-source zibase-text-rendered" });
        td.addEventListener("click", (e) => {
          e.preventDefault();
          e.stopPropagation();
          startMarkdownEdit(td, td.dataset.raw || val, context, host, onChange);
        });
        break;
      }
      const displaySpan = td.createSpan({ cls: "zibase-text-rendered" });
      if (val) {
        void import_obsidian.MarkdownRenderer.renderMarkdown(val, displaySpan, context.sourcePath, host.plugin).then(() => {
          displaySpan.querySelectorAll("a").forEach((a) => attachLinkTooltip(a));
          td.addEventListener("click", (e) => {
            var _a;
            if (e.altKey) {
              e.preventDefault();
              e.stopPropagation();
              startMarkdownEdit(td, td.dataset.raw || val, context, host, onChange);
              return;
            }
            const target = e.target;
            if ((_a = target == null ? void 0 : target.closest) == null ? void 0 : _a.call(target, "a"))
              return;
            e.preventDefault();
            e.stopPropagation();
            startMarkdownEdit(td, td.dataset.raw || val, context, host, onChange);
          }, true);
        });
      } else {
        displaySpan.textContent = "\u2014";
        displaySpan.classList.add("zibase-text-empty");
        td.addEventListener("click", (e) => {
          var _a;
          e.preventDefault();
          e.stopPropagation();
          startMarkdownEdit(td, (_a = td.dataset.raw) != null ? _a : val, context, host, onChange);
        });
      }
      break;
    }
  }
}

// src/modals.ts
var import_obsidian2 = require("obsidian");
var SelectOptionsModal = class extends import_obsidian2.Modal {
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
var FormulaInputModal = class extends import_obsidian2.Modal {
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
    let input;
    const colList = contentEl.createDiv("zibase-formula-cols");
    colList.createSpan({ text: "Available: ", cls: "zibase-formula-cols-label" });
    this.columns.forEach((col) => {
      if (col.name === this.colName)
        return;
      const chip = colList.createSpan({ text: col.name, cls: "zibase-formula-col-chip" });
      chip.addEventListener("click", () => {
        input.value += col.name;
        input.focus();
      });
    });
    input = contentEl.createEl("input", { type: "text", cls: "zibase-modal-input zibase-modal-formula-input" });
    input.value = this.currentExpr;
    input.placeholder = "e.g., Price * Qty";
    const applyBtn = contentEl.createEl("button", { text: "Apply", cls: "zibase-modal-apply-btn" });
    const apply = () => {
      const expr = input.value.trim();
      if (expr) {
        this.onSubmit(expr);
        this.close();
      }
    };
    applyBtn.addEventListener("click", apply);
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        apply();
      }
      if (e.key === "Escape")
        this.close();
    });
    window.setTimeout(() => {
      input.focus();
      input.select();
    }, 50);
  }
  onClose() {
    this.contentEl.empty();
  }
};

// src/model.ts
var COLUMN_TYPE_OPTIONS = [
  "text",
  "toggle",
  "select",
  "label",
  "multi-select",
  "number",
  "date",
  "formula"
];

// src/views/calendar.ts
var import_obsidian3 = require("obsidian");
function buildCalendarView(host, body, schema, getDataRows, _rawDataLines, context, sectionInfo, filterQuery) {
  const dateCol = schema.columns.find((c) => c.type.kind === "date");
  if (!dateCol) {
    const notice = body.createDiv("zibase-calendar zibase-calendar-notice");
    notice.textContent = "Calendar requires a Date column.";
    return;
  }
  const calendar = body.createDiv("zibase-calendar");
  const now = /* @__PURE__ */ new Date();
  let currentMonth = now.getMonth();
  let currentYear = now.getFullYear();
  const renderCalendar = () => {
    calendar.empty();
    const nav = calendar.createDiv("zibase-calendar-nav");
    const prevBtn = nav.createEl("button", { text: "\u25C0", cls: "zibase-calendar-nav-btn" });
    const monthLabel = nav.createSpan({ cls: "zibase-calendar-month-label" });
    monthLabel.textContent = new Date(currentYear, currentMonth).toLocaleString("default", {
      month: "long",
      year: "numeric"
    });
    const nextBtn = nav.createEl("button", { text: "\u25B6", cls: "zibase-calendar-nav-btn" });
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
    if (startDow < 0)
      startDow = 6;
    const dataRows = filterDataRows(getDataRows(), filterQuery);
    const dateMap = /* @__PURE__ */ new Map();
    dataRows.forEach((line) => {
      const cells = splitRow(line);
      const dateStr = (cells[dateCol.index] || "").trim();
      if (!dateStr)
        return;
      if (!dateMap.has(dateStr))
        dateMap.set(dateStr, []);
      const titleCol = schema.columns.find((c) => c.type.kind === "text");
      const title = titleCol ? (cells[titleCol.index] || "").trim() : (cells[0] || "").trim();
      const labelCol = schema.columns.find((c) => c.type.kind === "label" || c.type.kind === "select");
      const label = labelCol ? (cells[labelCol.index] || "").trim() : null;
      dateMap.get(dateStr).push({ title, label, line });
    });
    const today = /* @__PURE__ */ new Date();
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
    for (let i = 0; i < startDow; i++) {
      grid.createDiv("zibase-calendar-cell zibase-calendar-cell-empty");
    }
    for (let d = 1; d <= totalDays; d++) {
      const dateStr = `${currentYear}-${String(currentMonth + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      const cell = grid.createDiv("zibase-calendar-cell");
      if (dateStr === todayStr)
        cell.classList.add("zibase-calendar-today");
      cell.createSpan({ text: String(d), cls: "zibase-calendar-day-num" });
      const entries = dateMap.get(dateStr) || [];
      entries.forEach((entry) => {
        const pill = cell.createDiv("zibase-calendar-entry");
        void import_obsidian3.MarkdownRenderer.renderMarkdown(entry.title || "\u2014", pill, context.sourcePath, host.plugin);
        if (entry.label) {
          pill.style.setProperty("--lc", getLabelColor(entry.label));
          pill.classList.add("zibase-calendar-entry-colored");
        }
      });
      if (entries.length === 0) {
        cell.addEventListener("click", async () => {
          const file = host.app.vault.getAbstractFileByPath(context.sourcePath);
          if (!(file instanceof import_obsidian3.TFile))
            return;
          await host.app.vault.process(file, (content) => {
            const allLines = content.split("\n");
            const newCells = schema.columns.map((col) => {
              if (col.index === dateCol.index)
                return ` ${dateStr} `;
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

// src/views/gallery.ts
var import_obsidian4 = require("obsidian");
function buildGalleryView(host, body, schema, getDataRows, _rawDataLines, context, _sectionInfo, filterQuery) {
  const gallery = body.createDiv("zibase-gallery");
  const dataRows = filterDataRows(getDataRows(), filterQuery);
  if (dataRows.length === 0) {
    const empty = gallery.createDiv("zibase-empty");
    empty.textContent = filterQuery ? "No matching rows" : "No data";
    return;
  }
  const grid = gallery.createDiv("zibase-gallery-grid");
  dataRows.forEach((line) => {
    const cells = splitRow(line);
    const card = grid.createDiv("zibase-gallery-card");
    const titleCol = schema.columns.find((c) => c.type.kind === "text");
    const titleValue = titleCol ? (cells[titleCol.index] || "").trim() : (cells[0] || "").trim();
    const titleDiv = card.createDiv({ cls: "zibase-gallery-card-title" });
    void import_obsidian4.MarkdownRenderer.renderMarkdown(titleValue || "\u2014", titleDiv, context.sourcePath, host.plugin);
    const fieldsWrap = card.createDiv("zibase-gallery-card-fields");
    schema.columns.forEach((col, colIdx) => {
      var _a;
      if (titleCol && colIdx === titleCol.index)
        return;
      const rawValue = ((_a = cells[colIdx]) != null ? _a : "").trim();
      if (!rawValue && col.type.kind !== "toggle")
        return;
      const field = fieldsWrap.createDiv("zibase-gallery-field");
      if (col.type.kind === "toggle") {
        field.createSpan({ text: parseBool(rawValue) ? "\u2705" : "\u2B1C" });
        field.createSpan({ text: " " + col.name, cls: "zibase-gallery-field-name" });
      } else if (col.type.kind === "label") {
        const chip = field.createSpan({ text: rawValue, cls: "zibase-label" });
        chip.style.setProperty("--lc", getLabelColor(rawValue));
      } else if (col.type.kind === "select") {
        field.createSpan({ text: rawValue, cls: "zibase-gallery-field-select" });
      } else if (col.type.kind === "date") {
        field.createSpan({ text: "\u{1F4C5} ", cls: "zibase-gallery-field-icon" });
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

// src/views/kanban.ts
var import_obsidian5 = require("obsidian");
function buildKanbanView(host, body, schema, getDataRows, rawDataLines, context, sectionInfo, filterQuery) {
  const groupCol = schema.columns.find(
    (c) => c.type.kind === "select" || c.type.kind === "label" || c.type.kind === "multi-select"
  );
  if (!groupCol) {
    const notice = body.createDiv("zibase-kanban zibase-kanban-notice");
    notice.textContent = "Kanban requires a Select or Label column to group by.";
    return;
  }
  const kanban = body.createDiv("zibase-kanban");
  const dataRows = filterDataRows(getDataRows(), filterQuery);
  const groups = /* @__PURE__ */ new Map();
  dataRows.forEach((line) => {
    var _a;
    const cells = splitRow(line);
    const rawGroupValue = ((_a = cells[groupCol.index]) != null ? _a : "").trim() || "\u2014";
    let groupValues = [rawGroupValue];
    if (groupCol.type.kind === "multi-select" && rawGroupValue !== "\u2014") {
      groupValues = parseMultiSelect(rawGroupValue);
      if (groupValues.length === 0)
        groupValues = ["\u2014"];
    }
    groupValues.forEach((gv) => {
      if (!groups.has(gv))
        groups.set(gv, []);
      groups.get(gv).push({ line, cells });
    });
  });
  let groupKeys;
  if (groupCol.type.kind === "select" && groupCol.type.options) {
    groupKeys = [...groupCol.type.options];
    for (const key of groups.keys()) {
      if (!groupKeys.includes(key))
        groupKeys.push(key);
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
      var _a;
      e.preventDefault();
      laneBody.classList.remove("zibase-kanban-lane-dragover");
      const fromIdxStr = (_a = e.dataTransfer) == null ? void 0 : _a.getData("text/kanban-row");
      if (!fromIdxStr)
        return;
      const fromIdx = parseInt(fromIdxStr, 10);
      let newValue = groupValue;
      if (groupCol.type.kind === "multi-select") {
        const rowLine = rawDataLines[fromIdx];
        const rowCells = splitRow(rowLine);
        const currentRaw = (rowCells[groupCol.index] || "").trim();
        const tags = parseMultiSelect(currentRaw);
        if (!tags.includes(groupValue))
          tags.push(groupValue);
        newValue = tags.join(", ");
      }
      await host.writeBack(context, sectionInfo, schema.dataStartIndex + fromIdx, groupCol.index, newValue);
    });
    items.forEach(({ line, cells }) => {
      const rawIdx = rawDataLines.findIndex((l) => l === line);
      const card = laneBody.createDiv("zibase-kanban-card");
      card.draggable = true;
      card.addEventListener("dragstart", (e) => {
        var _a;
        (_a = e.dataTransfer) == null ? void 0 : _a.setData("text/kanban-row", rawIdx.toString());
        card.classList.add("zibase-kanban-card-dragging");
      });
      card.addEventListener("dragend", () => {
        card.classList.remove("zibase-kanban-card-dragging");
      });
      schema.columns.forEach((col, colIdx) => {
        var _a;
        if (colIdx === groupCol.index)
          return;
        const rawValue = ((_a = cells[colIdx]) != null ? _a : "").trim();
        if (!rawValue)
          return;
        if (col.type.kind === "text") {
          if (!card.querySelector(".zibase-kanban-card-title")) {
            const titleEl = card.createDiv("zibase-kanban-card-title");
            void import_obsidian5.MarkdownRenderer.renderMarkdown(rawValue, titleEl, context.sourcePath, host.plugin);
            return;
          }
        }
        const field = card.createDiv("zibase-kanban-card-field");
        field.createSpan({ text: col.name, cls: "zibase-kanban-field-label" });
        if (col.type.kind === "label") {
          const chip = field.createSpan({ text: rawValue, cls: "zibase-label zibase-kanban-label" });
          chip.style.setProperty("--lc", getLabelColor(rawValue));
        } else if (col.type.kind === "toggle") {
          field.createSpan({ text: parseBool(rawValue) ? "\u2705" : "\u2B1C", cls: "zibase-kanban-field-value" });
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
        void import_obsidian5.MarkdownRenderer.renderMarkdown(cells[0] || "\u2014", titleEl, context.sourcePath, host.plugin);
        card.insertBefore(titleEl, card.firstChild);
      }
    });
  });
}

// src/views/table.ts
var import_obsidian6 = require("obsidian");
function buildTableView(host, body, schema, getDataRows, rawDataLines, context, sectionInfo, filterQuery, sortColIdx, sortAsc, badge, onSortChange) {
  const tableEl = body.createEl("table", { cls: "zibase-table" });
  const thead = tableEl.createEl("thead");
  const headerRow = thead.createEl("tr");
  const statModes = {};
  schema.columns.forEach((col, colIdx) => {
    const th = headerRow.createEl("th", { cls: "zibase-th" });
    th.draggable = true;
    th.addEventListener("dragstart", (e) => {
      var _a;
      e.stopPropagation();
      (_a = e.dataTransfer) == null ? void 0 : _a.setData("text/col", colIdx.toString());
    });
    th.addEventListener("dragover", (e) => {
      e.preventDefault();
      th.classList.add("zibase-th-drop-target");
    });
    th.addEventListener("dragleave", () => th.classList.remove("zibase-th-drop-target"));
    th.addEventListener("dragend", () => {
      thead.querySelectorAll(".zibase-th").forEach((el) => el.classList.remove("zibase-th-drop-target"));
    });
    th.addEventListener("drop", async (e) => {
      var _a;
      e.preventDefault();
      e.stopPropagation();
      th.classList.remove("zibase-th-drop-target");
      const fromColStr = (_a = e.dataTransfer) == null ? void 0 : _a.getData("text/col");
      if (!fromColStr)
        return;
      const fromColIdx = parseInt(fromColStr, 10);
      if (fromColIdx === colIdx)
        return;
      const file = host.app.vault.getAbstractFileByPath(context.sourcePath);
      if (!(file instanceof import_obsidian6.TFile))
        return;
      await host.app.vault.process(file, (content) => {
        const allLines = content.split("\n");
        for (let i = sectionInfo.lineStart; i <= sectionInfo.lineEnd; i++) {
          const line = allLines[i];
          if (!line.includes("|"))
            continue;
          const cells = splitRow(line);
          if (cells.length <= fromColIdx || cells.length <= colIdx)
            continue;
          const draggedCell = cells.splice(fromColIdx, 1)[0];
          let insertIdx = colIdx;
          if (fromColIdx < colIdx)
            insertIdx--;
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
    if (col.type.kind === "number" || col.type.kind === "formula") {
      if (!statModes[colIdx])
        statModes[colIdx] = "SUM";
      const statBadge = th.createDiv("zibase-th-stat");
      const updateThStat = () => {
        const dataRows = filterDataRows(getDataRows(), filterQuery);
        const values = dataRows.map((line) => {
          var _a;
          return parseFloat(((_a = splitRow(line)[colIdx]) != null ? _a : "").trim());
        }).filter((n) => !Number.isNaN(n));
        if (values.length === 0) {
          statBadge.textContent = "";
          return;
        }
        const mode = statModes[colIdx];
        let result = 0;
        switch (mode) {
          case "SUM":
            result = values.reduce((a, b) => a + b, 0);
            break;
          case "AVG":
            result = values.reduce((a, b) => a + b, 0) / values.length;
            break;
          case "MIN":
            result = Math.min(...values);
            break;
          case "MAX":
            result = Math.max(...values);
            break;
          default:
            result = 0;
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
        el.textContent = i === colIdx ? newAsc ? "\u2191" : "\u2193" : "\u2195";
        el.classList.toggle("zibase-sort-active", i === colIdx);
      });
      renderRows();
      thead.querySelectorAll(".zibase-th").forEach((thEl) => {
        const statTh = thEl;
        if (statTh._updateStat)
          statTh._updateStat();
      });
    });
    th.addEventListener("contextmenu", (e) => {
      e.preventDefault();
      host.showTypeMenu(e, colIdx, schema, context, sectionInfo, rawDataLines, badge);
    });
  });
  const tbody = tableEl.createEl("tbody");
  const renderRows = () => {
    var _a, _b;
    tbody.empty();
    let dataRows = filterDataRows(getDataRows(), filterQuery);
    if (sortColIdx !== null) {
      const idx = sortColIdx;
      const colType = (_b = (_a = schema.columns[idx]) == null ? void 0 : _a.type.kind) != null ? _b : "text";
      dataRows = [...dataRows].sort((a, b) => {
        var _a2, _b2;
        const av = ((_a2 = splitRow(a)[idx]) != null ? _a2 : "").trim();
        const bv = ((_b2 = splitRow(b)[idx]) != null ? _b2 : "").trim();
        if (colType === "number" || colType === "formula") {
          const na = parseFloat(av);
          const nb = parseFloat(bv);
          if (!Number.isNaN(na) && !Number.isNaN(nb))
            return sortAsc ? na - nb : nb - na;
        }
        if (colType === "date") {
          const da = new Date(av).getTime();
          const db = new Date(bv).getTime();
          if (!Number.isNaN(da) && !Number.isNaN(db))
            return sortAsc ? da - db : db - da;
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
        var _a2;
        (_a2 = e.dataTransfer) == null ? void 0 : _a2.setData("text/row", rawIdx.toString());
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
      tr.addEventListener("drop", async (e) => {
        var _a2;
        e.preventDefault();
        e.stopPropagation();
        tr.classList.remove("zibase-row-drop-target");
        const fromIdxStr = (_a2 = e.dataTransfer) == null ? void 0 : _a2.getData("text/row");
        if (!fromIdxStr)
          return;
        const fromIdx = parseInt(fromIdxStr, 10);
        const toIdx = rawIdx;
        if (fromIdx !== toIdx) {
          const file = host.app.vault.getAbstractFileByPath(context.sourcePath);
          if (!(file instanceof import_obsidian6.TFile))
            return;
          await host.app.vault.process(file, (content) => {
            const allLines = content.split("\n");
            const fileStart = sectionInfo.lineStart + schema.dataStartIndex;
            const dataLines = allLines.slice(fileStart, fileStart + rawDataLines.length);
            const dragged = dataLines.splice(fromIdx, 1)[0];
            let insertIdx = toIdx;
            if (fromIdx < toIdx)
              insertIdx--;
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
        host.renderCell(td, col, rawValue, context, schema, cells, async (newValue) => {
          if (rawIdx !== -1) {
            const updatedCells = splitRow(rawDataLines[rawIdx]);
            updatedCells[colIdx] = ` ${newValue} `;
            rawDataLines[rawIdx] = serializeRow(updatedCells);
          }
          await host.writeBack(context, sectionInfo, schema.dataStartIndex + rawIdx, colIdx, newValue);
        });
      });
    });
  };
  renderRows();
}

// src/renderer.ts
var ZiBaseTableRenderer = class {
  constructor(app, plugin) {
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
    if (schema.inferred && !this.plugin.settings.inferSchema)
      return;
    table.replaceWith(this.buildRichTable(schema, lines, context, sectionInfo));
  }
  buildRichTable(schema, lines, context, sectionInfo) {
    let currentView = "table";
    let collapsed = false;
    let filterQuery = "";
    let sortColIdx = null;
    let sortAsc = true;
    const rawDataLines = lines.slice(schema.dataStartIndex);
    const viewAnnotation = parseViewAnnotation(lines);
    if (viewAnnotation)
      currentView = viewAnnotation.view;
    const getDataRows = () => rawDataLines.filter(isDataRow);
    const wrapper = createDiv();
    wrapper.className = "zibase-wrapper";
    const topbar = wrapper.createDiv("zibase-topbar");
    const collapseBtn = topbar.createEl("button", { cls: "zibase-collapse-btn" });
    collapseBtn.empty();
    collapseBtn.insertAdjacentHTML(
      "beforeend",
      `<svg width="9" height="9" viewBox="0 0 9 9"><path d="M1.5 1.5 L7.5 4.5 L1.5 7.5 Z" fill="currentColor"/></svg>`
    );
    const topLeft = topbar.createDiv("zibase-topbar-left");
    topLeft.createSpan({ text: "\u27C1", cls: "zibase-logo" });
    const zibaseName = topLeft.createSpan({ text: "ZiBase", cls: "zibase-name zibase-name-btn" });
    const badge = topLeft.createSpan({
      cls: schema.inferred ? "zibase-inferred-badge" : "zibase-annotated-badge",
      text: schema.inferred ? "inferred" : "annotated"
    });
    const topRight = topbar.createDiv("zibase-topbar-right");
    const searchWrap = topRight.createDiv("zibase-search-wrap");
    searchWrap.empty();
    searchWrap.insertAdjacentHTML(
      "beforeend",
      `<svg class="zibase-search-icon" width="11" height="11" viewBox="0 0 16 16"><circle cx="6.5" cy="6.5" r="5" stroke="currentColor" stroke-width="1.5" fill="none"/><line x1="10.5" y1="10.5" x2="14" y2="14" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>`
    );
    const searchInput = searchWrap.createEl("input", { cls: "zibase-search", type: "text" });
    searchInput.placeholder = "Filter\u2026";
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
      `<svg width="10" height="10" viewBox="0 0 10 10"><line x1="5" y1="1" x2="5" y2="9" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/><line x1="1" y1="5" x2="9" y2="5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg> Add row`
    );
    addRowBtn.addEventListener("click", async () => await this.addRow(context, sectionInfo, schema));
    const rowCount = footer.createSpan({ cls: "zibase-row-count" });
    const updateCount = () => {
      const total = getDataRows().length;
      const visible = filterQuery ? getDataRows().filter((l) => splitRow(l).some((c) => c.toLowerCase().includes(filterQuery.toLowerCase()))).length : total;
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
            }
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
  showZiBaseMenu(e, schema, lines, context, sectionInfo, _rawDataLines, _badge, currentView, onViewChange) {
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
    const exportItem = menu.createDiv("zibase-dropdown-item zibase-dropdown-has-sub");
    exportItem.createSpan({ text: "Export", cls: "zibase-dropdown-label" });
    exportItem.createSpan({ text: "\u25B6", cls: "zibase-dropdown-arrow" });
    const exportSub = exportItem.createDiv("zibase-dropdown-sub");
    const exportOptions = [
      { icon: "\u{1F4CB}", label: "Copy as Markdown", action: () => this.copyAsMarkdown(schema, lines) },
      { icon: "\u{1F4E4}", label: "Export as CSV", action: () => void this.exportCSV(schema, lines, context) },
      { icon: "\u{1F5C4}\uFE0F", label: "Export as JSON", action: () => void this.exportJSON(schema, lines, context) }
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
    viewItem.createSpan({ text: "\u25B6", cls: "zibase-dropdown-arrow" });
    const viewSub = viewItem.createDiv("zibase-dropdown-sub");
    const viewOptions = [
      { icon: "\u{1F4CA}", label: "Table", view: "table" },
      { icon: "\u{1F4CB}", label: "Kanban", view: "kanban" },
      { icon: "\u{1F5BC}\uFE0F", label: "Gallery", view: "gallery" },
      { icon: "\u{1F4C5}", label: "Calendar", view: "calendar" }
    ];
    viewOptions.forEach(({ icon, label, view }) => {
      const item = viewSub.createDiv("zibase-dropdown-subitem");
      item.createSpan({ text: icon, cls: "zibase-dropdown-icon" });
      item.createSpan({ text: label });
      if (currentView === view) {
        item.classList.add("zibase-menu-active");
        item.createSpan({ text: " \u2713", cls: "zibase-view-check" });
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
    rulesItem.createSpan({ text: "\u25B6", cls: "zibase-dropdown-arrow" });
    const rulesSub = rulesItem.createDiv("zibase-dropdown-sub zibase-rules-sub");
    this.renderRulesPanel(rulesSub);
    const settingsItem = menu.createDiv("zibase-dropdown-item");
    settingsItem.createSpan({ text: "\u2699\uFE0F", cls: "zibase-dropdown-icon" });
    settingsItem.createSpan({ text: "Open Settings", cls: "zibase-dropdown-label" });
    settingsItem.addEventListener("click", () => {
      closeMenu();
      const app = this.app;
      app.setting.open();
      app.setting.openTabById("zibase");
    });
    document.body.appendChild(menu);
    window.setTimeout(() => {
      document.addEventListener("click", (ev) => {
        if (!menu.contains(ev.target))
          closeMenu();
      }, { signal: controller.signal });
    }, 10);
  }
  async persistViewAnnotation(context, sectionInfo, view) {
    const file = this.app.vault.getAbstractFileByPath(context.sourcePath);
    if (!(file instanceof import_obsidian7.TFile))
      return;
    await this.app.vault.process(file, (content) => {
      const allLines = content.split("\n");
      const searchStart = Math.max(0, sectionInfo.lineStart - 1);
      for (let i = searchStart; i <= Math.min(sectionInfo.lineStart, allLines.length - 1); i++) {
        if (VIEW_ANNOTATION_RE.test(allLines[i])) {
          if (view === "table")
            allLines.splice(i, 1);
          else
            allLines[i] = `<!-- zibase-view: ${view} -->`;
          return allLines.join("\n");
        }
      }
      if (view !== "table") {
        allLines.splice(sectionInfo.lineStart, 0, `<!-- zibase-view: ${view} -->`);
      }
      return allLines.join("\n");
    });
  }
  renderRulesPanel(container) {
    container.empty();
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
      COLUMN_TYPE_OPTIONS.forEach((t) => {
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
  copyAsMarkdown(schema, lines) {
    const dataRows = lines.slice(schema.dataStartIndex).filter(isDataRow);
    const header = "| " + schema.columns.map((c) => c.name).join(" | ") + " |";
    const separator = "| " + schema.columns.map(() => "---").join(" | ") + " |";
    const rows = dataRows.map((line) => {
      const cells = splitRow(line);
      return "| " + schema.columns.map((_, i) => {
        var _a;
        return (_a = cells[i]) != null ? _a : "";
      }).join(" | ") + " |";
    });
    void navigator.clipboard.writeText([header, separator, ...rows].join("\n"));
    showToast("\u{1F4CB} Copied as Markdown!");
  }
  async exportCSV(schema, lines, context) {
    const dataRows = lines.slice(schema.dataStartIndex).filter(isDataRow);
    const escape = (v) => `"${v.replace(/"/g, '""')}"`;
    const header = schema.columns.map((c) => escape(c.name)).join(",");
    const rows = dataRows.map((line) => {
      const cells = splitRow(line);
      return schema.columns.map((_, i) => {
        var _a;
        return escape(((_a = cells[i]) != null ? _a : "").trim());
      }).join(",");
    });
    const noteName = context.sourcePath.replace(/\.md$/, "");
    await this.saveFile(noteName + ".csv", [header, ...rows].join("\n"), context);
    showToast("\u{1F4E4} Exported as CSV!");
  }
  async exportJSON(schema, lines, context) {
    const dataRows = lines.slice(schema.dataStartIndex).filter(isDataRow);
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
    const noteName = context.sourcePath.replace(/\.md$/, "");
    await this.saveFile(noteName + ".json", JSON.stringify(records, null, 2), context);
    showToast("\u{1F5C4}\uFE0F Exported as JSON!");
  }
  async saveFile(filename, content, context) {
    var _a, _b, _c;
    const file = this.app.vault.getAbstractFileByPath(context.sourcePath);
    if (!(file instanceof import_obsidian7.TFile))
      return;
    const folder = (_b = (_a = file.parent) == null ? void 0 : _a.path) != null ? _b : "";
    const baseName = (_c = filename.split("/").pop()) != null ? _c : filename;
    const fullPath = folder ? `${folder}/${baseName}` : baseName;
    const existing = this.app.vault.getAbstractFileByPath(fullPath);
    if (existing instanceof import_obsidian7.TFile)
      await this.app.vault.modify(existing, content);
    else
      await this.app.vault.create(fullPath, content);
  }
  showTypeMenu(e, colIdx, schema, context, sectionInfo, _rawDataLines, badge) {
    var _a, _b;
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
      { label: "Multi-select", icon: "\u{1F3F7}\uFE0F", kind: "multi-select" },
      { label: "Number", icon: "#", kind: "number" },
      { label: "Date", icon: "\u{1F4C5}", kind: "date" },
      { label: "Formula", icon: "\u0192", kind: "formula" }
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
        var _a3, _b2, _c, _d, _e;
        closeMenu();
        if (kind === "select") {
          const currentOpts = ((_a3 = schema.columns[colIdx]) == null ? void 0 : _a3.type.kind) === "select" ? schema.columns[colIdx].type.options : [];
          new SelectOptionsModal(
            this.app,
            (_c = (_b2 = schema.columns[colIdx]) == null ? void 0 : _b2.name) != null ? _c : "Column",
            currentOpts,
            async (opts) => {
              await this.writeColumnType(context, sectionInfo, schema, colIdx, `select:${opts.join(",")}`, badge);
            }
          ).open();
        } else if (kind === "formula") {
          const colName = (_d = schema.columns[colIdx]) == null ? void 0 : _d.name;
          const currentExpr = ((_e = schema.columns[colIdx]) == null ? void 0 : _e.type.kind) === "formula" ? schema.columns[colIdx].type.expression : "";
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
        if (!menu.contains(ev.target))
          closeMenu();
      }, { signal: controller.signal });
    }, 10);
  }
  async writeColumnType(context, sectionInfo, schema, colIdx, typeStr, badge) {
    const file = this.app.vault.getAbstractFileByPath(context.sourcePath);
    if (!(file instanceof import_obsidian7.TFile))
      return;
    await this.app.vault.process(file, (content) => {
      const allLines = content.split("\n");
      if (schema.inferred) {
        const annotationCells = schema.columns.map((col, i) => {
          if (i === colIdx)
            return ` <!-- zibase: ${typeStr} --> `;
          if (col.type.kind === "formula")
            return ` <!-- zibase: formula:${col.type.expression} --> `;
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
  renderCell(td, col, rawValue, context, schema, rowCells, onChange) {
    renderCell(this, td, col, rawValue, context, schema, rowCells, onChange);
  }
  async writeBack(context, sectionInfo, tableRowIndex, colIndex, newValue) {
    const file = this.app.vault.getAbstractFileByPath(context.sourcePath);
    if (!(file instanceof import_obsidian7.TFile))
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
    if (!(file instanceof import_obsidian7.TFile))
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
      await import_obsidian7.MarkdownRenderer.renderMarkdown(newRaw, displaySpan, context.sourcePath, this.plugin);
      window.setTimeout(() => {
        displaySpan.querySelectorAll("a").forEach((a) => attachLinkTooltip(a));
      }, 50);
      displaySpan.classList.remove("zibase-text-empty");
    } else {
      displaySpan.textContent = "\u2014";
      displaySpan.classList.add("zibase-text-empty");
    }
  }
};

// src/version.ts
var PLUGIN_VERSION = "1.2.1";

// src/main.ts
var DEFAULT_SETTINGS = {
  renderInReadingView: true,
  inferSchema: true,
  columnRules: [...DEFAULT_COLUMN_RULES]
};
var ZiBasePlugin = class extends import_obsidian8.Plugin {
  constructor() {
    super(...arguments);
    this.settings = DEFAULT_SETTINGS;
  }
  async onload() {
    console.log(`ZiBase v${PLUGIN_VERSION} loaded \u2014 \u0BB4\u0BBF\u0BAF\u0BB2\u0BCD`);
    await this.loadSettings();
    this.renderer = new ZiBaseTableRenderer(this.app, this);
    if (this.settings.renderInReadingView) {
      this.registerMarkdownPostProcessor((element, context) => {
        this.renderer.processReadingView(element, context);
      });
    }
    this.addCommand({
      id: "insert-table",
      name: "Insert annotated table",
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
      id: "insert-plain-table",
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
      id: "insert-formula-table",
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
var ZiBaseSettingTab = class extends import_obsidian8.PluginSettingTab {
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
    new import_obsidian8.Setting(containerEl).setName("Render in Reading View").setDesc("Show rich UI when viewing notes in reading mode.").addToggle(
      (t) => t.setValue(this.plugin.settings.renderInReadingView).onChange(async (v) => {
        this.plugin.settings.renderInReadingView = v;
        await this.plugin.saveSettings();
      })
    );
    new import_obsidian8.Setting(containerEl).setName("Auto-infer schema").setDesc("Automatically detect column types from plain markdown tables. Turn off to only enhance annotated tables.").addToggle(
      (t) => t.setValue(this.plugin.settings.inferSchema).onChange(async (v) => {
        this.plugin.settings.inferSchema = v;
        await this.plugin.saveSettings();
      })
    );
    containerEl.createEl("h3", { text: "\u{1F3F7}\uFE0F Column Name Rules" });
    containerEl.createEl("p", {
      text: "When a column name matches, auto-assign that type. Applied to all inferred tables.",
      cls: "zibase-settings-desc"
    });
    const rulesContainer = containerEl.createDiv("zibase-rules-container");
    this.renderRules(rulesContainer);
    new import_obsidian8.Setting(containerEl).addButton(
      (btn) => btn.setButtonText("+ Add rule").setCta().onClick(async () => {
        this.plugin.settings.columnRules.push({ name: "", type: "label" });
        await this.plugin.saveSettings();
        this.renderRules(rulesContainer);
      })
    );
    new import_obsidian8.Setting(containerEl).setName("Reset to defaults").setDesc("Restore the original column name rules.").addButton(
      (btn) => btn.setButtonText("Reset").setWarning().onClick(async () => {
        this.plugin.settings.columnRules = [...DEFAULT_COLUMN_RULES];
        await this.plugin.saveSettings();
        this.renderRules(rulesContainer);
      })
    );
    containerEl.createEl("h3", { text: "\u2139\uFE0F About" });
    containerEl.createEl("p", { text: `ZiBase v${PLUGIN_VERSION} \u2014 Built by Rohith A (ZIYAL)`, cls: "zibase-settings-desc" });
    containerEl.createEl("p", { text: "Markdown-native database plugin.", cls: "zibase-settings-desc" });
  }
  renderRules(container) {
    container.empty();
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
      COLUMN_TYPE_OPTIONS.forEach((t) => {
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
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsic3JjL21haW4udHMiLCAic3JjL3NjaGVtYS50cyIsICJzcmMvcmVuZGVyZXIudHMiLCAic3JjL2NlbGxzLnRzIiwgInNyYy9mb3JtdWxhLnRzIiwgInNyYy9jb2xvcnMudHMiLCAic3JjL3VpLnRzIiwgInNyYy9tb2RhbHMudHMiLCAic3JjL21vZGVsLnRzIiwgInNyYy92aWV3cy9jYWxlbmRhci50cyIsICJzcmMvdmlld3MvZ2FsbGVyeS50cyIsICJzcmMvdmlld3Mva2FuYmFuLnRzIiwgInNyYy92aWV3cy90YWJsZS50cyIsICJzcmMvdmVyc2lvbi50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiaW1wb3J0IHsgUGx1Z2luLCBQbHVnaW5TZXR0aW5nVGFiLCBTZXR0aW5nLCB0eXBlIEFwcCwgdHlwZSBFZGl0b3IgfSBmcm9tIFwib2JzaWRpYW5cIjtcbmltcG9ydCB7IERFRkFVTFRfQ09MVU1OX1JVTEVTIH0gZnJvbSBcIi4vc2NoZW1hXCI7XG5pbXBvcnQgeyBaaUJhc2VUYWJsZVJlbmRlcmVyIH0gZnJvbSBcIi4vcmVuZGVyZXJcIjtcbmltcG9ydCB7IENPTFVNTl9UWVBFX09QVElPTlMsIHR5cGUgQ29sdW1uUnVsZSwgdHlwZSBaaUJhc2VTZXR0aW5ncyB9IGZyb20gXCIuL21vZGVsXCI7XG5pbXBvcnQgeyBQTFVHSU5fVkVSU0lPTiB9IGZyb20gXCIuL3ZlcnNpb25cIjtcblxuY29uc3QgREVGQVVMVF9TRVRUSU5HUzogWmlCYXNlU2V0dGluZ3MgPSB7XG4gIHJlbmRlckluUmVhZGluZ1ZpZXc6IHRydWUsXG4gIGluZmVyU2NoZW1hOiB0cnVlLFxuICBjb2x1bW5SdWxlczogWy4uLkRFRkFVTFRfQ09MVU1OX1JVTEVTXSxcbn07XG5cbmV4cG9ydCBkZWZhdWx0IGNsYXNzIFppQmFzZVBsdWdpbiBleHRlbmRzIFBsdWdpbiB7XG4gIHNldHRpbmdzOiBaaUJhc2VTZXR0aW5ncyA9IERFRkFVTFRfU0VUVElOR1M7XG4gIHJlbmRlcmVyITogWmlCYXNlVGFibGVSZW5kZXJlcjtcblxuICBhc3luYyBvbmxvYWQoKTogUHJvbWlzZTx2b2lkPiB7XG4gICAgY29uc29sZS5sb2coYFppQmFzZSB2JHtQTFVHSU5fVkVSU0lPTn0gbG9hZGVkIFx1MjAxNCBcdTBCQjRcdTBCQkZcdTBCQUZcdTBCQjJcdTBCQ0RgKTtcbiAgICBhd2FpdCB0aGlzLmxvYWRTZXR0aW5ncygpO1xuICAgIHRoaXMucmVuZGVyZXIgPSBuZXcgWmlCYXNlVGFibGVSZW5kZXJlcih0aGlzLmFwcCwgdGhpcyk7XG4gICAgaWYgKHRoaXMuc2V0dGluZ3MucmVuZGVySW5SZWFkaW5nVmlldykge1xuICAgICAgdGhpcy5yZWdpc3Rlck1hcmtkb3duUG9zdFByb2Nlc3NvcigoZWxlbWVudCwgY29udGV4dCkgPT4ge1xuICAgICAgICB0aGlzLnJlbmRlcmVyLnByb2Nlc3NSZWFkaW5nVmlldyhlbGVtZW50LCBjb250ZXh0KTtcbiAgICAgIH0pO1xuICAgIH1cbiAgICB0aGlzLmFkZENvbW1hbmQoe1xuICAgICAgaWQ6IFwiaW5zZXJ0LXRhYmxlXCIsXG4gICAgICBuYW1lOiBcIkluc2VydCBhbm5vdGF0ZWQgdGFibGVcIixcbiAgICAgIGVkaXRvckNhbGxiYWNrOiAoZWRpdG9yOiBFZGl0b3IpID0+IHtcbiAgICAgICAgY29uc3QgdGVtcGxhdGUgPSBbXG4gICAgICAgICAgXCJ8IE5hbWUgfCBTdGF0dXMgfCBQcmlvcml0eSB8IFRhZ3MgfFwiLFxuICAgICAgICAgIFwifC0tLS0tLXwtLS0tLS0tLXwtLS0tLS0tLS0tfC0tLS0tLXxcIixcbiAgICAgICAgICBcInwgPCEtLSB6aWJhc2U6IHRleHQgLS0+IHwgPCEtLSB6aWJhc2U6IHRvZ2dsZSAtLT4gfCA8IS0tIHppYmFzZTogc2VsZWN0OkxvdyxNZWRpdW0sSGlnaCAtLT4gfCA8IS0tIHppYmFzZTogbGFiZWwgLS0+IHxcIixcbiAgICAgICAgICBcInwgSXRlbSAxIHwgdHJ1ZSB8IEhpZ2ggfCBiaW9sb2d5IHxcIixcbiAgICAgICAgICBcInwgSXRlbSAyIHwgZmFsc2UgfCBMb3cgfCBjaGVtaXN0cnkgfFwiLFxuICAgICAgICBdLmpvaW4oXCJcXG5cIik7XG4gICAgICAgIGVkaXRvci5yZXBsYWNlU2VsZWN0aW9uKHRlbXBsYXRlKTtcbiAgICAgIH0sXG4gICAgfSk7XG4gICAgdGhpcy5hZGRDb21tYW5kKHtcbiAgICAgIGlkOiBcImluc2VydC1wbGFpbi10YWJsZVwiLFxuICAgICAgbmFtZTogXCJJbnNlcnQgcGxhaW4gdGFibGUgKGF1dG8taW5mZXJyZWQpXCIsXG4gICAgICBlZGl0b3JDYWxsYmFjazogKGVkaXRvcjogRWRpdG9yKSA9PiB7XG4gICAgICAgIGNvbnN0IHRlbXBsYXRlID0gW1xuICAgICAgICAgIFwifCBOYW1lIHwgRG9uZSB8IFNjb3JlIHwgQ2F0ZWdvcnkgfFwiLFxuICAgICAgICAgIFwifC0tLS0tLXwtLS0tLS18LS0tLS0tLXwtLS0tLS0tLS0tfFwiLFxuICAgICAgICAgIFwifCBUYXNrIEEgfCB0cnVlIHwgOTAgfCBXb3JrIHxcIixcbiAgICAgICAgICBcInwgVGFzayBCIHwgZmFsc2UgfCA3NSB8IFdvcmsgfFwiLFxuICAgICAgICAgIFwifCBUYXNrIEMgfCB0cnVlIHwgODIgfCBQZXJzb25hbCB8XCIsXG4gICAgICAgIF0uam9pbihcIlxcblwiKTtcbiAgICAgICAgZWRpdG9yLnJlcGxhY2VTZWxlY3Rpb24odGVtcGxhdGUpO1xuICAgICAgfSxcbiAgICB9KTtcbiAgICB0aGlzLmFkZENvbW1hbmQoe1xuICAgICAgaWQ6IFwiaW5zZXJ0LWZvcm11bGEtdGFibGVcIixcbiAgICAgIG5hbWU6IFwiSW5zZXJ0IHRhYmxlIHdpdGggZm9ybXVsYSBjb2x1bW5cIixcbiAgICAgIGVkaXRvckNhbGxiYWNrOiAoZWRpdG9yOiBFZGl0b3IpID0+IHtcbiAgICAgICAgY29uc3QgdGVtcGxhdGUgPSBbXG4gICAgICAgICAgXCJ8IEl0ZW0gfCBQcmljZSB8IFF0eSB8IFRvdGFsIHxcIixcbiAgICAgICAgICBcInwtLS0tLS18LS0tLS0tLXwtLS0tLXwtLS0tLS0tfFwiLFxuICAgICAgICAgIFwifCA8IS0tIHppYmFzZTogdGV4dCAtLT4gfCA8IS0tIHppYmFzZTogbnVtYmVyIC0tPiB8IDwhLS0gemliYXNlOiBudW1iZXIgLS0+IHwgPCEtLSB6aWJhc2U6IGZvcm11bGE6UHJpY2UgKiBRdHkgLS0+IHxcIixcbiAgICAgICAgICBcInwgUGVuIHwgMTAgfCA1IHwgIHxcIixcbiAgICAgICAgICBcInwgQm9vayB8IDI1MCB8IDIgfCAgfFwiLFxuICAgICAgICAgIFwifCBFcmFzZXIgfCA1IHwgMTAgfCAgfFwiLFxuICAgICAgICBdLmpvaW4oXCJcXG5cIik7XG4gICAgICAgIGVkaXRvci5yZXBsYWNlU2VsZWN0aW9uKHRlbXBsYXRlKTtcbiAgICAgIH0sXG4gICAgfSk7XG4gICAgdGhpcy5hZGRTZXR0aW5nVGFiKG5ldyBaaUJhc2VTZXR0aW5nVGFiKHRoaXMuYXBwLCB0aGlzKSk7XG4gIH1cblxuICBhc3luYyBsb2FkU2V0dGluZ3MoKTogUHJvbWlzZTx2b2lkPiB7XG4gICAgdGhpcy5zZXR0aW5ncyA9IE9iamVjdC5hc3NpZ24oe30sIERFRkFVTFRfU0VUVElOR1MsIGF3YWl0IHRoaXMubG9hZERhdGEoKSkgYXMgWmlCYXNlU2V0dGluZ3M7XG4gICAgaWYgKCF0aGlzLnNldHRpbmdzLmNvbHVtblJ1bGVzIHx8IHRoaXMuc2V0dGluZ3MuY29sdW1uUnVsZXMubGVuZ3RoID09PSAwKSB7XG4gICAgICB0aGlzLnNldHRpbmdzLmNvbHVtblJ1bGVzID0gWy4uLkRFRkFVTFRfQ09MVU1OX1JVTEVTXTtcbiAgICB9XG4gIH1cblxuICBhc3luYyBzYXZlU2V0dGluZ3MoKTogUHJvbWlzZTx2b2lkPiB7XG4gICAgYXdhaXQgdGhpcy5zYXZlRGF0YSh0aGlzLnNldHRpbmdzKTtcbiAgfVxufVxuXG5jbGFzcyBaaUJhc2VTZXR0aW5nVGFiIGV4dGVuZHMgUGx1Z2luU2V0dGluZ1RhYiB7XG4gIHBsdWdpbjogWmlCYXNlUGx1Z2luO1xuXG4gIGNvbnN0cnVjdG9yKGFwcDogQXBwLCBwbHVnaW46IFppQmFzZVBsdWdpbikge1xuICAgIHN1cGVyKGFwcCwgcGx1Z2luKTtcbiAgICB0aGlzLnBsdWdpbiA9IHBsdWdpbjtcbiAgfVxuXG4gIGRpc3BsYXkoKTogdm9pZCB7XG4gICAgY29uc3QgeyBjb250YWluZXJFbCB9ID0gdGhpcztcbiAgICBjb250YWluZXJFbC5lbXB0eSgpO1xuICAgIGNvbnRhaW5lckVsLmNyZWF0ZUVsKFwiaDJcIiwgeyB0ZXh0OiBcIlppQmFzZSBcdTIwMTQgXHUwQkI0XHUwQkJGXHUwQkFGXHUwQkIyXHUwQkNEXCIgfSk7XG4gICAgY29udGFpbmVyRWwuY3JlYXRlRWwoXCJwXCIsIHtcbiAgICAgIHRleHQ6IFwiTWFya2Rvd24gdGFibGVzIGFzIGxpdmluZyBkYXRhYmFzZXMuXCIsXG4gICAgICBjbHM6IFwiemliYXNlLXNldHRpbmdzLWRlc2NcIixcbiAgICB9KTtcbiAgICBjb250YWluZXJFbC5jcmVhdGVFbChcImgzXCIsIHsgdGV4dDogXCJcdTI2OTlcdUZFMEYgR2VuZXJhbFwiIH0pO1xuICAgIG5ldyBTZXR0aW5nKGNvbnRhaW5lckVsKVxuICAgICAgLnNldE5hbWUoXCJSZW5kZXIgaW4gUmVhZGluZyBWaWV3XCIpXG4gICAgICAuc2V0RGVzYyhcIlNob3cgcmljaCBVSSB3aGVuIHZpZXdpbmcgbm90ZXMgaW4gcmVhZGluZyBtb2RlLlwiKVxuICAgICAgLmFkZFRvZ2dsZSgodCkgPT5cbiAgICAgICAgdC5zZXRWYWx1ZSh0aGlzLnBsdWdpbi5zZXR0aW5ncy5yZW5kZXJJblJlYWRpbmdWaWV3KS5vbkNoYW5nZShhc3luYyAodikgPT4ge1xuICAgICAgICAgIHRoaXMucGx1Z2luLnNldHRpbmdzLnJlbmRlckluUmVhZGluZ1ZpZXcgPSB2O1xuICAgICAgICAgIGF3YWl0IHRoaXMucGx1Z2luLnNhdmVTZXR0aW5ncygpO1xuICAgICAgICB9KSxcbiAgICAgICk7XG4gICAgbmV3IFNldHRpbmcoY29udGFpbmVyRWwpXG4gICAgICAuc2V0TmFtZShcIkF1dG8taW5mZXIgc2NoZW1hXCIpXG4gICAgICAuc2V0RGVzYyhcIkF1dG9tYXRpY2FsbHkgZGV0ZWN0IGNvbHVtbiB0eXBlcyBmcm9tIHBsYWluIG1hcmtkb3duIHRhYmxlcy4gVHVybiBvZmYgdG8gb25seSBlbmhhbmNlIGFubm90YXRlZCB0YWJsZXMuXCIpXG4gICAgICAuYWRkVG9nZ2xlKCh0KSA9PlxuICAgICAgICB0LnNldFZhbHVlKHRoaXMucGx1Z2luLnNldHRpbmdzLmluZmVyU2NoZW1hKS5vbkNoYW5nZShhc3luYyAodikgPT4ge1xuICAgICAgICAgIHRoaXMucGx1Z2luLnNldHRpbmdzLmluZmVyU2NoZW1hID0gdjtcbiAgICAgICAgICBhd2FpdCB0aGlzLnBsdWdpbi5zYXZlU2V0dGluZ3MoKTtcbiAgICAgICAgfSksXG4gICAgICApO1xuICAgIGNvbnRhaW5lckVsLmNyZWF0ZUVsKFwiaDNcIiwgeyB0ZXh0OiBcIlx1RDgzQ1x1REZGN1x1RkUwRiBDb2x1bW4gTmFtZSBSdWxlc1wiIH0pO1xuICAgIGNvbnRhaW5lckVsLmNyZWF0ZUVsKFwicFwiLCB7XG4gICAgICB0ZXh0OiBcIldoZW4gYSBjb2x1bW4gbmFtZSBtYXRjaGVzLCBhdXRvLWFzc2lnbiB0aGF0IHR5cGUuIEFwcGxpZWQgdG8gYWxsIGluZmVycmVkIHRhYmxlcy5cIixcbiAgICAgIGNsczogXCJ6aWJhc2Utc2V0dGluZ3MtZGVzY1wiLFxuICAgIH0pO1xuICAgIGNvbnN0IHJ1bGVzQ29udGFpbmVyID0gY29udGFpbmVyRWwuY3JlYXRlRGl2KFwiemliYXNlLXJ1bGVzLWNvbnRhaW5lclwiKTtcbiAgICB0aGlzLnJlbmRlclJ1bGVzKHJ1bGVzQ29udGFpbmVyKTtcbiAgICBuZXcgU2V0dGluZyhjb250YWluZXJFbCkuYWRkQnV0dG9uKChidG4pID0+XG4gICAgICBidG4uc2V0QnV0dG9uVGV4dChcIisgQWRkIHJ1bGVcIikuc2V0Q3RhKCkub25DbGljayhhc3luYyAoKSA9PiB7XG4gICAgICAgIHRoaXMucGx1Z2luLnNldHRpbmdzLmNvbHVtblJ1bGVzLnB1c2goeyBuYW1lOiBcIlwiLCB0eXBlOiBcImxhYmVsXCIgfSk7XG4gICAgICAgIGF3YWl0IHRoaXMucGx1Z2luLnNhdmVTZXR0aW5ncygpO1xuICAgICAgICB0aGlzLnJlbmRlclJ1bGVzKHJ1bGVzQ29udGFpbmVyKTtcbiAgICAgIH0pLFxuICAgICk7XG4gICAgbmV3IFNldHRpbmcoY29udGFpbmVyRWwpXG4gICAgICAuc2V0TmFtZShcIlJlc2V0IHRvIGRlZmF1bHRzXCIpXG4gICAgICAuc2V0RGVzYyhcIlJlc3RvcmUgdGhlIG9yaWdpbmFsIGNvbHVtbiBuYW1lIHJ1bGVzLlwiKVxuICAgICAgLmFkZEJ1dHRvbigoYnRuKSA9PlxuICAgICAgICBidG4uc2V0QnV0dG9uVGV4dChcIlJlc2V0XCIpLnNldFdhcm5pbmcoKS5vbkNsaWNrKGFzeW5jICgpID0+IHtcbiAgICAgICAgICB0aGlzLnBsdWdpbi5zZXR0aW5ncy5jb2x1bW5SdWxlcyA9IFsuLi5ERUZBVUxUX0NPTFVNTl9SVUxFU107XG4gICAgICAgICAgYXdhaXQgdGhpcy5wbHVnaW4uc2F2ZVNldHRpbmdzKCk7XG4gICAgICAgICAgdGhpcy5yZW5kZXJSdWxlcyhydWxlc0NvbnRhaW5lcik7XG4gICAgICAgIH0pLFxuICAgICAgKTtcbiAgICBjb250YWluZXJFbC5jcmVhdGVFbChcImgzXCIsIHsgdGV4dDogXCJcdTIxMzlcdUZFMEYgQWJvdXRcIiB9KTtcbiAgICBjb250YWluZXJFbC5jcmVhdGVFbChcInBcIiwgeyB0ZXh0OiBgWmlCYXNlIHYke1BMVUdJTl9WRVJTSU9OfSBcdTIwMTQgQnVpbHQgYnkgUm9oaXRoIEEgKFpJWUFMKWAsIGNsczogXCJ6aWJhc2Utc2V0dGluZ3MtZGVzY1wiIH0pO1xuICAgIGNvbnRhaW5lckVsLmNyZWF0ZUVsKFwicFwiLCB7IHRleHQ6IFwiTWFya2Rvd24tbmF0aXZlIGRhdGFiYXNlIHBsdWdpbi5cIiwgY2xzOiBcInppYmFzZS1zZXR0aW5ncy1kZXNjXCIgfSk7XG4gIH1cblxuICByZW5kZXJSdWxlcyhjb250YWluZXI6IEhUTUxFbGVtZW50KTogdm9pZCB7XG4gICAgY29udGFpbmVyLmVtcHR5KCk7XG4gICAgdGhpcy5wbHVnaW4uc2V0dGluZ3MuY29sdW1uUnVsZXMuZm9yRWFjaCgocnVsZTogQ29sdW1uUnVsZSwgaWR4OiBudW1iZXIpID0+IHtcbiAgICAgIGNvbnN0IHJvdyA9IGNvbnRhaW5lci5jcmVhdGVEaXYoXCJ6aWJhc2UtcnVsZS1yb3dcIik7XG4gICAgICBjb25zdCBuYW1lSW5wdXQgPSByb3cuY3JlYXRlRWwoXCJpbnB1dFwiLCB7IHR5cGU6IFwidGV4dFwiLCBjbHM6IFwiemliYXNlLXJ1bGUtbmFtZVwiLCB2YWx1ZTogcnVsZS5uYW1lIH0pO1xuICAgICAgbmFtZUlucHV0LnBsYWNlaG9sZGVyID0gXCJjb2x1bW4gbmFtZVwiO1xuICAgICAgbmFtZUlucHV0LmFkZEV2ZW50TGlzdGVuZXIoXCJjaGFuZ2VcIiwgYXN5bmMgKCkgPT4ge1xuICAgICAgICB0aGlzLnBsdWdpbi5zZXR0aW5ncy5jb2x1bW5SdWxlc1tpZHhdLm5hbWUgPSBuYW1lSW5wdXQudmFsdWUudHJpbSgpO1xuICAgICAgICBhd2FpdCB0aGlzLnBsdWdpbi5zYXZlU2V0dGluZ3MoKTtcbiAgICAgIH0pO1xuICAgICAgcm93LmNyZWF0ZVNwYW4oeyB0ZXh0OiBcIlx1MjE5MlwiLCBjbHM6IFwiemliYXNlLXJ1bGUtYXJyb3dcIiB9KTtcbiAgICAgIGNvbnN0IHR5cGVTZWxlY3QgPSByb3cuY3JlYXRlRWwoXCJzZWxlY3RcIiwgeyBjbHM6IFwiemliYXNlLXJ1bGUtdHlwZVwiIH0pO1xuICAgICAgQ09MVU1OX1RZUEVfT1BUSU9OUy5mb3JFYWNoKCh0KSA9PiB7XG4gICAgICAgIGNvbnN0IG9wdCA9IHR5cGVTZWxlY3QuY3JlYXRlRWwoXCJvcHRpb25cIiwgeyB0ZXh0OiB0LCB2YWx1ZTogdCB9KTtcbiAgICAgICAgaWYgKHQgPT09IHJ1bGUudHlwZSkgb3B0LnNlbGVjdGVkID0gdHJ1ZTtcbiAgICAgIH0pO1xuICAgICAgdHlwZVNlbGVjdC5hZGRFdmVudExpc3RlbmVyKFwiY2hhbmdlXCIsIGFzeW5jICgpID0+IHtcbiAgICAgICAgdGhpcy5wbHVnaW4uc2V0dGluZ3MuY29sdW1uUnVsZXNbaWR4XS50eXBlID0gdHlwZVNlbGVjdC52YWx1ZTtcbiAgICAgICAgYXdhaXQgdGhpcy5wbHVnaW4uc2F2ZVNldHRpbmdzKCk7XG4gICAgICB9KTtcbiAgICAgIGNvbnN0IHJlbW92ZUJ0biA9IHJvdy5jcmVhdGVFbChcImJ1dHRvblwiLCB7IHRleHQ6IFwiXHUwMEQ3XCIsIGNsczogXCJ6aWJhc2UtcnVsZS1yZW1vdmVcIiB9KTtcbiAgICAgIHJlbW92ZUJ0bi5hZGRFdmVudExpc3RlbmVyKFwiY2xpY2tcIiwgYXN5bmMgKCkgPT4ge1xuICAgICAgICB0aGlzLnBsdWdpbi5zZXR0aW5ncy5jb2x1bW5SdWxlcy5zcGxpY2UoaWR4LCAxKTtcbiAgICAgICAgYXdhaXQgdGhpcy5wbHVnaW4uc2F2ZVNldHRpbmdzKCk7XG4gICAgICAgIHRoaXMucmVuZGVyUnVsZXMoY29udGFpbmVyKTtcbiAgICAgIH0pO1xuICAgIH0pO1xuICB9XG59XG4iLCAiaW1wb3J0IHR5cGUgeyBDb2x1bW5SdWxlLCBDb2x1bW5UeXBlLCBUYWJsZVNjaGVtYSwgVmlld05hbWUgfSBmcm9tIFwiLi9tb2RlbFwiO1xuXG5leHBvcnQgY29uc3QgQU5OT1RBVElPTl9SRSA9IC88IS0tXFxzKnppYmFzZTpcXHMqKFteXFxzPl0rKD86XFxzKlteXFxzPl0rKSopXFxzKi0tPi9pO1xuZXhwb3J0IGNvbnN0IFZJRVdfQU5OT1RBVElPTl9SRSA9IC88IS0tXFxzKnppYmFzZS12aWV3OlxccyooXFx3KykoPzo6KFtePl0rKSk/XFxzKi0tPi9pO1xuZXhwb3J0IGNvbnN0IERBVEVfUkUgPSAvXlxcZHs0fS1cXGR7Mn0tXFxkezJ9JC87XG5leHBvcnQgY29uc3QgTlVNQkVSX1JFID0gL14tP1xcZCsoXFwuXFxkKyk/JC87XG5cbmV4cG9ydCBjb25zdCBERUZBVUxUX0NPTFVNTl9SVUxFUzogQ29sdW1uUnVsZVtdID0gW1xuICB7IG5hbWU6IFwiZG9tYWluXCIsIHR5cGU6IFwibGFiZWxcIiB9LFxuICB7IG5hbWU6IFwiY2F0ZWdvcnlcIiwgdHlwZTogXCJsYWJlbFwiIH0sXG4gIHsgbmFtZTogXCJ0YWdcIiwgdHlwZTogXCJsYWJlbFwiIH0sXG4gIHsgbmFtZTogXCJ0YWdzXCIsIHR5cGU6IFwibXVsdGktc2VsZWN0XCIgfSxcbiAgeyBuYW1lOiBcInR5cGVcIiwgdHlwZTogXCJsYWJlbFwiIH0sXG4gIHsgbmFtZTogXCJsYWJlbFwiLCB0eXBlOiBcImxhYmVsXCIgfSxcbiAgeyBuYW1lOiBcImxhYmVsc1wiLCB0eXBlOiBcIm11bHRpLXNlbGVjdFwiIH0sXG4gIHsgbmFtZTogXCJkb25lXCIsIHR5cGU6IFwidG9nZ2xlXCIgfSxcbiAgeyBuYW1lOiBcImNvbXBsZXRlZFwiLCB0eXBlOiBcInRvZ2dsZVwiIH0sXG4gIHsgbmFtZTogXCJzdGF0dXNcIiwgdHlwZTogXCJzZWxlY3RcIiB9LFxuXTtcblxuZXhwb3J0IGZ1bmN0aW9uIHBhcnNlWmlCYXNlU2NoZW1hKFxuICBsaW5lczogc3RyaW5nW10sXG4gIGNvbHVtblJ1bGVzOiBDb2x1bW5SdWxlW10gPSBERUZBVUxUX0NPTFVNTl9SVUxFUyxcbik6IFRhYmxlU2NoZW1hIHwgbnVsbCB7XG4gIGlmIChsaW5lcy5sZW5ndGggPCAyKSByZXR1cm4gbnVsbDtcblxuICBjb25zdCBoZWFkZXJDZWxscyA9IHNwbGl0Um93KGxpbmVzWzBdKTtcbiAgaWYgKGhlYWRlckNlbGxzLmxlbmd0aCA9PT0gMCkgcmV0dXJuIG51bGw7XG5cbiAgaWYgKGxpbmVzLmxlbmd0aCA+PSAzKSB7XG4gICAgY29uc3Qgc2NoZW1hQ2VsbHMgPSBzcGxpdFJvdyhsaW5lc1syXSk7XG4gICAgY29uc3QgaGFzQW5ub3RhdGlvbnMgPSBzY2hlbWFDZWxscy5zb21lKChjKSA9PiBBTk5PVEFUSU9OX1JFLnRlc3QoYykpO1xuICAgIGlmIChoYXNBbm5vdGF0aW9ucykge1xuICAgICAgY29uc3QgY29sdW1ucyA9IGhlYWRlckNlbGxzLm1hcCgobmFtZSwgaSkgPT4ge1xuICAgICAgICBjb25zdCBjZWxsID0gc2NoZW1hQ2VsbHNbaV0gPz8gXCJcIjtcbiAgICAgICAgY29uc3QgbWF0Y2ggPSBjZWxsLm1hdGNoKEFOTk9UQVRJT05fUkUpO1xuICAgICAgICBjb25zdCB0eXBlU3RyID0gbWF0Y2ggPyBtYXRjaFsxXSA6IFwidGV4dFwiO1xuICAgICAgICByZXR1cm4geyBuYW1lOiBuYW1lLnRyaW0oKSwgdHlwZTogcGFyc2VUeXBlKHR5cGVTdHIpLCBpbmRleDogaSB9O1xuICAgICAgfSk7XG4gICAgICByZXR1cm4geyBjb2x1bW5zLCBzY2hlbWFSb3dJbmRleDogMiwgZGF0YVN0YXJ0SW5kZXg6IDMsIGluZmVycmVkOiBmYWxzZSB9O1xuICAgIH1cbiAgfVxuXG4gIGlmIChsaW5lcy5sZW5ndGggPCAzKSByZXR1cm4gbnVsbDtcblxuICBjb25zdCBkYXRhTGluZXMgPSBsaW5lcy5zbGljZSgyKS5maWx0ZXIoKGwpID0+IGwudHJpbSgpICYmIGwuaW5jbHVkZXMoXCJ8XCIpKTtcbiAgaWYgKGRhdGFMaW5lcy5sZW5ndGggPT09IDApIHJldHVybiBudWxsO1xuXG4gIGNvbnN0IGNvbFZhbHVlczogc3RyaW5nW11bXSA9IGhlYWRlckNlbGxzLm1hcCgoKSA9PiBbXSk7XG4gIGRhdGFMaW5lcy5mb3JFYWNoKChsaW5lKSA9PiB7XG4gICAgY29uc3QgY2VsbHMgPSBzcGxpdFJvdyhsaW5lKTtcbiAgICBoZWFkZXJDZWxscy5mb3JFYWNoKChfLCBpKSA9PiB7XG4gICAgICBjb25zdCB2ID0gKGNlbGxzW2ldID8/IFwiXCIpLnRyaW0oKTtcbiAgICAgIGlmICh2KSBjb2xWYWx1ZXNbaV0ucHVzaCh2KTtcbiAgICB9KTtcbiAgfSk7XG5cbiAgY29uc3QgY29sdW1ucyA9IGhlYWRlckNlbGxzLm1hcCgobmFtZSwgaSkgPT4gKHtcbiAgICBuYW1lOiBuYW1lLnRyaW0oKSxcbiAgICB0eXBlOiBpbmZlclR5cGUobmFtZS50cmltKCksIGNvbFZhbHVlc1tpXSwgY29sdW1uUnVsZXMpLFxuICAgIGluZGV4OiBpLFxuICB9KSk7XG4gIHJldHVybiB7IGNvbHVtbnMsIHNjaGVtYVJvd0luZGV4OiBudWxsLCBkYXRhU3RhcnRJbmRleDogMiwgaW5mZXJyZWQ6IHRydWUgfTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIHBhcnNlVmlld0Fubm90YXRpb24oXG4gIGxpbmVzOiBzdHJpbmdbXSxcbik6IHsgdmlldzogVmlld05hbWUgfCBzdHJpbmc7IGdyb3VwQnk6IHN0cmluZyB8IG51bGwgfSB8IG51bGwge1xuICBmb3IgKGxldCBpID0gMDsgaSA8IE1hdGgubWluKGxpbmVzLmxlbmd0aCwgMyk7IGkrKykge1xuICAgIGNvbnN0IG1hdGNoID0gbGluZXNbaV0ubWF0Y2goVklFV19BTk5PVEFUSU9OX1JFKTtcbiAgICBpZiAobWF0Y2gpIHtcbiAgICAgIHJldHVybiB7IHZpZXc6IG1hdGNoWzFdLnRvTG93ZXJDYXNlKCksIGdyb3VwQnk6IG1hdGNoWzJdID8gbWF0Y2hbMl0udHJpbSgpIDogbnVsbCB9O1xuICAgIH1cbiAgfVxuICByZXR1cm4gbnVsbDtcbn1cblxuZnVuY3Rpb24gaW5mZXJUeXBlKGNvbE5hbWU6IHN0cmluZywgdmFsdWVzOiBzdHJpbmdbXSwgY29sdW1uUnVsZXM6IENvbHVtblJ1bGVbXSk6IENvbHVtblR5cGUge1xuICBpZiAodmFsdWVzLmxlbmd0aCA9PT0gMCkgcmV0dXJuIHsga2luZDogXCJ0ZXh0XCIgfTtcbiAgaWYgKHZhbHVlcy5ldmVyeSgodikgPT4gdi50b0xvd2VyQ2FzZSgpID09PSBcInRydWVcIiB8fCB2LnRvTG93ZXJDYXNlKCkgPT09IFwiZmFsc2VcIikpIHtcbiAgICByZXR1cm4geyBraW5kOiBcInRvZ2dsZVwiIH07XG4gIH1cbiAgaWYgKHZhbHVlcy5ldmVyeSgodikgPT4gREFURV9SRS50ZXN0KHYpKSkgcmV0dXJuIHsga2luZDogXCJkYXRlXCIgfTtcbiAgaWYgKHZhbHVlcy5ldmVyeSgodikgPT4gTlVNQkVSX1JFLnRlc3QodikpKSByZXR1cm4geyBraW5kOiBcIm51bWJlclwiIH07XG5cbiAgY29uc3QgcnVsZSA9IGNvbHVtblJ1bGVzLmZpbmQoKHIpID0+IHIubmFtZS50b0xvd2VyQ2FzZSgpID09PSBjb2xOYW1lLnRvTG93ZXJDYXNlKCkpO1xuICBpZiAocnVsZSkgcmV0dXJuIHBhcnNlVHlwZShydWxlLnR5cGUpO1xuXG4gIGNvbnN0IHVuaXF1ZSA9IFsuLi5uZXcgU2V0KHZhbHVlcy5tYXAoKHYpID0+IHYudG9Mb3dlckNhc2UoKSkpXTtcbiAgY29uc3QgYWxsU2hvcnQgPSB2YWx1ZXMuZXZlcnkoKHYpID0+IHYubGVuZ3RoIDw9IDIwKTtcbiAgY29uc3QgaXNSZXBlYXRlZCA9XG4gICAgdmFsdWVzLmxlbmd0aCA+PSAyICYmXG4gICAgdW5pcXVlLmxlbmd0aCA8PSBNYXRoLm1heCgyLCBNYXRoLmZsb29yKHZhbHVlcy5sZW5ndGggKiAwLjc1KSkgJiZcbiAgICB1bmlxdWUubGVuZ3RoIDw9IDEwO1xuICBpZiAoaXNSZXBlYXRlZCAmJiBhbGxTaG9ydCkge1xuICAgIGNvbnN0IHNlZW4gPSBuZXcgTWFwPHN0cmluZywgc3RyaW5nPigpO1xuICAgIHZhbHVlcy5mb3JFYWNoKCh2KSA9PiB7XG4gICAgICBpZiAoIXNlZW4uaGFzKHYudG9Mb3dlckNhc2UoKSkpIHNlZW4uc2V0KHYudG9Mb3dlckNhc2UoKSwgdik7XG4gICAgfSk7XG4gICAgcmV0dXJuIHsga2luZDogXCJzZWxlY3RcIiwgb3B0aW9uczogWy4uLnNlZW4udmFsdWVzKCldIH07XG4gIH1cbiAgcmV0dXJuIHsga2luZDogXCJ0ZXh0XCIgfTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIHBhcnNlVHlwZSh0eXBlU3RyOiBzdHJpbmcpOiBDb2x1bW5UeXBlIHtcbiAgaWYgKHR5cGVTdHIuc3RhcnRzV2l0aChcInNlbGVjdDpcIikpIHtcbiAgICBjb25zdCBvcHRpb25zID0gdHlwZVN0ci5zbGljZSg3KS5zcGxpdChcIixcIikubWFwKChzKSA9PiBzLnRyaW0oKSk7XG4gICAgcmV0dXJuIHsga2luZDogXCJzZWxlY3RcIiwgb3B0aW9ucyB9O1xuICB9XG4gIGlmICh0eXBlU3RyLnN0YXJ0c1dpdGgoXCJmb3JtdWxhOlwiKSkge1xuICAgIGNvbnN0IGV4cHJlc3Npb24gPSB0eXBlU3RyLnNsaWNlKDgpLnRyaW0oKTtcbiAgICByZXR1cm4geyBraW5kOiBcImZvcm11bGFcIiwgZXhwcmVzc2lvbiB9O1xuICB9XG4gIHN3aXRjaCAodHlwZVN0ci50b0xvd2VyQ2FzZSgpKSB7XG4gICAgY2FzZSBcInRvZ2dsZVwiOlxuICAgICAgcmV0dXJuIHsga2luZDogXCJ0b2dnbGVcIiB9O1xuICAgIGNhc2UgXCJsYWJlbFwiOlxuICAgICAgcmV0dXJuIHsga2luZDogXCJsYWJlbFwiIH07XG4gICAgY2FzZSBcIm11bHRpLXNlbGVjdFwiOlxuICAgIGNhc2UgXCJ0YWdzXCI6XG4gICAgICByZXR1cm4geyBraW5kOiBcIm11bHRpLXNlbGVjdFwiIH07XG4gICAgY2FzZSBcIm51bWJlclwiOlxuICAgICAgcmV0dXJuIHsga2luZDogXCJudW1iZXJcIiB9O1xuICAgIGNhc2UgXCJkYXRlXCI6XG4gICAgICByZXR1cm4geyBraW5kOiBcImRhdGVcIiB9O1xuICAgIGNhc2UgXCJzZWxlY3RcIjpcbiAgICAgIHJldHVybiB7IGtpbmQ6IFwic2VsZWN0XCIsIG9wdGlvbnM6IFtdIH07XG4gICAgY2FzZSBcImZvcm11bGFcIjpcbiAgICAgIHJldHVybiB7IGtpbmQ6IFwiZm9ybXVsYVwiLCBleHByZXNzaW9uOiBcIlwiIH07XG4gICAgZGVmYXVsdDpcbiAgICAgIHJldHVybiB7IGtpbmQ6IFwidGV4dFwiIH07XG4gIH1cbn1cblxuZXhwb3J0IGZ1bmN0aW9uIHNwbGl0Um93KHJvdzogc3RyaW5nKTogc3RyaW5nW10ge1xuICBjb25zdCBzdHJpcHBlZCA9IHJvdy5yZXBsYWNlKC9eXFx8fFxcfCQvZywgXCJcIik7XG4gIGNvbnN0IGNlbGxzOiBzdHJpbmdbXSA9IFtdO1xuICBsZXQgY3VycmVudCA9IFwiXCI7XG4gIGZvciAobGV0IGkgPSAwOyBpIDwgc3RyaXBwZWQubGVuZ3RoOyBpKyspIHtcbiAgICBpZiAoc3RyaXBwZWRbaV0gPT09IFwiXFxcXFwiICYmIHN0cmlwcGVkW2kgKyAxXSA9PT0gXCJ8XCIpIHtcbiAgICAgIGN1cnJlbnQgKz0gXCJ8XCI7XG4gICAgICBpKys7XG4gICAgfSBlbHNlIGlmIChzdHJpcHBlZFtpXSA9PT0gXCJ8XCIpIHtcbiAgICAgIGNlbGxzLnB1c2goY3VycmVudC50cmltKCkpO1xuICAgICAgY3VycmVudCA9IFwiXCI7XG4gICAgfSBlbHNlIHtcbiAgICAgIGN1cnJlbnQgKz0gc3RyaXBwZWRbaV07XG4gICAgfVxuICB9XG4gIGNlbGxzLnB1c2goY3VycmVudC50cmltKCkpO1xuICByZXR1cm4gY2VsbHM7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBzZXJpYWxpemVSb3coY2VsbHM6IHN0cmluZ1tdKTogc3RyaW5nIHtcbiAgcmV0dXJuIFwifCBcIiArIGNlbGxzLmpvaW4oXCIgfCBcIikgKyBcIiB8XCI7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBwYXJzZUJvb2wodmFsOiBzdHJpbmcpOiBib29sZWFuIHtcbiAgcmV0dXJuIHZhbC50cmltKCkudG9Mb3dlckNhc2UoKSA9PT0gXCJ0cnVlXCI7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBzZXJpYWxpemVCb29sKHZhbDogYm9vbGVhbik6IHN0cmluZyB7XG4gIHJldHVybiB2YWwgPyBcInRydWVcIiA6IFwiZmFsc2VcIjtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIHBhcnNlTXVsdGlTZWxlY3QodmFsOiBzdHJpbmcpOiBzdHJpbmdbXSB7XG4gIGlmICghdmFsKSByZXR1cm4gW107XG4gIHJldHVybiB2YWwuc3BsaXQoXCIsXCIpLm1hcCgocykgPT4gcy50cmltKCkpLmZpbHRlcigocykgPT4gcy5sZW5ndGggPiAwKTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGlzRGF0YVJvdyhsaW5lOiBzdHJpbmcpOiBib29sZWFuIHtcbiAgcmV0dXJuIEJvb2xlYW4obGluZS50cmltKCkgJiYgbGluZS5pbmNsdWRlcyhcInxcIikgJiYgIS88IS0tXFxzKnppYmFzZTovLnRlc3QobGluZSkgJiYgIS88IS0tXFxzKnppYmFzZS12aWV3Oi8udGVzdChsaW5lKSk7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBmaWx0ZXJEYXRhUm93cyhyb3dzOiBzdHJpbmdbXSwgcXVlcnk6IHN0cmluZyk6IHN0cmluZ1tdIHtcbiAgaWYgKCFxdWVyeSkgcmV0dXJuIHJvd3M7XG4gIGNvbnN0IHEgPSBxdWVyeS50b0xvd2VyQ2FzZSgpO1xuICByZXR1cm4gcm93cy5maWx0ZXIoKGxpbmUpID0+IHNwbGl0Um93KGxpbmUpLnNvbWUoKGNlbGwpID0+IGNlbGwudG9Mb3dlckNhc2UoKS5pbmNsdWRlcyhxKSkpO1xufVxuIiwgImltcG9ydCB7XG4gIE1hcmtkb3duUmVuZGVyZXIsXG4gIFRGaWxlLFxuICB0eXBlIEFwcCxcbiAgdHlwZSBNYXJrZG93blBvc3RQcm9jZXNzb3JDb250ZXh0LFxuICB0eXBlIE1hcmtkb3duU2VjdGlvbkluZm9ybWF0aW9uLFxufSBmcm9tIFwib2JzaWRpYW5cIjtcbmltcG9ydCB7IHJlbmRlckNlbGwgfSBmcm9tIFwiLi9jZWxsc1wiO1xuaW1wb3J0IHsgRm9ybXVsYUlucHV0TW9kYWwsIFNlbGVjdE9wdGlvbnNNb2RhbCB9IGZyb20gXCIuL21vZGFsc1wiO1xuaW1wb3J0IHtcbiAgaXNEYXRhUm93LFxuICBwYXJzZVppQmFzZVNjaGVtYSxcbiAgcGFyc2VWaWV3QW5ub3RhdGlvbixcbiAgc2VyaWFsaXplUm93LFxuICBzcGxpdFJvdyxcbiAgcGFyc2VCb29sLFxuICBWSUVXX0FOTk9UQVRJT05fUkUsXG59IGZyb20gXCIuL3NjaGVtYVwiO1xuaW1wb3J0IHR5cGUge1xuICBDZWxsQ2hhbmdlSGFuZGxlcixcbiAgQ29sdW1uLFxuICBUYWJsZVNjaGVtYSxcbiAgVmlld05hbWUsXG4gIFppQmFzZUhvc3QsXG4gIFppQmFzZVBsdWdpbkxpa2UsXG59IGZyb20gXCIuL3R5cGVzXCI7XG5pbXBvcnQgeyBDT0xVTU5fVFlQRV9PUFRJT05TIH0gZnJvbSBcIi4vdHlwZXNcIjtcbmltcG9ydCB7IGF0dGFjaExpbmtUb29sdGlwLCBzaG93VG9hc3QgfSBmcm9tIFwiLi91aVwiO1xuaW1wb3J0IHsgYnVpbGRDYWxlbmRhclZpZXcgfSBmcm9tIFwiLi92aWV3cy9jYWxlbmRhclwiO1xuaW1wb3J0IHsgYnVpbGRHYWxsZXJ5VmlldyB9IGZyb20gXCIuL3ZpZXdzL2dhbGxlcnlcIjtcbmltcG9ydCB7IGJ1aWxkS2FuYmFuVmlldyB9IGZyb20gXCIuL3ZpZXdzL2thbmJhblwiO1xuaW1wb3J0IHsgYnVpbGRUYWJsZVZpZXcgfSBmcm9tIFwiLi92aWV3cy90YWJsZVwiO1xuXG5pbnRlcmZhY2UgQXBwV2l0aFNldHRpbmdzIGV4dGVuZHMgQXBwIHtcbiAgc2V0dGluZzogeyBvcGVuOiAoKSA9PiB2b2lkOyBvcGVuVGFiQnlJZDogKGlkOiBzdHJpbmcpID0+IHZvaWQgfTtcbn1cblxuZXhwb3J0IGNsYXNzIFppQmFzZVRhYmxlUmVuZGVyZXIgaW1wbGVtZW50cyBaaUJhc2VIb3N0IHtcbiAgYXBwOiBBcHA7XG4gIHBsdWdpbjogWmlCYXNlUGx1Z2luTGlrZTtcblxuICBjb25zdHJ1Y3RvcihhcHA6IEFwcCwgcGx1Z2luOiBaaUJhc2VQbHVnaW5MaWtlKSB7XG4gICAgdGhpcy5hcHAgPSBhcHA7XG4gICAgdGhpcy5wbHVnaW4gPSBwbHVnaW47XG4gIH1cblxuICBwcm9jZXNzUmVhZGluZ1ZpZXcoZWxlbWVudDogSFRNTEVsZW1lbnQsIGNvbnRleHQ6IE1hcmtkb3duUG9zdFByb2Nlc3NvckNvbnRleHQpOiB2b2lkIHtcbiAgICBlbGVtZW50LnF1ZXJ5U2VsZWN0b3JBbGwoXCJ0YWJsZVwiKS5mb3JFYWNoKCh0YWJsZSkgPT4gdGhpcy50cnlSZW5kZXJUYWJsZSh0YWJsZSwgY29udGV4dCkpO1xuICB9XG5cbiAgdHJ5UmVuZGVyVGFibGUodGFibGU6IEhUTUxUYWJsZUVsZW1lbnQsIGNvbnRleHQ6IE1hcmtkb3duUG9zdFByb2Nlc3NvckNvbnRleHQpOiB2b2lkIHtcbiAgICBjb25zdCBzZWN0aW9uSW5mbyA9IGNvbnRleHQuZ2V0U2VjdGlvbkluZm8odGFibGUpO1xuICAgIGlmICghc2VjdGlvbkluZm8pIHJldHVybjtcbiAgICBjb25zdCBsaW5lcyA9IHNlY3Rpb25JbmZvLnRleHQuc3BsaXQoXCJcXG5cIikuc2xpY2Uoc2VjdGlvbkluZm8ubGluZVN0YXJ0LCBzZWN0aW9uSW5mby5saW5lRW5kICsgMSk7XG4gICAgY29uc3Qgc2NoZW1hID0gcGFyc2VaaUJhc2VTY2hlbWEobGluZXMsIHRoaXMucGx1Z2luLnNldHRpbmdzLmNvbHVtblJ1bGVzKTtcbiAgICBpZiAoIXNjaGVtYSkgcmV0dXJuO1xuICAgIGlmIChzY2hlbWEuaW5mZXJyZWQgJiYgIXRoaXMucGx1Z2luLnNldHRpbmdzLmluZmVyU2NoZW1hKSByZXR1cm47XG4gICAgdGFibGUucmVwbGFjZVdpdGgodGhpcy5idWlsZFJpY2hUYWJsZShzY2hlbWEsIGxpbmVzLCBjb250ZXh0LCBzZWN0aW9uSW5mbykpO1xuICB9XG5cbiAgYnVpbGRSaWNoVGFibGUoXG4gICAgc2NoZW1hOiBUYWJsZVNjaGVtYSxcbiAgICBsaW5lczogc3RyaW5nW10sXG4gICAgY29udGV4dDogTWFya2Rvd25Qb3N0UHJvY2Vzc29yQ29udGV4dCxcbiAgICBzZWN0aW9uSW5mbzogTWFya2Rvd25TZWN0aW9uSW5mb3JtYXRpb24sXG4gICk6IEhUTUxFbGVtZW50IHtcbiAgICBsZXQgY3VycmVudFZpZXc6IFZpZXdOYW1lIHwgc3RyaW5nID0gXCJ0YWJsZVwiO1xuICAgIGxldCBjb2xsYXBzZWQgPSBmYWxzZTtcbiAgICBsZXQgZmlsdGVyUXVlcnkgPSBcIlwiO1xuICAgIGxldCBzb3J0Q29sSWR4OiBudW1iZXIgfCBudWxsID0gbnVsbDtcbiAgICBsZXQgc29ydEFzYyA9IHRydWU7XG4gICAgY29uc3QgcmF3RGF0YUxpbmVzID0gbGluZXMuc2xpY2Uoc2NoZW1hLmRhdGFTdGFydEluZGV4KTtcblxuICAgIGNvbnN0IHZpZXdBbm5vdGF0aW9uID0gcGFyc2VWaWV3QW5ub3RhdGlvbihsaW5lcyk7XG4gICAgaWYgKHZpZXdBbm5vdGF0aW9uKSBjdXJyZW50VmlldyA9IHZpZXdBbm5vdGF0aW9uLnZpZXc7XG5cbiAgICBjb25zdCBnZXREYXRhUm93cyA9ICgpID0+IHJhd0RhdGFMaW5lcy5maWx0ZXIoaXNEYXRhUm93KTtcbiAgICBjb25zdCB3cmFwcGVyID0gY3JlYXRlRGl2KCk7XG4gICAgd3JhcHBlci5jbGFzc05hbWUgPSBcInppYmFzZS13cmFwcGVyXCI7XG4gICAgY29uc3QgdG9wYmFyID0gd3JhcHBlci5jcmVhdGVEaXYoXCJ6aWJhc2UtdG9wYmFyXCIpO1xuICAgIGNvbnN0IGNvbGxhcHNlQnRuID0gdG9wYmFyLmNyZWF0ZUVsKFwiYnV0dG9uXCIsIHsgY2xzOiBcInppYmFzZS1jb2xsYXBzZS1idG5cIiB9KTtcbiAgICBjb2xsYXBzZUJ0bi5lbXB0eSgpO1xuICAgIGNvbGxhcHNlQnRuLmluc2VydEFkamFjZW50SFRNTChcbiAgICAgIFwiYmVmb3JlZW5kXCIsXG4gICAgICBgPHN2ZyB3aWR0aD1cIjlcIiBoZWlnaHQ9XCI5XCIgdmlld0JveD1cIjAgMCA5IDlcIj48cGF0aCBkPVwiTTEuNSAxLjUgTDcuNSA0LjUgTDEuNSA3LjUgWlwiIGZpbGw9XCJjdXJyZW50Q29sb3JcIi8+PC9zdmc+YCxcbiAgICApO1xuICAgIGNvbnN0IHRvcExlZnQgPSB0b3BiYXIuY3JlYXRlRGl2KFwiemliYXNlLXRvcGJhci1sZWZ0XCIpO1xuICAgIHRvcExlZnQuY3JlYXRlU3Bhbih7IHRleHQ6IFwiXHUyN0MxXCIsIGNsczogXCJ6aWJhc2UtbG9nb1wiIH0pO1xuICAgIGNvbnN0IHppYmFzZU5hbWUgPSB0b3BMZWZ0LmNyZWF0ZVNwYW4oeyB0ZXh0OiBcIlppQmFzZVwiLCBjbHM6IFwiemliYXNlLW5hbWUgemliYXNlLW5hbWUtYnRuXCIgfSk7XG4gICAgY29uc3QgYmFkZ2UgPSB0b3BMZWZ0LmNyZWF0ZVNwYW4oe1xuICAgICAgY2xzOiBzY2hlbWEuaW5mZXJyZWQgPyBcInppYmFzZS1pbmZlcnJlZC1iYWRnZVwiIDogXCJ6aWJhc2UtYW5ub3RhdGVkLWJhZGdlXCIsXG4gICAgICB0ZXh0OiBzY2hlbWEuaW5mZXJyZWQgPyBcImluZmVycmVkXCIgOiBcImFubm90YXRlZFwiLFxuICAgIH0pO1xuICAgIGNvbnN0IHRvcFJpZ2h0ID0gdG9wYmFyLmNyZWF0ZURpdihcInppYmFzZS10b3BiYXItcmlnaHRcIik7XG4gICAgY29uc3Qgc2VhcmNoV3JhcCA9IHRvcFJpZ2h0LmNyZWF0ZURpdihcInppYmFzZS1zZWFyY2gtd3JhcFwiKTtcbiAgICBzZWFyY2hXcmFwLmVtcHR5KCk7XG4gICAgc2VhcmNoV3JhcC5pbnNlcnRBZGphY2VudEhUTUwoXG4gICAgICBcImJlZm9yZWVuZFwiLFxuICAgICAgYDxzdmcgY2xhc3M9XCJ6aWJhc2Utc2VhcmNoLWljb25cIiB3aWR0aD1cIjExXCIgaGVpZ2h0PVwiMTFcIiB2aWV3Qm94PVwiMCAwIDE2IDE2XCI+PGNpcmNsZSBjeD1cIjYuNVwiIGN5PVwiNi41XCIgcj1cIjVcIiBzdHJva2U9XCJjdXJyZW50Q29sb3JcIiBzdHJva2Utd2lkdGg9XCIxLjVcIiBmaWxsPVwibm9uZVwiLz48bGluZSB4MT1cIjEwLjVcIiB5MT1cIjEwLjVcIiB4Mj1cIjE0XCIgeTI9XCIxNFwiIHN0cm9rZT1cImN1cnJlbnRDb2xvclwiIHN0cm9rZS13aWR0aD1cIjEuNVwiIHN0cm9rZS1saW5lY2FwPVwicm91bmRcIi8+PC9zdmc+YCxcbiAgICApO1xuICAgIGNvbnN0IHNlYXJjaElucHV0ID0gc2VhcmNoV3JhcC5jcmVhdGVFbChcImlucHV0XCIsIHsgY2xzOiBcInppYmFzZS1zZWFyY2hcIiwgdHlwZTogXCJ0ZXh0XCIgfSk7XG4gICAgc2VhcmNoSW5wdXQucGxhY2Vob2xkZXIgPSBcIkZpbHRlclx1MjAyNlwiO1xuICAgIHppYmFzZU5hbWUuYWRkRXZlbnRMaXN0ZW5lcihcImNsaWNrXCIsIChlKSA9PiB7XG4gICAgICBlLnN0b3BQcm9wYWdhdGlvbigpO1xuICAgICAgdGhpcy5zaG93WmlCYXNlTWVudShlLCBzY2hlbWEsIGxpbmVzLCBjb250ZXh0LCBzZWN0aW9uSW5mbywgcmF3RGF0YUxpbmVzLCBiYWRnZSwgY3VycmVudFZpZXcsIChuZXdWaWV3KSA9PiB7XG4gICAgICAgIGN1cnJlbnRWaWV3ID0gbmV3VmlldztcbiAgICAgICAgcmVuZGVyVmlld0NvbnRlbnQoKTtcbiAgICAgIH0pO1xuICAgIH0pO1xuICAgIGNvbnN0IGJvZHkgPSB3cmFwcGVyLmNyZWF0ZURpdihcInppYmFzZS1ib2R5XCIpO1xuXG4gICAgY29uc3QgZm9vdGVyID0gYm9keS5jcmVhdGVEaXYoXCJ6aWJhc2UtZm9vdGVyXCIpO1xuICAgIGNvbnN0IGFkZFJvd0J0biA9IGZvb3Rlci5jcmVhdGVFbChcImJ1dHRvblwiLCB7IGNsczogXCJ6aWJhc2UtYWRkLXJvdy1idG5cIiB9KTtcbiAgICBhZGRSb3dCdG4uZW1wdHkoKTtcbiAgICBhZGRSb3dCdG4uaW5zZXJ0QWRqYWNlbnRIVE1MKFxuICAgICAgXCJiZWZvcmVlbmRcIixcbiAgICAgIGA8c3ZnIHdpZHRoPVwiMTBcIiBoZWlnaHQ9XCIxMFwiIHZpZXdCb3g9XCIwIDAgMTAgMTBcIj48bGluZSB4MT1cIjVcIiB5MT1cIjFcIiB4Mj1cIjVcIiB5Mj1cIjlcIiBzdHJva2U9XCJjdXJyZW50Q29sb3JcIiBzdHJva2Utd2lkdGg9XCIxLjVcIiBzdHJva2UtbGluZWNhcD1cInJvdW5kXCIvPjxsaW5lIHgxPVwiMVwiIHkxPVwiNVwiIHgyPVwiOVwiIHkyPVwiNVwiIHN0cm9rZT1cImN1cnJlbnRDb2xvclwiIHN0cm9rZS13aWR0aD1cIjEuNVwiIHN0cm9rZS1saW5lY2FwPVwicm91bmRcIi8+PC9zdmc+IEFkZCByb3dgLFxuICAgICk7XG4gICAgYWRkUm93QnRuLmFkZEV2ZW50TGlzdGVuZXIoXCJjbGlja1wiLCBhc3luYyAoKSA9PiBhd2FpdCB0aGlzLmFkZFJvdyhjb250ZXh0LCBzZWN0aW9uSW5mbywgc2NoZW1hKSk7XG4gICAgY29uc3Qgcm93Q291bnQgPSBmb290ZXIuY3JlYXRlU3Bhbih7IGNsczogXCJ6aWJhc2Utcm93LWNvdW50XCIgfSk7XG4gICAgY29uc3QgdXBkYXRlQ291bnQgPSAoKSA9PiB7XG4gICAgICBjb25zdCB0b3RhbCA9IGdldERhdGFSb3dzKCkubGVuZ3RoO1xuICAgICAgY29uc3QgdmlzaWJsZSA9IGZpbHRlclF1ZXJ5XG4gICAgICAgID8gZ2V0RGF0YVJvd3MoKS5maWx0ZXIoKGwpID0+IHNwbGl0Um93KGwpLnNvbWUoKGMpID0+IGMudG9Mb3dlckNhc2UoKS5pbmNsdWRlcyhmaWx0ZXJRdWVyeS50b0xvd2VyQ2FzZSgpKSkpLmxlbmd0aFxuICAgICAgICA6IHRvdGFsO1xuICAgICAgcm93Q291bnQudGV4dENvbnRlbnQgPSBmaWx0ZXJRdWVyeSAmJiB2aXNpYmxlICE9PSB0b3RhbCA/IGAke3Zpc2libGV9IC8gJHt0b3RhbH0gcm93c2AgOiBgJHt0b3RhbH0gcm93c2A7XG4gICAgfTtcblxuICAgIGNvbnN0IHJlbmRlclZpZXdDb250ZW50ID0gKCkgPT4ge1xuICAgICAgYm9keS5xdWVyeVNlbGVjdG9yQWxsKFwiLnppYmFzZS10YWJsZSwgLnppYmFzZS1rYW5iYW4sIC56aWJhc2UtZ2FsbGVyeSwgLnppYmFzZS1jYWxlbmRhclwiKS5mb3JFYWNoKChlbCkgPT4gZWwucmVtb3ZlKCkpO1xuICAgICAgY29uc3Qgdmlld0NvbnRhaW5lciA9IGNyZWF0ZURpdigpO1xuICAgICAgc3dpdGNoIChjdXJyZW50Vmlldykge1xuICAgICAgICBjYXNlIFwia2FuYmFuXCI6XG4gICAgICAgICAgYnVpbGRLYW5iYW5WaWV3KHRoaXMsIHZpZXdDb250YWluZXIsIHNjaGVtYSwgZ2V0RGF0YVJvd3MsIHJhd0RhdGFMaW5lcywgY29udGV4dCwgc2VjdGlvbkluZm8sIGZpbHRlclF1ZXJ5KTtcbiAgICAgICAgICBicmVhaztcbiAgICAgICAgY2FzZSBcImdhbGxlcnlcIjpcbiAgICAgICAgICBidWlsZEdhbGxlcnlWaWV3KHRoaXMsIHZpZXdDb250YWluZXIsIHNjaGVtYSwgZ2V0RGF0YVJvd3MsIHJhd0RhdGFMaW5lcywgY29udGV4dCwgc2VjdGlvbkluZm8sIGZpbHRlclF1ZXJ5KTtcbiAgICAgICAgICBicmVhaztcbiAgICAgICAgY2FzZSBcImNhbGVuZGFyXCI6XG4gICAgICAgICAgYnVpbGRDYWxlbmRhclZpZXcodGhpcywgdmlld0NvbnRhaW5lciwgc2NoZW1hLCBnZXREYXRhUm93cywgcmF3RGF0YUxpbmVzLCBjb250ZXh0LCBzZWN0aW9uSW5mbywgZmlsdGVyUXVlcnkpO1xuICAgICAgICAgIGJyZWFrO1xuICAgICAgICBkZWZhdWx0OlxuICAgICAgICAgIGJ1aWxkVGFibGVWaWV3KFxuICAgICAgICAgICAgdGhpcyxcbiAgICAgICAgICAgIHZpZXdDb250YWluZXIsXG4gICAgICAgICAgICBzY2hlbWEsXG4gICAgICAgICAgICBnZXREYXRhUm93cyxcbiAgICAgICAgICAgIHJhd0RhdGFMaW5lcyxcbiAgICAgICAgICAgIGNvbnRleHQsXG4gICAgICAgICAgICBzZWN0aW9uSW5mbyxcbiAgICAgICAgICAgIGZpbHRlclF1ZXJ5LFxuICAgICAgICAgICAgc29ydENvbElkeCxcbiAgICAgICAgICAgIHNvcnRBc2MsXG4gICAgICAgICAgICBiYWRnZSxcbiAgICAgICAgICAgIChjb2wsIGFzYykgPT4ge1xuICAgICAgICAgICAgICBzb3J0Q29sSWR4ID0gY29sO1xuICAgICAgICAgICAgICBzb3J0QXNjID0gYXNjO1xuICAgICAgICAgICAgfSxcbiAgICAgICAgICApO1xuICAgICAgICAgIGJyZWFrO1xuICAgICAgfVxuICAgICAgd2hpbGUgKHZpZXdDb250YWluZXIuZmlyc3RDaGlsZCkge1xuICAgICAgICBib2R5Lmluc2VydEJlZm9yZSh2aWV3Q29udGFpbmVyLmZpcnN0Q2hpbGQsIGZvb3Rlcik7XG4gICAgICB9XG4gICAgfTtcblxuICAgIHJlbmRlclZpZXdDb250ZW50KCk7XG4gICAgdXBkYXRlQ291bnQoKTtcbiAgICBjb2xsYXBzZUJ0bi5hZGRFdmVudExpc3RlbmVyKFwiY2xpY2tcIiwgKCkgPT4ge1xuICAgICAgY29sbGFwc2VkID0gIWNvbGxhcHNlZDtcbiAgICAgIGJvZHkuY2xhc3NMaXN0LnRvZ2dsZShcInppYmFzZS1ib2R5LWNvbGxhcHNlZFwiLCBjb2xsYXBzZWQpO1xuICAgICAgY29sbGFwc2VCdG4uY2xhc3NMaXN0LnRvZ2dsZShcInppYmFzZS1jb2xsYXBzZWRcIiwgY29sbGFwc2VkKTtcbiAgICB9KTtcbiAgICBzZWFyY2hJbnB1dC5hZGRFdmVudExpc3RlbmVyKFwiaW5wdXRcIiwgKCkgPT4ge1xuICAgICAgZmlsdGVyUXVlcnkgPSBzZWFyY2hJbnB1dC52YWx1ZS50cmltKCk7XG4gICAgICByZW5kZXJWaWV3Q29udGVudCgpO1xuICAgICAgdXBkYXRlQ291bnQoKTtcbiAgICB9KTtcbiAgICByZXR1cm4gd3JhcHBlcjtcbiAgfVxuXG4gIHNob3daaUJhc2VNZW51KFxuICAgIGU6IE1vdXNlRXZlbnQsXG4gICAgc2NoZW1hOiBUYWJsZVNjaGVtYSxcbiAgICBsaW5lczogc3RyaW5nW10sXG4gICAgY29udGV4dDogTWFya2Rvd25Qb3N0UHJvY2Vzc29yQ29udGV4dCxcbiAgICBzZWN0aW9uSW5mbzogTWFya2Rvd25TZWN0aW9uSW5mb3JtYXRpb24sXG4gICAgX3Jhd0RhdGFMaW5lczogc3RyaW5nW10sXG4gICAgX2JhZGdlOiBIVE1MRWxlbWVudCxcbiAgICBjdXJyZW50VmlldzogVmlld05hbWUgfCBzdHJpbmcsXG4gICAgb25WaWV3Q2hhbmdlOiAodmlldzogc3RyaW5nKSA9PiB2b2lkLFxuICApOiB2b2lkIHtcbiAgICBkb2N1bWVudC5xdWVyeVNlbGVjdG9yQWxsKFwiLnppYmFzZS1kcm9wZG93blwiKS5mb3JFYWNoKChtKSA9PiBtLnJlbW92ZSgpKTtcbiAgICBjb25zdCBtZW51ID0gY3JlYXRlRGl2KCk7XG4gICAgbWVudS5jbGFzc05hbWUgPSBcInppYmFzZS1kcm9wZG93blwiO1xuICAgIGNvbnN0IHRhcmdldCA9IGUudGFyZ2V0IGFzIEhUTUxFbGVtZW50O1xuICAgIGNvbnN0IHJlY3QgPSB0YXJnZXQuZ2V0Qm91bmRpbmdDbGllbnRSZWN0KCk7XG4gICAgbWVudS5zZXRDc3NTdHlsZXMoeyB0b3A6IGAke3JlY3QuYm90dG9tICsgd2luZG93LnNjcm9sbFkgKyA0fXB4YCB9KTtcbiAgICBtZW51LnNldENzc1N0eWxlcyh7IGxlZnQ6IGAke3JlY3QubGVmdCArIHdpbmRvdy5zY3JvbGxYfXB4YCB9KTtcbiAgICBjb25zdCBjb250cm9sbGVyID0gbmV3IEFib3J0Q29udHJvbGxlcigpO1xuICAgIGNvbnN0IGNsb3NlTWVudSA9ICgpID0+IHtcbiAgICAgIG1lbnUucmVtb3ZlKCk7XG4gICAgICBjb250cm9sbGVyLmFib3J0KCk7XG4gICAgfTtcblxuICAgIGNvbnN0IGV4cG9ydEl0ZW0gPSBtZW51LmNyZWF0ZURpdihcInppYmFzZS1kcm9wZG93bi1pdGVtIHppYmFzZS1kcm9wZG93bi1oYXMtc3ViXCIpO1xuICAgIGV4cG9ydEl0ZW0uY3JlYXRlU3Bhbih7IHRleHQ6IFwiRXhwb3J0XCIsIGNsczogXCJ6aWJhc2UtZHJvcGRvd24tbGFiZWxcIiB9KTtcbiAgICBleHBvcnRJdGVtLmNyZWF0ZVNwYW4oeyB0ZXh0OiBcIlx1MjVCNlwiLCBjbHM6IFwiemliYXNlLWRyb3Bkb3duLWFycm93XCIgfSk7XG4gICAgY29uc3QgZXhwb3J0U3ViID0gZXhwb3J0SXRlbS5jcmVhdGVEaXYoXCJ6aWJhc2UtZHJvcGRvd24tc3ViXCIpO1xuICAgIGNvbnN0IGV4cG9ydE9wdGlvbnMgPSBbXG4gICAgICB7IGljb246IFwiXHVEODNEXHVEQ0NCXCIsIGxhYmVsOiBcIkNvcHkgYXMgTWFya2Rvd25cIiwgYWN0aW9uOiAoKSA9PiB0aGlzLmNvcHlBc01hcmtkb3duKHNjaGVtYSwgbGluZXMpIH0sXG4gICAgICB7IGljb246IFwiXHVEODNEXHVEQ0U0XCIsIGxhYmVsOiBcIkV4cG9ydCBhcyBDU1ZcIiwgYWN0aW9uOiAoKSA9PiB2b2lkIHRoaXMuZXhwb3J0Q1NWKHNjaGVtYSwgbGluZXMsIGNvbnRleHQpIH0sXG4gICAgICB7IGljb246IFwiXHVEODNEXHVEREM0XHVGRTBGXCIsIGxhYmVsOiBcIkV4cG9ydCBhcyBKU09OXCIsIGFjdGlvbjogKCkgPT4gdm9pZCB0aGlzLmV4cG9ydEpTT04oc2NoZW1hLCBsaW5lcywgY29udGV4dCkgfSxcbiAgICBdO1xuICAgIGV4cG9ydE9wdGlvbnMuZm9yRWFjaCgoeyBpY29uLCBsYWJlbCwgYWN0aW9uIH0pID0+IHtcbiAgICAgIGNvbnN0IGl0ZW0gPSBleHBvcnRTdWIuY3JlYXRlRGl2KFwiemliYXNlLWRyb3Bkb3duLXN1Yml0ZW1cIik7XG4gICAgICBpdGVtLmNyZWF0ZVNwYW4oeyB0ZXh0OiBpY29uLCBjbHM6IFwiemliYXNlLWRyb3Bkb3duLWljb25cIiB9KTtcbiAgICAgIGl0ZW0uY3JlYXRlU3Bhbih7IHRleHQ6IGxhYmVsIH0pO1xuICAgICAgaXRlbS5hZGRFdmVudExpc3RlbmVyKFwiY2xpY2tcIiwgKCkgPT4ge1xuICAgICAgICBjbG9zZU1lbnUoKTtcbiAgICAgICAgYWN0aW9uKCk7XG4gICAgICB9KTtcbiAgICB9KTtcblxuICAgIGNvbnN0IHZpZXdJdGVtID0gbWVudS5jcmVhdGVEaXYoXCJ6aWJhc2UtZHJvcGRvd24taXRlbSB6aWJhc2UtZHJvcGRvd24taGFzLXN1YlwiKTtcbiAgICB2aWV3SXRlbS5jcmVhdGVTcGFuKHsgdGV4dDogXCJWaWV3XCIsIGNsczogXCJ6aWJhc2UtZHJvcGRvd24tbGFiZWxcIiB9KTtcbiAgICB2aWV3SXRlbS5jcmVhdGVTcGFuKHsgdGV4dDogXCJcdTI1QjZcIiwgY2xzOiBcInppYmFzZS1kcm9wZG93bi1hcnJvd1wiIH0pO1xuICAgIGNvbnN0IHZpZXdTdWIgPSB2aWV3SXRlbS5jcmVhdGVEaXYoXCJ6aWJhc2UtZHJvcGRvd24tc3ViXCIpO1xuICAgIGNvbnN0IHZpZXdPcHRpb25zID0gW1xuICAgICAgeyBpY29uOiBcIlx1RDgzRFx1RENDQVwiLCBsYWJlbDogXCJUYWJsZVwiLCB2aWV3OiBcInRhYmxlXCIgfSxcbiAgICAgIHsgaWNvbjogXCJcdUQ4M0RcdURDQ0JcIiwgbGFiZWw6IFwiS2FuYmFuXCIsIHZpZXc6IFwia2FuYmFuXCIgfSxcbiAgICAgIHsgaWNvbjogXCJcdUQ4M0RcdUREQkNcdUZFMEZcIiwgbGFiZWw6IFwiR2FsbGVyeVwiLCB2aWV3OiBcImdhbGxlcnlcIiB9LFxuICAgICAgeyBpY29uOiBcIlx1RDgzRFx1RENDNVwiLCBsYWJlbDogXCJDYWxlbmRhclwiLCB2aWV3OiBcImNhbGVuZGFyXCIgfSxcbiAgICBdO1xuICAgIHZpZXdPcHRpb25zLmZvckVhY2goKHsgaWNvbiwgbGFiZWwsIHZpZXcgfSkgPT4ge1xuICAgICAgY29uc3QgaXRlbSA9IHZpZXdTdWIuY3JlYXRlRGl2KFwiemliYXNlLWRyb3Bkb3duLXN1Yml0ZW1cIik7XG4gICAgICBpdGVtLmNyZWF0ZVNwYW4oeyB0ZXh0OiBpY29uLCBjbHM6IFwiemliYXNlLWRyb3Bkb3duLWljb25cIiB9KTtcbiAgICAgIGl0ZW0uY3JlYXRlU3Bhbih7IHRleHQ6IGxhYmVsIH0pO1xuICAgICAgaWYgKGN1cnJlbnRWaWV3ID09PSB2aWV3KSB7XG4gICAgICAgIGl0ZW0uY2xhc3NMaXN0LmFkZChcInppYmFzZS1tZW51LWFjdGl2ZVwiKTtcbiAgICAgICAgaXRlbS5jcmVhdGVTcGFuKHsgdGV4dDogXCIgXHUyNzEzXCIsIGNsczogXCJ6aWJhc2Utdmlldy1jaGVja1wiIH0pO1xuICAgICAgfVxuICAgICAgaXRlbS5hZGRFdmVudExpc3RlbmVyKFwiY2xpY2tcIiwgKCkgPT4ge1xuICAgICAgICBjbG9zZU1lbnUoKTtcbiAgICAgICAgaWYgKGN1cnJlbnRWaWV3ICE9PSB2aWV3KSB7XG4gICAgICAgICAgb25WaWV3Q2hhbmdlKHZpZXcpO1xuICAgICAgICAgIHZvaWQgdGhpcy5wZXJzaXN0Vmlld0Fubm90YXRpb24oY29udGV4dCwgc2VjdGlvbkluZm8sIHZpZXcpO1xuICAgICAgICB9XG4gICAgICB9KTtcbiAgICB9KTtcblxuICAgIGNvbnN0IHJ1bGVzSXRlbSA9IG1lbnUuY3JlYXRlRGl2KFwiemliYXNlLWRyb3Bkb3duLWl0ZW0gemliYXNlLWRyb3Bkb3duLWhhcy1zdWJcIik7XG4gICAgcnVsZXNJdGVtLmNyZWF0ZVNwYW4oeyB0ZXh0OiBcIkNvbHVtbiBOYW1lIFJ1bGVzXCIsIGNsczogXCJ6aWJhc2UtZHJvcGRvd24tbGFiZWxcIiB9KTtcbiAgICBydWxlc0l0ZW0uY3JlYXRlU3Bhbih7IHRleHQ6IFwiXHUyNUI2XCIsIGNsczogXCJ6aWJhc2UtZHJvcGRvd24tYXJyb3dcIiB9KTtcbiAgICBjb25zdCBydWxlc1N1YiA9IHJ1bGVzSXRlbS5jcmVhdGVEaXYoXCJ6aWJhc2UtZHJvcGRvd24tc3ViIHppYmFzZS1ydWxlcy1zdWJcIik7XG4gICAgdGhpcy5yZW5kZXJSdWxlc1BhbmVsKHJ1bGVzU3ViKTtcblxuICAgIGNvbnN0IHNldHRpbmdzSXRlbSA9IG1lbnUuY3JlYXRlRGl2KFwiemliYXNlLWRyb3Bkb3duLWl0ZW1cIik7XG4gICAgc2V0dGluZ3NJdGVtLmNyZWF0ZVNwYW4oeyB0ZXh0OiBcIlx1MjY5OVx1RkUwRlwiLCBjbHM6IFwiemliYXNlLWRyb3Bkb3duLWljb25cIiB9KTtcbiAgICBzZXR0aW5nc0l0ZW0uY3JlYXRlU3Bhbih7IHRleHQ6IFwiT3BlbiBTZXR0aW5nc1wiLCBjbHM6IFwiemliYXNlLWRyb3Bkb3duLWxhYmVsXCIgfSk7XG4gICAgc2V0dGluZ3NJdGVtLmFkZEV2ZW50TGlzdGVuZXIoXCJjbGlja1wiLCAoKSA9PiB7XG4gICAgICBjbG9zZU1lbnUoKTtcbiAgICAgIGNvbnN0IGFwcCA9IHRoaXMuYXBwIGFzIEFwcFdpdGhTZXR0aW5ncztcbiAgICAgIGFwcC5zZXR0aW5nLm9wZW4oKTtcbiAgICAgIGFwcC5zZXR0aW5nLm9wZW5UYWJCeUlkKFwiemliYXNlXCIpO1xuICAgIH0pO1xuICAgIGRvY3VtZW50LmJvZHkuYXBwZW5kQ2hpbGQobWVudSk7XG4gICAgd2luZG93LnNldFRpbWVvdXQoKCkgPT4ge1xuICAgICAgZG9jdW1lbnQuYWRkRXZlbnRMaXN0ZW5lcihcImNsaWNrXCIsIChldikgPT4ge1xuICAgICAgICBpZiAoIW1lbnUuY29udGFpbnMoZXYudGFyZ2V0IGFzIE5vZGUpKSBjbG9zZU1lbnUoKTtcbiAgICAgIH0sIHsgc2lnbmFsOiBjb250cm9sbGVyLnNpZ25hbCB9KTtcbiAgICB9LCAxMCk7XG4gIH1cblxuICBhc3luYyBwZXJzaXN0Vmlld0Fubm90YXRpb24oXG4gICAgY29udGV4dDogTWFya2Rvd25Qb3N0UHJvY2Vzc29yQ29udGV4dCxcbiAgICBzZWN0aW9uSW5mbzogTWFya2Rvd25TZWN0aW9uSW5mb3JtYXRpb24sXG4gICAgdmlldzogc3RyaW5nLFxuICApOiBQcm9taXNlPHZvaWQ+IHtcbiAgICBjb25zdCBmaWxlID0gdGhpcy5hcHAudmF1bHQuZ2V0QWJzdHJhY3RGaWxlQnlQYXRoKGNvbnRleHQuc291cmNlUGF0aCk7XG4gICAgaWYgKCEoZmlsZSBpbnN0YW5jZW9mIFRGaWxlKSkgcmV0dXJuO1xuICAgIGF3YWl0IHRoaXMuYXBwLnZhdWx0LnByb2Nlc3MoZmlsZSwgKGNvbnRlbnQpID0+IHtcbiAgICAgIGNvbnN0IGFsbExpbmVzID0gY29udGVudC5zcGxpdChcIlxcblwiKTtcbiAgICAgIGNvbnN0IHNlYXJjaFN0YXJ0ID0gTWF0aC5tYXgoMCwgc2VjdGlvbkluZm8ubGluZVN0YXJ0IC0gMSk7XG4gICAgICBmb3IgKGxldCBpID0gc2VhcmNoU3RhcnQ7IGkgPD0gTWF0aC5taW4oc2VjdGlvbkluZm8ubGluZVN0YXJ0LCBhbGxMaW5lcy5sZW5ndGggLSAxKTsgaSsrKSB7XG4gICAgICAgIGlmIChWSUVXX0FOTk9UQVRJT05fUkUudGVzdChhbGxMaW5lc1tpXSkpIHtcbiAgICAgICAgICBpZiAodmlldyA9PT0gXCJ0YWJsZVwiKSBhbGxMaW5lcy5zcGxpY2UoaSwgMSk7XG4gICAgICAgICAgZWxzZSBhbGxMaW5lc1tpXSA9IGA8IS0tIHppYmFzZS12aWV3OiAke3ZpZXd9IC0tPmA7XG4gICAgICAgICAgcmV0dXJuIGFsbExpbmVzLmpvaW4oXCJcXG5cIik7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIGlmICh2aWV3ICE9PSBcInRhYmxlXCIpIHtcbiAgICAgICAgYWxsTGluZXMuc3BsaWNlKHNlY3Rpb25JbmZvLmxpbmVTdGFydCwgMCwgYDwhLS0gemliYXNlLXZpZXc6ICR7dmlld30gLS0+YCk7XG4gICAgICB9XG4gICAgICByZXR1cm4gYWxsTGluZXMuam9pbihcIlxcblwiKTtcbiAgICB9KTtcbiAgfVxuXG4gIHJlbmRlclJ1bGVzUGFuZWwoY29udGFpbmVyOiBIVE1MRWxlbWVudCk6IHZvaWQge1xuICAgIGNvbnRhaW5lci5lbXB0eSgpO1xuICAgIGNvbnN0IHRpdGxlID0gY29udGFpbmVyLmNyZWF0ZURpdihcInppYmFzZS1ydWxlcy10aXRsZVwiKTtcbiAgICB0aXRsZS50ZXh0Q29udGVudCA9IFwiQ29sdW1uIFx1MjE5MiBUeXBlIHJ1bGVzXCI7XG4gICAgdGhpcy5wbHVnaW4uc2V0dGluZ3MuY29sdW1uUnVsZXMuZm9yRWFjaCgocnVsZSwgaWR4KSA9PiB7XG4gICAgICBjb25zdCByb3cgPSBjb250YWluZXIuY3JlYXRlRGl2KFwiemliYXNlLXJ1bGVzLXJvd1wiKTtcbiAgICAgIGNvbnN0IG5hbWVJbnB1dCA9IHJvdy5jcmVhdGVFbChcImlucHV0XCIsIHsgdHlwZTogXCJ0ZXh0XCIsIGNsczogXCJ6aWJhc2UtcnVsZXMtbmFtZVwiLCB2YWx1ZTogcnVsZS5uYW1lIH0pO1xuICAgICAgbmFtZUlucHV0LnBsYWNlaG9sZGVyID0gXCJuYW1lXCI7XG4gICAgICBuYW1lSW5wdXQuYWRkRXZlbnRMaXN0ZW5lcihcImNoYW5nZVwiLCBhc3luYyAoKSA9PiB7XG4gICAgICAgIHRoaXMucGx1Z2luLnNldHRpbmdzLmNvbHVtblJ1bGVzW2lkeF0ubmFtZSA9IG5hbWVJbnB1dC52YWx1ZS50cmltKCk7XG4gICAgICAgIGF3YWl0IHRoaXMucGx1Z2luLnNhdmVTZXR0aW5ncygpO1xuICAgICAgfSk7XG4gICAgICByb3cuY3JlYXRlU3Bhbih7IHRleHQ6IFwiXHUyMTkyXCIsIGNsczogXCJ6aWJhc2UtcnVsZXMtYXJyb3dcIiB9KTtcbiAgICAgIGNvbnN0IHR5cGVTZWxlY3QgPSByb3cuY3JlYXRlRWwoXCJzZWxlY3RcIiwgeyBjbHM6IFwiemliYXNlLXJ1bGVzLXR5cGVcIiB9KTtcbiAgICAgIENPTFVNTl9UWVBFX09QVElPTlMuZm9yRWFjaCgodCkgPT4ge1xuICAgICAgICBjb25zdCBvcHQgPSB0eXBlU2VsZWN0LmNyZWF0ZUVsKFwib3B0aW9uXCIsIHsgdGV4dDogdCwgdmFsdWU6IHQgfSk7XG4gICAgICAgIGlmICh0ID09PSBydWxlLnR5cGUpIG9wdC5zZWxlY3RlZCA9IHRydWU7XG4gICAgICB9KTtcbiAgICAgIHR5cGVTZWxlY3QuYWRkRXZlbnRMaXN0ZW5lcihcImNoYW5nZVwiLCBhc3luYyAoKSA9PiB7XG4gICAgICAgIHRoaXMucGx1Z2luLnNldHRpbmdzLmNvbHVtblJ1bGVzW2lkeF0udHlwZSA9IHR5cGVTZWxlY3QudmFsdWU7XG4gICAgICAgIGF3YWl0IHRoaXMucGx1Z2luLnNhdmVTZXR0aW5ncygpO1xuICAgICAgfSk7XG4gICAgICBjb25zdCByZW1vdmVCdG4gPSByb3cuY3JlYXRlRWwoXCJidXR0b25cIiwgeyB0ZXh0OiBcIlx1MDBEN1wiLCBjbHM6IFwiemliYXNlLXJ1bGVzLXJlbW92ZVwiIH0pO1xuICAgICAgcmVtb3ZlQnRuLmFkZEV2ZW50TGlzdGVuZXIoXCJjbGlja1wiLCBhc3luYyAoKSA9PiB7XG4gICAgICAgIHRoaXMucGx1Z2luLnNldHRpbmdzLmNvbHVtblJ1bGVzLnNwbGljZShpZHgsIDEpO1xuICAgICAgICBhd2FpdCB0aGlzLnBsdWdpbi5zYXZlU2V0dGluZ3MoKTtcbiAgICAgICAgdGhpcy5yZW5kZXJSdWxlc1BhbmVsKGNvbnRhaW5lcik7XG4gICAgICB9KTtcbiAgICB9KTtcbiAgICBjb25zdCBhZGRSb3cgPSBjb250YWluZXIuY3JlYXRlRGl2KFwiemliYXNlLXJ1bGVzLWFkZFwiKTtcbiAgICBjb25zdCBhZGRCdG4gPSBhZGRSb3cuY3JlYXRlRWwoXCJidXR0b25cIiwgeyB0ZXh0OiBcIisgQWRkIHJ1bGVcIiwgY2xzOiBcInppYmFzZS1ydWxlcy1hZGQtYnRuXCIgfSk7XG4gICAgYWRkQnRuLmFkZEV2ZW50TGlzdGVuZXIoXCJjbGlja1wiLCBhc3luYyAoKSA9PiB7XG4gICAgICB0aGlzLnBsdWdpbi5zZXR0aW5ncy5jb2x1bW5SdWxlcy5wdXNoKHsgbmFtZTogXCJcIiwgdHlwZTogXCJsYWJlbFwiIH0pO1xuICAgICAgYXdhaXQgdGhpcy5wbHVnaW4uc2F2ZVNldHRpbmdzKCk7XG4gICAgICB0aGlzLnJlbmRlclJ1bGVzUGFuZWwoY29udGFpbmVyKTtcbiAgICB9KTtcbiAgfVxuXG4gIGNvcHlBc01hcmtkb3duKHNjaGVtYTogVGFibGVTY2hlbWEsIGxpbmVzOiBzdHJpbmdbXSk6IHZvaWQge1xuICAgIGNvbnN0IGRhdGFSb3dzID0gbGluZXMuc2xpY2Uoc2NoZW1hLmRhdGFTdGFydEluZGV4KS5maWx0ZXIoaXNEYXRhUm93KTtcbiAgICBjb25zdCBoZWFkZXIgPSBcInwgXCIgKyBzY2hlbWEuY29sdW1ucy5tYXAoKGMpID0+IGMubmFtZSkuam9pbihcIiB8IFwiKSArIFwiIHxcIjtcbiAgICBjb25zdCBzZXBhcmF0b3IgPSBcInwgXCIgKyBzY2hlbWEuY29sdW1ucy5tYXAoKCkgPT4gXCItLS1cIikuam9pbihcIiB8IFwiKSArIFwiIHxcIjtcbiAgICBjb25zdCByb3dzID0gZGF0YVJvd3MubWFwKChsaW5lKSA9PiB7XG4gICAgICBjb25zdCBjZWxscyA9IHNwbGl0Um93KGxpbmUpO1xuICAgICAgcmV0dXJuIFwifCBcIiArIHNjaGVtYS5jb2x1bW5zLm1hcCgoXywgaSkgPT4gY2VsbHNbaV0gPz8gXCJcIikuam9pbihcIiB8IFwiKSArIFwiIHxcIjtcbiAgICB9KTtcbiAgICB2b2lkIG5hdmlnYXRvci5jbGlwYm9hcmQud3JpdGVUZXh0KFtoZWFkZXIsIHNlcGFyYXRvciwgLi4ucm93c10uam9pbihcIlxcblwiKSk7XG4gICAgc2hvd1RvYXN0KFwiXHVEODNEXHVEQ0NCIENvcGllZCBhcyBNYXJrZG93biFcIik7XG4gIH1cblxuICBhc3luYyBleHBvcnRDU1Yoc2NoZW1hOiBUYWJsZVNjaGVtYSwgbGluZXM6IHN0cmluZ1tdLCBjb250ZXh0OiBNYXJrZG93blBvc3RQcm9jZXNzb3JDb250ZXh0KTogUHJvbWlzZTx2b2lkPiB7XG4gICAgY29uc3QgZGF0YVJvd3MgPSBsaW5lcy5zbGljZShzY2hlbWEuZGF0YVN0YXJ0SW5kZXgpLmZpbHRlcihpc0RhdGFSb3cpO1xuICAgIGNvbnN0IGVzY2FwZSA9ICh2OiBzdHJpbmcpID0+IGBcIiR7di5yZXBsYWNlKC9cIi9nLCAnXCJcIicpfVwiYDtcbiAgICBjb25zdCBoZWFkZXIgPSBzY2hlbWEuY29sdW1ucy5tYXAoKGMpID0+IGVzY2FwZShjLm5hbWUpKS5qb2luKFwiLFwiKTtcbiAgICBjb25zdCByb3dzID0gZGF0YVJvd3MubWFwKChsaW5lKSA9PiB7XG4gICAgICBjb25zdCBjZWxscyA9IHNwbGl0Um93KGxpbmUpO1xuICAgICAgcmV0dXJuIHNjaGVtYS5jb2x1bW5zLm1hcCgoXywgaSkgPT4gZXNjYXBlKChjZWxsc1tpXSA/PyBcIlwiKS50cmltKCkpKS5qb2luKFwiLFwiKTtcbiAgICB9KTtcbiAgICBjb25zdCBub3RlTmFtZSA9IGNvbnRleHQuc291cmNlUGF0aC5yZXBsYWNlKC9cXC5tZCQvLCBcIlwiKTtcbiAgICBhd2FpdCB0aGlzLnNhdmVGaWxlKG5vdGVOYW1lICsgXCIuY3N2XCIsIFtoZWFkZXIsIC4uLnJvd3NdLmpvaW4oXCJcXG5cIiksIGNvbnRleHQpO1xuICAgIHNob3dUb2FzdChcIlx1RDgzRFx1RENFNCBFeHBvcnRlZCBhcyBDU1YhXCIpO1xuICB9XG5cbiAgYXN5bmMgZXhwb3J0SlNPTihzY2hlbWE6IFRhYmxlU2NoZW1hLCBsaW5lczogc3RyaW5nW10sIGNvbnRleHQ6IE1hcmtkb3duUG9zdFByb2Nlc3NvckNvbnRleHQpOiBQcm9taXNlPHZvaWQ+IHtcbiAgICBjb25zdCBkYXRhUm93cyA9IGxpbmVzLnNsaWNlKHNjaGVtYS5kYXRhU3RhcnRJbmRleCkuZmlsdGVyKGlzRGF0YVJvdyk7XG4gICAgY29uc3QgcmVjb3JkcyA9IGRhdGFSb3dzLm1hcCgobGluZSkgPT4ge1xuICAgICAgY29uc3QgY2VsbHMgPSBzcGxpdFJvdyhsaW5lKTtcbiAgICAgIGNvbnN0IG9iajogUmVjb3JkPHN0cmluZywgc3RyaW5nIHwgYm9vbGVhbiB8IG51bWJlciB8IG51bGw+ID0ge307XG4gICAgICBzY2hlbWEuY29sdW1ucy5mb3JFYWNoKChjb2wsIGkpID0+IHtcbiAgICAgICAgY29uc3QgcmF3ID0gKGNlbGxzW2ldID8/IFwiXCIpLnRyaW0oKTtcbiAgICAgICAgaWYgKGNvbC50eXBlLmtpbmQgPT09IFwidG9nZ2xlXCIpIG9ialtjb2wubmFtZV0gPSBwYXJzZUJvb2wocmF3KTtcbiAgICAgICAgZWxzZSBpZiAoY29sLnR5cGUua2luZCA9PT0gXCJudW1iZXJcIikgb2JqW2NvbC5uYW1lXSA9IHJhdyA/IHBhcnNlRmxvYXQocmF3KSA6IG51bGw7XG4gICAgICAgIGVsc2Ugb2JqW2NvbC5uYW1lXSA9IHJhdztcbiAgICAgIH0pO1xuICAgICAgcmV0dXJuIG9iajtcbiAgICB9KTtcbiAgICBjb25zdCBub3RlTmFtZSA9IGNvbnRleHQuc291cmNlUGF0aC5yZXBsYWNlKC9cXC5tZCQvLCBcIlwiKTtcbiAgICBhd2FpdCB0aGlzLnNhdmVGaWxlKG5vdGVOYW1lICsgXCIuanNvblwiLCBKU09OLnN0cmluZ2lmeShyZWNvcmRzLCBudWxsLCAyKSwgY29udGV4dCk7XG4gICAgc2hvd1RvYXN0KFwiXHVEODNEXHVEREM0XHVGRTBGIEV4cG9ydGVkIGFzIEpTT04hXCIpO1xuICB9XG5cbiAgYXN5bmMgc2F2ZUZpbGUoZmlsZW5hbWU6IHN0cmluZywgY29udGVudDogc3RyaW5nLCBjb250ZXh0OiBNYXJrZG93blBvc3RQcm9jZXNzb3JDb250ZXh0KTogUHJvbWlzZTx2b2lkPiB7XG4gICAgY29uc3QgZmlsZSA9IHRoaXMuYXBwLnZhdWx0LmdldEFic3RyYWN0RmlsZUJ5UGF0aChjb250ZXh0LnNvdXJjZVBhdGgpO1xuICAgIGlmICghKGZpbGUgaW5zdGFuY2VvZiBURmlsZSkpIHJldHVybjtcbiAgICBjb25zdCBmb2xkZXIgPSBmaWxlLnBhcmVudD8ucGF0aCA/PyBcIlwiO1xuICAgIGNvbnN0IGJhc2VOYW1lID0gZmlsZW5hbWUuc3BsaXQoXCIvXCIpLnBvcCgpID8/IGZpbGVuYW1lO1xuICAgIGNvbnN0IGZ1bGxQYXRoID0gZm9sZGVyID8gYCR7Zm9sZGVyfS8ke2Jhc2VOYW1lfWAgOiBiYXNlTmFtZTtcbiAgICBjb25zdCBleGlzdGluZyA9IHRoaXMuYXBwLnZhdWx0LmdldEFic3RyYWN0RmlsZUJ5UGF0aChmdWxsUGF0aCk7XG4gICAgaWYgKGV4aXN0aW5nIGluc3RhbmNlb2YgVEZpbGUpIGF3YWl0IHRoaXMuYXBwLnZhdWx0Lm1vZGlmeShleGlzdGluZywgY29udGVudCk7XG4gICAgZWxzZSBhd2FpdCB0aGlzLmFwcC52YXVsdC5jcmVhdGUoZnVsbFBhdGgsIGNvbnRlbnQpO1xuICB9XG5cbiAgc2hvd1R5cGVNZW51KFxuICAgIGU6IE1vdXNlRXZlbnQsXG4gICAgY29sSWR4OiBudW1iZXIsXG4gICAgc2NoZW1hOiBUYWJsZVNjaGVtYSxcbiAgICBjb250ZXh0OiBNYXJrZG93blBvc3RQcm9jZXNzb3JDb250ZXh0LFxuICAgIHNlY3Rpb25JbmZvOiBNYXJrZG93blNlY3Rpb25JbmZvcm1hdGlvbixcbiAgICBfcmF3RGF0YUxpbmVzOiBzdHJpbmdbXSxcbiAgICBiYWRnZTogSFRNTEVsZW1lbnQsXG4gICk6IHZvaWQge1xuICAgIGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3JBbGwoXCIuemliYXNlLWNvbnRleHQtbWVudVwiKS5mb3JFYWNoKChtKSA9PiBtLnJlbW92ZSgpKTtcbiAgICBjb25zdCBtZW51ID0gY3JlYXRlRGl2KCk7XG4gICAgbWVudS5jbGFzc05hbWUgPSBcInppYmFzZS1jb250ZXh0LW1lbnVcIjtcbiAgICBjb25zdCB4ID0gTWF0aC5taW4oZS5jbGllbnRYLCB3aW5kb3cuaW5uZXJXaWR0aCAtIDE2MCk7XG4gICAgbWVudS5zZXRDc3NTdHlsZXMoeyB0b3A6IGAke2UuY2xpZW50WSArIHdpbmRvdy5zY3JvbGxZfXB4YCB9KTtcbiAgICBtZW51LnNldENzc1N0eWxlcyh7IGxlZnQ6IGAke3h9cHhgIH0pO1xuICAgIGNvbnN0IHR5cGVzID0gW1xuICAgICAgeyBsYWJlbDogXCJUZXh0XCIsIGljb246IFwiVFwiLCBraW5kOiBcInRleHRcIiB9LFxuICAgICAgeyBsYWJlbDogXCJUb2dnbGVcIiwgaWNvbjogXCJcdTJCMUNcIiwga2luZDogXCJ0b2dnbGVcIiB9LFxuICAgICAgeyBsYWJlbDogXCJTZWxlY3RcIiwgaWNvbjogXCJcdTI1QkVcIiwga2luZDogXCJzZWxlY3RcIiB9LFxuICAgICAgeyBsYWJlbDogXCJMYWJlbFwiLCBpY29uOiBcIlx1MkIyMVwiLCBraW5kOiBcImxhYmVsXCIgfSxcbiAgICAgIHsgbGFiZWw6IFwiTXVsdGktc2VsZWN0XCIsIGljb246IFwiXHVEODNDXHVERkY3XHVGRTBGXCIsIGtpbmQ6IFwibXVsdGktc2VsZWN0XCIgfSxcbiAgICAgIHsgbGFiZWw6IFwiTnVtYmVyXCIsIGljb246IFwiI1wiLCBraW5kOiBcIm51bWJlclwiIH0sXG4gICAgICB7IGxhYmVsOiBcIkRhdGVcIiwgaWNvbjogXCJcdUQ4M0RcdURDQzVcIiwga2luZDogXCJkYXRlXCIgfSxcbiAgICAgIHsgbGFiZWw6IFwiRm9ybXVsYVwiLCBpY29uOiBcIlx1MDE5MlwiLCBraW5kOiBcImZvcm11bGFcIiB9LFxuICAgIF0gYXMgY29uc3Q7XG4gICAgbWVudS5jcmVhdGVEaXYoXCJ6aWJhc2UtbWVudS10aXRsZVwiKS50ZXh0Q29udGVudCA9IHNjaGVtYS5jb2x1bW5zW2NvbElkeF0/Lm5hbWUgPz8gXCJDb2x1bW5cIjtcbiAgICBjb25zdCBjb250cm9sbGVyID0gbmV3IEFib3J0Q29udHJvbGxlcigpO1xuICAgIGNvbnN0IGNsb3NlTWVudSA9ICgpID0+IHtcbiAgICAgIG1lbnUucmVtb3ZlKCk7XG4gICAgICBjb250cm9sbGVyLmFib3J0KCk7XG4gICAgfTtcbiAgICB0eXBlcy5mb3JFYWNoKCh7IGxhYmVsLCBpY29uLCBraW5kIH0pID0+IHtcbiAgICAgIGNvbnN0IGl0ZW0gPSBtZW51LmNyZWF0ZURpdihcInppYmFzZS1tZW51LWl0ZW1cIik7XG4gICAgICBpdGVtLmNyZWF0ZVNwYW4oeyB0ZXh0OiBpY29uLCBjbHM6IFwiemliYXNlLW1lbnUtaWNvblwiIH0pO1xuICAgICAgaXRlbS5jcmVhdGVTcGFuKHsgdGV4dDogbGFiZWwsIGNsczogXCJ6aWJhc2UtbWVudS1sYWJlbFwiIH0pO1xuICAgICAgaWYgKHNjaGVtYS5jb2x1bW5zW2NvbElkeF0/LnR5cGUua2luZCA9PT0ga2luZCkgaXRlbS5jbGFzc0xpc3QuYWRkKFwiemliYXNlLW1lbnUtYWN0aXZlXCIpO1xuICAgICAgaXRlbS5hZGRFdmVudExpc3RlbmVyKFwiY2xpY2tcIiwgYXN5bmMgKCkgPT4ge1xuICAgICAgICBjbG9zZU1lbnUoKTtcbiAgICAgICAgaWYgKGtpbmQgPT09IFwic2VsZWN0XCIpIHtcbiAgICAgICAgICBjb25zdCBjdXJyZW50T3B0cyA9IHNjaGVtYS5jb2x1bW5zW2NvbElkeF0/LnR5cGUua2luZCA9PT0gXCJzZWxlY3RcIiA/IHNjaGVtYS5jb2x1bW5zW2NvbElkeF0udHlwZS5vcHRpb25zIDogW107XG4gICAgICAgICAgbmV3IFNlbGVjdE9wdGlvbnNNb2RhbChcbiAgICAgICAgICAgIHRoaXMuYXBwLFxuICAgICAgICAgICAgc2NoZW1hLmNvbHVtbnNbY29sSWR4XT8ubmFtZSA/PyBcIkNvbHVtblwiLFxuICAgICAgICAgICAgY3VycmVudE9wdHMsXG4gICAgICAgICAgICBhc3luYyAob3B0cykgPT4ge1xuICAgICAgICAgICAgICBhd2FpdCB0aGlzLndyaXRlQ29sdW1uVHlwZShjb250ZXh0LCBzZWN0aW9uSW5mbywgc2NoZW1hLCBjb2xJZHgsIGBzZWxlY3Q6JHtvcHRzLmpvaW4oXCIsXCIpfWAsIGJhZGdlKTtcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgKS5vcGVuKCk7XG4gICAgICAgIH0gZWxzZSBpZiAoa2luZCA9PT0gXCJmb3JtdWxhXCIpIHtcbiAgICAgICAgICBjb25zdCBjb2xOYW1lID0gc2NoZW1hLmNvbHVtbnNbY29sSWR4XT8ubmFtZTtcbiAgICAgICAgICBjb25zdCBjdXJyZW50RXhwciA9IHNjaGVtYS5jb2x1bW5zW2NvbElkeF0/LnR5cGUua2luZCA9PT0gXCJmb3JtdWxhXCIgPyBzY2hlbWEuY29sdW1uc1tjb2xJZHhdLnR5cGUuZXhwcmVzc2lvbiA6IFwiXCI7XG4gICAgICAgICAgbmV3IEZvcm11bGFJbnB1dE1vZGFsKHRoaXMuYXBwLCBjb2xOYW1lIHx8IFwiQ29sdW1uXCIsIGN1cnJlbnRFeHByLCBzY2hlbWEuY29sdW1ucywgYXN5bmMgKGV4cHIpID0+IHtcbiAgICAgICAgICAgIGF3YWl0IHRoaXMud3JpdGVDb2x1bW5UeXBlKGNvbnRleHQsIHNlY3Rpb25JbmZvLCBzY2hlbWEsIGNvbElkeCwgYGZvcm11bGE6JHtleHByfWAsIGJhZGdlKTtcbiAgICAgICAgICB9KS5vcGVuKCk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgYXdhaXQgdGhpcy53cml0ZUNvbHVtblR5cGUoY29udGV4dCwgc2VjdGlvbkluZm8sIHNjaGVtYSwgY29sSWR4LCBraW5kLCBiYWRnZSk7XG4gICAgICAgIH1cbiAgICAgIH0pO1xuICAgIH0pO1xuICAgIGRvY3VtZW50LmJvZHkuYXBwZW5kQ2hpbGQobWVudSk7XG4gICAgd2luZG93LnNldFRpbWVvdXQoKCkgPT4ge1xuICAgICAgZG9jdW1lbnQuYWRkRXZlbnRMaXN0ZW5lcihcImNsaWNrXCIsIChldikgPT4ge1xuICAgICAgICBpZiAoIW1lbnUuY29udGFpbnMoZXYudGFyZ2V0IGFzIE5vZGUpKSBjbG9zZU1lbnUoKTtcbiAgICAgIH0sIHsgc2lnbmFsOiBjb250cm9sbGVyLnNpZ25hbCB9KTtcbiAgICB9LCAxMCk7XG4gIH1cblxuICBhc3luYyB3cml0ZUNvbHVtblR5cGUoXG4gICAgY29udGV4dDogTWFya2Rvd25Qb3N0UHJvY2Vzc29yQ29udGV4dCxcbiAgICBzZWN0aW9uSW5mbzogTWFya2Rvd25TZWN0aW9uSW5mb3JtYXRpb24sXG4gICAgc2NoZW1hOiBUYWJsZVNjaGVtYSxcbiAgICBjb2xJZHg6IG51bWJlcixcbiAgICB0eXBlU3RyOiBzdHJpbmcsXG4gICAgYmFkZ2U6IEhUTUxFbGVtZW50LFxuICApOiBQcm9taXNlPHZvaWQ+IHtcbiAgICBjb25zdCBmaWxlID0gdGhpcy5hcHAudmF1bHQuZ2V0QWJzdHJhY3RGaWxlQnlQYXRoKGNvbnRleHQuc291cmNlUGF0aCk7XG4gICAgaWYgKCEoZmlsZSBpbnN0YW5jZW9mIFRGaWxlKSkgcmV0dXJuO1xuICAgIGF3YWl0IHRoaXMuYXBwLnZhdWx0LnByb2Nlc3MoZmlsZSwgKGNvbnRlbnQpID0+IHtcbiAgICAgIGNvbnN0IGFsbExpbmVzID0gY29udGVudC5zcGxpdChcIlxcblwiKTtcbiAgICAgIGlmIChzY2hlbWEuaW5mZXJyZWQpIHtcbiAgICAgICAgY29uc3QgYW5ub3RhdGlvbkNlbGxzID0gc2NoZW1hLmNvbHVtbnMubWFwKChjb2wsIGkpID0+IHtcbiAgICAgICAgICBpZiAoaSA9PT0gY29sSWR4KSByZXR1cm4gYCA8IS0tIHppYmFzZTogJHt0eXBlU3RyfSAtLT4gYDtcbiAgICAgICAgICBpZiAoY29sLnR5cGUua2luZCA9PT0gXCJmb3JtdWxhXCIpIHJldHVybiBgIDwhLS0gemliYXNlOiBmb3JtdWxhOiR7Y29sLnR5cGUuZXhwcmVzc2lvbn0gLS0+IGA7XG4gICAgICAgICAgcmV0dXJuIGAgPCEtLSB6aWJhc2U6ICR7Y29sLnR5cGUua2luZH0gLS0+IGA7XG4gICAgICAgIH0pO1xuICAgICAgICBhbGxMaW5lcy5zcGxpY2Uoc2VjdGlvbkluZm8ubGluZVN0YXJ0ICsgMiwgMCwgXCJ8IFwiICsgYW5ub3RhdGlvbkNlbGxzLmpvaW4oXCIgfCBcIikgKyBcIiB8XCIpO1xuICAgICAgICB3aW5kb3cuc2V0VGltZW91dCgoKSA9PiB7XG4gICAgICAgICAgYmFkZ2UudGV4dENvbnRlbnQgPSBcImFubm90YXRlZFwiO1xuICAgICAgICAgIGJhZGdlLmNsYXNzTmFtZSA9IFwiemliYXNlLWFubm90YXRlZC1iYWRnZVwiO1xuICAgICAgICB9LCA1MCk7XG4gICAgICB9IGVsc2UgaWYgKHNjaGVtYS5zY2hlbWFSb3dJbmRleCAhPT0gbnVsbCkge1xuICAgICAgICBjb25zdCBjZWxscyA9IHNwbGl0Um93KGFsbExpbmVzW3NlY3Rpb25JbmZvLmxpbmVTdGFydCArIHNjaGVtYS5zY2hlbWFSb3dJbmRleF0pO1xuICAgICAgICBjZWxsc1tjb2xJZHhdID0gYCA8IS0tIHppYmFzZTogJHt0eXBlU3RyfSAtLT4gYDtcbiAgICAgICAgYWxsTGluZXNbc2VjdGlvbkluZm8ubGluZVN0YXJ0ICsgc2NoZW1hLnNjaGVtYVJvd0luZGV4XSA9IHNlcmlhbGl6ZVJvdyhjZWxscyk7XG4gICAgICB9XG4gICAgICByZXR1cm4gYWxsTGluZXMuam9pbihcIlxcblwiKTtcbiAgICB9KTtcbiAgfVxuXG4gIHJlbmRlckNlbGwoXG4gICAgdGQ6IEhUTUxUYWJsZUNlbGxFbGVtZW50LFxuICAgIGNvbDogQ29sdW1uLFxuICAgIHJhd1ZhbHVlOiBzdHJpbmcsXG4gICAgY29udGV4dDogTWFya2Rvd25Qb3N0UHJvY2Vzc29yQ29udGV4dCxcbiAgICBzY2hlbWE6IFRhYmxlU2NoZW1hLFxuICAgIHJvd0NlbGxzOiBzdHJpbmdbXSxcbiAgICBvbkNoYW5nZTogQ2VsbENoYW5nZUhhbmRsZXIsXG4gICk6IHZvaWQge1xuICAgIHJlbmRlckNlbGwodGhpcywgdGQsIGNvbCwgcmF3VmFsdWUsIGNvbnRleHQsIHNjaGVtYSwgcm93Q2VsbHMsIG9uQ2hhbmdlKTtcbiAgfVxuXG4gIGFzeW5jIHdyaXRlQmFjayhcbiAgICBjb250ZXh0OiBNYXJrZG93blBvc3RQcm9jZXNzb3JDb250ZXh0LFxuICAgIHNlY3Rpb25JbmZvOiBNYXJrZG93blNlY3Rpb25JbmZvcm1hdGlvbixcbiAgICB0YWJsZVJvd0luZGV4OiBudW1iZXIsXG4gICAgY29sSW5kZXg6IG51bWJlcixcbiAgICBuZXdWYWx1ZTogc3RyaW5nLFxuICApOiBQcm9taXNlPHZvaWQ+IHtcbiAgICBjb25zdCBmaWxlID0gdGhpcy5hcHAudmF1bHQuZ2V0QWJzdHJhY3RGaWxlQnlQYXRoKGNvbnRleHQuc291cmNlUGF0aCk7XG4gICAgaWYgKCEoZmlsZSBpbnN0YW5jZW9mIFRGaWxlKSkgcmV0dXJuO1xuICAgIGF3YWl0IHRoaXMuYXBwLnZhdWx0LnByb2Nlc3MoZmlsZSwgKGNvbnRlbnQpID0+IHtcbiAgICAgIGNvbnN0IGFsbExpbmVzID0gY29udGVudC5zcGxpdChcIlxcblwiKTtcbiAgICAgIGNvbnN0IGZpbGVMaW5lSW5kZXggPSBzZWN0aW9uSW5mby5saW5lU3RhcnQgKyB0YWJsZVJvd0luZGV4O1xuICAgICAgY29uc3QgdGFyZ2V0TGluZSA9IGFsbExpbmVzW2ZpbGVMaW5lSW5kZXhdO1xuICAgICAgaWYgKCF0YXJnZXRMaW5lKSByZXR1cm4gY29udGVudDtcbiAgICAgIGNvbnN0IGNlbGxzID0gc3BsaXRSb3codGFyZ2V0TGluZSk7XG4gICAgICBjZWxsc1tjb2xJbmRleF0gPSBgICR7bmV3VmFsdWV9IGA7XG4gICAgICBhbGxMaW5lc1tmaWxlTGluZUluZGV4XSA9IHNlcmlhbGl6ZVJvdyhjZWxscyk7XG4gICAgICByZXR1cm4gYWxsTGluZXMuam9pbihcIlxcblwiKTtcbiAgICB9KTtcbiAgfVxuXG4gIGFzeW5jIGFkZFJvdyhcbiAgICBjb250ZXh0OiBNYXJrZG93blBvc3RQcm9jZXNzb3JDb250ZXh0LFxuICAgIHNlY3Rpb25JbmZvOiBNYXJrZG93blNlY3Rpb25JbmZvcm1hdGlvbixcbiAgICBzY2hlbWE6IFRhYmxlU2NoZW1hLFxuICApOiBQcm9taXNlPHZvaWQ+IHtcbiAgICBjb25zdCBmaWxlID0gdGhpcy5hcHAudmF1bHQuZ2V0QWJzdHJhY3RGaWxlQnlQYXRoKGNvbnRleHQuc291cmNlUGF0aCk7XG4gICAgaWYgKCEoZmlsZSBpbnN0YW5jZW9mIFRGaWxlKSkgcmV0dXJuO1xuICAgIGF3YWl0IHRoaXMuYXBwLnZhdWx0LnByb2Nlc3MoZmlsZSwgKGNvbnRlbnQpID0+IHtcbiAgICAgIGNvbnN0IGFsbExpbmVzID0gY29udGVudC5zcGxpdChcIlxcblwiKTtcbiAgICAgIGFsbExpbmVzLnNwbGljZShzZWN0aW9uSW5mby5saW5lRW5kICsgMSwgMCwgc2VyaWFsaXplUm93KHNjaGVtYS5jb2x1bW5zLm1hcCgoKSA9PiBcIiAgIFwiKSkpO1xuICAgICAgcmV0dXJuIGFsbExpbmVzLmpvaW4oXCJcXG5cIik7XG4gICAgfSk7XG4gIH1cblxuICBhc3luYyByZXJlbmRlclRleHRDZWxsKHRkOiBIVE1MRWxlbWVudCwgbmV3UmF3OiBzdHJpbmcsIGNvbnRleHQ6IE1hcmtkb3duUG9zdFByb2Nlc3NvckNvbnRleHQpOiBQcm9taXNlPHZvaWQ+IHtcbiAgICB0ZC5kYXRhc2V0LnJhdyA9IG5ld1JhdztcbiAgICBjb25zdCBkaXNwbGF5U3BhbiA9IHRkLnF1ZXJ5U2VsZWN0b3IoXCIuemliYXNlLXRleHQtcmVuZGVyZWRcIik7XG4gICAgaWYgKCFkaXNwbGF5U3BhbikgcmV0dXJuO1xuICAgIGRpc3BsYXlTcGFuLmVtcHR5KCk7XG4gICAgaWYgKG5ld1Jhdykge1xuICAgICAgYXdhaXQgTWFya2Rvd25SZW5kZXJlci5yZW5kZXJNYXJrZG93bihuZXdSYXcsIGRpc3BsYXlTcGFuIGFzIEhUTUxFbGVtZW50LCBjb250ZXh0LnNvdXJjZVBhdGgsIHRoaXMucGx1Z2luKTtcbiAgICAgIHdpbmRvdy5zZXRUaW1lb3V0KCgpID0+IHtcbiAgICAgICAgZGlzcGxheVNwYW4ucXVlcnlTZWxlY3RvckFsbChcImFcIikuZm9yRWFjaCgoYSkgPT4gYXR0YWNoTGlua1Rvb2x0aXAoYSkpO1xuICAgICAgfSwgNTApO1xuICAgICAgZGlzcGxheVNwYW4uY2xhc3NMaXN0LnJlbW92ZShcInppYmFzZS10ZXh0LWVtcHR5XCIpO1xuICAgIH0gZWxzZSB7XG4gICAgICBkaXNwbGF5U3Bhbi50ZXh0Q29udGVudCA9IFwiXHUyMDE0XCI7XG4gICAgICBkaXNwbGF5U3Bhbi5jbGFzc0xpc3QuYWRkKFwiemliYXNlLXRleHQtZW1wdHlcIik7XG4gICAgfVxuICB9XG59XG4iLCAiaW1wb3J0IHsgTWFya2Rvd25SZW5kZXJlciwgdHlwZSBNYXJrZG93blBvc3RQcm9jZXNzb3JDb250ZXh0IH0gZnJvbSBcIm9ic2lkaWFuXCI7XG5pbXBvcnQge1xuICBldmFsdWF0ZUZvcm11bGEsXG4gIGV2YWx1YXRlU2ltcGxlTWF0aCxcbiAgZm9ybWF0UmVzdWx0LFxuICBpc0JhY2t0aWNrZWQsXG4gIGlzU2ltcGxlTWF0aCxcbiAgc3RyaXBCYWNrdGlja3MsXG59IGZyb20gXCIuL2Zvcm11bGFcIjtcbmltcG9ydCB7IHBhcnNlQm9vbCwgcGFyc2VNdWx0aVNlbGVjdCwgc2VyaWFsaXplQm9vbCB9IGZyb20gXCIuL3NjaGVtYVwiO1xuaW1wb3J0IHR5cGUgeyBDZWxsQ2hhbmdlSGFuZGxlciwgQ29sdW1uLCBUYWJsZVNjaGVtYSwgWmlCYXNlSG9zdCB9IGZyb20gXCIuL3R5cGVzXCI7XG5pbXBvcnQgeyBhdHRhY2hMaW5rVG9vbHRpcCwgZ2V0TGFiZWxDb2xvciwgc3RhcnRMYWJlbEVkaXQgfSBmcm9tIFwiLi91aVwiO1xuXG5leHBvcnQgZnVuY3Rpb24gc3RhcnRNYXJrZG93bkVkaXQoXG4gIHRkOiBIVE1MRWxlbWVudCxcbiAgcmF3VmFsdWU6IHN0cmluZyxcbiAgY29udGV4dDogTWFya2Rvd25Qb3N0UHJvY2Vzc29yQ29udGV4dCxcbiAgaG9zdDogWmlCYXNlSG9zdCxcbiAgb25DaGFuZ2U6IENlbGxDaGFuZ2VIYW5kbGVyLFxuKTogdm9pZCB7XG4gIGlmICh0ZC5xdWVyeVNlbGVjdG9yKFwiLnppYmFzZS1pbmxpbmUtaW5wdXRcIikpIHJldHVybjtcbiAgY29uc3QgZGlzcGxheVNwYW4gPSB0ZC5xdWVyeVNlbGVjdG9yKFwiLnppYmFzZS10ZXh0LXJlbmRlcmVkXCIpIGFzIEhUTUxFbGVtZW50IHwgbnVsbDtcbiAgaWYgKGRpc3BsYXlTcGFuKSBkaXNwbGF5U3Bhbi5zZXRDc3NTdHlsZXMoeyBkaXNwbGF5OiBcIm5vbmVcIiB9KTtcbiAgY29uc3QgaW5wdXQgPSBjcmVhdGVFbChcImlucHV0XCIpO1xuICBpbnB1dC5jbGFzc05hbWUgPSBcInppYmFzZS1pbmxpbmUtaW5wdXRcIjtcbiAgaW5wdXQudmFsdWUgPSByYXdWYWx1ZTtcbiAgdGQuYXBwZW5kQ2hpbGQoaW5wdXQpO1xuICBpbnB1dC5mb2N1cygpO1xuICBpbnB1dC5zZWxlY3QoKTtcbiAgY29uc3QgY29tbWl0ID0gYXN5bmMgKCkgPT4ge1xuICAgIGNvbnN0IG5ld1ZhbCA9IGlucHV0LnZhbHVlO1xuICAgIGlucHV0LnJlbW92ZSgpO1xuICAgIGlmIChkaXNwbGF5U3BhbikgZGlzcGxheVNwYW4uc2V0Q3NzU3R5bGVzKHsgZGlzcGxheTogXCJcIiB9KTtcbiAgICBhd2FpdCBvbkNoYW5nZShuZXdWYWwpO1xuICAgIGF3YWl0IGhvc3QucmVyZW5kZXJUZXh0Q2VsbCh0ZCwgbmV3VmFsLCBjb250ZXh0KTtcbiAgfTtcbiAgaW5wdXQuYWRkRXZlbnRMaXN0ZW5lcihcImJsdXJcIiwgKCkgPT4geyB2b2lkIGNvbW1pdCgpOyB9KTtcbiAgaW5wdXQuYWRkRXZlbnRMaXN0ZW5lcihcImtleWRvd25cIiwgKGU6IEtleWJvYXJkRXZlbnQpID0+IHtcbiAgICBpZiAoZS5rZXkgPT09IFwiRW50ZXJcIikge1xuICAgICAgZS5wcmV2ZW50RGVmYXVsdCgpO1xuICAgICAgdm9pZCBjb21taXQoKTtcbiAgICB9XG4gICAgaWYgKGUua2V5ID09PSBcIkVzY2FwZVwiKSB7XG4gICAgICBpbnB1dC5yZW1vdmUoKTtcbiAgICAgIGlmIChkaXNwbGF5U3BhbikgZGlzcGxheVNwYW4uc2V0Q3NzU3R5bGVzKHsgZGlzcGxheTogXCJcIiB9KTtcbiAgICB9XG4gIH0pO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gcmVuZGVyQ2VsbChcbiAgaG9zdDogWmlCYXNlSG9zdCxcbiAgdGQ6IEhUTUxUYWJsZUNlbGxFbGVtZW50LFxuICBjb2w6IENvbHVtbixcbiAgcmF3VmFsdWU6IHN0cmluZyxcbiAgY29udGV4dDogTWFya2Rvd25Qb3N0UHJvY2Vzc29yQ29udGV4dCxcbiAgc2NoZW1hOiBUYWJsZVNjaGVtYSxcbiAgcm93Q2VsbHM6IHN0cmluZ1tdLFxuICBvbkNoYW5nZTogQ2VsbENoYW5nZUhhbmRsZXIsXG4pOiB2b2lkIHtcbiAgc3dpdGNoIChjb2wudHlwZS5raW5kKSB7XG4gICAgY2FzZSBcInRvZ2dsZVwiOiB7XG4gICAgICBjb25zdCBjaGVja2VkID0gcGFyc2VCb29sKHJhd1ZhbHVlKTtcbiAgICAgIGNvbnN0IGxhYmVsID0gdGQuY3JlYXRlRWwoXCJsYWJlbFwiLCB7IGNsczogXCJ6aWJhc2UtdG9nZ2xlLWxhYmVsXCIgfSk7XG4gICAgICBjb25zdCBpbnB1dCA9IGxhYmVsLmNyZWF0ZUVsKFwiaW5wdXRcIiwgeyB0eXBlOiBcImNoZWNrYm94XCIgfSk7XG4gICAgICBpbnB1dC5jaGVja2VkID0gY2hlY2tlZDtcbiAgICAgIGlucHV0LmNsYXNzTmFtZSA9IFwiemliYXNlLXRvZ2dsZS1pbnB1dFwiO1xuICAgICAgbGFiZWwuY3JlYXRlRGl2KFwiemliYXNlLXRvZ2dsZS10cmFja1wiKS5jcmVhdGVEaXYoXCJ6aWJhc2UtdG9nZ2xlLXRodW1iXCIpO1xuICAgICAgaW5wdXQuYWRkRXZlbnRMaXN0ZW5lcihcImNoYW5nZVwiLCBhc3luYyAoKSA9PiBhd2FpdCBvbkNoYW5nZShzZXJpYWxpemVCb29sKGlucHV0LmNoZWNrZWQpKSk7XG4gICAgICBicmVhaztcbiAgICB9XG4gICAgY2FzZSBcInNlbGVjdFwiOiB7XG4gICAgICBjb25zdCBzZWxlY3QgPSB0ZC5jcmVhdGVFbChcInNlbGVjdFwiLCB7IGNsczogXCJ6aWJhc2Utc2VsZWN0XCIgfSk7XG4gICAgICBzZWxlY3QuY3JlYXRlRWwoXCJvcHRpb25cIiwgeyB2YWx1ZTogXCJcIiwgdGV4dDogXCJcdTIwMTRcIiB9KTtcbiAgICAgIGNvbC50eXBlLm9wdGlvbnMuZm9yRWFjaCgob3B0KSA9PiB7XG4gICAgICAgIGNvbnN0IG8gPSBzZWxlY3QuY3JlYXRlRWwoXCJvcHRpb25cIiwgeyB0ZXh0OiBvcHQsIHZhbHVlOiBvcHQgfSk7XG4gICAgICAgIGlmIChvcHQgPT09IHJhd1ZhbHVlLnRyaW0oKSkgby5zZWxlY3RlZCA9IHRydWU7XG4gICAgICB9KTtcbiAgICAgIGlmICghcmF3VmFsdWUudHJpbSgpKSBzZWxlY3Qub3B0aW9uc1swXS5zZWxlY3RlZCA9IHRydWU7XG4gICAgICBzZWxlY3QuYWRkRXZlbnRMaXN0ZW5lcihcImNoYW5nZVwiLCBhc3luYyAoKSA9PiBhd2FpdCBvbkNoYW5nZShzZWxlY3QudmFsdWUpKTtcbiAgICAgIGJyZWFrO1xuICAgIH1cbiAgICBjYXNlIFwibXVsdGktc2VsZWN0XCI6IHtcbiAgICAgIGNvbnN0IHdyYXAgPSB0ZC5jcmVhdGVEaXYoXCJ6aWJhc2UtbXVsdGktc2VsZWN0LXdyYXBcIik7XG4gICAgICBjb25zdCB0YWdzID0gcGFyc2VNdWx0aVNlbGVjdChyYXdWYWx1ZSk7XG4gICAgICBpZiAodGFncy5sZW5ndGggPT09IDApIHtcbiAgICAgICAgY29uc3QgZW1wdHkgPSB3cmFwLmNyZWF0ZVNwYW4oeyB0ZXh0OiBcIlx1MjAxNFwiLCBjbHM6IFwiemliYXNlLXRleHQtZW1wdHlcIiB9KTtcbiAgICAgICAgZW1wdHkuYWRkRXZlbnRMaXN0ZW5lcihcImNsaWNrXCIsICgpID0+IHN0YXJ0TGFiZWxFZGl0KHdyYXAsIHJhd1ZhbHVlLCBvbkNoYW5nZSkpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgdGFncy5mb3JFYWNoKCh0YWcpID0+IHtcbiAgICAgICAgICBjb25zdCBjaGlwID0gd3JhcC5jcmVhdGVTcGFuKHsgdGV4dDogdGFnLCBjbHM6IFwiemliYXNlLWxhYmVsXCIgfSk7XG4gICAgICAgICAgY2hpcC5zdHlsZS5zZXRQcm9wZXJ0eShcIi0tbGNcIiwgZ2V0TGFiZWxDb2xvcih0YWcpKTtcbiAgICAgICAgICBjaGlwLmFkZEV2ZW50TGlzdGVuZXIoXCJjbGlja1wiLCAoZSkgPT4ge1xuICAgICAgICAgICAgZS5zdG9wUHJvcGFnYXRpb24oKTtcbiAgICAgICAgICAgIHN0YXJ0TGFiZWxFZGl0KHdyYXAsIHJhd1ZhbHVlLCBvbkNoYW5nZSk7XG4gICAgICAgICAgfSk7XG4gICAgICAgIH0pO1xuICAgICAgICB3cmFwLmFkZEV2ZW50TGlzdGVuZXIoXCJjbGlja1wiLCAoKSA9PiBzdGFydExhYmVsRWRpdCh3cmFwLCByYXdWYWx1ZSwgb25DaGFuZ2UpKTtcbiAgICAgIH1cbiAgICAgIGJyZWFrO1xuICAgIH1cbiAgICBjYXNlIFwibGFiZWxcIjoge1xuICAgICAgY29uc3QgY2hpcCA9IHRkLmNyZWF0ZUVsKFwic3BhblwiLCB7IHRleHQ6IHJhd1ZhbHVlLnRyaW0oKSB8fCBcIlx1MjAxNFwiLCBjbHM6IFwiemliYXNlLWxhYmVsXCIgfSk7XG4gICAgICBjaGlwLnN0eWxlLnNldFByb3BlcnR5KFwiLS1sY1wiLCBnZXRMYWJlbENvbG9yKHJhd1ZhbHVlLnRyaW0oKSkpO1xuICAgICAgY2hpcC5hZGRFdmVudExpc3RlbmVyKFwiY2xpY2tcIiwgKCkgPT4gc3RhcnRMYWJlbEVkaXQoY2hpcCwgcmF3VmFsdWUudHJpbSgpLCBvbkNoYW5nZSkpO1xuICAgICAgYnJlYWs7XG4gICAgfVxuICAgIGNhc2UgXCJudW1iZXJcIjoge1xuICAgICAgY29uc3QgaW5wdXQgPSB0ZC5jcmVhdGVFbChcImlucHV0XCIsIHsgdHlwZTogXCJudW1iZXJcIiwgY2xzOiBcInppYmFzZS1udW1iZXJcIiB9KTtcbiAgICAgIGlucHV0LnZhbHVlID0gcmF3VmFsdWUudHJpbSgpO1xuICAgICAgbGV0IGRlYm91bmNlID0gMDtcbiAgICAgIGlucHV0LmFkZEV2ZW50TGlzdGVuZXIoXCJpbnB1dFwiLCAoKSA9PiB7XG4gICAgICAgIHdpbmRvdy5jbGVhclRpbWVvdXQoZGVib3VuY2UpO1xuICAgICAgICBkZWJvdW5jZSA9IHdpbmRvdy5zZXRUaW1lb3V0KGFzeW5jICgpID0+IGF3YWl0IG9uQ2hhbmdlKGlucHV0LnZhbHVlKSwgNDAwKTtcbiAgICAgIH0pO1xuICAgICAgYnJlYWs7XG4gICAgfVxuICAgIGNhc2UgXCJkYXRlXCI6IHtcbiAgICAgIGNvbnN0IHZhbCA9IHJhd1ZhbHVlLnRyaW0oKTtcbiAgICAgIGNvbnN0IGRpc3BsYXlTcGFuID0gdGQuY3JlYXRlU3Bhbih7IHRleHQ6IHZhbCB8fCBcIlx1MjAxNFwiLCBjbHM6IHZhbCA/IFwiemliYXNlLWRhdGUtcmVuZGVyZWRcIiA6IFwiemliYXNlLXRleHQtZW1wdHlcIiB9KTtcbiAgICAgIHRkLmFkZEV2ZW50TGlzdGVuZXIoXCJjbGlja1wiLCAoKSA9PiB7XG4gICAgICAgIGlmICh0ZC5xdWVyeVNlbGVjdG9yKFwiaW5wdXRcIikpIHJldHVybjtcbiAgICAgICAgZGlzcGxheVNwYW4uc2V0Q3NzU3R5bGVzKHsgZGlzcGxheTogXCJub25lXCIgfSk7XG4gICAgICAgIGNvbnN0IGlucHV0ID0gdGQuY3JlYXRlRWwoXCJpbnB1dFwiLCB7IHR5cGU6IFwiZGF0ZVwiLCBjbHM6IFwiemliYXNlLWRhdGVcIiB9KTtcbiAgICAgICAgaW5wdXQudmFsdWUgPSB2YWw7XG4gICAgICAgIGlucHV0LmZvY3VzKCk7XG4gICAgICAgIGNvbnN0IHBpY2tlciA9IGlucHV0IGFzIEhUTUxJbnB1dEVsZW1lbnQgJiB7IHNob3dQaWNrZXI/OiAoKSA9PiB2b2lkIH07XG4gICAgICAgIGlmICh0eXBlb2YgcGlja2VyLnNob3dQaWNrZXIgPT09IFwiZnVuY3Rpb25cIikge1xuICAgICAgICAgIHRyeSB7IHBpY2tlci5zaG93UGlja2VyKCk7IH0gY2F0Y2ggeyAvKiBpZ25vcmVkICovIH1cbiAgICAgICAgfVxuICAgICAgICBjb25zdCBjb21taXQgPSBhc3luYyAoKSA9PiB7XG4gICAgICAgICAgY29uc3QgbmV3VmFsID0gaW5wdXQudmFsdWU7XG4gICAgICAgICAgaW5wdXQucmVtb3ZlKCk7XG4gICAgICAgICAgZGlzcGxheVNwYW4udGV4dENvbnRlbnQgPSBuZXdWYWwgfHwgXCJcdTIwMTRcIjtcbiAgICAgICAgICBkaXNwbGF5U3Bhbi5jbGFzc05hbWUgPSBuZXdWYWwgPyBcInppYmFzZS1kYXRlLXJlbmRlcmVkXCIgOiBcInppYmFzZS10ZXh0LWVtcHR5XCI7XG4gICAgICAgICAgZGlzcGxheVNwYW4uc2V0Q3NzU3R5bGVzKHsgZGlzcGxheTogXCJcIiB9KTtcbiAgICAgICAgICBhd2FpdCBvbkNoYW5nZShuZXdWYWwpO1xuICAgICAgICB9O1xuICAgICAgICBpbnB1dC5hZGRFdmVudExpc3RlbmVyKFwiYmx1clwiLCAoKSA9PiB7IHZvaWQgY29tbWl0KCk7IH0pO1xuICAgICAgICBpbnB1dC5hZGRFdmVudExpc3RlbmVyKFwia2V5ZG93blwiLCAoZSkgPT4ge1xuICAgICAgICAgIGlmIChlLmtleSA9PT0gXCJFbnRlclwiKSB2b2lkIGNvbW1pdCgpO1xuICAgICAgICAgIGlmIChlLmtleSA9PT0gXCJFc2NhcGVcIikge1xuICAgICAgICAgICAgaW5wdXQucmVtb3ZlKCk7XG4gICAgICAgICAgICBkaXNwbGF5U3Bhbi5zZXRDc3NTdHlsZXMoeyBkaXNwbGF5OiBcIlwiIH0pO1xuICAgICAgICAgIH1cbiAgICAgICAgfSk7XG4gICAgICB9KTtcbiAgICAgIGJyZWFrO1xuICAgIH1cbiAgICBjYXNlIFwiZm9ybXVsYVwiOiB7XG4gICAgICBjb25zdCB2YWwgPSByYXdWYWx1ZS50cmltKCk7XG4gICAgICBpZiAoaXNCYWNrdGlja2VkKHZhbCkpIHtcbiAgICAgICAgdGQuY3JlYXRlU3Bhbih7IHRleHQ6IHN0cmlwQmFja3RpY2tzKHZhbCksIGNsczogXCJ6aWJhc2UtZm9ybXVsYS1zb3VyY2VcIiB9KTtcbiAgICAgICAgYnJlYWs7XG4gICAgICB9XG4gICAgICBpZiAoaXNTaW1wbGVNYXRoKHZhbCkpIHtcbiAgICAgICAgY29uc3QgcmVzdWx0ID0gZXZhbHVhdGVTaW1wbGVNYXRoKHZhbCk7XG4gICAgICAgIGNvbnN0IHNwYW4gPSB0ZC5jcmVhdGVTcGFuKHsgdGV4dDogZm9ybWF0UmVzdWx0KHJlc3VsdCksIGNsczogXCJ6aWJhc2UtZm9ybXVsYS1yZXN1bHRcIiB9KTtcbiAgICAgICAgc3Bhbi50aXRsZSA9IHZhbDtcbiAgICAgICAgYnJlYWs7XG4gICAgICB9XG4gICAgICBpZiAoY29sLnR5cGUuZXhwcmVzc2lvbikge1xuICAgICAgICBjb25zdCByb3dEYXRhOiBSZWNvcmQ8c3RyaW5nLCBzdHJpbmc+ID0ge307XG4gICAgICAgIHNjaGVtYS5jb2x1bW5zLmZvckVhY2goKGMsIGkpID0+IHtcbiAgICAgICAgICByb3dEYXRhW2MubmFtZV0gPSAocm93Q2VsbHNbaV0gPz8gXCJcIikudHJpbSgpO1xuICAgICAgICB9KTtcbiAgICAgICAgY29uc3QgcmVzdWx0ID0gZXZhbHVhdGVGb3JtdWxhKGNvbC50eXBlLmV4cHJlc3Npb24sIHJvd0RhdGEpO1xuICAgICAgICBjb25zdCBkaXNwbGF5VmFsID0gZm9ybWF0UmVzdWx0KHJlc3VsdCk7XG4gICAgICAgIGNvbnN0IHNwYW4gPSB0ZC5jcmVhdGVTcGFuKHsgdGV4dDogZGlzcGxheVZhbCwgY2xzOiBcInppYmFzZS1mb3JtdWxhLXJlc3VsdFwiIH0pO1xuICAgICAgICBzcGFuLnRpdGxlID0gYFx1MDE5MiAke2NvbC50eXBlLmV4cHJlc3Npb259ID0gJHtkaXNwbGF5VmFsfWA7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICB0ZC5jcmVhdGVTcGFuKHsgdGV4dDogdmFsIHx8IFwiXHUwMTkyXCIsIGNsczogXCJ6aWJhc2UtZm9ybXVsYS1lbXB0eVwiIH0pO1xuICAgICAgfVxuICAgICAgYnJlYWs7XG4gICAgfVxuICAgIGRlZmF1bHQ6IHtcbiAgICAgIGNvbnN0IHZhbCA9IHJhd1ZhbHVlLnRyaW0oKTtcbiAgICAgIHRkLmRhdGFzZXQucmF3ID0gdmFsO1xuXG4gICAgICBpZiAoaXNTaW1wbGVNYXRoKHZhbCkpIHtcbiAgICAgICAgY29uc3QgcmVzdWx0ID0gZXZhbHVhdGVTaW1wbGVNYXRoKHZhbCk7XG4gICAgICAgIGNvbnN0IHNwYW4gPSB0ZC5jcmVhdGVTcGFuKHsgdGV4dDogZm9ybWF0UmVzdWx0KHJlc3VsdCksIGNsczogXCJ6aWJhc2UtZm9ybXVsYS1yZXN1bHQgemliYXNlLXRleHQtcmVuZGVyZWRcIiB9KTtcbiAgICAgICAgc3Bhbi50aXRsZSA9IHZhbDtcbiAgICAgICAgdGQuYWRkRXZlbnRMaXN0ZW5lcihcImNsaWNrXCIsIChlKSA9PiB7XG4gICAgICAgICAgZS5wcmV2ZW50RGVmYXVsdCgpO1xuICAgICAgICAgIGUuc3RvcFByb3BhZ2F0aW9uKCk7XG4gICAgICAgICAgc3RhcnRNYXJrZG93bkVkaXQodGQsIHRkLmRhdGFzZXQucmF3IHx8IHZhbCwgY29udGV4dCwgaG9zdCwgb25DaGFuZ2UpO1xuICAgICAgICB9KTtcbiAgICAgICAgYnJlYWs7XG4gICAgICB9XG5cbiAgICAgIGlmIChpc0JhY2t0aWNrZWQodmFsKSkge1xuICAgICAgICB0ZC5jcmVhdGVTcGFuKHsgdGV4dDogc3RyaXBCYWNrdGlja3ModmFsKSwgY2xzOiBcInppYmFzZS1mb3JtdWxhLXNvdXJjZSB6aWJhc2UtdGV4dC1yZW5kZXJlZFwiIH0pO1xuICAgICAgICB0ZC5hZGRFdmVudExpc3RlbmVyKFwiY2xpY2tcIiwgKGUpID0+IHtcbiAgICAgICAgICBlLnByZXZlbnREZWZhdWx0KCk7XG4gICAgICAgICAgZS5zdG9wUHJvcGFnYXRpb24oKTtcbiAgICAgICAgICBzdGFydE1hcmtkb3duRWRpdCh0ZCwgdGQuZGF0YXNldC5yYXcgfHwgdmFsLCBjb250ZXh0LCBob3N0LCBvbkNoYW5nZSk7XG4gICAgICAgIH0pO1xuICAgICAgICBicmVhaztcbiAgICAgIH1cblxuICAgICAgY29uc3QgZGlzcGxheVNwYW4gPSB0ZC5jcmVhdGVTcGFuKHsgY2xzOiBcInppYmFzZS10ZXh0LXJlbmRlcmVkXCIgfSk7XG4gICAgICBpZiAodmFsKSB7XG4gICAgICAgIHZvaWQgTWFya2Rvd25SZW5kZXJlci5yZW5kZXJNYXJrZG93bih2YWwsIGRpc3BsYXlTcGFuLCBjb250ZXh0LnNvdXJjZVBhdGgsIGhvc3QucGx1Z2luKS50aGVuKCgpID0+IHtcbiAgICAgICAgICBkaXNwbGF5U3Bhbi5xdWVyeVNlbGVjdG9yQWxsKFwiYVwiKS5mb3JFYWNoKChhKSA9PiBhdHRhY2hMaW5rVG9vbHRpcChhKSk7XG4gICAgICAgICAgdGQuYWRkRXZlbnRMaXN0ZW5lcihcImNsaWNrXCIsIChlKSA9PiB7XG4gICAgICAgICAgICBpZiAoZS5hbHRLZXkpIHtcbiAgICAgICAgICAgICAgZS5wcmV2ZW50RGVmYXVsdCgpO1xuICAgICAgICAgICAgICBlLnN0b3BQcm9wYWdhdGlvbigpO1xuICAgICAgICAgICAgICBzdGFydE1hcmtkb3duRWRpdCh0ZCwgdGQuZGF0YXNldC5yYXcgfHwgdmFsLCBjb250ZXh0LCBob3N0LCBvbkNoYW5nZSk7XG4gICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGNvbnN0IHRhcmdldCA9IGUudGFyZ2V0IGFzIEhUTUxFbGVtZW50IHwgbnVsbDtcbiAgICAgICAgICAgIGlmICh0YXJnZXQ/LmNsb3Nlc3Q/LihcImFcIikpIHJldHVybjtcbiAgICAgICAgICAgIGUucHJldmVudERlZmF1bHQoKTtcbiAgICAgICAgICAgIGUuc3RvcFByb3BhZ2F0aW9uKCk7XG4gICAgICAgICAgICBzdGFydE1hcmtkb3duRWRpdCh0ZCwgdGQuZGF0YXNldC5yYXcgfHwgdmFsLCBjb250ZXh0LCBob3N0LCBvbkNoYW5nZSk7XG4gICAgICAgICAgfSwgdHJ1ZSk7XG4gICAgICAgIH0pO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgZGlzcGxheVNwYW4udGV4dENvbnRlbnQgPSBcIlx1MjAxNFwiO1xuICAgICAgICBkaXNwbGF5U3Bhbi5jbGFzc0xpc3QuYWRkKFwiemliYXNlLXRleHQtZW1wdHlcIik7XG4gICAgICAgIHRkLmFkZEV2ZW50TGlzdGVuZXIoXCJjbGlja1wiLCAoZSkgPT4ge1xuICAgICAgICAgIGUucHJldmVudERlZmF1bHQoKTtcbiAgICAgICAgICBlLnN0b3BQcm9wYWdhdGlvbigpO1xuICAgICAgICAgIHN0YXJ0TWFya2Rvd25FZGl0KHRkLCB0ZC5kYXRhc2V0LnJhdyA/PyB2YWwsIGNvbnRleHQsIGhvc3QsIG9uQ2hhbmdlKTtcbiAgICAgICAgfSk7XG4gICAgICB9XG4gICAgICBicmVhaztcbiAgICB9XG4gIH1cbn1cbiIsICJjb25zdCBGT1JNVUxBX05VTUJFUl9SRSA9IC9eLT9cXGQrKFxcLlxcZCspPyQvO1xuXG5leHBvcnQgZnVuY3Rpb24gaXNCYWNrdGlja2VkKHJhdzogc3RyaW5nKTogYm9vbGVhbiB7XG4gIGNvbnN0IHRyaW1tZWQgPSByYXcudHJpbSgpO1xuICByZXR1cm4gdHJpbW1lZC5zdGFydHNXaXRoKFwiYFwiKSAmJiB0cmltbWVkLmVuZHNXaXRoKFwiYFwiKSAmJiB0cmltbWVkLmxlbmd0aCA+PSAyO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gc3RyaXBCYWNrdGlja3MocmF3OiBzdHJpbmcpOiBzdHJpbmcge1xuICBjb25zdCB0cmltbWVkID0gcmF3LnRyaW0oKTtcbiAgcmV0dXJuIHRyaW1tZWQuc2xpY2UoMSwgLTEpO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gaXNTaW1wbGVNYXRoKHJhdzogc3RyaW5nKTogYm9vbGVhbiB7XG4gIGNvbnN0IHRyaW1tZWQgPSByYXcudHJpbSgpO1xuICBpZiAoIXRyaW1tZWQpIHJldHVybiBmYWxzZTtcbiAgaWYgKEZPUk1VTEFfTlVNQkVSX1JFLnRlc3QodHJpbW1lZCkpIHJldHVybiBmYWxzZTtcbiAgaWYgKCEvXltcXGRcXHMrXFwtKi8lKCkuXSskLy50ZXN0KHRyaW1tZWQpKSByZXR1cm4gZmFsc2U7XG4gIGlmICghL1srXFwtKi8lXS8udGVzdCh0cmltbWVkKSkgcmV0dXJuIGZhbHNlO1xuICBpZiAoL15bKyovJV0vLnRlc3QodHJpbW1lZCkpIHJldHVybiBmYWxzZTtcbiAgcmV0dXJuIHRydWU7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBldmFsdWF0ZUZvcm11bGEoZXhwcmVzc2lvbjogc3RyaW5nLCByb3dEYXRhOiBSZWNvcmQ8c3RyaW5nLCBzdHJpbmc+KTogbnVtYmVyIHwgbnVsbCB7XG4gIGlmICghZXhwcmVzc2lvbiB8fCAhZXhwcmVzc2lvbi50cmltKCkpIHJldHVybiBudWxsO1xuXG4gIGxldCByZXNvbHZlZCA9IGV4cHJlc3Npb247XG4gIGNvbnN0IGNvbE5hbWVzID0gT2JqZWN0LmtleXMocm93RGF0YSkuc29ydCgoYSwgYikgPT4gYi5sZW5ndGggLSBhLmxlbmd0aCk7XG5cbiAgZm9yIChjb25zdCBjb2xOYW1lIG9mIGNvbE5hbWVzKSB7XG4gICAgY29uc3QgcmVnZXggPSBuZXcgUmVnRXhwKFwiXFxcXGJcIiArIGVzY2FwZVJlZ2V4KGNvbE5hbWUpICsgXCJcXFxcYlwiLCBcImdpXCIpO1xuICAgIGlmICghcmVnZXgudGVzdChyZXNvbHZlZCkpIGNvbnRpbnVlO1xuICAgIHJlZ2V4Lmxhc3RJbmRleCA9IDA7XG5cbiAgICBjb25zdCByYXdWYWwgPSByb3dEYXRhW2NvbE5hbWVdO1xuICAgIGNvbnN0IG51bVZhbCA9IHBhcnNlRmxvYXQocmF3VmFsKTtcbiAgICBpZiAoTnVtYmVyLmlzTmFOKG51bVZhbCkpIHJldHVybiBudWxsO1xuXG4gICAgcmVzb2x2ZWQgPSByZXNvbHZlZC5yZXBsYWNlKHJlZ2V4LCBudW1WYWwudG9TdHJpbmcoKSk7XG4gIH1cblxuICB0cnkge1xuICAgIHJldHVybiBzYWZlRXZhbChyZXNvbHZlZCk7XG4gIH0gY2F0Y2gge1xuICAgIHJldHVybiBudWxsO1xuICB9XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBldmFsdWF0ZVNpbXBsZU1hdGgoZXhwcmVzc2lvbjogc3RyaW5nKTogbnVtYmVyIHwgbnVsbCB7XG4gIHRyeSB7XG4gICAgcmV0dXJuIHNhZmVFdmFsKGV4cHJlc3Npb24pO1xuICB9IGNhdGNoIHtcbiAgICByZXR1cm4gbnVsbDtcbiAgfVxufVxuXG5leHBvcnQgZnVuY3Rpb24gZm9ybWF0UmVzdWx0KHZhbHVlOiBudW1iZXIgfCBudWxsIHwgdW5kZWZpbmVkKTogc3RyaW5nIHtcbiAgaWYgKHZhbHVlID09PSBudWxsIHx8IHZhbHVlID09PSB1bmRlZmluZWQgfHwgTnVtYmVyLmlzTmFOKHZhbHVlKSkgcmV0dXJuIFwiXHUyMDE0XCI7XG4gIGlmICghTnVtYmVyLmlzRmluaXRlKHZhbHVlKSkgcmV0dXJuIFwiXHUyMjFFXCI7XG4gIHJldHVybiBwYXJzZUZsb2F0KHZhbHVlLnRvRml4ZWQoNikpLnRvU3RyaW5nKCk7XG59XG5cbmludGVyZmFjZSBUb2tlbiB7XG4gIHR5cGU6IFwibnVtYmVyXCIgfCBcIm9wXCIgfCBcImxwYXJlblwiIHwgXCJycGFyZW5cIjtcbiAgdmFsdWU6IG51bWJlciB8IHN0cmluZztcbn1cblxuaW50ZXJmYWNlIFBhcnNlciB7XG4gIHRva2VuczogVG9rZW5bXTtcbiAgcG9zOiBudW1iZXI7XG59XG5cbmZ1bmN0aW9uIHNhZmVFdmFsKGV4cHJlc3Npb246IHN0cmluZyk6IG51bWJlciB7XG4gIGNvbnN0IHRva2VucyA9IHRva2VuaXplKGV4cHJlc3Npb24pO1xuICBjb25zdCBwYXJzZXI6IFBhcnNlciA9IHsgdG9rZW5zLCBwb3M6IDAgfTtcbiAgY29uc3QgcmVzdWx0ID0gcGFyc2VFeHByKHBhcnNlcik7XG4gIGlmIChwYXJzZXIucG9zIDwgcGFyc2VyLnRva2Vucy5sZW5ndGgpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoXCJVbmV4cGVjdGVkIHRva2VuOiBcIiArIFN0cmluZyhwYXJzZXIudG9rZW5zW3BhcnNlci5wb3NdLnZhbHVlKSk7XG4gIH1cbiAgcmV0dXJuIHJlc3VsdDtcbn1cblxuZnVuY3Rpb24gdG9rZW5pemUoZXhwcjogc3RyaW5nKTogVG9rZW5bXSB7XG4gIGNvbnN0IHRva2VuczogVG9rZW5bXSA9IFtdO1xuICBsZXQgaSA9IDA7XG4gIGNvbnN0IHMgPSBleHByLnRyaW0oKTtcblxuICB3aGlsZSAoaSA8IHMubGVuZ3RoKSB7XG4gICAgaWYgKHNbaV0gPT09IFwiIFwiIHx8IHNbaV0gPT09IFwiXFx0XCIpIHtcbiAgICAgIGkrKztcbiAgICAgIGNvbnRpbnVlO1xuICAgIH1cblxuICAgIGlmICgoc1tpXSA+PSBcIjBcIiAmJiBzW2ldIDw9IFwiOVwiKSB8fCAoc1tpXSA9PT0gXCIuXCIgJiYgaSArIDEgPCBzLmxlbmd0aCAmJiBzW2kgKyAxXSA+PSBcIjBcIiAmJiBzW2kgKyAxXSA8PSBcIjlcIikpIHtcbiAgICAgIGxldCBudW0gPSBcIlwiO1xuICAgICAgd2hpbGUgKGkgPCBzLmxlbmd0aCAmJiAoKHNbaV0gPj0gXCIwXCIgJiYgc1tpXSA8PSBcIjlcIikgfHwgc1tpXSA9PT0gXCIuXCIpKSB7XG4gICAgICAgIG51bSArPSBzW2ldO1xuICAgICAgICBpKys7XG4gICAgICB9XG4gICAgICB0b2tlbnMucHVzaCh7IHR5cGU6IFwibnVtYmVyXCIsIHZhbHVlOiBwYXJzZUZsb2F0KG51bSkgfSk7XG4gICAgICBjb250aW51ZTtcbiAgICB9XG5cbiAgICBpZiAoXCIrLSovJVwiLmluY2x1ZGVzKHNbaV0pKSB7XG4gICAgICB0b2tlbnMucHVzaCh7IHR5cGU6IFwib3BcIiwgdmFsdWU6IHNbaV0gfSk7XG4gICAgICBpKys7XG4gICAgICBjb250aW51ZTtcbiAgICB9XG5cbiAgICBpZiAoc1tpXSA9PT0gXCIoXCIpIHtcbiAgICAgIHRva2Vucy5wdXNoKHsgdHlwZTogXCJscGFyZW5cIiwgdmFsdWU6IFwiKFwiIH0pO1xuICAgICAgaSsrO1xuICAgICAgY29udGludWU7XG4gICAgfVxuICAgIGlmIChzW2ldID09PSBcIilcIikge1xuICAgICAgdG9rZW5zLnB1c2goeyB0eXBlOiBcInJwYXJlblwiLCB2YWx1ZTogXCIpXCIgfSk7XG4gICAgICBpKys7XG4gICAgICBjb250aW51ZTtcbiAgICB9XG5cbiAgICB0aHJvdyBuZXcgRXJyb3IoXCJVbmV4cGVjdGVkIGNoYXJhY3RlcjogXCIgKyBzW2ldKTtcbiAgfVxuXG4gIHJldHVybiB0b2tlbnM7XG59XG5cbmZ1bmN0aW9uIHBhcnNlRXhwcihwYXJzZXI6IFBhcnNlcik6IG51bWJlciB7XG4gIGxldCBsZWZ0ID0gcGFyc2VUZXJtKHBhcnNlcik7XG5cbiAgd2hpbGUgKHBhcnNlci5wb3MgPCBwYXJzZXIudG9rZW5zLmxlbmd0aCkge1xuICAgIGNvbnN0IHRvayA9IHBhcnNlci50b2tlbnNbcGFyc2VyLnBvc107XG4gICAgaWYgKHRvay50eXBlID09PSBcIm9wXCIgJiYgKHRvay52YWx1ZSA9PT0gXCIrXCIgfHwgdG9rLnZhbHVlID09PSBcIi1cIikpIHtcbiAgICAgIHBhcnNlci5wb3MrKztcbiAgICAgIGNvbnN0IHJpZ2h0ID0gcGFyc2VUZXJtKHBhcnNlcik7XG4gICAgICBsZWZ0ID0gdG9rLnZhbHVlID09PSBcIitcIiA/IGxlZnQgKyByaWdodCA6IGxlZnQgLSByaWdodDtcbiAgICB9IGVsc2Uge1xuICAgICAgYnJlYWs7XG4gICAgfVxuICB9XG5cbiAgcmV0dXJuIGxlZnQ7XG59XG5cbmZ1bmN0aW9uIHBhcnNlVGVybShwYXJzZXI6IFBhcnNlcik6IG51bWJlciB7XG4gIGxldCBsZWZ0ID0gcGFyc2VVbmFyeShwYXJzZXIpO1xuXG4gIHdoaWxlIChwYXJzZXIucG9zIDwgcGFyc2VyLnRva2Vucy5sZW5ndGgpIHtcbiAgICBjb25zdCB0b2sgPSBwYXJzZXIudG9rZW5zW3BhcnNlci5wb3NdO1xuICAgIGlmICh0b2sudHlwZSA9PT0gXCJvcFwiICYmICh0b2sudmFsdWUgPT09IFwiKlwiIHx8IHRvay52YWx1ZSA9PT0gXCIvXCIgfHwgdG9rLnZhbHVlID09PSBcIiVcIikpIHtcbiAgICAgIHBhcnNlci5wb3MrKztcbiAgICAgIGNvbnN0IHJpZ2h0ID0gcGFyc2VVbmFyeShwYXJzZXIpO1xuICAgICAgaWYgKHRvay52YWx1ZSA9PT0gXCIqXCIpIGxlZnQgPSBsZWZ0ICogcmlnaHQ7XG4gICAgICBlbHNlIGlmICh0b2sudmFsdWUgPT09IFwiL1wiKSBsZWZ0ID0gcmlnaHQgPT09IDAgPyBJbmZpbml0eSA6IGxlZnQgLyByaWdodDtcbiAgICAgIGVsc2UgbGVmdCA9IGxlZnQgJSByaWdodDtcbiAgICB9IGVsc2Uge1xuICAgICAgYnJlYWs7XG4gICAgfVxuICB9XG5cbiAgcmV0dXJuIGxlZnQ7XG59XG5cbmZ1bmN0aW9uIHBhcnNlVW5hcnkocGFyc2VyOiBQYXJzZXIpOiBudW1iZXIge1xuICBpZiAocGFyc2VyLnBvcyA8IHBhcnNlci50b2tlbnMubGVuZ3RoKSB7XG4gICAgY29uc3QgdG9rID0gcGFyc2VyLnRva2Vuc1twYXJzZXIucG9zXTtcbiAgICBpZiAodG9rLnR5cGUgPT09IFwib3BcIiAmJiB0b2sudmFsdWUgPT09IFwiLVwiKSB7XG4gICAgICBwYXJzZXIucG9zKys7XG4gICAgICByZXR1cm4gLXBhcnNlVW5hcnkocGFyc2VyKTtcbiAgICB9XG4gICAgaWYgKHRvay50eXBlID09PSBcIm9wXCIgJiYgdG9rLnZhbHVlID09PSBcIitcIikge1xuICAgICAgcGFyc2VyLnBvcysrO1xuICAgICAgcmV0dXJuIHBhcnNlVW5hcnkocGFyc2VyKTtcbiAgICB9XG4gIH1cbiAgcmV0dXJuIHBhcnNlUHJpbWFyeShwYXJzZXIpO1xufVxuXG5mdW5jdGlvbiBwYXJzZVByaW1hcnkocGFyc2VyOiBQYXJzZXIpOiBudW1iZXIge1xuICBpZiAocGFyc2VyLnBvcyA+PSBwYXJzZXIudG9rZW5zLmxlbmd0aCkge1xuICAgIHRocm93IG5ldyBFcnJvcihcIlVuZXhwZWN0ZWQgZW5kIG9mIGV4cHJlc3Npb25cIik7XG4gIH1cblxuICBjb25zdCB0b2sgPSBwYXJzZXIudG9rZW5zW3BhcnNlci5wb3NdO1xuXG4gIGlmICh0b2sudHlwZSA9PT0gXCJudW1iZXJcIikge1xuICAgIHBhcnNlci5wb3MrKztcbiAgICByZXR1cm4gdG9rLnZhbHVlIGFzIG51bWJlcjtcbiAgfVxuXG4gIGlmICh0b2sudHlwZSA9PT0gXCJscGFyZW5cIikge1xuICAgIHBhcnNlci5wb3MrKztcbiAgICBjb25zdCByZXN1bHQgPSBwYXJzZUV4cHIocGFyc2VyKTtcbiAgICBpZiAocGFyc2VyLnBvcyA+PSBwYXJzZXIudG9rZW5zLmxlbmd0aCB8fCBwYXJzZXIudG9rZW5zW3BhcnNlci5wb3NdLnR5cGUgIT09IFwicnBhcmVuXCIpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihcIk1pc3NpbmcgY2xvc2luZyBwYXJlbnRoZXNpc1wiKTtcbiAgICB9XG4gICAgcGFyc2VyLnBvcysrO1xuICAgIHJldHVybiByZXN1bHQ7XG4gIH1cblxuICB0aHJvdyBuZXcgRXJyb3IoXCJVbmV4cGVjdGVkIHRva2VuOiBcIiArIFN0cmluZyh0b2sudmFsdWUpKTtcbn1cblxuZnVuY3Rpb24gZXNjYXBlUmVnZXgoc3RyOiBzdHJpbmcpOiBzdHJpbmcge1xuICByZXR1cm4gc3RyLnJlcGxhY2UoL1suKis/XiR7fSgpfFtcXF1cXFxcXS9nLCBcIlxcXFwkJlwiKTtcbn1cbiIsICJleHBvcnQgY29uc3QgTEFCRUxfQ09MT1JTID0gW1xuICBcIiM0YWRlODBcIixcbiAgXCIjNjBhNWZhXCIsXG4gIFwiI2Y0NzJiNlwiLFxuICBcIiNmYjkyM2NcIixcbiAgXCIjYTc4YmZhXCIsXG4gIFwiIzM0ZDM5OVwiLFxuICBcIiNmYmJmMjRcIixcbiAgXCIjZjg3MTcxXCIsXG4gIFwiIzM4YmRmOFwiLFxuICBcIiNjMDg0ZmNcIixcbiAgXCIjODZlZmFjXCIsXG4gIFwiIzY3ZThmOVwiLFxuICBcIiNmZGJhNzRcIixcbiAgXCIjYTNlNjM1XCIsXG4gIFwiI2U4NzlmOVwiLFxuICBcIiMyMmQzZWVcIixcbiAgXCIjZmY2YjZiXCIsXG4gIFwiI2ZmZDkzZFwiLFxuICBcIiM2YmNiNzdcIixcbiAgXCIjNGQ5NmZmXCIsXG5dO1xuXG5leHBvcnQgZnVuY3Rpb24gaGFzaFN0cihzdHI6IHN0cmluZyk6IG51bWJlciB7XG4gIGxldCBoID0gNTM4MTtcbiAgZm9yIChsZXQgaSA9IDA7IGkgPCBzdHIubGVuZ3RoOyBpKyspIHtcbiAgICBoID0gKGggPDwgNSkgKyBoIF4gc3RyLmNoYXJDb2RlQXQoaSk7XG4gICAgaCA9IGggPj4+IDA7XG4gIH1cbiAgcmV0dXJuIGg7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBnZXRMYWJlbENvbG9yKHZhbHVlOiBzdHJpbmcpOiBzdHJpbmcge1xuICByZXR1cm4gTEFCRUxfQ09MT1JTW2hhc2hTdHIodmFsdWUudHJpbSgpLnRvTG93ZXJDYXNlKCkpICUgTEFCRUxfQ09MT1JTLmxlbmd0aF07XG59XG4iLCAiaW1wb3J0IHR5cGUgeyBDb2x1bW5UeXBlIH0gZnJvbSBcIi4vbW9kZWxcIjtcbmltcG9ydCB7IGdldExhYmVsQ29sb3IgfSBmcm9tIFwiLi9jb2xvcnNcIjtcblxuZXhwb3J0IHsgZ2V0TGFiZWxDb2xvciB9O1xuXG5leHBvcnQgZnVuY3Rpb24gZ2V0VHlwZUljb24odHlwZTogQ29sdW1uVHlwZSk6IHN0cmluZyB7XG4gIHN3aXRjaCAodHlwZS5raW5kKSB7XG4gICAgY2FzZSBcInRvZ2dsZVwiOlxuICAgICAgcmV0dXJuIFwiXHUyQjFDXCI7XG4gICAgY2FzZSBcInNlbGVjdFwiOlxuICAgICAgcmV0dXJuIFwiXHUyNUJFXCI7XG4gICAgY2FzZSBcIm11bHRpLXNlbGVjdFwiOlxuICAgICAgcmV0dXJuIFwiXHVEODNDXHVERkY3XHVGRTBGXCI7XG4gICAgY2FzZSBcImxhYmVsXCI6XG4gICAgICByZXR1cm4gXCJcdTJCMjFcIjtcbiAgICBjYXNlIFwibnVtYmVyXCI6XG4gICAgICByZXR1cm4gXCIjXCI7XG4gICAgY2FzZSBcImRhdGVcIjpcbiAgICAgIHJldHVybiBcIlx1RDgzRFx1RENDNVwiO1xuICAgIGNhc2UgXCJmb3JtdWxhXCI6XG4gICAgICByZXR1cm4gXCJcdTAxOTJcIjtcbiAgICBkZWZhdWx0OlxuICAgICAgcmV0dXJuIFwiVFwiO1xuICB9XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBzaG93VG9hc3QobWVzc2FnZTogc3RyaW5nKTogdm9pZCB7XG4gIGNvbnN0IHRvYXN0ID0gY3JlYXRlRGl2KCk7XG4gIHRvYXN0LmNsYXNzTmFtZSA9IFwiemliYXNlLXRvYXN0XCI7XG4gIHRvYXN0LnRleHRDb250ZW50ID0gbWVzc2FnZTtcbiAgZG9jdW1lbnQuYm9keS5hcHBlbmRDaGlsZCh0b2FzdCk7XG4gIHdpbmRvdy5zZXRUaW1lb3V0KCgpID0+IHRvYXN0LmNsYXNzTGlzdC5hZGQoXCJ6aWJhc2UtdG9hc3Qtc2hvd1wiKSwgMTApO1xuICB3aW5kb3cuc2V0VGltZW91dCgoKSA9PiB7XG4gICAgdG9hc3QuY2xhc3NMaXN0LnJlbW92ZShcInppYmFzZS10b2FzdC1zaG93XCIpO1xuICAgIHdpbmRvdy5zZXRUaW1lb3V0KCgpID0+IHRvYXN0LnJlbW92ZSgpLCAzMDApO1xuICB9LCAyNTAwKTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGF0dGFjaExpbmtUb29sdGlwKGE6IEhUTUxBbmNob3JFbGVtZW50KTogdm9pZCB7XG4gIGxldCB0b29sdGlwOiBIVE1MRWxlbWVudCB8IG51bGwgPSBudWxsO1xuICBhLmFkZEV2ZW50TGlzdGVuZXIoXCJtb3VzZWVudGVyXCIsICgpID0+IHtcbiAgICB0b29sdGlwID0gY3JlYXRlRGl2KCk7XG4gICAgdG9vbHRpcC5jbGFzc05hbWUgPSBcInppYmFzZS1saW5rLXRvb2x0aXBcIjtcbiAgICB0b29sdGlwLnRleHRDb250ZW50ID0gXCJBbHQrQ2xpY2sgdG8gZWRpdFwiO1xuICAgIGRvY3VtZW50LmJvZHkuYXBwZW5kQ2hpbGQodG9vbHRpcCk7XG4gICAgY29uc3QgcmVjdCA9IGEuZ2V0Qm91bmRpbmdDbGllbnRSZWN0KCk7XG4gICAgdG9vbHRpcC5zZXRDc3NTdHlsZXMoeyB0b3A6IGAke3JlY3QuYm90dG9tICsgd2luZG93LnNjcm9sbFkgKyA0fXB4YCB9KTtcbiAgICB0b29sdGlwLnNldENzc1N0eWxlcyh7IGxlZnQ6IGAke3JlY3QubGVmdCArIHdpbmRvdy5zY3JvbGxYfXB4YCB9KTtcbiAgfSk7XG4gIGEuYWRkRXZlbnRMaXN0ZW5lcihcIm1vdXNlbGVhdmVcIiwgKCkgPT4ge1xuICAgIHRvb2x0aXA/LnJlbW92ZSgpO1xuICAgIHRvb2x0aXAgPSBudWxsO1xuICB9KTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIHN0YXJ0TGFiZWxFZGl0KFxuICBjaGlwOiBIVE1MRWxlbWVudCxcbiAgY3VycmVudDogc3RyaW5nLFxuICBvbkNoYW5nZTogKHZhbHVlOiBzdHJpbmcpID0+IFByb21pc2U8dm9pZD4sXG4pOiB2b2lkIHtcbiAgY29uc3QgaW5wdXQgPSBjcmVhdGVFbChcImlucHV0XCIpO1xuICBpbnB1dC5jbGFzc05hbWUgPSBcInppYmFzZS1pbmxpbmUtaW5wdXRcIjtcbiAgaW5wdXQudmFsdWUgPSBjdXJyZW50O1xuICBjaGlwLnJlcGxhY2VXaXRoKGlucHV0KTtcbiAgaW5wdXQuZm9jdXMoKTtcbiAgaW5wdXQuc2VsZWN0KCk7XG4gIGNvbnN0IGNvbW1pdCA9IGFzeW5jICgpID0+IHtcbiAgICBjb25zdCBuZXdWYWwgPSBpbnB1dC52YWx1ZS50cmltKCkgfHwgY3VycmVudDtcbiAgICBhd2FpdCBvbkNoYW5nZShuZXdWYWwpO1xuICAgIGNoaXAudGV4dENvbnRlbnQgPSBuZXdWYWw7XG4gICAgY2hpcC5zdHlsZS5zZXRQcm9wZXJ0eShcIi0tbGNcIiwgZ2V0TGFiZWxDb2xvcihuZXdWYWwpKTtcbiAgICBpbnB1dC5yZXBsYWNlV2l0aChjaGlwKTtcbiAgfTtcbiAgaW5wdXQuYWRkRXZlbnRMaXN0ZW5lcihcImJsdXJcIiwgKCkgPT4geyB2b2lkIGNvbW1pdCgpOyB9KTtcbiAgaW5wdXQuYWRkRXZlbnRMaXN0ZW5lcihcImtleWRvd25cIiwgKGUpID0+IHtcbiAgICBpZiAoZS5rZXkgPT09IFwiRW50ZXJcIikgdm9pZCBjb21taXQoKTtcbiAgICBpZiAoZS5rZXkgPT09IFwiRXNjYXBlXCIpIGlucHV0LnJlcGxhY2VXaXRoKGNoaXApO1xuICB9KTtcbn1cbiIsICJpbXBvcnQgeyBNb2RhbCwgdHlwZSBBcHAgfSBmcm9tIFwib2JzaWRpYW5cIjtcbmltcG9ydCB0eXBlIHsgQ29sdW1uIH0gZnJvbSBcIi4vbW9kZWxcIjtcblxuZXhwb3J0IGNsYXNzIFNlbGVjdE9wdGlvbnNNb2RhbCBleHRlbmRzIE1vZGFsIHtcbiAgY29sTmFtZTogc3RyaW5nO1xuICBjdXJyZW50T3B0aW9uczogc3RyaW5nW107XG4gIG9uU3VibWl0OiAob3B0aW9uczogc3RyaW5nW10pID0+IHZvaWQ7XG5cbiAgY29uc3RydWN0b3IoYXBwOiBBcHAsIGNvbE5hbWU6IHN0cmluZywgY3VycmVudE9wdGlvbnM6IHN0cmluZ1tdLCBvblN1Ym1pdDogKG9wdGlvbnM6IHN0cmluZ1tdKSA9PiB2b2lkKSB7XG4gICAgc3VwZXIoYXBwKTtcbiAgICB0aGlzLmNvbE5hbWUgPSBjb2xOYW1lO1xuICAgIHRoaXMuY3VycmVudE9wdGlvbnMgPSBbLi4uY3VycmVudE9wdGlvbnNdO1xuICAgIHRoaXMub25TdWJtaXQgPSBvblN1Ym1pdDtcbiAgfVxuXG4gIG9uT3BlbigpOiB2b2lkIHtcbiAgICBjb25zdCB7IGNvbnRlbnRFbCB9ID0gdGhpcztcbiAgICBjb250ZW50RWwuZW1wdHkoKTtcbiAgICBjb250ZW50RWwuYWRkQ2xhc3MoXCJ6aWJhc2UtbW9kYWxcIik7XG4gICAgY29udGVudEVsLmNyZWF0ZUVsKFwiaDNcIiwgeyB0ZXh0OiBgT3B0aW9ucyBmb3IgXCIke3RoaXMuY29sTmFtZX1cImAsIGNsczogXCJ6aWJhc2UtbW9kYWwtdGl0bGVcIiB9KTtcbiAgICBjb25zdCBjaGlwc1dyYXAgPSBjb250ZW50RWwuY3JlYXRlRGl2KFwiemliYXNlLW1vZGFsLWNoaXBzXCIpO1xuICAgIGNvbnN0IHJlbmRlckNoaXBzID0gKCkgPT4ge1xuICAgICAgY2hpcHNXcmFwLmVtcHR5KCk7XG4gICAgICB0aGlzLmN1cnJlbnRPcHRpb25zLmZvckVhY2goKG9wdCwgaSkgPT4ge1xuICAgICAgICBjb25zdCBjaGlwID0gY2hpcHNXcmFwLmNyZWF0ZURpdihcInppYmFzZS1tb2RhbC1jaGlwXCIpO1xuICAgICAgICBjaGlwLmNyZWF0ZVNwYW4oeyB0ZXh0OiBvcHQgfSk7XG4gICAgICAgIGNvbnN0IHggPSBjaGlwLmNyZWF0ZVNwYW4oeyB0ZXh0OiBcIlx1MDBEN1wiLCBjbHM6IFwiemliYXNlLWNoaXAtcmVtb3ZlXCIgfSk7XG4gICAgICAgIHguYWRkRXZlbnRMaXN0ZW5lcihcImNsaWNrXCIsICgpID0+IHtcbiAgICAgICAgICB0aGlzLmN1cnJlbnRPcHRpb25zLnNwbGljZShpLCAxKTtcbiAgICAgICAgICByZW5kZXJDaGlwcygpO1xuICAgICAgICB9KTtcbiAgICAgIH0pO1xuICAgIH07XG4gICAgcmVuZGVyQ2hpcHMoKTtcbiAgICBjb25zdCBpbnB1dFJvdyA9IGNvbnRlbnRFbC5jcmVhdGVEaXYoXCJ6aWJhc2UtbW9kYWwtaW5wdXQtcm93XCIpO1xuICAgIGNvbnN0IGlucHV0ID0gaW5wdXRSb3cuY3JlYXRlRWwoXCJpbnB1dFwiLCB7IHR5cGU6IFwidGV4dFwiLCBjbHM6IFwiemliYXNlLW1vZGFsLWlucHV0XCIgfSk7XG4gICAgaW5wdXQucGxhY2Vob2xkZXIgPSBcIkFkZCBvcHRpb25cdTIwMjZcIjtcbiAgICBjb25zdCBhZGRCdG4gPSBpbnB1dFJvdy5jcmVhdGVFbChcImJ1dHRvblwiLCB7IHRleHQ6IFwiQWRkXCIsIGNsczogXCJ6aWJhc2UtbW9kYWwtYWRkLWJ0blwiIH0pO1xuICAgIGNvbnN0IGFkZE9wdGlvbiA9ICgpID0+IHtcbiAgICAgIGNvbnN0IHZhbCA9IGlucHV0LnZhbHVlLnRyaW0oKTtcbiAgICAgIGlmICh2YWwgJiYgIXRoaXMuY3VycmVudE9wdGlvbnMuaW5jbHVkZXModmFsKSkge1xuICAgICAgICB0aGlzLmN1cnJlbnRPcHRpb25zLnB1c2godmFsKTtcbiAgICAgICAgcmVuZGVyQ2hpcHMoKTtcbiAgICAgICAgaW5wdXQudmFsdWUgPSBcIlwiO1xuICAgICAgICBpbnB1dC5mb2N1cygpO1xuICAgICAgfVxuICAgIH07XG4gICAgYWRkQnRuLmFkZEV2ZW50TGlzdGVuZXIoXCJjbGlja1wiLCBhZGRPcHRpb24pO1xuICAgIGlucHV0LmFkZEV2ZW50TGlzdGVuZXIoXCJrZXlkb3duXCIsIChlKSA9PiB7XG4gICAgICBpZiAoZS5rZXkgPT09IFwiRW50ZXJcIikge1xuICAgICAgICBlLnByZXZlbnREZWZhdWx0KCk7XG4gICAgICAgIGFkZE9wdGlvbigpO1xuICAgICAgfVxuICAgICAgaWYgKGUua2V5ID09PSBcIkVzY2FwZVwiKSB0aGlzLmNsb3NlKCk7XG4gICAgfSk7XG4gICAgY29uc3QgYXBwbHlCdG4gPSBjb250ZW50RWwuY3JlYXRlRWwoXCJidXR0b25cIiwgeyB0ZXh0OiBcIkFwcGx5XCIsIGNsczogXCJ6aWJhc2UtbW9kYWwtYXBwbHktYnRuXCIgfSk7XG4gICAgYXBwbHlCdG4uYWRkRXZlbnRMaXN0ZW5lcihcImNsaWNrXCIsICgpID0+IHtcbiAgICAgIGlmICh0aGlzLmN1cnJlbnRPcHRpb25zLmxlbmd0aCA+IDApIHtcbiAgICAgICAgdGhpcy5vblN1Ym1pdCh0aGlzLmN1cnJlbnRPcHRpb25zKTtcbiAgICAgICAgdGhpcy5jbG9zZSgpO1xuICAgICAgfVxuICAgIH0pO1xuICAgIHdpbmRvdy5zZXRUaW1lb3V0KCgpID0+IGlucHV0LmZvY3VzKCksIDUwKTtcbiAgfVxuXG4gIG9uQ2xvc2UoKTogdm9pZCB7XG4gICAgdGhpcy5jb250ZW50RWwuZW1wdHkoKTtcbiAgfVxufVxuXG5leHBvcnQgY2xhc3MgRm9ybXVsYUlucHV0TW9kYWwgZXh0ZW5kcyBNb2RhbCB7XG4gIGNvbE5hbWU6IHN0cmluZztcbiAgY3VycmVudEV4cHI6IHN0cmluZztcbiAgY29sdW1uczogQ29sdW1uW107XG4gIG9uU3VibWl0OiAoZXhwcjogc3RyaW5nKSA9PiB2b2lkO1xuXG4gIGNvbnN0cnVjdG9yKFxuICAgIGFwcDogQXBwLFxuICAgIGNvbE5hbWU6IHN0cmluZyxcbiAgICBjdXJyZW50RXhwcjogc3RyaW5nLFxuICAgIGNvbHVtbnM6IENvbHVtbltdLFxuICAgIG9uU3VibWl0OiAoZXhwcjogc3RyaW5nKSA9PiB2b2lkLFxuICApIHtcbiAgICBzdXBlcihhcHApO1xuICAgIHRoaXMuY29sTmFtZSA9IGNvbE5hbWU7XG4gICAgdGhpcy5jdXJyZW50RXhwciA9IGN1cnJlbnRFeHByO1xuICAgIHRoaXMuY29sdW1ucyA9IGNvbHVtbnM7XG4gICAgdGhpcy5vblN1Ym1pdCA9IG9uU3VibWl0O1xuICB9XG5cbiAgb25PcGVuKCk6IHZvaWQge1xuICAgIGNvbnN0IHsgY29udGVudEVsIH0gPSB0aGlzO1xuICAgIGNvbnRlbnRFbC5lbXB0eSgpO1xuICAgIGNvbnRlbnRFbC5hZGRDbGFzcyhcInppYmFzZS1tb2RhbFwiKTtcbiAgICBjb250ZW50RWwuY3JlYXRlRWwoXCJoM1wiLCB7IHRleHQ6IGBGb3JtdWxhIGZvciBcIiR7dGhpcy5jb2xOYW1lfVwiYCwgY2xzOiBcInppYmFzZS1tb2RhbC10aXRsZVwiIH0pO1xuICAgIGNvbnRlbnRFbC5jcmVhdGVFbChcInBcIiwge1xuICAgICAgdGV4dDogXCJVc2UgY29sdW1uIG5hbWVzIHRvIHJlZmVyZW5jZSB2YWx1ZXMuIENhc2UtaW5zZW5zaXRpdmUuXCIsXG4gICAgICBjbHM6IFwiemliYXNlLXNldHRpbmdzLWRlc2NcIixcbiAgICB9KTtcblxuICAgIGxldCBpbnB1dDogSFRNTElucHV0RWxlbWVudDtcbiAgICBjb25zdCBjb2xMaXN0ID0gY29udGVudEVsLmNyZWF0ZURpdihcInppYmFzZS1mb3JtdWxhLWNvbHNcIik7XG4gICAgY29sTGlzdC5jcmVhdGVTcGFuKHsgdGV4dDogXCJBdmFpbGFibGU6IFwiLCBjbHM6IFwiemliYXNlLWZvcm11bGEtY29scy1sYWJlbFwiIH0pO1xuICAgIHRoaXMuY29sdW1ucy5mb3JFYWNoKChjb2wpID0+IHtcbiAgICAgIGlmIChjb2wubmFtZSA9PT0gdGhpcy5jb2xOYW1lKSByZXR1cm47XG4gICAgICBjb25zdCBjaGlwID0gY29sTGlzdC5jcmVhdGVTcGFuKHsgdGV4dDogY29sLm5hbWUsIGNsczogXCJ6aWJhc2UtZm9ybXVsYS1jb2wtY2hpcFwiIH0pO1xuICAgICAgY2hpcC5hZGRFdmVudExpc3RlbmVyKFwiY2xpY2tcIiwgKCkgPT4ge1xuICAgICAgICBpbnB1dC52YWx1ZSArPSBjb2wubmFtZTtcbiAgICAgICAgaW5wdXQuZm9jdXMoKTtcbiAgICAgIH0pO1xuICAgIH0pO1xuXG4gICAgaW5wdXQgPSBjb250ZW50RWwuY3JlYXRlRWwoXCJpbnB1dFwiLCB7IHR5cGU6IFwidGV4dFwiLCBjbHM6IFwiemliYXNlLW1vZGFsLWlucHV0IHppYmFzZS1tb2RhbC1mb3JtdWxhLWlucHV0XCIgfSk7XG4gICAgaW5wdXQudmFsdWUgPSB0aGlzLmN1cnJlbnRFeHByO1xuICAgIGlucHV0LnBsYWNlaG9sZGVyID0gXCJlLmcuLCBQcmljZSAqIFF0eVwiO1xuXG4gICAgY29uc3QgYXBwbHlCdG4gPSBjb250ZW50RWwuY3JlYXRlRWwoXCJidXR0b25cIiwgeyB0ZXh0OiBcIkFwcGx5XCIsIGNsczogXCJ6aWJhc2UtbW9kYWwtYXBwbHktYnRuXCIgfSk7XG4gICAgY29uc3QgYXBwbHkgPSAoKSA9PiB7XG4gICAgICBjb25zdCBleHByID0gaW5wdXQudmFsdWUudHJpbSgpO1xuICAgICAgaWYgKGV4cHIpIHtcbiAgICAgICAgdGhpcy5vblN1Ym1pdChleHByKTtcbiAgICAgICAgdGhpcy5jbG9zZSgpO1xuICAgICAgfVxuICAgIH07XG4gICAgYXBwbHlCdG4uYWRkRXZlbnRMaXN0ZW5lcihcImNsaWNrXCIsIGFwcGx5KTtcbiAgICBpbnB1dC5hZGRFdmVudExpc3RlbmVyKFwia2V5ZG93blwiLCAoZSkgPT4ge1xuICAgICAgaWYgKGUua2V5ID09PSBcIkVudGVyXCIpIHtcbiAgICAgICAgZS5wcmV2ZW50RGVmYXVsdCgpO1xuICAgICAgICBhcHBseSgpO1xuICAgICAgfVxuICAgICAgaWYgKGUua2V5ID09PSBcIkVzY2FwZVwiKSB0aGlzLmNsb3NlKCk7XG4gICAgfSk7XG5cbiAgICB3aW5kb3cuc2V0VGltZW91dCgoKSA9PiB7XG4gICAgICBpbnB1dC5mb2N1cygpO1xuICAgICAgaW5wdXQuc2VsZWN0KCk7XG4gICAgfSwgNTApO1xuICB9XG5cbiAgb25DbG9zZSgpOiB2b2lkIHtcbiAgICB0aGlzLmNvbnRlbnRFbC5lbXB0eSgpO1xuICB9XG59XG4iLCAiZXhwb3J0IHR5cGUgQ29sdW1uS2luZCA9XG4gIHwgXCJ0ZXh0XCJcbiAgfCBcInRvZ2dsZVwiXG4gIHwgXCJzZWxlY3RcIlxuICB8IFwibGFiZWxcIlxuICB8IFwibXVsdGktc2VsZWN0XCJcbiAgfCBcIm51bWJlclwiXG4gIHwgXCJkYXRlXCJcbiAgfCBcImZvcm11bGFcIjtcblxuZXhwb3J0IHR5cGUgQ29sdW1uVHlwZSA9XG4gIHwgeyBraW5kOiBcInRleHRcIiB9XG4gIHwgeyBraW5kOiBcInRvZ2dsZVwiIH1cbiAgfCB7IGtpbmQ6IFwic2VsZWN0XCI7IG9wdGlvbnM6IHN0cmluZ1tdIH1cbiAgfCB7IGtpbmQ6IFwibGFiZWxcIiB9XG4gIHwgeyBraW5kOiBcIm11bHRpLXNlbGVjdFwiIH1cbiAgfCB7IGtpbmQ6IFwibnVtYmVyXCIgfVxuICB8IHsga2luZDogXCJkYXRlXCIgfVxuICB8IHsga2luZDogXCJmb3JtdWxhXCI7IGV4cHJlc3Npb246IHN0cmluZyB9O1xuXG5leHBvcnQgaW50ZXJmYWNlIENvbHVtbiB7XG4gIG5hbWU6IHN0cmluZztcbiAgdHlwZTogQ29sdW1uVHlwZTtcbiAgaW5kZXg6IG51bWJlcjtcbn1cblxuZXhwb3J0IGludGVyZmFjZSBUYWJsZVNjaGVtYSB7XG4gIGNvbHVtbnM6IENvbHVtbltdO1xuICBzY2hlbWFSb3dJbmRleDogbnVtYmVyIHwgbnVsbDtcbiAgZGF0YVN0YXJ0SW5kZXg6IG51bWJlcjtcbiAgaW5mZXJyZWQ6IGJvb2xlYW47XG59XG5cbmV4cG9ydCB0eXBlIFZpZXdOYW1lID0gXCJ0YWJsZVwiIHwgXCJrYW5iYW5cIiB8IFwiZ2FsbGVyeVwiIHwgXCJjYWxlbmRhclwiO1xuXG5leHBvcnQgaW50ZXJmYWNlIENvbHVtblJ1bGUge1xuICBuYW1lOiBzdHJpbmc7XG4gIHR5cGU6IHN0cmluZztcbn1cblxuZXhwb3J0IGludGVyZmFjZSBaaUJhc2VTZXR0aW5ncyB7XG4gIHJlbmRlckluUmVhZGluZ1ZpZXc6IGJvb2xlYW47XG4gIGluZmVyU2NoZW1hOiBib29sZWFuO1xuICBjb2x1bW5SdWxlczogQ29sdW1uUnVsZVtdO1xufVxuXG5leHBvcnQgY29uc3QgQ09MVU1OX1RZUEVfT1BUSU9OUzogQ29sdW1uS2luZFtdID0gW1xuICBcInRleHRcIixcbiAgXCJ0b2dnbGVcIixcbiAgXCJzZWxlY3RcIixcbiAgXCJsYWJlbFwiLFxuICBcIm11bHRpLXNlbGVjdFwiLFxuICBcIm51bWJlclwiLFxuICBcImRhdGVcIixcbiAgXCJmb3JtdWxhXCIsXG5dO1xuIiwgImltcG9ydCB7IE1hcmtkb3duUmVuZGVyZXIsIFRGaWxlLCB0eXBlIE1hcmtkb3duUG9zdFByb2Nlc3NvckNvbnRleHQsIHR5cGUgTWFya2Rvd25TZWN0aW9uSW5mb3JtYXRpb24gfSBmcm9tIFwib2JzaWRpYW5cIjtcbmltcG9ydCB7IGZpbHRlckRhdGFSb3dzLCBzZXJpYWxpemVSb3csIHNwbGl0Um93IH0gZnJvbSBcIi4uL3NjaGVtYVwiO1xuaW1wb3J0IHR5cGUgeyBUYWJsZVNjaGVtYSwgWmlCYXNlSG9zdCB9IGZyb20gXCIuLi90eXBlc1wiO1xuaW1wb3J0IHsgZ2V0TGFiZWxDb2xvciB9IGZyb20gXCIuLi91aVwiO1xuXG5leHBvcnQgZnVuY3Rpb24gYnVpbGRDYWxlbmRhclZpZXcoXG4gIGhvc3Q6IFppQmFzZUhvc3QsXG4gIGJvZHk6IEhUTUxFbGVtZW50LFxuICBzY2hlbWE6IFRhYmxlU2NoZW1hLFxuICBnZXREYXRhUm93czogKCkgPT4gc3RyaW5nW10sXG4gIF9yYXdEYXRhTGluZXM6IHN0cmluZ1tdLFxuICBjb250ZXh0OiBNYXJrZG93blBvc3RQcm9jZXNzb3JDb250ZXh0LFxuICBzZWN0aW9uSW5mbzogTWFya2Rvd25TZWN0aW9uSW5mb3JtYXRpb24sXG4gIGZpbHRlclF1ZXJ5OiBzdHJpbmcsXG4pOiB2b2lkIHtcbiAgY29uc3QgZGF0ZUNvbCA9IHNjaGVtYS5jb2x1bW5zLmZpbmQoKGMpID0+IGMudHlwZS5raW5kID09PSBcImRhdGVcIik7XG4gIGlmICghZGF0ZUNvbCkge1xuICAgIGNvbnN0IG5vdGljZSA9IGJvZHkuY3JlYXRlRGl2KFwiemliYXNlLWNhbGVuZGFyIHppYmFzZS1jYWxlbmRhci1ub3RpY2VcIik7XG4gICAgbm90aWNlLnRleHRDb250ZW50ID0gXCJDYWxlbmRhciByZXF1aXJlcyBhIERhdGUgY29sdW1uLlwiO1xuICAgIHJldHVybjtcbiAgfVxuXG4gIGNvbnN0IGNhbGVuZGFyID0gYm9keS5jcmVhdGVEaXYoXCJ6aWJhc2UtY2FsZW5kYXJcIik7XG4gIGNvbnN0IG5vdyA9IG5ldyBEYXRlKCk7XG4gIGxldCBjdXJyZW50TW9udGggPSBub3cuZ2V0TW9udGgoKTtcbiAgbGV0IGN1cnJlbnRZZWFyID0gbm93LmdldEZ1bGxZZWFyKCk7XG5cbiAgY29uc3QgcmVuZGVyQ2FsZW5kYXIgPSAoKSA9PiB7XG4gICAgY2FsZW5kYXIuZW1wdHkoKTtcblxuICAgIGNvbnN0IG5hdiA9IGNhbGVuZGFyLmNyZWF0ZURpdihcInppYmFzZS1jYWxlbmRhci1uYXZcIik7XG4gICAgY29uc3QgcHJldkJ0biA9IG5hdi5jcmVhdGVFbChcImJ1dHRvblwiLCB7IHRleHQ6IFwiXHUyNUMwXCIsIGNsczogXCJ6aWJhc2UtY2FsZW5kYXItbmF2LWJ0blwiIH0pO1xuICAgIGNvbnN0IG1vbnRoTGFiZWwgPSBuYXYuY3JlYXRlU3Bhbih7IGNsczogXCJ6aWJhc2UtY2FsZW5kYXItbW9udGgtbGFiZWxcIiB9KTtcbiAgICBtb250aExhYmVsLnRleHRDb250ZW50ID0gbmV3IERhdGUoY3VycmVudFllYXIsIGN1cnJlbnRNb250aCkudG9Mb2NhbGVTdHJpbmcoXCJkZWZhdWx0XCIsIHtcbiAgICAgIG1vbnRoOiBcImxvbmdcIixcbiAgICAgIHllYXI6IFwibnVtZXJpY1wiLFxuICAgIH0pO1xuICAgIGNvbnN0IG5leHRCdG4gPSBuYXYuY3JlYXRlRWwoXCJidXR0b25cIiwgeyB0ZXh0OiBcIlx1MjVCNlwiLCBjbHM6IFwiemliYXNlLWNhbGVuZGFyLW5hdi1idG5cIiB9KTtcblxuICAgIHByZXZCdG4uYWRkRXZlbnRMaXN0ZW5lcihcImNsaWNrXCIsICgpID0+IHtcbiAgICAgIGN1cnJlbnRNb250aC0tO1xuICAgICAgaWYgKGN1cnJlbnRNb250aCA8IDApIHtcbiAgICAgICAgY3VycmVudE1vbnRoID0gMTE7XG4gICAgICAgIGN1cnJlbnRZZWFyLS07XG4gICAgICB9XG4gICAgICByZW5kZXJDYWxlbmRhcigpO1xuICAgIH0pO1xuICAgIG5leHRCdG4uYWRkRXZlbnRMaXN0ZW5lcihcImNsaWNrXCIsICgpID0+IHtcbiAgICAgIGN1cnJlbnRNb250aCsrO1xuICAgICAgaWYgKGN1cnJlbnRNb250aCA+IDExKSB7XG4gICAgICAgIGN1cnJlbnRNb250aCA9IDA7XG4gICAgICAgIGN1cnJlbnRZZWFyKys7XG4gICAgICB9XG4gICAgICByZW5kZXJDYWxlbmRhcigpO1xuICAgIH0pO1xuXG4gICAgY29uc3QgZGF5SGVhZGVycyA9IGNhbGVuZGFyLmNyZWF0ZURpdihcInppYmFzZS1jYWxlbmRhci1kYXktaGVhZGVyc1wiKTtcbiAgICBbXCJNb25cIiwgXCJUdWVcIiwgXCJXZWRcIiwgXCJUaHVcIiwgXCJGcmlcIiwgXCJTYXRcIiwgXCJTdW5cIl0uZm9yRWFjaCgoZCkgPT4ge1xuICAgICAgZGF5SGVhZGVycy5jcmVhdGVTcGFuKHsgdGV4dDogZCwgY2xzOiBcInppYmFzZS1jYWxlbmRhci1kYXktaGVhZGVyXCIgfSk7XG4gICAgfSk7XG5cbiAgICBjb25zdCBncmlkID0gY2FsZW5kYXIuY3JlYXRlRGl2KFwiemliYXNlLWNhbGVuZGFyLWdyaWRcIik7XG4gICAgY29uc3QgZmlyc3REYXkgPSBuZXcgRGF0ZShjdXJyZW50WWVhciwgY3VycmVudE1vbnRoLCAxKTtcbiAgICBjb25zdCBsYXN0RGF5ID0gbmV3IERhdGUoY3VycmVudFllYXIsIGN1cnJlbnRNb250aCArIDEsIDApO1xuICAgIGNvbnN0IHRvdGFsRGF5cyA9IGxhc3REYXkuZ2V0RGF0ZSgpO1xuXG4gICAgbGV0IHN0YXJ0RG93ID0gZmlyc3REYXkuZ2V0RGF5KCkgLSAxO1xuICAgIGlmIChzdGFydERvdyA8IDApIHN0YXJ0RG93ID0gNjtcblxuICAgIGNvbnN0IGRhdGFSb3dzID0gZmlsdGVyRGF0YVJvd3MoZ2V0RGF0YVJvd3MoKSwgZmlsdGVyUXVlcnkpO1xuICAgIGNvbnN0IGRhdGVNYXAgPSBuZXcgTWFwPHN0cmluZywgeyB0aXRsZTogc3RyaW5nOyBsYWJlbDogc3RyaW5nIHwgbnVsbDsgbGluZTogc3RyaW5nIH1bXT4oKTtcbiAgICBkYXRhUm93cy5mb3JFYWNoKChsaW5lKSA9PiB7XG4gICAgICBjb25zdCBjZWxscyA9IHNwbGl0Um93KGxpbmUpO1xuICAgICAgY29uc3QgZGF0ZVN0ciA9IChjZWxsc1tkYXRlQ29sLmluZGV4XSB8fCBcIlwiKS50cmltKCk7XG4gICAgICBpZiAoIWRhdGVTdHIpIHJldHVybjtcbiAgICAgIGlmICghZGF0ZU1hcC5oYXMoZGF0ZVN0cikpIGRhdGVNYXAuc2V0KGRhdGVTdHIsIFtdKTtcbiAgICAgIGNvbnN0IHRpdGxlQ29sID0gc2NoZW1hLmNvbHVtbnMuZmluZCgoYykgPT4gYy50eXBlLmtpbmQgPT09IFwidGV4dFwiKTtcbiAgICAgIGNvbnN0IHRpdGxlID0gdGl0bGVDb2wgPyAoY2VsbHNbdGl0bGVDb2wuaW5kZXhdIHx8IFwiXCIpLnRyaW0oKSA6IChjZWxsc1swXSB8fCBcIlwiKS50cmltKCk7XG4gICAgICBjb25zdCBsYWJlbENvbCA9IHNjaGVtYS5jb2x1bW5zLmZpbmQoKGMpID0+IGMudHlwZS5raW5kID09PSBcImxhYmVsXCIgfHwgYy50eXBlLmtpbmQgPT09IFwic2VsZWN0XCIpO1xuICAgICAgY29uc3QgbGFiZWwgPSBsYWJlbENvbCA/IChjZWxsc1tsYWJlbENvbC5pbmRleF0gfHwgXCJcIikudHJpbSgpIDogbnVsbDtcbiAgICAgIGRhdGVNYXAuZ2V0KGRhdGVTdHIpIS5wdXNoKHsgdGl0bGUsIGxhYmVsLCBsaW5lIH0pO1xuICAgIH0pO1xuXG4gICAgY29uc3QgdG9kYXkgPSBuZXcgRGF0ZSgpO1xuICAgIGNvbnN0IHRvZGF5U3RyID0gYCR7dG9kYXkuZ2V0RnVsbFllYXIoKX0tJHtTdHJpbmcodG9kYXkuZ2V0TW9udGgoKSArIDEpLnBhZFN0YXJ0KDIsIFwiMFwiKX0tJHtTdHJpbmcodG9kYXkuZ2V0RGF0ZSgpKS5wYWRTdGFydCgyLCBcIjBcIil9YDtcblxuICAgIGZvciAobGV0IGkgPSAwOyBpIDwgc3RhcnREb3c7IGkrKykge1xuICAgICAgZ3JpZC5jcmVhdGVEaXYoXCJ6aWJhc2UtY2FsZW5kYXItY2VsbCB6aWJhc2UtY2FsZW5kYXItY2VsbC1lbXB0eVwiKTtcbiAgICB9XG5cbiAgICBmb3IgKGxldCBkID0gMTsgZCA8PSB0b3RhbERheXM7IGQrKykge1xuICAgICAgY29uc3QgZGF0ZVN0ciA9IGAke2N1cnJlbnRZZWFyfS0ke1N0cmluZyhjdXJyZW50TW9udGggKyAxKS5wYWRTdGFydCgyLCBcIjBcIil9LSR7U3RyaW5nKGQpLnBhZFN0YXJ0KDIsIFwiMFwiKX1gO1xuICAgICAgY29uc3QgY2VsbCA9IGdyaWQuY3JlYXRlRGl2KFwiemliYXNlLWNhbGVuZGFyLWNlbGxcIik7XG4gICAgICBpZiAoZGF0ZVN0ciA9PT0gdG9kYXlTdHIpIGNlbGwuY2xhc3NMaXN0LmFkZChcInppYmFzZS1jYWxlbmRhci10b2RheVwiKTtcblxuICAgICAgY2VsbC5jcmVhdGVTcGFuKHsgdGV4dDogU3RyaW5nKGQpLCBjbHM6IFwiemliYXNlLWNhbGVuZGFyLWRheS1udW1cIiB9KTtcblxuICAgICAgY29uc3QgZW50cmllcyA9IGRhdGVNYXAuZ2V0KGRhdGVTdHIpIHx8IFtdO1xuICAgICAgZW50cmllcy5mb3JFYWNoKChlbnRyeSkgPT4ge1xuICAgICAgICBjb25zdCBwaWxsID0gY2VsbC5jcmVhdGVEaXYoXCJ6aWJhc2UtY2FsZW5kYXItZW50cnlcIik7XG4gICAgICAgIHZvaWQgTWFya2Rvd25SZW5kZXJlci5yZW5kZXJNYXJrZG93bihlbnRyeS50aXRsZSB8fCBcIlx1MjAxNFwiLCBwaWxsLCBjb250ZXh0LnNvdXJjZVBhdGgsIGhvc3QucGx1Z2luKTtcbiAgICAgICAgaWYgKGVudHJ5LmxhYmVsKSB7XG4gICAgICAgICAgcGlsbC5zdHlsZS5zZXRQcm9wZXJ0eShcIi0tbGNcIiwgZ2V0TGFiZWxDb2xvcihlbnRyeS5sYWJlbCkpO1xuICAgICAgICAgIHBpbGwuY2xhc3NMaXN0LmFkZChcInppYmFzZS1jYWxlbmRhci1lbnRyeS1jb2xvcmVkXCIpO1xuICAgICAgICB9XG4gICAgICB9KTtcblxuICAgICAgaWYgKGVudHJpZXMubGVuZ3RoID09PSAwKSB7XG4gICAgICAgIGNlbGwuYWRkRXZlbnRMaXN0ZW5lcihcImNsaWNrXCIsIGFzeW5jICgpID0+IHtcbiAgICAgICAgICBjb25zdCBmaWxlID0gaG9zdC5hcHAudmF1bHQuZ2V0QWJzdHJhY3RGaWxlQnlQYXRoKGNvbnRleHQuc291cmNlUGF0aCk7XG4gICAgICAgICAgaWYgKCEoZmlsZSBpbnN0YW5jZW9mIFRGaWxlKSkgcmV0dXJuO1xuICAgICAgICAgIGF3YWl0IGhvc3QuYXBwLnZhdWx0LnByb2Nlc3MoZmlsZSwgKGNvbnRlbnQpID0+IHtcbiAgICAgICAgICAgIGNvbnN0IGFsbExpbmVzID0gY29udGVudC5zcGxpdChcIlxcblwiKTtcbiAgICAgICAgICAgIGNvbnN0IG5ld0NlbGxzID0gc2NoZW1hLmNvbHVtbnMubWFwKChjb2wpID0+IHtcbiAgICAgICAgICAgICAgaWYgKGNvbC5pbmRleCA9PT0gZGF0ZUNvbC5pbmRleCkgcmV0dXJuIGAgJHtkYXRlU3RyfSBgO1xuICAgICAgICAgICAgICByZXR1cm4gXCIgICBcIjtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgYWxsTGluZXMuc3BsaWNlKHNlY3Rpb25JbmZvLmxpbmVFbmQgKyAxLCAwLCBzZXJpYWxpemVSb3cobmV3Q2VsbHMpKTtcbiAgICAgICAgICAgIHJldHVybiBhbGxMaW5lcy5qb2luKFwiXFxuXCIpO1xuICAgICAgICAgIH0pO1xuICAgICAgICB9KTtcbiAgICAgICAgY2VsbC5jbGFzc0xpc3QuYWRkKFwiemliYXNlLWNhbGVuZGFyLWNlbGwtY2xpY2thYmxlXCIpO1xuICAgICAgfVxuICAgIH1cbiAgfTtcblxuICByZW5kZXJDYWxlbmRhcigpO1xufVxuIiwgImltcG9ydCB7IE1hcmtkb3duUmVuZGVyZXIsIHR5cGUgTWFya2Rvd25Qb3N0UHJvY2Vzc29yQ29udGV4dCwgdHlwZSBNYXJrZG93blNlY3Rpb25JbmZvcm1hdGlvbiB9IGZyb20gXCJvYnNpZGlhblwiO1xuaW1wb3J0IHsgZmlsdGVyRGF0YVJvd3MsIHBhcnNlQm9vbCwgc3BsaXRSb3cgfSBmcm9tIFwiLi4vc2NoZW1hXCI7XG5pbXBvcnQgdHlwZSB7IFRhYmxlU2NoZW1hLCBaaUJhc2VIb3N0IH0gZnJvbSBcIi4uL3R5cGVzXCI7XG5pbXBvcnQgeyBnZXRMYWJlbENvbG9yIH0gZnJvbSBcIi4uL3VpXCI7XG5cbmV4cG9ydCBmdW5jdGlvbiBidWlsZEdhbGxlcnlWaWV3KFxuICBob3N0OiBaaUJhc2VIb3N0LFxuICBib2R5OiBIVE1MRWxlbWVudCxcbiAgc2NoZW1hOiBUYWJsZVNjaGVtYSxcbiAgZ2V0RGF0YVJvd3M6ICgpID0+IHN0cmluZ1tdLFxuICBfcmF3RGF0YUxpbmVzOiBzdHJpbmdbXSxcbiAgY29udGV4dDogTWFya2Rvd25Qb3N0UHJvY2Vzc29yQ29udGV4dCxcbiAgX3NlY3Rpb25JbmZvOiBNYXJrZG93blNlY3Rpb25JbmZvcm1hdGlvbixcbiAgZmlsdGVyUXVlcnk6IHN0cmluZyxcbik6IHZvaWQge1xuICBjb25zdCBnYWxsZXJ5ID0gYm9keS5jcmVhdGVEaXYoXCJ6aWJhc2UtZ2FsbGVyeVwiKTtcbiAgY29uc3QgZGF0YVJvd3MgPSBmaWx0ZXJEYXRhUm93cyhnZXREYXRhUm93cygpLCBmaWx0ZXJRdWVyeSk7XG5cbiAgaWYgKGRhdGFSb3dzLmxlbmd0aCA9PT0gMCkge1xuICAgIGNvbnN0IGVtcHR5ID0gZ2FsbGVyeS5jcmVhdGVEaXYoXCJ6aWJhc2UtZW1wdHlcIik7XG4gICAgZW1wdHkudGV4dENvbnRlbnQgPSBmaWx0ZXJRdWVyeSA/IFwiTm8gbWF0Y2hpbmcgcm93c1wiIDogXCJObyBkYXRhXCI7XG4gICAgcmV0dXJuO1xuICB9XG5cbiAgY29uc3QgZ3JpZCA9IGdhbGxlcnkuY3JlYXRlRGl2KFwiemliYXNlLWdhbGxlcnktZ3JpZFwiKTtcblxuICBkYXRhUm93cy5mb3JFYWNoKChsaW5lKSA9PiB7XG4gICAgY29uc3QgY2VsbHMgPSBzcGxpdFJvdyhsaW5lKTtcbiAgICBjb25zdCBjYXJkID0gZ3JpZC5jcmVhdGVEaXYoXCJ6aWJhc2UtZ2FsbGVyeS1jYXJkXCIpO1xuXG4gICAgY29uc3QgdGl0bGVDb2wgPSBzY2hlbWEuY29sdW1ucy5maW5kKChjKSA9PiBjLnR5cGUua2luZCA9PT0gXCJ0ZXh0XCIpO1xuICAgIGNvbnN0IHRpdGxlVmFsdWUgPSB0aXRsZUNvbCA/IChjZWxsc1t0aXRsZUNvbC5pbmRleF0gfHwgXCJcIikudHJpbSgpIDogKGNlbGxzWzBdIHx8IFwiXCIpLnRyaW0oKTtcbiAgICBjb25zdCB0aXRsZURpdiA9IGNhcmQuY3JlYXRlRGl2KHsgY2xzOiBcInppYmFzZS1nYWxsZXJ5LWNhcmQtdGl0bGVcIiB9KTtcbiAgICB2b2lkIE1hcmtkb3duUmVuZGVyZXIucmVuZGVyTWFya2Rvd24odGl0bGVWYWx1ZSB8fCBcIlx1MjAxNFwiLCB0aXRsZURpdiwgY29udGV4dC5zb3VyY2VQYXRoLCBob3N0LnBsdWdpbik7XG5cbiAgICBjb25zdCBmaWVsZHNXcmFwID0gY2FyZC5jcmVhdGVEaXYoXCJ6aWJhc2UtZ2FsbGVyeS1jYXJkLWZpZWxkc1wiKTtcbiAgICBzY2hlbWEuY29sdW1ucy5mb3JFYWNoKChjb2wsIGNvbElkeCkgPT4ge1xuICAgICAgaWYgKHRpdGxlQ29sICYmIGNvbElkeCA9PT0gdGl0bGVDb2wuaW5kZXgpIHJldHVybjtcbiAgICAgIGNvbnN0IHJhd1ZhbHVlID0gKGNlbGxzW2NvbElkeF0gPz8gXCJcIikudHJpbSgpO1xuICAgICAgaWYgKCFyYXdWYWx1ZSAmJiBjb2wudHlwZS5raW5kICE9PSBcInRvZ2dsZVwiKSByZXR1cm47XG5cbiAgICAgIGNvbnN0IGZpZWxkID0gZmllbGRzV3JhcC5jcmVhdGVEaXYoXCJ6aWJhc2UtZ2FsbGVyeS1maWVsZFwiKTtcblxuICAgICAgaWYgKGNvbC50eXBlLmtpbmQgPT09IFwidG9nZ2xlXCIpIHtcbiAgICAgICAgZmllbGQuY3JlYXRlU3Bhbih7IHRleHQ6IHBhcnNlQm9vbChyYXdWYWx1ZSkgPyBcIlx1MjcwNVwiIDogXCJcdTJCMUNcIiB9KTtcbiAgICAgICAgZmllbGQuY3JlYXRlU3Bhbih7IHRleHQ6IFwiIFwiICsgY29sLm5hbWUsIGNsczogXCJ6aWJhc2UtZ2FsbGVyeS1maWVsZC1uYW1lXCIgfSk7XG4gICAgICB9IGVsc2UgaWYgKGNvbC50eXBlLmtpbmQgPT09IFwibGFiZWxcIikge1xuICAgICAgICBjb25zdCBjaGlwID0gZmllbGQuY3JlYXRlU3Bhbih7IHRleHQ6IHJhd1ZhbHVlLCBjbHM6IFwiemliYXNlLWxhYmVsXCIgfSk7XG4gICAgICAgIGNoaXAuc3R5bGUuc2V0UHJvcGVydHkoXCItLWxjXCIsIGdldExhYmVsQ29sb3IocmF3VmFsdWUpKTtcbiAgICAgIH0gZWxzZSBpZiAoY29sLnR5cGUua2luZCA9PT0gXCJzZWxlY3RcIikge1xuICAgICAgICBmaWVsZC5jcmVhdGVTcGFuKHsgdGV4dDogcmF3VmFsdWUsIGNsczogXCJ6aWJhc2UtZ2FsbGVyeS1maWVsZC1zZWxlY3RcIiB9KTtcbiAgICAgIH0gZWxzZSBpZiAoY29sLnR5cGUua2luZCA9PT0gXCJkYXRlXCIpIHtcbiAgICAgICAgZmllbGQuY3JlYXRlU3Bhbih7IHRleHQ6IFwiXHVEODNEXHVEQ0M1IFwiLCBjbHM6IFwiemliYXNlLWdhbGxlcnktZmllbGQtaWNvblwiIH0pO1xuICAgICAgICBmaWVsZC5jcmVhdGVTcGFuKHsgdGV4dDogcmF3VmFsdWUsIGNsczogXCJ6aWJhc2UtZGF0ZS1yZW5kZXJlZFwiIH0pO1xuICAgICAgfSBlbHNlIGlmIChjb2wudHlwZS5raW5kID09PSBcIm51bWJlclwiIHx8IGNvbC50eXBlLmtpbmQgPT09IFwiZm9ybXVsYVwiKSB7XG4gICAgICAgIGZpZWxkLmNyZWF0ZVNwYW4oeyB0ZXh0OiBjb2wubmFtZSArIFwiOiBcIiwgY2xzOiBcInppYmFzZS1nYWxsZXJ5LWZpZWxkLW5hbWVcIiB9KTtcbiAgICAgICAgZmllbGQuY3JlYXRlU3Bhbih7IHRleHQ6IHJhd1ZhbHVlLCBjbHM6IFwiemliYXNlLWdhbGxlcnktZmllbGQtdmFsdWVcIiB9KTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGZpZWxkLmNyZWF0ZVNwYW4oeyB0ZXh0OiByYXdWYWx1ZSwgY2xzOiBcInppYmFzZS1nYWxsZXJ5LWZpZWxkLXZhbHVlXCIgfSk7XG4gICAgICB9XG4gICAgfSk7XG4gIH0pO1xufVxuIiwgImltcG9ydCB7IE1hcmtkb3duUmVuZGVyZXIsIHR5cGUgTWFya2Rvd25Qb3N0UHJvY2Vzc29yQ29udGV4dCwgdHlwZSBNYXJrZG93blNlY3Rpb25JbmZvcm1hdGlvbiB9IGZyb20gXCJvYnNpZGlhblwiO1xuaW1wb3J0IHsgZmlsdGVyRGF0YVJvd3MsIHBhcnNlQm9vbCwgcGFyc2VNdWx0aVNlbGVjdCwgc3BsaXRSb3cgfSBmcm9tIFwiLi4vc2NoZW1hXCI7XG5pbXBvcnQgdHlwZSB7IFRhYmxlU2NoZW1hLCBaaUJhc2VIb3N0IH0gZnJvbSBcIi4uL3R5cGVzXCI7XG5pbXBvcnQgeyBnZXRMYWJlbENvbG9yIH0gZnJvbSBcIi4uL3VpXCI7XG5cbmV4cG9ydCBmdW5jdGlvbiBidWlsZEthbmJhblZpZXcoXG4gIGhvc3Q6IFppQmFzZUhvc3QsXG4gIGJvZHk6IEhUTUxFbGVtZW50LFxuICBzY2hlbWE6IFRhYmxlU2NoZW1hLFxuICBnZXREYXRhUm93czogKCkgPT4gc3RyaW5nW10sXG4gIHJhd0RhdGFMaW5lczogc3RyaW5nW10sXG4gIGNvbnRleHQ6IE1hcmtkb3duUG9zdFByb2Nlc3NvckNvbnRleHQsXG4gIHNlY3Rpb25JbmZvOiBNYXJrZG93blNlY3Rpb25JbmZvcm1hdGlvbixcbiAgZmlsdGVyUXVlcnk6IHN0cmluZyxcbik6IHZvaWQge1xuICBjb25zdCBncm91cENvbCA9IHNjaGVtYS5jb2x1bW5zLmZpbmQoXG4gICAgKGMpID0+IGMudHlwZS5raW5kID09PSBcInNlbGVjdFwiIHx8IGMudHlwZS5raW5kID09PSBcImxhYmVsXCIgfHwgYy50eXBlLmtpbmQgPT09IFwibXVsdGktc2VsZWN0XCIsXG4gICk7XG4gIGlmICghZ3JvdXBDb2wpIHtcbiAgICBjb25zdCBub3RpY2UgPSBib2R5LmNyZWF0ZURpdihcInppYmFzZS1rYW5iYW4gemliYXNlLWthbmJhbi1ub3RpY2VcIik7XG4gICAgbm90aWNlLnRleHRDb250ZW50ID0gXCJLYW5iYW4gcmVxdWlyZXMgYSBTZWxlY3Qgb3IgTGFiZWwgY29sdW1uIHRvIGdyb3VwIGJ5LlwiO1xuICAgIHJldHVybjtcbiAgfVxuXG4gIGNvbnN0IGthbmJhbiA9IGJvZHkuY3JlYXRlRGl2KFwiemliYXNlLWthbmJhblwiKTtcbiAgY29uc3QgZGF0YVJvd3MgPSBmaWx0ZXJEYXRhUm93cyhnZXREYXRhUm93cygpLCBmaWx0ZXJRdWVyeSk7XG5cbiAgY29uc3QgZ3JvdXBzID0gbmV3IE1hcDxzdHJpbmcsIHsgbGluZTogc3RyaW5nOyBjZWxsczogc3RyaW5nW10gfVtdPigpO1xuICBkYXRhUm93cy5mb3JFYWNoKChsaW5lKSA9PiB7XG4gICAgY29uc3QgY2VsbHMgPSBzcGxpdFJvdyhsaW5lKTtcbiAgICBjb25zdCByYXdHcm91cFZhbHVlID0gKGNlbGxzW2dyb3VwQ29sLmluZGV4XSA/PyBcIlwiKS50cmltKCkgfHwgXCJcdTIwMTRcIjtcbiAgICBsZXQgZ3JvdXBWYWx1ZXMgPSBbcmF3R3JvdXBWYWx1ZV07XG4gICAgaWYgKGdyb3VwQ29sLnR5cGUua2luZCA9PT0gXCJtdWx0aS1zZWxlY3RcIiAmJiByYXdHcm91cFZhbHVlICE9PSBcIlx1MjAxNFwiKSB7XG4gICAgICBncm91cFZhbHVlcyA9IHBhcnNlTXVsdGlTZWxlY3QocmF3R3JvdXBWYWx1ZSk7XG4gICAgICBpZiAoZ3JvdXBWYWx1ZXMubGVuZ3RoID09PSAwKSBncm91cFZhbHVlcyA9IFtcIlx1MjAxNFwiXTtcbiAgICB9XG4gICAgZ3JvdXBWYWx1ZXMuZm9yRWFjaCgoZ3YpID0+IHtcbiAgICAgIGlmICghZ3JvdXBzLmhhcyhndikpIGdyb3Vwcy5zZXQoZ3YsIFtdKTtcbiAgICAgIGdyb3Vwcy5nZXQoZ3YpIS5wdXNoKHsgbGluZSwgY2VsbHMgfSk7XG4gICAgfSk7XG4gIH0pO1xuXG4gIGxldCBncm91cEtleXM6IHN0cmluZ1tdO1xuICBpZiAoZ3JvdXBDb2wudHlwZS5raW5kID09PSBcInNlbGVjdFwiICYmIGdyb3VwQ29sLnR5cGUub3B0aW9ucykge1xuICAgIGdyb3VwS2V5cyA9IFsuLi5ncm91cENvbC50eXBlLm9wdGlvbnNdO1xuICAgIGZvciAoY29uc3Qga2V5IG9mIGdyb3Vwcy5rZXlzKCkpIHtcbiAgICAgIGlmICghZ3JvdXBLZXlzLmluY2x1ZGVzKGtleSkpIGdyb3VwS2V5cy5wdXNoKGtleSk7XG4gICAgfVxuICB9IGVsc2Uge1xuICAgIGdyb3VwS2V5cyA9IFsuLi5ncm91cHMua2V5cygpXTtcbiAgfVxuXG4gIGNvbnN0IGxhbmVDb250YWluZXIgPSBrYW5iYW4uY3JlYXRlRGl2KFwiemliYXNlLWthbmJhbi1sYW5lc1wiKTtcblxuICBncm91cEtleXMuZm9yRWFjaCgoZ3JvdXBWYWx1ZSkgPT4ge1xuICAgIGNvbnN0IGl0ZW1zID0gZ3JvdXBzLmdldChncm91cFZhbHVlKSB8fCBbXTtcbiAgICBjb25zdCBsYW5lID0gbGFuZUNvbnRhaW5lci5jcmVhdGVEaXYoXCJ6aWJhc2Uta2FuYmFuLWxhbmVcIik7XG4gICAgY29uc3QgY29sb3IgPSBnZXRMYWJlbENvbG9yKGdyb3VwVmFsdWUpO1xuXG4gICAgY29uc3QgaGVhZGVyID0gbGFuZS5jcmVhdGVEaXYoXCJ6aWJhc2Uta2FuYmFuLWxhbmUtaGVhZGVyXCIpO1xuICAgIGhlYWRlci5zdHlsZS5zZXRQcm9wZXJ0eShcIi0tbGFuZS1jb2xvclwiLCBjb2xvcik7XG4gICAgY29uc3QgaGVhZGVyTGFiZWwgPSBoZWFkZXIuY3JlYXRlU3Bhbih7IHRleHQ6IGdyb3VwVmFsdWUsIGNsczogXCJ6aWJhc2Uta2FuYmFuLWxhbmUtdGl0bGVcIiB9KTtcbiAgICBoZWFkZXJMYWJlbC5zZXRDc3NTdHlsZXMoeyBjb2xvciB9KTtcbiAgICBoZWFkZXIuY3JlYXRlU3Bhbih7IHRleHQ6IGAke2l0ZW1zLmxlbmd0aH1gLCBjbHM6IFwiemliYXNlLWthbmJhbi1sYW5lLWNvdW50XCIgfSk7XG5cbiAgICBjb25zdCBsYW5lQm9keSA9IGxhbmUuY3JlYXRlRGl2KFwiemliYXNlLWthbmJhbi1sYW5lLWJvZHlcIik7XG4gICAgbGFuZUJvZHkuZGF0YXNldC5ncm91cCA9IGdyb3VwVmFsdWU7XG5cbiAgICBsYW5lQm9keS5hZGRFdmVudExpc3RlbmVyKFwiZHJhZ292ZXJcIiwgKGUpID0+IHtcbiAgICAgIGUucHJldmVudERlZmF1bHQoKTtcbiAgICAgIGxhbmVCb2R5LmNsYXNzTGlzdC5hZGQoXCJ6aWJhc2Uta2FuYmFuLWxhbmUtZHJhZ292ZXJcIik7XG4gICAgfSk7XG4gICAgbGFuZUJvZHkuYWRkRXZlbnRMaXN0ZW5lcihcImRyYWdsZWF2ZVwiLCAoKSA9PiB7XG4gICAgICBsYW5lQm9keS5jbGFzc0xpc3QucmVtb3ZlKFwiemliYXNlLWthbmJhbi1sYW5lLWRyYWdvdmVyXCIpO1xuICAgIH0pO1xuICAgIGxhbmVCb2R5LmFkZEV2ZW50TGlzdGVuZXIoXCJkcm9wXCIsIGFzeW5jIChlKSA9PiB7XG4gICAgICBlLnByZXZlbnREZWZhdWx0KCk7XG4gICAgICBsYW5lQm9keS5jbGFzc0xpc3QucmVtb3ZlKFwiemliYXNlLWthbmJhbi1sYW5lLWRyYWdvdmVyXCIpO1xuICAgICAgY29uc3QgZnJvbUlkeFN0ciA9IGUuZGF0YVRyYW5zZmVyPy5nZXREYXRhKFwidGV4dC9rYW5iYW4tcm93XCIpO1xuICAgICAgaWYgKCFmcm9tSWR4U3RyKSByZXR1cm47XG4gICAgICBjb25zdCBmcm9tSWR4ID0gcGFyc2VJbnQoZnJvbUlkeFN0ciwgMTApO1xuICAgICAgbGV0IG5ld1ZhbHVlID0gZ3JvdXBWYWx1ZTtcbiAgICAgIGlmIChncm91cENvbC50eXBlLmtpbmQgPT09IFwibXVsdGktc2VsZWN0XCIpIHtcbiAgICAgICAgY29uc3Qgcm93TGluZSA9IHJhd0RhdGFMaW5lc1tmcm9tSWR4XTtcbiAgICAgICAgY29uc3Qgcm93Q2VsbHMgPSBzcGxpdFJvdyhyb3dMaW5lKTtcbiAgICAgICAgY29uc3QgY3VycmVudFJhdyA9IChyb3dDZWxsc1tncm91cENvbC5pbmRleF0gfHwgXCJcIikudHJpbSgpO1xuICAgICAgICBjb25zdCB0YWdzID0gcGFyc2VNdWx0aVNlbGVjdChjdXJyZW50UmF3KTtcbiAgICAgICAgaWYgKCF0YWdzLmluY2x1ZGVzKGdyb3VwVmFsdWUpKSB0YWdzLnB1c2goZ3JvdXBWYWx1ZSk7XG4gICAgICAgIG5ld1ZhbHVlID0gdGFncy5qb2luKFwiLCBcIik7XG4gICAgICB9XG4gICAgICBhd2FpdCBob3N0LndyaXRlQmFjayhjb250ZXh0LCBzZWN0aW9uSW5mbywgc2NoZW1hLmRhdGFTdGFydEluZGV4ICsgZnJvbUlkeCwgZ3JvdXBDb2wuaW5kZXgsIG5ld1ZhbHVlKTtcbiAgICB9KTtcblxuICAgIGl0ZW1zLmZvckVhY2goKHsgbGluZSwgY2VsbHMgfSkgPT4ge1xuICAgICAgY29uc3QgcmF3SWR4ID0gcmF3RGF0YUxpbmVzLmZpbmRJbmRleCgobCkgPT4gbCA9PT0gbGluZSk7XG4gICAgICBjb25zdCBjYXJkID0gbGFuZUJvZHkuY3JlYXRlRGl2KFwiemliYXNlLWthbmJhbi1jYXJkXCIpO1xuICAgICAgY2FyZC5kcmFnZ2FibGUgPSB0cnVlO1xuICAgICAgY2FyZC5hZGRFdmVudExpc3RlbmVyKFwiZHJhZ3N0YXJ0XCIsIChlKSA9PiB7XG4gICAgICAgIGUuZGF0YVRyYW5zZmVyPy5zZXREYXRhKFwidGV4dC9rYW5iYW4tcm93XCIsIHJhd0lkeC50b1N0cmluZygpKTtcbiAgICAgICAgY2FyZC5jbGFzc0xpc3QuYWRkKFwiemliYXNlLWthbmJhbi1jYXJkLWRyYWdnaW5nXCIpO1xuICAgICAgfSk7XG4gICAgICBjYXJkLmFkZEV2ZW50TGlzdGVuZXIoXCJkcmFnZW5kXCIsICgpID0+IHtcbiAgICAgICAgY2FyZC5jbGFzc0xpc3QucmVtb3ZlKFwiemliYXNlLWthbmJhbi1jYXJkLWRyYWdnaW5nXCIpO1xuICAgICAgfSk7XG5cbiAgICAgIHNjaGVtYS5jb2x1bW5zLmZvckVhY2goKGNvbCwgY29sSWR4KSA9PiB7XG4gICAgICAgIGlmIChjb2xJZHggPT09IGdyb3VwQ29sLmluZGV4KSByZXR1cm47XG4gICAgICAgIGNvbnN0IHJhd1ZhbHVlID0gKGNlbGxzW2NvbElkeF0gPz8gXCJcIikudHJpbSgpO1xuICAgICAgICBpZiAoIXJhd1ZhbHVlKSByZXR1cm47XG5cbiAgICAgICAgaWYgKGNvbC50eXBlLmtpbmQgPT09IFwidGV4dFwiKSB7XG4gICAgICAgICAgaWYgKCFjYXJkLnF1ZXJ5U2VsZWN0b3IoXCIuemliYXNlLWthbmJhbi1jYXJkLXRpdGxlXCIpKSB7XG4gICAgICAgICAgICBjb25zdCB0aXRsZUVsID0gY2FyZC5jcmVhdGVEaXYoXCJ6aWJhc2Uta2FuYmFuLWNhcmQtdGl0bGVcIik7XG4gICAgICAgICAgICB2b2lkIE1hcmtkb3duUmVuZGVyZXIucmVuZGVyTWFya2Rvd24ocmF3VmFsdWUsIHRpdGxlRWwsIGNvbnRleHQuc291cmNlUGF0aCwgaG9zdC5wbHVnaW4pO1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIGNvbnN0IGZpZWxkID0gY2FyZC5jcmVhdGVEaXYoXCJ6aWJhc2Uta2FuYmFuLWNhcmQtZmllbGRcIik7XG4gICAgICAgIGZpZWxkLmNyZWF0ZVNwYW4oeyB0ZXh0OiBjb2wubmFtZSwgY2xzOiBcInppYmFzZS1rYW5iYW4tZmllbGQtbGFiZWxcIiB9KTtcblxuICAgICAgICBpZiAoY29sLnR5cGUua2luZCA9PT0gXCJsYWJlbFwiKSB7XG4gICAgICAgICAgY29uc3QgY2hpcCA9IGZpZWxkLmNyZWF0ZVNwYW4oeyB0ZXh0OiByYXdWYWx1ZSwgY2xzOiBcInppYmFzZS1sYWJlbCB6aWJhc2Uta2FuYmFuLWxhYmVsXCIgfSk7XG4gICAgICAgICAgY2hpcC5zdHlsZS5zZXRQcm9wZXJ0eShcIi0tbGNcIiwgZ2V0TGFiZWxDb2xvcihyYXdWYWx1ZSkpO1xuICAgICAgICB9IGVsc2UgaWYgKGNvbC50eXBlLmtpbmQgPT09IFwidG9nZ2xlXCIpIHtcbiAgICAgICAgICBmaWVsZC5jcmVhdGVTcGFuKHsgdGV4dDogcGFyc2VCb29sKHJhd1ZhbHVlKSA/IFwiXHUyNzA1XCIgOiBcIlx1MkIxQ1wiLCBjbHM6IFwiemliYXNlLWthbmJhbi1maWVsZC12YWx1ZVwiIH0pO1xuICAgICAgICB9IGVsc2UgaWYgKGNvbC50eXBlLmtpbmQgPT09IFwibnVtYmVyXCIgfHwgY29sLnR5cGUua2luZCA9PT0gXCJmb3JtdWxhXCIpIHtcbiAgICAgICAgICBmaWVsZC5jcmVhdGVTcGFuKHsgdGV4dDogcmF3VmFsdWUsIGNsczogXCJ6aWJhc2Uta2FuYmFuLWZpZWxkLXZhbHVlXCIgfSk7XG4gICAgICAgIH0gZWxzZSBpZiAoY29sLnR5cGUua2luZCA9PT0gXCJkYXRlXCIpIHtcbiAgICAgICAgICBmaWVsZC5jcmVhdGVTcGFuKHsgdGV4dDogcmF3VmFsdWUsIGNsczogXCJ6aWJhc2Uta2FuYmFuLWZpZWxkLXZhbHVlIHppYmFzZS1kYXRlLXJlbmRlcmVkXCIgfSk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgZmllbGQuY3JlYXRlU3Bhbih7IHRleHQ6IHJhd1ZhbHVlLCBjbHM6IFwiemliYXNlLWthbmJhbi1maWVsZC12YWx1ZVwiIH0pO1xuICAgICAgICB9XG4gICAgICB9KTtcblxuICAgICAgaWYgKCFjYXJkLnF1ZXJ5U2VsZWN0b3IoXCIuemliYXNlLWthbmJhbi1jYXJkLXRpdGxlXCIpKSB7XG4gICAgICAgIGNvbnN0IHRpdGxlRWwgPSBjcmVhdGVEaXYoKTtcbiAgICAgICAgdGl0bGVFbC5jbGFzc05hbWUgPSBcInppYmFzZS1rYW5iYW4tY2FyZC10aXRsZVwiO1xuICAgICAgICB2b2lkIE1hcmtkb3duUmVuZGVyZXIucmVuZGVyTWFya2Rvd24oY2VsbHNbMF0gfHwgXCJcdTIwMTRcIiwgdGl0bGVFbCwgY29udGV4dC5zb3VyY2VQYXRoLCBob3N0LnBsdWdpbik7XG4gICAgICAgIGNhcmQuaW5zZXJ0QmVmb3JlKHRpdGxlRWwsIGNhcmQuZmlyc3RDaGlsZCk7XG4gICAgICB9XG4gICAgfSk7XG4gIH0pO1xufVxuIiwgImltcG9ydCB7IFRGaWxlLCB0eXBlIE1hcmtkb3duUG9zdFByb2Nlc3NvckNvbnRleHQsIHR5cGUgTWFya2Rvd25TZWN0aW9uSW5mb3JtYXRpb24gfSBmcm9tIFwib2JzaWRpYW5cIjtcbmltcG9ydCB7IGZvcm1hdFJlc3VsdCB9IGZyb20gXCIuLi9mb3JtdWxhXCI7XG5pbXBvcnQgeyBmaWx0ZXJEYXRhUm93cywgc2VyaWFsaXplUm93LCBzcGxpdFJvdyB9IGZyb20gXCIuLi9zY2hlbWFcIjtcbmltcG9ydCB0eXBlIHsgVGFibGVTY2hlbWEsIFppQmFzZUhvc3QgfSBmcm9tIFwiLi4vdHlwZXNcIjtcbmltcG9ydCB7IGdldFR5cGVJY29uIH0gZnJvbSBcIi4uL3VpXCI7XG5cbmludGVyZmFjZSBTdGF0VGggZXh0ZW5kcyBIVE1MVGFibGVDZWxsRWxlbWVudCB7XG4gIF91cGRhdGVTdGF0PzogKCkgPT4gdm9pZDtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGJ1aWxkVGFibGVWaWV3KFxuICBob3N0OiBaaUJhc2VIb3N0LFxuICBib2R5OiBIVE1MRWxlbWVudCxcbiAgc2NoZW1hOiBUYWJsZVNjaGVtYSxcbiAgZ2V0RGF0YVJvd3M6ICgpID0+IHN0cmluZ1tdLFxuICByYXdEYXRhTGluZXM6IHN0cmluZ1tdLFxuICBjb250ZXh0OiBNYXJrZG93blBvc3RQcm9jZXNzb3JDb250ZXh0LFxuICBzZWN0aW9uSW5mbzogTWFya2Rvd25TZWN0aW9uSW5mb3JtYXRpb24sXG4gIGZpbHRlclF1ZXJ5OiBzdHJpbmcsXG4gIHNvcnRDb2xJZHg6IG51bWJlciB8IG51bGwsXG4gIHNvcnRBc2M6IGJvb2xlYW4sXG4gIGJhZGdlOiBIVE1MRWxlbWVudCxcbiAgb25Tb3J0Q2hhbmdlOiAoY29sOiBudW1iZXIsIGFzYzogYm9vbGVhbikgPT4gdm9pZCxcbik6IHZvaWQge1xuICBjb25zdCB0YWJsZUVsID0gYm9keS5jcmVhdGVFbChcInRhYmxlXCIsIHsgY2xzOiBcInppYmFzZS10YWJsZVwiIH0pO1xuICBjb25zdCB0aGVhZCA9IHRhYmxlRWwuY3JlYXRlRWwoXCJ0aGVhZFwiKTtcbiAgY29uc3QgaGVhZGVyUm93ID0gdGhlYWQuY3JlYXRlRWwoXCJ0clwiKTtcbiAgY29uc3Qgc3RhdE1vZGVzOiBSZWNvcmQ8bnVtYmVyLCBzdHJpbmc+ID0ge307XG5cbiAgc2NoZW1hLmNvbHVtbnMuZm9yRWFjaCgoY29sLCBjb2xJZHgpID0+IHtcbiAgICBjb25zdCB0aCA9IGhlYWRlclJvdy5jcmVhdGVFbChcInRoXCIsIHsgY2xzOiBcInppYmFzZS10aFwiIH0pIGFzIFN0YXRUaDtcbiAgICB0aC5kcmFnZ2FibGUgPSB0cnVlO1xuICAgIHRoLmFkZEV2ZW50TGlzdGVuZXIoXCJkcmFnc3RhcnRcIiwgKGUpID0+IHtcbiAgICAgIGUuc3RvcFByb3BhZ2F0aW9uKCk7XG4gICAgICBlLmRhdGFUcmFuc2Zlcj8uc2V0RGF0YShcInRleHQvY29sXCIsIGNvbElkeC50b1N0cmluZygpKTtcbiAgICB9KTtcbiAgICB0aC5hZGRFdmVudExpc3RlbmVyKFwiZHJhZ292ZXJcIiwgKGUpID0+IHtcbiAgICAgIGUucHJldmVudERlZmF1bHQoKTtcbiAgICAgIHRoLmNsYXNzTGlzdC5hZGQoXCJ6aWJhc2UtdGgtZHJvcC10YXJnZXRcIik7XG4gICAgfSk7XG4gICAgdGguYWRkRXZlbnRMaXN0ZW5lcihcImRyYWdsZWF2ZVwiLCAoKSA9PiB0aC5jbGFzc0xpc3QucmVtb3ZlKFwiemliYXNlLXRoLWRyb3AtdGFyZ2V0XCIpKTtcbiAgICB0aC5hZGRFdmVudExpc3RlbmVyKFwiZHJhZ2VuZFwiLCAoKSA9PiB7XG4gICAgICB0aGVhZC5xdWVyeVNlbGVjdG9yQWxsKFwiLnppYmFzZS10aFwiKS5mb3JFYWNoKChlbCkgPT4gZWwuY2xhc3NMaXN0LnJlbW92ZShcInppYmFzZS10aC1kcm9wLXRhcmdldFwiKSk7XG4gICAgfSk7XG4gICAgdGguYWRkRXZlbnRMaXN0ZW5lcihcImRyb3BcIiwgYXN5bmMgKGUpID0+IHtcbiAgICAgIGUucHJldmVudERlZmF1bHQoKTtcbiAgICAgIGUuc3RvcFByb3BhZ2F0aW9uKCk7XG4gICAgICB0aC5jbGFzc0xpc3QucmVtb3ZlKFwiemliYXNlLXRoLWRyb3AtdGFyZ2V0XCIpO1xuICAgICAgY29uc3QgZnJvbUNvbFN0ciA9IGUuZGF0YVRyYW5zZmVyPy5nZXREYXRhKFwidGV4dC9jb2xcIik7XG4gICAgICBpZiAoIWZyb21Db2xTdHIpIHJldHVybjtcbiAgICAgIGNvbnN0IGZyb21Db2xJZHggPSBwYXJzZUludChmcm9tQ29sU3RyLCAxMCk7XG4gICAgICBpZiAoZnJvbUNvbElkeCA9PT0gY29sSWR4KSByZXR1cm47XG4gICAgICBjb25zdCBmaWxlID0gaG9zdC5hcHAudmF1bHQuZ2V0QWJzdHJhY3RGaWxlQnlQYXRoKGNvbnRleHQuc291cmNlUGF0aCk7XG4gICAgICBpZiAoIShmaWxlIGluc3RhbmNlb2YgVEZpbGUpKSByZXR1cm47XG4gICAgICBhd2FpdCBob3N0LmFwcC52YXVsdC5wcm9jZXNzKGZpbGUsIChjb250ZW50KSA9PiB7XG4gICAgICAgIGNvbnN0IGFsbExpbmVzID0gY29udGVudC5zcGxpdChcIlxcblwiKTtcbiAgICAgICAgZm9yIChsZXQgaSA9IHNlY3Rpb25JbmZvLmxpbmVTdGFydDsgaSA8PSBzZWN0aW9uSW5mby5saW5lRW5kOyBpKyspIHtcbiAgICAgICAgICBjb25zdCBsaW5lID0gYWxsTGluZXNbaV07XG4gICAgICAgICAgaWYgKCFsaW5lLmluY2x1ZGVzKFwifFwiKSkgY29udGludWU7XG4gICAgICAgICAgY29uc3QgY2VsbHMgPSBzcGxpdFJvdyhsaW5lKTtcbiAgICAgICAgICBpZiAoY2VsbHMubGVuZ3RoIDw9IGZyb21Db2xJZHggfHwgY2VsbHMubGVuZ3RoIDw9IGNvbElkeCkgY29udGludWU7XG4gICAgICAgICAgY29uc3QgZHJhZ2dlZENlbGwgPSBjZWxscy5zcGxpY2UoZnJvbUNvbElkeCwgMSlbMF07XG4gICAgICAgICAgbGV0IGluc2VydElkeCA9IGNvbElkeDtcbiAgICAgICAgICBpZiAoZnJvbUNvbElkeCA8IGNvbElkeCkgaW5zZXJ0SWR4LS07XG4gICAgICAgICAgY2VsbHMuc3BsaWNlKGluc2VydElkeCwgMCwgZHJhZ2dlZENlbGwpO1xuICAgICAgICAgIGFsbExpbmVzW2ldID0gc2VyaWFsaXplUm93KGNlbGxzKTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gYWxsTGluZXMuam9pbihcIlxcblwiKTtcbiAgICAgIH0pO1xuICAgIH0pO1xuXG4gICAgY29uc3QgdGhJbm5lciA9IHRoLmNyZWF0ZURpdihcInppYmFzZS10aC1pbm5lclwiKTtcbiAgICB0aElubmVyLmNyZWF0ZVNwYW4oeyB0ZXh0OiBjb2wubmFtZSwgY2xzOiBcInppYmFzZS10aC1uYW1lXCIgfSk7XG4gICAgdGhJbm5lci5jcmVhdGVTcGFuKHsgdGV4dDogZ2V0VHlwZUljb24oY29sLnR5cGUpLCBjbHM6IFwiemliYXNlLXR5cGUtaWNvblwiIH0pO1xuICAgIHRoSW5uZXIuY3JlYXRlU3Bhbih7IGNsczogXCJ6aWJhc2Utc29ydC1hcnJvd1wiLCB0ZXh0OiBcIlx1MjE5NVwiIH0pO1xuXG4gICAgaWYgKGNvbC50eXBlLmtpbmQgPT09IFwibnVtYmVyXCIgfHwgY29sLnR5cGUua2luZCA9PT0gXCJmb3JtdWxhXCIpIHtcbiAgICAgIGlmICghc3RhdE1vZGVzW2NvbElkeF0pIHN0YXRNb2Rlc1tjb2xJZHhdID0gXCJTVU1cIjtcbiAgICAgIGNvbnN0IHN0YXRCYWRnZSA9IHRoLmNyZWF0ZURpdihcInppYmFzZS10aC1zdGF0XCIpO1xuXG4gICAgICBjb25zdCB1cGRhdGVUaFN0YXQgPSAoKSA9PiB7XG4gICAgICAgIGNvbnN0IGRhdGFSb3dzID0gZmlsdGVyRGF0YVJvd3MoZ2V0RGF0YVJvd3MoKSwgZmlsdGVyUXVlcnkpO1xuICAgICAgICBjb25zdCB2YWx1ZXMgPSBkYXRhUm93c1xuICAgICAgICAgIC5tYXAoKGxpbmUpID0+IHBhcnNlRmxvYXQoKHNwbGl0Um93KGxpbmUpW2NvbElkeF0gPz8gXCJcIikudHJpbSgpKSlcbiAgICAgICAgICAuZmlsdGVyKChuKSA9PiAhTnVtYmVyLmlzTmFOKG4pKTtcblxuICAgICAgICBpZiAodmFsdWVzLmxlbmd0aCA9PT0gMCkge1xuICAgICAgICAgIHN0YXRCYWRnZS50ZXh0Q29udGVudCA9IFwiXCI7XG4gICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG5cbiAgICAgICAgY29uc3QgbW9kZSA9IHN0YXRNb2Rlc1tjb2xJZHhdO1xuICAgICAgICBsZXQgcmVzdWx0ID0gMDtcbiAgICAgICAgc3dpdGNoIChtb2RlKSB7XG4gICAgICAgICAgY2FzZSBcIlNVTVwiOiByZXN1bHQgPSB2YWx1ZXMucmVkdWNlKChhLCBiKSA9PiBhICsgYiwgMCk7IGJyZWFrO1xuICAgICAgICAgIGNhc2UgXCJBVkdcIjogcmVzdWx0ID0gdmFsdWVzLnJlZHVjZSgoYSwgYikgPT4gYSArIGIsIDApIC8gdmFsdWVzLmxlbmd0aDsgYnJlYWs7XG4gICAgICAgICAgY2FzZSBcIk1JTlwiOiByZXN1bHQgPSBNYXRoLm1pbiguLi52YWx1ZXMpOyBicmVhaztcbiAgICAgICAgICBjYXNlIFwiTUFYXCI6IHJlc3VsdCA9IE1hdGgubWF4KC4uLnZhbHVlcyk7IGJyZWFrO1xuICAgICAgICAgIGRlZmF1bHQ6IHJlc3VsdCA9IDA7XG4gICAgICAgIH1cblxuICAgICAgICBzdGF0QmFkZ2UuZW1wdHkoKTtcbiAgICAgICAgc3RhdEJhZGdlLmNyZWF0ZVNwYW4oeyB0ZXh0OiBtb2RlLCBjbHM6IFwiemliYXNlLXRoLXN0YXQtbW9kZVwiIH0pO1xuICAgICAgICBzdGF0QmFkZ2UuY3JlYXRlU3Bhbih7IHRleHQ6IFwiIFwiICsgZm9ybWF0UmVzdWx0KHJlc3VsdCksIGNsczogXCJ6aWJhc2UtdGgtc3RhdC12YWx1ZVwiIH0pO1xuICAgICAgfTtcblxuICAgICAgc3RhdEJhZGdlLmFkZEV2ZW50TGlzdGVuZXIoXCJjbGlja1wiLCAoZSkgPT4ge1xuICAgICAgICBlLnN0b3BQcm9wYWdhdGlvbigpO1xuICAgICAgICBjb25zdCBtb2RlcyA9IFtcIlNVTVwiLCBcIkFWR1wiLCBcIk1JTlwiLCBcIk1BWFwiXTtcbiAgICAgICAgY29uc3QgY3VycmVudCA9IG1vZGVzLmluZGV4T2Yoc3RhdE1vZGVzW2NvbElkeF0pO1xuICAgICAgICBzdGF0TW9kZXNbY29sSWR4XSA9IG1vZGVzWyhjdXJyZW50ICsgMSkgJSBtb2Rlcy5sZW5ndGhdO1xuICAgICAgICB1cGRhdGVUaFN0YXQoKTtcbiAgICAgIH0pO1xuXG4gICAgICB0aC5fdXBkYXRlU3RhdCA9IHVwZGF0ZVRoU3RhdDtcbiAgICAgIHVwZGF0ZVRoU3RhdCgpO1xuICAgIH1cblxuICAgIHRoLmFkZEV2ZW50TGlzdGVuZXIoXCJjbGlja1wiLCAoKSA9PiB7XG4gICAgICBjb25zdCBuZXdBc2MgPSBzb3J0Q29sSWR4ID09PSBjb2xJZHggPyAhc29ydEFzYyA6IHRydWU7XG4gICAgICBvblNvcnRDaGFuZ2UoY29sSWR4LCBuZXdBc2MpO1xuICAgICAgdGhlYWQucXVlcnlTZWxlY3RvckFsbChcIi56aWJhc2Utc29ydC1hcnJvd1wiKS5mb3JFYWNoKChlbCwgaSkgPT4ge1xuICAgICAgICBlbC50ZXh0Q29udGVudCA9IGkgPT09IGNvbElkeCA/IChuZXdBc2MgPyBcIlx1MjE5MVwiIDogXCJcdTIxOTNcIikgOiBcIlx1MjE5NVwiO1xuICAgICAgICBlbC5jbGFzc0xpc3QudG9nZ2xlKFwiemliYXNlLXNvcnQtYWN0aXZlXCIsIGkgPT09IGNvbElkeCk7XG4gICAgICB9KTtcbiAgICAgIHJlbmRlclJvd3MoKTtcbiAgICAgIHRoZWFkLnF1ZXJ5U2VsZWN0b3JBbGwoXCIuemliYXNlLXRoXCIpLmZvckVhY2goKHRoRWwpID0+IHtcbiAgICAgICAgY29uc3Qgc3RhdFRoID0gdGhFbCBhcyBTdGF0VGg7XG4gICAgICAgIGlmIChzdGF0VGguX3VwZGF0ZVN0YXQpIHN0YXRUaC5fdXBkYXRlU3RhdCgpO1xuICAgICAgfSk7XG4gICAgfSk7XG4gICAgdGguYWRkRXZlbnRMaXN0ZW5lcihcImNvbnRleHRtZW51XCIsIChlKSA9PiB7XG4gICAgICBlLnByZXZlbnREZWZhdWx0KCk7XG4gICAgICBob3N0LnNob3dUeXBlTWVudShlLCBjb2xJZHgsIHNjaGVtYSwgY29udGV4dCwgc2VjdGlvbkluZm8sIHJhd0RhdGFMaW5lcywgYmFkZ2UpO1xuICAgIH0pO1xuICB9KTtcblxuICBjb25zdCB0Ym9keSA9IHRhYmxlRWwuY3JlYXRlRWwoXCJ0Ym9keVwiKTtcblxuICBjb25zdCByZW5kZXJSb3dzID0gKCkgPT4ge1xuICAgIHRib2R5LmVtcHR5KCk7XG4gICAgbGV0IGRhdGFSb3dzID0gZmlsdGVyRGF0YVJvd3MoZ2V0RGF0YVJvd3MoKSwgZmlsdGVyUXVlcnkpO1xuICAgIGlmIChzb3J0Q29sSWR4ICE9PSBudWxsKSB7XG4gICAgICBjb25zdCBpZHggPSBzb3J0Q29sSWR4O1xuICAgICAgY29uc3QgY29sVHlwZSA9IHNjaGVtYS5jb2x1bW5zW2lkeF0/LnR5cGUua2luZCA/PyBcInRleHRcIjtcbiAgICAgIGRhdGFSb3dzID0gWy4uLmRhdGFSb3dzXS5zb3J0KChhLCBiKSA9PiB7XG4gICAgICAgIGNvbnN0IGF2ID0gKHNwbGl0Um93KGEpW2lkeF0gPz8gXCJcIikudHJpbSgpO1xuICAgICAgICBjb25zdCBidiA9IChzcGxpdFJvdyhiKVtpZHhdID8/IFwiXCIpLnRyaW0oKTtcbiAgICAgICAgaWYgKGNvbFR5cGUgPT09IFwibnVtYmVyXCIgfHwgY29sVHlwZSA9PT0gXCJmb3JtdWxhXCIpIHtcbiAgICAgICAgICBjb25zdCBuYSA9IHBhcnNlRmxvYXQoYXYpO1xuICAgICAgICAgIGNvbnN0IG5iID0gcGFyc2VGbG9hdChidik7XG4gICAgICAgICAgaWYgKCFOdW1iZXIuaXNOYU4obmEpICYmICFOdW1iZXIuaXNOYU4obmIpKSByZXR1cm4gc29ydEFzYyA/IG5hIC0gbmIgOiBuYiAtIG5hO1xuICAgICAgICB9XG4gICAgICAgIGlmIChjb2xUeXBlID09PSBcImRhdGVcIikge1xuICAgICAgICAgIGNvbnN0IGRhID0gbmV3IERhdGUoYXYpLmdldFRpbWUoKTtcbiAgICAgICAgICBjb25zdCBkYiA9IG5ldyBEYXRlKGJ2KS5nZXRUaW1lKCk7XG4gICAgICAgICAgaWYgKCFOdW1iZXIuaXNOYU4oZGEpICYmICFOdW1iZXIuaXNOYU4oZGIpKSByZXR1cm4gc29ydEFzYyA/IGRhIC0gZGIgOiBkYiAtIGRhO1xuICAgICAgICB9XG4gICAgICAgIGlmIChjb2xUeXBlID09PSBcInRvZ2dsZVwiKSB7XG4gICAgICAgICAgY29uc3QgYmEgPSBhdi50b0xvd2VyQ2FzZSgpID09PSBcInRydWVcIiA/IDEgOiAwO1xuICAgICAgICAgIGNvbnN0IGJiID0gYnYudG9Mb3dlckNhc2UoKSA9PT0gXCJ0cnVlXCIgPyAxIDogMDtcbiAgICAgICAgICByZXR1cm4gc29ydEFzYyA/IGJhIC0gYmIgOiBiYiAtIGJhO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiBzb3J0QXNjID8gYXYubG9jYWxlQ29tcGFyZShidikgOiBidi5sb2NhbGVDb21wYXJlKGF2KTtcbiAgICAgIH0pO1xuICAgIH1cbiAgICBpZiAoZGF0YVJvd3MubGVuZ3RoID09PSAwKSB7XG4gICAgICBjb25zdCBlbXB0eVRkID0gdGJvZHkuY3JlYXRlRWwoXCJ0clwiKS5jcmVhdGVFbChcInRkXCIsIHsgY2xzOiBcInppYmFzZS1lbXB0eVwiIH0pO1xuICAgICAgZW1wdHlUZC5jb2xTcGFuID0gc2NoZW1hLmNvbHVtbnMubGVuZ3RoO1xuICAgICAgZW1wdHlUZC50ZXh0Q29udGVudCA9IGZpbHRlclF1ZXJ5ID8gXCJObyBtYXRjaGluZyByb3dzXCIgOiBcIk5vIGRhdGFcIjtcbiAgICAgIHJldHVybjtcbiAgICB9XG4gICAgZGF0YVJvd3MuZm9yRWFjaCgobGluZSkgPT4ge1xuICAgICAgY29uc3QgcmF3SWR4ID0gcmF3RGF0YUxpbmVzLmZpbmRJbmRleCgobCkgPT4gbCA9PT0gbGluZSk7XG4gICAgICBjb25zdCBjZWxscyA9IHNwbGl0Um93KGxpbmUpO1xuICAgICAgY29uc3QgdHIgPSB0Ym9keS5jcmVhdGVFbChcInRyXCIsIHsgY2xzOiBcInppYmFzZS1yb3dcIiB9KTtcbiAgICAgIHRyLmRyYWdnYWJsZSA9IHRydWU7XG4gICAgICB0ci5hZGRFdmVudExpc3RlbmVyKFwiZHJhZ3N0YXJ0XCIsIChlKSA9PiB7XG4gICAgICAgIGUuZGF0YVRyYW5zZmVyPy5zZXREYXRhKFwidGV4dC9yb3dcIiwgcmF3SWR4LnRvU3RyaW5nKCkpO1xuICAgICAgICB0ci5jbGFzc0xpc3QuYWRkKFwiemliYXNlLXJvdy1kcmFnZ2luZ1wiKTtcbiAgICAgIH0pO1xuICAgICAgdHIuYWRkRXZlbnRMaXN0ZW5lcihcImRyYWdlbmRcIiwgKCkgPT4ge1xuICAgICAgICB0ci5jbGFzc0xpc3QucmVtb3ZlKFwiemliYXNlLXJvdy1kcmFnZ2luZ1wiKTtcbiAgICAgICAgdGJvZHkucXVlcnlTZWxlY3RvckFsbChcIi56aWJhc2Utcm93XCIpLmZvckVhY2goKGVsKSA9PiBlbC5jbGFzc0xpc3QucmVtb3ZlKFwiemliYXNlLXJvdy1kcm9wLXRhcmdldFwiKSk7XG4gICAgICB9KTtcbiAgICAgIHRyLmFkZEV2ZW50TGlzdGVuZXIoXCJkcmFnb3ZlclwiLCAoZSkgPT4ge1xuICAgICAgICBlLnByZXZlbnREZWZhdWx0KCk7XG4gICAgICAgIHRyLmNsYXNzTGlzdC5hZGQoXCJ6aWJhc2Utcm93LWRyb3AtdGFyZ2V0XCIpO1xuICAgICAgfSk7XG4gICAgICB0ci5hZGRFdmVudExpc3RlbmVyKFwiZHJhZ2xlYXZlXCIsICgpID0+IHRyLmNsYXNzTGlzdC5yZW1vdmUoXCJ6aWJhc2Utcm93LWRyb3AtdGFyZ2V0XCIpKTtcbiAgICAgIHRyLmFkZEV2ZW50TGlzdGVuZXIoXCJkcm9wXCIsIGFzeW5jIChlKSA9PiB7XG4gICAgICAgIGUucHJldmVudERlZmF1bHQoKTtcbiAgICAgICAgZS5zdG9wUHJvcGFnYXRpb24oKTtcbiAgICAgICAgdHIuY2xhc3NMaXN0LnJlbW92ZShcInppYmFzZS1yb3ctZHJvcC10YXJnZXRcIik7XG4gICAgICAgIGNvbnN0IGZyb21JZHhTdHIgPSBlLmRhdGFUcmFuc2Zlcj8uZ2V0RGF0YShcInRleHQvcm93XCIpO1xuICAgICAgICBpZiAoIWZyb21JZHhTdHIpIHJldHVybjtcbiAgICAgICAgY29uc3QgZnJvbUlkeCA9IHBhcnNlSW50KGZyb21JZHhTdHIsIDEwKTtcbiAgICAgICAgY29uc3QgdG9JZHggPSByYXdJZHg7XG4gICAgICAgIGlmIChmcm9tSWR4ICE9PSB0b0lkeCkge1xuICAgICAgICAgIGNvbnN0IGZpbGUgPSBob3N0LmFwcC52YXVsdC5nZXRBYnN0cmFjdEZpbGVCeVBhdGgoY29udGV4dC5zb3VyY2VQYXRoKTtcbiAgICAgICAgICBpZiAoIShmaWxlIGluc3RhbmNlb2YgVEZpbGUpKSByZXR1cm47XG4gICAgICAgICAgYXdhaXQgaG9zdC5hcHAudmF1bHQucHJvY2VzcyhmaWxlLCAoY29udGVudCkgPT4ge1xuICAgICAgICAgICAgY29uc3QgYWxsTGluZXMgPSBjb250ZW50LnNwbGl0KFwiXFxuXCIpO1xuICAgICAgICAgICAgY29uc3QgZmlsZVN0YXJ0ID0gc2VjdGlvbkluZm8ubGluZVN0YXJ0ICsgc2NoZW1hLmRhdGFTdGFydEluZGV4O1xuICAgICAgICAgICAgY29uc3QgZGF0YUxpbmVzID0gYWxsTGluZXMuc2xpY2UoZmlsZVN0YXJ0LCBmaWxlU3RhcnQgKyByYXdEYXRhTGluZXMubGVuZ3RoKTtcbiAgICAgICAgICAgIGNvbnN0IGRyYWdnZWQgPSBkYXRhTGluZXMuc3BsaWNlKGZyb21JZHgsIDEpWzBdO1xuICAgICAgICAgICAgbGV0IGluc2VydElkeCA9IHRvSWR4O1xuICAgICAgICAgICAgaWYgKGZyb21JZHggPCB0b0lkeCkgaW5zZXJ0SWR4LS07XG4gICAgICAgICAgICBkYXRhTGluZXMuc3BsaWNlKGluc2VydElkeCwgMCwgZHJhZ2dlZCk7XG4gICAgICAgICAgICBhbGxMaW5lcy5zcGxpY2UoZmlsZVN0YXJ0LCByYXdEYXRhTGluZXMubGVuZ3RoLCAuLi5kYXRhTGluZXMpO1xuICAgICAgICAgICAgcmV0dXJuIGFsbExpbmVzLmpvaW4oXCJcXG5cIik7XG4gICAgICAgICAgfSk7XG4gICAgICAgIH1cbiAgICAgIH0pO1xuICAgICAgc2NoZW1hLmNvbHVtbnMuZm9yRWFjaCgoY29sLCBjb2xJZHgpID0+IHtcbiAgICAgICAgY29uc3QgdGQgPSB0ci5jcmVhdGVFbChcInRkXCIsIHsgY2xzOiBcInppYmFzZS10ZFwiIH0pO1xuICAgICAgICBjb25zdCByYXdWYWx1ZSA9IGNlbGxzW2NvbElkeF0gPz8gXCJcIjtcbiAgICAgICAgaG9zdC5yZW5kZXJDZWxsKHRkLCBjb2wsIHJhd1ZhbHVlLCBjb250ZXh0LCBzY2hlbWEsIGNlbGxzLCBhc3luYyAobmV3VmFsdWUpID0+IHtcbiAgICAgICAgICBpZiAocmF3SWR4ICE9PSAtMSkge1xuICAgICAgICAgICAgY29uc3QgdXBkYXRlZENlbGxzID0gc3BsaXRSb3cocmF3RGF0YUxpbmVzW3Jhd0lkeF0pO1xuICAgICAgICAgICAgdXBkYXRlZENlbGxzW2NvbElkeF0gPSBgICR7bmV3VmFsdWV9IGA7XG4gICAgICAgICAgICByYXdEYXRhTGluZXNbcmF3SWR4XSA9IHNlcmlhbGl6ZVJvdyh1cGRhdGVkQ2VsbHMpO1xuICAgICAgICAgIH1cbiAgICAgICAgICBhd2FpdCBob3N0LndyaXRlQmFjayhjb250ZXh0LCBzZWN0aW9uSW5mbywgc2NoZW1hLmRhdGFTdGFydEluZGV4ICsgcmF3SWR4LCBjb2xJZHgsIG5ld1ZhbHVlKTtcbiAgICAgICAgfSk7XG4gICAgICB9KTtcbiAgICB9KTtcbiAgfTtcbiAgcmVuZGVyUm93cygpO1xufVxuIiwgImV4cG9ydCBjb25zdCBQTFVHSU5fVkVSU0lPTiA9IFwiMS4yLjFcIjtcbiJdLAogICJtYXBwaW5ncyI6ICI7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBLElBQUFBLG1CQUF5RTs7O0FDRWxFLElBQU0sZ0JBQWdCO0FBQ3RCLElBQU0scUJBQXFCO0FB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Q3RELFlBQU0sYUFBYSxJQUFJLFNBQVMsVUFBVSxFQUFFLEtBQUssbUJBQW1CLENBQUM7QUFDckUsMEJBQW9CLFFBQVEsQ0FBQyxNQUFNO0FBQ2pDLGNBQU0sTUFBTSxXQUFXLFNBQVMsVUFBVSxFQUFFLE1BQU0sR0FBRyxPQUFPLEVBQUUsQ0FBQztBQUMvRCxZQUFJLE1BQU0sS0FBSztBQUFNLGNBQUksV0FBVztBQUFBLE1BQ3RDLENBQUM7QUFDRCxpQkFBVyxpQkFBaUIsVUFBVSxZQUFZO0FBQ2hELGFBQUssT0FBTyxTQUFTLFlBQVksR0FBRyxFQUFFLE9BQU8sV0FBVztBQUN4RCxjQUFNLEtBQUssT0FBTyxhQUFhO0FBQUEsTUFDakMsQ0FBQztBQUNELFlBQU0sWUFBWSxJQUFJLFNBQVMsVUFBVSxFQUFFLE1BQU0sUUFBSyxLQUFLLHFCQUFxQixDQUFDO0FBQ2pGLGdCQUFVLGlCQUFpQixTQUFTLFlBQVk7QUFDOUMsYUFBSyxPQUFPLFNBQVMsWUFBWSxPQUFPLEtBQUssQ0FBQztBQUM5QyxjQUFNLEtBQUssT0FBTyxhQUFhO0FBQy9CLGFBQUssWUFBWSxTQUFTO0FBQUEsTUFDNUIsQ0FBQztBQUFBLElBQ0gsQ0FBQztBQUFBLEVBQ0g7QUFDRjsiLAogICJuYW1lcyI6IFsiaW1wb3J0X29ic2lkaWFuIiwgImNvbHVtbnMiLCAiaW1wb3J0X29ic2lkaWFuIiwgImltcG9ydF9vYnNpZGlhbiIsICJpbXBvcnRfb2JzaWRpYW4iLCAiaW1wb3J0X29ic2lkaWFuIiwgImltcG9ydF9vYnNpZGlhbiIsICJpbXBvcnRfb2JzaWRpYW4iLCAiX2EiLCAiX2IiLCAiX2EiLCAiX2IiXQp9Cg==
