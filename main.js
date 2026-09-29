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
    chip.setCssProps({ "--lc": getLabelColor(newVal) });
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
      input.addEventListener("change", () => {
        void onChange(serializeBool(input.checked));
      });
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
      select.addEventListener("change", () => {
        void onChange(select.value);
      });
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
          chip.setCssProps({ "--lc": getLabelColor(tag) });
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
      chip.setCssProps({ "--lc": getLabelColor(rawValue.trim()) });
      chip.addEventListener("click", () => startLabelEdit(chip, rawValue.trim(), onChange));
      break;
    }
    case "number": {
      const input = td.createEl("input", { type: "number", cls: "zibase-number" });
      input.value = rawValue.trim();
      let debounce = 0;
      input.addEventListener("input", () => {
        window.clearTimeout(debounce);
        debounce = window.setTimeout(() => {
          void onChange(input.value);
        }, 400);
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
        void import_obsidian.MarkdownRenderer.render(host.app, val, displaySpan, context.sourcePath, host.plugin).then(() => {
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
        void import_obsidian3.MarkdownRenderer.render(host.app, entry.title || "\u2014", pill, context.sourcePath, host.plugin);
        if (entry.label) {
          pill.setCssProps({ "--lc": getLabelColor(entry.label) });
          pill.classList.add("zibase-calendar-entry-colored");
        }
      });
      if (entries.length === 0) {
        cell.addEventListener("click", () => {
          void (async () => {
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
          })();
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
    void import_obsidian4.MarkdownRenderer.render(host.app, titleValue || "\u2014", titleDiv, context.sourcePath, host.plugin);
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
        chip.setCssProps({ "--lc": getLabelColor(rawValue) });
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
    header.setCssProps({ "--lane-color": color });
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
    laneBody.addEventListener("drop", (e) => {
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
      void host.writeBack(context, sectionInfo, schema.dataStartIndex + fromIdx, groupCol.index, newValue);
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
            void import_obsidian5.MarkdownRenderer.render(host.app, rawValue, titleEl, context.sourcePath, host.plugin);
            return;
          }
        }
        const field = card.createDiv("zibase-kanban-card-field");
        field.createSpan({ text: col.name, cls: "zibase-kanban-field-label" });
        if (col.type.kind === "label") {
          const chip = field.createSpan({ text: rawValue, cls: "zibase-label zibase-kanban-label" });
          chip.setCssProps({ "--lc": getLabelColor(rawValue) });
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
        void import_obsidian5.MarkdownRenderer.render(host.app, cells[0] || "\u2014", titleEl, context.sourcePath, host.plugin);
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
    th.addEventListener("drop", (e) => {
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
      void (async () => {
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
      })();
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
      tr.addEventListener("drop", (e) => {
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
          void (async () => {
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
          })();
        }
      });
      schema.columns.forEach((col, colIdx) => {
        var _a2;
        const td = tr.createEl("td", { cls: "zibase-td" });
        const rawValue = (_a2 = cells[colIdx]) != null ? _a2 : "";
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
    (0, import_obsidian7.setIcon)(collapseBtn, "chevron-right");
    const topLeft = topbar.createDiv("zibase-topbar-left");
    topLeft.createSpan({ text: "\u27C1", cls: "zibase-logo" });
    const zibaseName = topLeft.createSpan({ text: "ZiBase", cls: "zibase-name zibase-name-btn" });
    const badge = topLeft.createSpan({
      cls: schema.inferred ? "zibase-inferred-badge" : "zibase-annotated-badge",
      text: schema.inferred ? "inferred" : "annotated"
    });
    const topRight = topbar.createDiv("zibase-topbar-right");
    const searchWrap = topRight.createDiv("zibase-search-wrap");
    const searchIcon = searchWrap.createSpan({ cls: "zibase-search-icon" });
    (0, import_obsidian7.setIcon)(searchIcon, "search");
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
    (0, import_obsidian7.setIcon)(addRowBtn, "plus");
    addRowBtn.appendText(" Add row");
    addRowBtn.addEventListener("click", () => {
      void this.addRow(context, sectionInfo, schema);
    });
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
      nameInput.addEventListener("change", () => {
        void (async () => {
          this.plugin.settings.columnRules[idx].name = nameInput.value.trim();
          await this.plugin.saveSettings();
        })();
      });
      row.createSpan({ text: "\u2192", cls: "zibase-rules-arrow" });
      const typeSelect = row.createEl("select", { cls: "zibase-rules-type" });
      COLUMN_TYPE_OPTIONS.forEach((t) => {
        const opt = typeSelect.createEl("option", { text: t, value: t });
        if (t === rule.type)
          opt.selected = true;
      });
      typeSelect.addEventListener("change", () => {
        void (async () => {
          this.plugin.settings.columnRules[idx].type = typeSelect.value;
          await this.plugin.saveSettings();
        })();
      });
      const removeBtn = row.createEl("button", { text: "\xD7", cls: "zibase-rules-remove" });
      removeBtn.addEventListener("click", () => {
        void (async () => {
          this.plugin.settings.columnRules.splice(idx, 1);
          await this.plugin.saveSettings();
          this.renderRulesPanel(container);
        })();
      });
    });
    const addRow = container.createDiv("zibase-rules-add");
    const addBtn = addRow.createEl("button", { text: "+ Add rule", cls: "zibase-rules-add-btn" });
    addBtn.addEventListener("click", () => {
      void (async () => {
        this.plugin.settings.columnRules.push({ name: "", type: "label" });
        await this.plugin.saveSettings();
        this.renderRulesPanel(container);
      })();
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
      item.addEventListener("click", () => {
        var _a3, _b2, _c, _d, _e;
        closeMenu();
        if (kind === "select") {
          const currentOpts = ((_a3 = schema.columns[colIdx]) == null ? void 0 : _a3.type.kind) === "select" ? schema.columns[colIdx].type.options : [];
          new SelectOptionsModal(
            this.app,
            (_c = (_b2 = schema.columns[colIdx]) == null ? void 0 : _b2.name) != null ? _c : "Column",
            currentOpts,
            (opts) => {
              void this.writeColumnType(context, sectionInfo, schema, colIdx, `select:${opts.join(",")}`, badge);
            }
          ).open();
        } else if (kind === "formula") {
          const colName = (_d = schema.columns[colIdx]) == null ? void 0 : _d.name;
          const currentExpr = ((_e = schema.columns[colIdx]) == null ? void 0 : _e.type.kind) === "formula" ? schema.columns[colIdx].type.expression : "";
          new FormulaInputModal(this.app, colName || "Column", currentExpr, schema.columns, (expr) => {
            void this.writeColumnType(context, sectionInfo, schema, colIdx, `formula:${expr}`, badge);
          }).open();
        } else {
          void this.writeColumnType(context, sectionInfo, schema, colIdx, kind, badge);
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
      await import_obsidian7.MarkdownRenderer.render(this.app, newRaw, displaySpan, context.sourcePath, this.plugin);
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
var PLUGIN_VERSION = "1.2.2";

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
    new import_obsidian8.Setting(containerEl).setName("ZiBase \u2014 \u0BB4\u0BBF\u0BAF\u0BB2\u0BCD").setHeading();
    containerEl.createEl("p", {
      text: "Markdown tables as living databases.",
      cls: "zibase-settings-desc"
    });
    new import_obsidian8.Setting(containerEl).setName("General").setHeading();
    new import_obsidian8.Setting(containerEl).setName("Render in Reading View").setDesc("Show rich UI when viewing notes in reading mode.").addToggle(
      (t) => t.setValue(this.plugin.settings.renderInReadingView).onChange((v) => {
        void (async () => {
          this.plugin.settings.renderInReadingView = v;
          await this.plugin.saveSettings();
        })();
      })
    );
    new import_obsidian8.Setting(containerEl).setName("Auto-infer schema").setDesc("Automatically detect column types from plain markdown tables. Turn off to only enhance annotated tables.").addToggle(
      (t) => t.setValue(this.plugin.settings.inferSchema).onChange((v) => {
        void (async () => {
          this.plugin.settings.inferSchema = v;
          await this.plugin.saveSettings();
        })();
      })
    );
    new import_obsidian8.Setting(containerEl).setName("Column name rules").setHeading();
    containerEl.createEl("p", {
      text: "When a column name matches, auto-assign that type. Applied to all inferred tables.",
      cls: "zibase-settings-desc"
    });
    const rulesContainer = containerEl.createDiv("zibase-rules-container");
    this.renderRules(rulesContainer);
    new import_obsidian8.Setting(containerEl).addButton(
      (btn) => btn.setButtonText("+ Add rule").setCta().onClick(() => {
        void (async () => {
          this.plugin.settings.columnRules.push({ name: "", type: "label" });
          await this.plugin.saveSettings();
          this.renderRules(rulesContainer);
        })();
      })
    );
    new import_obsidian8.Setting(containerEl).setName("Reset to defaults").setDesc("Restore the original column name rules.").addButton(
      (btn) => btn.setButtonText("Reset").setDestructive().onClick(() => {
        void (async () => {
          this.plugin.settings.columnRules = [...DEFAULT_COLUMN_RULES];
          await this.plugin.saveSettings();
          this.renderRules(rulesContainer);
        })();
      })
    );
    new import_obsidian8.Setting(containerEl).setName("About").setHeading();
    containerEl.createEl("p", { text: `ZiBase v${PLUGIN_VERSION} \u2014 Built by Rohith A (ZIYAL)`, cls: "zibase-settings-desc" });
    containerEl.createEl("p", { text: "Markdown-native database plugin.", cls: "zibase-settings-desc" });
  }
  renderRules(container) {
    container.empty();
    this.plugin.settings.columnRules.forEach((rule, idx) => {
      const row = container.createDiv("zibase-rule-row");
      const nameInput = row.createEl("input", { type: "text", cls: "zibase-rule-name", value: rule.name });
      nameInput.placeholder = "column name";
      nameInput.addEventListener("change", () => {
        void (async () => {
          this.plugin.settings.columnRules[idx].name = nameInput.value.trim();
          await this.plugin.saveSettings();
        })();
      });
      row.createSpan({ text: "\u2192", cls: "zibase-rule-arrow" });
      const typeSelect = row.createEl("select", { cls: "zibase-rule-type" });
      COLUMN_TYPE_OPTIONS.forEach((t) => {
        const opt = typeSelect.createEl("option", { text: t, value: t });
        if (t === rule.type)
          opt.selected = true;
      });
      typeSelect.addEventListener("change", () => {
        void (async () => {
          this.plugin.settings.columnRules[idx].type = typeSelect.value;
          await this.plugin.saveSettings();
        })();
      });
      const removeBtn = row.createEl("button", { text: "\xD7", cls: "zibase-rule-remove" });
      removeBtn.addEventListener("click", () => {
        void (async () => {
          this.plugin.settings.columnRules.splice(idx, 1);
          await this.plugin.saveSettings();
          this.renderRules(container);
        })();
      });
    });
  }
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsic3JjL21haW4udHMiLCAic3JjL3NjaGVtYS50cyIsICJzcmMvcmVuZGVyZXIudHMiLCAic3JjL2NlbGxzLnRzIiwgInNyYy9mb3JtdWxhLnRzIiwgInNyYy9jb2xvcnMudHMiLCAic3JjL3VpLnRzIiwgInNyYy9tb2RhbHMudHMiLCAic3JjL21vZGVsLnRzIiwgInNyYy92aWV3cy9jYWxlbmRhci50cyIsICJzcmMvdmlld3MvZ2FsbGVyeS50cyIsICJzcmMvdmlld3Mva2FuYmFuLnRzIiwgInNyYy92aWV3cy90YWJsZS50cyIsICJzcmMvdmVyc2lvbi50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiaW1wb3J0IHsgUGx1Z2luLCBQbHVnaW5TZXR0aW5nVGFiLCBTZXR0aW5nLCB0eXBlIEFwcCwgdHlwZSBFZGl0b3IgfSBmcm9tIFwib2JzaWRpYW5cIjtcbmltcG9ydCB7IERFRkFVTFRfQ09MVU1OX1JVTEVTIH0gZnJvbSBcIi4vc2NoZW1hXCI7XG5pbXBvcnQgeyBaaUJhc2VUYWJsZVJlbmRlcmVyIH0gZnJvbSBcIi4vcmVuZGVyZXJcIjtcbmltcG9ydCB7IENPTFVNTl9UWVBFX09QVElPTlMsIHR5cGUgQ29sdW1uUnVsZSwgdHlwZSBaaUJhc2VTZXR0aW5ncyB9IGZyb20gXCIuL21vZGVsXCI7XG5pbXBvcnQgeyBQTFVHSU5fVkVSU0lPTiB9IGZyb20gXCIuL3ZlcnNpb25cIjtcblxuY29uc3QgREVGQVVMVF9TRVRUSU5HUzogWmlCYXNlU2V0dGluZ3MgPSB7XG4gIHJlbmRlckluUmVhZGluZ1ZpZXc6IHRydWUsXG4gIGluZmVyU2NoZW1hOiB0cnVlLFxuICBjb2x1bW5SdWxlczogWy4uLkRFRkFVTFRfQ09MVU1OX1JVTEVTXSxcbn07XG5cbmV4cG9ydCBkZWZhdWx0IGNsYXNzIFppQmFzZVBsdWdpbiBleHRlbmRzIFBsdWdpbiB7XG4gIHNldHRpbmdzOiBaaUJhc2VTZXR0aW5ncyA9IERFRkFVTFRfU0VUVElOR1M7XG4gIHJlbmRlcmVyITogWmlCYXNlVGFibGVSZW5kZXJlcjtcblxuICBhc3luYyBvbmxvYWQoKTogUHJvbWlzZTx2b2lkPiB7XG4gICAgYXdhaXQgdGhpcy5sb2FkU2V0dGluZ3MoKTtcbiAgICB0aGlzLnJlbmRlcmVyID0gbmV3IFppQmFzZVRhYmxlUmVuZGVyZXIodGhpcy5hcHAsIHRoaXMpO1xuICAgIGlmICh0aGlzLnNldHRpbmdzLnJlbmRlckluUmVhZGluZ1ZpZXcpIHtcbiAgICAgIHRoaXMucmVnaXN0ZXJNYXJrZG93blBvc3RQcm9jZXNzb3IoKGVsZW1lbnQsIGNvbnRleHQpID0+IHtcbiAgICAgICAgdGhpcy5yZW5kZXJlci5wcm9jZXNzUmVhZGluZ1ZpZXcoZWxlbWVudCwgY29udGV4dCk7XG4gICAgICB9KTtcbiAgICB9XG4gICAgdGhpcy5hZGRDb21tYW5kKHtcbiAgICAgIGlkOiBcImluc2VydC10YWJsZVwiLFxuICAgICAgbmFtZTogXCJJbnNlcnQgYW5ub3RhdGVkIHRhYmxlXCIsXG4gICAgICBlZGl0b3JDYWxsYmFjazogKGVkaXRvcjogRWRpdG9yKSA9PiB7XG4gICAgICAgIGNvbnN0IHRlbXBsYXRlID0gW1xuICAgICAgICAgIFwifCBOYW1lIHwgU3RhdHVzIHwgUHJpb3JpdHkgfCBUYWdzIHxcIixcbiAgICAgICAgICBcInwtLS0tLS18LS0tLS0tLS18LS0tLS0tLS0tLXwtLS0tLS18XCIsXG4gICAgICAgICAgXCJ8IDwhLS0gemliYXNlOiB0ZXh0IC0tPiB8IDwhLS0gemliYXNlOiB0b2dnbGUgLS0+IHwgPCEtLSB6aWJhc2U6IHNlbGVjdDpMb3csTWVkaXVtLEhpZ2ggLS0+IHwgPCEtLSB6aWJhc2U6IGxhYmVsIC0tPiB8XCIsXG4gICAgICAgICAgXCJ8IEl0ZW0gMSB8IHRydWUgfCBIaWdoIHwgYmlvbG9neSB8XCIsXG4gICAgICAgICAgXCJ8IEl0ZW0gMiB8IGZhbHNlIHwgTG93IHwgY2hlbWlzdHJ5IHxcIixcbiAgICAgICAgXS5qb2luKFwiXFxuXCIpO1xuICAgICAgICBlZGl0b3IucmVwbGFjZVNlbGVjdGlvbih0ZW1wbGF0ZSk7XG4gICAgICB9LFxuICAgIH0pO1xuICAgIHRoaXMuYWRkQ29tbWFuZCh7XG4gICAgICBpZDogXCJpbnNlcnQtcGxhaW4tdGFibGVcIixcbiAgICAgIG5hbWU6IFwiSW5zZXJ0IHBsYWluIHRhYmxlIChhdXRvLWluZmVycmVkKVwiLFxuICAgICAgZWRpdG9yQ2FsbGJhY2s6IChlZGl0b3I6IEVkaXRvcikgPT4ge1xuICAgICAgICBjb25zdCB0ZW1wbGF0ZSA9IFtcbiAgICAgICAgICBcInwgTmFtZSB8IERvbmUgfCBTY29yZSB8IENhdGVnb3J5IHxcIixcbiAgICAgICAgICBcInwtLS0tLS18LS0tLS0tfC0tLS0tLS18LS0tLS0tLS0tLXxcIixcbiAgICAgICAgICBcInwgVGFzayBBIHwgdHJ1ZSB8IDkwIHwgV29yayB8XCIsXG4gICAgICAgICAgXCJ8IFRhc2sgQiB8IGZhbHNlIHwgNzUgfCBXb3JrIHxcIixcbiAgICAgICAgICBcInwgVGFzayBDIHwgdHJ1ZSB8IDgyIHwgUGVyc29uYWwgfFwiLFxuICAgICAgICBdLmpvaW4oXCJcXG5cIik7XG4gICAgICAgIGVkaXRvci5yZXBsYWNlU2VsZWN0aW9uKHRlbXBsYXRlKTtcbiAgICAgIH0sXG4gICAgfSk7XG4gICAgdGhpcy5hZGRDb21tYW5kKHtcbiAgICAgIGlkOiBcImluc2VydC1mb3JtdWxhLXRhYmxlXCIsXG4gICAgICBuYW1lOiBcIkluc2VydCB0YWJsZSB3aXRoIGZvcm11bGEgY29sdW1uXCIsXG4gICAgICBlZGl0b3JDYWxsYmFjazogKGVkaXRvcjogRWRpdG9yKSA9PiB7XG4gICAgICAgIGNvbnN0IHRlbXBsYXRlID0gW1xuICAgICAgICAgIFwifCBJdGVtIHwgUHJpY2UgfCBRdHkgfCBUb3RhbCB8XCIsXG4gICAgICAgICAgXCJ8LS0tLS0tfC0tLS0tLS18LS0tLS18LS0tLS0tLXxcIixcbiAgICAgICAgICBcInwgPCEtLSB6aWJhc2U6IHRleHQgLS0+IHwgPCEtLSB6aWJhc2U6IG51bWJlciAtLT4gfCA8IS0tIHppYmFzZTogbnVtYmVyIC0tPiB8IDwhLS0gemliYXNlOiBmb3JtdWxhOlByaWNlICogUXR5IC0tPiB8XCIsXG4gICAgICAgICAgXCJ8IFBlbiB8IDEwIHwgNSB8ICB8XCIsXG4gICAgICAgICAgXCJ8IEJvb2sgfCAyNTAgfCAyIHwgIHxcIixcbiAgICAgICAgICBcInwgRXJhc2VyIHwgNSB8IDEwIHwgIHxcIixcbiAgICAgICAgXS5qb2luKFwiXFxuXCIpO1xuICAgICAgICBlZGl0b3IucmVwbGFjZVNlbGVjdGlvbih0ZW1wbGF0ZSk7XG4gICAgICB9LFxuICAgIH0pO1xuICAgIHRoaXMuYWRkU2V0dGluZ1RhYihuZXcgWmlCYXNlU2V0dGluZ1RhYih0aGlzLmFwcCwgdGhpcykpO1xuICB9XG5cbiAgYXN5bmMgbG9hZFNldHRpbmdzKCk6IFByb21pc2U8dm9pZD4ge1xuICAgIHRoaXMuc2V0dGluZ3MgPSBPYmplY3QuYXNzaWduKHt9LCBERUZBVUxUX1NFVFRJTkdTLCBhd2FpdCB0aGlzLmxvYWREYXRhKCkpIGFzIFppQmFzZVNldHRpbmdzO1xuICAgIGlmICghdGhpcy5zZXR0aW5ncy5jb2x1bW5SdWxlcyB8fCB0aGlzLnNldHRpbmdzLmNvbHVtblJ1bGVzLmxlbmd0aCA9PT0gMCkge1xuICAgICAgdGhpcy5zZXR0aW5ncy5jb2x1bW5SdWxlcyA9IFsuLi5ERUZBVUxUX0NPTFVNTl9SVUxFU107XG4gICAgfVxuICB9XG5cbiAgYXN5bmMgc2F2ZVNldHRpbmdzKCk6IFByb21pc2U8dm9pZD4ge1xuICAgIGF3YWl0IHRoaXMuc2F2ZURhdGEodGhpcy5zZXR0aW5ncyk7XG4gIH1cbn1cblxuY2xhc3MgWmlCYXNlU2V0dGluZ1RhYiBleHRlbmRzIFBsdWdpblNldHRpbmdUYWIge1xuICBwbHVnaW46IFppQmFzZVBsdWdpbjtcblxuICBjb25zdHJ1Y3RvcihhcHA6IEFwcCwgcGx1Z2luOiBaaUJhc2VQbHVnaW4pIHtcbiAgICBzdXBlcihhcHAsIHBsdWdpbik7XG4gICAgdGhpcy5wbHVnaW4gPSBwbHVnaW47XG4gIH1cblxuICBkaXNwbGF5KCk6IHZvaWQge1xuICAgIGNvbnN0IHsgY29udGFpbmVyRWwgfSA9IHRoaXM7XG4gICAgY29udGFpbmVyRWwuZW1wdHkoKTtcbiAgICBuZXcgU2V0dGluZyhjb250YWluZXJFbCkuc2V0TmFtZShcIlppQmFzZSBcdTIwMTQgXHUwQkI0XHUwQkJGXHUwQkFGXHUwQkIyXHUwQkNEXCIpLnNldEhlYWRpbmcoKTtcbiAgICBjb250YWluZXJFbC5jcmVhdGVFbChcInBcIiwge1xuICAgICAgdGV4dDogXCJNYXJrZG93biB0YWJsZXMgYXMgbGl2aW5nIGRhdGFiYXNlcy5cIixcbiAgICAgIGNsczogXCJ6aWJhc2Utc2V0dGluZ3MtZGVzY1wiLFxuICAgIH0pO1xuICAgIG5ldyBTZXR0aW5nKGNvbnRhaW5lckVsKS5zZXROYW1lKFwiR2VuZXJhbFwiKS5zZXRIZWFkaW5nKCk7XG4gICAgbmV3IFNldHRpbmcoY29udGFpbmVyRWwpXG4gICAgICAuc2V0TmFtZShcIlJlbmRlciBpbiBSZWFkaW5nIFZpZXdcIilcbiAgICAgIC5zZXREZXNjKFwiU2hvdyByaWNoIFVJIHdoZW4gdmlld2luZyBub3RlcyBpbiByZWFkaW5nIG1vZGUuXCIpXG4gICAgICAuYWRkVG9nZ2xlKCh0KSA9PlxuICAgICAgICB0LnNldFZhbHVlKHRoaXMucGx1Z2luLnNldHRpbmdzLnJlbmRlckluUmVhZGluZ1ZpZXcpLm9uQ2hhbmdlKCh2KSA9PiB7XG4gICAgICAgICAgdm9pZCAoYXN5bmMgKCkgPT4ge1xuICAgICAgICAgICAgdGhpcy5wbHVnaW4uc2V0dGluZ3MucmVuZGVySW5SZWFkaW5nVmlldyA9IHY7XG4gICAgICAgICAgICBhd2FpdCB0aGlzLnBsdWdpbi5zYXZlU2V0dGluZ3MoKTtcbiAgICAgICAgICB9KSgpO1xuICAgICAgICB9KSxcbiAgICAgICk7XG4gICAgbmV3IFNldHRpbmcoY29udGFpbmVyRWwpXG4gICAgICAuc2V0TmFtZShcIkF1dG8taW5mZXIgc2NoZW1hXCIpXG4gICAgICAuc2V0RGVzYyhcIkF1dG9tYXRpY2FsbHkgZGV0ZWN0IGNvbHVtbiB0eXBlcyBmcm9tIHBsYWluIG1hcmtkb3duIHRhYmxlcy4gVHVybiBvZmYgdG8gb25seSBlbmhhbmNlIGFubm90YXRlZCB0YWJsZXMuXCIpXG4gICAgICAuYWRkVG9nZ2xlKCh0KSA9PlxuICAgICAgICB0LnNldFZhbHVlKHRoaXMucGx1Z2luLnNldHRpbmdzLmluZmVyU2NoZW1hKS5vbkNoYW5nZSgodikgPT4ge1xuICAgICAgICAgIHZvaWQgKGFzeW5jICgpID0+IHtcbiAgICAgICAgICAgIHRoaXMucGx1Z2luLnNldHRpbmdzLmluZmVyU2NoZW1hID0gdjtcbiAgICAgICAgICAgIGF3YWl0IHRoaXMucGx1Z2luLnNhdmVTZXR0aW5ncygpO1xuICAgICAgICAgIH0pKCk7XG4gICAgICAgIH0pLFxuICAgICAgKTtcbiAgICBuZXcgU2V0dGluZyhjb250YWluZXJFbCkuc2V0TmFtZShcIkNvbHVtbiBuYW1lIHJ1bGVzXCIpLnNldEhlYWRpbmcoKTtcbiAgICBjb250YWluZXJFbC5jcmVhdGVFbChcInBcIiwge1xuICAgICAgdGV4dDogXCJXaGVuIGEgY29sdW1uIG5hbWUgbWF0Y2hlcywgYXV0by1hc3NpZ24gdGhhdCB0eXBlLiBBcHBsaWVkIHRvIGFsbCBpbmZlcnJlZCB0YWJsZXMuXCIsXG4gICAgICBjbHM6IFwiemliYXNlLXNldHRpbmdzLWRlc2NcIixcbiAgICB9KTtcbiAgICBjb25zdCBydWxlc0NvbnRhaW5lciA9IGNvbnRhaW5lckVsLmNyZWF0ZURpdihcInppYmFzZS1ydWxlcy1jb250YWluZXJcIik7XG4gICAgdGhpcy5yZW5kZXJSdWxlcyhydWxlc0NvbnRhaW5lcik7XG4gICAgbmV3IFNldHRpbmcoY29udGFpbmVyRWwpLmFkZEJ1dHRvbigoYnRuKSA9PlxuICAgICAgYnRuLnNldEJ1dHRvblRleHQoXCIrIEFkZCBydWxlXCIpLnNldEN0YSgpLm9uQ2xpY2soKCkgPT4ge1xuICAgICAgICB2b2lkIChhc3luYyAoKSA9PiB7XG4gICAgICAgICAgdGhpcy5wbHVnaW4uc2V0dGluZ3MuY29sdW1uUnVsZXMucHVzaCh7IG5hbWU6IFwiXCIsIHR5cGU6IFwibGFiZWxcIiB9KTtcbiAgICAgICAgICBhd2FpdCB0aGlzLnBsdWdpbi5zYXZlU2V0dGluZ3MoKTtcbiAgICAgICAgICB0aGlzLnJlbmRlclJ1bGVzKHJ1bGVzQ29udGFpbmVyKTtcbiAgICAgICAgfSkoKTtcbiAgICAgIH0pLFxuICAgICk7XG4gICAgbmV3IFNldHRpbmcoY29udGFpbmVyRWwpXG4gICAgICAuc2V0TmFtZShcIlJlc2V0IHRvIGRlZmF1bHRzXCIpXG4gICAgICAuc2V0RGVzYyhcIlJlc3RvcmUgdGhlIG9yaWdpbmFsIGNvbHVtbiBuYW1lIHJ1bGVzLlwiKVxuICAgICAgLmFkZEJ1dHRvbigoYnRuKSA9PlxuICAgICAgICBidG4uc2V0QnV0dG9uVGV4dChcIlJlc2V0XCIpLnNldERlc3RydWN0aXZlKCkub25DbGljaygoKSA9PiB7XG4gICAgICAgICAgdm9pZCAoYXN5bmMgKCkgPT4ge1xuICAgICAgICAgICAgdGhpcy5wbHVnaW4uc2V0dGluZ3MuY29sdW1uUnVsZXMgPSBbLi4uREVGQVVMVF9DT0xVTU5fUlVMRVNdO1xuICAgICAgICAgICAgYXdhaXQgdGhpcy5wbHVnaW4uc2F2ZVNldHRpbmdzKCk7XG4gICAgICAgICAgICB0aGlzLnJlbmRlclJ1bGVzKHJ1bGVzQ29udGFpbmVyKTtcbiAgICAgICAgICB9KSgpO1xuICAgICAgICB9KSxcbiAgICAgICk7XG4gICAgbmV3IFNldHRpbmcoY29udGFpbmVyRWwpLnNldE5hbWUoXCJBYm91dFwiKS5zZXRIZWFkaW5nKCk7XG4gICAgY29udGFpbmVyRWwuY3JlYXRlRWwoXCJwXCIsIHsgdGV4dDogYFppQmFzZSB2JHtQTFVHSU5fVkVSU0lPTn0gXHUyMDE0IEJ1aWx0IGJ5IFJvaGl0aCBBIChaSVlBTClgLCBjbHM6IFwiemliYXNlLXNldHRpbmdzLWRlc2NcIiB9KTtcbiAgICBjb250YWluZXJFbC5jcmVhdGVFbChcInBcIiwgeyB0ZXh0OiBcIk1hcmtkb3duLW5hdGl2ZSBkYXRhYmFzZSBwbHVnaW4uXCIsIGNsczogXCJ6aWJhc2Utc2V0dGluZ3MtZGVzY1wiIH0pO1xuICB9XG5cbiAgcmVuZGVyUnVsZXMoY29udGFpbmVyOiBIVE1MRWxlbWVudCk6IHZvaWQge1xuICAgIGNvbnRhaW5lci5lbXB0eSgpO1xuICAgIHRoaXMucGx1Z2luLnNldHRpbmdzLmNvbHVtblJ1bGVzLmZvckVhY2goKHJ1bGU6IENvbHVtblJ1bGUsIGlkeDogbnVtYmVyKSA9PiB7XG4gICAgICBjb25zdCByb3cgPSBjb250YWluZXIuY3JlYXRlRGl2KFwiemliYXNlLXJ1bGUtcm93XCIpO1xuICAgICAgY29uc3QgbmFtZUlucHV0ID0gcm93LmNyZWF0ZUVsKFwiaW5wdXRcIiwgeyB0eXBlOiBcInRleHRcIiwgY2xzOiBcInppYmFzZS1ydWxlLW5hbWVcIiwgdmFsdWU6IHJ1bGUubmFtZSB9KTtcbiAgICAgIG5hbWVJbnB1dC5wbGFjZWhvbGRlciA9IFwiY29sdW1uIG5hbWVcIjtcbiAgICAgIG5hbWVJbnB1dC5hZGRFdmVudExpc3RlbmVyKFwiY2hhbmdlXCIsICgpID0+IHtcbiAgICAgICAgdm9pZCAoYXN5bmMgKCkgPT4ge1xuICAgICAgICAgIHRoaXMucGx1Z2luLnNldHRpbmdzLmNvbHVtblJ1bGVzW2lkeF0ubmFtZSA9IG5hbWVJbnB1dC52YWx1ZS50cmltKCk7XG4gICAgICAgICAgYXdhaXQgdGhpcy5wbHVnaW4uc2F2ZVNldHRpbmdzKCk7XG4gICAgICAgIH0pKCk7XG4gICAgICB9KTtcbiAgICAgIHJvdy5jcmVhdGVTcGFuKHsgdGV4dDogXCJcdTIxOTJcIiwgY2xzOiBcInppYmFzZS1ydWxlLWFycm93XCIgfSk7XG4gICAgICBjb25zdCB0eXBlU2VsZWN0ID0gcm93LmNyZWF0ZUVsKFwic2VsZWN0XCIsIHsgY2xzOiBcInppYmFzZS1ydWxlLXR5cGVcIiB9KTtcbiAgICAgIENPTFVNTl9UWVBFX09QVElPTlMuZm9yRWFjaCgodCkgPT4ge1xuICAgICAgICBjb25zdCBvcHQgPSB0eXBlU2VsZWN0LmNyZWF0ZUVsKFwib3B0aW9uXCIsIHsgdGV4dDogdCwgdmFsdWU6IHQgfSk7XG4gICAgICAgIGlmICh0ID09PSBydWxlLnR5cGUpIG9wdC5zZWxlY3RlZCA9IHRydWU7XG4gICAgICB9KTtcbiAgICAgIHR5cGVTZWxlY3QuYWRkRXZlbnRMaXN0ZW5lcihcImNoYW5nZVwiLCAoKSA9PiB7XG4gICAgICAgIHZvaWQgKGFzeW5jICgpID0+IHtcbiAgICAgICAgICB0aGlzLnBsdWdpbi5zZXR0aW5ncy5jb2x1bW5SdWxlc1tpZHhdLnR5cGUgPSB0eXBlU2VsZWN0LnZhbHVlO1xuICAgICAgICAgIGF3YWl0IHRoaXMucGx1Z2luLnNhdmVTZXR0aW5ncygpO1xuICAgICAgICB9KSgpO1xuICAgICAgfSk7XG4gICAgICBjb25zdCByZW1vdmVCdG4gPSByb3cuY3JlYXRlRWwoXCJidXR0b25cIiwgeyB0ZXh0OiBcIlx1MDBEN1wiLCBjbHM6IFwiemliYXNlLXJ1bGUtcmVtb3ZlXCIgfSk7XG4gICAgICByZW1vdmVCdG4uYWRkRXZlbnRMaXN0ZW5lcihcImNsaWNrXCIsICgpID0+IHtcbiAgICAgICAgdm9pZCAoYXN5bmMgKCkgPT4ge1xuICAgICAgICAgIHRoaXMucGx1Z2luLnNldHRpbmdzLmNvbHVtblJ1bGVzLnNwbGljZShpZHgsIDEpO1xuICAgICAgICAgIGF3YWl0IHRoaXMucGx1Z2luLnNhdmVTZXR0aW5ncygpO1xuICAgICAgICAgIHRoaXMucmVuZGVyUnVsZXMoY29udGFpbmVyKTtcbiAgICAgICAgfSkoKTtcbiAgICAgIH0pO1xuICAgIH0pO1xuICB9XG59XG4iLCAiaW1wb3J0IHR5cGUgeyBDb2x1bW5SdWxlLCBDb2x1bW5UeXBlLCBUYWJsZVNjaGVtYSwgVmlld05hbWUgfSBmcm9tIFwiLi9tb2RlbFwiO1xuXG5leHBvcnQgY29uc3QgQU5OT1RBVElPTl9SRSA9IC88IS0tXFxzKnppYmFzZTpcXHMqKFteXFxzPl0rKD86XFxzKlteXFxzPl0rKSopXFxzKi0tPi9pO1xuZXhwb3J0IGNvbnN0IFZJRVdfQU5OT1RBVElPTl9SRSA9IC88IS0tXFxzKnppYmFzZS12aWV3OlxccyooXFx3KykoPzo6KFtePl0rKSk/XFxzKi0tPi9pO1xuZXhwb3J0IGNvbnN0IERBVEVfUkUgPSAvXlxcZHs0fS1cXGR7Mn0tXFxkezJ9JC87XG5leHBvcnQgY29uc3QgTlVNQkVSX1JFID0gL14tP1xcZCsoXFwuXFxkKyk/JC87XG5cbmV4cG9ydCBjb25zdCBERUZBVUxUX0NPTFVNTl9SVUxFUzogQ29sdW1uUnVsZVtdID0gW1xuICB7IG5hbWU6IFwiZG9tYWluXCIsIHR5cGU6IFwibGFiZWxcIiB9LFxuICB7IG5hbWU6IFwiY2F0ZWdvcnlcIiwgdHlwZTogXCJsYWJlbFwiIH0sXG4gIHsgbmFtZTogXCJ0YWdcIiwgdHlwZTogXCJsYWJlbFwiIH0sXG4gIHsgbmFtZTogXCJ0YWdzXCIsIHR5cGU6IFwibXVsdGktc2VsZWN0XCIgfSxcbiAgeyBuYW1lOiBcInR5cGVcIiwgdHlwZTogXCJsYWJlbFwiIH0sXG4gIHsgbmFtZTogXCJsYWJlbFwiLCB0eXBlOiBcImxhYmVsXCIgfSxcbiAgeyBuYW1lOiBcImxhYmVsc1wiLCB0eXBlOiBcIm11bHRpLXNlbGVjdFwiIH0sXG4gIHsgbmFtZTogXCJkb25lXCIsIHR5cGU6IFwidG9nZ2xlXCIgfSxcbiAgeyBuYW1lOiBcImNvbXBsZXRlZFwiLCB0eXBlOiBcInRvZ2dsZVwiIH0sXG4gIHsgbmFtZTogXCJzdGF0dXNcIiwgdHlwZTogXCJzZWxlY3RcIiB9LFxuXTtcblxuZXhwb3J0IGZ1bmN0aW9uIHBhcnNlWmlCYXNlU2NoZW1hKFxuICBsaW5lczogc3RyaW5nW10sXG4gIGNvbHVtblJ1bGVzOiBDb2x1bW5SdWxlW10gPSBERUZBVUxUX0NPTFVNTl9SVUxFUyxcbik6IFRhYmxlU2NoZW1hIHwgbnVsbCB7XG4gIGlmIChsaW5lcy5sZW5ndGggPCAyKSByZXR1cm4gbnVsbDtcblxuICBjb25zdCBoZWFkZXJDZWxscyA9IHNwbGl0Um93KGxpbmVzWzBdKTtcbiAgaWYgKGhlYWRlckNlbGxzLmxlbmd0aCA9PT0gMCkgcmV0dXJuIG51bGw7XG5cbiAgaWYgKGxpbmVzLmxlbmd0aCA+PSAzKSB7XG4gICAgY29uc3Qgc2NoZW1hQ2VsbHMgPSBzcGxpdFJvdyhsaW5lc1syXSk7XG4gICAgY29uc3QgaGFzQW5ub3RhdGlvbnMgPSBzY2hlbWFDZWxscy5zb21lKChjKSA9PiBBTk5PVEFUSU9OX1JFLnRlc3QoYykpO1xuICAgIGlmIChoYXNBbm5vdGF0aW9ucykge1xuICAgICAgY29uc3QgY29sdW1ucyA9IGhlYWRlckNlbGxzLm1hcCgobmFtZSwgaSkgPT4ge1xuICAgICAgICBjb25zdCBjZWxsID0gc2NoZW1hQ2VsbHNbaV0gPz8gXCJcIjtcbiAgICAgICAgY29uc3QgbWF0Y2ggPSBjZWxsLm1hdGNoKEFOTk9UQVRJT05fUkUpO1xuICAgICAgICBjb25zdCB0eXBlU3RyID0gbWF0Y2ggPyBtYXRjaFsxXSA6IFwidGV4dFwiO1xuICAgICAgICByZXR1cm4geyBuYW1lOiBuYW1lLnRyaW0oKSwgdHlwZTogcGFyc2VUeXBlKHR5cGVTdHIpLCBpbmRleDogaSB9O1xuICAgICAgfSk7XG4gICAgICByZXR1cm4geyBjb2x1bW5zLCBzY2hlbWFSb3dJbmRleDogMiwgZGF0YVN0YXJ0SW5kZXg6IDMsIGluZmVycmVkOiBmYWxzZSB9O1xuICAgIH1cbiAgfVxuXG4gIGlmIChsaW5lcy5sZW5ndGggPCAzKSByZXR1cm4gbnVsbDtcblxuICBjb25zdCBkYXRhTGluZXMgPSBsaW5lcy5zbGljZSgyKS5maWx0ZXIoKGwpID0+IGwudHJpbSgpICYmIGwuaW5jbHVkZXMoXCJ8XCIpKTtcbiAgaWYgKGRhdGFMaW5lcy5sZW5ndGggPT09IDApIHJldHVybiBudWxsO1xuXG4gIGNvbnN0IGNvbFZhbHVlczogc3RyaW5nW11bXSA9IGhlYWRlckNlbGxzLm1hcCgoKSA9PiBbXSk7XG4gIGRhdGFMaW5lcy5mb3JFYWNoKChsaW5lKSA9PiB7XG4gICAgY29uc3QgY2VsbHMgPSBzcGxpdFJvdyhsaW5lKTtcbiAgICBoZWFkZXJDZWxscy5mb3JFYWNoKChfLCBpKSA9PiB7XG4gICAgICBjb25zdCB2ID0gKGNlbGxzW2ldID8/IFwiXCIpLnRyaW0oKTtcbiAgICAgIGlmICh2KSBjb2xWYWx1ZXNbaV0ucHVzaCh2KTtcbiAgICB9KTtcbiAgfSk7XG5cbiAgY29uc3QgY29sdW1ucyA9IGhlYWRlckNlbGxzLm1hcCgobmFtZSwgaSkgPT4gKHtcbiAgICBuYW1lOiBuYW1lLnRyaW0oKSxcbiAgICB0eXBlOiBpbmZlclR5cGUobmFtZS50cmltKCksIGNvbFZhbHVlc1tpXSwgY29sdW1uUnVsZXMpLFxuICAgIGluZGV4OiBpLFxuICB9KSk7XG4gIHJldHVybiB7IGNvbHVtbnMsIHNjaGVtYVJvd0luZGV4OiBudWxsLCBkYXRhU3RhcnRJbmRleDogMiwgaW5mZXJyZWQ6IHRydWUgfTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIHBhcnNlVmlld0Fubm90YXRpb24oXG4gIGxpbmVzOiBzdHJpbmdbXSxcbik6IHsgdmlldzogVmlld05hbWU7IGdyb3VwQnk6IHN0cmluZyB8IG51bGwgfSB8IG51bGwge1xuICBmb3IgKGxldCBpID0gMDsgaSA8IE1hdGgubWluKGxpbmVzLmxlbmd0aCwgMyk7IGkrKykge1xuICAgIGNvbnN0IG1hdGNoID0gbGluZXNbaV0ubWF0Y2goVklFV19BTk5PVEFUSU9OX1JFKTtcbiAgICBpZiAobWF0Y2gpIHtcbiAgICAgIHJldHVybiB7IHZpZXc6IG1hdGNoWzFdLnRvTG93ZXJDYXNlKCkgYXMgVmlld05hbWUsIGdyb3VwQnk6IG1hdGNoWzJdID8gbWF0Y2hbMl0udHJpbSgpIDogbnVsbCB9O1xuICAgIH1cbiAgfVxuICByZXR1cm4gbnVsbDtcbn1cblxuZnVuY3Rpb24gaW5mZXJUeXBlKGNvbE5hbWU6IHN0cmluZywgdmFsdWVzOiBzdHJpbmdbXSwgY29sdW1uUnVsZXM6IENvbHVtblJ1bGVbXSk6IENvbHVtblR5cGUge1xuICBpZiAodmFsdWVzLmxlbmd0aCA9PT0gMCkgcmV0dXJuIHsga2luZDogXCJ0ZXh0XCIgfTtcbiAgaWYgKHZhbHVlcy5ldmVyeSgodikgPT4gdi50b0xvd2VyQ2FzZSgpID09PSBcInRydWVcIiB8fCB2LnRvTG93ZXJDYXNlKCkgPT09IFwiZmFsc2VcIikpIHtcbiAgICByZXR1cm4geyBraW5kOiBcInRvZ2dsZVwiIH07XG4gIH1cbiAgaWYgKHZhbHVlcy5ldmVyeSgodikgPT4gREFURV9SRS50ZXN0KHYpKSkgcmV0dXJuIHsga2luZDogXCJkYXRlXCIgfTtcbiAgaWYgKHZhbHVlcy5ldmVyeSgodikgPT4gTlVNQkVSX1JFLnRlc3QodikpKSByZXR1cm4geyBraW5kOiBcIm51bWJlclwiIH07XG5cbiAgY29uc3QgcnVsZSA9IGNvbHVtblJ1bGVzLmZpbmQoKHIpID0+IHIubmFtZS50b0xvd2VyQ2FzZSgpID09PSBjb2xOYW1lLnRvTG93ZXJDYXNlKCkpO1xuICBpZiAocnVsZSkgcmV0dXJuIHBhcnNlVHlwZShydWxlLnR5cGUpO1xuXG4gIGNvbnN0IHVuaXF1ZSA9IFsuLi5uZXcgU2V0KHZhbHVlcy5tYXAoKHYpID0+IHYudG9Mb3dlckNhc2UoKSkpXTtcbiAgY29uc3QgYWxsU2hvcnQgPSB2YWx1ZXMuZXZlcnkoKHYpID0+IHYubGVuZ3RoIDw9IDIwKTtcbiAgY29uc3QgaXNSZXBlYXRlZCA9XG4gICAgdmFsdWVzLmxlbmd0aCA+PSAyICYmXG4gICAgdW5pcXVlLmxlbmd0aCA8PSBNYXRoLm1heCgyLCBNYXRoLmZsb29yKHZhbHVlcy5sZW5ndGggKiAwLjc1KSkgJiZcbiAgICB1bmlxdWUubGVuZ3RoIDw9IDEwO1xuICBpZiAoaXNSZXBlYXRlZCAmJiBhbGxTaG9ydCkge1xuICAgIGNvbnN0IHNlZW4gPSBuZXcgTWFwPHN0cmluZywgc3RyaW5nPigpO1xuICAgIHZhbHVlcy5mb3JFYWNoKCh2KSA9PiB7XG4gICAgICBpZiAoIXNlZW4uaGFzKHYudG9Mb3dlckNhc2UoKSkpIHNlZW4uc2V0KHYudG9Mb3dlckNhc2UoKSwgdik7XG4gICAgfSk7XG4gICAgcmV0dXJuIHsga2luZDogXCJzZWxlY3RcIiwgb3B0aW9uczogWy4uLnNlZW4udmFsdWVzKCldIH07XG4gIH1cbiAgcmV0dXJuIHsga2luZDogXCJ0ZXh0XCIgfTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIHBhcnNlVHlwZSh0eXBlU3RyOiBzdHJpbmcpOiBDb2x1bW5UeXBlIHtcbiAgaWYgKHR5cGVTdHIuc3RhcnRzV2l0aChcInNlbGVjdDpcIikpIHtcbiAgICBjb25zdCBvcHRpb25zID0gdHlwZVN0ci5zbGljZSg3KS5zcGxpdChcIixcIikubWFwKChzKSA9PiBzLnRyaW0oKSk7XG4gICAgcmV0dXJuIHsga2luZDogXCJzZWxlY3RcIiwgb3B0aW9ucyB9O1xuICB9XG4gIGlmICh0eXBlU3RyLnN0YXJ0c1dpdGgoXCJmb3JtdWxhOlwiKSkge1xuICAgIGNvbnN0IGV4cHJlc3Npb24gPSB0eXBlU3RyLnNsaWNlKDgpLnRyaW0oKTtcbiAgICByZXR1cm4geyBraW5kOiBcImZvcm11bGFcIiwgZXhwcmVzc2lvbiB9O1xuICB9XG4gIHN3aXRjaCAodHlwZVN0ci50b0xvd2VyQ2FzZSgpKSB7XG4gICAgY2FzZSBcInRvZ2dsZVwiOlxuICAgICAgcmV0dXJuIHsga2luZDogXCJ0b2dnbGVcIiB9O1xuICAgIGNhc2UgXCJsYWJlbFwiOlxuICAgICAgcmV0dXJuIHsga2luZDogXCJsYWJlbFwiIH07XG4gICAgY2FzZSBcIm11bHRpLXNlbGVjdFwiOlxuICAgIGNhc2UgXCJ0YWdzXCI6XG4gICAgICByZXR1cm4geyBraW5kOiBcIm11bHRpLXNlbGVjdFwiIH07XG4gICAgY2FzZSBcIm51bWJlclwiOlxuICAgICAgcmV0dXJuIHsga2luZDogXCJudW1iZXJcIiB9O1xuICAgIGNhc2UgXCJkYXRlXCI6XG4gICAgICByZXR1cm4geyBraW5kOiBcImRhdGVcIiB9O1xuICAgIGNhc2UgXCJzZWxlY3RcIjpcbiAgICAgIHJldHVybiB7IGtpbmQ6IFwic2VsZWN0XCIsIG9wdGlvbnM6IFtdIH07XG4gICAgY2FzZSBcImZvcm11bGFcIjpcbiAgICAgIHJldHVybiB7IGtpbmQ6IFwiZm9ybXVsYVwiLCBleHByZXNzaW9uOiBcIlwiIH07XG4gICAgZGVmYXVsdDpcbiAgICAgIHJldHVybiB7IGtpbmQ6IFwidGV4dFwiIH07XG4gIH1cbn1cblxuZXhwb3J0IGZ1bmN0aW9uIHNwbGl0Um93KHJvdzogc3RyaW5nKTogc3RyaW5nW10ge1xuICBjb25zdCBzdHJpcHBlZCA9IHJvdy5yZXBsYWNlKC9eXFx8fFxcfCQvZywgXCJcIik7XG4gIGNvbnN0IGNlbGxzOiBzdHJpbmdbXSA9IFtdO1xuICBsZXQgY3VycmVudCA9IFwiXCI7XG4gIGZvciAobGV0IGkgPSAwOyBpIDwgc3RyaXBwZWQubGVuZ3RoOyBpKyspIHtcbiAgICBpZiAoc3RyaXBwZWRbaV0gPT09IFwiXFxcXFwiICYmIHN0cmlwcGVkW2kgKyAxXSA9PT0gXCJ8XCIpIHtcbiAgICAgIGN1cnJlbnQgKz0gXCJ8XCI7XG4gICAgICBpKys7XG4gICAgfSBlbHNlIGlmIChzdHJpcHBlZFtpXSA9PT0gXCJ8XCIpIHtcbiAgICAgIGNlbGxzLnB1c2goY3VycmVudC50cmltKCkpO1xuICAgICAgY3VycmVudCA9IFwiXCI7XG4gICAgfSBlbHNlIHtcbiAgICAgIGN1cnJlbnQgKz0gc3RyaXBwZWRbaV07XG4gICAgfVxuICB9XG4gIGNlbGxzLnB1c2goY3VycmVudC50cmltKCkpO1xuICByZXR1cm4gY2VsbHM7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBzZXJpYWxpemVSb3coY2VsbHM6IHN0cmluZ1tdKTogc3RyaW5nIHtcbiAgcmV0dXJuIFwifCBcIiArIGNlbGxzLmpvaW4oXCIgfCBcIikgKyBcIiB8XCI7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBwYXJzZUJvb2wodmFsOiBzdHJpbmcpOiBib29sZWFuIHtcbiAgcmV0dXJuIHZhbC50cmltKCkudG9Mb3dlckNhc2UoKSA9PT0gXCJ0cnVlXCI7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBzZXJpYWxpemVCb29sKHZhbDogYm9vbGVhbik6IHN0cmluZyB7XG4gIHJldHVybiB2YWwgPyBcInRydWVcIiA6IFwiZmFsc2VcIjtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIHBhcnNlTXVsdGlTZWxlY3QodmFsOiBzdHJpbmcpOiBzdHJpbmdbXSB7XG4gIGlmICghdmFsKSByZXR1cm4gW107XG4gIHJldHVybiB2YWwuc3BsaXQoXCIsXCIpLm1hcCgocykgPT4gcy50cmltKCkpLmZpbHRlcigocykgPT4gcy5sZW5ndGggPiAwKTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGlzRGF0YVJvdyhsaW5lOiBzdHJpbmcpOiBib29sZWFuIHtcbiAgcmV0dXJuIEJvb2xlYW4obGluZS50cmltKCkgJiYgbGluZS5pbmNsdWRlcyhcInxcIikgJiYgIS88IS0tXFxzKnppYmFzZTovLnRlc3QobGluZSkgJiYgIS88IS0tXFxzKnppYmFzZS12aWV3Oi8udGVzdChsaW5lKSk7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBmaWx0ZXJEYXRhUm93cyhyb3dzOiBzdHJpbmdbXSwgcXVlcnk6IHN0cmluZyk6IHN0cmluZ1tdIHtcbiAgaWYgKCFxdWVyeSkgcmV0dXJuIHJvd3M7XG4gIGNvbnN0IHEgPSBxdWVyeS50b0xvd2VyQ2FzZSgpO1xuICByZXR1cm4gcm93cy5maWx0ZXIoKGxpbmUpID0+IHNwbGl0Um93KGxpbmUpLnNvbWUoKGNlbGwpID0+IGNlbGwudG9Mb3dlckNhc2UoKS5pbmNsdWRlcyhxKSkpO1xufVxuIiwgImltcG9ydCB7XG4gIE1hcmtkb3duUmVuZGVyZXIsXG4gIHNldEljb24sXG4gIFRGaWxlLFxuICB0eXBlIEFwcCxcbiAgdHlwZSBNYXJrZG93blBvc3RQcm9jZXNzb3JDb250ZXh0LFxuICB0eXBlIE1hcmtkb3duU2VjdGlvbkluZm9ybWF0aW9uLFxufSBmcm9tIFwib2JzaWRpYW5cIjtcbmltcG9ydCB7IHJlbmRlckNlbGwgfSBmcm9tIFwiLi9jZWxsc1wiO1xuaW1wb3J0IHsgRm9ybXVsYUlucHV0TW9kYWwsIFNlbGVjdE9wdGlvbnNNb2RhbCB9IGZyb20gXCIuL21vZGFsc1wiO1xuaW1wb3J0IHtcbiAgaXNEYXRhUm93LFxuICBwYXJzZVppQmFzZVNjaGVtYSxcbiAgcGFyc2VWaWV3QW5ub3RhdGlvbixcbiAgc2VyaWFsaXplUm93LFxuICBzcGxpdFJvdyxcbiAgcGFyc2VCb29sLFxuICBWSUVXX0FOTk9UQVRJT05fUkUsXG59IGZyb20gXCIuL3NjaGVtYVwiO1xuaW1wb3J0IHR5cGUge1xuICBDZWxsQ2hhbmdlSGFuZGxlcixcbiAgQ29sdW1uLFxuICBUYWJsZVNjaGVtYSxcbiAgVmlld05hbWUsXG4gIFppQmFzZUhvc3QsXG4gIFppQmFzZVBsdWdpbkxpa2UsXG59IGZyb20gXCIuL3R5cGVzXCI7XG5pbXBvcnQgeyBDT0xVTU5fVFlQRV9PUFRJT05TIH0gZnJvbSBcIi4vdHlwZXNcIjtcbmltcG9ydCB7IGF0dGFjaExpbmtUb29sdGlwLCBzaG93VG9hc3QgfSBmcm9tIFwiLi91aVwiO1xuaW1wb3J0IHsgYnVpbGRDYWxlbmRhclZpZXcgfSBmcm9tIFwiLi92aWV3cy9jYWxlbmRhclwiO1xuaW1wb3J0IHsgYnVpbGRHYWxsZXJ5VmlldyB9IGZyb20gXCIuL3ZpZXdzL2dhbGxlcnlcIjtcbmltcG9ydCB7IGJ1aWxkS2FuYmFuVmlldyB9IGZyb20gXCIuL3ZpZXdzL2thbmJhblwiO1xuaW1wb3J0IHsgYnVpbGRUYWJsZVZpZXcgfSBmcm9tIFwiLi92aWV3cy90YWJsZVwiO1xuXG5pbnRlcmZhY2UgQXBwV2l0aFNldHRpbmdzIGV4dGVuZHMgQXBwIHtcbiAgc2V0dGluZzogeyBvcGVuOiAoKSA9PiB2b2lkOyBvcGVuVGFiQnlJZDogKGlkOiBzdHJpbmcpID0+IHZvaWQgfTtcbn1cblxuZXhwb3J0IGNsYXNzIFppQmFzZVRhYmxlUmVuZGVyZXIgaW1wbGVtZW50cyBaaUJhc2VIb3N0IHtcbiAgYXBwOiBBcHA7XG4gIHBsdWdpbjogWmlCYXNlUGx1Z2luTGlrZTtcblxuICBjb25zdHJ1Y3RvcihhcHA6IEFwcCwgcGx1Z2luOiBaaUJhc2VQbHVnaW5MaWtlKSB7XG4gICAgdGhpcy5hcHAgPSBhcHA7XG4gICAgdGhpcy5wbHVnaW4gPSBwbHVnaW47XG4gIH1cblxuICBwcm9jZXNzUmVhZGluZ1ZpZXcoZWxlbWVudDogSFRNTEVsZW1lbnQsIGNvbnRleHQ6IE1hcmtkb3duUG9zdFByb2Nlc3NvckNvbnRleHQpOiB2b2lkIHtcbiAgICBlbGVtZW50LnF1ZXJ5U2VsZWN0b3JBbGwoXCJ0YWJsZVwiKS5mb3JFYWNoKCh0YWJsZSkgPT4gdGhpcy50cnlSZW5kZXJUYWJsZSh0YWJsZSwgY29udGV4dCkpO1xuICB9XG5cbiAgdHJ5UmVuZGVyVGFibGUodGFibGU6IEhUTUxUYWJsZUVsZW1lbnQsIGNvbnRleHQ6IE1hcmtkb3duUG9zdFByb2Nlc3NvckNvbnRleHQpOiB2b2lkIHtcbiAgICBjb25zdCBzZWN0aW9uSW5mbyA9IGNvbnRleHQuZ2V0U2VjdGlvbkluZm8odGFibGUpO1xuICAgIGlmICghc2VjdGlvbkluZm8pIHJldHVybjtcbiAgICBjb25zdCBsaW5lcyA9IHNlY3Rpb25JbmZvLnRleHQuc3BsaXQoXCJcXG5cIikuc2xpY2Uoc2VjdGlvbkluZm8ubGluZVN0YXJ0LCBzZWN0aW9uSW5mby5saW5lRW5kICsgMSk7XG4gICAgY29uc3Qgc2NoZW1hID0gcGFyc2VaaUJhc2VTY2hlbWEobGluZXMsIHRoaXMucGx1Z2luLnNldHRpbmdzLmNvbHVtblJ1bGVzKTtcbiAgICBpZiAoIXNjaGVtYSkgcmV0dXJuO1xuICAgIGlmIChzY2hlbWEuaW5mZXJyZWQgJiYgIXRoaXMucGx1Z2luLnNldHRpbmdzLmluZmVyU2NoZW1hKSByZXR1cm47XG4gICAgdGFibGUucmVwbGFjZVdpdGgodGhpcy5idWlsZFJpY2hUYWJsZShzY2hlbWEsIGxpbmVzLCBjb250ZXh0LCBzZWN0aW9uSW5mbykpO1xuICB9XG5cbiAgYnVpbGRSaWNoVGFibGUoXG4gICAgc2NoZW1hOiBUYWJsZVNjaGVtYSxcbiAgICBsaW5lczogc3RyaW5nW10sXG4gICAgY29udGV4dDogTWFya2Rvd25Qb3N0UHJvY2Vzc29yQ29udGV4dCxcbiAgICBzZWN0aW9uSW5mbzogTWFya2Rvd25TZWN0aW9uSW5mb3JtYXRpb24sXG4gICk6IEhUTUxFbGVtZW50IHtcbiAgICBsZXQgY3VycmVudFZpZXc6IFZpZXdOYW1lID0gXCJ0YWJsZVwiO1xuICAgIGxldCBjb2xsYXBzZWQgPSBmYWxzZTtcbiAgICBsZXQgZmlsdGVyUXVlcnkgPSBcIlwiO1xuICAgIGxldCBzb3J0Q29sSWR4OiBudW1iZXIgfCBudWxsID0gbnVsbDtcbiAgICBsZXQgc29ydEFzYyA9IHRydWU7XG4gICAgY29uc3QgcmF3RGF0YUxpbmVzID0gbGluZXMuc2xpY2Uoc2NoZW1hLmRhdGFTdGFydEluZGV4KTtcblxuICAgIGNvbnN0IHZpZXdBbm5vdGF0aW9uID0gcGFyc2VWaWV3QW5ub3RhdGlvbihsaW5lcyk7XG4gICAgaWYgKHZpZXdBbm5vdGF0aW9uKSBjdXJyZW50VmlldyA9IHZpZXdBbm5vdGF0aW9uLnZpZXc7XG5cbiAgICBjb25zdCBnZXREYXRhUm93cyA9ICgpID0+IHJhd0RhdGFMaW5lcy5maWx0ZXIoaXNEYXRhUm93KTtcbiAgICBjb25zdCB3cmFwcGVyID0gY3JlYXRlRGl2KCk7XG4gICAgd3JhcHBlci5jbGFzc05hbWUgPSBcInppYmFzZS13cmFwcGVyXCI7XG4gICAgY29uc3QgdG9wYmFyID0gd3JhcHBlci5jcmVhdGVEaXYoXCJ6aWJhc2UtdG9wYmFyXCIpO1xuICAgIGNvbnN0IGNvbGxhcHNlQnRuID0gdG9wYmFyLmNyZWF0ZUVsKFwiYnV0dG9uXCIsIHsgY2xzOiBcInppYmFzZS1jb2xsYXBzZS1idG5cIiB9KTtcbiAgICBzZXRJY29uKGNvbGxhcHNlQnRuLCBcImNoZXZyb24tcmlnaHRcIik7XG4gICAgY29uc3QgdG9wTGVmdCA9IHRvcGJhci5jcmVhdGVEaXYoXCJ6aWJhc2UtdG9wYmFyLWxlZnRcIik7XG4gICAgdG9wTGVmdC5jcmVhdGVTcGFuKHsgdGV4dDogXCJcdTI3QzFcIiwgY2xzOiBcInppYmFzZS1sb2dvXCIgfSk7XG4gICAgY29uc3QgemliYXNlTmFtZSA9IHRvcExlZnQuY3JlYXRlU3Bhbih7IHRleHQ6IFwiWmlCYXNlXCIsIGNsczogXCJ6aWJhc2UtbmFtZSB6aWJhc2UtbmFtZS1idG5cIiB9KTtcbiAgICBjb25zdCBiYWRnZSA9IHRvcExlZnQuY3JlYXRlU3Bhbih7XG4gICAgICBjbHM6IHNjaGVtYS5pbmZlcnJlZCA/IFwiemliYXNlLWluZmVycmVkLWJhZGdlXCIgOiBcInppYmFzZS1hbm5vdGF0ZWQtYmFkZ2VcIixcbiAgICAgIHRleHQ6IHNjaGVtYS5pbmZlcnJlZCA/IFwiaW5mZXJyZWRcIiA6IFwiYW5ub3RhdGVkXCIsXG4gICAgfSk7XG4gICAgY29uc3QgdG9wUmlnaHQgPSB0b3BiYXIuY3JlYXRlRGl2KFwiemliYXNlLXRvcGJhci1yaWdodFwiKTtcbiAgICBjb25zdCBzZWFyY2hXcmFwID0gdG9wUmlnaHQuY3JlYXRlRGl2KFwiemliYXNlLXNlYXJjaC13cmFwXCIpO1xuICAgIGNvbnN0IHNlYXJjaEljb24gPSBzZWFyY2hXcmFwLmNyZWF0ZVNwYW4oeyBjbHM6IFwiemliYXNlLXNlYXJjaC1pY29uXCIgfSk7XG4gICAgc2V0SWNvbihzZWFyY2hJY29uLCBcInNlYXJjaFwiKTtcbiAgICBjb25zdCBzZWFyY2hJbnB1dCA9IHNlYXJjaFdyYXAuY3JlYXRlRWwoXCJpbnB1dFwiLCB7IGNsczogXCJ6aWJhc2Utc2VhcmNoXCIsIHR5cGU6IFwidGV4dFwiIH0pO1xuICAgIHNlYXJjaElucHV0LnBsYWNlaG9sZGVyID0gXCJGaWx0ZXJcdTIwMjZcIjtcbiAgICB6aWJhc2VOYW1lLmFkZEV2ZW50TGlzdGVuZXIoXCJjbGlja1wiLCAoZSkgPT4ge1xuICAgICAgZS5zdG9wUHJvcGFnYXRpb24oKTtcbiAgICAgIHRoaXMuc2hvd1ppQmFzZU1lbnUoZSwgc2NoZW1hLCBsaW5lcywgY29udGV4dCwgc2VjdGlvbkluZm8sIHJhd0RhdGFMaW5lcywgYmFkZ2UsIGN1cnJlbnRWaWV3LCAobmV3VmlldykgPT4ge1xuICAgICAgICBjdXJyZW50VmlldyA9IG5ld1ZpZXc7XG4gICAgICAgIHJlbmRlclZpZXdDb250ZW50KCk7XG4gICAgICB9KTtcbiAgICB9KTtcbiAgICBjb25zdCBib2R5ID0gd3JhcHBlci5jcmVhdGVEaXYoXCJ6aWJhc2UtYm9keVwiKTtcblxuICAgIGNvbnN0IGZvb3RlciA9IGJvZHkuY3JlYXRlRGl2KFwiemliYXNlLWZvb3RlclwiKTtcbiAgICBjb25zdCBhZGRSb3dCdG4gPSBmb290ZXIuY3JlYXRlRWwoXCJidXR0b25cIiwgeyBjbHM6IFwiemliYXNlLWFkZC1yb3ctYnRuXCIgfSk7XG4gICAgc2V0SWNvbihhZGRSb3dCdG4sIFwicGx1c1wiKTtcbiAgICBhZGRSb3dCdG4uYXBwZW5kVGV4dChcIiBBZGQgcm93XCIpO1xuICAgIGFkZFJvd0J0bi5hZGRFdmVudExpc3RlbmVyKFwiY2xpY2tcIiwgKCkgPT4ge1xuICAgICAgdm9pZCB0aGlzLmFkZFJvdyhjb250ZXh0LCBzZWN0aW9uSW5mbywgc2NoZW1hKTtcbiAgICB9KTtcbiAgICBjb25zdCByb3dDb3VudCA9IGZvb3Rlci5jcmVhdGVTcGFuKHsgY2xzOiBcInppYmFzZS1yb3ctY291bnRcIiB9KTtcbiAgICBjb25zdCB1cGRhdGVDb3VudCA9ICgpID0+IHtcbiAgICAgIGNvbnN0IHRvdGFsID0gZ2V0RGF0YVJvd3MoKS5sZW5ndGg7XG4gICAgICBjb25zdCB2aXNpYmxlID0gZmlsdGVyUXVlcnlcbiAgICAgICAgPyBnZXREYXRhUm93cygpLmZpbHRlcigobCkgPT4gc3BsaXRSb3cobCkuc29tZSgoYykgPT4gYy50b0xvd2VyQ2FzZSgpLmluY2x1ZGVzKGZpbHRlclF1ZXJ5LnRvTG93ZXJDYXNlKCkpKSkubGVuZ3RoXG4gICAgICAgIDogdG90YWw7XG4gICAgICByb3dDb3VudC50ZXh0Q29udGVudCA9IGZpbHRlclF1ZXJ5ICYmIHZpc2libGUgIT09IHRvdGFsID8gYCR7dmlzaWJsZX0gLyAke3RvdGFsfSByb3dzYCA6IGAke3RvdGFsfSByb3dzYDtcbiAgICB9O1xuXG4gICAgY29uc3QgcmVuZGVyVmlld0NvbnRlbnQgPSAoKSA9PiB7XG4gICAgICBib2R5LnF1ZXJ5U2VsZWN0b3JBbGwoXCIuemliYXNlLXRhYmxlLCAuemliYXNlLWthbmJhbiwgLnppYmFzZS1nYWxsZXJ5LCAuemliYXNlLWNhbGVuZGFyXCIpLmZvckVhY2goKGVsKSA9PiBlbC5yZW1vdmUoKSk7XG4gICAgICBjb25zdCB2aWV3Q29udGFpbmVyID0gY3JlYXRlRGl2KCk7XG4gICAgICBzd2l0Y2ggKGN1cnJlbnRWaWV3KSB7XG4gICAgICAgIGNhc2UgXCJrYW5iYW5cIjpcbiAgICAgICAgICBidWlsZEthbmJhblZpZXcodGhpcywgdmlld0NvbnRhaW5lciwgc2NoZW1hLCBnZXREYXRhUm93cywgcmF3RGF0YUxpbmVzLCBjb250ZXh0LCBzZWN0aW9uSW5mbywgZmlsdGVyUXVlcnkpO1xuICAgICAgICAgIGJyZWFrO1xuICAgICAgICBjYXNlIFwiZ2FsbGVyeVwiOlxuICAgICAgICAgIGJ1aWxkR2FsbGVyeVZpZXcodGhpcywgdmlld0NvbnRhaW5lciwgc2NoZW1hLCBnZXREYXRhUm93cywgcmF3RGF0YUxpbmVzLCBjb250ZXh0LCBzZWN0aW9uSW5mbywgZmlsdGVyUXVlcnkpO1xuICAgICAgICAgIGJyZWFrO1xuICAgICAgICBjYXNlIFwiY2FsZW5kYXJcIjpcbiAgICAgICAgICBidWlsZENhbGVuZGFyVmlldyh0aGlzLCB2aWV3Q29udGFpbmVyLCBzY2hlbWEsIGdldERhdGFSb3dzLCByYXdEYXRhTGluZXMsIGNvbnRleHQsIHNlY3Rpb25JbmZvLCBmaWx0ZXJRdWVyeSk7XG4gICAgICAgICAgYnJlYWs7XG4gICAgICAgIGRlZmF1bHQ6XG4gICAgICAgICAgYnVpbGRUYWJsZVZpZXcoXG4gICAgICAgICAgICB0aGlzLFxuICAgICAgICAgICAgdmlld0NvbnRhaW5lcixcbiAgICAgICAgICAgIHNjaGVtYSxcbiAgICAgICAgICAgIGdldERhdGFSb3dzLFxuICAgICAgICAgICAgcmF3RGF0YUxpbmVzLFxuICAgICAgICAgICAgY29udGV4dCxcbiAgICAgICAgICAgIHNlY3Rpb25JbmZvLFxuICAgICAgICAgICAgZmlsdGVyUXVlcnksXG4gICAgICAgICAgICBzb3J0Q29sSWR4LFxuICAgICAgICAgICAgc29ydEFzYyxcbiAgICAgICAgICAgIGJhZGdlLFxuICAgICAgICAgICAgKGNvbCwgYXNjKSA9PiB7XG4gICAgICAgICAgICAgIHNvcnRDb2xJZHggPSBjb2w7XG4gICAgICAgICAgICAgIHNvcnRBc2MgPSBhc2M7XG4gICAgICAgICAgICB9LFxuICAgICAgICAgICk7XG4gICAgICAgICAgYnJlYWs7XG4gICAgICB9XG4gICAgICB3aGlsZSAodmlld0NvbnRhaW5lci5maXJzdENoaWxkKSB7XG4gICAgICAgIGJvZHkuaW5zZXJ0QmVmb3JlKHZpZXdDb250YWluZXIuZmlyc3RDaGlsZCwgZm9vdGVyKTtcbiAgICAgIH1cbiAgICB9O1xuXG4gICAgcmVuZGVyVmlld0NvbnRlbnQoKTtcbiAgICB1cGRhdGVDb3VudCgpO1xuICAgIGNvbGxhcHNlQnRuLmFkZEV2ZW50TGlzdGVuZXIoXCJjbGlja1wiLCAoKSA9PiB7XG4gICAgICBjb2xsYXBzZWQgPSAhY29sbGFwc2VkO1xuICAgICAgYm9keS5jbGFzc0xpc3QudG9nZ2xlKFwiemliYXNlLWJvZHktY29sbGFwc2VkXCIsIGNvbGxhcHNlZCk7XG4gICAgICBjb2xsYXBzZUJ0bi5jbGFzc0xpc3QudG9nZ2xlKFwiemliYXNlLWNvbGxhcHNlZFwiLCBjb2xsYXBzZWQpO1xuICAgIH0pO1xuICAgIHNlYXJjaElucHV0LmFkZEV2ZW50TGlzdGVuZXIoXCJpbnB1dFwiLCAoKSA9PiB7XG4gICAgICBmaWx0ZXJRdWVyeSA9IHNlYXJjaElucHV0LnZhbHVlLnRyaW0oKTtcbiAgICAgIHJlbmRlclZpZXdDb250ZW50KCk7XG4gICAgICB1cGRhdGVDb3VudCgpO1xuICAgIH0pO1xuICAgIHJldHVybiB3cmFwcGVyO1xuICB9XG5cbiAgc2hvd1ppQmFzZU1lbnUoXG4gICAgZTogTW91c2VFdmVudCxcbiAgICBzY2hlbWE6IFRhYmxlU2NoZW1hLFxuICAgIGxpbmVzOiBzdHJpbmdbXSxcbiAgICBjb250ZXh0OiBNYXJrZG93blBvc3RQcm9jZXNzb3JDb250ZXh0LFxuICAgIHNlY3Rpb25JbmZvOiBNYXJrZG93blNlY3Rpb25JbmZvcm1hdGlvbixcbiAgICBfcmF3RGF0YUxpbmVzOiBzdHJpbmdbXSxcbiAgICBfYmFkZ2U6IEhUTUxFbGVtZW50LFxuICAgIGN1cnJlbnRWaWV3OiBWaWV3TmFtZSxcbiAgICBvblZpZXdDaGFuZ2U6ICh2aWV3OiBWaWV3TmFtZSkgPT4gdm9pZCxcbiAgKTogdm9pZCB7XG4gICAgZG9jdW1lbnQucXVlcnlTZWxlY3RvckFsbChcIi56aWJhc2UtZHJvcGRvd25cIikuZm9yRWFjaCgobSkgPT4gbS5yZW1vdmUoKSk7XG4gICAgY29uc3QgbWVudSA9IGNyZWF0ZURpdigpO1xuICAgIG1lbnUuY2xhc3NOYW1lID0gXCJ6aWJhc2UtZHJvcGRvd25cIjtcbiAgICBjb25zdCB0YXJnZXQgPSBlLnRhcmdldCBhcyBIVE1MRWxlbWVudDtcbiAgICBjb25zdCByZWN0ID0gdGFyZ2V0LmdldEJvdW5kaW5nQ2xpZW50UmVjdCgpO1xuICAgIG1lbnUuc2V0Q3NzU3R5bGVzKHsgdG9wOiBgJHtyZWN0LmJvdHRvbSArIHdpbmRvdy5zY3JvbGxZICsgNH1weGAgfSk7XG4gICAgbWVudS5zZXRDc3NTdHlsZXMoeyBsZWZ0OiBgJHtyZWN0LmxlZnQgKyB3aW5kb3cuc2Nyb2xsWH1weGAgfSk7XG4gICAgY29uc3QgY29udHJvbGxlciA9IG5ldyBBYm9ydENvbnRyb2xsZXIoKTtcbiAgICBjb25zdCBjbG9zZU1lbnUgPSAoKSA9PiB7XG4gICAgICBtZW51LnJlbW92ZSgpO1xuICAgICAgY29udHJvbGxlci5hYm9ydCgpO1xuICAgIH07XG5cbiAgICBjb25zdCBleHBvcnRJdGVtID0gbWVudS5jcmVhdGVEaXYoXCJ6aWJhc2UtZHJvcGRvd24taXRlbSB6aWJhc2UtZHJvcGRvd24taGFzLXN1YlwiKTtcbiAgICBleHBvcnRJdGVtLmNyZWF0ZVNwYW4oeyB0ZXh0OiBcIkV4cG9ydFwiLCBjbHM6IFwiemliYXNlLWRyb3Bkb3duLWxhYmVsXCIgfSk7XG4gICAgZXhwb3J0SXRlbS5jcmVhdGVTcGFuKHsgdGV4dDogXCJcdTI1QjZcIiwgY2xzOiBcInppYmFzZS1kcm9wZG93bi1hcnJvd1wiIH0pO1xuICAgIGNvbnN0IGV4cG9ydFN1YiA9IGV4cG9ydEl0ZW0uY3JlYXRlRGl2KFwiemliYXNlLWRyb3Bkb3duLXN1YlwiKTtcbiAgICBjb25zdCBleHBvcnRPcHRpb25zID0gW1xuICAgICAgeyBpY29uOiBcIlx1RDgzRFx1RENDQlwiLCBsYWJlbDogXCJDb3B5IGFzIE1hcmtkb3duXCIsIGFjdGlvbjogKCkgPT4gdGhpcy5jb3B5QXNNYXJrZG93bihzY2hlbWEsIGxpbmVzKSB9LFxuICAgICAgeyBpY29uOiBcIlx1RDgzRFx1RENFNFwiLCBsYWJlbDogXCJFeHBvcnQgYXMgQ1NWXCIsIGFjdGlvbjogKCkgPT4gdm9pZCB0aGlzLmV4cG9ydENTVihzY2hlbWEsIGxpbmVzLCBjb250ZXh0KSB9LFxuICAgICAgeyBpY29uOiBcIlx1RDgzRFx1RERDNFx1RkUwRlwiLCBsYWJlbDogXCJFeHBvcnQgYXMgSlNPTlwiLCBhY3Rpb246ICgpID0+IHZvaWQgdGhpcy5leHBvcnRKU09OKHNjaGVtYSwgbGluZXMsIGNvbnRleHQpIH0sXG4gICAgXTtcbiAgICBleHBvcnRPcHRpb25zLmZvckVhY2goKHsgaWNvbiwgbGFiZWwsIGFjdGlvbiB9KSA9PiB7XG4gICAgICBjb25zdCBpdGVtID0gZXhwb3J0U3ViLmNyZWF0ZURpdihcInppYmFzZS1kcm9wZG93bi1zdWJpdGVtXCIpO1xuICAgICAgaXRlbS5jcmVhdGVTcGFuKHsgdGV4dDogaWNvbiwgY2xzOiBcInppYmFzZS1kcm9wZG93bi1pY29uXCIgfSk7XG4gICAgICBpdGVtLmNyZWF0ZVNwYW4oeyB0ZXh0OiBsYWJlbCB9KTtcbiAgICAgIGl0ZW0uYWRkRXZlbnRMaXN0ZW5lcihcImNsaWNrXCIsICgpID0+IHtcbiAgICAgICAgY2xvc2VNZW51KCk7XG4gICAgICAgIGFjdGlvbigpO1xuICAgICAgfSk7XG4gICAgfSk7XG5cbiAgICBjb25zdCB2aWV3SXRlbSA9IG1lbnUuY3JlYXRlRGl2KFwiemliYXNlLWRyb3Bkb3duLWl0ZW0gemliYXNlLWRyb3Bkb3duLWhhcy1zdWJcIik7XG4gICAgdmlld0l0ZW0uY3JlYXRlU3Bhbih7IHRleHQ6IFwiVmlld1wiLCBjbHM6IFwiemliYXNlLWRyb3Bkb3duLWxhYmVsXCIgfSk7XG4gICAgdmlld0l0ZW0uY3JlYXRlU3Bhbih7IHRleHQ6IFwiXHUyNUI2XCIsIGNsczogXCJ6aWJhc2UtZHJvcGRvd24tYXJyb3dcIiB9KTtcbiAgICBjb25zdCB2aWV3U3ViID0gdmlld0l0ZW0uY3JlYXRlRGl2KFwiemliYXNlLWRyb3Bkb3duLXN1YlwiKTtcbiAgICBjb25zdCB2aWV3T3B0aW9uczogeyBpY29uOiBzdHJpbmc7IGxhYmVsOiBzdHJpbmc7IHZpZXc6IFZpZXdOYW1lIH1bXSA9IFtcbiAgICAgIHsgaWNvbjogXCJcdUQ4M0RcdURDQ0FcIiwgbGFiZWw6IFwiVGFibGVcIiwgdmlldzogXCJ0YWJsZVwiIH0sXG4gICAgICB7IGljb246IFwiXHVEODNEXHVEQ0NCXCIsIGxhYmVsOiBcIkthbmJhblwiLCB2aWV3OiBcImthbmJhblwiIH0sXG4gICAgICB7IGljb246IFwiXHVEODNEXHVEREJDXHVGRTBGXCIsIGxhYmVsOiBcIkdhbGxlcnlcIiwgdmlldzogXCJnYWxsZXJ5XCIgfSxcbiAgICAgIHsgaWNvbjogXCJcdUQ4M0RcdURDQzVcIiwgbGFiZWw6IFwiQ2FsZW5kYXJcIiwgdmlldzogXCJjYWxlbmRhclwiIH0sXG4gICAgXTtcbiAgICB2aWV3T3B0aW9ucy5mb3JFYWNoKCh7IGljb24sIGxhYmVsLCB2aWV3IH0pID0+IHtcbiAgICAgIGNvbnN0IGl0ZW0gPSB2aWV3U3ViLmNyZWF0ZURpdihcInppYmFzZS1kcm9wZG93bi1zdWJpdGVtXCIpO1xuICAgICAgaXRlbS5jcmVhdGVTcGFuKHsgdGV4dDogaWNvbiwgY2xzOiBcInppYmFzZS1kcm9wZG93bi1pY29uXCIgfSk7XG4gICAgICBpdGVtLmNyZWF0ZVNwYW4oeyB0ZXh0OiBsYWJlbCB9KTtcbiAgICAgIGlmIChjdXJyZW50VmlldyA9PT0gdmlldykge1xuICAgICAgICBpdGVtLmNsYXNzTGlzdC5hZGQoXCJ6aWJhc2UtbWVudS1hY3RpdmVcIik7XG4gICAgICAgIGl0ZW0uY3JlYXRlU3Bhbih7IHRleHQ6IFwiIFx1MjcxM1wiLCBjbHM6IFwiemliYXNlLXZpZXctY2hlY2tcIiB9KTtcbiAgICAgIH1cbiAgICAgIGl0ZW0uYWRkRXZlbnRMaXN0ZW5lcihcImNsaWNrXCIsICgpID0+IHtcbiAgICAgICAgY2xvc2VNZW51KCk7XG4gICAgICAgIGlmIChjdXJyZW50VmlldyAhPT0gdmlldykge1xuICAgICAgICAgIG9uVmlld0NoYW5nZSh2aWV3KTtcbiAgICAgICAgICB2b2lkIHRoaXMucGVyc2lzdFZpZXdBbm5vdGF0aW9uKGNvbnRleHQsIHNlY3Rpb25JbmZvLCB2aWV3KTtcbiAgICAgICAgfVxuICAgICAgfSk7XG4gICAgfSk7XG5cbiAgICBjb25zdCBydWxlc0l0ZW0gPSBtZW51LmNyZWF0ZURpdihcInppYmFzZS1kcm9wZG93bi1pdGVtIHppYmFzZS1kcm9wZG93bi1oYXMtc3ViXCIpO1xuICAgIHJ1bGVzSXRlbS5jcmVhdGVTcGFuKHsgdGV4dDogXCJDb2x1bW4gTmFtZSBSdWxlc1wiLCBjbHM6IFwiemliYXNlLWRyb3Bkb3duLWxhYmVsXCIgfSk7XG4gICAgcnVsZXNJdGVtLmNyZWF0ZVNwYW4oeyB0ZXh0OiBcIlx1MjVCNlwiLCBjbHM6IFwiemliYXNlLWRyb3Bkb3duLWFycm93XCIgfSk7XG4gICAgY29uc3QgcnVsZXNTdWIgPSBydWxlc0l0ZW0uY3JlYXRlRGl2KFwiemliYXNlLWRyb3Bkb3duLXN1YiB6aWJhc2UtcnVsZXMtc3ViXCIpO1xuICAgIHRoaXMucmVuZGVyUnVsZXNQYW5lbChydWxlc1N1Yik7XG5cbiAgICBjb25zdCBzZXR0aW5nc0l0ZW0gPSBtZW51LmNyZWF0ZURpdihcInppYmFzZS1kcm9wZG93bi1pdGVtXCIpO1xuICAgIHNldHRpbmdzSXRlbS5jcmVhdGVTcGFuKHsgdGV4dDogXCJcdTI2OTlcdUZFMEZcIiwgY2xzOiBcInppYmFzZS1kcm9wZG93bi1pY29uXCIgfSk7XG4gICAgc2V0dGluZ3NJdGVtLmNyZWF0ZVNwYW4oeyB0ZXh0OiBcIk9wZW4gU2V0dGluZ3NcIiwgY2xzOiBcInppYmFzZS1kcm9wZG93bi1sYWJlbFwiIH0pO1xuICAgIHNldHRpbmdzSXRlbS5hZGRFdmVudExpc3RlbmVyKFwiY2xpY2tcIiwgKCkgPT4ge1xuICAgICAgY2xvc2VNZW51KCk7XG4gICAgICBjb25zdCBhcHAgPSB0aGlzLmFwcCBhcyBBcHBXaXRoU2V0dGluZ3M7XG4gICAgICBhcHAuc2V0dGluZy5vcGVuKCk7XG4gICAgICBhcHAuc2V0dGluZy5vcGVuVGFiQnlJZChcInppYmFzZVwiKTtcbiAgICB9KTtcbiAgICBkb2N1bWVudC5ib2R5LmFwcGVuZENoaWxkKG1lbnUpO1xuICAgIHdpbmRvdy5zZXRUaW1lb3V0KCgpID0+IHtcbiAgICAgIGRvY3VtZW50LmFkZEV2ZW50TGlzdGVuZXIoXCJjbGlja1wiLCAoZXYpID0+IHtcbiAgICAgICAgaWYgKCFtZW51LmNvbnRhaW5zKGV2LnRhcmdldCBhcyBOb2RlKSkgY2xvc2VNZW51KCk7XG4gICAgICB9LCB7IHNpZ25hbDogY29udHJvbGxlci5zaWduYWwgfSk7XG4gICAgfSwgMTApO1xuICB9XG5cbiAgYXN5bmMgcGVyc2lzdFZpZXdBbm5vdGF0aW9uKFxuICAgIGNvbnRleHQ6IE1hcmtkb3duUG9zdFByb2Nlc3NvckNvbnRleHQsXG4gICAgc2VjdGlvbkluZm86IE1hcmtkb3duU2VjdGlvbkluZm9ybWF0aW9uLFxuICAgIHZpZXc6IHN0cmluZyxcbiAgKTogUHJvbWlzZTx2b2lkPiB7XG4gICAgY29uc3QgZmlsZSA9IHRoaXMuYXBwLnZhdWx0LmdldEFic3RyYWN0RmlsZUJ5UGF0aChjb250ZXh0LnNvdXJjZVBhdGgpO1xuICAgIGlmICghKGZpbGUgaW5zdGFuY2VvZiBURmlsZSkpIHJldHVybjtcbiAgICBhd2FpdCB0aGlzLmFwcC52YXVsdC5wcm9jZXNzKGZpbGUsIChjb250ZW50KSA9PiB7XG4gICAgICBjb25zdCBhbGxMaW5lcyA9IGNvbnRlbnQuc3BsaXQoXCJcXG5cIik7XG4gICAgICBjb25zdCBzZWFyY2hTdGFydCA9IE1hdGgubWF4KDAsIHNlY3Rpb25JbmZvLmxpbmVTdGFydCAtIDEpO1xuICAgICAgZm9yIChsZXQgaSA9IHNlYXJjaFN0YXJ0OyBpIDw9IE1hdGgubWluKHNlY3Rpb25JbmZvLmxpbmVTdGFydCwgYWxsTGluZXMubGVuZ3RoIC0gMSk7IGkrKykge1xuICAgICAgICBpZiAoVklFV19BTk5PVEFUSU9OX1JFLnRlc3QoYWxsTGluZXNbaV0pKSB7XG4gICAgICAgICAgaWYgKHZpZXcgPT09IFwidGFibGVcIikgYWxsTGluZXMuc3BsaWNlKGksIDEpO1xuICAgICAgICAgIGVsc2UgYWxsTGluZXNbaV0gPSBgPCEtLSB6aWJhc2UtdmlldzogJHt2aWV3fSAtLT5gO1xuICAgICAgICAgIHJldHVybiBhbGxMaW5lcy5qb2luKFwiXFxuXCIpO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgICBpZiAodmlldyAhPT0gXCJ0YWJsZVwiKSB7XG4gICAgICAgIGFsbExpbmVzLnNwbGljZShzZWN0aW9uSW5mby5saW5lU3RhcnQsIDAsIGA8IS0tIHppYmFzZS12aWV3OiAke3ZpZXd9IC0tPmApO1xuICAgICAgfVxuICAgICAgcmV0dXJuIGFsbExpbmVzLmpvaW4oXCJcXG5cIik7XG4gICAgfSk7XG4gIH1cblxuICByZW5kZXJSdWxlc1BhbmVsKGNvbnRhaW5lcjogSFRNTEVsZW1lbnQpOiB2b2lkIHtcbiAgICBjb250YWluZXIuZW1wdHkoKTtcbiAgICBjb25zdCB0aXRsZSA9IGNvbnRhaW5lci5jcmVhdGVEaXYoXCJ6aWJhc2UtcnVsZXMtdGl0bGVcIik7XG4gICAgdGl0bGUudGV4dENvbnRlbnQgPSBcIkNvbHVtbiBcdTIxOTIgVHlwZSBydWxlc1wiO1xuICAgIHRoaXMucGx1Z2luLnNldHRpbmdzLmNvbHVtblJ1bGVzLmZvckVhY2goKHJ1bGUsIGlkeCkgPT4ge1xuICAgICAgY29uc3Qgcm93ID0gY29udGFpbmVyLmNyZWF0ZURpdihcInppYmFzZS1ydWxlcy1yb3dcIik7XG4gICAgICBjb25zdCBuYW1lSW5wdXQgPSByb3cuY3JlYXRlRWwoXCJpbnB1dFwiLCB7IHR5cGU6IFwidGV4dFwiLCBjbHM6IFwiemliYXNlLXJ1bGVzLW5hbWVcIiwgdmFsdWU6IHJ1bGUubmFtZSB9KTtcbiAgICAgIG5hbWVJbnB1dC5wbGFjZWhvbGRlciA9IFwibmFtZVwiO1xuICAgICAgbmFtZUlucHV0LmFkZEV2ZW50TGlzdGVuZXIoXCJjaGFuZ2VcIiwgKCkgPT4ge1xuICAgICAgICB2b2lkIChhc3luYyAoKSA9PiB7XG4gICAgICAgICAgdGhpcy5wbHVnaW4uc2V0dGluZ3MuY29sdW1uUnVsZXNbaWR4XS5uYW1lID0gbmFtZUlucHV0LnZhbHVlLnRyaW0oKTtcbiAgICAgICAgICBhd2FpdCB0aGlzLnBsdWdpbi5zYXZlU2V0dGluZ3MoKTtcbiAgICAgICAgfSkoKTtcbiAgICAgIH0pO1xuICAgICAgcm93LmNyZWF0ZVNwYW4oeyB0ZXh0OiBcIlx1MjE5MlwiLCBjbHM6IFwiemliYXNlLXJ1bGVzLWFycm93XCIgfSk7XG4gICAgICBjb25zdCB0eXBlU2VsZWN0ID0gcm93LmNyZWF0ZUVsKFwic2VsZWN0XCIsIHsgY2xzOiBcInppYmFzZS1ydWxlcy10eXBlXCIgfSk7XG4gICAgICBDT0xVTU5fVFlQRV9PUFRJT05TLmZvckVhY2goKHQpID0+IHtcbiAgICAgICAgY29uc3Qgb3B0ID0gdHlwZVNlbGVjdC5jcmVhdGVFbChcIm9wdGlvblwiLCB7IHRleHQ6IHQsIHZhbHVlOiB0IH0pO1xuICAgICAgICBpZiAodCA9PT0gcnVsZS50eXBlKSBvcHQuc2VsZWN0ZWQgPSB0cnVlO1xuICAgICAgfSk7XG4gICAgICB0eXBlU2VsZWN0LmFkZEV2ZW50TGlzdGVuZXIoXCJjaGFuZ2VcIiwgKCkgPT4ge1xuICAgICAgICB2b2lkIChhc3luYyAoKSA9PiB7XG4gICAgICAgICAgdGhpcy5wbHVnaW4uc2V0dGluZ3MuY29sdW1uUnVsZXNbaWR4XS50eXBlID0gdHlwZVNlbGVjdC52YWx1ZTtcbiAgICAgICAgICBhd2FpdCB0aGlzLnBsdWdpbi5zYXZlU2V0dGluZ3MoKTtcbiAgICAgICAgfSkoKTtcbiAgICAgIH0pO1xuICAgICAgY29uc3QgcmVtb3ZlQnRuID0gcm93LmNyZWF0ZUVsKFwiYnV0dG9uXCIsIHsgdGV4dDogXCJcdTAwRDdcIiwgY2xzOiBcInppYmFzZS1ydWxlcy1yZW1vdmVcIiB9KTtcbiAgICAgIHJlbW92ZUJ0bi5hZGRFdmVudExpc3RlbmVyKFwiY2xpY2tcIiwgKCkgPT4ge1xuICAgICAgICB2b2lkIChhc3luYyAoKSA9PiB7XG4gICAgICAgICAgdGhpcy5wbHVnaW4uc2V0dGluZ3MuY29sdW1uUnVsZXMuc3BsaWNlKGlkeCwgMSk7XG4gICAgICAgICAgYXdhaXQgdGhpcy5wbHVnaW4uc2F2ZVNldHRpbmdzKCk7XG4gICAgICAgICAgdGhpcy5yZW5kZXJSdWxlc1BhbmVsKGNvbnRhaW5lcik7XG4gICAgICAgIH0pKCk7XG4gICAgICB9KTtcbiAgICB9KTtcbiAgICBjb25zdCBhZGRSb3cgPSBjb250YWluZXIuY3JlYXRlRGl2KFwiemliYXNlLXJ1bGVzLWFkZFwiKTtcbiAgICBjb25zdCBhZGRCdG4gPSBhZGRSb3cuY3JlYXRlRWwoXCJidXR0b25cIiwgeyB0ZXh0OiBcIisgQWRkIHJ1bGVcIiwgY2xzOiBcInppYmFzZS1ydWxlcy1hZGQtYnRuXCIgfSk7XG4gICAgYWRkQnRuLmFkZEV2ZW50TGlzdGVuZXIoXCJjbGlja1wiLCAoKSA9PiB7XG4gICAgICB2b2lkIChhc3luYyAoKSA9PiB7XG4gICAgICAgIHRoaXMucGx1Z2luLnNldHRpbmdzLmNvbHVtblJ1bGVzLnB1c2goeyBuYW1lOiBcIlwiLCB0eXBlOiBcImxhYmVsXCIgfSk7XG4gICAgICAgIGF3YWl0IHRoaXMucGx1Z2luLnNhdmVTZXR0aW5ncygpO1xuICAgICAgICB0aGlzLnJlbmRlclJ1bGVzUGFuZWwoY29udGFpbmVyKTtcbiAgICAgIH0pKCk7XG4gICAgfSk7XG4gIH1cblxuICBjb3B5QXNNYXJrZG93bihzY2hlbWE6IFRhYmxlU2NoZW1hLCBsaW5lczogc3RyaW5nW10pOiB2b2lkIHtcbiAgICBjb25zdCBkYXRhUm93cyA9IGxpbmVzLnNsaWNlKHNjaGVtYS5kYXRhU3RhcnRJbmRleCkuZmlsdGVyKGlzRGF0YVJvdyk7XG4gICAgY29uc3QgaGVhZGVyID0gXCJ8IFwiICsgc2NoZW1hLmNvbHVtbnMubWFwKChjKSA9PiBjLm5hbWUpLmpvaW4oXCIgfCBcIikgKyBcIiB8XCI7XG4gICAgY29uc3Qgc2VwYXJhdG9yID0gXCJ8IFwiICsgc2NoZW1hLmNvbHVtbnMubWFwKCgpID0+IFwiLS0tXCIpLmpvaW4oXCIgfCBcIikgKyBcIiB8XCI7XG4gICAgY29uc3Qgcm93cyA9IGRhdGFSb3dzLm1hcCgobGluZSkgPT4ge1xuICAgICAgY29uc3QgY2VsbHMgPSBzcGxpdFJvdyhsaW5lKTtcbiAgICAgIHJldHVybiBcInwgXCIgKyBzY2hlbWEuY29sdW1ucy5tYXAoKF8sIGkpID0+IGNlbGxzW2ldID8/IFwiXCIpLmpvaW4oXCIgfCBcIikgKyBcIiB8XCI7XG4gICAgfSk7XG4gICAgdm9pZCBuYXZpZ2F0b3IuY2xpcGJvYXJkLndyaXRlVGV4dChbaGVhZGVyLCBzZXBhcmF0b3IsIC4uLnJvd3NdLmpvaW4oXCJcXG5cIikpO1xuICAgIHNob3dUb2FzdChcIlx1RDgzRFx1RENDQiBDb3BpZWQgYXMgTWFya2Rvd24hXCIpO1xuICB9XG5cbiAgYXN5bmMgZXhwb3J0Q1NWKHNjaGVtYTogVGFibGVTY2hlbWEsIGxpbmVzOiBzdHJpbmdbXSwgY29udGV4dDogTWFya2Rvd25Qb3N0UHJvY2Vzc29yQ29udGV4dCk6IFByb21pc2U8dm9pZD4ge1xuICAgIGNvbnN0IGRhdGFSb3dzID0gbGluZXMuc2xpY2Uoc2NoZW1hLmRhdGFTdGFydEluZGV4KS5maWx0ZXIoaXNEYXRhUm93KTtcbiAgICBjb25zdCBlc2NhcGUgPSAodjogc3RyaW5nKSA9PiBgXCIke3YucmVwbGFjZSgvXCIvZywgJ1wiXCInKX1cImA7XG4gICAgY29uc3QgaGVhZGVyID0gc2NoZW1hLmNvbHVtbnMubWFwKChjKSA9PiBlc2NhcGUoYy5uYW1lKSkuam9pbihcIixcIik7XG4gICAgY29uc3Qgcm93cyA9IGRhdGFSb3dzLm1hcCgobGluZSkgPT4ge1xuICAgICAgY29uc3QgY2VsbHMgPSBzcGxpdFJvdyhsaW5lKTtcbiAgICAgIHJldHVybiBzY2hlbWEuY29sdW1ucy5tYXAoKF8sIGkpID0+IGVzY2FwZSgoY2VsbHNbaV0gPz8gXCJcIikudHJpbSgpKSkuam9pbihcIixcIik7XG4gICAgfSk7XG4gICAgY29uc3Qgbm90ZU5hbWUgPSBjb250ZXh0LnNvdXJjZVBhdGgucmVwbGFjZSgvXFwubWQkLywgXCJcIik7XG4gICAgYXdhaXQgdGhpcy5zYXZlRmlsZShub3RlTmFtZSArIFwiLmNzdlwiLCBbaGVhZGVyLCAuLi5yb3dzXS5qb2luKFwiXFxuXCIpLCBjb250ZXh0KTtcbiAgICBzaG93VG9hc3QoXCJcdUQ4M0RcdURDRTQgRXhwb3J0ZWQgYXMgQ1NWIVwiKTtcbiAgfVxuXG4gIGFzeW5jIGV4cG9ydEpTT04oc2NoZW1hOiBUYWJsZVNjaGVtYSwgbGluZXM6IHN0cmluZ1tdLCBjb250ZXh0OiBNYXJrZG93blBvc3RQcm9jZXNzb3JDb250ZXh0KTogUHJvbWlzZTx2b2lkPiB7XG4gICAgY29uc3QgZGF0YVJvd3MgPSBsaW5lcy5zbGljZShzY2hlbWEuZGF0YVN0YXJ0SW5kZXgpLmZpbHRlcihpc0RhdGFSb3cpO1xuICAgIGNvbnN0IHJlY29yZHMgPSBkYXRhUm93cy5tYXAoKGxpbmUpID0+IHtcbiAgICAgIGNvbnN0IGNlbGxzID0gc3BsaXRSb3cobGluZSk7XG4gICAgICBjb25zdCBvYmo6IFJlY29yZDxzdHJpbmcsIHN0cmluZyB8IGJvb2xlYW4gfCBudW1iZXIgfCBudWxsPiA9IHt9O1xuICAgICAgc2NoZW1hLmNvbHVtbnMuZm9yRWFjaCgoY29sLCBpKSA9PiB7XG4gICAgICAgIGNvbnN0IHJhdyA9IChjZWxsc1tpXSA/PyBcIlwiKS50cmltKCk7XG4gICAgICAgIGlmIChjb2wudHlwZS5raW5kID09PSBcInRvZ2dsZVwiKSBvYmpbY29sLm5hbWVdID0gcGFyc2VCb29sKHJhdyk7XG4gICAgICAgIGVsc2UgaWYgKGNvbC50eXBlLmtpbmQgPT09IFwibnVtYmVyXCIpIG9ialtjb2wubmFtZV0gPSByYXcgPyBwYXJzZUZsb2F0KHJhdykgOiBudWxsO1xuICAgICAgICBlbHNlIG9ialtjb2wubmFtZV0gPSByYXc7XG4gICAgICB9KTtcbiAgICAgIHJldHVybiBvYmo7XG4gICAgfSk7XG4gICAgY29uc3Qgbm90ZU5hbWUgPSBjb250ZXh0LnNvdXJjZVBhdGgucmVwbGFjZSgvXFwubWQkLywgXCJcIik7XG4gICAgYXdhaXQgdGhpcy5zYXZlRmlsZShub3RlTmFtZSArIFwiLmpzb25cIiwgSlNPTi5zdHJpbmdpZnkocmVjb3JkcywgbnVsbCwgMiksIGNvbnRleHQpO1xuICAgIHNob3dUb2FzdChcIlx1RDgzRFx1RERDNFx1RkUwRiBFeHBvcnRlZCBhcyBKU09OIVwiKTtcbiAgfVxuXG4gIGFzeW5jIHNhdmVGaWxlKGZpbGVuYW1lOiBzdHJpbmcsIGNvbnRlbnQ6IHN0cmluZywgY29udGV4dDogTWFya2Rvd25Qb3N0UHJvY2Vzc29yQ29udGV4dCk6IFByb21pc2U8dm9pZD4ge1xuICAgIGNvbnN0IGZpbGUgPSB0aGlzLmFwcC52YXVsdC5nZXRBYnN0cmFjdEZpbGVCeVBhdGgoY29udGV4dC5zb3VyY2VQYXRoKTtcbiAgICBpZiAoIShmaWxlIGluc3RhbmNlb2YgVEZpbGUpKSByZXR1cm47XG4gICAgY29uc3QgZm9sZGVyID0gZmlsZS5wYXJlbnQ/LnBhdGggPz8gXCJcIjtcbiAgICBjb25zdCBiYXNlTmFtZSA9IGZpbGVuYW1lLnNwbGl0KFwiL1wiKS5wb3AoKSA/PyBmaWxlbmFtZTtcbiAgICBjb25zdCBmdWxsUGF0aCA9IGZvbGRlciA/IGAke2ZvbGRlcn0vJHtiYXNlTmFtZX1gIDogYmFzZU5hbWU7XG4gICAgY29uc3QgZXhpc3RpbmcgPSB0aGlzLmFwcC52YXVsdC5nZXRBYnN0cmFjdEZpbGVCeVBhdGgoZnVsbFBhdGgpO1xuICAgIGlmIChleGlzdGluZyBpbnN0YW5jZW9mIFRGaWxlKSBhd2FpdCB0aGlzLmFwcC52YXVsdC5tb2RpZnkoZXhpc3RpbmcsIGNvbnRlbnQpO1xuICAgIGVsc2UgYXdhaXQgdGhpcy5hcHAudmF1bHQuY3JlYXRlKGZ1bGxQYXRoLCBjb250ZW50KTtcbiAgfVxuXG4gIHNob3dUeXBlTWVudShcbiAgICBlOiBNb3VzZUV2ZW50LFxuICAgIGNvbElkeDogbnVtYmVyLFxuICAgIHNjaGVtYTogVGFibGVTY2hlbWEsXG4gICAgY29udGV4dDogTWFya2Rvd25Qb3N0UHJvY2Vzc29yQ29udGV4dCxcbiAgICBzZWN0aW9uSW5mbzogTWFya2Rvd25TZWN0aW9uSW5mb3JtYXRpb24sXG4gICAgX3Jhd0RhdGFMaW5lczogc3RyaW5nW10sXG4gICAgYmFkZ2U6IEhUTUxFbGVtZW50LFxuICApOiB2b2lkIHtcbiAgICBkb2N1bWVudC5xdWVyeVNlbGVjdG9yQWxsKFwiLnppYmFzZS1jb250ZXh0LW1lbnVcIikuZm9yRWFjaCgobSkgPT4gbS5yZW1vdmUoKSk7XG4gICAgY29uc3QgbWVudSA9IGNyZWF0ZURpdigpO1xuICAgIG1lbnUuY2xhc3NOYW1lID0gXCJ6aWJhc2UtY29udGV4dC1tZW51XCI7XG4gICAgY29uc3QgeCA9IE1hdGgubWluKGUuY2xpZW50WCwgd2luZG93LmlubmVyV2lkdGggLSAxNjApO1xuICAgIG1lbnUuc2V0Q3NzU3R5bGVzKHsgdG9wOiBgJHtlLmNsaWVudFkgKyB3aW5kb3cuc2Nyb2xsWX1weGAgfSk7XG4gICAgbWVudS5zZXRDc3NTdHlsZXMoeyBsZWZ0OiBgJHt4fXB4YCB9KTtcbiAgICBjb25zdCB0eXBlcyA9IFtcbiAgICAgIHsgbGFiZWw6IFwiVGV4dFwiLCBpY29uOiBcIlRcIiwga2luZDogXCJ0ZXh0XCIgfSxcbiAgICAgIHsgbGFiZWw6IFwiVG9nZ2xlXCIsIGljb246IFwiXHUyQjFDXCIsIGtpbmQ6IFwidG9nZ2xlXCIgfSxcbiAgICAgIHsgbGFiZWw6IFwiU2VsZWN0XCIsIGljb246IFwiXHUyNUJFXCIsIGtpbmQ6IFwic2VsZWN0XCIgfSxcbiAgICAgIHsgbGFiZWw6IFwiTGFiZWxcIiwgaWNvbjogXCJcdTJCMjFcIiwga2luZDogXCJsYWJlbFwiIH0sXG4gICAgICB7IGxhYmVsOiBcIk11bHRpLXNlbGVjdFwiLCBpY29uOiBcIlx1RDgzQ1x1REZGN1x1RkUwRlwiLCBraW5kOiBcIm11bHRpLXNlbGVjdFwiIH0sXG4gICAgICB7IGxhYmVsOiBcIk51bWJlclwiLCBpY29uOiBcIiNcIiwga2luZDogXCJudW1iZXJcIiB9LFxuICAgICAgeyBsYWJlbDogXCJEYXRlXCIsIGljb246IFwiXHVEODNEXHVEQ0M1XCIsIGtpbmQ6IFwiZGF0ZVwiIH0sXG4gICAgICB7IGxhYmVsOiBcIkZvcm11bGFcIiwgaWNvbjogXCJcdTAxOTJcIiwga2luZDogXCJmb3JtdWxhXCIgfSxcbiAgICBdIGFzIGNvbnN0O1xuICAgIG1lbnUuY3JlYXRlRGl2KFwiemliYXNlLW1lbnUtdGl0bGVcIikudGV4dENvbnRlbnQgPSBzY2hlbWEuY29sdW1uc1tjb2xJZHhdPy5uYW1lID8/IFwiQ29sdW1uXCI7XG4gICAgY29uc3QgY29udHJvbGxlciA9IG5ldyBBYm9ydENvbnRyb2xsZXIoKTtcbiAgICBjb25zdCBjbG9zZU1lbnUgPSAoKSA9PiB7XG4gICAgICBtZW51LnJlbW92ZSgpO1xuICAgICAgY29udHJvbGxlci5hYm9ydCgpO1xuICAgIH07XG4gICAgdHlwZXMuZm9yRWFjaCgoeyBsYWJlbCwgaWNvbiwga2luZCB9KSA9PiB7XG4gICAgICBjb25zdCBpdGVtID0gbWVudS5jcmVhdGVEaXYoXCJ6aWJhc2UtbWVudS1pdGVtXCIpO1xuICAgICAgaXRlbS5jcmVhdGVTcGFuKHsgdGV4dDogaWNvbiwgY2xzOiBcInppYmFzZS1tZW51LWljb25cIiB9KTtcbiAgICAgIGl0ZW0uY3JlYXRlU3Bhbih7IHRleHQ6IGxhYmVsLCBjbHM6IFwiemliYXNlLW1lbnUtbGFiZWxcIiB9KTtcbiAgICAgIGlmIChzY2hlbWEuY29sdW1uc1tjb2xJZHhdPy50eXBlLmtpbmQgPT09IGtpbmQpIGl0ZW0uY2xhc3NMaXN0LmFkZChcInppYmFzZS1tZW51LWFjdGl2ZVwiKTtcbiAgICAgIGl0ZW0uYWRkRXZlbnRMaXN0ZW5lcihcImNsaWNrXCIsICgpID0+IHtcbiAgICAgICAgY2xvc2VNZW51KCk7XG4gICAgICAgIGlmIChraW5kID09PSBcInNlbGVjdFwiKSB7XG4gICAgICAgICAgY29uc3QgY3VycmVudE9wdHMgPSBzY2hlbWEuY29sdW1uc1tjb2xJZHhdPy50eXBlLmtpbmQgPT09IFwic2VsZWN0XCIgPyBzY2hlbWEuY29sdW1uc1tjb2xJZHhdLnR5cGUub3B0aW9ucyA6IFtdO1xuICAgICAgICAgIG5ldyBTZWxlY3RPcHRpb25zTW9kYWwoXG4gICAgICAgICAgICB0aGlzLmFwcCxcbiAgICAgICAgICAgIHNjaGVtYS5jb2x1bW5zW2NvbElkeF0/Lm5hbWUgPz8gXCJDb2x1bW5cIixcbiAgICAgICAgICAgIGN1cnJlbnRPcHRzLFxuICAgICAgICAgICAgKG9wdHMpID0+IHtcbiAgICAgICAgICAgICAgdm9pZCB0aGlzLndyaXRlQ29sdW1uVHlwZShjb250ZXh0LCBzZWN0aW9uSW5mbywgc2NoZW1hLCBjb2xJZHgsIGBzZWxlY3Q6JHtvcHRzLmpvaW4oXCIsXCIpfWAsIGJhZGdlKTtcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgKS5vcGVuKCk7XG4gICAgICAgIH0gZWxzZSBpZiAoa2luZCA9PT0gXCJmb3JtdWxhXCIpIHtcbiAgICAgICAgICBjb25zdCBjb2xOYW1lID0gc2NoZW1hLmNvbHVtbnNbY29sSWR4XT8ubmFtZTtcbiAgICAgICAgICBjb25zdCBjdXJyZW50RXhwciA9IHNjaGVtYS5jb2x1bW5zW2NvbElkeF0/LnR5cGUua2luZCA9PT0gXCJmb3JtdWxhXCIgPyBzY2hlbWEuY29sdW1uc1tjb2xJZHhdLnR5cGUuZXhwcmVzc2lvbiA6IFwiXCI7XG4gICAgICAgICAgbmV3IEZvcm11bGFJbnB1dE1vZGFsKHRoaXMuYXBwLCBjb2xOYW1lIHx8IFwiQ29sdW1uXCIsIGN1cnJlbnRFeHByLCBzY2hlbWEuY29sdW1ucywgKGV4cHIpID0+IHtcbiAgICAgICAgICAgIHZvaWQgdGhpcy53cml0ZUNvbHVtblR5cGUoY29udGV4dCwgc2VjdGlvbkluZm8sIHNjaGVtYSwgY29sSWR4LCBgZm9ybXVsYToke2V4cHJ9YCwgYmFkZ2UpO1xuICAgICAgICAgIH0pLm9wZW4oKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICB2b2lkIHRoaXMud3JpdGVDb2x1bW5UeXBlKGNvbnRleHQsIHNlY3Rpb25JbmZvLCBzY2hlbWEsIGNvbElkeCwga2luZCwgYmFkZ2UpO1xuICAgICAgICB9XG4gICAgICB9KTtcbiAgICB9KTtcbiAgICBkb2N1bWVudC5ib2R5LmFwcGVuZENoaWxkKG1lbnUpO1xuICAgIHdpbmRvdy5zZXRUaW1lb3V0KCgpID0+IHtcbiAgICAgIGRvY3VtZW50LmFkZEV2ZW50TGlzdGVuZXIoXCJjbGlja1wiLCAoZXYpID0+IHtcbiAgICAgICAgaWYgKCFtZW51LmNvbnRhaW5zKGV2LnRhcmdldCBhcyBOb2RlKSkgY2xvc2VNZW51KCk7XG4gICAgICB9LCB7IHNpZ25hbDogY29udHJvbGxlci5zaWduYWwgfSk7XG4gICAgfSwgMTApO1xuICB9XG5cbiAgYXN5bmMgd3JpdGVDb2x1bW5UeXBlKFxuICAgIGNvbnRleHQ6IE1hcmtkb3duUG9zdFByb2Nlc3NvckNvbnRleHQsXG4gICAgc2VjdGlvbkluZm86IE1hcmtkb3duU2VjdGlvbkluZm9ybWF0aW9uLFxuICAgIHNjaGVtYTogVGFibGVTY2hlbWEsXG4gICAgY29sSWR4OiBudW1iZXIsXG4gICAgdHlwZVN0cjogc3RyaW5nLFxuICAgIGJhZGdlOiBIVE1MRWxlbWVudCxcbiAgKTogUHJvbWlzZTx2b2lkPiB7XG4gICAgY29uc3QgZmlsZSA9IHRoaXMuYXBwLnZhdWx0LmdldEFic3RyYWN0RmlsZUJ5UGF0aChjb250ZXh0LnNvdXJjZVBhdGgpO1xuICAgIGlmICghKGZpbGUgaW5zdGFuY2VvZiBURmlsZSkpIHJldHVybjtcbiAgICBhd2FpdCB0aGlzLmFwcC52YXVsdC5wcm9jZXNzKGZpbGUsIChjb250ZW50KSA9PiB7XG4gICAgICBjb25zdCBhbGxMaW5lcyA9IGNvbnRlbnQuc3BsaXQoXCJcXG5cIik7XG4gICAgICBpZiAoc2NoZW1hLmluZmVycmVkKSB7XG4gICAgICAgIGNvbnN0IGFubm90YXRpb25DZWxscyA9IHNjaGVtYS5jb2x1bW5zLm1hcCgoY29sLCBpKSA9PiB7XG4gICAgICAgICAgaWYgKGkgPT09IGNvbElkeCkgcmV0dXJuIGAgPCEtLSB6aWJhc2U6ICR7dHlwZVN0cn0gLS0+IGA7XG4gICAgICAgICAgaWYgKGNvbC50eXBlLmtpbmQgPT09IFwiZm9ybXVsYVwiKSByZXR1cm4gYCA8IS0tIHppYmFzZTogZm9ybXVsYToke2NvbC50eXBlLmV4cHJlc3Npb259IC0tPiBgO1xuICAgICAgICAgIHJldHVybiBgIDwhLS0gemliYXNlOiAke2NvbC50eXBlLmtpbmR9IC0tPiBgO1xuICAgICAgICB9KTtcbiAgICAgICAgYWxsTGluZXMuc3BsaWNlKHNlY3Rpb25JbmZvLmxpbmVTdGFydCArIDIsIDAsIFwifCBcIiArIGFubm90YXRpb25DZWxscy5qb2luKFwiIHwgXCIpICsgXCIgfFwiKTtcbiAgICAgICAgd2luZG93LnNldFRpbWVvdXQoKCkgPT4ge1xuICAgICAgICAgIGJhZGdlLnRleHRDb250ZW50ID0gXCJhbm5vdGF0ZWRcIjtcbiAgICAgICAgICBiYWRnZS5jbGFzc05hbWUgPSBcInppYmFzZS1hbm5vdGF0ZWQtYmFkZ2VcIjtcbiAgICAgICAgfSwgNTApO1xuICAgICAgfSBlbHNlIGlmIChzY2hlbWEuc2NoZW1hUm93SW5kZXggIT09IG51bGwpIHtcbiAgICAgICAgY29uc3QgY2VsbHMgPSBzcGxpdFJvdyhhbGxMaW5lc1tzZWN0aW9uSW5mby5saW5lU3RhcnQgKyBzY2hlbWEuc2NoZW1hUm93SW5kZXhdKTtcbiAgICAgICAgY2VsbHNbY29sSWR4XSA9IGAgPCEtLSB6aWJhc2U6ICR7dHlwZVN0cn0gLS0+IGA7XG4gICAgICAgIGFsbExpbmVzW3NlY3Rpb25JbmZvLmxpbmVTdGFydCArIHNjaGVtYS5zY2hlbWFSb3dJbmRleF0gPSBzZXJpYWxpemVSb3coY2VsbHMpO1xuICAgICAgfVxuICAgICAgcmV0dXJuIGFsbExpbmVzLmpvaW4oXCJcXG5cIik7XG4gICAgfSk7XG4gIH1cblxuICByZW5kZXJDZWxsKFxuICAgIHRkOiBIVE1MVGFibGVDZWxsRWxlbWVudCxcbiAgICBjb2w6IENvbHVtbixcbiAgICByYXdWYWx1ZTogc3RyaW5nLFxuICAgIGNvbnRleHQ6IE1hcmtkb3duUG9zdFByb2Nlc3NvckNvbnRleHQsXG4gICAgc2NoZW1hOiBUYWJsZVNjaGVtYSxcbiAgICByb3dDZWxsczogc3RyaW5nW10sXG4gICAgb25DaGFuZ2U6IENlbGxDaGFuZ2VIYW5kbGVyLFxuICApOiB2b2lkIHtcbiAgICByZW5kZXJDZWxsKHRoaXMsIHRkLCBjb2wsIHJhd1ZhbHVlLCBjb250ZXh0LCBzY2hlbWEsIHJvd0NlbGxzLCBvbkNoYW5nZSk7XG4gIH1cblxuICBhc3luYyB3cml0ZUJhY2soXG4gICAgY29udGV4dDogTWFya2Rvd25Qb3N0UHJvY2Vzc29yQ29udGV4dCxcbiAgICBzZWN0aW9uSW5mbzogTWFya2Rvd25TZWN0aW9uSW5mb3JtYXRpb24sXG4gICAgdGFibGVSb3dJbmRleDogbnVtYmVyLFxuICAgIGNvbEluZGV4OiBudW1iZXIsXG4gICAgbmV3VmFsdWU6IHN0cmluZyxcbiAgKTogUHJvbWlzZTx2b2lkPiB7XG4gICAgY29uc3QgZmlsZSA9IHRoaXMuYXBwLnZhdWx0LmdldEFic3RyYWN0RmlsZUJ5UGF0aChjb250ZXh0LnNvdXJjZVBhdGgpO1xuICAgIGlmICghKGZpbGUgaW5zdGFuY2VvZiBURmlsZSkpIHJldHVybjtcbiAgICBhd2FpdCB0aGlzLmFwcC52YXVsdC5wcm9jZXNzKGZpbGUsIChjb250ZW50KSA9PiB7XG4gICAgICBjb25zdCBhbGxMaW5lcyA9IGNvbnRlbnQuc3BsaXQoXCJcXG5cIik7XG4gICAgICBjb25zdCBmaWxlTGluZUluZGV4ID0gc2VjdGlvbkluZm8ubGluZVN0YXJ0ICsgdGFibGVSb3dJbmRleDtcbiAgICAgIGNvbnN0IHRhcmdldExpbmUgPSBhbGxMaW5lc1tmaWxlTGluZUluZGV4XTtcbiAgICAgIGlmICghdGFyZ2V0TGluZSkgcmV0dXJuIGNvbnRlbnQ7XG4gICAgICBjb25zdCBjZWxscyA9IHNwbGl0Um93KHRhcmdldExpbmUpO1xuICAgICAgY2VsbHNbY29sSW5kZXhdID0gYCAke25ld1ZhbHVlfSBgO1xuICAgICAgYWxsTGluZXNbZmlsZUxpbmVJbmRleF0gPSBzZXJpYWxpemVSb3coY2VsbHMpO1xuICAgICAgcmV0dXJuIGFsbExpbmVzLmpvaW4oXCJcXG5cIik7XG4gICAgfSk7XG4gIH1cblxuICBhc3luYyBhZGRSb3coXG4gICAgY29udGV4dDogTWFya2Rvd25Qb3N0UHJvY2Vzc29yQ29udGV4dCxcbiAgICBzZWN0aW9uSW5mbzogTWFya2Rvd25TZWN0aW9uSW5mb3JtYXRpb24sXG4gICAgc2NoZW1hOiBUYWJsZVNjaGVtYSxcbiAgKTogUHJvbWlzZTx2b2lkPiB7XG4gICAgY29uc3QgZmlsZSA9IHRoaXMuYXBwLnZhdWx0LmdldEFic3RyYWN0RmlsZUJ5UGF0aChjb250ZXh0LnNvdXJjZVBhdGgpO1xuICAgIGlmICghKGZpbGUgaW5zdGFuY2VvZiBURmlsZSkpIHJldHVybjtcbiAgICBhd2FpdCB0aGlzLmFwcC52YXVsdC5wcm9jZXNzKGZpbGUsIChjb250ZW50KSA9PiB7XG4gICAgICBjb25zdCBhbGxMaW5lcyA9IGNvbnRlbnQuc3BsaXQoXCJcXG5cIik7XG4gICAgICBhbGxMaW5lcy5zcGxpY2Uoc2VjdGlvbkluZm8ubGluZUVuZCArIDEsIDAsIHNlcmlhbGl6ZVJvdyhzY2hlbWEuY29sdW1ucy5tYXAoKCkgPT4gXCIgICBcIikpKTtcbiAgICAgIHJldHVybiBhbGxMaW5lcy5qb2luKFwiXFxuXCIpO1xuICAgIH0pO1xuICB9XG5cbiAgYXN5bmMgcmVyZW5kZXJUZXh0Q2VsbCh0ZDogSFRNTEVsZW1lbnQsIG5ld1Jhdzogc3RyaW5nLCBjb250ZXh0OiBNYXJrZG93blBvc3RQcm9jZXNzb3JDb250ZXh0KTogUHJvbWlzZTx2b2lkPiB7XG4gICAgdGQuZGF0YXNldC5yYXcgPSBuZXdSYXc7XG4gICAgY29uc3QgZGlzcGxheVNwYW4gPSB0ZC5xdWVyeVNlbGVjdG9yKFwiLnppYmFzZS10ZXh0LXJlbmRlcmVkXCIpO1xuICAgIGlmICghZGlzcGxheVNwYW4pIHJldHVybjtcbiAgICBkaXNwbGF5U3Bhbi5lbXB0eSgpO1xuICAgIGlmIChuZXdSYXcpIHtcbiAgICAgIGF3YWl0IE1hcmtkb3duUmVuZGVyZXIucmVuZGVyKHRoaXMuYXBwLCBuZXdSYXcsIGRpc3BsYXlTcGFuIGFzIEhUTUxFbGVtZW50LCBjb250ZXh0LnNvdXJjZVBhdGgsIHRoaXMucGx1Z2luKTtcbiAgICAgIHdpbmRvdy5zZXRUaW1lb3V0KCgpID0+IHtcbiAgICAgICAgZGlzcGxheVNwYW4ucXVlcnlTZWxlY3RvckFsbChcImFcIikuZm9yRWFjaCgoYSkgPT4gYXR0YWNoTGlua1Rvb2x0aXAoYSkpO1xuICAgICAgfSwgNTApO1xuICAgICAgZGlzcGxheVNwYW4uY2xhc3NMaXN0LnJlbW92ZShcInppYmFzZS10ZXh0LWVtcHR5XCIpO1xuICAgIH0gZWxzZSB7XG4gICAgICBkaXNwbGF5U3Bhbi50ZXh0Q29udGVudCA9IFwiXHUyMDE0XCI7XG4gICAgICBkaXNwbGF5U3Bhbi5jbGFzc0xpc3QuYWRkKFwiemliYXNlLXRleHQtZW1wdHlcIik7XG4gICAgfVxuICB9XG59XG4iLCAiaW1wb3J0IHsgTWFya2Rvd25SZW5kZXJlciwgdHlwZSBNYXJrZG93blBvc3RQcm9jZXNzb3JDb250ZXh0IH0gZnJvbSBcIm9ic2lkaWFuXCI7XG5pbXBvcnQge1xuICBldmFsdWF0ZUZvcm11bGEsXG4gIGV2YWx1YXRlU2ltcGxlTWF0aCxcbiAgZm9ybWF0UmVzdWx0LFxuICBpc0JhY2t0aWNrZWQsXG4gIGlzU2ltcGxlTWF0aCxcbiAgc3RyaXBCYWNrdGlja3MsXG59IGZyb20gXCIuL2Zvcm11bGFcIjtcbmltcG9ydCB7IHBhcnNlQm9vbCwgcGFyc2VNdWx0aVNlbGVjdCwgc2VyaWFsaXplQm9vbCB9IGZyb20gXCIuL3NjaGVtYVwiO1xuaW1wb3J0IHR5cGUgeyBDZWxsQ2hhbmdlSGFuZGxlciwgQ29sdW1uLCBUYWJsZVNjaGVtYSwgWmlCYXNlSG9zdCB9IGZyb20gXCIuL3R5cGVzXCI7XG5pbXBvcnQgeyBhdHRhY2hMaW5rVG9vbHRpcCwgZ2V0TGFiZWxDb2xvciwgc3RhcnRMYWJlbEVkaXQgfSBmcm9tIFwiLi91aVwiO1xuXG5leHBvcnQgZnVuY3Rpb24gc3RhcnRNYXJrZG93bkVkaXQoXG4gIHRkOiBIVE1MRWxlbWVudCxcbiAgcmF3VmFsdWU6IHN0cmluZyxcbiAgY29udGV4dDogTWFya2Rvd25Qb3N0UHJvY2Vzc29yQ29udGV4dCxcbiAgaG9zdDogWmlCYXNlSG9zdCxcbiAgb25DaGFuZ2U6IENlbGxDaGFuZ2VIYW5kbGVyLFxuKTogdm9pZCB7XG4gIGlmICh0ZC5xdWVyeVNlbGVjdG9yKFwiLnppYmFzZS1pbmxpbmUtaW5wdXRcIikpIHJldHVybjtcbiAgY29uc3QgZGlzcGxheVNwYW4gPSB0ZC5xdWVyeVNlbGVjdG9yPEhUTUxFbGVtZW50PihcIi56aWJhc2UtdGV4dC1yZW5kZXJlZFwiKTtcbiAgaWYgKGRpc3BsYXlTcGFuKSBkaXNwbGF5U3Bhbi5zZXRDc3NTdHlsZXMoeyBkaXNwbGF5OiBcIm5vbmVcIiB9KTtcbiAgY29uc3QgaW5wdXQgPSBjcmVhdGVFbChcImlucHV0XCIpO1xuICBpbnB1dC5jbGFzc05hbWUgPSBcInppYmFzZS1pbmxpbmUtaW5wdXRcIjtcbiAgaW5wdXQudmFsdWUgPSByYXdWYWx1ZTtcbiAgdGQuYXBwZW5kQ2hpbGQoaW5wdXQpO1xuICBpbnB1dC5mb2N1cygpO1xuICBpbnB1dC5zZWxlY3QoKTtcbiAgY29uc3QgY29tbWl0ID0gYXN5bmMgKCkgPT4ge1xuICAgIGNvbnN0IG5ld1ZhbCA9IGlucHV0LnZhbHVlO1xuICAgIGlucHV0LnJlbW92ZSgpO1xuICAgIGlmIChkaXNwbGF5U3BhbikgZGlzcGxheVNwYW4uc2V0Q3NzU3R5bGVzKHsgZGlzcGxheTogXCJcIiB9KTtcbiAgICBhd2FpdCBvbkNoYW5nZShuZXdWYWwpO1xuICAgIGF3YWl0IGhvc3QucmVyZW5kZXJUZXh0Q2VsbCh0ZCwgbmV3VmFsLCBjb250ZXh0KTtcbiAgfTtcbiAgaW5wdXQuYWRkRXZlbnRMaXN0ZW5lcihcImJsdXJcIiwgKCkgPT4geyB2b2lkIGNvbW1pdCgpOyB9KTtcbiAgaW5wdXQuYWRkRXZlbnRMaXN0ZW5lcihcImtleWRvd25cIiwgKGU6IEtleWJvYXJkRXZlbnQpID0+IHtcbiAgICBpZiAoZS5rZXkgPT09IFwiRW50ZXJcIikge1xuICAgICAgZS5wcmV2ZW50RGVmYXVsdCgpO1xuICAgICAgdm9pZCBjb21taXQoKTtcbiAgICB9XG4gICAgaWYgKGUua2V5ID09PSBcIkVzY2FwZVwiKSB7XG4gICAgICBpbnB1dC5yZW1vdmUoKTtcbiAgICAgIGlmIChkaXNwbGF5U3BhbikgZGlzcGxheVNwYW4uc2V0Q3NzU3R5bGVzKHsgZGlzcGxheTogXCJcIiB9KTtcbiAgICB9XG4gIH0pO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gcmVuZGVyQ2VsbChcbiAgaG9zdDogWmlCYXNlSG9zdCxcbiAgdGQ6IEhUTUxUYWJsZUNlbGxFbGVtZW50LFxuICBjb2w6IENvbHVtbixcbiAgcmF3VmFsdWU6IHN0cmluZyxcbiAgY29udGV4dDogTWFya2Rvd25Qb3N0UHJvY2Vzc29yQ29udGV4dCxcbiAgc2NoZW1hOiBUYWJsZVNjaGVtYSxcbiAgcm93Q2VsbHM6IHN0cmluZ1tdLFxuICBvbkNoYW5nZTogQ2VsbENoYW5nZUhhbmRsZXIsXG4pOiB2b2lkIHtcbiAgc3dpdGNoIChjb2wudHlwZS5raW5kKSB7XG4gICAgY2FzZSBcInRvZ2dsZVwiOiB7XG4gICAgICBjb25zdCBjaGVja2VkID0gcGFyc2VCb29sKHJhd1ZhbHVlKTtcbiAgICAgIGNvbnN0IGxhYmVsID0gdGQuY3JlYXRlRWwoXCJsYWJlbFwiLCB7IGNsczogXCJ6aWJhc2UtdG9nZ2xlLWxhYmVsXCIgfSk7XG4gICAgICBjb25zdCBpbnB1dCA9IGxhYmVsLmNyZWF0ZUVsKFwiaW5wdXRcIiwgeyB0eXBlOiBcImNoZWNrYm94XCIgfSk7XG4gICAgICBpbnB1dC5jaGVja2VkID0gY2hlY2tlZDtcbiAgICAgIGlucHV0LmNsYXNzTmFtZSA9IFwiemliYXNlLXRvZ2dsZS1pbnB1dFwiO1xuICAgICAgbGFiZWwuY3JlYXRlRGl2KFwiemliYXNlLXRvZ2dsZS10cmFja1wiKS5jcmVhdGVEaXYoXCJ6aWJhc2UtdG9nZ2xlLXRodW1iXCIpO1xuICAgICAgaW5wdXQuYWRkRXZlbnRMaXN0ZW5lcihcImNoYW5nZVwiLCAoKSA9PiB7XG4gICAgICAgIHZvaWQgb25DaGFuZ2Uoc2VyaWFsaXplQm9vbChpbnB1dC5jaGVja2VkKSk7XG4gICAgICB9KTtcbiAgICAgIGJyZWFrO1xuICAgIH1cbiAgICBjYXNlIFwic2VsZWN0XCI6IHtcbiAgICAgIGNvbnN0IHNlbGVjdCA9IHRkLmNyZWF0ZUVsKFwic2VsZWN0XCIsIHsgY2xzOiBcInppYmFzZS1zZWxlY3RcIiB9KTtcbiAgICAgIHNlbGVjdC5jcmVhdGVFbChcIm9wdGlvblwiLCB7IHZhbHVlOiBcIlwiLCB0ZXh0OiBcIlx1MjAxNFwiIH0pO1xuICAgICAgY29sLnR5cGUub3B0aW9ucy5mb3JFYWNoKChvcHQpID0+IHtcbiAgICAgICAgY29uc3QgbyA9IHNlbGVjdC5jcmVhdGVFbChcIm9wdGlvblwiLCB7IHRleHQ6IG9wdCwgdmFsdWU6IG9wdCB9KTtcbiAgICAgICAgaWYgKG9wdCA9PT0gcmF3VmFsdWUudHJpbSgpKSBvLnNlbGVjdGVkID0gdHJ1ZTtcbiAgICAgIH0pO1xuICAgICAgaWYgKCFyYXdWYWx1ZS50cmltKCkpIHNlbGVjdC5vcHRpb25zWzBdLnNlbGVjdGVkID0gdHJ1ZTtcbiAgICAgIHNlbGVjdC5hZGRFdmVudExpc3RlbmVyKFwiY2hhbmdlXCIsICgpID0+IHtcbiAgICAgICAgdm9pZCBvbkNoYW5nZShzZWxlY3QudmFsdWUpO1xuICAgICAgfSk7XG4gICAgICBicmVhaztcbiAgICB9XG4gICAgY2FzZSBcIm11bHRpLXNlbGVjdFwiOiB7XG4gICAgICBjb25zdCB3cmFwID0gdGQuY3JlYXRlRGl2KFwiemliYXNlLW11bHRpLXNlbGVjdC13cmFwXCIpO1xuICAgICAgY29uc3QgdGFncyA9IHBhcnNlTXVsdGlTZWxlY3QocmF3VmFsdWUpO1xuICAgICAgaWYgKHRhZ3MubGVuZ3RoID09PSAwKSB7XG4gICAgICAgIGNvbnN0IGVtcHR5ID0gd3JhcC5jcmVhdGVTcGFuKHsgdGV4dDogXCJcdTIwMTRcIiwgY2xzOiBcInppYmFzZS10ZXh0LWVtcHR5XCIgfSk7XG4gICAgICAgIGVtcHR5LmFkZEV2ZW50TGlzdGVuZXIoXCJjbGlja1wiLCAoKSA9PiBzdGFydExhYmVsRWRpdCh3cmFwLCByYXdWYWx1ZSwgb25DaGFuZ2UpKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHRhZ3MuZm9yRWFjaCgodGFnKSA9PiB7XG4gICAgICAgICAgY29uc3QgY2hpcCA9IHdyYXAuY3JlYXRlU3Bhbih7IHRleHQ6IHRhZywgY2xzOiBcInppYmFzZS1sYWJlbFwiIH0pO1xuICAgICAgICAgIGNoaXAuc2V0Q3NzUHJvcHMoeyBcIi0tbGNcIjogZ2V0TGFiZWxDb2xvcih0YWcpIH0pO1xuICAgICAgICAgIGNoaXAuYWRkRXZlbnRMaXN0ZW5lcihcImNsaWNrXCIsIChlKSA9PiB7XG4gICAgICAgICAgICBlLnN0b3BQcm9wYWdhdGlvbigpO1xuICAgICAgICAgICAgc3RhcnRMYWJlbEVkaXQod3JhcCwgcmF3VmFsdWUsIG9uQ2hhbmdlKTtcbiAgICAgICAgICB9KTtcbiAgICAgICAgfSk7XG4gICAgICAgIHdyYXAuYWRkRXZlbnRMaXN0ZW5lcihcImNsaWNrXCIsICgpID0+IHN0YXJ0TGFiZWxFZGl0KHdyYXAsIHJhd1ZhbHVlLCBvbkNoYW5nZSkpO1xuICAgICAgfVxuICAgICAgYnJlYWs7XG4gICAgfVxuICAgIGNhc2UgXCJsYWJlbFwiOiB7XG4gICAgICBjb25zdCBjaGlwID0gdGQuY3JlYXRlRWwoXCJzcGFuXCIsIHsgdGV4dDogcmF3VmFsdWUudHJpbSgpIHx8IFwiXHUyMDE0XCIsIGNsczogXCJ6aWJhc2UtbGFiZWxcIiB9KTtcbiAgICAgIGNoaXAuc2V0Q3NzUHJvcHMoeyBcIi0tbGNcIjogZ2V0TGFiZWxDb2xvcihyYXdWYWx1ZS50cmltKCkpIH0pO1xuICAgICAgY2hpcC5hZGRFdmVudExpc3RlbmVyKFwiY2xpY2tcIiwgKCkgPT4gc3RhcnRMYWJlbEVkaXQoY2hpcCwgcmF3VmFsdWUudHJpbSgpLCBvbkNoYW5nZSkpO1xuICAgICAgYnJlYWs7XG4gICAgfVxuICAgIGNhc2UgXCJudW1iZXJcIjoge1xuICAgICAgY29uc3QgaW5wdXQgPSB0ZC5jcmVhdGVFbChcImlucHV0XCIsIHsgdHlwZTogXCJudW1iZXJcIiwgY2xzOiBcInppYmFzZS1udW1iZXJcIiB9KTtcbiAgICAgIGlucHV0LnZhbHVlID0gcmF3VmFsdWUudHJpbSgpO1xuICAgICAgbGV0IGRlYm91bmNlID0gMDtcbiAgICAgIGlucHV0LmFkZEV2ZW50TGlzdGVuZXIoXCJpbnB1dFwiLCAoKSA9PiB7XG4gICAgICAgIHdpbmRvdy5jbGVhclRpbWVvdXQoZGVib3VuY2UpO1xuICAgICAgICBkZWJvdW5jZSA9IHdpbmRvdy5zZXRUaW1lb3V0KCgpID0+IHtcbiAgICAgICAgICB2b2lkIG9uQ2hhbmdlKGlucHV0LnZhbHVlKTtcbiAgICAgICAgfSwgNDAwKTtcbiAgICAgIH0pO1xuICAgICAgYnJlYWs7XG4gICAgfVxuICAgIGNhc2UgXCJkYXRlXCI6IHtcbiAgICAgIGNvbnN0IHZhbCA9IHJhd1ZhbHVlLnRyaW0oKTtcbiAgICAgIGNvbnN0IGRpc3BsYXlTcGFuID0gdGQuY3JlYXRlU3Bhbih7IHRleHQ6IHZhbCB8fCBcIlx1MjAxNFwiLCBjbHM6IHZhbCA/IFwiemliYXNlLWRhdGUtcmVuZGVyZWRcIiA6IFwiemliYXNlLXRleHQtZW1wdHlcIiB9KTtcbiAgICAgIHRkLmFkZEV2ZW50TGlzdGVuZXIoXCJjbGlja1wiLCAoKSA9PiB7XG4gICAgICAgIGlmICh0ZC5xdWVyeVNlbGVjdG9yKFwiaW5wdXRcIikpIHJldHVybjtcbiAgICAgICAgZGlzcGxheVNwYW4uc2V0Q3NzU3R5bGVzKHsgZGlzcGxheTogXCJub25lXCIgfSk7XG4gICAgICAgIGNvbnN0IGlucHV0ID0gdGQuY3JlYXRlRWwoXCJpbnB1dFwiLCB7IHR5cGU6IFwiZGF0ZVwiLCBjbHM6IFwiemliYXNlLWRhdGVcIiB9KTtcbiAgICAgICAgaW5wdXQudmFsdWUgPSB2YWw7XG4gICAgICAgIGlucHV0LmZvY3VzKCk7XG4gICAgICAgIGNvbnN0IHBpY2tlciA9IGlucHV0IGFzIEhUTUxJbnB1dEVsZW1lbnQgJiB7IHNob3dQaWNrZXI/OiAoKSA9PiB2b2lkIH07XG4gICAgICAgIGlmICh0eXBlb2YgcGlja2VyLnNob3dQaWNrZXIgPT09IFwiZnVuY3Rpb25cIikge1xuICAgICAgICAgIHRyeSB7IHBpY2tlci5zaG93UGlja2VyKCk7IH0gY2F0Y2ggeyAvKiBpZ25vcmVkICovIH1cbiAgICAgICAgfVxuICAgICAgICBjb25zdCBjb21taXQgPSBhc3luYyAoKSA9PiB7XG4gICAgICAgICAgY29uc3QgbmV3VmFsID0gaW5wdXQudmFsdWU7XG4gICAgICAgICAgaW5wdXQucmVtb3ZlKCk7XG4gICAgICAgICAgZGlzcGxheVNwYW4udGV4dENvbnRlbnQgPSBuZXdWYWwgfHwgXCJcdTIwMTRcIjtcbiAgICAgICAgICBkaXNwbGF5U3Bhbi5jbGFzc05hbWUgPSBuZXdWYWwgPyBcInppYmFzZS1kYXRlLXJlbmRlcmVkXCIgOiBcInppYmFzZS10ZXh0LWVtcHR5XCI7XG4gICAgICAgICAgZGlzcGxheVNwYW4uc2V0Q3NzU3R5bGVzKHsgZGlzcGxheTogXCJcIiB9KTtcbiAgICAgICAgICBhd2FpdCBvbkNoYW5nZShuZXdWYWwpO1xuICAgICAgICB9O1xuICAgICAgICBpbnB1dC5hZGRFdmVudExpc3RlbmVyKFwiYmx1clwiLCAoKSA9PiB7IHZvaWQgY29tbWl0KCk7IH0pO1xuICAgICAgICBpbnB1dC5hZGRFdmVudExpc3RlbmVyKFwia2V5ZG93blwiLCAoZSkgPT4ge1xuICAgICAgICAgIGlmIChlLmtleSA9PT0gXCJFbnRlclwiKSB2b2lkIGNvbW1pdCgpO1xuICAgICAgICAgIGlmIChlLmtleSA9PT0gXCJFc2NhcGVcIikge1xuICAgICAgICAgICAgaW5wdXQucmVtb3ZlKCk7XG4gICAgICAgICAgICBkaXNwbGF5U3Bhbi5zZXRDc3NTdHlsZXMoeyBkaXNwbGF5OiBcIlwiIH0pO1xuICAgICAgICAgIH1cbiAgICAgICAgfSk7XG4gICAgICB9KTtcbiAgICAgIGJyZWFrO1xuICAgIH1cbiAgICBjYXNlIFwiZm9ybXVsYVwiOiB7XG4gICAgICBjb25zdCB2YWwgPSByYXdWYWx1ZS50cmltKCk7XG4gICAgICBpZiAoaXNCYWNrdGlja2VkKHZhbCkpIHtcbiAgICAgICAgdGQuY3JlYXRlU3Bhbih7IHRleHQ6IHN0cmlwQmFja3RpY2tzKHZhbCksIGNsczogXCJ6aWJhc2UtZm9ybXVsYS1zb3VyY2VcIiB9KTtcbiAgICAgICAgYnJlYWs7XG4gICAgICB9XG4gICAgICBpZiAoaXNTaW1wbGVNYXRoKHZhbCkpIHtcbiAgICAgICAgY29uc3QgcmVzdWx0ID0gZXZhbHVhdGVTaW1wbGVNYXRoKHZhbCk7XG4gICAgICAgIGNvbnN0IHNwYW4gPSB0ZC5jcmVhdGVTcGFuKHsgdGV4dDogZm9ybWF0UmVzdWx0KHJlc3VsdCksIGNsczogXCJ6aWJhc2UtZm9ybXVsYS1yZXN1bHRcIiB9KTtcbiAgICAgICAgc3Bhbi50aXRsZSA9IHZhbDtcbiAgICAgICAgYnJlYWs7XG4gICAgICB9XG4gICAgICBpZiAoY29sLnR5cGUuZXhwcmVzc2lvbikge1xuICAgICAgICBjb25zdCByb3dEYXRhOiBSZWNvcmQ8c3RyaW5nLCBzdHJpbmc+ID0ge307XG4gICAgICAgIHNjaGVtYS5jb2x1bW5zLmZvckVhY2goKGMsIGkpID0+IHtcbiAgICAgICAgICByb3dEYXRhW2MubmFtZV0gPSAocm93Q2VsbHNbaV0gPz8gXCJcIikudHJpbSgpO1xuICAgICAgICB9KTtcbiAgICAgICAgY29uc3QgcmVzdWx0ID0gZXZhbHVhdGVGb3JtdWxhKGNvbC50eXBlLmV4cHJlc3Npb24sIHJvd0RhdGEpO1xuICAgICAgICBjb25zdCBkaXNwbGF5VmFsID0gZm9ybWF0UmVzdWx0KHJlc3VsdCk7XG4gICAgICAgIGNvbnN0IHNwYW4gPSB0ZC5jcmVhdGVTcGFuKHsgdGV4dDogZGlzcGxheVZhbCwgY2xzOiBcInppYmFzZS1mb3JtdWxhLXJlc3VsdFwiIH0pO1xuICAgICAgICBzcGFuLnRpdGxlID0gYFx1MDE5MiAke2NvbC50eXBlLmV4cHJlc3Npb259ID0gJHtkaXNwbGF5VmFsfWA7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICB0ZC5jcmVhdGVTcGFuKHsgdGV4dDogdmFsIHx8IFwiXHUwMTkyXCIsIGNsczogXCJ6aWJhc2UtZm9ybXVsYS1lbXB0eVwiIH0pO1xuICAgICAgfVxuICAgICAgYnJlYWs7XG4gICAgfVxuICAgIGRlZmF1bHQ6IHtcbiAgICAgIGNvbnN0IHZhbCA9IHJhd1ZhbHVlLnRyaW0oKTtcbiAgICAgIHRkLmRhdGFzZXQucmF3ID0gdmFsO1xuXG4gICAgICBpZiAoaXNTaW1wbGVNYXRoKHZhbCkpIHtcbiAgICAgICAgY29uc3QgcmVzdWx0ID0gZXZhbHVhdGVTaW1wbGVNYXRoKHZhbCk7XG4gICAgICAgIGNvbnN0IHNwYW4gPSB0ZC5jcmVhdGVTcGFuKHsgdGV4dDogZm9ybWF0UmVzdWx0KHJlc3VsdCksIGNsczogXCJ6aWJhc2UtZm9ybXVsYS1yZXN1bHQgemliYXNlLXRleHQtcmVuZGVyZWRcIiB9KTtcbiAgICAgICAgc3Bhbi50aXRsZSA9IHZhbDtcbiAgICAgICAgdGQuYWRkRXZlbnRMaXN0ZW5lcihcImNsaWNrXCIsIChlKSA9PiB7XG4gICAgICAgICAgZS5wcmV2ZW50RGVmYXVsdCgpO1xuICAgICAgICAgIGUuc3RvcFByb3BhZ2F0aW9uKCk7XG4gICAgICAgICAgc3RhcnRNYXJrZG93bkVkaXQodGQsIHRkLmRhdGFzZXQucmF3IHx8IHZhbCwgY29udGV4dCwgaG9zdCwgb25DaGFuZ2UpO1xuICAgICAgICB9KTtcbiAgICAgICAgYnJlYWs7XG4gICAgICB9XG5cbiAgICAgIGlmIChpc0JhY2t0aWNrZWQodmFsKSkge1xuICAgICAgICB0ZC5jcmVhdGVTcGFuKHsgdGV4dDogc3RyaXBCYWNrdGlja3ModmFsKSwgY2xzOiBcInppYmFzZS1mb3JtdWxhLXNvdXJjZSB6aWJhc2UtdGV4dC1yZW5kZXJlZFwiIH0pO1xuICAgICAgICB0ZC5hZGRFdmVudExpc3RlbmVyKFwiY2xpY2tcIiwgKGUpID0+IHtcbiAgICAgICAgICBlLnByZXZlbnREZWZhdWx0KCk7XG4gICAgICAgICAgZS5zdG9wUHJvcGFnYXRpb24oKTtcbiAgICAgICAgICBzdGFydE1hcmtkb3duRWRpdCh0ZCwgdGQuZGF0YXNldC5yYXcgfHwgdmFsLCBjb250ZXh0LCBob3N0LCBvbkNoYW5nZSk7XG4gICAgICAgIH0pO1xuICAgICAgICBicmVhaztcbiAgICAgIH1cblxuICAgICAgY29uc3QgZGlzcGxheVNwYW4gPSB0ZC5jcmVhdGVTcGFuKHsgY2xzOiBcInppYmFzZS10ZXh0LXJlbmRlcmVkXCIgfSk7XG4gICAgICBpZiAodmFsKSB7XG4gICAgICAgIHZvaWQgTWFya2Rvd25SZW5kZXJlci5yZW5kZXIoaG9zdC5hcHAsIHZhbCwgZGlzcGxheVNwYW4sIGNvbnRleHQuc291cmNlUGF0aCwgaG9zdC5wbHVnaW4pLnRoZW4oKCkgPT4ge1xuICAgICAgICAgIGRpc3BsYXlTcGFuLnF1ZXJ5U2VsZWN0b3JBbGwoXCJhXCIpLmZvckVhY2goKGEpID0+IGF0dGFjaExpbmtUb29sdGlwKGEpKTtcbiAgICAgICAgICB0ZC5hZGRFdmVudExpc3RlbmVyKFwiY2xpY2tcIiwgKGUpID0+IHtcbiAgICAgICAgICAgIGlmIChlLmFsdEtleSkge1xuICAgICAgICAgICAgICBlLnByZXZlbnREZWZhdWx0KCk7XG4gICAgICAgICAgICAgIGUuc3RvcFByb3BhZ2F0aW9uKCk7XG4gICAgICAgICAgICAgIHN0YXJ0TWFya2Rvd25FZGl0KHRkLCB0ZC5kYXRhc2V0LnJhdyB8fCB2YWwsIGNvbnRleHQsIGhvc3QsIG9uQ2hhbmdlKTtcbiAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgY29uc3QgdGFyZ2V0ID0gZS50YXJnZXQgYXMgSFRNTEVsZW1lbnQgfCBudWxsO1xuICAgICAgICAgICAgaWYgKHRhcmdldD8uY2xvc2VzdD8uKFwiYVwiKSkgcmV0dXJuO1xuICAgICAgICAgICAgZS5wcmV2ZW50RGVmYXVsdCgpO1xuICAgICAgICAgICAgZS5zdG9wUHJvcGFnYXRpb24oKTtcbiAgICAgICAgICAgIHN0YXJ0TWFya2Rvd25FZGl0KHRkLCB0ZC5kYXRhc2V0LnJhdyB8fCB2YWwsIGNvbnRleHQsIGhvc3QsIG9uQ2hhbmdlKTtcbiAgICAgICAgICB9LCB0cnVlKTtcbiAgICAgICAgfSk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBkaXNwbGF5U3Bhbi50ZXh0Q29udGVudCA9IFwiXHUyMDE0XCI7XG4gICAgICAgIGRpc3BsYXlTcGFuLmNsYXNzTGlzdC5hZGQoXCJ6aWJhc2UtdGV4dC1lbXB0eVwiKTtcbiAgICAgICAgdGQuYWRkRXZlbnRMaXN0ZW5lcihcImNsaWNrXCIsIChlKSA9PiB7XG4gICAgICAgICAgZS5wcmV2ZW50RGVmYXVsdCgpO1xuICAgICAgICAgIGUuc3RvcFByb3BhZ2F0aW9uKCk7XG4gICAgICAgICAgc3RhcnRNYXJrZG93bkVkaXQodGQsIHRkLmRhdGFzZXQucmF3ID8/IHZhbCwgY29udGV4dCwgaG9zdCwgb25DaGFuZ2UpO1xuICAgICAgICB9KTtcbiAgICAgIH1cbiAgICAgIGJyZWFrO1xuICAgIH1cbiAgfVxufVxuIiwgImNvbnN0IEZPUk1VTEFfTlVNQkVSX1JFID0gL14tP1xcZCsoXFwuXFxkKyk/JC87XG5cbmV4cG9ydCBmdW5jdGlvbiBpc0JhY2t0aWNrZWQocmF3OiBzdHJpbmcpOiBib29sZWFuIHtcbiAgY29uc3QgdHJpbW1lZCA9IHJhdy50cmltKCk7XG4gIHJldHVybiB0cmltbWVkLnN0YXJ0c1dpdGgoXCJgXCIpICYmIHRyaW1tZWQuZW5kc1dpdGgoXCJgXCIpICYmIHRyaW1tZWQubGVuZ3RoID49IDI7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBzdHJpcEJhY2t0aWNrcyhyYXc6IHN0cmluZyk6IHN0cmluZyB7XG4gIGNvbnN0IHRyaW1tZWQgPSByYXcudHJpbSgpO1xuICByZXR1cm4gdHJpbW1lZC5zbGljZSgxLCAtMSk7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBpc1NpbXBsZU1hdGgocmF3OiBzdHJpbmcpOiBib29sZWFuIHtcbiAgY29uc3QgdHJpbW1lZCA9IHJhdy50cmltKCk7XG4gIGlmICghdHJpbW1lZCkgcmV0dXJuIGZhbHNlO1xuICBpZiAoRk9STVVMQV9OVU1CRVJfUkUudGVzdCh0cmltbWVkKSkgcmV0dXJuIGZhbHNlO1xuICBpZiAoIS9eW1xcZFxccytcXC0qLyUoKS5dKyQvLnRlc3QodHJpbW1lZCkpIHJldHVybiBmYWxzZTtcbiAgaWYgKCEvWytcXC0qLyVdLy50ZXN0KHRyaW1tZWQpKSByZXR1cm4gZmFsc2U7XG4gIGlmICgvXlsrKi8lXS8udGVzdCh0cmltbWVkKSkgcmV0dXJuIGZhbHNlO1xuICByZXR1cm4gdHJ1ZTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGV2YWx1YXRlRm9ybXVsYShleHByZXNzaW9uOiBzdHJpbmcsIHJvd0RhdGE6IFJlY29yZDxzdHJpbmcsIHN0cmluZz4pOiBudW1iZXIgfCBudWxsIHtcbiAgaWYgKCFleHByZXNzaW9uIHx8ICFleHByZXNzaW9uLnRyaW0oKSkgcmV0dXJuIG51bGw7XG5cbiAgbGV0IHJlc29sdmVkID0gZXhwcmVzc2lvbjtcbiAgY29uc3QgY29sTmFtZXMgPSBPYmplY3Qua2V5cyhyb3dEYXRhKS5zb3J0KChhLCBiKSA9PiBiLmxlbmd0aCAtIGEubGVuZ3RoKTtcblxuICBmb3IgKGNvbnN0IGNvbE5hbWUgb2YgY29sTmFtZXMpIHtcbiAgICBjb25zdCByZWdleCA9IG5ldyBSZWdFeHAoXCJcXFxcYlwiICsgZXNjYXBlUmVnZXgoY29sTmFtZSkgKyBcIlxcXFxiXCIsIFwiZ2lcIik7XG4gICAgaWYgKCFyZWdleC50ZXN0KHJlc29sdmVkKSkgY29udGludWU7XG4gICAgcmVnZXgubGFzdEluZGV4ID0gMDtcblxuICAgIGNvbnN0IHJhd1ZhbCA9IHJvd0RhdGFbY29sTmFtZV07XG4gICAgY29uc3QgbnVtVmFsID0gcGFyc2VGbG9hdChyYXdWYWwpO1xuICAgIGlmIChOdW1iZXIuaXNOYU4obnVtVmFsKSkgcmV0dXJuIG51bGw7XG5cbiAgICByZXNvbHZlZCA9IHJlc29sdmVkLnJlcGxhY2UocmVnZXgsIG51bVZhbC50b1N0cmluZygpKTtcbiAgfVxuXG4gIHRyeSB7XG4gICAgcmV0dXJuIHNhZmVFdmFsKHJlc29sdmVkKTtcbiAgfSBjYXRjaCB7XG4gICAgcmV0dXJuIG51bGw7XG4gIH1cbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGV2YWx1YXRlU2ltcGxlTWF0aChleHByZXNzaW9uOiBzdHJpbmcpOiBudW1iZXIgfCBudWxsIHtcbiAgdHJ5IHtcbiAgICByZXR1cm4gc2FmZUV2YWwoZXhwcmVzc2lvbik7XG4gIH0gY2F0Y2gge1xuICAgIHJldHVybiBudWxsO1xuICB9XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBmb3JtYXRSZXN1bHQodmFsdWU6IG51bWJlciB8IG51bGwgfCB1bmRlZmluZWQpOiBzdHJpbmcge1xuICBpZiAodmFsdWUgPT09IG51bGwgfHwgdmFsdWUgPT09IHVuZGVmaW5lZCB8fCBOdW1iZXIuaXNOYU4odmFsdWUpKSByZXR1cm4gXCJcdTIwMTRcIjtcbiAgaWYgKCFOdW1iZXIuaXNGaW5pdGUodmFsdWUpKSByZXR1cm4gXCJcdTIyMUVcIjtcbiAgcmV0dXJuIHBhcnNlRmxvYXQodmFsdWUudG9GaXhlZCg2KSkudG9TdHJpbmcoKTtcbn1cblxuaW50ZXJmYWNlIFRva2VuIHtcbiAgdHlwZTogXCJudW1iZXJcIiB8IFwib3BcIiB8IFwibHBhcmVuXCIgfCBcInJwYXJlblwiO1xuICB2YWx1ZTogbnVtYmVyIHwgc3RyaW5nO1xufVxuXG5pbnRlcmZhY2UgUGFyc2VyIHtcbiAgdG9rZW5zOiBUb2tlbltdO1xuICBwb3M6IG51bWJlcjtcbn1cblxuZnVuY3Rpb24gc2FmZUV2YWwoZXhwcmVzc2lvbjogc3RyaW5nKTogbnVtYmVyIHtcbiAgY29uc3QgdG9rZW5zID0gdG9rZW5pemUoZXhwcmVzc2lvbik7XG4gIGNvbnN0IHBhcnNlcjogUGFyc2VyID0geyB0b2tlbnMsIHBvczogMCB9O1xuICBjb25zdCByZXN1bHQgPSBwYXJzZUV4cHIocGFyc2VyKTtcbiAgaWYgKHBhcnNlci5wb3MgPCBwYXJzZXIudG9rZW5zLmxlbmd0aCkge1xuICAgIHRocm93IG5ldyBFcnJvcihcIlVuZXhwZWN0ZWQgdG9rZW46IFwiICsgU3RyaW5nKHBhcnNlci50b2tlbnNbcGFyc2VyLnBvc10udmFsdWUpKTtcbiAgfVxuICByZXR1cm4gcmVzdWx0O1xufVxuXG5mdW5jdGlvbiB0b2tlbml6ZShleHByOiBzdHJpbmcpOiBUb2tlbltdIHtcbiAgY29uc3QgdG9rZW5zOiBUb2tlbltdID0gW107XG4gIGxldCBpID0gMDtcbiAgY29uc3QgcyA9IGV4cHIudHJpbSgpO1xuXG4gIHdoaWxlIChpIDwgcy5sZW5ndGgpIHtcbiAgICBpZiAoc1tpXSA9PT0gXCIgXCIgfHwgc1tpXSA9PT0gXCJcXHRcIikge1xuICAgICAgaSsrO1xuICAgICAgY29udGludWU7XG4gICAgfVxuXG4gICAgaWYgKChzW2ldID49IFwiMFwiICYmIHNbaV0gPD0gXCI5XCIpIHx8IChzW2ldID09PSBcIi5cIiAmJiBpICsgMSA8IHMubGVuZ3RoICYmIHNbaSArIDFdID49IFwiMFwiICYmIHNbaSArIDFdIDw9IFwiOVwiKSkge1xuICAgICAgbGV0IG51bSA9IFwiXCI7XG4gICAgICB3aGlsZSAoaSA8IHMubGVuZ3RoICYmICgoc1tpXSA+PSBcIjBcIiAmJiBzW2ldIDw9IFwiOVwiKSB8fCBzW2ldID09PSBcIi5cIikpIHtcbiAgICAgICAgbnVtICs9IHNbaV07XG4gICAgICAgIGkrKztcbiAgICAgIH1cbiAgICAgIHRva2Vucy5wdXNoKHsgdHlwZTogXCJudW1iZXJcIiwgdmFsdWU6IHBhcnNlRmxvYXQobnVtKSB9KTtcbiAgICAgIGNvbnRpbnVlO1xuICAgIH1cblxuICAgIGlmIChcIistKi8lXCIuaW5jbHVkZXMoc1tpXSkpIHtcbiAgICAgIHRva2Vucy5wdXNoKHsgdHlwZTogXCJvcFwiLCB2YWx1ZTogc1tpXSB9KTtcbiAgICAgIGkrKztcbiAgICAgIGNvbnRpbnVlO1xuICAgIH1cblxuICAgIGlmIChzW2ldID09PSBcIihcIikge1xuICAgICAgdG9rZW5zLnB1c2goeyB0eXBlOiBcImxwYXJlblwiLCB2YWx1ZTogXCIoXCIgfSk7XG4gICAgICBpKys7XG4gICAgICBjb250aW51ZTtcbiAgICB9XG4gICAgaWYgKHNbaV0gPT09IFwiKVwiKSB7XG4gICAgICB0b2tlbnMucHVzaCh7IHR5cGU6IFwicnBhcmVuXCIsIHZhbHVlOiBcIilcIiB9KTtcbiAgICAgIGkrKztcbiAgICAgIGNvbnRpbnVlO1xuICAgIH1cblxuICAgIHRocm93IG5ldyBFcnJvcihcIlVuZXhwZWN0ZWQgY2hhcmFjdGVyOiBcIiArIHNbaV0pO1xuICB9XG5cbiAgcmV0dXJuIHRva2Vucztcbn1cblxuZnVuY3Rpb24gcGFyc2VFeHByKHBhcnNlcjogUGFyc2VyKTogbnVtYmVyIHtcbiAgbGV0IGxlZnQgPSBwYXJzZVRlcm0ocGFyc2VyKTtcblxuICB3aGlsZSAocGFyc2VyLnBvcyA8IHBhcnNlci50b2tlbnMubGVuZ3RoKSB7XG4gICAgY29uc3QgdG9rID0gcGFyc2VyLnRva2Vuc1twYXJzZXIucG9zXTtcbiAgICBpZiAodG9rLnR5cGUgPT09IFwib3BcIiAmJiAodG9rLnZhbHVlID09PSBcIitcIiB8fCB0b2sudmFsdWUgPT09IFwiLVwiKSkge1xuICAgICAgcGFyc2VyLnBvcysrO1xuICAgICAgY29uc3QgcmlnaHQgPSBwYXJzZVRlcm0ocGFyc2VyKTtcbiAgICAgIGxlZnQgPSB0b2sudmFsdWUgPT09IFwiK1wiID8gbGVmdCArIHJpZ2h0IDogbGVmdCAtIHJpZ2h0O1xuICAgIH0gZWxzZSB7XG4gICAgICBicmVhaztcbiAgICB9XG4gIH1cblxuICByZXR1cm4gbGVmdDtcbn1cblxuZnVuY3Rpb24gcGFyc2VUZXJtKHBhcnNlcjogUGFyc2VyKTogbnVtYmVyIHtcbiAgbGV0IGxlZnQgPSBwYXJzZVVuYXJ5KHBhcnNlcik7XG5cbiAgd2hpbGUgKHBhcnNlci5wb3MgPCBwYXJzZXIudG9rZW5zLmxlbmd0aCkge1xuICAgIGNvbnN0IHRvayA9IHBhcnNlci50b2tlbnNbcGFyc2VyLnBvc107XG4gICAgaWYgKHRvay50eXBlID09PSBcIm9wXCIgJiYgKHRvay52YWx1ZSA9PT0gXCIqXCIgfHwgdG9rLnZhbHVlID09PSBcIi9cIiB8fCB0b2sudmFsdWUgPT09IFwiJVwiKSkge1xuICAgICAgcGFyc2VyLnBvcysrO1xuICAgICAgY29uc3QgcmlnaHQgPSBwYXJzZVVuYXJ5KHBhcnNlcik7XG4gICAgICBpZiAodG9rLnZhbHVlID09PSBcIipcIikgbGVmdCA9IGxlZnQgKiByaWdodDtcbiAgICAgIGVsc2UgaWYgKHRvay52YWx1ZSA9PT0gXCIvXCIpIGxlZnQgPSByaWdodCA9PT0gMCA/IEluZmluaXR5IDogbGVmdCAvIHJpZ2h0O1xuICAgICAgZWxzZSBsZWZ0ID0gbGVmdCAlIHJpZ2h0O1xuICAgIH0gZWxzZSB7XG4gICAgICBicmVhaztcbiAgICB9XG4gIH1cblxuICByZXR1cm4gbGVmdDtcbn1cblxuZnVuY3Rpb24gcGFyc2VVbmFyeShwYXJzZXI6IFBhcnNlcik6IG51bWJlciB7XG4gIGlmIChwYXJzZXIucG9zIDwgcGFyc2VyLnRva2Vucy5sZW5ndGgpIHtcbiAgICBjb25zdCB0b2sgPSBwYXJzZXIudG9rZW5zW3BhcnNlci5wb3NdO1xuICAgIGlmICh0b2sudHlwZSA9PT0gXCJvcFwiICYmIHRvay52YWx1ZSA9PT0gXCItXCIpIHtcbiAgICAgIHBhcnNlci5wb3MrKztcbiAgICAgIHJldHVybiAtcGFyc2VVbmFyeShwYXJzZXIpO1xuICAgIH1cbiAgICBpZiAodG9rLnR5cGUgPT09IFwib3BcIiAmJiB0b2sudmFsdWUgPT09IFwiK1wiKSB7XG4gICAgICBwYXJzZXIucG9zKys7XG4gICAgICByZXR1cm4gcGFyc2VVbmFyeShwYXJzZXIpO1xuICAgIH1cbiAgfVxuICByZXR1cm4gcGFyc2VQcmltYXJ5KHBhcnNlcik7XG59XG5cbmZ1bmN0aW9uIHBhcnNlUHJpbWFyeShwYXJzZXI6IFBhcnNlcik6IG51bWJlciB7XG4gIGlmIChwYXJzZXIucG9zID49IHBhcnNlci50b2tlbnMubGVuZ3RoKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKFwiVW5leHBlY3RlZCBlbmQgb2YgZXhwcmVzc2lvblwiKTtcbiAgfVxuXG4gIGNvbnN0IHRvayA9IHBhcnNlci50b2tlbnNbcGFyc2VyLnBvc107XG5cbiAgaWYgKHRvay50eXBlID09PSBcIm51bWJlclwiKSB7XG4gICAgcGFyc2VyLnBvcysrO1xuICAgIHJldHVybiB0b2sudmFsdWUgYXMgbnVtYmVyO1xuICB9XG5cbiAgaWYgKHRvay50eXBlID09PSBcImxwYXJlblwiKSB7XG4gICAgcGFyc2VyLnBvcysrO1xuICAgIGNvbnN0IHJlc3VsdCA9IHBhcnNlRXhwcihwYXJzZXIpO1xuICAgIGlmIChwYXJzZXIucG9zID49IHBhcnNlci50b2tlbnMubGVuZ3RoIHx8IHBhcnNlci50b2tlbnNbcGFyc2VyLnBvc10udHlwZSAhPT0gXCJycGFyZW5cIikge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKFwiTWlzc2luZyBjbG9zaW5nIHBhcmVudGhlc2lzXCIpO1xuICAgIH1cbiAgICBwYXJzZXIucG9zKys7XG4gICAgcmV0dXJuIHJlc3VsdDtcbiAgfVxuXG4gIHRocm93IG5ldyBFcnJvcihcIlVuZXhwZWN0ZWQgdG9rZW46IFwiICsgU3RyaW5nKHRvay52YWx1ZSkpO1xufVxuXG5mdW5jdGlvbiBlc2NhcGVSZWdleChzdHI6IHN0cmluZyk6IHN0cmluZyB7XG4gIHJldHVybiBzdHIucmVwbGFjZSgvWy4qKz9eJHt9KCl8W1xcXVxcXFxdL2csIFwiXFxcXCQmXCIpO1xufVxuIiwgImV4cG9ydCBjb25zdCBMQUJFTF9DT0xPUlMgPSBbXG4gIFwiIzRhZGU4MFwiLFxuICBcIiM2MGE1ZmFcIixcbiAgXCIjZjQ3MmI2XCIsXG4gIFwiI2ZiOTIzY1wiLFxuICBcIiNhNzhiZmFcIixcbiAgXCIjMzRkMzk5XCIsXG4gIFwiI2ZiYmYyNFwiLFxuICBcIiNmODcxNzFcIixcbiAgXCIjMzhiZGY4XCIsXG4gIFwiI2MwODRmY1wiLFxuICBcIiM4NmVmYWNcIixcbiAgXCIjNjdlOGY5XCIsXG4gIFwiI2ZkYmE3NFwiLFxuICBcIiNhM2U2MzVcIixcbiAgXCIjZTg3OWY5XCIsXG4gIFwiIzIyZDNlZVwiLFxuICBcIiNmZjZiNmJcIixcbiAgXCIjZmZkOTNkXCIsXG4gIFwiIzZiY2I3N1wiLFxuICBcIiM0ZDk2ZmZcIixcbl07XG5cbmV4cG9ydCBmdW5jdGlvbiBoYXNoU3RyKHN0cjogc3RyaW5nKTogbnVtYmVyIHtcbiAgbGV0IGggPSA1MzgxO1xuICBmb3IgKGxldCBpID0gMDsgaSA8IHN0ci5sZW5ndGg7IGkrKykge1xuICAgIGggPSAoaCA8PCA1KSArIGggXiBzdHIuY2hhckNvZGVBdChpKTtcbiAgICBoID0gaCA+Pj4gMDtcbiAgfVxuICByZXR1cm4gaDtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGdldExhYmVsQ29sb3IodmFsdWU6IHN0cmluZyk6IHN0cmluZyB7XG4gIHJldHVybiBMQUJFTF9DT0xPUlNbaGFzaFN0cih2YWx1ZS50cmltKCkudG9Mb3dlckNhc2UoKSkgJSBMQUJFTF9DT0xPUlMubGVuZ3RoXTtcbn1cbiIsICJpbXBvcnQgdHlwZSB7IENvbHVtblR5cGUgfSBmcm9tIFwiLi9tb2RlbFwiO1xuaW1wb3J0IHsgZ2V0TGFiZWxDb2xvciB9IGZyb20gXCIuL2NvbG9yc1wiO1xuXG5leHBvcnQgeyBnZXRMYWJlbENvbG9yIH07XG5cbmV4cG9ydCBmdW5jdGlvbiBnZXRUeXBlSWNvbih0eXBlOiBDb2x1bW5UeXBlKTogc3RyaW5nIHtcbiAgc3dpdGNoICh0eXBlLmtpbmQpIHtcbiAgICBjYXNlIFwidG9nZ2xlXCI6XG4gICAgICByZXR1cm4gXCJcdTJCMUNcIjtcbiAgICBjYXNlIFwic2VsZWN0XCI6XG4gICAgICByZXR1cm4gXCJcdTI1QkVcIjtcbiAgICBjYXNlIFwibXVsdGktc2VsZWN0XCI6XG4gICAgICByZXR1cm4gXCJcdUQ4M0NcdURGRjdcdUZFMEZcIjtcbiAgICBjYXNlIFwibGFiZWxcIjpcbiAgICAgIHJldHVybiBcIlx1MkIyMVwiO1xuICAgIGNhc2UgXCJudW1iZXJcIjpcbiAgICAgIHJldHVybiBcIiNcIjtcbiAgICBjYXNlIFwiZGF0ZVwiOlxuICAgICAgcmV0dXJuIFwiXHVEODNEXHVEQ0M1XCI7XG4gICAgY2FzZSBcImZvcm11bGFcIjpcbiAgICAgIHJldHVybiBcIlx1MDE5MlwiO1xuICAgIGRlZmF1bHQ6XG4gICAgICByZXR1cm4gXCJUXCI7XG4gIH1cbn1cblxuZXhwb3J0IGZ1bmN0aW9uIHNob3dUb2FzdChtZXNzYWdlOiBzdHJpbmcpOiB2b2lkIHtcbiAgY29uc3QgdG9hc3QgPSBjcmVhdGVEaXYoKTtcbiAgdG9hc3QuY2xhc3NOYW1lID0gXCJ6aWJhc2UtdG9hc3RcIjtcbiAgdG9hc3QudGV4dENvbnRlbnQgPSBtZXNzYWdlO1xuICBkb2N1bWVudC5ib2R5LmFwcGVuZENoaWxkKHRvYXN0KTtcbiAgd2luZG93LnNldFRpbWVvdXQoKCkgPT4gdG9hc3QuY2xhc3NMaXN0LmFkZChcInppYmFzZS10b2FzdC1zaG93XCIpLCAxMCk7XG4gIHdpbmRvdy5zZXRUaW1lb3V0KCgpID0+IHtcbiAgICB0b2FzdC5jbGFzc0xpc3QucmVtb3ZlKFwiemliYXNlLXRvYXN0LXNob3dcIik7XG4gICAgd2luZG93LnNldFRpbWVvdXQoKCkgPT4gdG9hc3QucmVtb3ZlKCksIDMwMCk7XG4gIH0sIDI1MDApO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gYXR0YWNoTGlua1Rvb2x0aXAoYTogSFRNTEFuY2hvckVsZW1lbnQpOiB2b2lkIHtcbiAgbGV0IHRvb2x0aXA6IEhUTUxFbGVtZW50IHwgbnVsbCA9IG51bGw7XG4gIGEuYWRkRXZlbnRMaXN0ZW5lcihcIm1vdXNlZW50ZXJcIiwgKCkgPT4ge1xuICAgIHRvb2x0aXAgPSBjcmVhdGVEaXYoKTtcbiAgICB0b29sdGlwLmNsYXNzTmFtZSA9IFwiemliYXNlLWxpbmstdG9vbHRpcFwiO1xuICAgIHRvb2x0aXAudGV4dENvbnRlbnQgPSBcIkFsdCtDbGljayB0byBlZGl0XCI7XG4gICAgZG9jdW1lbnQuYm9keS5hcHBlbmRDaGlsZCh0b29sdGlwKTtcbiAgICBjb25zdCByZWN0ID0gYS5nZXRCb3VuZGluZ0NsaWVudFJlY3QoKTtcbiAgICB0b29sdGlwLnNldENzc1N0eWxlcyh7IHRvcDogYCR7cmVjdC5ib3R0b20gKyB3aW5kb3cuc2Nyb2xsWSArIDR9cHhgIH0pO1xuICAgIHRvb2x0aXAuc2V0Q3NzU3R5bGVzKHsgbGVmdDogYCR7cmVjdC5sZWZ0ICsgd2luZG93LnNjcm9sbFh9cHhgIH0pO1xuICB9KTtcbiAgYS5hZGRFdmVudExpc3RlbmVyKFwibW91c2VsZWF2ZVwiLCAoKSA9PiB7XG4gICAgdG9vbHRpcD8ucmVtb3ZlKCk7XG4gICAgdG9vbHRpcCA9IG51bGw7XG4gIH0pO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gc3RhcnRMYWJlbEVkaXQoXG4gIGNoaXA6IEhUTUxFbGVtZW50LFxuICBjdXJyZW50OiBzdHJpbmcsXG4gIG9uQ2hhbmdlOiAodmFsdWU6IHN0cmluZykgPT4gUHJvbWlzZTx2b2lkPiB8IHZvaWQsXG4pOiB2b2lkIHtcbiAgY29uc3QgaW5wdXQgPSBjcmVhdGVFbChcImlucHV0XCIpO1xuICBpbnB1dC5jbGFzc05hbWUgPSBcInppYmFzZS1pbmxpbmUtaW5wdXRcIjtcbiAgaW5wdXQudmFsdWUgPSBjdXJyZW50O1xuICBjaGlwLnJlcGxhY2VXaXRoKGlucHV0KTtcbiAgaW5wdXQuZm9jdXMoKTtcbiAgaW5wdXQuc2VsZWN0KCk7XG4gIGNvbnN0IGNvbW1pdCA9IGFzeW5jICgpID0+IHtcbiAgICBjb25zdCBuZXdWYWwgPSBpbnB1dC52YWx1ZS50cmltKCkgfHwgY3VycmVudDtcbiAgICBhd2FpdCBvbkNoYW5nZShuZXdWYWwpO1xuICAgIGNoaXAudGV4dENvbnRlbnQgPSBuZXdWYWw7XG4gICAgY2hpcC5zZXRDc3NQcm9wcyh7IFwiLS1sY1wiOiBnZXRMYWJlbENvbG9yKG5ld1ZhbCkgfSk7XG4gICAgaW5wdXQucmVwbGFjZVdpdGgoY2hpcCk7XG4gIH07XG4gIGlucHV0LmFkZEV2ZW50TGlzdGVuZXIoXCJibHVyXCIsICgpID0+IHsgdm9pZCBjb21taXQoKTsgfSk7XG4gIGlucHV0LmFkZEV2ZW50TGlzdGVuZXIoXCJrZXlkb3duXCIsIChlKSA9PiB7XG4gICAgaWYgKGUua2V5ID09PSBcIkVudGVyXCIpIHZvaWQgY29tbWl0KCk7XG4gICAgaWYgKGUua2V5ID09PSBcIkVzY2FwZVwiKSBpbnB1dC5yZXBsYWNlV2l0aChjaGlwKTtcbiAgfSk7XG59XG4iLCAiaW1wb3J0IHsgTW9kYWwsIHR5cGUgQXBwIH0gZnJvbSBcIm9ic2lkaWFuXCI7XG5pbXBvcnQgdHlwZSB7IENvbHVtbiB9IGZyb20gXCIuL21vZGVsXCI7XG5cbmV4cG9ydCBjbGFzcyBTZWxlY3RPcHRpb25zTW9kYWwgZXh0ZW5kcyBNb2RhbCB7XG4gIGNvbE5hbWU6IHN0cmluZztcbiAgY3VycmVudE9wdGlvbnM6IHN0cmluZ1tdO1xuICBvblN1Ym1pdDogKG9wdGlvbnM6IHN0cmluZ1tdKSA9PiB2b2lkO1xuXG4gIGNvbnN0cnVjdG9yKGFwcDogQXBwLCBjb2xOYW1lOiBzdHJpbmcsIGN1cnJlbnRPcHRpb25zOiBzdHJpbmdbXSwgb25TdWJtaXQ6IChvcHRpb25zOiBzdHJpbmdbXSkgPT4gdm9pZCkge1xuICAgIHN1cGVyKGFwcCk7XG4gICAgdGhpcy5jb2xOYW1lID0gY29sTmFtZTtcbiAgICB0aGlzLmN1cnJlbnRPcHRpb25zID0gWy4uLmN1cnJlbnRPcHRpb25zXTtcbiAgICB0aGlzLm9uU3VibWl0ID0gb25TdWJtaXQ7XG4gIH1cblxuICBvbk9wZW4oKTogdm9pZCB7XG4gICAgY29uc3QgeyBjb250ZW50RWwgfSA9IHRoaXM7XG4gICAgY29udGVudEVsLmVtcHR5KCk7XG4gICAgY29udGVudEVsLmFkZENsYXNzKFwiemliYXNlLW1vZGFsXCIpO1xuICAgIGNvbnRlbnRFbC5jcmVhdGVFbChcImgzXCIsIHsgdGV4dDogYE9wdGlvbnMgZm9yIFwiJHt0aGlzLmNvbE5hbWV9XCJgLCBjbHM6IFwiemliYXNlLW1vZGFsLXRpdGxlXCIgfSk7XG4gICAgY29uc3QgY2hpcHNXcmFwID0gY29udGVudEVsLmNyZWF0ZURpdihcInppYmFzZS1tb2RhbC1jaGlwc1wiKTtcbiAgICBjb25zdCByZW5kZXJDaGlwcyA9ICgpID0+IHtcbiAgICAgIGNoaXBzV3JhcC5lbXB0eSgpO1xuICAgICAgdGhpcy5jdXJyZW50T3B0aW9ucy5mb3JFYWNoKChvcHQsIGkpID0+IHtcbiAgICAgICAgY29uc3QgY2hpcCA9IGNoaXBzV3JhcC5jcmVhdGVEaXYoXCJ6aWJhc2UtbW9kYWwtY2hpcFwiKTtcbiAgICAgICAgY2hpcC5jcmVhdGVTcGFuKHsgdGV4dDogb3B0IH0pO1xuICAgICAgICBjb25zdCB4ID0gY2hpcC5jcmVhdGVTcGFuKHsgdGV4dDogXCJcdTAwRDdcIiwgY2xzOiBcInppYmFzZS1jaGlwLXJlbW92ZVwiIH0pO1xuICAgICAgICB4LmFkZEV2ZW50TGlzdGVuZXIoXCJjbGlja1wiLCAoKSA9PiB7XG4gICAgICAgICAgdGhpcy5jdXJyZW50T3B0aW9ucy5zcGxpY2UoaSwgMSk7XG4gICAgICAgICAgcmVuZGVyQ2hpcHMoKTtcbiAgICAgICAgfSk7XG4gICAgICB9KTtcbiAgICB9O1xuICAgIHJlbmRlckNoaXBzKCk7XG4gICAgY29uc3QgaW5wdXRSb3cgPSBjb250ZW50RWwuY3JlYXRlRGl2KFwiemliYXNlLW1vZGFsLWlucHV0LXJvd1wiKTtcbiAgICBjb25zdCBpbnB1dCA9IGlucHV0Um93LmNyZWF0ZUVsKFwiaW5wdXRcIiwgeyB0eXBlOiBcInRleHRcIiwgY2xzOiBcInppYmFzZS1tb2RhbC1pbnB1dFwiIH0pO1xuICAgIGlucHV0LnBsYWNlaG9sZGVyID0gXCJBZGQgb3B0aW9uXHUyMDI2XCI7XG4gICAgY29uc3QgYWRkQnRuID0gaW5wdXRSb3cuY3JlYXRlRWwoXCJidXR0b25cIiwgeyB0ZXh0OiBcIkFkZFwiLCBjbHM6IFwiemliYXNlLW1vZGFsLWFkZC1idG5cIiB9KTtcbiAgICBjb25zdCBhZGRPcHRpb24gPSAoKSA9PiB7XG4gICAgICBjb25zdCB2YWwgPSBpbnB1dC52YWx1ZS50cmltKCk7XG4gICAgICBpZiAodmFsICYmICF0aGlzLmN1cnJlbnRPcHRpb25zLmluY2x1ZGVzKHZhbCkpIHtcbiAgICAgICAgdGhpcy5jdXJyZW50T3B0aW9ucy5wdXNoKHZhbCk7XG4gICAgICAgIHJlbmRlckNoaXBzKCk7XG4gICAgICAgIGlucHV0LnZhbHVlID0gXCJcIjtcbiAgICAgICAgaW5wdXQuZm9jdXMoKTtcbiAgICAgIH1cbiAgICB9O1xuICAgIGFkZEJ0bi5hZGRFdmVudExpc3RlbmVyKFwiY2xpY2tcIiwgYWRkT3B0aW9uKTtcbiAgICBpbnB1dC5hZGRFdmVudExpc3RlbmVyKFwia2V5ZG93blwiLCAoZSkgPT4ge1xuICAgICAgaWYgKGUua2V5ID09PSBcIkVudGVyXCIpIHtcbiAgICAgICAgZS5wcmV2ZW50RGVmYXVsdCgpO1xuICAgICAgICBhZGRPcHRpb24oKTtcbiAgICAgIH1cbiAgICAgIGlmIChlLmtleSA9PT0gXCJFc2NhcGVcIikgdGhpcy5jbG9zZSgpO1xuICAgIH0pO1xuICAgIGNvbnN0IGFwcGx5QnRuID0gY29udGVudEVsLmNyZWF0ZUVsKFwiYnV0dG9uXCIsIHsgdGV4dDogXCJBcHBseVwiLCBjbHM6IFwiemliYXNlLW1vZGFsLWFwcGx5LWJ0blwiIH0pO1xuICAgIGFwcGx5QnRuLmFkZEV2ZW50TGlzdGVuZXIoXCJjbGlja1wiLCAoKSA9PiB7XG4gICAgICBpZiAodGhpcy5jdXJyZW50T3B0aW9ucy5sZW5ndGggPiAwKSB7XG4gICAgICAgIHRoaXMub25TdWJtaXQodGhpcy5jdXJyZW50T3B0aW9ucyk7XG4gICAgICAgIHRoaXMuY2xvc2UoKTtcbiAgICAgIH1cbiAgICB9KTtcbiAgICB3aW5kb3cuc2V0VGltZW91dCgoKSA9PiBpbnB1dC5mb2N1cygpLCA1MCk7XG4gIH1cblxuICBvbkNsb3NlKCk6IHZvaWQge1xuICAgIHRoaXMuY29udGVudEVsLmVtcHR5KCk7XG4gIH1cbn1cblxuZXhwb3J0IGNsYXNzIEZvcm11bGFJbnB1dE1vZGFsIGV4dGVuZHMgTW9kYWwge1xuICBjb2xOYW1lOiBzdHJpbmc7XG4gIGN1cnJlbnRFeHByOiBzdHJpbmc7XG4gIGNvbHVtbnM6IENvbHVtbltdO1xuICBvblN1Ym1pdDogKGV4cHI6IHN0cmluZykgPT4gdm9pZDtcblxuICBjb25zdHJ1Y3RvcihcbiAgICBhcHA6IEFwcCxcbiAgICBjb2xOYW1lOiBzdHJpbmcsXG4gICAgY3VycmVudEV4cHI6IHN0cmluZyxcbiAgICBjb2x1bW5zOiBDb2x1bW5bXSxcbiAgICBvblN1Ym1pdDogKGV4cHI6IHN0cmluZykgPT4gdm9pZCxcbiAgKSB7XG4gICAgc3VwZXIoYXBwKTtcbiAgICB0aGlzLmNvbE5hbWUgPSBjb2xOYW1lO1xuICAgIHRoaXMuY3VycmVudEV4cHIgPSBjdXJyZW50RXhwcjtcbiAgICB0aGlzLmNvbHVtbnMgPSBjb2x1bW5zO1xuICAgIHRoaXMub25TdWJtaXQgPSBvblN1Ym1pdDtcbiAgfVxuXG4gIG9uT3BlbigpOiB2b2lkIHtcbiAgICBjb25zdCB7IGNvbnRlbnRFbCB9ID0gdGhpcztcbiAgICBjb250ZW50RWwuZW1wdHkoKTtcbiAgICBjb250ZW50RWwuYWRkQ2xhc3MoXCJ6aWJhc2UtbW9kYWxcIik7XG4gICAgY29udGVudEVsLmNyZWF0ZUVsKFwiaDNcIiwgeyB0ZXh0OiBgRm9ybXVsYSBmb3IgXCIke3RoaXMuY29sTmFtZX1cImAsIGNsczogXCJ6aWJhc2UtbW9kYWwtdGl0bGVcIiB9KTtcbiAgICBjb250ZW50RWwuY3JlYXRlRWwoXCJwXCIsIHtcbiAgICAgIHRleHQ6IFwiVXNlIGNvbHVtbiBuYW1lcyB0byByZWZlcmVuY2UgdmFsdWVzLiBDYXNlLWluc2Vuc2l0aXZlLlwiLFxuICAgICAgY2xzOiBcInppYmFzZS1zZXR0aW5ncy1kZXNjXCIsXG4gICAgfSk7XG5cbiAgICBsZXQgaW5wdXQ6IEhUTUxJbnB1dEVsZW1lbnQ7XG4gICAgY29uc3QgY29sTGlzdCA9IGNvbnRlbnRFbC5jcmVhdGVEaXYoXCJ6aWJhc2UtZm9ybXVsYS1jb2xzXCIpO1xuICAgIGNvbExpc3QuY3JlYXRlU3Bhbih7IHRleHQ6IFwiQXZhaWxhYmxlOiBcIiwgY2xzOiBcInppYmFzZS1mb3JtdWxhLWNvbHMtbGFiZWxcIiB9KTtcbiAgICB0aGlzLmNvbHVtbnMuZm9yRWFjaCgoY29sKSA9PiB7XG4gICAgICBpZiAoY29sLm5hbWUgPT09IHRoaXMuY29sTmFtZSkgcmV0dXJuO1xuICAgICAgY29uc3QgY2hpcCA9IGNvbExpc3QuY3JlYXRlU3Bhbih7IHRleHQ6IGNvbC5uYW1lLCBjbHM6IFwiemliYXNlLWZvcm11bGEtY29sLWNoaXBcIiB9KTtcbiAgICAgIGNoaXAuYWRkRXZlbnRMaXN0ZW5lcihcImNsaWNrXCIsICgpID0+IHtcbiAgICAgICAgaW5wdXQudmFsdWUgKz0gY29sLm5hbWU7XG4gICAgICAgIGlucHV0LmZvY3VzKCk7XG4gICAgICB9KTtcbiAgICB9KTtcblxuICAgIGlucHV0ID0gY29udGVudEVsLmNyZWF0ZUVsKFwiaW5wdXRcIiwgeyB0eXBlOiBcInRleHRcIiwgY2xzOiBcInppYmFzZS1tb2RhbC1pbnB1dCB6aWJhc2UtbW9kYWwtZm9ybXVsYS1pbnB1dFwiIH0pO1xuICAgIGlucHV0LnZhbHVlID0gdGhpcy5jdXJyZW50RXhwcjtcbiAgICBpbnB1dC5wbGFjZWhvbGRlciA9IFwiZS5nLiwgUHJpY2UgKiBRdHlcIjtcblxuICAgIGNvbnN0IGFwcGx5QnRuID0gY29udGVudEVsLmNyZWF0ZUVsKFwiYnV0dG9uXCIsIHsgdGV4dDogXCJBcHBseVwiLCBjbHM6IFwiemliYXNlLW1vZGFsLWFwcGx5LWJ0blwiIH0pO1xuICAgIGNvbnN0IGFwcGx5ID0gKCkgPT4ge1xuICAgICAgY29uc3QgZXhwciA9IGlucHV0LnZhbHVlLnRyaW0oKTtcbiAgICAgIGlmIChleHByKSB7XG4gICAgICAgIHRoaXMub25TdWJtaXQoZXhwcik7XG4gICAgICAgIHRoaXMuY2xvc2UoKTtcbiAgICAgIH1cbiAgICB9O1xuICAgIGFwcGx5QnRuLmFkZEV2ZW50TGlzdGVuZXIoXCJjbGlja1wiLCBhcHBseSk7XG4gICAgaW5wdXQuYWRkRXZlbnRMaXN0ZW5lcihcImtleWRvd25cIiwgKGUpID0+IHtcbiAgICAgIGlmIChlLmtleSA9PT0gXCJFbnRlclwiKSB7XG4gICAgICAgIGUucHJldmVudERlZmF1bHQoKTtcbiAgICAgICAgYXBwbHkoKTtcbiAgICAgIH1cbiAgICAgIGlmIChlLmtleSA9PT0gXCJFc2NhcGVcIikgdGhpcy5jbG9zZSgpO1xuICAgIH0pO1xuXG4gICAgd2luZG93LnNldFRpbWVvdXQoKCkgPT4ge1xuICAgICAgaW5wdXQuZm9jdXMoKTtcbiAgICAgIGlucHV0LnNlbGVjdCgpO1xuICAgIH0sIDUwKTtcbiAgfVxuXG4gIG9uQ2xvc2UoKTogdm9pZCB7XG4gICAgdGhpcy5jb250ZW50RWwuZW1wdHkoKTtcbiAgfVxufVxuIiwgImV4cG9ydCB0eXBlIENvbHVtbktpbmQgPVxuICB8IFwidGV4dFwiXG4gIHwgXCJ0b2dnbGVcIlxuICB8IFwic2VsZWN0XCJcbiAgfCBcImxhYmVsXCJcbiAgfCBcIm11bHRpLXNlbGVjdFwiXG4gIHwgXCJudW1iZXJcIlxuICB8IFwiZGF0ZVwiXG4gIHwgXCJmb3JtdWxhXCI7XG5cbmV4cG9ydCB0eXBlIENvbHVtblR5cGUgPVxuICB8IHsga2luZDogXCJ0ZXh0XCIgfVxuICB8IHsga2luZDogXCJ0b2dnbGVcIiB9XG4gIHwgeyBraW5kOiBcInNlbGVjdFwiOyBvcHRpb25zOiBzdHJpbmdbXSB9XG4gIHwgeyBraW5kOiBcImxhYmVsXCIgfVxuICB8IHsga2luZDogXCJtdWx0aS1zZWxlY3RcIiB9XG4gIHwgeyBraW5kOiBcIm51bWJlclwiIH1cbiAgfCB7IGtpbmQ6IFwiZGF0ZVwiIH1cbiAgfCB7IGtpbmQ6IFwiZm9ybXVsYVwiOyBleHByZXNzaW9uOiBzdHJpbmcgfTtcblxuZXhwb3J0IGludGVyZmFjZSBDb2x1bW4ge1xuICBuYW1lOiBzdHJpbmc7XG4gIHR5cGU6IENvbHVtblR5cGU7XG4gIGluZGV4OiBudW1iZXI7XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgVGFibGVTY2hlbWEge1xuICBjb2x1bW5zOiBDb2x1bW5bXTtcbiAgc2NoZW1hUm93SW5kZXg6IG51bWJlciB8IG51bGw7XG4gIGRhdGFTdGFydEluZGV4OiBudW1iZXI7XG4gIGluZmVycmVkOiBib29sZWFuO1xufVxuXG5leHBvcnQgdHlwZSBWaWV3TmFtZSA9IFwidGFibGVcIiB8IFwia2FuYmFuXCIgfCBcImdhbGxlcnlcIiB8IFwiY2FsZW5kYXJcIjtcblxuZXhwb3J0IGludGVyZmFjZSBDb2x1bW5SdWxlIHtcbiAgbmFtZTogc3RyaW5nO1xuICB0eXBlOiBzdHJpbmc7XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgWmlCYXNlU2V0dGluZ3Mge1xuICByZW5kZXJJblJlYWRpbmdWaWV3OiBib29sZWFuO1xuICBpbmZlclNjaGVtYTogYm9vbGVhbjtcbiAgY29sdW1uUnVsZXM6IENvbHVtblJ1bGVbXTtcbn1cblxuZXhwb3J0IGNvbnN0IENPTFVNTl9UWVBFX09QVElPTlM6IENvbHVtbktpbmRbXSA9IFtcbiAgXCJ0ZXh0XCIsXG4gIFwidG9nZ2xlXCIsXG4gIFwic2VsZWN0XCIsXG4gIFwibGFiZWxcIixcbiAgXCJtdWx0aS1zZWxlY3RcIixcbiAgXCJudW1iZXJcIixcbiAgXCJkYXRlXCIsXG4gIFwiZm9ybXVsYVwiLFxuXTtcbiIsICJpbXBvcnQgeyBNYXJrZG93blJlbmRlcmVyLCBURmlsZSwgdHlwZSBNYXJrZG93blBvc3RQcm9jZXNzb3JDb250ZXh0LCB0eXBlIE1hcmtkb3duU2VjdGlvbkluZm9ybWF0aW9uIH0gZnJvbSBcIm9ic2lkaWFuXCI7XG5pbXBvcnQgeyBmaWx0ZXJEYXRhUm93cywgc2VyaWFsaXplUm93LCBzcGxpdFJvdyB9IGZyb20gXCIuLi9zY2hlbWFcIjtcbmltcG9ydCB0eXBlIHsgVGFibGVTY2hlbWEsIFppQmFzZUhvc3QgfSBmcm9tIFwiLi4vdHlwZXNcIjtcbmltcG9ydCB7IGdldExhYmVsQ29sb3IgfSBmcm9tIFwiLi4vdWlcIjtcblxuZXhwb3J0IGZ1bmN0aW9uIGJ1aWxkQ2FsZW5kYXJWaWV3KFxuICBob3N0OiBaaUJhc2VIb3N0LFxuICBib2R5OiBIVE1MRWxlbWVudCxcbiAgc2NoZW1hOiBUYWJsZVNjaGVtYSxcbiAgZ2V0RGF0YVJvd3M6ICgpID0+IHN0cmluZ1tdLFxuICBfcmF3RGF0YUxpbmVzOiBzdHJpbmdbXSxcbiAgY29udGV4dDogTWFya2Rvd25Qb3N0UHJvY2Vzc29yQ29udGV4dCxcbiAgc2VjdGlvbkluZm86IE1hcmtkb3duU2VjdGlvbkluZm9ybWF0aW9uLFxuICBmaWx0ZXJRdWVyeTogc3RyaW5nLFxuKTogdm9pZCB7XG4gIGNvbnN0IGRhdGVDb2wgPSBzY2hlbWEuY29sdW1ucy5maW5kKChjKSA9PiBjLnR5cGUua2luZCA9PT0gXCJkYXRlXCIpO1xuICBpZiAoIWRhdGVDb2wpIHtcbiAgICBjb25zdCBub3RpY2UgPSBib2R5LmNyZWF0ZURpdihcInppYmFzZS1jYWxlbmRhciB6aWJhc2UtY2FsZW5kYXItbm90aWNlXCIpO1xuICAgIG5vdGljZS50ZXh0Q29udGVudCA9IFwiQ2FsZW5kYXIgcmVxdWlyZXMgYSBEYXRlIGNvbHVtbi5cIjtcbiAgICByZXR1cm47XG4gIH1cblxuICBjb25zdCBjYWxlbmRhciA9IGJvZHkuY3JlYXRlRGl2KFwiemliYXNlLWNhbGVuZGFyXCIpO1xuICBjb25zdCBub3cgPSBuZXcgRGF0ZSgpO1xuICBsZXQgY3VycmVudE1vbnRoID0gbm93LmdldE1vbnRoKCk7XG4gIGxldCBjdXJyZW50WWVhciA9IG5vdy5nZXRGdWxsWWVhcigpO1xuXG4gIGNvbnN0IHJlbmRlckNhbGVuZGFyID0gKCkgPT4ge1xuICAgIGNhbGVuZGFyLmVtcHR5KCk7XG5cbiAgICBjb25zdCBuYXYgPSBjYWxlbmRhci5jcmVhdGVEaXYoXCJ6aWJhc2UtY2FsZW5kYXItbmF2XCIpO1xuICAgIGNvbnN0IHByZXZCdG4gPSBuYXYuY3JlYXRlRWwoXCJidXR0b25cIiwgeyB0ZXh0OiBcIlx1MjVDMFwiLCBjbHM6IFwiemliYXNlLWNhbGVuZGFyLW5hdi1idG5cIiB9KTtcbiAgICBjb25zdCBtb250aExhYmVsID0gbmF2LmNyZWF0ZVNwYW4oeyBjbHM6IFwiemliYXNlLWNhbGVuZGFyLW1vbnRoLWxhYmVsXCIgfSk7XG4gICAgbW9udGhMYWJlbC50ZXh0Q29udGVudCA9IG5ldyBEYXRlKGN1cnJlbnRZZWFyLCBjdXJyZW50TW9udGgpLnRvTG9jYWxlU3RyaW5nKFwiZGVmYXVsdFwiLCB7XG4gICAgICBtb250aDogXCJsb25nXCIsXG4gICAgICB5ZWFyOiBcIm51bWVyaWNcIixcbiAgICB9KTtcbiAgICBjb25zdCBuZXh0QnRuID0gbmF2LmNyZWF0ZUVsKFwiYnV0dG9uXCIsIHsgdGV4dDogXCJcdTI1QjZcIiwgY2xzOiBcInppYmFzZS1jYWxlbmRhci1uYXYtYnRuXCIgfSk7XG5cbiAgICBwcmV2QnRuLmFkZEV2ZW50TGlzdGVuZXIoXCJjbGlja1wiLCAoKSA9PiB7XG4gICAgICBjdXJyZW50TW9udGgtLTtcbiAgICAgIGlmIChjdXJyZW50TW9udGggPCAwKSB7XG4gICAgICAgIGN1cnJlbnRNb250aCA9IDExO1xuICAgICAgICBjdXJyZW50WWVhci0tO1xuICAgICAgfVxuICAgICAgcmVuZGVyQ2FsZW5kYXIoKTtcbiAgICB9KTtcbiAgICBuZXh0QnRuLmFkZEV2ZW50TGlzdGVuZXIoXCJjbGlja1wiLCAoKSA9PiB7XG4gICAgICBjdXJyZW50TW9udGgrKztcbiAgICAgIGlmIChjdXJyZW50TW9udGggPiAxMSkge1xuICAgICAgICBjdXJyZW50TW9udGggPSAwO1xuICAgICAgICBjdXJyZW50WWVhcisrO1xuICAgICAgfVxuICAgICAgcmVuZGVyQ2FsZW5kYXIoKTtcbiAgICB9KTtcblxuICAgIGNvbnN0IGRheUhlYWRlcnMgPSBjYWxlbmRhci5jcmVhdGVEaXYoXCJ6aWJhc2UtY2FsZW5kYXItZGF5LWhlYWRlcnNcIik7XG4gICAgW1wiTW9uXCIsIFwiVHVlXCIsIFwiV2VkXCIsIFwiVGh1XCIsIFwiRnJpXCIsIFwiU2F0XCIsIFwiU3VuXCJdLmZvckVhY2goKGQpID0+IHtcbiAgICAgIGRheUhlYWRlcnMuY3JlYXRlU3Bhbih7IHRleHQ6IGQsIGNsczogXCJ6aWJhc2UtY2FsZW5kYXItZGF5LWhlYWRlclwiIH0pO1xuICAgIH0pO1xuXG4gICAgY29uc3QgZ3JpZCA9IGNhbGVuZGFyLmNyZWF0ZURpdihcInppYmFzZS1jYWxlbmRhci1ncmlkXCIpO1xuICAgIGNvbnN0IGZpcnN0RGF5ID0gbmV3IERhdGUoY3VycmVudFllYXIsIGN1cnJlbnRNb250aCwgMSk7XG4gICAgY29uc3QgbGFzdERheSA9IG5ldyBEYXRlKGN1cnJlbnRZZWFyLCBjdXJyZW50TW9udGggKyAxLCAwKTtcbiAgICBjb25zdCB0b3RhbERheXMgPSBsYXN0RGF5LmdldERhdGUoKTtcblxuICAgIGxldCBzdGFydERvdyA9IGZpcnN0RGF5LmdldERheSgpIC0gMTtcbiAgICBpZiAoc3RhcnREb3cgPCAwKSBzdGFydERvdyA9IDY7XG5cbiAgICBjb25zdCBkYXRhUm93cyA9IGZpbHRlckRhdGFSb3dzKGdldERhdGFSb3dzKCksIGZpbHRlclF1ZXJ5KTtcbiAgICBjb25zdCBkYXRlTWFwID0gbmV3IE1hcDxzdHJpbmcsIHsgdGl0bGU6IHN0cmluZzsgbGFiZWw6IHN0cmluZyB8IG51bGw7IGxpbmU6IHN0cmluZyB9W10+KCk7XG4gICAgZGF0YVJvd3MuZm9yRWFjaCgobGluZSkgPT4ge1xuICAgICAgY29uc3QgY2VsbHMgPSBzcGxpdFJvdyhsaW5lKTtcbiAgICAgIGNvbnN0IGRhdGVTdHIgPSAoY2VsbHNbZGF0ZUNvbC5pbmRleF0gfHwgXCJcIikudHJpbSgpO1xuICAgICAgaWYgKCFkYXRlU3RyKSByZXR1cm47XG4gICAgICBpZiAoIWRhdGVNYXAuaGFzKGRhdGVTdHIpKSBkYXRlTWFwLnNldChkYXRlU3RyLCBbXSk7XG4gICAgICBjb25zdCB0aXRsZUNvbCA9IHNjaGVtYS5jb2x1bW5zLmZpbmQoKGMpID0+IGMudHlwZS5raW5kID09PSBcInRleHRcIik7XG4gICAgICBjb25zdCB0aXRsZSA9IHRpdGxlQ29sID8gKGNlbGxzW3RpdGxlQ29sLmluZGV4XSB8fCBcIlwiKS50cmltKCkgOiAoY2VsbHNbMF0gfHwgXCJcIikudHJpbSgpO1xuICAgICAgY29uc3QgbGFiZWxDb2wgPSBzY2hlbWEuY29sdW1ucy5maW5kKChjKSA9PiBjLnR5cGUua2luZCA9PT0gXCJsYWJlbFwiIHx8IGMudHlwZS5raW5kID09PSBcInNlbGVjdFwiKTtcbiAgICAgIGNvbnN0IGxhYmVsID0gbGFiZWxDb2wgPyAoY2VsbHNbbGFiZWxDb2wuaW5kZXhdIHx8IFwiXCIpLnRyaW0oKSA6IG51bGw7XG4gICAgICBkYXRlTWFwLmdldChkYXRlU3RyKSEucHVzaCh7IHRpdGxlLCBsYWJlbCwgbGluZSB9KTtcbiAgICB9KTtcblxuICAgIGNvbnN0IHRvZGF5ID0gbmV3IERhdGUoKTtcbiAgICBjb25zdCB0b2RheVN0ciA9IGAke3RvZGF5LmdldEZ1bGxZZWFyKCl9LSR7U3RyaW5nKHRvZGF5LmdldE1vbnRoKCkgKyAxKS5wYWRTdGFydCgyLCBcIjBcIil9LSR7U3RyaW5nKHRvZGF5LmdldERhdGUoKSkucGFkU3RhcnQoMiwgXCIwXCIpfWA7XG5cbiAgICBmb3IgKGxldCBpID0gMDsgaSA8IHN0YXJ0RG93OyBpKyspIHtcbiAgICAgIGdyaWQuY3JlYXRlRGl2KFwiemliYXNlLWNhbGVuZGFyLWNlbGwgemliYXNlLWNhbGVuZGFyLWNlbGwtZW1wdHlcIik7XG4gICAgfVxuXG4gICAgZm9yIChsZXQgZCA9IDE7IGQgPD0gdG90YWxEYXlzOyBkKyspIHtcbiAgICAgIGNvbnN0IGRhdGVTdHIgPSBgJHtjdXJyZW50WWVhcn0tJHtTdHJpbmcoY3VycmVudE1vbnRoICsgMSkucGFkU3RhcnQoMiwgXCIwXCIpfS0ke1N0cmluZyhkKS5wYWRTdGFydCgyLCBcIjBcIil9YDtcbiAgICAgIGNvbnN0IGNlbGwgPSBncmlkLmNyZWF0ZURpdihcInppYmFzZS1jYWxlbmRhci1jZWxsXCIpO1xuICAgICAgaWYgKGRhdGVTdHIgPT09IHRvZGF5U3RyKSBjZWxsLmNsYXNzTGlzdC5hZGQoXCJ6aWJhc2UtY2FsZW5kYXItdG9kYXlcIik7XG5cbiAgICAgIGNlbGwuY3JlYXRlU3Bhbih7IHRleHQ6IFN0cmluZyhkKSwgY2xzOiBcInppYmFzZS1jYWxlbmRhci1kYXktbnVtXCIgfSk7XG5cbiAgICAgIGNvbnN0IGVudHJpZXMgPSBkYXRlTWFwLmdldChkYXRlU3RyKSB8fCBbXTtcbiAgICAgIGVudHJpZXMuZm9yRWFjaCgoZW50cnkpID0+IHtcbiAgICAgICAgY29uc3QgcGlsbCA9IGNlbGwuY3JlYXRlRGl2KFwiemliYXNlLWNhbGVuZGFyLWVudHJ5XCIpO1xuICAgICAgICB2b2lkIE1hcmtkb3duUmVuZGVyZXIucmVuZGVyKGhvc3QuYXBwLCBlbnRyeS50aXRsZSB8fCBcIlx1MjAxNFwiLCBwaWxsLCBjb250ZXh0LnNvdXJjZVBhdGgsIGhvc3QucGx1Z2luKTtcbiAgICAgICAgaWYgKGVudHJ5LmxhYmVsKSB7XG4gICAgICAgICAgcGlsbC5zZXRDc3NQcm9wcyh7IFwiLS1sY1wiOiBnZXRMYWJlbENvbG9yKGVudHJ5LmxhYmVsKSB9KTtcbiAgICAgICAgICBwaWxsLmNsYXNzTGlzdC5hZGQoXCJ6aWJhc2UtY2FsZW5kYXItZW50cnktY29sb3JlZFwiKTtcbiAgICAgICAgfVxuICAgICAgfSk7XG5cbiAgICAgIGlmIChlbnRyaWVzLmxlbmd0aCA9PT0gMCkge1xuICAgICAgICBjZWxsLmFkZEV2ZW50TGlzdGVuZXIoXCJjbGlja1wiLCAoKSA9PiB7XG4gICAgICAgICAgdm9pZCAoYXN5bmMgKCkgPT4ge1xuICAgICAgICAgICAgY29uc3QgZmlsZSA9IGhvc3QuYXBwLnZhdWx0LmdldEFic3RyYWN0RmlsZUJ5UGF0aChjb250ZXh0LnNvdXJjZVBhdGgpO1xuICAgICAgICAgICAgaWYgKCEoZmlsZSBpbnN0YW5jZW9mIFRGaWxlKSkgcmV0dXJuO1xuICAgICAgICAgICAgYXdhaXQgaG9zdC5hcHAudmF1bHQucHJvY2VzcyhmaWxlLCAoY29udGVudCkgPT4ge1xuICAgICAgICAgICAgICBjb25zdCBhbGxMaW5lcyA9IGNvbnRlbnQuc3BsaXQoXCJcXG5cIik7XG4gICAgICAgICAgICAgIGNvbnN0IG5ld0NlbGxzID0gc2NoZW1hLmNvbHVtbnMubWFwKChjb2wpID0+IHtcbiAgICAgICAgICAgICAgICBpZiAoY29sLmluZGV4ID09PSBkYXRlQ29sLmluZGV4KSByZXR1cm4gYCAke2RhdGVTdHJ9IGA7XG4gICAgICAgICAgICAgICAgcmV0dXJuIFwiICAgXCI7XG4gICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICBhbGxMaW5lcy5zcGxpY2Uoc2VjdGlvbkluZm8ubGluZUVuZCArIDEsIDAsIHNlcmlhbGl6ZVJvdyhuZXdDZWxscykpO1xuICAgICAgICAgICAgICByZXR1cm4gYWxsTGluZXMuam9pbihcIlxcblwiKTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgIH0pKCk7XG4gICAgICAgIH0pO1xuICAgICAgICBjZWxsLmNsYXNzTGlzdC5hZGQoXCJ6aWJhc2UtY2FsZW5kYXItY2VsbC1jbGlja2FibGVcIik7XG4gICAgICB9XG4gICAgfVxuICB9O1xuXG4gIHJlbmRlckNhbGVuZGFyKCk7XG59XG4iLCAiaW1wb3J0IHsgTWFya2Rvd25SZW5kZXJlciwgdHlwZSBNYXJrZG93blBvc3RQcm9jZXNzb3JDb250ZXh0LCB0eXBlIE1hcmtkb3duU2VjdGlvbkluZm9ybWF0aW9uIH0gZnJvbSBcIm9ic2lkaWFuXCI7XG5pbXBvcnQgeyBmaWx0ZXJEYXRhUm93cywgcGFyc2VCb29sLCBzcGxpdFJvdyB9IGZyb20gXCIuLi9zY2hlbWFcIjtcbmltcG9ydCB0eXBlIHsgVGFibGVTY2hlbWEsIFppQmFzZUhvc3QgfSBmcm9tIFwiLi4vdHlwZXNcIjtcbmltcG9ydCB7IGdldExhYmVsQ29sb3IgfSBmcm9tIFwiLi4vdWlcIjtcblxuZXhwb3J0IGZ1bmN0aW9uIGJ1aWxkR2FsbGVyeVZpZXcoXG4gIGhvc3Q6IFppQmFzZUhvc3QsXG4gIGJvZHk6IEhUTUxFbGVtZW50LFxuICBzY2hlbWE6IFRhYmxlU2NoZW1hLFxuICBnZXREYXRhUm93czogKCkgPT4gc3RyaW5nW10sXG4gIF9yYXdEYXRhTGluZXM6IHN0cmluZ1tdLFxuICBjb250ZXh0OiBNYXJrZG93blBvc3RQcm9jZXNzb3JDb250ZXh0LFxuICBfc2VjdGlvbkluZm86IE1hcmtkb3duU2VjdGlvbkluZm9ybWF0aW9uLFxuICBmaWx0ZXJRdWVyeTogc3RyaW5nLFxuKTogdm9pZCB7XG4gIGNvbnN0IGdhbGxlcnkgPSBib2R5LmNyZWF0ZURpdihcInppYmFzZS1nYWxsZXJ5XCIpO1xuICBjb25zdCBkYXRhUm93cyA9IGZpbHRlckRhdGFSb3dzKGdldERhdGFSb3dzKCksIGZpbHRlclF1ZXJ5KTtcblxuICBpZiAoZGF0YVJvd3MubGVuZ3RoID09PSAwKSB7XG4gICAgY29uc3QgZW1wdHkgPSBnYWxsZXJ5LmNyZWF0ZURpdihcInppYmFzZS1lbXB0eVwiKTtcbiAgICBlbXB0eS50ZXh0Q29udGVudCA9IGZpbHRlclF1ZXJ5ID8gXCJObyBtYXRjaGluZyByb3dzXCIgOiBcIk5vIGRhdGFcIjtcbiAgICByZXR1cm47XG4gIH1cblxuICBjb25zdCBncmlkID0gZ2FsbGVyeS5jcmVhdGVEaXYoXCJ6aWJhc2UtZ2FsbGVyeS1ncmlkXCIpO1xuXG4gIGRhdGFSb3dzLmZvckVhY2goKGxpbmUpID0+IHtcbiAgICBjb25zdCBjZWxscyA9IHNwbGl0Um93KGxpbmUpO1xuICAgIGNvbnN0IGNhcmQgPSBncmlkLmNyZWF0ZURpdihcInppYmFzZS1nYWxsZXJ5LWNhcmRcIik7XG5cbiAgICBjb25zdCB0aXRsZUNvbCA9IHNjaGVtYS5jb2x1bW5zLmZpbmQoKGMpID0+IGMudHlwZS5raW5kID09PSBcInRleHRcIik7XG4gICAgY29uc3QgdGl0bGVWYWx1ZSA9IHRpdGxlQ29sID8gKGNlbGxzW3RpdGxlQ29sLmluZGV4XSB8fCBcIlwiKS50cmltKCkgOiAoY2VsbHNbMF0gfHwgXCJcIikudHJpbSgpO1xuICAgIGNvbnN0IHRpdGxlRGl2ID0gY2FyZC5jcmVhdGVEaXYoeyBjbHM6IFwiemliYXNlLWdhbGxlcnktY2FyZC10aXRsZVwiIH0pO1xuICAgIHZvaWQgTWFya2Rvd25SZW5kZXJlci5yZW5kZXIoaG9zdC5hcHAsIHRpdGxlVmFsdWUgfHwgXCJcdTIwMTRcIiwgdGl0bGVEaXYsIGNvbnRleHQuc291cmNlUGF0aCwgaG9zdC5wbHVnaW4pO1xuXG4gICAgY29uc3QgZmllbGRzV3JhcCA9IGNhcmQuY3JlYXRlRGl2KFwiemliYXNlLWdhbGxlcnktY2FyZC1maWVsZHNcIik7XG4gICAgc2NoZW1hLmNvbHVtbnMuZm9yRWFjaCgoY29sLCBjb2xJZHgpID0+IHtcbiAgICAgIGlmICh0aXRsZUNvbCAmJiBjb2xJZHggPT09IHRpdGxlQ29sLmluZGV4KSByZXR1cm47XG4gICAgICBjb25zdCByYXdWYWx1ZSA9IChjZWxsc1tjb2xJZHhdID8/IFwiXCIpLnRyaW0oKTtcbiAgICAgIGlmICghcmF3VmFsdWUgJiYgY29sLnR5cGUua2luZCAhPT0gXCJ0b2dnbGVcIikgcmV0dXJuO1xuXG4gICAgICBjb25zdCBmaWVsZCA9IGZpZWxkc1dyYXAuY3JlYXRlRGl2KFwiemliYXNlLWdhbGxlcnktZmllbGRcIik7XG5cbiAgICAgIGlmIChjb2wudHlwZS5raW5kID09PSBcInRvZ2dsZVwiKSB7XG4gICAgICAgIGZpZWxkLmNyZWF0ZVNwYW4oeyB0ZXh0OiBwYXJzZUJvb2wocmF3VmFsdWUpID8gXCJcdTI3MDVcIiA6IFwiXHUyQjFDXCIgfSk7XG4gICAgICAgIGZpZWxkLmNyZWF0ZVNwYW4oeyB0ZXh0OiBcIiBcIiArIGNvbC5uYW1lLCBjbHM6IFwiemliYXNlLWdhbGxlcnktZmllbGQtbmFtZVwiIH0pO1xuICAgICAgfSBlbHNlIGlmIChjb2wudHlwZS5raW5kID09PSBcImxhYmVsXCIpIHtcbiAgICAgICAgY29uc3QgY2hpcCA9IGZpZWxkLmNyZWF0ZVNwYW4oeyB0ZXh0OiByYXdWYWx1ZSwgY2xzOiBcInppYmFzZS1sYWJlbFwiIH0pO1xuICAgICAgICBjaGlwLnNldENzc1Byb3BzKHsgXCItLWxjXCI6IGdldExhYmVsQ29sb3IocmF3VmFsdWUpIH0pO1xuICAgICAgfSBlbHNlIGlmIChjb2wudHlwZS5raW5kID09PSBcInNlbGVjdFwiKSB7XG4gICAgICAgIGZpZWxkLmNyZWF0ZVNwYW4oeyB0ZXh0OiByYXdWYWx1ZSwgY2xzOiBcInppYmFzZS1nYWxsZXJ5LWZpZWxkLXNlbGVjdFwiIH0pO1xuICAgICAgfSBlbHNlIGlmIChjb2wudHlwZS5raW5kID09PSBcImRhdGVcIikge1xuICAgICAgICBmaWVsZC5jcmVhdGVTcGFuKHsgdGV4dDogXCJcdUQ4M0RcdURDQzUgXCIsIGNsczogXCJ6aWJhc2UtZ2FsbGVyeS1maWVsZC1pY29uXCIgfSk7XG4gICAgICAgIGZpZWxkLmNyZWF0ZVNwYW4oeyB0ZXh0OiByYXdWYWx1ZSwgY2xzOiBcInppYmFzZS1kYXRlLXJlbmRlcmVkXCIgfSk7XG4gICAgICB9IGVsc2UgaWYgKGNvbC50eXBlLmtpbmQgPT09IFwibnVtYmVyXCIgfHwgY29sLnR5cGUua2luZCA9PT0gXCJmb3JtdWxhXCIpIHtcbiAgICAgICAgZmllbGQuY3JlYXRlU3Bhbih7IHRleHQ6IGNvbC5uYW1lICsgXCI6IFwiLCBjbHM6IFwiemliYXNlLWdhbGxlcnktZmllbGQtbmFtZVwiIH0pO1xuICAgICAgICBmaWVsZC5jcmVhdGVTcGFuKHsgdGV4dDogcmF3VmFsdWUsIGNsczogXCJ6aWJhc2UtZ2FsbGVyeS1maWVsZC12YWx1ZVwiIH0pO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgZmllbGQuY3JlYXRlU3Bhbih7IHRleHQ6IHJhd1ZhbHVlLCBjbHM6IFwiemliYXNlLWdhbGxlcnktZmllbGQtdmFsdWVcIiB9KTtcbiAgICAgIH1cbiAgICB9KTtcbiAgfSk7XG59XG4iLCAiaW1wb3J0IHsgTWFya2Rvd25SZW5kZXJlciwgdHlwZSBNYXJrZG93blBvc3RQcm9jZXNzb3JDb250ZXh0LCB0eXBlIE1hcmtkb3duU2VjdGlvbkluZm9ybWF0aW9uIH0gZnJvbSBcIm9ic2lkaWFuXCI7XG5pbXBvcnQgeyBmaWx0ZXJEYXRhUm93cywgcGFyc2VCb29sLCBwYXJzZU11bHRpU2VsZWN0LCBzcGxpdFJvdyB9IGZyb20gXCIuLi9zY2hlbWFcIjtcbmltcG9ydCB0eXBlIHsgVGFibGVTY2hlbWEsIFppQmFzZUhvc3QgfSBmcm9tIFwiLi4vdHlwZXNcIjtcbmltcG9ydCB7IGdldExhYmVsQ29sb3IgfSBmcm9tIFwiLi4vdWlcIjtcblxuZXhwb3J0IGZ1bmN0aW9uIGJ1aWxkS2FuYmFuVmlldyhcbiAgaG9zdDogWmlCYXNlSG9zdCxcbiAgYm9keTogSFRNTEVsZW1lbnQsXG4gIHNjaGVtYTogVGFibGVTY2hlbWEsXG4gIGdldERhdGFSb3dzOiAoKSA9PiBzdHJpbmdbXSxcbiAgcmF3RGF0YUxpbmVzOiBzdHJpbmdbXSxcbiAgY29udGV4dDogTWFya2Rvd25Qb3N0UHJvY2Vzc29yQ29udGV4dCxcbiAgc2VjdGlvbkluZm86IE1hcmtkb3duU2VjdGlvbkluZm9ybWF0aW9uLFxuICBmaWx0ZXJRdWVyeTogc3RyaW5nLFxuKTogdm9pZCB7XG4gIGNvbnN0IGdyb3VwQ29sID0gc2NoZW1hLmNvbHVtbnMuZmluZChcbiAgICAoYykgPT4gYy50eXBlLmtpbmQgPT09IFwic2VsZWN0XCIgfHwgYy50eXBlLmtpbmQgPT09IFwibGFiZWxcIiB8fCBjLnR5cGUua2luZCA9PT0gXCJtdWx0aS1zZWxlY3RcIixcbiAgKTtcbiAgaWYgKCFncm91cENvbCkge1xuICAgIGNvbnN0IG5vdGljZSA9IGJvZHkuY3JlYXRlRGl2KFwiemliYXNlLWthbmJhbiB6aWJhc2Uta2FuYmFuLW5vdGljZVwiKTtcbiAgICBub3RpY2UudGV4dENvbnRlbnQgPSBcIkthbmJhbiByZXF1aXJlcyBhIFNlbGVjdCBvciBMYWJlbCBjb2x1bW4gdG8gZ3JvdXAgYnkuXCI7XG4gICAgcmV0dXJuO1xuICB9XG5cbiAgY29uc3Qga2FuYmFuID0gYm9keS5jcmVhdGVEaXYoXCJ6aWJhc2Uta2FuYmFuXCIpO1xuICBjb25zdCBkYXRhUm93cyA9IGZpbHRlckRhdGFSb3dzKGdldERhdGFSb3dzKCksIGZpbHRlclF1ZXJ5KTtcblxuICBjb25zdCBncm91cHMgPSBuZXcgTWFwPHN0cmluZywgeyBsaW5lOiBzdHJpbmc7IGNlbGxzOiBzdHJpbmdbXSB9W10+KCk7XG4gIGRhdGFSb3dzLmZvckVhY2goKGxpbmUpID0+IHtcbiAgICBjb25zdCBjZWxscyA9IHNwbGl0Um93KGxpbmUpO1xuICAgIGNvbnN0IHJhd0dyb3VwVmFsdWUgPSAoY2VsbHNbZ3JvdXBDb2wuaW5kZXhdID8/IFwiXCIpLnRyaW0oKSB8fCBcIlx1MjAxNFwiO1xuICAgIGxldCBncm91cFZhbHVlcyA9IFtyYXdHcm91cFZhbHVlXTtcbiAgICBpZiAoZ3JvdXBDb2wudHlwZS5raW5kID09PSBcIm11bHRpLXNlbGVjdFwiICYmIHJhd0dyb3VwVmFsdWUgIT09IFwiXHUyMDE0XCIpIHtcbiAgICAgIGdyb3VwVmFsdWVzID0gcGFyc2VNdWx0aVNlbGVjdChyYXdHcm91cFZhbHVlKTtcbiAgICAgIGlmIChncm91cFZhbHVlcy5sZW5ndGggPT09IDApIGdyb3VwVmFsdWVzID0gW1wiXHUyMDE0XCJdO1xuICAgIH1cbiAgICBncm91cFZhbHVlcy5mb3JFYWNoKChndikgPT4ge1xuICAgICAgaWYgKCFncm91cHMuaGFzKGd2KSkgZ3JvdXBzLnNldChndiwgW10pO1xuICAgICAgZ3JvdXBzLmdldChndikhLnB1c2goeyBsaW5lLCBjZWxscyB9KTtcbiAgICB9KTtcbiAgfSk7XG5cbiAgbGV0IGdyb3VwS2V5czogc3RyaW5nW107XG4gIGlmIChncm91cENvbC50eXBlLmtpbmQgPT09IFwic2VsZWN0XCIgJiYgZ3JvdXBDb2wudHlwZS5vcHRpb25zKSB7XG4gICAgZ3JvdXBLZXlzID0gWy4uLmdyb3VwQ29sLnR5cGUub3B0aW9uc107XG4gICAgZm9yIChjb25zdCBrZXkgb2YgZ3JvdXBzLmtleXMoKSkge1xuICAgICAgaWYgKCFncm91cEtleXMuaW5jbHVkZXMoa2V5KSkgZ3JvdXBLZXlzLnB1c2goa2V5KTtcbiAgICB9XG4gIH0gZWxzZSB7XG4gICAgZ3JvdXBLZXlzID0gWy4uLmdyb3Vwcy5rZXlzKCldO1xuICB9XG5cbiAgY29uc3QgbGFuZUNvbnRhaW5lciA9IGthbmJhbi5jcmVhdGVEaXYoXCJ6aWJhc2Uta2FuYmFuLWxhbmVzXCIpO1xuXG4gIGdyb3VwS2V5cy5mb3JFYWNoKChncm91cFZhbHVlKSA9PiB7XG4gICAgY29uc3QgaXRlbXMgPSBncm91cHMuZ2V0KGdyb3VwVmFsdWUpIHx8IFtdO1xuICAgIGNvbnN0IGxhbmUgPSBsYW5lQ29udGFpbmVyLmNyZWF0ZURpdihcInppYmFzZS1rYW5iYW4tbGFuZVwiKTtcbiAgICBjb25zdCBjb2xvciA9IGdldExhYmVsQ29sb3IoZ3JvdXBWYWx1ZSk7XG5cbiAgICBjb25zdCBoZWFkZXIgPSBsYW5lLmNyZWF0ZURpdihcInppYmFzZS1rYW5iYW4tbGFuZS1oZWFkZXJcIik7XG4gICAgaGVhZGVyLnNldENzc1Byb3BzKHsgXCItLWxhbmUtY29sb3JcIjogY29sb3IgfSk7XG4gICAgY29uc3QgaGVhZGVyTGFiZWwgPSBoZWFkZXIuY3JlYXRlU3Bhbih7IHRleHQ6IGdyb3VwVmFsdWUsIGNsczogXCJ6aWJhc2Uta2FuYmFuLWxhbmUtdGl0bGVcIiB9KTtcbiAgICBoZWFkZXJMYWJlbC5zZXRDc3NTdHlsZXMoeyBjb2xvciB9KTtcbiAgICBoZWFkZXIuY3JlYXRlU3Bhbih7IHRleHQ6IGAke2l0ZW1zLmxlbmd0aH1gLCBjbHM6IFwiemliYXNlLWthbmJhbi1sYW5lLWNvdW50XCIgfSk7XG5cbiAgICBjb25zdCBsYW5lQm9keSA9IGxhbmUuY3JlYXRlRGl2KFwiemliYXNlLWthbmJhbi1sYW5lLWJvZHlcIik7XG4gICAgbGFuZUJvZHkuZGF0YXNldC5ncm91cCA9IGdyb3VwVmFsdWU7XG5cbiAgICBsYW5lQm9keS5hZGRFdmVudExpc3RlbmVyKFwiZHJhZ292ZXJcIiwgKGUpID0+IHtcbiAgICAgIGUucHJldmVudERlZmF1bHQoKTtcbiAgICAgIGxhbmVCb2R5LmNsYXNzTGlzdC5hZGQoXCJ6aWJhc2Uta2FuYmFuLWxhbmUtZHJhZ292ZXJcIik7XG4gICAgfSk7XG4gICAgbGFuZUJvZHkuYWRkRXZlbnRMaXN0ZW5lcihcImRyYWdsZWF2ZVwiLCAoKSA9PiB7XG4gICAgICBsYW5lQm9keS5jbGFzc0xpc3QucmVtb3ZlKFwiemliYXNlLWthbmJhbi1sYW5lLWRyYWdvdmVyXCIpO1xuICAgIH0pO1xuICAgIGxhbmVCb2R5LmFkZEV2ZW50TGlzdGVuZXIoXCJkcm9wXCIsIChlKSA9PiB7XG4gICAgICBlLnByZXZlbnREZWZhdWx0KCk7XG4gICAgICBsYW5lQm9keS5jbGFzc0xpc3QucmVtb3ZlKFwiemliYXNlLWthbmJhbi1sYW5lLWRyYWdvdmVyXCIpO1xuICAgICAgY29uc3QgZnJvbUlkeFN0ciA9IGUuZGF0YVRyYW5zZmVyPy5nZXREYXRhKFwidGV4dC9rYW5iYW4tcm93XCIpO1xuICAgICAgaWYgKCFmcm9tSWR4U3RyKSByZXR1cm47XG4gICAgICBjb25zdCBmcm9tSWR4ID0gcGFyc2VJbnQoZnJvbUlkeFN0ciwgMTApO1xuICAgICAgbGV0IG5ld1ZhbHVlID0gZ3JvdXBWYWx1ZTtcbiAgICAgIGlmIChncm91cENvbC50eXBlLmtpbmQgPT09IFwibXVsdGktc2VsZWN0XCIpIHtcbiAgICAgICAgY29uc3Qgcm93TGluZSA9IHJhd0RhdGFMaW5lc1tmcm9tSWR4XTtcbiAgICAgICAgY29uc3Qgcm93Q2VsbHMgPSBzcGxpdFJvdyhyb3dMaW5lKTtcbiAgICAgICAgY29uc3QgY3VycmVudFJhdyA9IChyb3dDZWxsc1tncm91cENvbC5pbmRleF0gfHwgXCJcIikudHJpbSgpO1xuICAgICAgICBjb25zdCB0YWdzID0gcGFyc2VNdWx0aVNlbGVjdChjdXJyZW50UmF3KTtcbiAgICAgICAgaWYgKCF0YWdzLmluY2x1ZGVzKGdyb3VwVmFsdWUpKSB0YWdzLnB1c2goZ3JvdXBWYWx1ZSk7XG4gICAgICAgIG5ld1ZhbHVlID0gdGFncy5qb2luKFwiLCBcIik7XG4gICAgICB9XG4gICAgICB2b2lkIGhvc3Qud3JpdGVCYWNrKGNvbnRleHQsIHNlY3Rpb25JbmZvLCBzY2hlbWEuZGF0YVN0YXJ0SW5kZXggKyBmcm9tSWR4LCBncm91cENvbC5pbmRleCwgbmV3VmFsdWUpO1xuICAgIH0pO1xuXG4gICAgaXRlbXMuZm9yRWFjaCgoeyBsaW5lLCBjZWxscyB9KSA9PiB7XG4gICAgICBjb25zdCByYXdJZHggPSByYXdEYXRhTGluZXMuZmluZEluZGV4KChsKSA9PiBsID09PSBsaW5lKTtcbiAgICAgIGNvbnN0IGNhcmQgPSBsYW5lQm9keS5jcmVhdGVEaXYoXCJ6aWJhc2Uta2FuYmFuLWNhcmRcIik7XG4gICAgICBjYXJkLmRyYWdnYWJsZSA9IHRydWU7XG4gICAgICBjYXJkLmFkZEV2ZW50TGlzdGVuZXIoXCJkcmFnc3RhcnRcIiwgKGUpID0+IHtcbiAgICAgICAgZS5kYXRhVHJhbnNmZXI/LnNldERhdGEoXCJ0ZXh0L2thbmJhbi1yb3dcIiwgcmF3SWR4LnRvU3RyaW5nKCkpO1xuICAgICAgICBjYXJkLmNsYXNzTGlzdC5hZGQoXCJ6aWJhc2Uta2FuYmFuLWNhcmQtZHJhZ2dpbmdcIik7XG4gICAgICB9KTtcbiAgICAgIGNhcmQuYWRkRXZlbnRMaXN0ZW5lcihcImRyYWdlbmRcIiwgKCkgPT4ge1xuICAgICAgICBjYXJkLmNsYXNzTGlzdC5yZW1vdmUoXCJ6aWJhc2Uta2FuYmFuLWNhcmQtZHJhZ2dpbmdcIik7XG4gICAgICB9KTtcblxuICAgICAgc2NoZW1hLmNvbHVtbnMuZm9yRWFjaCgoY29sLCBjb2xJZHgpID0+IHtcbiAgICAgICAgaWYgKGNvbElkeCA9PT0gZ3JvdXBDb2wuaW5kZXgpIHJldHVybjtcbiAgICAgICAgY29uc3QgcmF3VmFsdWUgPSAoY2VsbHNbY29sSWR4XSA/PyBcIlwiKS50cmltKCk7XG4gICAgICAgIGlmICghcmF3VmFsdWUpIHJldHVybjtcblxuICAgICAgICBpZiAoY29sLnR5cGUua2luZCA9PT0gXCJ0ZXh0XCIpIHtcbiAgICAgICAgICBpZiAoIWNhcmQucXVlcnlTZWxlY3RvcihcIi56aWJhc2Uta2FuYmFuLWNhcmQtdGl0bGVcIikpIHtcbiAgICAgICAgICAgIGNvbnN0IHRpdGxlRWwgPSBjYXJkLmNyZWF0ZURpdihcInppYmFzZS1rYW5iYW4tY2FyZC10aXRsZVwiKTtcbiAgICAgICAgICAgIHZvaWQgTWFya2Rvd25SZW5kZXJlci5yZW5kZXIoaG9zdC5hcHAsIHJhd1ZhbHVlLCB0aXRsZUVsLCBjb250ZXh0LnNvdXJjZVBhdGgsIGhvc3QucGx1Z2luKTtcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICBjb25zdCBmaWVsZCA9IGNhcmQuY3JlYXRlRGl2KFwiemliYXNlLWthbmJhbi1jYXJkLWZpZWxkXCIpO1xuICAgICAgICBmaWVsZC5jcmVhdGVTcGFuKHsgdGV4dDogY29sLm5hbWUsIGNsczogXCJ6aWJhc2Uta2FuYmFuLWZpZWxkLWxhYmVsXCIgfSk7XG5cbiAgICAgICAgaWYgKGNvbC50eXBlLmtpbmQgPT09IFwibGFiZWxcIikge1xuICAgICAgICAgIGNvbnN0IGNoaXAgPSBmaWVsZC5jcmVhdGVTcGFuKHsgdGV4dDogcmF3VmFsdWUsIGNsczogXCJ6aWJhc2UtbGFiZWwgemliYXNlLWthbmJhbi1sYWJlbFwiIH0pO1xuICAgICAgICAgIGNoaXAuc2V0Q3NzUHJvcHMoeyBcIi0tbGNcIjogZ2V0TGFiZWxDb2xvcihyYXdWYWx1ZSkgfSk7XG4gICAgICAgIH0gZWxzZSBpZiAoY29sLnR5cGUua2luZCA9PT0gXCJ0b2dnbGVcIikge1xuICAgICAgICAgIGZpZWxkLmNyZWF0ZVNwYW4oeyB0ZXh0OiBwYXJzZUJvb2wocmF3VmFsdWUpID8gXCJcdTI3MDVcIiA6IFwiXHUyQjFDXCIsIGNsczogXCJ6aWJhc2Uta2FuYmFuLWZpZWxkLXZhbHVlXCIgfSk7XG4gICAgICAgIH0gZWxzZSBpZiAoY29sLnR5cGUua2luZCA9PT0gXCJudW1iZXJcIiB8fCBjb2wudHlwZS5raW5kID09PSBcImZvcm11bGFcIikge1xuICAgICAgICAgIGZpZWxkLmNyZWF0ZVNwYW4oeyB0ZXh0OiByYXdWYWx1ZSwgY2xzOiBcInppYmFzZS1rYW5iYW4tZmllbGQtdmFsdWVcIiB9KTtcbiAgICAgICAgfSBlbHNlIGlmIChjb2wudHlwZS5raW5kID09PSBcImRhdGVcIikge1xuICAgICAgICAgIGZpZWxkLmNyZWF0ZVNwYW4oeyB0ZXh0OiByYXdWYWx1ZSwgY2xzOiBcInppYmFzZS1rYW5iYW4tZmllbGQtdmFsdWUgemliYXNlLWRhdGUtcmVuZGVyZWRcIiB9KTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBmaWVsZC5jcmVhdGVTcGFuKHsgdGV4dDogcmF3VmFsdWUsIGNsczogXCJ6aWJhc2Uta2FuYmFuLWZpZWxkLXZhbHVlXCIgfSk7XG4gICAgICAgIH1cbiAgICAgIH0pO1xuXG4gICAgICBpZiAoIWNhcmQucXVlcnlTZWxlY3RvcihcIi56aWJhc2Uta2FuYmFuLWNhcmQtdGl0bGVcIikpIHtcbiAgICAgICAgY29uc3QgdGl0bGVFbCA9IGNyZWF0ZURpdigpO1xuICAgICAgICB0aXRsZUVsLmNsYXNzTmFtZSA9IFwiemliYXNlLWthbmJhbi1jYXJkLXRpdGxlXCI7XG4gICAgICAgIHZvaWQgTWFya2Rvd25SZW5kZXJlci5yZW5kZXIoaG9zdC5hcHAsIGNlbGxzWzBdIHx8IFwiXHUyMDE0XCIsIHRpdGxlRWwsIGNvbnRleHQuc291cmNlUGF0aCwgaG9zdC5wbHVnaW4pO1xuICAgICAgICBjYXJkLmluc2VydEJlZm9yZSh0aXRsZUVsLCBjYXJkLmZpcnN0Q2hpbGQpO1xuICAgICAgfVxuICAgIH0pO1xuICB9KTtcbn1cbiIsICJpbXBvcnQgeyBURmlsZSwgdHlwZSBNYXJrZG93blBvc3RQcm9jZXNzb3JDb250ZXh0LCB0eXBlIE1hcmtkb3duU2VjdGlvbkluZm9ybWF0aW9uIH0gZnJvbSBcIm9ic2lkaWFuXCI7XG5pbXBvcnQgeyBmb3JtYXRSZXN1bHQgfSBmcm9tIFwiLi4vZm9ybXVsYVwiO1xuaW1wb3J0IHsgZmlsdGVyRGF0YVJvd3MsIHNlcmlhbGl6ZVJvdywgc3BsaXRSb3cgfSBmcm9tIFwiLi4vc2NoZW1hXCI7XG5pbXBvcnQgdHlwZSB7IFRhYmxlU2NoZW1hLCBaaUJhc2VIb3N0IH0gZnJvbSBcIi4uL3R5cGVzXCI7XG5pbXBvcnQgeyBnZXRUeXBlSWNvbiB9IGZyb20gXCIuLi91aVwiO1xuXG5pbnRlcmZhY2UgU3RhdFRoIGV4dGVuZHMgSFRNTFRhYmxlQ2VsbEVsZW1lbnQge1xuICBfdXBkYXRlU3RhdD86ICgpID0+IHZvaWQ7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBidWlsZFRhYmxlVmlldyhcbiAgaG9zdDogWmlCYXNlSG9zdCxcbiAgYm9keTogSFRNTEVsZW1lbnQsXG4gIHNjaGVtYTogVGFibGVTY2hlbWEsXG4gIGdldERhdGFSb3dzOiAoKSA9PiBzdHJpbmdbXSxcbiAgcmF3RGF0YUxpbmVzOiBzdHJpbmdbXSxcbiAgY29udGV4dDogTWFya2Rvd25Qb3N0UHJvY2Vzc29yQ29udGV4dCxcbiAgc2VjdGlvbkluZm86IE1hcmtkb3duU2VjdGlvbkluZm9ybWF0aW9uLFxuICBmaWx0ZXJRdWVyeTogc3RyaW5nLFxuICBzb3J0Q29sSWR4OiBudW1iZXIgfCBudWxsLFxuICBzb3J0QXNjOiBib29sZWFuLFxuICBiYWRnZTogSFRNTEVsZW1lbnQsXG4gIG9uU29ydENoYW5nZTogKGNvbDogbnVtYmVyLCBhc2M6IGJvb2xlYW4pID0+IHZvaWQsXG4pOiB2b2lkIHtcbiAgY29uc3QgdGFibGVFbCA9IGJvZHkuY3JlYXRlRWwoXCJ0YWJsZVwiLCB7IGNsczogXCJ6aWJhc2UtdGFibGVcIiB9KTtcbiAgY29uc3QgdGhlYWQgPSB0YWJsZUVsLmNyZWF0ZUVsKFwidGhlYWRcIik7XG4gIGNvbnN0IGhlYWRlclJvdyA9IHRoZWFkLmNyZWF0ZUVsKFwidHJcIik7XG4gIGNvbnN0IHN0YXRNb2RlczogUmVjb3JkPG51bWJlciwgc3RyaW5nPiA9IHt9O1xuXG4gIHNjaGVtYS5jb2x1bW5zLmZvckVhY2goKGNvbCwgY29sSWR4KSA9PiB7XG4gICAgY29uc3QgdGggPSBoZWFkZXJSb3cuY3JlYXRlRWwoXCJ0aFwiLCB7IGNsczogXCJ6aWJhc2UtdGhcIiB9KSBhcyBTdGF0VGg7XG4gICAgdGguZHJhZ2dhYmxlID0gdHJ1ZTtcbiAgICB0aC5hZGRFdmVudExpc3RlbmVyKFwiZHJhZ3N0YXJ0XCIsIChlKSA9PiB7XG4gICAgICBlLnN0b3BQcm9wYWdhdGlvbigpO1xuICAgICAgZS5kYXRhVHJhbnNmZXI/LnNldERhdGEoXCJ0ZXh0L2NvbFwiLCBjb2xJZHgudG9TdHJpbmcoKSk7XG4gICAgfSk7XG4gICAgdGguYWRkRXZlbnRMaXN0ZW5lcihcImRyYWdvdmVyXCIsIChlKSA9PiB7XG4gICAgICBlLnByZXZlbnREZWZhdWx0KCk7XG4gICAgICB0aC5jbGFzc0xpc3QuYWRkKFwiemliYXNlLXRoLWRyb3AtdGFyZ2V0XCIpO1xuICAgIH0pO1xuICAgIHRoLmFkZEV2ZW50TGlzdGVuZXIoXCJkcmFnbGVhdmVcIiwgKCkgPT4gdGguY2xhc3NMaXN0LnJlbW92ZShcInppYmFzZS10aC1kcm9wLXRhcmdldFwiKSk7XG4gICAgdGguYWRkRXZlbnRMaXN0ZW5lcihcImRyYWdlbmRcIiwgKCkgPT4ge1xuICAgICAgdGhlYWQucXVlcnlTZWxlY3RvckFsbChcIi56aWJhc2UtdGhcIikuZm9yRWFjaCgoZWwpID0+IGVsLmNsYXNzTGlzdC5yZW1vdmUoXCJ6aWJhc2UtdGgtZHJvcC10YXJnZXRcIikpO1xuICAgIH0pO1xuICAgIHRoLmFkZEV2ZW50TGlzdGVuZXIoXCJkcm9wXCIsIChlKSA9PiB7XG4gICAgICBlLnByZXZlbnREZWZhdWx0KCk7XG4gICAgICBlLnN0b3BQcm9wYWdhdGlvbigpO1xuICAgICAgdGguY2xhc3NMaXN0LnJlbW92ZShcInppYmFzZS10aC1kcm9wLXRhcmdldFwiKTtcbiAgICAgIGNvbnN0IGZyb21Db2xTdHIgPSBlLmRhdGFUcmFuc2Zlcj8uZ2V0RGF0YShcInRleHQvY29sXCIpO1xuICAgICAgaWYgKCFmcm9tQ29sU3RyKSByZXR1cm47XG4gICAgICBjb25zdCBmcm9tQ29sSWR4ID0gcGFyc2VJbnQoZnJvbUNvbFN0ciwgMTApO1xuICAgICAgaWYgKGZyb21Db2xJZHggPT09IGNvbElkeCkgcmV0dXJuO1xuICAgICAgdm9pZCAoYXN5bmMgKCkgPT4ge1xuICAgICAgICBjb25zdCBmaWxlID0gaG9zdC5hcHAudmF1bHQuZ2V0QWJzdHJhY3RGaWxlQnlQYXRoKGNvbnRleHQuc291cmNlUGF0aCk7XG4gICAgICAgIGlmICghKGZpbGUgaW5zdGFuY2VvZiBURmlsZSkpIHJldHVybjtcbiAgICAgICAgYXdhaXQgaG9zdC5hcHAudmF1bHQucHJvY2VzcyhmaWxlLCAoY29udGVudCkgPT4ge1xuICAgICAgICAgIGNvbnN0IGFsbExpbmVzID0gY29udGVudC5zcGxpdChcIlxcblwiKTtcbiAgICAgICAgICBmb3IgKGxldCBpID0gc2VjdGlvbkluZm8ubGluZVN0YXJ0OyBpIDw9IHNlY3Rpb25JbmZvLmxpbmVFbmQ7IGkrKykge1xuICAgICAgICAgICAgY29uc3QgbGluZSA9IGFsbExpbmVzW2ldO1xuICAgICAgICAgICAgaWYgKCFsaW5lLmluY2x1ZGVzKFwifFwiKSkgY29udGludWU7XG4gICAgICAgICAgICBjb25zdCBjZWxscyA9IHNwbGl0Um93KGxpbmUpO1xuICAgICAgICAgICAgaWYgKGNlbGxzLmxlbmd0aCA8PSBmcm9tQ29sSWR4IHx8IGNlbGxzLmxlbmd0aCA8PSBjb2xJZHgpIGNvbnRpbnVlO1xuICAgICAgICAgICAgY29uc3QgZHJhZ2dlZENlbGwgPSBjZWxscy5zcGxpY2UoZnJvbUNvbElkeCwgMSlbMF07XG4gICAgICAgICAgICBsZXQgaW5zZXJ0SWR4ID0gY29sSWR4O1xuICAgICAgICAgICAgaWYgKGZyb21Db2xJZHggPCBjb2xJZHgpIGluc2VydElkeC0tO1xuICAgICAgICAgICAgY2VsbHMuc3BsaWNlKGluc2VydElkeCwgMCwgZHJhZ2dlZENlbGwpO1xuICAgICAgICAgICAgYWxsTGluZXNbaV0gPSBzZXJpYWxpemVSb3coY2VsbHMpO1xuICAgICAgICAgIH1cbiAgICAgICAgICByZXR1cm4gYWxsTGluZXMuam9pbihcIlxcblwiKTtcbiAgICAgICAgfSk7XG4gICAgICB9KSgpO1xuICAgIH0pO1xuXG4gICAgY29uc3QgdGhJbm5lciA9IHRoLmNyZWF0ZURpdihcInppYmFzZS10aC1pbm5lclwiKTtcbiAgICB0aElubmVyLmNyZWF0ZVNwYW4oeyB0ZXh0OiBjb2wubmFtZSwgY2xzOiBcInppYmFzZS10aC1uYW1lXCIgfSk7XG4gICAgdGhJbm5lci5jcmVhdGVTcGFuKHsgdGV4dDogZ2V0VHlwZUljb24oY29sLnR5cGUpLCBjbHM6IFwiemliYXNlLXR5cGUtaWNvblwiIH0pO1xuICAgIHRoSW5uZXIuY3JlYXRlU3Bhbih7IGNsczogXCJ6aWJhc2Utc29ydC1hcnJvd1wiLCB0ZXh0OiBcIlx1MjE5NVwiIH0pO1xuXG4gICAgaWYgKGNvbC50eXBlLmtpbmQgPT09IFwibnVtYmVyXCIgfHwgY29sLnR5cGUua2luZCA9PT0gXCJmb3JtdWxhXCIpIHtcbiAgICAgIGlmICghc3RhdE1vZGVzW2NvbElkeF0pIHN0YXRNb2Rlc1tjb2xJZHhdID0gXCJTVU1cIjtcbiAgICAgIGNvbnN0IHN0YXRCYWRnZSA9IHRoLmNyZWF0ZURpdihcInppYmFzZS10aC1zdGF0XCIpO1xuXG4gICAgICBjb25zdCB1cGRhdGVUaFN0YXQgPSAoKSA9PiB7XG4gICAgICAgIGNvbnN0IGRhdGFSb3dzID0gZmlsdGVyRGF0YVJvd3MoZ2V0RGF0YVJvd3MoKSwgZmlsdGVyUXVlcnkpO1xuICAgICAgICBjb25zdCB2YWx1ZXMgPSBkYXRhUm93c1xuICAgICAgICAgIC5tYXAoKGxpbmUpID0+IHBhcnNlRmxvYXQoKHNwbGl0Um93KGxpbmUpW2NvbElkeF0gPz8gXCJcIikudHJpbSgpKSlcbiAgICAgICAgICAuZmlsdGVyKChuKSA9PiAhTnVtYmVyLmlzTmFOKG4pKTtcblxuICAgICAgICBpZiAodmFsdWVzLmxlbmd0aCA9PT0gMCkge1xuICAgICAgICAgIHN0YXRCYWRnZS50ZXh0Q29udGVudCA9IFwiXCI7XG4gICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG5cbiAgICAgICAgY29uc3QgbW9kZSA9IHN0YXRNb2Rlc1tjb2xJZHhdO1xuICAgICAgICBsZXQgcmVzdWx0ID0gMDtcbiAgICAgICAgc3dpdGNoIChtb2RlKSB7XG4gICAgICAgICAgY2FzZSBcIlNVTVwiOiByZXN1bHQgPSB2YWx1ZXMucmVkdWNlKChhLCBiKSA9PiBhICsgYiwgMCk7IGJyZWFrO1xuICAgICAgICAgIGNhc2UgXCJBVkdcIjogcmVzdWx0ID0gdmFsdWVzLnJlZHVjZSgoYSwgYikgPT4gYSArIGIsIDApIC8gdmFsdWVzLmxlbmd0aDsgYnJlYWs7XG4gICAgICAgICAgY2FzZSBcIk1JTlwiOiByZXN1bHQgPSBNYXRoLm1pbiguLi52YWx1ZXMpOyBicmVhaztcbiAgICAgICAgICBjYXNlIFwiTUFYXCI6IHJlc3VsdCA9IE1hdGgubWF4KC4uLnZhbHVlcyk7IGJyZWFrO1xuICAgICAgICAgIGRlZmF1bHQ6IHJlc3VsdCA9IDA7XG4gICAgICAgIH1cblxuICAgICAgICBzdGF0QmFkZ2UuZW1wdHkoKTtcbiAgICAgICAgc3RhdEJhZGdlLmNyZWF0ZVNwYW4oeyB0ZXh0OiBtb2RlLCBjbHM6IFwiemliYXNlLXRoLXN0YXQtbW9kZVwiIH0pO1xuICAgICAgICBzdGF0QmFkZ2UuY3JlYXRlU3Bhbih7IHRleHQ6IFwiIFwiICsgZm9ybWF0UmVzdWx0KHJlc3VsdCksIGNsczogXCJ6aWJhc2UtdGgtc3RhdC12YWx1ZVwiIH0pO1xuICAgICAgfTtcblxuICAgICAgc3RhdEJhZGdlLmFkZEV2ZW50TGlzdGVuZXIoXCJjbGlja1wiLCAoZSkgPT4ge1xuICAgICAgICBlLnN0b3BQcm9wYWdhdGlvbigpO1xuICAgICAgICBjb25zdCBtb2RlcyA9IFtcIlNVTVwiLCBcIkFWR1wiLCBcIk1JTlwiLCBcIk1BWFwiXTtcbiAgICAgICAgY29uc3QgY3VycmVudCA9IG1vZGVzLmluZGV4T2Yoc3RhdE1vZGVzW2NvbElkeF0pO1xuICAgICAgICBzdGF0TW9kZXNbY29sSWR4XSA9IG1vZGVzWyhjdXJyZW50ICsgMSkgJSBtb2Rlcy5sZW5ndGhdO1xuICAgICAgICB1cGRhdGVUaFN0YXQoKTtcbiAgICAgIH0pO1xuXG4gICAgICB0aC5fdXBkYXRlU3RhdCA9IHVwZGF0ZVRoU3RhdDtcbiAgICAgIHVwZGF0ZVRoU3RhdCgpO1xuICAgIH1cblxuICAgIHRoLmFkZEV2ZW50TGlzdGVuZXIoXCJjbGlja1wiLCAoKSA9PiB7XG4gICAgICBjb25zdCBuZXdBc2MgPSBzb3J0Q29sSWR4ID09PSBjb2xJZHggPyAhc29ydEFzYyA6IHRydWU7XG4gICAgICBvblNvcnRDaGFuZ2UoY29sSWR4LCBuZXdBc2MpO1xuICAgICAgdGhlYWQucXVlcnlTZWxlY3RvckFsbChcIi56aWJhc2Utc29ydC1hcnJvd1wiKS5mb3JFYWNoKChlbCwgaSkgPT4ge1xuICAgICAgICBlbC50ZXh0Q29udGVudCA9IGkgPT09IGNvbElkeCA/IChuZXdBc2MgPyBcIlx1MjE5MVwiIDogXCJcdTIxOTNcIikgOiBcIlx1MjE5NVwiO1xuICAgICAgICBlbC5jbGFzc0xpc3QudG9nZ2xlKFwiemliYXNlLXNvcnQtYWN0aXZlXCIsIGkgPT09IGNvbElkeCk7XG4gICAgICB9KTtcbiAgICAgIHJlbmRlclJvd3MoKTtcbiAgICAgIHRoZWFkLnF1ZXJ5U2VsZWN0b3JBbGwoXCIuemliYXNlLXRoXCIpLmZvckVhY2goKHRoRWwpID0+IHtcbiAgICAgICAgY29uc3Qgc3RhdFRoID0gdGhFbCBhcyBTdGF0VGg7XG4gICAgICAgIGlmIChzdGF0VGguX3VwZGF0ZVN0YXQpIHN0YXRUaC5fdXBkYXRlU3RhdCgpO1xuICAgICAgfSk7XG4gICAgfSk7XG4gICAgdGguYWRkRXZlbnRMaXN0ZW5lcihcImNvbnRleHRtZW51XCIsIChlKSA9PiB7XG4gICAgICBlLnByZXZlbnREZWZhdWx0KCk7XG4gICAgICBob3N0LnNob3dUeXBlTWVudShlLCBjb2xJZHgsIHNjaGVtYSwgY29udGV4dCwgc2VjdGlvbkluZm8sIHJhd0RhdGFMaW5lcywgYmFkZ2UpO1xuICAgIH0pO1xuICB9KTtcblxuICBjb25zdCB0Ym9keSA9IHRhYmxlRWwuY3JlYXRlRWwoXCJ0Ym9keVwiKTtcblxuICBjb25zdCByZW5kZXJSb3dzID0gKCkgPT4ge1xuICAgIHRib2R5LmVtcHR5KCk7XG4gICAgbGV0IGRhdGFSb3dzID0gZmlsdGVyRGF0YVJvd3MoZ2V0RGF0YVJvd3MoKSwgZmlsdGVyUXVlcnkpO1xuICAgIGlmIChzb3J0Q29sSWR4ICE9PSBudWxsKSB7XG4gICAgICBjb25zdCBpZHggPSBzb3J0Q29sSWR4O1xuICAgICAgY29uc3QgY29sVHlwZSA9IHNjaGVtYS5jb2x1bW5zW2lkeF0/LnR5cGUua2luZCA/PyBcInRleHRcIjtcbiAgICAgIGRhdGFSb3dzID0gWy4uLmRhdGFSb3dzXS5zb3J0KChhLCBiKSA9PiB7XG4gICAgICAgIGNvbnN0IGF2ID0gKHNwbGl0Um93KGEpW2lkeF0gPz8gXCJcIikudHJpbSgpO1xuICAgICAgICBjb25zdCBidiA9IChzcGxpdFJvdyhiKVtpZHhdID8/IFwiXCIpLnRyaW0oKTtcbiAgICAgICAgaWYgKGNvbFR5cGUgPT09IFwibnVtYmVyXCIgfHwgY29sVHlwZSA9PT0gXCJmb3JtdWxhXCIpIHtcbiAgICAgICAgICBjb25zdCBuYSA9IHBhcnNlRmxvYXQoYXYpO1xuICAgICAgICAgIGNvbnN0IG5iID0gcGFyc2VGbG9hdChidik7XG4gICAgICAgICAgaWYgKCFOdW1iZXIuaXNOYU4obmEpICYmICFOdW1iZXIuaXNOYU4obmIpKSByZXR1cm4gc29ydEFzYyA/IG5hIC0gbmIgOiBuYiAtIG5hO1xuICAgICAgICB9XG4gICAgICAgIGlmIChjb2xUeXBlID09PSBcImRhdGVcIikge1xuICAgICAgICAgIGNvbnN0IGRhID0gbmV3IERhdGUoYXYpLmdldFRpbWUoKTtcbiAgICAgICAgICBjb25zdCBkYiA9IG5ldyBEYXRlKGJ2KS5nZXRUaW1lKCk7XG4gICAgICAgICAgaWYgKCFOdW1iZXIuaXNOYU4oZGEpICYmICFOdW1iZXIuaXNOYU4oZGIpKSByZXR1cm4gc29ydEFzYyA/IGRhIC0gZGIgOiBkYiAtIGRhO1xuICAgICAgICB9XG4gICAgICAgIGlmIChjb2xUeXBlID09PSBcInRvZ2dsZVwiKSB7XG4gICAgICAgICAgY29uc3QgYmEgPSBhdi50b0xvd2VyQ2FzZSgpID09PSBcInRydWVcIiA/IDEgOiAwO1xuICAgICAgICAgIGNvbnN0IGJiID0gYnYudG9Mb3dlckNhc2UoKSA9PT0gXCJ0cnVlXCIgPyAxIDogMDtcbiAgICAgICAgICByZXR1cm4gc29ydEFzYyA/IGJhIC0gYmIgOiBiYiAtIGJhO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiBzb3J0QXNjID8gYXYubG9jYWxlQ29tcGFyZShidikgOiBidi5sb2NhbGVDb21wYXJlKGF2KTtcbiAgICAgIH0pO1xuICAgIH1cbiAgICBpZiAoZGF0YVJvd3MubGVuZ3RoID09PSAwKSB7XG4gICAgICBjb25zdCBlbXB0eVRkID0gdGJvZHkuY3JlYXRlRWwoXCJ0clwiKS5jcmVhdGVFbChcInRkXCIsIHsgY2xzOiBcInppYmFzZS1lbXB0eVwiIH0pO1xuICAgICAgZW1wdHlUZC5jb2xTcGFuID0gc2NoZW1hLmNvbHVtbnMubGVuZ3RoO1xuICAgICAgZW1wdHlUZC50ZXh0Q29udGVudCA9IGZpbHRlclF1ZXJ5ID8gXCJObyBtYXRjaGluZyByb3dzXCIgOiBcIk5vIGRhdGFcIjtcbiAgICAgIHJldHVybjtcbiAgICB9XG4gICAgZGF0YVJvd3MuZm9yRWFjaCgobGluZSkgPT4ge1xuICAgICAgY29uc3QgcmF3SWR4ID0gcmF3RGF0YUxpbmVzLmZpbmRJbmRleCgobCkgPT4gbCA9PT0gbGluZSk7XG4gICAgICBjb25zdCBjZWxscyA9IHNwbGl0Um93KGxpbmUpO1xuICAgICAgY29uc3QgdHIgPSB0Ym9keS5jcmVhdGVFbChcInRyXCIsIHsgY2xzOiBcInppYmFzZS1yb3dcIiB9KTtcbiAgICAgIHRyLmRyYWdnYWJsZSA9IHRydWU7XG4gICAgICB0ci5hZGRFdmVudExpc3RlbmVyKFwiZHJhZ3N0YXJ0XCIsIChlKSA9PiB7XG4gICAgICAgIGUuZGF0YVRyYW5zZmVyPy5zZXREYXRhKFwidGV4dC9yb3dcIiwgcmF3SWR4LnRvU3RyaW5nKCkpO1xuICAgICAgICB0ci5jbGFzc0xpc3QuYWRkKFwiemliYXNlLXJvdy1kcmFnZ2luZ1wiKTtcbiAgICAgIH0pO1xuICAgICAgdHIuYWRkRXZlbnRMaXN0ZW5lcihcImRyYWdlbmRcIiwgKCkgPT4ge1xuICAgICAgICB0ci5jbGFzc0xpc3QucmVtb3ZlKFwiemliYXNlLXJvdy1kcmFnZ2luZ1wiKTtcbiAgICAgICAgdGJvZHkucXVlcnlTZWxlY3RvckFsbChcIi56aWJhc2Utcm93XCIpLmZvckVhY2goKGVsKSA9PiBlbC5jbGFzc0xpc3QucmVtb3ZlKFwiemliYXNlLXJvdy1kcm9wLXRhcmdldFwiKSk7XG4gICAgICB9KTtcbiAgICAgIHRyLmFkZEV2ZW50TGlzdGVuZXIoXCJkcmFnb3ZlclwiLCAoZSkgPT4ge1xuICAgICAgICBlLnByZXZlbnREZWZhdWx0KCk7XG4gICAgICAgIHRyLmNsYXNzTGlzdC5hZGQoXCJ6aWJhc2Utcm93LWRyb3AtdGFyZ2V0XCIpO1xuICAgICAgfSk7XG4gICAgICB0ci5hZGRFdmVudExpc3RlbmVyKFwiZHJhZ2xlYXZlXCIsICgpID0+IHRyLmNsYXNzTGlzdC5yZW1vdmUoXCJ6aWJhc2Utcm93LWRyb3AtdGFyZ2V0XCIpKTtcbiAgICAgIHRyLmFkZEV2ZW50TGlzdGVuZXIoXCJkcm9wXCIsIChlKSA9PiB7XG4gICAgICAgIGUucHJldmVudERlZmF1bHQoKTtcbiAgICAgICAgZS5zdG9wUHJvcGFnYXRpb24oKTtcbiAgICAgICAgdHIuY2xhc3NMaXN0LnJlbW92ZShcInppYmFzZS1yb3ctZHJvcC10YXJnZXRcIik7XG4gICAgICAgIGNvbnN0IGZyb21JZHhTdHIgPSBlLmRhdGFUcmFuc2Zlcj8uZ2V0RGF0YShcInRleHQvcm93XCIpO1xuICAgICAgICBpZiAoIWZyb21JZHhTdHIpIHJldHVybjtcbiAgICAgICAgY29uc3QgZnJvbUlkeCA9IHBhcnNlSW50KGZyb21JZHhTdHIsIDEwKTtcbiAgICAgICAgY29uc3QgdG9JZHggPSByYXdJZHg7XG4gICAgICAgIGlmIChmcm9tSWR4ICE9PSB0b0lkeCkge1xuICAgICAgICAgIHZvaWQgKGFzeW5jICgpID0+IHtcbiAgICAgICAgICAgIGNvbnN0IGZpbGUgPSBob3N0LmFwcC52YXVsdC5nZXRBYnN0cmFjdEZpbGVCeVBhdGgoY29udGV4dC5zb3VyY2VQYXRoKTtcbiAgICAgICAgICAgIGlmICghKGZpbGUgaW5zdGFuY2VvZiBURmlsZSkpIHJldHVybjtcbiAgICAgICAgICAgIGF3YWl0IGhvc3QuYXBwLnZhdWx0LnByb2Nlc3MoZmlsZSwgKGNvbnRlbnQpID0+IHtcbiAgICAgICAgICAgICAgY29uc3QgYWxsTGluZXMgPSBjb250ZW50LnNwbGl0KFwiXFxuXCIpO1xuICAgICAgICAgICAgICBjb25zdCBmaWxlU3RhcnQgPSBzZWN0aW9uSW5mby5saW5lU3RhcnQgKyBzY2hlbWEuZGF0YVN0YXJ0SW5kZXg7XG4gICAgICAgICAgICAgIGNvbnN0IGRhdGFMaW5lcyA9IGFsbExpbmVzLnNsaWNlKGZpbGVTdGFydCwgZmlsZVN0YXJ0ICsgcmF3RGF0YUxpbmVzLmxlbmd0aCk7XG4gICAgICAgICAgICAgIGNvbnN0IGRyYWdnZWQgPSBkYXRhTGluZXMuc3BsaWNlKGZyb21JZHgsIDEpWzBdO1xuICAgICAgICAgICAgICBsZXQgaW5zZXJ0SWR4ID0gdG9JZHg7XG4gICAgICAgICAgICAgIGlmIChmcm9tSWR4IDwgdG9JZHgpIGluc2VydElkeC0tO1xuICAgICAgICAgICAgICBkYXRhTGluZXMuc3BsaWNlKGluc2VydElkeCwgMCwgZHJhZ2dlZCk7XG4gICAgICAgICAgICAgIGFsbExpbmVzLnNwbGljZShmaWxlU3RhcnQsIHJhd0RhdGFMaW5lcy5sZW5ndGgsIC4uLmRhdGFMaW5lcyk7XG4gICAgICAgICAgICAgIHJldHVybiBhbGxMaW5lcy5qb2luKFwiXFxuXCIpO1xuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgfSkoKTtcbiAgICAgICAgfVxuICAgICAgfSk7XG4gICAgICBzY2hlbWEuY29sdW1ucy5mb3JFYWNoKChjb2wsIGNvbElkeCkgPT4ge1xuICAgICAgICBjb25zdCB0ZCA9IHRyLmNyZWF0ZUVsKFwidGRcIiwgeyBjbHM6IFwiemliYXNlLXRkXCIgfSk7XG4gICAgICAgIGNvbnN0IHJhd1ZhbHVlID0gY2VsbHNbY29sSWR4XSA/PyBcIlwiO1xuICAgICAgICBob3N0LnJlbmRlckNlbGwodGQsIGNvbCwgcmF3VmFsdWUsIGNvbnRleHQsIHNjaGVtYSwgY2VsbHMsIChuZXdWYWx1ZSkgPT4ge1xuICAgICAgICAgIGlmIChyYXdJZHggIT09IC0xKSB7XG4gICAgICAgICAgICBjb25zdCB1cGRhdGVkQ2VsbHMgPSBzcGxpdFJvdyhyYXdEYXRhTGluZXNbcmF3SWR4XSk7XG4gICAgICAgICAgICB1cGRhdGVkQ2VsbHNbY29sSWR4XSA9IGAgJHtuZXdWYWx1ZX0gYDtcbiAgICAgICAgICAgIHJhd0RhdGFMaW5lc1tyYXdJZHhdID0gc2VyaWFsaXplUm93KHVwZGF0ZWRDZWxscyk7XG4gICAgICAgICAgfVxuICAgICAgICAgIHZvaWQgaG9zdC53cml0ZUJhY2soY29udGV4dCwgc2VjdGlvbkluZm8sIHNjaGVtYS5kYXRhU3RhcnRJbmRleCArIHJhd0lkeCwgY29sSWR4LCBuZXdWYWx1ZSk7XG4gICAgICAgIH0pO1xuICAgICAgfSk7XG4gICAgfSk7XG4gIH07XG4gIHJlbmRlclJvd3MoKTtcbn1cbiIsICJleHBvcnQgY29uc3QgUExVR0lOX1ZFUlNJT04gPSBcIjEuMi4yXCI7XG4iXSwKICAibWFwcGluZ3MiOiAiOzs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQSxJQUFBQSxtQkFBeUU7OztBQ0VsRSxJQUFNLGdCQUFnQjtBQUN0QixJQUFNLHFCQUFxQjtBQUMzQixJQUFNLFVBQVU7QUFDaEIsSUFBTSxZQUFZO0FBRWxCLElBQU0sdUJBQXFDO0FBQUEsRUFDaEQsRUFBRSxNQUFNLFVBQVUsTUFBTSxRQUFRO0FBQUEsRUFDaEMsRUFBRSxNQUFNLFlBQVksTUFBTSxRQUFRO0FBQUEsRUFDbEMsRUFBRSxNQUFNLE9BQU8s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Q0FBQyxNQUFrQixRQUFnQjtBQUMxRSxZQUFNLE1BQU0sVUFBVSxVQUFVLGlCQUFpQjtBQUNqRCxZQUFNLFlBQVksSUFBSSxTQUFTLFNBQVMsRUFBRSxNQUFNLFFBQVEsS0FBSyxvQkFBb0IsT0FBTyxLQUFLLEtBQUssQ0FBQztBQUNuRyxnQkFBVSxjQUFjO0FBQ3hCLGdCQUFVLGlCQUFpQixVQUFVLE1BQU07QUFDekMsY0FBTSxZQUFZO0FBQ2hCLGVBQUssT0FBTyxTQUFTLFlBQVksR0FBRyxFQUFFLE9BQU8sVUFBVSxNQUFNLEtBQUs7QUFDbEUsZ0JBQU0sS0FBSyxPQUFPLGFBQWE7QUFBQSxRQUNqQyxHQUFHO0FBQUEsTUFDTCxDQUFDO0FBQ0QsVUFBSSxXQUFXLEVBQUUsTUFBTSxVQUFLLEtBQUssb0JBQW9CLENBQUM7QUFDdEQsWUFBTSxhQUFhLElBQUksU0FBUyxVQUFVLEVBQUUsS0FBSyxtQkFBbUIsQ0FBQztBQUNyRSwwQkFBb0IsUUFBUSxDQUFDLE1BQU07QUFDakMsY0FBTSxNQUFNLFdBQVcsU0FBUyxVQUFVLEVBQUUsTUFBTSxHQUFHLE9BQU8sRUFBRSxDQUFDO0FBQy9ELFlBQUksTUFBTSxLQUFLO0FBQU0sY0FBSSxXQUFXO0FBQUEsTUFDdEMsQ0FBQztBQUNELGlCQUFXLGlCQUFpQixVQUFVLE1BQU07QUFDMUMsY0FBTSxZQUFZO0FBQ2hCLGVBQUssT0FBTyxTQUFTLFlBQVksR0FBRyxFQUFFLE9BQU8sV0FBVztBQUN4RCxnQkFBTSxLQUFLLE9BQU8sYUFBYTtBQUFBLFFBQ2pDLEdBQUc7QUFBQSxNQUNMLENBQUM7QUFDRCxZQUFNLFlBQVksSUFBSSxTQUFTLFVBQVUsRUFBRSxNQUFNLFFBQUssS0FBSyxxQkFBcUIsQ0FBQztBQUNqRixnQkFBVSxpQkFBaUIsU0FBUyxNQUFNO0FBQ3hDLGNBQU0sWUFBWTtBQUNoQixlQUFLLE9BQU8sU0FBUyxZQUFZLE9BQU8sS0FBSyxDQUFDO0FBQzlDLGdCQUFNLEtBQUssT0FBTyxhQUFhO0FBQy9CLGVBQUssWUFBWSxTQUFTO0FBQUEsUUFDNUIsR0FBRztBQUFBLE1BQ0wsQ0FBQztBQUFBLElBQ0gsQ0FBQztBQUFBLEVBQ0g7QUFDRjsiLAogICJuYW1lcyI6IFsiaW1wb3J0X29ic2lkaWFuIiwgImNvbHVtbnMiLCAiaW1wb3J0X29ic2lkaWFuIiwgImltcG9ydF9vYnNpZGlhbiIsICJpbXBvcnRfb2JzaWRpYW4iLCAiaW1wb3J0X29ic2lkaWFuIiwgImltcG9ydF9vYnNpZGlhbiIsICJpbXBvcnRfb2JzaWRpYW4iLCAiX2EiLCAiX2IiLCAiX2EiLCAiX2IiXQp9Cg==
