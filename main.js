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
      const chip = td.createSpan({ text: rawValue.trim() || "\u2014", cls: "zibase-label" });
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
        void import_obsidian.MarkdownRenderer.render(host.app, val, displaySpan, context.sourcePath, new import_obsidian.Component()).then(() => {
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
        void import_obsidian3.MarkdownRenderer.render(host.app, entry.title || "\u2014", pill, context.sourcePath, new import_obsidian3.Component());
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
    void import_obsidian4.MarkdownRenderer.render(host.app, titleValue || "\u2014", titleDiv, context.sourcePath, new import_obsidian4.Component());
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
            void import_obsidian5.MarkdownRenderer.render(host.app, rawValue, titleEl, context.sourcePath, new import_obsidian5.Component());
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
        void import_obsidian5.MarkdownRenderer.render(host.app, cells[0] || "\u2014", titleEl, context.sourcePath, new import_obsidian5.Component());
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
      await import_obsidian7.MarkdownRenderer.render(this.app, newRaw, displaySpan, context.sourcePath, new import_obsidian7.Component());
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
var PLUGIN_VERSION = "1.2.3";

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
    new import_obsidian8.Setting(containerEl).setName("Reset to defaults").setDesc("Restore the original column name rules.").addButton((btn) => {
      btn.setButtonText("Reset").onClick(() => {
        void (async () => {
          this.plugin.settings.columnRules = [...DEFAULT_COLUMN_RULES];
          await this.plugin.saveSettings();
          this.renderRules(rulesContainer);
        })();
      });
      btn.buttonEl.addClass("mod-warning");
    });
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
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsic3JjL21haW4udHMiLCAic3JjL3NjaGVtYS50cyIsICJzcmMvcmVuZGVyZXIudHMiLCAic3JjL2NlbGxzLnRzIiwgInNyYy9mb3JtdWxhLnRzIiwgInNyYy9jb2xvcnMudHMiLCAic3JjL3VpLnRzIiwgInNyYy9tb2RhbHMudHMiLCAic3JjL21vZGVsLnRzIiwgInNyYy92aWV3cy9jYWxlbmRhci50cyIsICJzcmMvdmlld3MvZ2FsbGVyeS50cyIsICJzcmMvdmlld3Mva2FuYmFuLnRzIiwgInNyYy92aWV3cy90YWJsZS50cyIsICJzcmMvdmVyc2lvbi50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiaW1wb3J0IHsgUGx1Z2luLCBQbHVnaW5TZXR0aW5nVGFiLCBTZXR0aW5nLCB0eXBlIEFwcCwgdHlwZSBFZGl0b3IgfSBmcm9tIFwib2JzaWRpYW5cIjtcbmltcG9ydCB7IERFRkFVTFRfQ09MVU1OX1JVTEVTIH0gZnJvbSBcIi4vc2NoZW1hXCI7XG5pbXBvcnQgeyBaaUJhc2VUYWJsZVJlbmRlcmVyIH0gZnJvbSBcIi4vcmVuZGVyZXJcIjtcbmltcG9ydCB7IENPTFVNTl9UWVBFX09QVElPTlMsIHR5cGUgQ29sdW1uUnVsZSwgdHlwZSBaaUJhc2VTZXR0aW5ncyB9IGZyb20gXCIuL21vZGVsXCI7XG5pbXBvcnQgeyBQTFVHSU5fVkVSU0lPTiB9IGZyb20gXCIuL3ZlcnNpb25cIjtcblxuY29uc3QgREVGQVVMVF9TRVRUSU5HUzogWmlCYXNlU2V0dGluZ3MgPSB7XG4gIHJlbmRlckluUmVhZGluZ1ZpZXc6IHRydWUsXG4gIGluZmVyU2NoZW1hOiB0cnVlLFxuICBjb2x1bW5SdWxlczogWy4uLkRFRkFVTFRfQ09MVU1OX1JVTEVTXSxcbn07XG5cbmV4cG9ydCBkZWZhdWx0IGNsYXNzIFppQmFzZVBsdWdpbiBleHRlbmRzIFBsdWdpbiB7XG4gIHNldHRpbmdzOiBaaUJhc2VTZXR0aW5ncyA9IERFRkFVTFRfU0VUVElOR1M7XG4gIHJlbmRlcmVyITogWmlCYXNlVGFibGVSZW5kZXJlcjtcblxuICBhc3luYyBvbmxvYWQoKTogUHJvbWlzZTx2b2lkPiB7XG4gICAgYXdhaXQgdGhpcy5sb2FkU2V0dGluZ3MoKTtcbiAgICB0aGlzLnJlbmRlcmVyID0gbmV3IFppQmFzZVRhYmxlUmVuZGVyZXIodGhpcy5hcHAsIHRoaXMpO1xuICAgIGlmICh0aGlzLnNldHRpbmdzLnJlbmRlckluUmVhZGluZ1ZpZXcpIHtcbiAgICAgIHRoaXMucmVnaXN0ZXJNYXJrZG93blBvc3RQcm9jZXNzb3IoKGVsZW1lbnQsIGNvbnRleHQpID0+IHtcbiAgICAgICAgdGhpcy5yZW5kZXJlci5wcm9jZXNzUmVhZGluZ1ZpZXcoZWxlbWVudCwgY29udGV4dCk7XG4gICAgICB9KTtcbiAgICB9XG4gICAgdGhpcy5hZGRDb21tYW5kKHtcbiAgICAgIGlkOiBcImluc2VydC10YWJsZVwiLFxuICAgICAgbmFtZTogXCJJbnNlcnQgYW5ub3RhdGVkIHRhYmxlXCIsXG4gICAgICBlZGl0b3JDYWxsYmFjazogKGVkaXRvcjogRWRpdG9yKSA9PiB7XG4gICAgICAgIGNvbnN0IHRlbXBsYXRlID0gW1xuICAgICAgICAgIFwifCBOYW1lIHwgU3RhdHVzIHwgUHJpb3JpdHkgfCBUYWdzIHxcIixcbiAgICAgICAgICBcInwtLS0tLS18LS0tLS0tLS18LS0tLS0tLS0tLXwtLS0tLS18XCIsXG4gICAgICAgICAgXCJ8IDwhLS0gemliYXNlOiB0ZXh0IC0tPiB8IDwhLS0gemliYXNlOiB0b2dnbGUgLS0+IHwgPCEtLSB6aWJhc2U6IHNlbGVjdDpMb3csTWVkaXVtLEhpZ2ggLS0+IHwgPCEtLSB6aWJhc2U6IGxhYmVsIC0tPiB8XCIsXG4gICAgICAgICAgXCJ8IEl0ZW0gMSB8IHRydWUgfCBIaWdoIHwgYmlvbG9neSB8XCIsXG4gICAgICAgICAgXCJ8IEl0ZW0gMiB8IGZhbHNlIHwgTG93IHwgY2hlbWlzdHJ5IHxcIixcbiAgICAgICAgXS5qb2luKFwiXFxuXCIpO1xuICAgICAgICBlZGl0b3IucmVwbGFjZVNlbGVjdGlvbih0ZW1wbGF0ZSk7XG4gICAgICB9LFxuICAgIH0pO1xuICAgIHRoaXMuYWRkQ29tbWFuZCh7XG4gICAgICBpZDogXCJpbnNlcnQtcGxhaW4tdGFibGVcIixcbiAgICAgIG5hbWU6IFwiSW5zZXJ0IHBsYWluIHRhYmxlIChhdXRvLWluZmVycmVkKVwiLFxuICAgICAgZWRpdG9yQ2FsbGJhY2s6IChlZGl0b3I6IEVkaXRvcikgPT4ge1xuICAgICAgICBjb25zdCB0ZW1wbGF0ZSA9IFtcbiAgICAgICAgICBcInwgTmFtZSB8IERvbmUgfCBTY29yZSB8IENhdGVnb3J5IHxcIixcbiAgICAgICAgICBcInwtLS0tLS18LS0tLS0tfC0tLS0tLS18LS0tLS0tLS0tLXxcIixcbiAgICAgICAgICBcInwgVGFzayBBIHwgdHJ1ZSB8IDkwIHwgV29yayB8XCIsXG4gICAgICAgICAgXCJ8IFRhc2sgQiB8IGZhbHNlIHwgNzUgfCBXb3JrIHxcIixcbiAgICAgICAgICBcInwgVGFzayBDIHwgdHJ1ZSB8IDgyIHwgUGVyc29uYWwgfFwiLFxuICAgICAgICBdLmpvaW4oXCJcXG5cIik7XG4gICAgICAgIGVkaXRvci5yZXBsYWNlU2VsZWN0aW9uKHRlbXBsYXRlKTtcbiAgICAgIH0sXG4gICAgfSk7XG4gICAgdGhpcy5hZGRDb21tYW5kKHtcbiAgICAgIGlkOiBcImluc2VydC1mb3JtdWxhLXRhYmxlXCIsXG4gICAgICBuYW1lOiBcIkluc2VydCB0YWJsZSB3aXRoIGZvcm11bGEgY29sdW1uXCIsXG4gICAgICBlZGl0b3JDYWxsYmFjazogKGVkaXRvcjogRWRpdG9yKSA9PiB7XG4gICAgICAgIGNvbnN0IHRlbXBsYXRlID0gW1xuICAgICAgICAgIFwifCBJdGVtIHwgUHJpY2UgfCBRdHkgfCBUb3RhbCB8XCIsXG4gICAgICAgICAgXCJ8LS0tLS0tfC0tLS0tLS18LS0tLS18LS0tLS0tLXxcIixcbiAgICAgICAgICBcInwgPCEtLSB6aWJhc2U6IHRleHQgLS0+IHwgPCEtLSB6aWJhc2U6IG51bWJlciAtLT4gfCA8IS0tIHppYmFzZTogbnVtYmVyIC0tPiB8IDwhLS0gemliYXNlOiBmb3JtdWxhOlByaWNlICogUXR5IC0tPiB8XCIsXG4gICAgICAgICAgXCJ8IFBlbiB8IDEwIHwgNSB8ICB8XCIsXG4gICAgICAgICAgXCJ8IEJvb2sgfCAyNTAgfCAyIHwgIHxcIixcbiAgICAgICAgICBcInwgRXJhc2VyIHwgNSB8IDEwIHwgIHxcIixcbiAgICAgICAgXS5qb2luKFwiXFxuXCIpO1xuICAgICAgICBlZGl0b3IucmVwbGFjZVNlbGVjdGlvbih0ZW1wbGF0ZSk7XG4gICAgICB9LFxuICAgIH0pO1xuICAgIHRoaXMuYWRkU2V0dGluZ1RhYihuZXcgWmlCYXNlU2V0dGluZ1RhYih0aGlzLmFwcCwgdGhpcykpO1xuICB9XG5cbiAgYXN5bmMgbG9hZFNldHRpbmdzKCk6IFByb21pc2U8dm9pZD4ge1xuICAgIHRoaXMuc2V0dGluZ3MgPSBPYmplY3QuYXNzaWduKHt9LCBERUZBVUxUX1NFVFRJTkdTLCBhd2FpdCB0aGlzLmxvYWREYXRhKCkpIGFzIFppQmFzZVNldHRpbmdzO1xuICAgIGlmICghdGhpcy5zZXR0aW5ncy5jb2x1bW5SdWxlcyB8fCB0aGlzLnNldHRpbmdzLmNvbHVtblJ1bGVzLmxlbmd0aCA9PT0gMCkge1xuICAgICAgdGhpcy5zZXR0aW5ncy5jb2x1bW5SdWxlcyA9IFsuLi5ERUZBVUxUX0NPTFVNTl9SVUxFU107XG4gICAgfVxuICB9XG5cbiAgYXN5bmMgc2F2ZVNldHRpbmdzKCk6IFByb21pc2U8dm9pZD4ge1xuICAgIGF3YWl0IHRoaXMuc2F2ZURhdGEodGhpcy5zZXR0aW5ncyk7XG4gIH1cbn1cblxuY2xhc3MgWmlCYXNlU2V0dGluZ1RhYiBleHRlbmRzIFBsdWdpblNldHRpbmdUYWIge1xuICBwbHVnaW46IFppQmFzZVBsdWdpbjtcblxuICBjb25zdHJ1Y3RvcihhcHA6IEFwcCwgcGx1Z2luOiBaaUJhc2VQbHVnaW4pIHtcbiAgICBzdXBlcihhcHAsIHBsdWdpbik7XG4gICAgdGhpcy5wbHVnaW4gPSBwbHVnaW47XG4gIH1cblxuICBkaXNwbGF5KCk6IHZvaWQge1xuICAgIGNvbnN0IHsgY29udGFpbmVyRWwgfSA9IHRoaXM7XG4gICAgY29udGFpbmVyRWwuZW1wdHkoKTtcbiAgICBuZXcgU2V0dGluZyhjb250YWluZXJFbClcbiAgICAgIC5zZXROYW1lKFwiUmVuZGVyIGluIFJlYWRpbmcgVmlld1wiKVxuICAgICAgLnNldERlc2MoXCJTaG93IHJpY2ggVUkgd2hlbiB2aWV3aW5nIG5vdGVzIGluIHJlYWRpbmcgbW9kZS5cIilcbiAgICAgIC5hZGRUb2dnbGUoKHQpID0+XG4gICAgICAgIHQuc2V0VmFsdWUodGhpcy5wbHVnaW4uc2V0dGluZ3MucmVuZGVySW5SZWFkaW5nVmlldykub25DaGFuZ2UoKHYpID0+IHtcbiAgICAgICAgICB2b2lkIChhc3luYyAoKSA9PiB7XG4gICAgICAgICAgICB0aGlzLnBsdWdpbi5zZXR0aW5ncy5yZW5kZXJJblJlYWRpbmdWaWV3ID0gdjtcbiAgICAgICAgICAgIGF3YWl0IHRoaXMucGx1Z2luLnNhdmVTZXR0aW5ncygpO1xuICAgICAgICAgIH0pKCk7XG4gICAgICAgIH0pLFxuICAgICAgKTtcbiAgICBuZXcgU2V0dGluZyhjb250YWluZXJFbClcbiAgICAgIC5zZXROYW1lKFwiQXV0by1pbmZlciBzY2hlbWFcIilcbiAgICAgIC5zZXREZXNjKFwiQXV0b21hdGljYWxseSBkZXRlY3QgY29sdW1uIHR5cGVzIGZyb20gcGxhaW4gbWFya2Rvd24gdGFibGVzLiBUdXJuIG9mZiB0byBvbmx5IGVuaGFuY2UgYW5ub3RhdGVkIHRhYmxlcy5cIilcbiAgICAgIC5hZGRUb2dnbGUoKHQpID0+XG4gICAgICAgIHQuc2V0VmFsdWUodGhpcy5wbHVnaW4uc2V0dGluZ3MuaW5mZXJTY2hlbWEpLm9uQ2hhbmdlKCh2KSA9PiB7XG4gICAgICAgICAgdm9pZCAoYXN5bmMgKCkgPT4ge1xuICAgICAgICAgICAgdGhpcy5wbHVnaW4uc2V0dGluZ3MuaW5mZXJTY2hlbWEgPSB2O1xuICAgICAgICAgICAgYXdhaXQgdGhpcy5wbHVnaW4uc2F2ZVNldHRpbmdzKCk7XG4gICAgICAgICAgfSkoKTtcbiAgICAgICAgfSksXG4gICAgICApO1xuICAgIG5ldyBTZXR0aW5nKGNvbnRhaW5lckVsKS5zZXROYW1lKFwiQ29sdW1uIG5hbWUgcnVsZXNcIikuc2V0SGVhZGluZygpO1xuICAgIGNvbnRhaW5lckVsLmNyZWF0ZUVsKFwicFwiLCB7XG4gICAgICB0ZXh0OiBcIldoZW4gYSBjb2x1bW4gbmFtZSBtYXRjaGVzLCBhdXRvLWFzc2lnbiB0aGF0IHR5cGUuIEFwcGxpZWQgdG8gYWxsIGluZmVycmVkIHRhYmxlcy5cIixcbiAgICAgIGNsczogXCJ6aWJhc2Utc2V0dGluZ3MtZGVzY1wiLFxuICAgIH0pO1xuICAgIGNvbnN0IHJ1bGVzQ29udGFpbmVyID0gY29udGFpbmVyRWwuY3JlYXRlRGl2KFwiemliYXNlLXJ1bGVzLWNvbnRhaW5lclwiKTtcbiAgICB0aGlzLnJlbmRlclJ1bGVzKHJ1bGVzQ29udGFpbmVyKTtcbiAgICBuZXcgU2V0dGluZyhjb250YWluZXJFbCkuYWRkQnV0dG9uKChidG4pID0+XG4gICAgICBidG4uc2V0QnV0dG9uVGV4dChcIisgQWRkIHJ1bGVcIikuc2V0Q3RhKCkub25DbGljaygoKSA9PiB7XG4gICAgICAgIHZvaWQgKGFzeW5jICgpID0+IHtcbiAgICAgICAgICB0aGlzLnBsdWdpbi5zZXR0aW5ncy5jb2x1bW5SdWxlcy5wdXNoKHsgbmFtZTogXCJcIiwgdHlwZTogXCJsYWJlbFwiIH0pO1xuICAgICAgICAgIGF3YWl0IHRoaXMucGx1Z2luLnNhdmVTZXR0aW5ncygpO1xuICAgICAgICAgIHRoaXMucmVuZGVyUnVsZXMocnVsZXNDb250YWluZXIpO1xuICAgICAgICB9KSgpO1xuICAgICAgfSksXG4gICAgKTtcbiAgICBuZXcgU2V0dGluZyhjb250YWluZXJFbClcbiAgICAgIC5zZXROYW1lKFwiUmVzZXQgdG8gZGVmYXVsdHNcIilcbiAgICAgIC5zZXREZXNjKFwiUmVzdG9yZSB0aGUgb3JpZ2luYWwgY29sdW1uIG5hbWUgcnVsZXMuXCIpXG4gICAgICAuYWRkQnV0dG9uKChidG4pID0+IHtcbiAgICAgICAgYnRuLnNldEJ1dHRvblRleHQoXCJSZXNldFwiKS5vbkNsaWNrKCgpID0+IHtcbiAgICAgICAgICB2b2lkIChhc3luYyAoKSA9PiB7XG4gICAgICAgICAgICB0aGlzLnBsdWdpbi5zZXR0aW5ncy5jb2x1bW5SdWxlcyA9IFsuLi5ERUZBVUxUX0NPTFVNTl9SVUxFU107XG4gICAgICAgICAgICBhd2FpdCB0aGlzLnBsdWdpbi5zYXZlU2V0dGluZ3MoKTtcbiAgICAgICAgICAgIHRoaXMucmVuZGVyUnVsZXMocnVsZXNDb250YWluZXIpO1xuICAgICAgICAgIH0pKCk7XG4gICAgICAgIH0pO1xuICAgICAgICBidG4uYnV0dG9uRWwuYWRkQ2xhc3MoXCJtb2Qtd2FybmluZ1wiKTtcbiAgICAgIH0pO1xuICAgIG5ldyBTZXR0aW5nKGNvbnRhaW5lckVsKS5zZXROYW1lKFwiQWJvdXRcIikuc2V0SGVhZGluZygpO1xuICAgIGNvbnRhaW5lckVsLmNyZWF0ZUVsKFwicFwiLCB7IHRleHQ6IGBaaUJhc2UgdiR7UExVR0lOX1ZFUlNJT059IFx1MjAxNCBCdWlsdCBieSBSb2hpdGggQSAoWklZQUwpYCwgY2xzOiBcInppYmFzZS1zZXR0aW5ncy1kZXNjXCIgfSk7XG4gICAgY29udGFpbmVyRWwuY3JlYXRlRWwoXCJwXCIsIHsgdGV4dDogXCJNYXJrZG93bi1uYXRpdmUgZGF0YWJhc2UgcGx1Z2luLlwiLCBjbHM6IFwiemliYXNlLXNldHRpbmdzLWRlc2NcIiB9KTtcbiAgfVxuXG4gIHJlbmRlclJ1bGVzKGNvbnRhaW5lcjogSFRNTEVsZW1lbnQpOiB2b2lkIHtcbiAgICBjb250YWluZXIuZW1wdHkoKTtcbiAgICB0aGlzLnBsdWdpbi5zZXR0aW5ncy5jb2x1bW5SdWxlcy5mb3JFYWNoKChydWxlOiBDb2x1bW5SdWxlLCBpZHg6IG51bWJlcikgPT4ge1xuICAgICAgY29uc3Qgcm93ID0gY29udGFpbmVyLmNyZWF0ZURpdihcInppYmFzZS1ydWxlLXJvd1wiKTtcbiAgICAgIGNvbnN0IG5hbWVJbnB1dCA9IHJvdy5jcmVhdGVFbChcImlucHV0XCIsIHsgdHlwZTogXCJ0ZXh0XCIsIGNsczogXCJ6aWJhc2UtcnVsZS1uYW1lXCIsIHZhbHVlOiBydWxlLm5hbWUgfSk7XG4gICAgICBuYW1lSW5wdXQucGxhY2Vob2xkZXIgPSBcImNvbHVtbiBuYW1lXCI7XG4gICAgICBuYW1lSW5wdXQuYWRkRXZlbnRMaXN0ZW5lcihcImNoYW5nZVwiLCAoKSA9PiB7XG4gICAgICAgIHZvaWQgKGFzeW5jICgpID0+IHtcbiAgICAgICAgICB0aGlzLnBsdWdpbi5zZXR0aW5ncy5jb2x1bW5SdWxlc1tpZHhdLm5hbWUgPSBuYW1lSW5wdXQudmFsdWUudHJpbSgpO1xuICAgICAgICAgIGF3YWl0IHRoaXMucGx1Z2luLnNhdmVTZXR0aW5ncygpO1xuICAgICAgICB9KSgpO1xuICAgICAgfSk7XG4gICAgICByb3cuY3JlYXRlU3Bhbih7IHRleHQ6IFwiXHUyMTkyXCIsIGNsczogXCJ6aWJhc2UtcnVsZS1hcnJvd1wiIH0pO1xuICAgICAgY29uc3QgdHlwZVNlbGVjdCA9IHJvdy5jcmVhdGVFbChcInNlbGVjdFwiLCB7IGNsczogXCJ6aWJhc2UtcnVsZS10eXBlXCIgfSk7XG4gICAgICBDT0xVTU5fVFlQRV9PUFRJT05TLmZvckVhY2goKHQpID0+IHtcbiAgICAgICAgY29uc3Qgb3B0ID0gdHlwZVNlbGVjdC5jcmVhdGVFbChcIm9wdGlvblwiLCB7IHRleHQ6IHQsIHZhbHVlOiB0IH0pO1xuICAgICAgICBpZiAodCA9PT0gcnVsZS50eXBlKSBvcHQuc2VsZWN0ZWQgPSB0cnVlO1xuICAgICAgfSk7XG4gICAgICB0eXBlU2VsZWN0LmFkZEV2ZW50TGlzdGVuZXIoXCJjaGFuZ2VcIiwgKCkgPT4ge1xuICAgICAgICB2b2lkIChhc3luYyAoKSA9PiB7XG4gICAgICAgICAgdGhpcy5wbHVnaW4uc2V0dGluZ3MuY29sdW1uUnVsZXNbaWR4XS50eXBlID0gdHlwZVNlbGVjdC52YWx1ZTtcbiAgICAgICAgICBhd2FpdCB0aGlzLnBsdWdpbi5zYXZlU2V0dGluZ3MoKTtcbiAgICAgICAgfSkoKTtcbiAgICAgIH0pO1xuICAgICAgY29uc3QgcmVtb3ZlQnRuID0gcm93LmNyZWF0ZUVsKFwiYnV0dG9uXCIsIHsgdGV4dDogXCJcdTAwRDdcIiwgY2xzOiBcInppYmFzZS1ydWxlLXJlbW92ZVwiIH0pO1xuICAgICAgcmVtb3ZlQnRuLmFkZEV2ZW50TGlzdGVuZXIoXCJjbGlja1wiLCAoKSA9PiB7XG4gICAgICAgIHZvaWQgKGFzeW5jICgpID0+IHtcbiAgICAgICAgICB0aGlzLnBsdWdpbi5zZXR0aW5ncy5jb2x1bW5SdWxlcy5zcGxpY2UoaWR4LCAxKTtcbiAgICAgICAgICBhd2FpdCB0aGlzLnBsdWdpbi5zYXZlU2V0dGluZ3MoKTtcbiAgICAgICAgICB0aGlzLnJlbmRlclJ1bGVzKGNvbnRhaW5lcik7XG4gICAgICAgIH0pKCk7XG4gICAgICB9KTtcbiAgICB9KTtcbiAgfVxufVxuIiwgImltcG9ydCB0eXBlIHsgQ29sdW1uUnVsZSwgQ29sdW1uVHlwZSwgVGFibGVTY2hlbWEsIFZpZXdOYW1lIH0gZnJvbSBcIi4vbW9kZWxcIjtcblxuZXhwb3J0IGNvbnN0IEFOTk9UQVRJT05fUkUgPSAvPCEtLVxccyp6aWJhc2U6XFxzKihbXlxccz5dKyg/OlxccypbXlxccz5dKykqKVxccyotLT4vaTtcbmV4cG9ydCBjb25zdCBWSUVXX0FOTk9UQVRJT05fUkUgPSAvPCEtLVxccyp6aWJhc2UtdmlldzpcXHMqKFxcdyspKD86OihbXj5dKykpP1xccyotLT4vaTtcbmV4cG9ydCBjb25zdCBEQVRFX1JFID0gL15cXGR7NH0tXFxkezJ9LVxcZHsyfSQvO1xuZXhwb3J0IGNvbnN0IE5VTUJFUl9SRSA9IC9eLT9cXGQrKFxcLlxcZCspPyQvO1xuXG5leHBvcnQgY29uc3QgREVGQVVMVF9DT0xVTU5fUlVMRVM6IENvbHVtblJ1bGVbXSA9IFtcbiAgeyBuYW1lOiBcImRvbWFpblwiLCB0eXBlOiBcImxhYmVsXCIgfSxcbiAgeyBuYW1lOiBcImNhdGVnb3J5XCIsIHR5cGU6IFwibGFiZWxcIiB9LFxuICB7IG5hbWU6IFwidGFnXCIsIHR5cGU6IFwibGFiZWxcIiB9LFxuICB7IG5hbWU6IFwidGFnc1wiLCB0eXBlOiBcIm11bHRpLXNlbGVjdFwiIH0sXG4gIHsgbmFtZTogXCJ0eXBlXCIsIHR5cGU6IFwibGFiZWxcIiB9LFxuICB7IG5hbWU6IFwibGFiZWxcIiwgdHlwZTogXCJsYWJlbFwiIH0sXG4gIHsgbmFtZTogXCJsYWJlbHNcIiwgdHlwZTogXCJtdWx0aS1zZWxlY3RcIiB9LFxuICB7IG5hbWU6IFwiZG9uZVwiLCB0eXBlOiBcInRvZ2dsZVwiIH0sXG4gIHsgbmFtZTogXCJjb21wbGV0ZWRcIiwgdHlwZTogXCJ0b2dnbGVcIiB9LFxuICB7IG5hbWU6IFwic3RhdHVzXCIsIHR5cGU6IFwic2VsZWN0XCIgfSxcbl07XG5cbmV4cG9ydCBmdW5jdGlvbiBwYXJzZVppQmFzZVNjaGVtYShcbiAgbGluZXM6IHN0cmluZ1tdLFxuICBjb2x1bW5SdWxlczogQ29sdW1uUnVsZVtdID0gREVGQVVMVF9DT0xVTU5fUlVMRVMsXG4pOiBUYWJsZVNjaGVtYSB8IG51bGwge1xuICBpZiAobGluZXMubGVuZ3RoIDwgMikgcmV0dXJuIG51bGw7XG5cbiAgY29uc3QgaGVhZGVyQ2VsbHMgPSBzcGxpdFJvdyhsaW5lc1swXSk7XG4gIGlmIChoZWFkZXJDZWxscy5sZW5ndGggPT09IDApIHJldHVybiBudWxsO1xuXG4gIGlmIChsaW5lcy5sZW5ndGggPj0gMykge1xuICAgIGNvbnN0IHNjaGVtYUNlbGxzID0gc3BsaXRSb3cobGluZXNbMl0pO1xuICAgIGNvbnN0IGhhc0Fubm90YXRpb25zID0gc2NoZW1hQ2VsbHMuc29tZSgoYykgPT4gQU5OT1RBVElPTl9SRS50ZXN0KGMpKTtcbiAgICBpZiAoaGFzQW5ub3RhdGlvbnMpIHtcbiAgICAgIGNvbnN0IGNvbHVtbnMgPSBoZWFkZXJDZWxscy5tYXAoKG5hbWUsIGkpID0+IHtcbiAgICAgICAgY29uc3QgY2VsbCA9IHNjaGVtYUNlbGxzW2ldID8/IFwiXCI7XG4gICAgICAgIGNvbnN0IG1hdGNoID0gY2VsbC5tYXRjaChBTk5PVEFUSU9OX1JFKTtcbiAgICAgICAgY29uc3QgdHlwZVN0ciA9IG1hdGNoID8gbWF0Y2hbMV0gOiBcInRleHRcIjtcbiAgICAgICAgcmV0dXJuIHsgbmFtZTogbmFtZS50cmltKCksIHR5cGU6IHBhcnNlVHlwZSh0eXBlU3RyKSwgaW5kZXg6IGkgfTtcbiAgICAgIH0pO1xuICAgICAgcmV0dXJuIHsgY29sdW1ucywgc2NoZW1hUm93SW5kZXg6IDIsIGRhdGFTdGFydEluZGV4OiAzLCBpbmZlcnJlZDogZmFsc2UgfTtcbiAgICB9XG4gIH1cblxuICBpZiAobGluZXMubGVuZ3RoIDwgMykgcmV0dXJuIG51bGw7XG5cbiAgY29uc3QgZGF0YUxpbmVzID0gbGluZXMuc2xpY2UoMikuZmlsdGVyKChsKSA9PiBsLnRyaW0oKSAmJiBsLmluY2x1ZGVzKFwifFwiKSk7XG4gIGlmIChkYXRhTGluZXMubGVuZ3RoID09PSAwKSByZXR1cm4gbnVsbDtcblxuICBjb25zdCBjb2xWYWx1ZXM6IHN0cmluZ1tdW10gPSBoZWFkZXJDZWxscy5tYXAoKCkgPT4gW10pO1xuICBkYXRhTGluZXMuZm9yRWFjaCgobGluZSkgPT4ge1xuICAgIGNvbnN0IGNlbGxzID0gc3BsaXRSb3cobGluZSk7XG4gICAgaGVhZGVyQ2VsbHMuZm9yRWFjaCgoXywgaSkgPT4ge1xuICAgICAgY29uc3QgdiA9IChjZWxsc1tpXSA/PyBcIlwiKS50cmltKCk7XG4gICAgICBpZiAodikgY29sVmFsdWVzW2ldLnB1c2godik7XG4gICAgfSk7XG4gIH0pO1xuXG4gIGNvbnN0IGNvbHVtbnMgPSBoZWFkZXJDZWxscy5tYXAoKG5hbWUsIGkpID0+ICh7XG4gICAgbmFtZTogbmFtZS50cmltKCksXG4gICAgdHlwZTogaW5mZXJUeXBlKG5hbWUudHJpbSgpLCBjb2xWYWx1ZXNbaV0sIGNvbHVtblJ1bGVzKSxcbiAgICBpbmRleDogaSxcbiAgfSkpO1xuICByZXR1cm4geyBjb2x1bW5zLCBzY2hlbWFSb3dJbmRleDogbnVsbCwgZGF0YVN0YXJ0SW5kZXg6IDIsIGluZmVycmVkOiB0cnVlIH07XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBwYXJzZVZpZXdBbm5vdGF0aW9uKFxuICBsaW5lczogc3RyaW5nW10sXG4pOiB7IHZpZXc6IFZpZXdOYW1lOyBncm91cEJ5OiBzdHJpbmcgfCBudWxsIH0gfCBudWxsIHtcbiAgZm9yIChsZXQgaSA9IDA7IGkgPCBNYXRoLm1pbihsaW5lcy5sZW5ndGgsIDMpOyBpKyspIHtcbiAgICBjb25zdCBtYXRjaCA9IGxpbmVzW2ldLm1hdGNoKFZJRVdfQU5OT1RBVElPTl9SRSk7XG4gICAgaWYgKG1hdGNoKSB7XG4gICAgICByZXR1cm4geyB2aWV3OiBtYXRjaFsxXS50b0xvd2VyQ2FzZSgpIGFzIFZpZXdOYW1lLCBncm91cEJ5OiBtYXRjaFsyXSA/IG1hdGNoWzJdLnRyaW0oKSA6IG51bGwgfTtcbiAgICB9XG4gIH1cbiAgcmV0dXJuIG51bGw7XG59XG5cbmZ1bmN0aW9uIGluZmVyVHlwZShjb2xOYW1lOiBzdHJpbmcsIHZhbHVlczogc3RyaW5nW10sIGNvbHVtblJ1bGVzOiBDb2x1bW5SdWxlW10pOiBDb2x1bW5UeXBlIHtcbiAgaWYgKHZhbHVlcy5sZW5ndGggPT09IDApIHJldHVybiB7IGtpbmQ6IFwidGV4dFwiIH07XG4gIGlmICh2YWx1ZXMuZXZlcnkoKHYpID0+IHYudG9Mb3dlckNhc2UoKSA9PT0gXCJ0cnVlXCIgfHwgdi50b0xvd2VyQ2FzZSgpID09PSBcImZhbHNlXCIpKSB7XG4gICAgcmV0dXJuIHsga2luZDogXCJ0b2dnbGVcIiB9O1xuICB9XG4gIGlmICh2YWx1ZXMuZXZlcnkoKHYpID0+IERBVEVfUkUudGVzdCh2KSkpIHJldHVybiB7IGtpbmQ6IFwiZGF0ZVwiIH07XG4gIGlmICh2YWx1ZXMuZXZlcnkoKHYpID0+IE5VTUJFUl9SRS50ZXN0KHYpKSkgcmV0dXJuIHsga2luZDogXCJudW1iZXJcIiB9O1xuXG4gIGNvbnN0IHJ1bGUgPSBjb2x1bW5SdWxlcy5maW5kKChyKSA9PiByLm5hbWUudG9Mb3dlckNhc2UoKSA9PT0gY29sTmFtZS50b0xvd2VyQ2FzZSgpKTtcbiAgaWYgKHJ1bGUpIHJldHVybiBwYXJzZVR5cGUocnVsZS50eXBlKTtcblxuICBjb25zdCB1bmlxdWUgPSBbLi4ubmV3IFNldCh2YWx1ZXMubWFwKCh2KSA9PiB2LnRvTG93ZXJDYXNlKCkpKV07XG4gIGNvbnN0IGFsbFNob3J0ID0gdmFsdWVzLmV2ZXJ5KCh2KSA9PiB2Lmxlbmd0aCA8PSAyMCk7XG4gIGNvbnN0IGlzUmVwZWF0ZWQgPVxuICAgIHZhbHVlcy5sZW5ndGggPj0gMiAmJlxuICAgIHVuaXF1ZS5sZW5ndGggPD0gTWF0aC5tYXgoMiwgTWF0aC5mbG9vcih2YWx1ZXMubGVuZ3RoICogMC43NSkpICYmXG4gICAgdW5pcXVlLmxlbmd0aCA8PSAxMDtcbiAgaWYgKGlzUmVwZWF0ZWQgJiYgYWxsU2hvcnQpIHtcbiAgICBjb25zdCBzZWVuID0gbmV3IE1hcDxzdHJpbmcsIHN0cmluZz4oKTtcbiAgICB2YWx1ZXMuZm9yRWFjaCgodikgPT4ge1xuICAgICAgaWYgKCFzZWVuLmhhcyh2LnRvTG93ZXJDYXNlKCkpKSBzZWVuLnNldCh2LnRvTG93ZXJDYXNlKCksIHYpO1xuICAgIH0pO1xuICAgIHJldHVybiB7IGtpbmQ6IFwic2VsZWN0XCIsIG9wdGlvbnM6IFsuLi5zZWVuLnZhbHVlcygpXSB9O1xuICB9XG4gIHJldHVybiB7IGtpbmQ6IFwidGV4dFwiIH07XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBwYXJzZVR5cGUodHlwZVN0cjogc3RyaW5nKTogQ29sdW1uVHlwZSB7XG4gIGlmICh0eXBlU3RyLnN0YXJ0c1dpdGgoXCJzZWxlY3Q6XCIpKSB7XG4gICAgY29uc3Qgb3B0aW9ucyA9IHR5cGVTdHIuc2xpY2UoNykuc3BsaXQoXCIsXCIpLm1hcCgocykgPT4gcy50cmltKCkpO1xuICAgIHJldHVybiB7IGtpbmQ6IFwic2VsZWN0XCIsIG9wdGlvbnMgfTtcbiAgfVxuICBpZiAodHlwZVN0ci5zdGFydHNXaXRoKFwiZm9ybXVsYTpcIikpIHtcbiAgICBjb25zdCBleHByZXNzaW9uID0gdHlwZVN0ci5zbGljZSg4KS50cmltKCk7XG4gICAgcmV0dXJuIHsga2luZDogXCJmb3JtdWxhXCIsIGV4cHJlc3Npb24gfTtcbiAgfVxuICBzd2l0Y2ggKHR5cGVTdHIudG9Mb3dlckNhc2UoKSkge1xuICAgIGNhc2UgXCJ0b2dnbGVcIjpcbiAgICAgIHJldHVybiB7IGtpbmQ6IFwidG9nZ2xlXCIgfTtcbiAgICBjYXNlIFwibGFiZWxcIjpcbiAgICAgIHJldHVybiB7IGtpbmQ6IFwibGFiZWxcIiB9O1xuICAgIGNhc2UgXCJtdWx0aS1zZWxlY3RcIjpcbiAgICBjYXNlIFwidGFnc1wiOlxuICAgICAgcmV0dXJuIHsga2luZDogXCJtdWx0aS1zZWxlY3RcIiB9O1xuICAgIGNhc2UgXCJudW1iZXJcIjpcbiAgICAgIHJldHVybiB7IGtpbmQ6IFwibnVtYmVyXCIgfTtcbiAgICBjYXNlIFwiZGF0ZVwiOlxuICAgICAgcmV0dXJuIHsga2luZDogXCJkYXRlXCIgfTtcbiAgICBjYXNlIFwic2VsZWN0XCI6XG4gICAgICByZXR1cm4geyBraW5kOiBcInNlbGVjdFwiLCBvcHRpb25zOiBbXSB9O1xuICAgIGNhc2UgXCJmb3JtdWxhXCI6XG4gICAgICByZXR1cm4geyBraW5kOiBcImZvcm11bGFcIiwgZXhwcmVzc2lvbjogXCJcIiB9O1xuICAgIGRlZmF1bHQ6XG4gICAgICByZXR1cm4geyBraW5kOiBcInRleHRcIiB9O1xuICB9XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBzcGxpdFJvdyhyb3c6IHN0cmluZyk6IHN0cmluZ1tdIHtcbiAgY29uc3Qgc3RyaXBwZWQgPSByb3cucmVwbGFjZSgvXlxcfHxcXHwkL2csIFwiXCIpO1xuICBjb25zdCBjZWxsczogc3RyaW5nW10gPSBbXTtcbiAgbGV0IGN1cnJlbnQgPSBcIlwiO1xuICBmb3IgKGxldCBpID0gMDsgaSA8IHN0cmlwcGVkLmxlbmd0aDsgaSsrKSB7XG4gICAgaWYgKHN0cmlwcGVkW2ldID09PSBcIlxcXFxcIiAmJiBzdHJpcHBlZFtpICsgMV0gPT09IFwifFwiKSB7XG4gICAgICBjdXJyZW50ICs9IFwifFwiO1xuICAgICAgaSsrO1xuICAgIH0gZWxzZSBpZiAoc3RyaXBwZWRbaV0gPT09IFwifFwiKSB7XG4gICAgICBjZWxscy5wdXNoKGN1cnJlbnQudHJpbSgpKTtcbiAgICAgIGN1cnJlbnQgPSBcIlwiO1xuICAgIH0gZWxzZSB7XG4gICAgICBjdXJyZW50ICs9IHN0cmlwcGVkW2ldO1xuICAgIH1cbiAgfVxuICBjZWxscy5wdXNoKGN1cnJlbnQudHJpbSgpKTtcbiAgcmV0dXJuIGNlbGxzO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gc2VyaWFsaXplUm93KGNlbGxzOiBzdHJpbmdbXSk6IHN0cmluZyB7XG4gIHJldHVybiBcInwgXCIgKyBjZWxscy5qb2luKFwiIHwgXCIpICsgXCIgfFwiO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gcGFyc2VCb29sKHZhbDogc3RyaW5nKTogYm9vbGVhbiB7XG4gIHJldHVybiB2YWwudHJpbSgpLnRvTG93ZXJDYXNlKCkgPT09IFwidHJ1ZVwiO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gc2VyaWFsaXplQm9vbCh2YWw6IGJvb2xlYW4pOiBzdHJpbmcge1xuICByZXR1cm4gdmFsID8gXCJ0cnVlXCIgOiBcImZhbHNlXCI7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBwYXJzZU11bHRpU2VsZWN0KHZhbDogc3RyaW5nKTogc3RyaW5nW10ge1xuICBpZiAoIXZhbCkgcmV0dXJuIFtdO1xuICByZXR1cm4gdmFsLnNwbGl0KFwiLFwiKS5tYXAoKHMpID0+IHMudHJpbSgpKS5maWx0ZXIoKHMpID0+IHMubGVuZ3RoID4gMCk7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBpc0RhdGFSb3cobGluZTogc3RyaW5nKTogYm9vbGVhbiB7XG4gIHJldHVybiBCb29sZWFuKGxpbmUudHJpbSgpICYmIGxpbmUuaW5jbHVkZXMoXCJ8XCIpICYmICEvPCEtLVxccyp6aWJhc2U6Ly50ZXN0KGxpbmUpICYmICEvPCEtLVxccyp6aWJhc2UtdmlldzovLnRlc3QobGluZSkpO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gZmlsdGVyRGF0YVJvd3Mocm93czogc3RyaW5nW10sIHF1ZXJ5OiBzdHJpbmcpOiBzdHJpbmdbXSB7XG4gIGlmICghcXVlcnkpIHJldHVybiByb3dzO1xuICBjb25zdCBxID0gcXVlcnkudG9Mb3dlckNhc2UoKTtcbiAgcmV0dXJuIHJvd3MuZmlsdGVyKChsaW5lKSA9PiBzcGxpdFJvdyhsaW5lKS5zb21lKChjZWxsKSA9PiBjZWxsLnRvTG93ZXJDYXNlKCkuaW5jbHVkZXMocSkpKTtcbn1cbiIsICJpbXBvcnQge1xuICBDb21wb25lbnQsXG4gIE1hcmtkb3duUmVuZGVyZXIsXG4gIHNldEljb24sXG4gIFRGaWxlLFxuICB0eXBlIEFwcCxcbiAgdHlwZSBNYXJrZG93blBvc3RQcm9jZXNzb3JDb250ZXh0LFxuICB0eXBlIE1hcmtkb3duU2VjdGlvbkluZm9ybWF0aW9uLFxufSBmcm9tIFwib2JzaWRpYW5cIjtcbmltcG9ydCB7IHJlbmRlckNlbGwgfSBmcm9tIFwiLi9jZWxsc1wiO1xuaW1wb3J0IHsgRm9ybXVsYUlucHV0TW9kYWwsIFNlbGVjdE9wdGlvbnNNb2RhbCB9IGZyb20gXCIuL21vZGFsc1wiO1xuaW1wb3J0IHtcbiAgaXNEYXRhUm93LFxuICBwYXJzZVppQmFzZVNjaGVtYSxcbiAgcGFyc2VWaWV3QW5ub3RhdGlvbixcbiAgc2VyaWFsaXplUm93LFxuICBzcGxpdFJvdyxcbiAgcGFyc2VCb29sLFxuICBWSUVXX0FOTk9UQVRJT05fUkUsXG59IGZyb20gXCIuL3NjaGVtYVwiO1xuaW1wb3J0IHR5cGUge1xuICBDZWxsQ2hhbmdlSGFuZGxlcixcbiAgQ29sdW1uLFxuICBUYWJsZVNjaGVtYSxcbiAgVmlld05hbWUsXG4gIFppQmFzZUhvc3QsXG4gIFppQmFzZVBsdWdpbkxpa2UsXG59IGZyb20gXCIuL3R5cGVzXCI7XG5pbXBvcnQgeyBDT0xVTU5fVFlQRV9PUFRJT05TIH0gZnJvbSBcIi4vdHlwZXNcIjtcbmltcG9ydCB7IGF0dGFjaExpbmtUb29sdGlwLCBzaG93VG9hc3QgfSBmcm9tIFwiLi91aVwiO1xuaW1wb3J0IHsgYnVpbGRDYWxlbmRhclZpZXcgfSBmcm9tIFwiLi92aWV3cy9jYWxlbmRhclwiO1xuaW1wb3J0IHsgYnVpbGRHYWxsZXJ5VmlldyB9IGZyb20gXCIuL3ZpZXdzL2dhbGxlcnlcIjtcbmltcG9ydCB7IGJ1aWxkS2FuYmFuVmlldyB9IGZyb20gXCIuL3ZpZXdzL2thbmJhblwiO1xuaW1wb3J0IHsgYnVpbGRUYWJsZVZpZXcgfSBmcm9tIFwiLi92aWV3cy90YWJsZVwiO1xuXG5pbnRlcmZhY2UgQXBwV2l0aFNldHRpbmdzIGV4dGVuZHMgQXBwIHtcbiAgc2V0dGluZzogeyBvcGVuOiAoKSA9PiB2b2lkOyBvcGVuVGFiQnlJZDogKGlkOiBzdHJpbmcpID0+IHZvaWQgfTtcbn1cblxuZXhwb3J0IGNsYXNzIFppQmFzZVRhYmxlUmVuZGVyZXIgaW1wbGVtZW50cyBaaUJhc2VIb3N0IHtcbiAgYXBwOiBBcHA7XG4gIHBsdWdpbjogWmlCYXNlUGx1Z2luTGlrZTtcblxuICBjb25zdHJ1Y3RvcihhcHA6IEFwcCwgcGx1Z2luOiBaaUJhc2VQbHVnaW5MaWtlKSB7XG4gICAgdGhpcy5hcHAgPSBhcHA7XG4gICAgdGhpcy5wbHVnaW4gPSBwbHVnaW47XG4gIH1cblxuICBwcm9jZXNzUmVhZGluZ1ZpZXcoZWxlbWVudDogSFRNTEVsZW1lbnQsIGNvbnRleHQ6IE1hcmtkb3duUG9zdFByb2Nlc3NvckNvbnRleHQpOiB2b2lkIHtcbiAgICBlbGVtZW50LnF1ZXJ5U2VsZWN0b3JBbGwoXCJ0YWJsZVwiKS5mb3JFYWNoKCh0YWJsZSkgPT4gdGhpcy50cnlSZW5kZXJUYWJsZSh0YWJsZSwgY29udGV4dCkpO1xuICB9XG5cbiAgdHJ5UmVuZGVyVGFibGUodGFibGU6IEhUTUxUYWJsZUVsZW1lbnQsIGNvbnRleHQ6IE1hcmtkb3duUG9zdFByb2Nlc3NvckNvbnRleHQpOiB2b2lkIHtcbiAgICBjb25zdCBzZWN0aW9uSW5mbyA9IGNvbnRleHQuZ2V0U2VjdGlvbkluZm8odGFibGUpO1xuICAgIGlmICghc2VjdGlvbkluZm8pIHJldHVybjtcbiAgICBjb25zdCBsaW5lcyA9IHNlY3Rpb25JbmZvLnRleHQuc3BsaXQoXCJcXG5cIikuc2xpY2Uoc2VjdGlvbkluZm8ubGluZVN0YXJ0LCBzZWN0aW9uSW5mby5saW5lRW5kICsgMSk7XG4gICAgY29uc3Qgc2NoZW1hID0gcGFyc2VaaUJhc2VTY2hlbWEobGluZXMsIHRoaXMucGx1Z2luLnNldHRpbmdzLmNvbHVtblJ1bGVzKTtcbiAgICBpZiAoIXNjaGVtYSkgcmV0dXJuO1xuICAgIGlmIChzY2hlbWEuaW5mZXJyZWQgJiYgIXRoaXMucGx1Z2luLnNldHRpbmdzLmluZmVyU2NoZW1hKSByZXR1cm47XG4gICAgdGFibGUucmVwbGFjZVdpdGgodGhpcy5idWlsZFJpY2hUYWJsZShzY2hlbWEsIGxpbmVzLCBjb250ZXh0LCBzZWN0aW9uSW5mbykpO1xuICB9XG5cbiAgYnVpbGRSaWNoVGFibGUoXG4gICAgc2NoZW1hOiBUYWJsZVNjaGVtYSxcbiAgICBsaW5lczogc3RyaW5nW10sXG4gICAgY29udGV4dDogTWFya2Rvd25Qb3N0UHJvY2Vzc29yQ29udGV4dCxcbiAgICBzZWN0aW9uSW5mbzogTWFya2Rvd25TZWN0aW9uSW5mb3JtYXRpb24sXG4gICk6IEhUTUxFbGVtZW50IHtcbiAgICBsZXQgY3VycmVudFZpZXc6IFZpZXdOYW1lID0gXCJ0YWJsZVwiO1xuICAgIGxldCBjb2xsYXBzZWQgPSBmYWxzZTtcbiAgICBsZXQgZmlsdGVyUXVlcnkgPSBcIlwiO1xuICAgIGxldCBzb3J0Q29sSWR4OiBudW1iZXIgfCBudWxsID0gbnVsbDtcbiAgICBsZXQgc29ydEFzYyA9IHRydWU7XG4gICAgY29uc3QgcmF3RGF0YUxpbmVzID0gbGluZXMuc2xpY2Uoc2NoZW1hLmRhdGFTdGFydEluZGV4KTtcblxuICAgIGNvbnN0IHZpZXdBbm5vdGF0aW9uID0gcGFyc2VWaWV3QW5ub3RhdGlvbihsaW5lcyk7XG4gICAgaWYgKHZpZXdBbm5vdGF0aW9uKSBjdXJyZW50VmlldyA9IHZpZXdBbm5vdGF0aW9uLnZpZXc7XG5cbiAgICBjb25zdCBnZXREYXRhUm93cyA9ICgpID0+IHJhd0RhdGFMaW5lcy5maWx0ZXIoaXNEYXRhUm93KTtcbiAgICBjb25zdCB3cmFwcGVyID0gY3JlYXRlRGl2KCk7XG4gICAgd3JhcHBlci5jbGFzc05hbWUgPSBcInppYmFzZS13cmFwcGVyXCI7XG4gICAgY29uc3QgdG9wYmFyID0gd3JhcHBlci5jcmVhdGVEaXYoXCJ6aWJhc2UtdG9wYmFyXCIpO1xuICAgIGNvbnN0IGNvbGxhcHNlQnRuID0gdG9wYmFyLmNyZWF0ZUVsKFwiYnV0dG9uXCIsIHsgY2xzOiBcInppYmFzZS1jb2xsYXBzZS1idG5cIiB9KTtcbiAgICBzZXRJY29uKGNvbGxhcHNlQnRuLCBcImNoZXZyb24tcmlnaHRcIik7XG4gICAgY29uc3QgdG9wTGVmdCA9IHRvcGJhci5jcmVhdGVEaXYoXCJ6aWJhc2UtdG9wYmFyLWxlZnRcIik7XG4gICAgdG9wTGVmdC5jcmVhdGVTcGFuKHsgdGV4dDogXCJcdTI3QzFcIiwgY2xzOiBcInppYmFzZS1sb2dvXCIgfSk7XG4gICAgY29uc3QgemliYXNlTmFtZSA9IHRvcExlZnQuY3JlYXRlU3Bhbih7IHRleHQ6IFwiWmlCYXNlXCIsIGNsczogXCJ6aWJhc2UtbmFtZSB6aWJhc2UtbmFtZS1idG5cIiB9KTtcbiAgICBjb25zdCBiYWRnZSA9IHRvcExlZnQuY3JlYXRlU3Bhbih7XG4gICAgICBjbHM6IHNjaGVtYS5pbmZlcnJlZCA/IFwiemliYXNlLWluZmVycmVkLWJhZGdlXCIgOiBcInppYmFzZS1hbm5vdGF0ZWQtYmFkZ2VcIixcbiAgICAgIHRleHQ6IHNjaGVtYS5pbmZlcnJlZCA/IFwiaW5mZXJyZWRcIiA6IFwiYW5ub3RhdGVkXCIsXG4gICAgfSk7XG4gICAgY29uc3QgdG9wUmlnaHQgPSB0b3BiYXIuY3JlYXRlRGl2KFwiemliYXNlLXRvcGJhci1yaWdodFwiKTtcbiAgICBjb25zdCBzZWFyY2hXcmFwID0gdG9wUmlnaHQuY3JlYXRlRGl2KFwiemliYXNlLXNlYXJjaC13cmFwXCIpO1xuICAgIGNvbnN0IHNlYXJjaEljb24gPSBzZWFyY2hXcmFwLmNyZWF0ZVNwYW4oeyBjbHM6IFwiemliYXNlLXNlYXJjaC1pY29uXCIgfSk7XG4gICAgc2V0SWNvbihzZWFyY2hJY29uLCBcInNlYXJjaFwiKTtcbiAgICBjb25zdCBzZWFyY2hJbnB1dCA9IHNlYXJjaFdyYXAuY3JlYXRlRWwoXCJpbnB1dFwiLCB7IGNsczogXCJ6aWJhc2Utc2VhcmNoXCIsIHR5cGU6IFwidGV4dFwiIH0pO1xuICAgIHNlYXJjaElucHV0LnBsYWNlaG9sZGVyID0gXCJGaWx0ZXJcdTIwMjZcIjtcbiAgICB6aWJhc2VOYW1lLmFkZEV2ZW50TGlzdGVuZXIoXCJjbGlja1wiLCAoZSkgPT4ge1xuICAgICAgZS5zdG9wUHJvcGFnYXRpb24oKTtcbiAgICAgIHRoaXMuc2hvd1ppQmFzZU1lbnUoZSwgc2NoZW1hLCBsaW5lcywgY29udGV4dCwgc2VjdGlvbkluZm8sIHJhd0RhdGFMaW5lcywgYmFkZ2UsIGN1cnJlbnRWaWV3LCAobmV3VmlldykgPT4ge1xuICAgICAgICBjdXJyZW50VmlldyA9IG5ld1ZpZXc7XG4gICAgICAgIHJlbmRlclZpZXdDb250ZW50KCk7XG4gICAgICB9KTtcbiAgICB9KTtcbiAgICBjb25zdCBib2R5ID0gd3JhcHBlci5jcmVhdGVEaXYoXCJ6aWJhc2UtYm9keVwiKTtcblxuICAgIGNvbnN0IGZvb3RlciA9IGJvZHkuY3JlYXRlRGl2KFwiemliYXNlLWZvb3RlclwiKTtcbiAgICBjb25zdCBhZGRSb3dCdG4gPSBmb290ZXIuY3JlYXRlRWwoXCJidXR0b25cIiwgeyBjbHM6IFwiemliYXNlLWFkZC1yb3ctYnRuXCIgfSk7XG4gICAgc2V0SWNvbihhZGRSb3dCdG4sIFwicGx1c1wiKTtcbiAgICBhZGRSb3dCdG4uYXBwZW5kVGV4dChcIiBBZGQgcm93XCIpO1xuICAgIGFkZFJvd0J0bi5hZGRFdmVudExpc3RlbmVyKFwiY2xpY2tcIiwgKCkgPT4ge1xuICAgICAgdm9pZCB0aGlzLmFkZFJvdyhjb250ZXh0LCBzZWN0aW9uSW5mbywgc2NoZW1hKTtcbiAgICB9KTtcbiAgICBjb25zdCByb3dDb3VudCA9IGZvb3Rlci5jcmVhdGVTcGFuKHsgY2xzOiBcInppYmFzZS1yb3ctY291bnRcIiB9KTtcbiAgICBjb25zdCB1cGRhdGVDb3VudCA9ICgpID0+IHtcbiAgICAgIGNvbnN0IHRvdGFsID0gZ2V0RGF0YVJvd3MoKS5sZW5ndGg7XG4gICAgICBjb25zdCB2aXNpYmxlID0gZmlsdGVyUXVlcnlcbiAgICAgICAgPyBnZXREYXRhUm93cygpLmZpbHRlcigobCkgPT4gc3BsaXRSb3cobCkuc29tZSgoYykgPT4gYy50b0xvd2VyQ2FzZSgpLmluY2x1ZGVzKGZpbHRlclF1ZXJ5LnRvTG93ZXJDYXNlKCkpKSkubGVuZ3RoXG4gICAgICAgIDogdG90YWw7XG4gICAgICByb3dDb3VudC50ZXh0Q29udGVudCA9IGZpbHRlclF1ZXJ5ICYmIHZpc2libGUgIT09IHRvdGFsID8gYCR7dmlzaWJsZX0gLyAke3RvdGFsfSByb3dzYCA6IGAke3RvdGFsfSByb3dzYDtcbiAgICB9O1xuXG4gICAgY29uc3QgcmVuZGVyVmlld0NvbnRlbnQgPSAoKSA9PiB7XG4gICAgICBib2R5LnF1ZXJ5U2VsZWN0b3JBbGwoXCIuemliYXNlLXRhYmxlLCAuemliYXNlLWthbmJhbiwgLnppYmFzZS1nYWxsZXJ5LCAuemliYXNlLWNhbGVuZGFyXCIpLmZvckVhY2goKGVsKSA9PiBlbC5yZW1vdmUoKSk7XG4gICAgICBjb25zdCB2aWV3Q29udGFpbmVyID0gY3JlYXRlRGl2KCk7XG4gICAgICBzd2l0Y2ggKGN1cnJlbnRWaWV3KSB7XG4gICAgICAgIGNhc2UgXCJrYW5iYW5cIjpcbiAgICAgICAgICBidWlsZEthbmJhblZpZXcodGhpcywgdmlld0NvbnRhaW5lciwgc2NoZW1hLCBnZXREYXRhUm93cywgcmF3RGF0YUxpbmVzLCBjb250ZXh0LCBzZWN0aW9uSW5mbywgZmlsdGVyUXVlcnkpO1xuICAgICAgICAgIGJyZWFrO1xuICAgICAgICBjYXNlIFwiZ2FsbGVyeVwiOlxuICAgICAgICAgIGJ1aWxkR2FsbGVyeVZpZXcodGhpcywgdmlld0NvbnRhaW5lciwgc2NoZW1hLCBnZXREYXRhUm93cywgcmF3RGF0YUxpbmVzLCBjb250ZXh0LCBzZWN0aW9uSW5mbywgZmlsdGVyUXVlcnkpO1xuICAgICAgICAgIGJyZWFrO1xuICAgICAgICBjYXNlIFwiY2FsZW5kYXJcIjpcbiAgICAgICAgICBidWlsZENhbGVuZGFyVmlldyh0aGlzLCB2aWV3Q29udGFpbmVyLCBzY2hlbWEsIGdldERhdGFSb3dzLCByYXdEYXRhTGluZXMsIGNvbnRleHQsIHNlY3Rpb25JbmZvLCBmaWx0ZXJRdWVyeSk7XG4gICAgICAgICAgYnJlYWs7XG4gICAgICAgIGRlZmF1bHQ6XG4gICAgICAgICAgYnVpbGRUYWJsZVZpZXcoXG4gICAgICAgICAgICB0aGlzLFxuICAgICAgICAgICAgdmlld0NvbnRhaW5lcixcbiAgICAgICAgICAgIHNjaGVtYSxcbiAgICAgICAgICAgIGdldERhdGFSb3dzLFxuICAgICAgICAgICAgcmF3RGF0YUxpbmVzLFxuICAgICAgICAgICAgY29udGV4dCxcbiAgICAgICAgICAgIHNlY3Rpb25JbmZvLFxuICAgICAgICAgICAgZmlsdGVyUXVlcnksXG4gICAgICAgICAgICBzb3J0Q29sSWR4LFxuICAgICAgICAgICAgc29ydEFzYyxcbiAgICAgICAgICAgIGJhZGdlLFxuICAgICAgICAgICAgKGNvbCwgYXNjKSA9PiB7XG4gICAgICAgICAgICAgIHNvcnRDb2xJZHggPSBjb2w7XG4gICAgICAgICAgICAgIHNvcnRBc2MgPSBhc2M7XG4gICAgICAgICAgICB9LFxuICAgICAgICAgICk7XG4gICAgICAgICAgYnJlYWs7XG4gICAgICB9XG4gICAgICB3aGlsZSAodmlld0NvbnRhaW5lci5maXJzdENoaWxkKSB7XG4gICAgICAgIGJvZHkuaW5zZXJ0QmVmb3JlKHZpZXdDb250YWluZXIuZmlyc3RDaGlsZCwgZm9vdGVyKTtcbiAgICAgIH1cbiAgICB9O1xuXG4gICAgcmVuZGVyVmlld0NvbnRlbnQoKTtcbiAgICB1cGRhdGVDb3VudCgpO1xuICAgIGNvbGxhcHNlQnRuLmFkZEV2ZW50TGlzdGVuZXIoXCJjbGlja1wiLCAoKSA9PiB7XG4gICAgICBjb2xsYXBzZWQgPSAhY29sbGFwc2VkO1xuICAgICAgYm9keS5jbGFzc0xpc3QudG9nZ2xlKFwiemliYXNlLWJvZHktY29sbGFwc2VkXCIsIGNvbGxhcHNlZCk7XG4gICAgICBjb2xsYXBzZUJ0bi5jbGFzc0xpc3QudG9nZ2xlKFwiemliYXNlLWNvbGxhcHNlZFwiLCBjb2xsYXBzZWQpO1xuICAgIH0pO1xuICAgIHNlYXJjaElucHV0LmFkZEV2ZW50TGlzdGVuZXIoXCJpbnB1dFwiLCAoKSA9PiB7XG4gICAgICBmaWx0ZXJRdWVyeSA9IHNlYXJjaElucHV0LnZhbHVlLnRyaW0oKTtcbiAgICAgIHJlbmRlclZpZXdDb250ZW50KCk7XG4gICAgICB1cGRhdGVDb3VudCgpO1xuICAgIH0pO1xuICAgIHJldHVybiB3cmFwcGVyO1xuICB9XG5cbiAgc2hvd1ppQmFzZU1lbnUoXG4gICAgZTogTW91c2VFdmVudCxcbiAgICBzY2hlbWE6IFRhYmxlU2NoZW1hLFxuICAgIGxpbmVzOiBzdHJpbmdbXSxcbiAgICBjb250ZXh0OiBNYXJrZG93blBvc3RQcm9jZXNzb3JDb250ZXh0LFxuICAgIHNlY3Rpb25JbmZvOiBNYXJrZG93blNlY3Rpb25JbmZvcm1hdGlvbixcbiAgICBfcmF3RGF0YUxpbmVzOiBzdHJpbmdbXSxcbiAgICBfYmFkZ2U6IEhUTUxFbGVtZW50LFxuICAgIGN1cnJlbnRWaWV3OiBWaWV3TmFtZSxcbiAgICBvblZpZXdDaGFuZ2U6ICh2aWV3OiBWaWV3TmFtZSkgPT4gdm9pZCxcbiAgKTogdm9pZCB7XG4gICAgZG9jdW1lbnQucXVlcnlTZWxlY3RvckFsbChcIi56aWJhc2UtZHJvcGRvd25cIikuZm9yRWFjaCgobSkgPT4gbS5yZW1vdmUoKSk7XG4gICAgY29uc3QgbWVudSA9IGNyZWF0ZURpdigpO1xuICAgIG1lbnUuY2xhc3NOYW1lID0gXCJ6aWJhc2UtZHJvcGRvd25cIjtcbiAgICBjb25zdCB0YXJnZXQgPSBlLnRhcmdldCBhcyBIVE1MRWxlbWVudDtcbiAgICBjb25zdCByZWN0ID0gdGFyZ2V0LmdldEJvdW5kaW5nQ2xpZW50UmVjdCgpO1xuICAgIG1lbnUuc2V0Q3NzU3R5bGVzKHsgdG9wOiBgJHtyZWN0LmJvdHRvbSArIHdpbmRvdy5zY3JvbGxZICsgNH1weGAgfSk7XG4gICAgbWVudS5zZXRDc3NTdHlsZXMoeyBsZWZ0OiBgJHtyZWN0LmxlZnQgKyB3aW5kb3cuc2Nyb2xsWH1weGAgfSk7XG4gICAgY29uc3QgY29udHJvbGxlciA9IG5ldyBBYm9ydENvbnRyb2xsZXIoKTtcbiAgICBjb25zdCBjbG9zZU1lbnUgPSAoKSA9PiB7XG4gICAgICBtZW51LnJlbW92ZSgpO1xuICAgICAgY29udHJvbGxlci5hYm9ydCgpO1xuICAgIH07XG5cbiAgICBjb25zdCBleHBvcnRJdGVtID0gbWVudS5jcmVhdGVEaXYoXCJ6aWJhc2UtZHJvcGRvd24taXRlbSB6aWJhc2UtZHJvcGRvd24taGFzLXN1YlwiKTtcbiAgICBleHBvcnRJdGVtLmNyZWF0ZVNwYW4oeyB0ZXh0OiBcIkV4cG9ydFwiLCBjbHM6IFwiemliYXNlLWRyb3Bkb3duLWxhYmVsXCIgfSk7XG4gICAgZXhwb3J0SXRlbS5jcmVhdGVTcGFuKHsgdGV4dDogXCJcdTI1QjZcIiwgY2xzOiBcInppYmFzZS1kcm9wZG93bi1hcnJvd1wiIH0pO1xuICAgIGNvbnN0IGV4cG9ydFN1YiA9IGV4cG9ydEl0ZW0uY3JlYXRlRGl2KFwiemliYXNlLWRyb3Bkb3duLXN1YlwiKTtcbiAgICBjb25zdCBleHBvcnRPcHRpb25zID0gW1xuICAgICAgeyBpY29uOiBcIlx1RDgzRFx1RENDQlwiLCBsYWJlbDogXCJDb3B5IGFzIE1hcmtkb3duXCIsIGFjdGlvbjogKCkgPT4gdGhpcy5jb3B5QXNNYXJrZG93bihzY2hlbWEsIGxpbmVzKSB9LFxuICAgICAgeyBpY29uOiBcIlx1RDgzRFx1RENFNFwiLCBsYWJlbDogXCJFeHBvcnQgYXMgQ1NWXCIsIGFjdGlvbjogKCkgPT4gdm9pZCB0aGlzLmV4cG9ydENTVihzY2hlbWEsIGxpbmVzLCBjb250ZXh0KSB9LFxuICAgICAgeyBpY29uOiBcIlx1RDgzRFx1RERDNFx1RkUwRlwiLCBsYWJlbDogXCJFeHBvcnQgYXMgSlNPTlwiLCBhY3Rpb246ICgpID0+IHZvaWQgdGhpcy5leHBvcnRKU09OKHNjaGVtYSwgbGluZXMsIGNvbnRleHQpIH0sXG4gICAgXTtcbiAgICBleHBvcnRPcHRpb25zLmZvckVhY2goKHsgaWNvbiwgbGFiZWwsIGFjdGlvbiB9KSA9PiB7XG4gICAgICBjb25zdCBpdGVtID0gZXhwb3J0U3ViLmNyZWF0ZURpdihcInppYmFzZS1kcm9wZG93bi1zdWJpdGVtXCIpO1xuICAgICAgaXRlbS5jcmVhdGVTcGFuKHsgdGV4dDogaWNvbiwgY2xzOiBcInppYmFzZS1kcm9wZG93bi1pY29uXCIgfSk7XG4gICAgICBpdGVtLmNyZWF0ZVNwYW4oeyB0ZXh0OiBsYWJlbCB9KTtcbiAgICAgIGl0ZW0uYWRkRXZlbnRMaXN0ZW5lcihcImNsaWNrXCIsICgpID0+IHtcbiAgICAgICAgY2xvc2VNZW51KCk7XG4gICAgICAgIGFjdGlvbigpO1xuICAgICAgfSk7XG4gICAgfSk7XG5cbiAgICBjb25zdCB2aWV3SXRlbSA9IG1lbnUuY3JlYXRlRGl2KFwiemliYXNlLWRyb3Bkb3duLWl0ZW0gemliYXNlLWRyb3Bkb3duLWhhcy1zdWJcIik7XG4gICAgdmlld0l0ZW0uY3JlYXRlU3Bhbih7IHRleHQ6IFwiVmlld1wiLCBjbHM6IFwiemliYXNlLWRyb3Bkb3duLWxhYmVsXCIgfSk7XG4gICAgdmlld0l0ZW0uY3JlYXRlU3Bhbih7IHRleHQ6IFwiXHUyNUI2XCIsIGNsczogXCJ6aWJhc2UtZHJvcGRvd24tYXJyb3dcIiB9KTtcbiAgICBjb25zdCB2aWV3U3ViID0gdmlld0l0ZW0uY3JlYXRlRGl2KFwiemliYXNlLWRyb3Bkb3duLXN1YlwiKTtcbiAgICBjb25zdCB2aWV3T3B0aW9uczogeyBpY29uOiBzdHJpbmc7IGxhYmVsOiBzdHJpbmc7IHZpZXc6IFZpZXdOYW1lIH1bXSA9IFtcbiAgICAgIHsgaWNvbjogXCJcdUQ4M0RcdURDQ0FcIiwgbGFiZWw6IFwiVGFibGVcIiwgdmlldzogXCJ0YWJsZVwiIH0sXG4gICAgICB7IGljb246IFwiXHVEODNEXHVEQ0NCXCIsIGxhYmVsOiBcIkthbmJhblwiLCB2aWV3OiBcImthbmJhblwiIH0sXG4gICAgICB7IGljb246IFwiXHVEODNEXHVEREJDXHVGRTBGXCIsIGxhYmVsOiBcIkdhbGxlcnlcIiwgdmlldzogXCJnYWxsZXJ5XCIgfSxcbiAgICAgIHsgaWNvbjogXCJcdUQ4M0RcdURDQzVcIiwgbGFiZWw6IFwiQ2FsZW5kYXJcIiwgdmlldzogXCJjYWxlbmRhclwiIH0sXG4gICAgXTtcbiAgICB2aWV3T3B0aW9ucy5mb3JFYWNoKCh7IGljb24sIGxhYmVsLCB2aWV3IH0pID0+IHtcbiAgICAgIGNvbnN0IGl0ZW0gPSB2aWV3U3ViLmNyZWF0ZURpdihcInppYmFzZS1kcm9wZG93bi1zdWJpdGVtXCIpO1xuICAgICAgaXRlbS5jcmVhdGVTcGFuKHsgdGV4dDogaWNvbiwgY2xzOiBcInppYmFzZS1kcm9wZG93bi1pY29uXCIgfSk7XG4gICAgICBpdGVtLmNyZWF0ZVNwYW4oeyB0ZXh0OiBsYWJlbCB9KTtcbiAgICAgIGlmIChjdXJyZW50VmlldyA9PT0gdmlldykge1xuICAgICAgICBpdGVtLmNsYXNzTGlzdC5hZGQoXCJ6aWJhc2UtbWVudS1hY3RpdmVcIik7XG4gICAgICAgIGl0ZW0uY3JlYXRlU3Bhbih7IHRleHQ6IFwiIFx1MjcxM1wiLCBjbHM6IFwiemliYXNlLXZpZXctY2hlY2tcIiB9KTtcbiAgICAgIH1cbiAgICAgIGl0ZW0uYWRkRXZlbnRMaXN0ZW5lcihcImNsaWNrXCIsICgpID0+IHtcbiAgICAgICAgY2xvc2VNZW51KCk7XG4gICAgICAgIGlmIChjdXJyZW50VmlldyAhPT0gdmlldykge1xuICAgICAgICAgIG9uVmlld0NoYW5nZSh2aWV3KTtcbiAgICAgICAgICB2b2lkIHRoaXMucGVyc2lzdFZpZXdBbm5vdGF0aW9uKGNvbnRleHQsIHNlY3Rpb25JbmZvLCB2aWV3KTtcbiAgICAgICAgfVxuICAgICAgfSk7XG4gICAgfSk7XG5cbiAgICBjb25zdCBydWxlc0l0ZW0gPSBtZW51LmNyZWF0ZURpdihcInppYmFzZS1kcm9wZG93bi1pdGVtIHppYmFzZS1kcm9wZG93bi1oYXMtc3ViXCIpO1xuICAgIHJ1bGVzSXRlbS5jcmVhdGVTcGFuKHsgdGV4dDogXCJDb2x1bW4gTmFtZSBSdWxlc1wiLCBjbHM6IFwiemliYXNlLWRyb3Bkb3duLWxhYmVsXCIgfSk7XG4gICAgcnVsZXNJdGVtLmNyZWF0ZVNwYW4oeyB0ZXh0OiBcIlx1MjVCNlwiLCBjbHM6IFwiemliYXNlLWRyb3Bkb3duLWFycm93XCIgfSk7XG4gICAgY29uc3QgcnVsZXNTdWIgPSBydWxlc0l0ZW0uY3JlYXRlRGl2KFwiemliYXNlLWRyb3Bkb3duLXN1YiB6aWJhc2UtcnVsZXMtc3ViXCIpO1xuICAgIHRoaXMucmVuZGVyUnVsZXNQYW5lbChydWxlc1N1Yik7XG5cbiAgICBjb25zdCBzZXR0aW5nc0l0ZW0gPSBtZW51LmNyZWF0ZURpdihcInppYmFzZS1kcm9wZG93bi1pdGVtXCIpO1xuICAgIHNldHRpbmdzSXRlbS5jcmVhdGVTcGFuKHsgdGV4dDogXCJcdTI2OTlcdUZFMEZcIiwgY2xzOiBcInppYmFzZS1kcm9wZG93bi1pY29uXCIgfSk7XG4gICAgc2V0dGluZ3NJdGVtLmNyZWF0ZVNwYW4oeyB0ZXh0OiBcIk9wZW4gU2V0dGluZ3NcIiwgY2xzOiBcInppYmFzZS1kcm9wZG93bi1sYWJlbFwiIH0pO1xuICAgIHNldHRpbmdzSXRlbS5hZGRFdmVudExpc3RlbmVyKFwiY2xpY2tcIiwgKCkgPT4ge1xuICAgICAgY2xvc2VNZW51KCk7XG4gICAgICBjb25zdCBhcHAgPSB0aGlzLmFwcCBhcyBBcHBXaXRoU2V0dGluZ3M7XG4gICAgICBhcHAuc2V0dGluZy5vcGVuKCk7XG4gICAgICBhcHAuc2V0dGluZy5vcGVuVGFiQnlJZChcInppYmFzZVwiKTtcbiAgICB9KTtcbiAgICBkb2N1bWVudC5ib2R5LmFwcGVuZENoaWxkKG1lbnUpO1xuICAgIHdpbmRvdy5zZXRUaW1lb3V0KCgpID0+IHtcbiAgICAgIGRvY3VtZW50LmFkZEV2ZW50TGlzdGVuZXIoXCJjbGlja1wiLCAoZXYpID0+IHtcbiAgICAgICAgaWYgKCFtZW51LmNvbnRhaW5zKGV2LnRhcmdldCBhcyBOb2RlKSkgY2xvc2VNZW51KCk7XG4gICAgICB9LCB7IHNpZ25hbDogY29udHJvbGxlci5zaWduYWwgfSk7XG4gICAgfSwgMTApO1xuICB9XG5cbiAgYXN5bmMgcGVyc2lzdFZpZXdBbm5vdGF0aW9uKFxuICAgIGNvbnRleHQ6IE1hcmtkb3duUG9zdFByb2Nlc3NvckNvbnRleHQsXG4gICAgc2VjdGlvbkluZm86IE1hcmtkb3duU2VjdGlvbkluZm9ybWF0aW9uLFxuICAgIHZpZXc6IHN0cmluZyxcbiAgKTogUHJvbWlzZTx2b2lkPiB7XG4gICAgY29uc3QgZmlsZSA9IHRoaXMuYXBwLnZhdWx0LmdldEFic3RyYWN0RmlsZUJ5UGF0aChjb250ZXh0LnNvdXJjZVBhdGgpO1xuICAgIGlmICghKGZpbGUgaW5zdGFuY2VvZiBURmlsZSkpIHJldHVybjtcbiAgICBhd2FpdCB0aGlzLmFwcC52YXVsdC5wcm9jZXNzKGZpbGUsIChjb250ZW50KSA9PiB7XG4gICAgICBjb25zdCBhbGxMaW5lcyA9IGNvbnRlbnQuc3BsaXQoXCJcXG5cIik7XG4gICAgICBjb25zdCBzZWFyY2hTdGFydCA9IE1hdGgubWF4KDAsIHNlY3Rpb25JbmZvLmxpbmVTdGFydCAtIDEpO1xuICAgICAgZm9yIChsZXQgaSA9IHNlYXJjaFN0YXJ0OyBpIDw9IE1hdGgubWluKHNlY3Rpb25JbmZvLmxpbmVTdGFydCwgYWxsTGluZXMubGVuZ3RoIC0gMSk7IGkrKykge1xuICAgICAgICBpZiAoVklFV19BTk5PVEFUSU9OX1JFLnRlc3QoYWxsTGluZXNbaV0pKSB7XG4gICAgICAgICAgaWYgKHZpZXcgPT09IFwidGFibGVcIikgYWxsTGluZXMuc3BsaWNlKGksIDEpO1xuICAgICAgICAgIGVsc2UgYWxsTGluZXNbaV0gPSBgPCEtLSB6aWJhc2UtdmlldzogJHt2aWV3fSAtLT5gO1xuICAgICAgICAgIHJldHVybiBhbGxMaW5lcy5qb2luKFwiXFxuXCIpO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgICBpZiAodmlldyAhPT0gXCJ0YWJsZVwiKSB7XG4gICAgICAgIGFsbExpbmVzLnNwbGljZShzZWN0aW9uSW5mby5saW5lU3RhcnQsIDAsIGA8IS0tIHppYmFzZS12aWV3OiAke3ZpZXd9IC0tPmApO1xuICAgICAgfVxuICAgICAgcmV0dXJuIGFsbExpbmVzLmpvaW4oXCJcXG5cIik7XG4gICAgfSk7XG4gIH1cblxuICByZW5kZXJSdWxlc1BhbmVsKGNvbnRhaW5lcjogSFRNTEVsZW1lbnQpOiB2b2lkIHtcbiAgICBjb250YWluZXIuZW1wdHkoKTtcbiAgICBjb25zdCB0aXRsZSA9IGNvbnRhaW5lci5jcmVhdGVEaXYoXCJ6aWJhc2UtcnVsZXMtdGl0bGVcIik7XG4gICAgdGl0bGUudGV4dENvbnRlbnQgPSBcIkNvbHVtbiBcdTIxOTIgVHlwZSBydWxlc1wiO1xuICAgIHRoaXMucGx1Z2luLnNldHRpbmdzLmNvbHVtblJ1bGVzLmZvckVhY2goKHJ1bGUsIGlkeCkgPT4ge1xuICAgICAgY29uc3Qgcm93ID0gY29udGFpbmVyLmNyZWF0ZURpdihcInppYmFzZS1ydWxlcy1yb3dcIik7XG4gICAgICBjb25zdCBuYW1lSW5wdXQgPSByb3cuY3JlYXRlRWwoXCJpbnB1dFwiLCB7IHR5cGU6IFwidGV4dFwiLCBjbHM6IFwiemliYXNlLXJ1bGVzLW5hbWVcIiwgdmFsdWU6IHJ1bGUubmFtZSB9KTtcbiAgICAgIG5hbWVJbnB1dC5wbGFjZWhvbGRlciA9IFwibmFtZVwiO1xuICAgICAgbmFtZUlucHV0LmFkZEV2ZW50TGlzdGVuZXIoXCJjaGFuZ2VcIiwgKCkgPT4ge1xuICAgICAgICB2b2lkIChhc3luYyAoKSA9PiB7XG4gICAgICAgICAgdGhpcy5wbHVnaW4uc2V0dGluZ3MuY29sdW1uUnVsZXNbaWR4XS5uYW1lID0gbmFtZUlucHV0LnZhbHVlLnRyaW0oKTtcbiAgICAgICAgICBhd2FpdCB0aGlzLnBsdWdpbi5zYXZlU2V0dGluZ3MoKTtcbiAgICAgICAgfSkoKTtcbiAgICAgIH0pO1xuICAgICAgcm93LmNyZWF0ZVNwYW4oeyB0ZXh0OiBcIlx1MjE5MlwiLCBjbHM6IFwiemliYXNlLXJ1bGVzLWFycm93XCIgfSk7XG4gICAgICBjb25zdCB0eXBlU2VsZWN0ID0gcm93LmNyZWF0ZUVsKFwic2VsZWN0XCIsIHsgY2xzOiBcInppYmFzZS1ydWxlcy10eXBlXCIgfSk7XG4gICAgICBDT0xVTU5fVFlQRV9PUFRJT05TLmZvckVhY2goKHQpID0+IHtcbiAgICAgICAgY29uc3Qgb3B0ID0gdHlwZVNlbGVjdC5jcmVhdGVFbChcIm9wdGlvblwiLCB7IHRleHQ6IHQsIHZhbHVlOiB0IH0pO1xuICAgICAgICBpZiAodCA9PT0gcnVsZS50eXBlKSBvcHQuc2VsZWN0ZWQgPSB0cnVlO1xuICAgICAgfSk7XG4gICAgICB0eXBlU2VsZWN0LmFkZEV2ZW50TGlzdGVuZXIoXCJjaGFuZ2VcIiwgKCkgPT4ge1xuICAgICAgICB2b2lkIChhc3luYyAoKSA9PiB7XG4gICAgICAgICAgdGhpcy5wbHVnaW4uc2V0dGluZ3MuY29sdW1uUnVsZXNbaWR4XS50eXBlID0gdHlwZVNlbGVjdC52YWx1ZTtcbiAgICAgICAgICBhd2FpdCB0aGlzLnBsdWdpbi5zYXZlU2V0dGluZ3MoKTtcbiAgICAgICAgfSkoKTtcbiAgICAgIH0pO1xuICAgICAgY29uc3QgcmVtb3ZlQnRuID0gcm93LmNyZWF0ZUVsKFwiYnV0dG9uXCIsIHsgdGV4dDogXCJcdTAwRDdcIiwgY2xzOiBcInppYmFzZS1ydWxlcy1yZW1vdmVcIiB9KTtcbiAgICAgIHJlbW92ZUJ0bi5hZGRFdmVudExpc3RlbmVyKFwiY2xpY2tcIiwgKCkgPT4ge1xuICAgICAgICB2b2lkIChhc3luYyAoKSA9PiB7XG4gICAgICAgICAgdGhpcy5wbHVnaW4uc2V0dGluZ3MuY29sdW1uUnVsZXMuc3BsaWNlKGlkeCwgMSk7XG4gICAgICAgICAgYXdhaXQgdGhpcy5wbHVnaW4uc2F2ZVNldHRpbmdzKCk7XG4gICAgICAgICAgdGhpcy5yZW5kZXJSdWxlc1BhbmVsKGNvbnRhaW5lcik7XG4gICAgICAgIH0pKCk7XG4gICAgICB9KTtcbiAgICB9KTtcbiAgICBjb25zdCBhZGRSb3cgPSBjb250YWluZXIuY3JlYXRlRGl2KFwiemliYXNlLXJ1bGVzLWFkZFwiKTtcbiAgICBjb25zdCBhZGRCdG4gPSBhZGRSb3cuY3JlYXRlRWwoXCJidXR0b25cIiwgeyB0ZXh0OiBcIisgQWRkIHJ1bGVcIiwgY2xzOiBcInppYmFzZS1ydWxlcy1hZGQtYnRuXCIgfSk7XG4gICAgYWRkQnRuLmFkZEV2ZW50TGlzdGVuZXIoXCJjbGlja1wiLCAoKSA9PiB7XG4gICAgICB2b2lkIChhc3luYyAoKSA9PiB7XG4gICAgICAgIHRoaXMucGx1Z2luLnNldHRpbmdzLmNvbHVtblJ1bGVzLnB1c2goeyBuYW1lOiBcIlwiLCB0eXBlOiBcImxhYmVsXCIgfSk7XG4gICAgICAgIGF3YWl0IHRoaXMucGx1Z2luLnNhdmVTZXR0aW5ncygpO1xuICAgICAgICB0aGlzLnJlbmRlclJ1bGVzUGFuZWwoY29udGFpbmVyKTtcbiAgICAgIH0pKCk7XG4gICAgfSk7XG4gIH1cblxuICBjb3B5QXNNYXJrZG93bihzY2hlbWE6IFRhYmxlU2NoZW1hLCBsaW5lczogc3RyaW5nW10pOiB2b2lkIHtcbiAgICBjb25zdCBkYXRhUm93cyA9IGxpbmVzLnNsaWNlKHNjaGVtYS5kYXRhU3RhcnRJbmRleCkuZmlsdGVyKGlzRGF0YVJvdyk7XG4gICAgY29uc3QgaGVhZGVyID0gXCJ8IFwiICsgc2NoZW1hLmNvbHVtbnMubWFwKChjKSA9PiBjLm5hbWUpLmpvaW4oXCIgfCBcIikgKyBcIiB8XCI7XG4gICAgY29uc3Qgc2VwYXJhdG9yID0gXCJ8IFwiICsgc2NoZW1hLmNvbHVtbnMubWFwKCgpID0+IFwiLS0tXCIpLmpvaW4oXCIgfCBcIikgKyBcIiB8XCI7XG4gICAgY29uc3Qgcm93cyA9IGRhdGFSb3dzLm1hcCgobGluZSkgPT4ge1xuICAgICAgY29uc3QgY2VsbHMgPSBzcGxpdFJvdyhsaW5lKTtcbiAgICAgIHJldHVybiBcInwgXCIgKyBzY2hlbWEuY29sdW1ucy5tYXAoKF8sIGkpID0+IGNlbGxzW2ldID8/IFwiXCIpLmpvaW4oXCIgfCBcIikgKyBcIiB8XCI7XG4gICAgfSk7XG4gICAgdm9pZCBuYXZpZ2F0b3IuY2xpcGJvYXJkLndyaXRlVGV4dChbaGVhZGVyLCBzZXBhcmF0b3IsIC4uLnJvd3NdLmpvaW4oXCJcXG5cIikpO1xuICAgIHNob3dUb2FzdChcIlx1RDgzRFx1RENDQiBDb3BpZWQgYXMgTWFya2Rvd24hXCIpO1xuICB9XG5cbiAgYXN5bmMgZXhwb3J0Q1NWKHNjaGVtYTogVGFibGVTY2hlbWEsIGxpbmVzOiBzdHJpbmdbXSwgY29udGV4dDogTWFya2Rvd25Qb3N0UHJvY2Vzc29yQ29udGV4dCk6IFByb21pc2U8dm9pZD4ge1xuICAgIGNvbnN0IGRhdGFSb3dzID0gbGluZXMuc2xpY2Uoc2NoZW1hLmRhdGFTdGFydEluZGV4KS5maWx0ZXIoaXNEYXRhUm93KTtcbiAgICBjb25zdCBlc2NhcGUgPSAodjogc3RyaW5nKSA9PiBgXCIke3YucmVwbGFjZSgvXCIvZywgJ1wiXCInKX1cImA7XG4gICAgY29uc3QgaGVhZGVyID0gc2NoZW1hLmNvbHVtbnMubWFwKChjKSA9PiBlc2NhcGUoYy5uYW1lKSkuam9pbihcIixcIik7XG4gICAgY29uc3Qgcm93cyA9IGRhdGFSb3dzLm1hcCgobGluZSkgPT4ge1xuICAgICAgY29uc3QgY2VsbHMgPSBzcGxpdFJvdyhsaW5lKTtcbiAgICAgIHJldHVybiBzY2hlbWEuY29sdW1ucy5tYXAoKF8sIGkpID0+IGVzY2FwZSgoY2VsbHNbaV0gPz8gXCJcIikudHJpbSgpKSkuam9pbihcIixcIik7XG4gICAgfSk7XG4gICAgY29uc3Qgbm90ZU5hbWUgPSBjb250ZXh0LnNvdXJjZVBhdGgucmVwbGFjZSgvXFwubWQkLywgXCJcIik7XG4gICAgYXdhaXQgdGhpcy5zYXZlRmlsZShub3RlTmFtZSArIFwiLmNzdlwiLCBbaGVhZGVyLCAuLi5yb3dzXS5qb2luKFwiXFxuXCIpLCBjb250ZXh0KTtcbiAgICBzaG93VG9hc3QoXCJcdUQ4M0RcdURDRTQgRXhwb3J0ZWQgYXMgQ1NWIVwiKTtcbiAgfVxuXG4gIGFzeW5jIGV4cG9ydEpTT04oc2NoZW1hOiBUYWJsZVNjaGVtYSwgbGluZXM6IHN0cmluZ1tdLCBjb250ZXh0OiBNYXJrZG93blBvc3RQcm9jZXNzb3JDb250ZXh0KTogUHJvbWlzZTx2b2lkPiB7XG4gICAgY29uc3QgZGF0YVJvd3MgPSBsaW5lcy5zbGljZShzY2hlbWEuZGF0YVN0YXJ0SW5kZXgpLmZpbHRlcihpc0RhdGFSb3cpO1xuICAgIGNvbnN0IHJlY29yZHMgPSBkYXRhUm93cy5tYXAoKGxpbmUpID0+IHtcbiAgICAgIGNvbnN0IGNlbGxzID0gc3BsaXRSb3cobGluZSk7XG4gICAgICBjb25zdCBvYmo6IFJlY29yZDxzdHJpbmcsIHN0cmluZyB8IGJvb2xlYW4gfCBudW1iZXIgfCBudWxsPiA9IHt9O1xuICAgICAgc2NoZW1hLmNvbHVtbnMuZm9yRWFjaCgoY29sLCBpKSA9PiB7XG4gICAgICAgIGNvbnN0IHJhdyA9IChjZWxsc1tpXSA/PyBcIlwiKS50cmltKCk7XG4gICAgICAgIGlmIChjb2wudHlwZS5raW5kID09PSBcInRvZ2dsZVwiKSBvYmpbY29sLm5hbWVdID0gcGFyc2VCb29sKHJhdyk7XG4gICAgICAgIGVsc2UgaWYgKGNvbC50eXBlLmtpbmQgPT09IFwibnVtYmVyXCIpIG9ialtjb2wubmFtZV0gPSByYXcgPyBwYXJzZUZsb2F0KHJhdykgOiBudWxsO1xuICAgICAgICBlbHNlIG9ialtjb2wubmFtZV0gPSByYXc7XG4gICAgICB9KTtcbiAgICAgIHJldHVybiBvYmo7XG4gICAgfSk7XG4gICAgY29uc3Qgbm90ZU5hbWUgPSBjb250ZXh0LnNvdXJjZVBhdGgucmVwbGFjZSgvXFwubWQkLywgXCJcIik7XG4gICAgYXdhaXQgdGhpcy5zYXZlRmlsZShub3RlTmFtZSArIFwiLmpzb25cIiwgSlNPTi5zdHJpbmdpZnkocmVjb3JkcywgbnVsbCwgMiksIGNvbnRleHQpO1xuICAgIHNob3dUb2FzdChcIlx1RDgzRFx1RERDNFx1RkUwRiBFeHBvcnRlZCBhcyBKU09OIVwiKTtcbiAgfVxuXG4gIGFzeW5jIHNhdmVGaWxlKGZpbGVuYW1lOiBzdHJpbmcsIGNvbnRlbnQ6IHN0cmluZywgY29udGV4dDogTWFya2Rvd25Qb3N0UHJvY2Vzc29yQ29udGV4dCk6IFByb21pc2U8dm9pZD4ge1xuICAgIGNvbnN0IGZpbGUgPSB0aGlzLmFwcC52YXVsdC5nZXRBYnN0cmFjdEZpbGVCeVBhdGgoY29udGV4dC5zb3VyY2VQYXRoKTtcbiAgICBpZiAoIShmaWxlIGluc3RhbmNlb2YgVEZpbGUpKSByZXR1cm47XG4gICAgY29uc3QgZm9sZGVyID0gZmlsZS5wYXJlbnQ/LnBhdGggPz8gXCJcIjtcbiAgICBjb25zdCBiYXNlTmFtZSA9IGZpbGVuYW1lLnNwbGl0KFwiL1wiKS5wb3AoKSA/PyBmaWxlbmFtZTtcbiAgICBjb25zdCBmdWxsUGF0aCA9IGZvbGRlciA/IGAke2ZvbGRlcn0vJHtiYXNlTmFtZX1gIDogYmFzZU5hbWU7XG4gICAgY29uc3QgZXhpc3RpbmcgPSB0aGlzLmFwcC52YXVsdC5nZXRBYnN0cmFjdEZpbGVCeVBhdGgoZnVsbFBhdGgpO1xuICAgIGlmIChleGlzdGluZyBpbnN0YW5jZW9mIFRGaWxlKSBhd2FpdCB0aGlzLmFwcC52YXVsdC5tb2RpZnkoZXhpc3RpbmcsIGNvbnRlbnQpO1xuICAgIGVsc2UgYXdhaXQgdGhpcy5hcHAudmF1bHQuY3JlYXRlKGZ1bGxQYXRoLCBjb250ZW50KTtcbiAgfVxuXG4gIHNob3dUeXBlTWVudShcbiAgICBlOiBNb3VzZUV2ZW50LFxuICAgIGNvbElkeDogbnVtYmVyLFxuICAgIHNjaGVtYTogVGFibGVTY2hlbWEsXG4gICAgY29udGV4dDogTWFya2Rvd25Qb3N0UHJvY2Vzc29yQ29udGV4dCxcbiAgICBzZWN0aW9uSW5mbzogTWFya2Rvd25TZWN0aW9uSW5mb3JtYXRpb24sXG4gICAgX3Jhd0RhdGFMaW5lczogc3RyaW5nW10sXG4gICAgYmFkZ2U6IEhUTUxFbGVtZW50LFxuICApOiB2b2lkIHtcbiAgICBkb2N1bWVudC5xdWVyeVNlbGVjdG9yQWxsKFwiLnppYmFzZS1jb250ZXh0LW1lbnVcIikuZm9yRWFjaCgobSkgPT4gbS5yZW1vdmUoKSk7XG4gICAgY29uc3QgbWVudSA9IGNyZWF0ZURpdigpO1xuICAgIG1lbnUuY2xhc3NOYW1lID0gXCJ6aWJhc2UtY29udGV4dC1tZW51XCI7XG4gICAgY29uc3QgeCA9IE1hdGgubWluKGUuY2xpZW50WCwgd2luZG93LmlubmVyV2lkdGggLSAxNjApO1xuICAgIG1lbnUuc2V0Q3NzU3R5bGVzKHsgdG9wOiBgJHtlLmNsaWVudFkgKyB3aW5kb3cuc2Nyb2xsWX1weGAgfSk7XG4gICAgbWVudS5zZXRDc3NTdHlsZXMoeyBsZWZ0OiBgJHt4fXB4YCB9KTtcbiAgICBjb25zdCB0eXBlcyA9IFtcbiAgICAgIHsgbGFiZWw6IFwiVGV4dFwiLCBpY29uOiBcIlRcIiwga2luZDogXCJ0ZXh0XCIgfSxcbiAgICAgIHsgbGFiZWw6IFwiVG9nZ2xlXCIsIGljb246IFwiXHUyQjFDXCIsIGtpbmQ6IFwidG9nZ2xlXCIgfSxcbiAgICAgIHsgbGFiZWw6IFwiU2VsZWN0XCIsIGljb246IFwiXHUyNUJFXCIsIGtpbmQ6IFwic2VsZWN0XCIgfSxcbiAgICAgIHsgbGFiZWw6IFwiTGFiZWxcIiwgaWNvbjogXCJcdTJCMjFcIiwga2luZDogXCJsYWJlbFwiIH0sXG4gICAgICB7IGxhYmVsOiBcIk11bHRpLXNlbGVjdFwiLCBpY29uOiBcIlx1RDgzQ1x1REZGN1x1RkUwRlwiLCBraW5kOiBcIm11bHRpLXNlbGVjdFwiIH0sXG4gICAgICB7IGxhYmVsOiBcIk51bWJlclwiLCBpY29uOiBcIiNcIiwga2luZDogXCJudW1iZXJcIiB9LFxuICAgICAgeyBsYWJlbDogXCJEYXRlXCIsIGljb246IFwiXHVEODNEXHVEQ0M1XCIsIGtpbmQ6IFwiZGF0ZVwiIH0sXG4gICAgICB7IGxhYmVsOiBcIkZvcm11bGFcIiwgaWNvbjogXCJcdTAxOTJcIiwga2luZDogXCJmb3JtdWxhXCIgfSxcbiAgICBdIGFzIGNvbnN0O1xuICAgIG1lbnUuY3JlYXRlRGl2KFwiemliYXNlLW1lbnUtdGl0bGVcIikudGV4dENvbnRlbnQgPSBzY2hlbWEuY29sdW1uc1tjb2xJZHhdPy5uYW1lID8/IFwiQ29sdW1uXCI7XG4gICAgY29uc3QgY29udHJvbGxlciA9IG5ldyBBYm9ydENvbnRyb2xsZXIoKTtcbiAgICBjb25zdCBjbG9zZU1lbnUgPSAoKSA9PiB7XG4gICAgICBtZW51LnJlbW92ZSgpO1xuICAgICAgY29udHJvbGxlci5hYm9ydCgpO1xuICAgIH07XG4gICAgdHlwZXMuZm9yRWFjaCgoeyBsYWJlbCwgaWNvbiwga2luZCB9KSA9PiB7XG4gICAgICBjb25zdCBpdGVtID0gbWVudS5jcmVhdGVEaXYoXCJ6aWJhc2UtbWVudS1pdGVtXCIpO1xuICAgICAgaXRlbS5jcmVhdGVTcGFuKHsgdGV4dDogaWNvbiwgY2xzOiBcInppYmFzZS1tZW51LWljb25cIiB9KTtcbiAgICAgIGl0ZW0uY3JlYXRlU3Bhbih7IHRleHQ6IGxhYmVsLCBjbHM6IFwiemliYXNlLW1lbnUtbGFiZWxcIiB9KTtcbiAgICAgIGlmIChzY2hlbWEuY29sdW1uc1tjb2xJZHhdPy50eXBlLmtpbmQgPT09IGtpbmQpIGl0ZW0uY2xhc3NMaXN0LmFkZChcInppYmFzZS1tZW51LWFjdGl2ZVwiKTtcbiAgICAgIGl0ZW0uYWRkRXZlbnRMaXN0ZW5lcihcImNsaWNrXCIsICgpID0+IHtcbiAgICAgICAgY2xvc2VNZW51KCk7XG4gICAgICAgIGlmIChraW5kID09PSBcInNlbGVjdFwiKSB7XG4gICAgICAgICAgY29uc3QgY3VycmVudE9wdHMgPSBzY2hlbWEuY29sdW1uc1tjb2xJZHhdPy50eXBlLmtpbmQgPT09IFwic2VsZWN0XCIgPyBzY2hlbWEuY29sdW1uc1tjb2xJZHhdLnR5cGUub3B0aW9ucyA6IFtdO1xuICAgICAgICAgIG5ldyBTZWxlY3RPcHRpb25zTW9kYWwoXG4gICAgICAgICAgICB0aGlzLmFwcCxcbiAgICAgICAgICAgIHNjaGVtYS5jb2x1bW5zW2NvbElkeF0/Lm5hbWUgPz8gXCJDb2x1bW5cIixcbiAgICAgICAgICAgIGN1cnJlbnRPcHRzLFxuICAgICAgICAgICAgKG9wdHMpID0+IHtcbiAgICAgICAgICAgICAgdm9pZCB0aGlzLndyaXRlQ29sdW1uVHlwZShjb250ZXh0LCBzZWN0aW9uSW5mbywgc2NoZW1hLCBjb2xJZHgsIGBzZWxlY3Q6JHtvcHRzLmpvaW4oXCIsXCIpfWAsIGJhZGdlKTtcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgKS5vcGVuKCk7XG4gICAgICAgIH0gZWxzZSBpZiAoa2luZCA9PT0gXCJmb3JtdWxhXCIpIHtcbiAgICAgICAgICBjb25zdCBjb2xOYW1lID0gc2NoZW1hLmNvbHVtbnNbY29sSWR4XT8ubmFtZTtcbiAgICAgICAgICBjb25zdCBjdXJyZW50RXhwciA9IHNjaGVtYS5jb2x1bW5zW2NvbElkeF0/LnR5cGUua2luZCA9PT0gXCJmb3JtdWxhXCIgPyBzY2hlbWEuY29sdW1uc1tjb2xJZHhdLnR5cGUuZXhwcmVzc2lvbiA6IFwiXCI7XG4gICAgICAgICAgbmV3IEZvcm11bGFJbnB1dE1vZGFsKHRoaXMuYXBwLCBjb2xOYW1lIHx8IFwiQ29sdW1uXCIsIGN1cnJlbnRFeHByLCBzY2hlbWEuY29sdW1ucywgKGV4cHIpID0+IHtcbiAgICAgICAgICAgIHZvaWQgdGhpcy53cml0ZUNvbHVtblR5cGUoY29udGV4dCwgc2VjdGlvbkluZm8sIHNjaGVtYSwgY29sSWR4LCBgZm9ybXVsYToke2V4cHJ9YCwgYmFkZ2UpO1xuICAgICAgICAgIH0pLm9wZW4oKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICB2b2lkIHRoaXMud3JpdGVDb2x1bW5UeXBlKGNvbnRleHQsIHNlY3Rpb25JbmZvLCBzY2hlbWEsIGNvbElkeCwga2luZCwgYmFkZ2UpO1xuICAgICAgICB9XG4gICAgICB9KTtcbiAgICB9KTtcbiAgICBkb2N1bWVudC5ib2R5LmFwcGVuZENoaWxkKG1lbnUpO1xuICAgIHdpbmRvdy5zZXRUaW1lb3V0KCgpID0+IHtcbiAgICAgIGRvY3VtZW50LmFkZEV2ZW50TGlzdGVuZXIoXCJjbGlja1wiLCAoZXYpID0+IHtcbiAgICAgICAgaWYgKCFtZW51LmNvbnRhaW5zKGV2LnRhcmdldCBhcyBOb2RlKSkgY2xvc2VNZW51KCk7XG4gICAgICB9LCB7IHNpZ25hbDogY29udHJvbGxlci5zaWduYWwgfSk7XG4gICAgfSwgMTApO1xuICB9XG5cbiAgYXN5bmMgd3JpdGVDb2x1bW5UeXBlKFxuICAgIGNvbnRleHQ6IE1hcmtkb3duUG9zdFByb2Nlc3NvckNvbnRleHQsXG4gICAgc2VjdGlvbkluZm86IE1hcmtkb3duU2VjdGlvbkluZm9ybWF0aW9uLFxuICAgIHNjaGVtYTogVGFibGVTY2hlbWEsXG4gICAgY29sSWR4OiBudW1iZXIsXG4gICAgdHlwZVN0cjogc3RyaW5nLFxuICAgIGJhZGdlOiBIVE1MRWxlbWVudCxcbiAgKTogUHJvbWlzZTx2b2lkPiB7XG4gICAgY29uc3QgZmlsZSA9IHRoaXMuYXBwLnZhdWx0LmdldEFic3RyYWN0RmlsZUJ5UGF0aChjb250ZXh0LnNvdXJjZVBhdGgpO1xuICAgIGlmICghKGZpbGUgaW5zdGFuY2VvZiBURmlsZSkpIHJldHVybjtcbiAgICBhd2FpdCB0aGlzLmFwcC52YXVsdC5wcm9jZXNzKGZpbGUsIChjb250ZW50KSA9PiB7XG4gICAgICBjb25zdCBhbGxMaW5lcyA9IGNvbnRlbnQuc3BsaXQoXCJcXG5cIik7XG4gICAgICBpZiAoc2NoZW1hLmluZmVycmVkKSB7XG4gICAgICAgIGNvbnN0IGFubm90YXRpb25DZWxscyA9IHNjaGVtYS5jb2x1bW5zLm1hcCgoY29sLCBpKSA9PiB7XG4gICAgICAgICAgaWYgKGkgPT09IGNvbElkeCkgcmV0dXJuIGAgPCEtLSB6aWJhc2U6ICR7dHlwZVN0cn0gLS0+IGA7XG4gICAgICAgICAgaWYgKGNvbC50eXBlLmtpbmQgPT09IFwiZm9ybXVsYVwiKSByZXR1cm4gYCA8IS0tIHppYmFzZTogZm9ybXVsYToke2NvbC50eXBlLmV4cHJlc3Npb259IC0tPiBgO1xuICAgICAgICAgIHJldHVybiBgIDwhLS0gemliYXNlOiAke2NvbC50eXBlLmtpbmR9IC0tPiBgO1xuICAgICAgICB9KTtcbiAgICAgICAgYWxsTGluZXMuc3BsaWNlKHNlY3Rpb25JbmZvLmxpbmVTdGFydCArIDIsIDAsIFwifCBcIiArIGFubm90YXRpb25DZWxscy5qb2luKFwiIHwgXCIpICsgXCIgfFwiKTtcbiAgICAgICAgd2luZG93LnNldFRpbWVvdXQoKCkgPT4ge1xuICAgICAgICAgIGJhZGdlLnRleHRDb250ZW50ID0gXCJhbm5vdGF0ZWRcIjtcbiAgICAgICAgICBiYWRnZS5jbGFzc05hbWUgPSBcInppYmFzZS1hbm5vdGF0ZWQtYmFkZ2VcIjtcbiAgICAgICAgfSwgNTApO1xuICAgICAgfSBlbHNlIGlmIChzY2hlbWEuc2NoZW1hUm93SW5kZXggIT09IG51bGwpIHtcbiAgICAgICAgY29uc3QgY2VsbHMgPSBzcGxpdFJvdyhhbGxMaW5lc1tzZWN0aW9uSW5mby5saW5lU3RhcnQgKyBzY2hlbWEuc2NoZW1hUm93SW5kZXhdKTtcbiAgICAgICAgY2VsbHNbY29sSWR4XSA9IGAgPCEtLSB6aWJhc2U6ICR7dHlwZVN0cn0gLS0+IGA7XG4gICAgICAgIGFsbExpbmVzW3NlY3Rpb25JbmZvLmxpbmVTdGFydCArIHNjaGVtYS5zY2hlbWFSb3dJbmRleF0gPSBzZXJpYWxpemVSb3coY2VsbHMpO1xuICAgICAgfVxuICAgICAgcmV0dXJuIGFsbExpbmVzLmpvaW4oXCJcXG5cIik7XG4gICAgfSk7XG4gIH1cblxuICByZW5kZXJDZWxsKFxuICAgIHRkOiBIVE1MVGFibGVDZWxsRWxlbWVudCxcbiAgICBjb2w6IENvbHVtbixcbiAgICByYXdWYWx1ZTogc3RyaW5nLFxuICAgIGNvbnRleHQ6IE1hcmtkb3duUG9zdFByb2Nlc3NvckNvbnRleHQsXG4gICAgc2NoZW1hOiBUYWJsZVNjaGVtYSxcbiAgICByb3dDZWxsczogc3RyaW5nW10sXG4gICAgb25DaGFuZ2U6IENlbGxDaGFuZ2VIYW5kbGVyLFxuICApOiB2b2lkIHtcbiAgICByZW5kZXJDZWxsKHRoaXMsIHRkLCBjb2wsIHJhd1ZhbHVlLCBjb250ZXh0LCBzY2hlbWEsIHJvd0NlbGxzLCBvbkNoYW5nZSk7XG4gIH1cblxuICBhc3luYyB3cml0ZUJhY2soXG4gICAgY29udGV4dDogTWFya2Rvd25Qb3N0UHJvY2Vzc29yQ29udGV4dCxcbiAgICBzZWN0aW9uSW5mbzogTWFya2Rvd25TZWN0aW9uSW5mb3JtYXRpb24sXG4gICAgdGFibGVSb3dJbmRleDogbnVtYmVyLFxuICAgIGNvbEluZGV4OiBudW1iZXIsXG4gICAgbmV3VmFsdWU6IHN0cmluZyxcbiAgKTogUHJvbWlzZTx2b2lkPiB7XG4gICAgY29uc3QgZmlsZSA9IHRoaXMuYXBwLnZhdWx0LmdldEFic3RyYWN0RmlsZUJ5UGF0aChjb250ZXh0LnNvdXJjZVBhdGgpO1xuICAgIGlmICghKGZpbGUgaW5zdGFuY2VvZiBURmlsZSkpIHJldHVybjtcbiAgICBhd2FpdCB0aGlzLmFwcC52YXVsdC5wcm9jZXNzKGZpbGUsIChjb250ZW50KSA9PiB7XG4gICAgICBjb25zdCBhbGxMaW5lcyA9IGNvbnRlbnQuc3BsaXQoXCJcXG5cIik7XG4gICAgICBjb25zdCBmaWxlTGluZUluZGV4ID0gc2VjdGlvbkluZm8ubGluZVN0YXJ0ICsgdGFibGVSb3dJbmRleDtcbiAgICAgIGNvbnN0IHRhcmdldExpbmUgPSBhbGxMaW5lc1tmaWxlTGluZUluZGV4XTtcbiAgICAgIGlmICghdGFyZ2V0TGluZSkgcmV0dXJuIGNvbnRlbnQ7XG4gICAgICBjb25zdCBjZWxscyA9IHNwbGl0Um93KHRhcmdldExpbmUpO1xuICAgICAgY2VsbHNbY29sSW5kZXhdID0gYCAke25ld1ZhbHVlfSBgO1xuICAgICAgYWxsTGluZXNbZmlsZUxpbmVJbmRleF0gPSBzZXJpYWxpemVSb3coY2VsbHMpO1xuICAgICAgcmV0dXJuIGFsbExpbmVzLmpvaW4oXCJcXG5cIik7XG4gICAgfSk7XG4gIH1cblxuICBhc3luYyBhZGRSb3coXG4gICAgY29udGV4dDogTWFya2Rvd25Qb3N0UHJvY2Vzc29yQ29udGV4dCxcbiAgICBzZWN0aW9uSW5mbzogTWFya2Rvd25TZWN0aW9uSW5mb3JtYXRpb24sXG4gICAgc2NoZW1hOiBUYWJsZVNjaGVtYSxcbiAgKTogUHJvbWlzZTx2b2lkPiB7XG4gICAgY29uc3QgZmlsZSA9IHRoaXMuYXBwLnZhdWx0LmdldEFic3RyYWN0RmlsZUJ5UGF0aChjb250ZXh0LnNvdXJjZVBhdGgpO1xuICAgIGlmICghKGZpbGUgaW5zdGFuY2VvZiBURmlsZSkpIHJldHVybjtcbiAgICBhd2FpdCB0aGlzLmFwcC52YXVsdC5wcm9jZXNzKGZpbGUsIChjb250ZW50KSA9PiB7XG4gICAgICBjb25zdCBhbGxMaW5lcyA9IGNvbnRlbnQuc3BsaXQoXCJcXG5cIik7XG4gICAgICBhbGxMaW5lcy5zcGxpY2Uoc2VjdGlvbkluZm8ubGluZUVuZCArIDEsIDAsIHNlcmlhbGl6ZVJvdyhzY2hlbWEuY29sdW1ucy5tYXAoKCkgPT4gXCIgICBcIikpKTtcbiAgICAgIHJldHVybiBhbGxMaW5lcy5qb2luKFwiXFxuXCIpO1xuICAgIH0pO1xuICB9XG5cbiAgYXN5bmMgcmVyZW5kZXJUZXh0Q2VsbCh0ZDogSFRNTEVsZW1lbnQsIG5ld1Jhdzogc3RyaW5nLCBjb250ZXh0OiBNYXJrZG93blBvc3RQcm9jZXNzb3JDb250ZXh0KTogUHJvbWlzZTx2b2lkPiB7XG4gICAgdGQuZGF0YXNldC5yYXcgPSBuZXdSYXc7XG4gICAgY29uc3QgZGlzcGxheVNwYW4gPSB0ZC5xdWVyeVNlbGVjdG9yKFwiLnppYmFzZS10ZXh0LXJlbmRlcmVkXCIpO1xuICAgIGlmICghZGlzcGxheVNwYW4pIHJldHVybjtcbiAgICBkaXNwbGF5U3Bhbi5lbXB0eSgpO1xuICAgIGlmIChuZXdSYXcpIHtcbiAgICAgIGF3YWl0IE1hcmtkb3duUmVuZGVyZXIucmVuZGVyKHRoaXMuYXBwLCBuZXdSYXcsIGRpc3BsYXlTcGFuIGFzIEhUTUxFbGVtZW50LCBjb250ZXh0LnNvdXJjZVBhdGgsIG5ldyBDb21wb25lbnQoKSk7XG4gICAgICB3aW5kb3cuc2V0VGltZW91dCgoKSA9PiB7XG4gICAgICAgIGRpc3BsYXlTcGFuLnF1ZXJ5U2VsZWN0b3JBbGwoXCJhXCIpLmZvckVhY2goKGEpID0+IGF0dGFjaExpbmtUb29sdGlwKGEpKTtcbiAgICAgIH0sIDUwKTtcbiAgICAgIGRpc3BsYXlTcGFuLmNsYXNzTGlzdC5yZW1vdmUoXCJ6aWJhc2UtdGV4dC1lbXB0eVwiKTtcbiAgICB9IGVsc2Uge1xuICAgICAgZGlzcGxheVNwYW4udGV4dENvbnRlbnQgPSBcIlx1MjAxNFwiO1xuICAgICAgZGlzcGxheVNwYW4uY2xhc3NMaXN0LmFkZChcInppYmFzZS10ZXh0LWVtcHR5XCIpO1xuICAgIH1cbiAgfVxufVxuIiwgImltcG9ydCB7IENvbXBvbmVudCwgTWFya2Rvd25SZW5kZXJlciwgdHlwZSBNYXJrZG93blBvc3RQcm9jZXNzb3JDb250ZXh0IH0gZnJvbSBcIm9ic2lkaWFuXCI7XG5pbXBvcnQge1xuICBldmFsdWF0ZUZvcm11bGEsXG4gIGV2YWx1YXRlU2ltcGxlTWF0aCxcbiAgZm9ybWF0UmVzdWx0LFxuICBpc0JhY2t0aWNrZWQsXG4gIGlzU2ltcGxlTWF0aCxcbiAgc3RyaXBCYWNrdGlja3MsXG59IGZyb20gXCIuL2Zvcm11bGFcIjtcbmltcG9ydCB7IHBhcnNlQm9vbCwgcGFyc2VNdWx0aVNlbGVjdCwgc2VyaWFsaXplQm9vbCB9IGZyb20gXCIuL3NjaGVtYVwiO1xuaW1wb3J0IHR5cGUgeyBDZWxsQ2hhbmdlSGFuZGxlciwgQ29sdW1uLCBUYWJsZVNjaGVtYSwgWmlCYXNlSG9zdCB9IGZyb20gXCIuL3R5cGVzXCI7XG5pbXBvcnQgeyBhdHRhY2hMaW5rVG9vbHRpcCwgZ2V0TGFiZWxDb2xvciwgc3RhcnRMYWJlbEVkaXQgfSBmcm9tIFwiLi91aVwiO1xuXG5leHBvcnQgZnVuY3Rpb24gc3RhcnRNYXJrZG93bkVkaXQoXG4gIHRkOiBIVE1MRWxlbWVudCxcbiAgcmF3VmFsdWU6IHN0cmluZyxcbiAgY29udGV4dDogTWFya2Rvd25Qb3N0UHJvY2Vzc29yQ29udGV4dCxcbiAgaG9zdDogWmlCYXNlSG9zdCxcbiAgb25DaGFuZ2U6IENlbGxDaGFuZ2VIYW5kbGVyLFxuKTogdm9pZCB7XG4gIGlmICh0ZC5xdWVyeVNlbGVjdG9yKFwiLnppYmFzZS1pbmxpbmUtaW5wdXRcIikpIHJldHVybjtcbiAgY29uc3QgZGlzcGxheVNwYW4gPSB0ZC5xdWVyeVNlbGVjdG9yPEhUTUxFbGVtZW50PihcIi56aWJhc2UtdGV4dC1yZW5kZXJlZFwiKTtcbiAgaWYgKGRpc3BsYXlTcGFuKSBkaXNwbGF5U3Bhbi5zZXRDc3NTdHlsZXMoeyBkaXNwbGF5OiBcIm5vbmVcIiB9KTtcbiAgY29uc3QgaW5wdXQgPSBjcmVhdGVFbChcImlucHV0XCIpO1xuICBpbnB1dC5jbGFzc05hbWUgPSBcInppYmFzZS1pbmxpbmUtaW5wdXRcIjtcbiAgaW5wdXQudmFsdWUgPSByYXdWYWx1ZTtcbiAgdGQuYXBwZW5kQ2hpbGQoaW5wdXQpO1xuICBpbnB1dC5mb2N1cygpO1xuICBpbnB1dC5zZWxlY3QoKTtcbiAgY29uc3QgY29tbWl0ID0gYXN5bmMgKCkgPT4ge1xuICAgIGNvbnN0IG5ld1ZhbCA9IGlucHV0LnZhbHVlO1xuICAgIGlucHV0LnJlbW92ZSgpO1xuICAgIGlmIChkaXNwbGF5U3BhbikgZGlzcGxheVNwYW4uc2V0Q3NzU3R5bGVzKHsgZGlzcGxheTogXCJcIiB9KTtcbiAgICBhd2FpdCBvbkNoYW5nZShuZXdWYWwpO1xuICAgIGF3YWl0IGhvc3QucmVyZW5kZXJUZXh0Q2VsbCh0ZCwgbmV3VmFsLCBjb250ZXh0KTtcbiAgfTtcbiAgaW5wdXQuYWRkRXZlbnRMaXN0ZW5lcihcImJsdXJcIiwgKCkgPT4geyB2b2lkIGNvbW1pdCgpOyB9KTtcbiAgaW5wdXQuYWRkRXZlbnRMaXN0ZW5lcihcImtleWRvd25cIiwgKGU6IEtleWJvYXJkRXZlbnQpID0+IHtcbiAgICBpZiAoZS5rZXkgPT09IFwiRW50ZXJcIikge1xuICAgICAgZS5wcmV2ZW50RGVmYXVsdCgpO1xuICAgICAgdm9pZCBjb21taXQoKTtcbiAgICB9XG4gICAgaWYgKGUua2V5ID09PSBcIkVzY2FwZVwiKSB7XG4gICAgICBpbnB1dC5yZW1vdmUoKTtcbiAgICAgIGlmIChkaXNwbGF5U3BhbikgZGlzcGxheVNwYW4uc2V0Q3NzU3R5bGVzKHsgZGlzcGxheTogXCJcIiB9KTtcbiAgICB9XG4gIH0pO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gcmVuZGVyQ2VsbChcbiAgaG9zdDogWmlCYXNlSG9zdCxcbiAgdGQ6IEhUTUxUYWJsZUNlbGxFbGVtZW50LFxuICBjb2w6IENvbHVtbixcbiAgcmF3VmFsdWU6IHN0cmluZyxcbiAgY29udGV4dDogTWFya2Rvd25Qb3N0UHJvY2Vzc29yQ29udGV4dCxcbiAgc2NoZW1hOiBUYWJsZVNjaGVtYSxcbiAgcm93Q2VsbHM6IHN0cmluZ1tdLFxuICBvbkNoYW5nZTogQ2VsbENoYW5nZUhhbmRsZXIsXG4pOiB2b2lkIHtcbiAgc3dpdGNoIChjb2wudHlwZS5raW5kKSB7XG4gICAgY2FzZSBcInRvZ2dsZVwiOiB7XG4gICAgICBjb25zdCBjaGVja2VkID0gcGFyc2VCb29sKHJhd1ZhbHVlKTtcbiAgICAgIGNvbnN0IGxhYmVsID0gdGQuY3JlYXRlRWwoXCJsYWJlbFwiLCB7IGNsczogXCJ6aWJhc2UtdG9nZ2xlLWxhYmVsXCIgfSk7XG4gICAgICBjb25zdCBpbnB1dCA9IGxhYmVsLmNyZWF0ZUVsKFwiaW5wdXRcIiwgeyB0eXBlOiBcImNoZWNrYm94XCIgfSk7XG4gICAgICBpbnB1dC5jaGVja2VkID0gY2hlY2tlZDtcbiAgICAgIGlucHV0LmNsYXNzTmFtZSA9IFwiemliYXNlLXRvZ2dsZS1pbnB1dFwiO1xuICAgICAgbGFiZWwuY3JlYXRlRGl2KFwiemliYXNlLXRvZ2dsZS10cmFja1wiKS5jcmVhdGVEaXYoXCJ6aWJhc2UtdG9nZ2xlLXRodW1iXCIpO1xuICAgICAgaW5wdXQuYWRkRXZlbnRMaXN0ZW5lcihcImNoYW5nZVwiLCAoKSA9PiB7XG4gICAgICAgIHZvaWQgb25DaGFuZ2Uoc2VyaWFsaXplQm9vbChpbnB1dC5jaGVja2VkKSk7XG4gICAgICB9KTtcbiAgICAgIGJyZWFrO1xuICAgIH1cbiAgICBjYXNlIFwic2VsZWN0XCI6IHtcbiAgICAgIGNvbnN0IHNlbGVjdCA9IHRkLmNyZWF0ZUVsKFwic2VsZWN0XCIsIHsgY2xzOiBcInppYmFzZS1zZWxlY3RcIiB9KTtcbiAgICAgIHNlbGVjdC5jcmVhdGVFbChcIm9wdGlvblwiLCB7IHZhbHVlOiBcIlwiLCB0ZXh0OiBcIlx1MjAxNFwiIH0pO1xuICAgICAgY29sLnR5cGUub3B0aW9ucy5mb3JFYWNoKChvcHQpID0+IHtcbiAgICAgICAgY29uc3QgbyA9IHNlbGVjdC5jcmVhdGVFbChcIm9wdGlvblwiLCB7IHRleHQ6IG9wdCwgdmFsdWU6IG9wdCB9KTtcbiAgICAgICAgaWYgKG9wdCA9PT0gcmF3VmFsdWUudHJpbSgpKSBvLnNlbGVjdGVkID0gdHJ1ZTtcbiAgICAgIH0pO1xuICAgICAgaWYgKCFyYXdWYWx1ZS50cmltKCkpIHNlbGVjdC5vcHRpb25zWzBdLnNlbGVjdGVkID0gdHJ1ZTtcbiAgICAgIHNlbGVjdC5hZGRFdmVudExpc3RlbmVyKFwiY2hhbmdlXCIsICgpID0+IHtcbiAgICAgICAgdm9pZCBvbkNoYW5nZShzZWxlY3QudmFsdWUpO1xuICAgICAgfSk7XG4gICAgICBicmVhaztcbiAgICB9XG4gICAgY2FzZSBcIm11bHRpLXNlbGVjdFwiOiB7XG4gICAgICBjb25zdCB3cmFwID0gdGQuY3JlYXRlRGl2KFwiemliYXNlLW11bHRpLXNlbGVjdC13cmFwXCIpO1xuICAgICAgY29uc3QgdGFncyA9IHBhcnNlTXVsdGlTZWxlY3QocmF3VmFsdWUpO1xuICAgICAgaWYgKHRhZ3MubGVuZ3RoID09PSAwKSB7XG4gICAgICAgIGNvbnN0IGVtcHR5ID0gd3JhcC5jcmVhdGVTcGFuKHsgdGV4dDogXCJcdTIwMTRcIiwgY2xzOiBcInppYmFzZS10ZXh0LWVtcHR5XCIgfSk7XG4gICAgICAgIGVtcHR5LmFkZEV2ZW50TGlzdGVuZXIoXCJjbGlja1wiLCAoKSA9PiBzdGFydExhYmVsRWRpdCh3cmFwLCByYXdWYWx1ZSwgb25DaGFuZ2UpKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHRhZ3MuZm9yRWFjaCgodGFnKSA9PiB7XG4gICAgICAgICAgY29uc3QgY2hpcCA9IHdyYXAuY3JlYXRlU3Bhbih7IHRleHQ6IHRhZywgY2xzOiBcInppYmFzZS1sYWJlbFwiIH0pO1xuICAgICAgICAgIGNoaXAuc2V0Q3NzUHJvcHMoeyBcIi0tbGNcIjogZ2V0TGFiZWxDb2xvcih0YWcpIH0pO1xuICAgICAgICAgIGNoaXAuYWRkRXZlbnRMaXN0ZW5lcihcImNsaWNrXCIsIChlKSA9PiB7XG4gICAgICAgICAgICBlLnN0b3BQcm9wYWdhdGlvbigpO1xuICAgICAgICAgICAgc3RhcnRMYWJlbEVkaXQod3JhcCwgcmF3VmFsdWUsIG9uQ2hhbmdlKTtcbiAgICAgICAgICB9KTtcbiAgICAgICAgfSk7XG4gICAgICAgIHdyYXAuYWRkRXZlbnRMaXN0ZW5lcihcImNsaWNrXCIsICgpID0+IHN0YXJ0TGFiZWxFZGl0KHdyYXAsIHJhd1ZhbHVlLCBvbkNoYW5nZSkpO1xuICAgICAgfVxuICAgICAgYnJlYWs7XG4gICAgfVxuICAgIGNhc2UgXCJsYWJlbFwiOiB7XG4gICAgICBjb25zdCBjaGlwID0gdGQuY3JlYXRlU3Bhbih7IHRleHQ6IHJhd1ZhbHVlLnRyaW0oKSB8fCBcIlx1MjAxNFwiLCBjbHM6IFwiemliYXNlLWxhYmVsXCIgfSk7XG4gICAgICBjaGlwLnNldENzc1Byb3BzKHsgXCItLWxjXCI6IGdldExhYmVsQ29sb3IocmF3VmFsdWUudHJpbSgpKSB9KTtcbiAgICAgIGNoaXAuYWRkRXZlbnRMaXN0ZW5lcihcImNsaWNrXCIsICgpID0+IHN0YXJ0TGFiZWxFZGl0KGNoaXAsIHJhd1ZhbHVlLnRyaW0oKSwgb25DaGFuZ2UpKTtcbiAgICAgIGJyZWFrO1xuICAgIH1cbiAgICBjYXNlIFwibnVtYmVyXCI6IHtcbiAgICAgIGNvbnN0IGlucHV0ID0gdGQuY3JlYXRlRWwoXCJpbnB1dFwiLCB7IHR5cGU6IFwibnVtYmVyXCIsIGNsczogXCJ6aWJhc2UtbnVtYmVyXCIgfSk7XG4gICAgICBpbnB1dC52YWx1ZSA9IHJhd1ZhbHVlLnRyaW0oKTtcbiAgICAgIGxldCBkZWJvdW5jZSA9IDA7XG4gICAgICBpbnB1dC5hZGRFdmVudExpc3RlbmVyKFwiaW5wdXRcIiwgKCkgPT4ge1xuICAgICAgICB3aW5kb3cuY2xlYXJUaW1lb3V0KGRlYm91bmNlKTtcbiAgICAgICAgZGVib3VuY2UgPSB3aW5kb3cuc2V0VGltZW91dCgoKSA9PiB7XG4gICAgICAgICAgdm9pZCBvbkNoYW5nZShpbnB1dC52YWx1ZSk7XG4gICAgICAgIH0sIDQwMCk7XG4gICAgICB9KTtcbiAgICAgIGJyZWFrO1xuICAgIH1cbiAgICBjYXNlIFwiZGF0ZVwiOiB7XG4gICAgICBjb25zdCB2YWwgPSByYXdWYWx1ZS50cmltKCk7XG4gICAgICBjb25zdCBkaXNwbGF5U3BhbiA9IHRkLmNyZWF0ZVNwYW4oeyB0ZXh0OiB2YWwgfHwgXCJcdTIwMTRcIiwgY2xzOiB2YWwgPyBcInppYmFzZS1kYXRlLXJlbmRlcmVkXCIgOiBcInppYmFzZS10ZXh0LWVtcHR5XCIgfSk7XG4gICAgICB0ZC5hZGRFdmVudExpc3RlbmVyKFwiY2xpY2tcIiwgKCkgPT4ge1xuICAgICAgICBpZiAodGQucXVlcnlTZWxlY3RvcihcImlucHV0XCIpKSByZXR1cm47XG4gICAgICAgIGRpc3BsYXlTcGFuLnNldENzc1N0eWxlcyh7IGRpc3BsYXk6IFwibm9uZVwiIH0pO1xuICAgICAgICBjb25zdCBpbnB1dCA9IHRkLmNyZWF0ZUVsKFwiaW5wdXRcIiwgeyB0eXBlOiBcImRhdGVcIiwgY2xzOiBcInppYmFzZS1kYXRlXCIgfSk7XG4gICAgICAgIGlucHV0LnZhbHVlID0gdmFsO1xuICAgICAgICBpbnB1dC5mb2N1cygpO1xuICAgICAgICBjb25zdCBwaWNrZXIgPSBpbnB1dCBhcyBIVE1MSW5wdXRFbGVtZW50ICYgeyBzaG93UGlja2VyPzogKCkgPT4gdm9pZCB9O1xuICAgICAgICBpZiAodHlwZW9mIHBpY2tlci5zaG93UGlja2VyID09PSBcImZ1bmN0aW9uXCIpIHtcbiAgICAgICAgICB0cnkgeyBwaWNrZXIuc2hvd1BpY2tlcigpOyB9IGNhdGNoIHsgLyogaWdub3JlZCAqLyB9XG4gICAgICAgIH1cbiAgICAgICAgY29uc3QgY29tbWl0ID0gYXN5bmMgKCkgPT4ge1xuICAgICAgICAgIGNvbnN0IG5ld1ZhbCA9IGlucHV0LnZhbHVlO1xuICAgICAgICAgIGlucHV0LnJlbW92ZSgpO1xuICAgICAgICAgIGRpc3BsYXlTcGFuLnRleHRDb250ZW50ID0gbmV3VmFsIHx8IFwiXHUyMDE0XCI7XG4gICAgICAgICAgZGlzcGxheVNwYW4uY2xhc3NOYW1lID0gbmV3VmFsID8gXCJ6aWJhc2UtZGF0ZS1yZW5kZXJlZFwiIDogXCJ6aWJhc2UtdGV4dC1lbXB0eVwiO1xuICAgICAgICAgIGRpc3BsYXlTcGFuLnNldENzc1N0eWxlcyh7IGRpc3BsYXk6IFwiXCIgfSk7XG4gICAgICAgICAgYXdhaXQgb25DaGFuZ2UobmV3VmFsKTtcbiAgICAgICAgfTtcbiAgICAgICAgaW5wdXQuYWRkRXZlbnRMaXN0ZW5lcihcImJsdXJcIiwgKCkgPT4geyB2b2lkIGNvbW1pdCgpOyB9KTtcbiAgICAgICAgaW5wdXQuYWRkRXZlbnRMaXN0ZW5lcihcImtleWRvd25cIiwgKGUpID0+IHtcbiAgICAgICAgICBpZiAoZS5rZXkgPT09IFwiRW50ZXJcIikgdm9pZCBjb21taXQoKTtcbiAgICAgICAgICBpZiAoZS5rZXkgPT09IFwiRXNjYXBlXCIpIHtcbiAgICAgICAgICAgIGlucHV0LnJlbW92ZSgpO1xuICAgICAgICAgICAgZGlzcGxheVNwYW4uc2V0Q3NzU3R5bGVzKHsgZGlzcGxheTogXCJcIiB9KTtcbiAgICAgICAgICB9XG4gICAgICAgIH0pO1xuICAgICAgfSk7XG4gICAgICBicmVhaztcbiAgICB9XG4gICAgY2FzZSBcImZvcm11bGFcIjoge1xuICAgICAgY29uc3QgdmFsID0gcmF3VmFsdWUudHJpbSgpO1xuICAgICAgaWYgKGlzQmFja3RpY2tlZCh2YWwpKSB7XG4gICAgICAgIHRkLmNyZWF0ZVNwYW4oeyB0ZXh0OiBzdHJpcEJhY2t0aWNrcyh2YWwpLCBjbHM6IFwiemliYXNlLWZvcm11bGEtc291cmNlXCIgfSk7XG4gICAgICAgIGJyZWFrO1xuICAgICAgfVxuICAgICAgaWYgKGlzU2ltcGxlTWF0aCh2YWwpKSB7XG4gICAgICAgIGNvbnN0IHJlc3VsdCA9IGV2YWx1YXRlU2ltcGxlTWF0aCh2YWwpO1xuICAgICAgICBjb25zdCBzcGFuID0gdGQuY3JlYXRlU3Bhbih7IHRleHQ6IGZvcm1hdFJlc3VsdChyZXN1bHQpLCBjbHM6IFwiemliYXNlLWZvcm11bGEtcmVzdWx0XCIgfSk7XG4gICAgICAgIHNwYW4udGl0bGUgPSB2YWw7XG4gICAgICAgIGJyZWFrO1xuICAgICAgfVxuICAgICAgaWYgKGNvbC50eXBlLmV4cHJlc3Npb24pIHtcbiAgICAgICAgY29uc3Qgcm93RGF0YTogUmVjb3JkPHN0cmluZywgc3RyaW5nPiA9IHt9O1xuICAgICAgICBzY2hlbWEuY29sdW1ucy5mb3JFYWNoKChjLCBpKSA9PiB7XG4gICAgICAgICAgcm93RGF0YVtjLm5hbWVdID0gKHJvd0NlbGxzW2ldID8/IFwiXCIpLnRyaW0oKTtcbiAgICAgICAgfSk7XG4gICAgICAgIGNvbnN0IHJlc3VsdCA9IGV2YWx1YXRlRm9ybXVsYShjb2wudHlwZS5leHByZXNzaW9uLCByb3dEYXRhKTtcbiAgICAgICAgY29uc3QgZGlzcGxheVZhbCA9IGZvcm1hdFJlc3VsdChyZXN1bHQpO1xuICAgICAgICBjb25zdCBzcGFuID0gdGQuY3JlYXRlU3Bhbih7IHRleHQ6IGRpc3BsYXlWYWwsIGNsczogXCJ6aWJhc2UtZm9ybXVsYS1yZXN1bHRcIiB9KTtcbiAgICAgICAgc3Bhbi50aXRsZSA9IGBcdTAxOTIgJHtjb2wudHlwZS5leHByZXNzaW9ufSA9ICR7ZGlzcGxheVZhbH1gO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgdGQuY3JlYXRlU3Bhbih7IHRleHQ6IHZhbCB8fCBcIlx1MDE5MlwiLCBjbHM6IFwiemliYXNlLWZvcm11bGEtZW1wdHlcIiB9KTtcbiAgICAgIH1cbiAgICAgIGJyZWFrO1xuICAgIH1cbiAgICBkZWZhdWx0OiB7XG4gICAgICBjb25zdCB2YWwgPSByYXdWYWx1ZS50cmltKCk7XG4gICAgICB0ZC5kYXRhc2V0LnJhdyA9IHZhbDtcblxuICAgICAgaWYgKGlzU2ltcGxlTWF0aCh2YWwpKSB7XG4gICAgICAgIGNvbnN0IHJlc3VsdCA9IGV2YWx1YXRlU2ltcGxlTWF0aCh2YWwpO1xuICAgICAgICBjb25zdCBzcGFuID0gdGQuY3JlYXRlU3Bhbih7IHRleHQ6IGZvcm1hdFJlc3VsdChyZXN1bHQpLCBjbHM6IFwiemliYXNlLWZvcm11bGEtcmVzdWx0IHppYmFzZS10ZXh0LXJlbmRlcmVkXCIgfSk7XG4gICAgICAgIHNwYW4udGl0bGUgPSB2YWw7XG4gICAgICAgIHRkLmFkZEV2ZW50TGlzdGVuZXIoXCJjbGlja1wiLCAoZSkgPT4ge1xuICAgICAgICAgIGUucHJldmVudERlZmF1bHQoKTtcbiAgICAgICAgICBlLnN0b3BQcm9wYWdhdGlvbigpO1xuICAgICAgICAgIHN0YXJ0TWFya2Rvd25FZGl0KHRkLCB0ZC5kYXRhc2V0LnJhdyB8fCB2YWwsIGNvbnRleHQsIGhvc3QsIG9uQ2hhbmdlKTtcbiAgICAgICAgfSk7XG4gICAgICAgIGJyZWFrO1xuICAgICAgfVxuXG4gICAgICBpZiAoaXNCYWNrdGlja2VkKHZhbCkpIHtcbiAgICAgICAgdGQuY3JlYXRlU3Bhbih7IHRleHQ6IHN0cmlwQmFja3RpY2tzKHZhbCksIGNsczogXCJ6aWJhc2UtZm9ybXVsYS1zb3VyY2UgemliYXNlLXRleHQtcmVuZGVyZWRcIiB9KTtcbiAgICAgICAgdGQuYWRkRXZlbnRMaXN0ZW5lcihcImNsaWNrXCIsIChlKSA9PiB7XG4gICAgICAgICAgZS5wcmV2ZW50RGVmYXVsdCgpO1xuICAgICAgICAgIGUuc3RvcFByb3BhZ2F0aW9uKCk7XG4gICAgICAgICAgc3RhcnRNYXJrZG93bkVkaXQodGQsIHRkLmRhdGFzZXQucmF3IHx8IHZhbCwgY29udGV4dCwgaG9zdCwgb25DaGFuZ2UpO1xuICAgICAgICB9KTtcbiAgICAgICAgYnJlYWs7XG4gICAgICB9XG5cbiAgICAgIGNvbnN0IGRpc3BsYXlTcGFuID0gdGQuY3JlYXRlU3Bhbih7IGNsczogXCJ6aWJhc2UtdGV4dC1yZW5kZXJlZFwiIH0pO1xuICAgICAgaWYgKHZhbCkge1xuICAgICAgICB2b2lkIE1hcmtkb3duUmVuZGVyZXIucmVuZGVyKGhvc3QuYXBwLCB2YWwsIGRpc3BsYXlTcGFuLCBjb250ZXh0LnNvdXJjZVBhdGgsIG5ldyBDb21wb25lbnQoKSkudGhlbigoKSA9PiB7XG4gICAgICAgICAgZGlzcGxheVNwYW4ucXVlcnlTZWxlY3RvckFsbChcImFcIikuZm9yRWFjaCgoYSkgPT4gYXR0YWNoTGlua1Rvb2x0aXAoYSkpO1xuICAgICAgICAgIHRkLmFkZEV2ZW50TGlzdGVuZXIoXCJjbGlja1wiLCAoZSkgPT4ge1xuICAgICAgICAgICAgaWYgKGUuYWx0S2V5KSB7XG4gICAgICAgICAgICAgIGUucHJldmVudERlZmF1bHQoKTtcbiAgICAgICAgICAgICAgZS5zdG9wUHJvcGFnYXRpb24oKTtcbiAgICAgICAgICAgICAgc3RhcnRNYXJrZG93bkVkaXQodGQsIHRkLmRhdGFzZXQucmF3IHx8IHZhbCwgY29udGV4dCwgaG9zdCwgb25DaGFuZ2UpO1xuICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBjb25zdCB0YXJnZXQgPSBlLnRhcmdldCBhcyBIVE1MRWxlbWVudCB8IG51bGw7XG4gICAgICAgICAgICBpZiAodGFyZ2V0Py5jbG9zZXN0Py4oXCJhXCIpKSByZXR1cm47XG4gICAgICAgICAgICBlLnByZXZlbnREZWZhdWx0KCk7XG4gICAgICAgICAgICBlLnN0b3BQcm9wYWdhdGlvbigpO1xuICAgICAgICAgICAgc3RhcnRNYXJrZG93bkVkaXQodGQsIHRkLmRhdGFzZXQucmF3IHx8IHZhbCwgY29udGV4dCwgaG9zdCwgb25DaGFuZ2UpO1xuICAgICAgICAgIH0sIHRydWUpO1xuICAgICAgICB9KTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGRpc3BsYXlTcGFuLnRleHRDb250ZW50ID0gXCJcdTIwMTRcIjtcbiAgICAgICAgZGlzcGxheVNwYW4uY2xhc3NMaXN0LmFkZChcInppYmFzZS10ZXh0LWVtcHR5XCIpO1xuICAgICAgICB0ZC5hZGRFdmVudExpc3RlbmVyKFwiY2xpY2tcIiwgKGUpID0+IHtcbiAgICAgICAgICBlLnByZXZlbnREZWZhdWx0KCk7XG4gICAgICAgICAgZS5zdG9wUHJvcGFnYXRpb24oKTtcbiAgICAgICAgICBzdGFydE1hcmtkb3duRWRpdCh0ZCwgdGQuZGF0YXNldC5yYXcgPz8gdmFsLCBjb250ZXh0LCBob3N0LCBvbkNoYW5nZSk7XG4gICAgICAgIH0pO1xuICAgICAgfVxuICAgICAgYnJlYWs7XG4gICAgfVxuICB9XG59XG4iLCAiY29uc3QgRk9STVVMQV9OVU1CRVJfUkUgPSAvXi0/XFxkKyhcXC5cXGQrKT8kLztcblxuZXhwb3J0IGZ1bmN0aW9uIGlzQmFja3RpY2tlZChyYXc6IHN0cmluZyk6IGJvb2xlYW4ge1xuICBjb25zdCB0cmltbWVkID0gcmF3LnRyaW0oKTtcbiAgcmV0dXJuIHRyaW1tZWQuc3RhcnRzV2l0aChcImBcIikgJiYgdHJpbW1lZC5lbmRzV2l0aChcImBcIikgJiYgdHJpbW1lZC5sZW5ndGggPj0gMjtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIHN0cmlwQmFja3RpY2tzKHJhdzogc3RyaW5nKTogc3RyaW5nIHtcbiAgY29uc3QgdHJpbW1lZCA9IHJhdy50cmltKCk7XG4gIHJldHVybiB0cmltbWVkLnNsaWNlKDEsIC0xKTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGlzU2ltcGxlTWF0aChyYXc6IHN0cmluZyk6IGJvb2xlYW4ge1xuICBjb25zdCB0cmltbWVkID0gcmF3LnRyaW0oKTtcbiAgaWYgKCF0cmltbWVkKSByZXR1cm4gZmFsc2U7XG4gIGlmIChGT1JNVUxBX05VTUJFUl9SRS50ZXN0KHRyaW1tZWQpKSByZXR1cm4gZmFsc2U7XG4gIGlmICghL15bXFxkXFxzK1xcLSovJSgpLl0rJC8udGVzdCh0cmltbWVkKSkgcmV0dXJuIGZhbHNlO1xuICBpZiAoIS9bK1xcLSovJV0vLnRlc3QodHJpbW1lZCkpIHJldHVybiBmYWxzZTtcbiAgaWYgKC9eWysqLyVdLy50ZXN0KHRyaW1tZWQpKSByZXR1cm4gZmFsc2U7XG4gIHJldHVybiB0cnVlO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gZXZhbHVhdGVGb3JtdWxhKGV4cHJlc3Npb246IHN0cmluZywgcm93RGF0YTogUmVjb3JkPHN0cmluZywgc3RyaW5nPik6IG51bWJlciB8IG51bGwge1xuICBpZiAoIWV4cHJlc3Npb24gfHwgIWV4cHJlc3Npb24udHJpbSgpKSByZXR1cm4gbnVsbDtcblxuICBsZXQgcmVzb2x2ZWQgPSBleHByZXNzaW9uO1xuICBjb25zdCBjb2xOYW1lcyA9IE9iamVjdC5rZXlzKHJvd0RhdGEpLnNvcnQoKGEsIGIpID0+IGIubGVuZ3RoIC0gYS5sZW5ndGgpO1xuXG4gIGZvciAoY29uc3QgY29sTmFtZSBvZiBjb2xOYW1lcykge1xuICAgIGNvbnN0IHJlZ2V4ID0gbmV3IFJlZ0V4cChcIlxcXFxiXCIgKyBlc2NhcGVSZWdleChjb2xOYW1lKSArIFwiXFxcXGJcIiwgXCJnaVwiKTtcbiAgICBpZiAoIXJlZ2V4LnRlc3QocmVzb2x2ZWQpKSBjb250aW51ZTtcbiAgICByZWdleC5sYXN0SW5kZXggPSAwO1xuXG4gICAgY29uc3QgcmF3VmFsID0gcm93RGF0YVtjb2xOYW1lXTtcbiAgICBjb25zdCBudW1WYWwgPSBwYXJzZUZsb2F0KHJhd1ZhbCk7XG4gICAgaWYgKE51bWJlci5pc05hTihudW1WYWwpKSByZXR1cm4gbnVsbDtcblxuICAgIHJlc29sdmVkID0gcmVzb2x2ZWQucmVwbGFjZShyZWdleCwgbnVtVmFsLnRvU3RyaW5nKCkpO1xuICB9XG5cbiAgdHJ5IHtcbiAgICByZXR1cm4gc2FmZUV2YWwocmVzb2x2ZWQpO1xuICB9IGNhdGNoIHtcbiAgICByZXR1cm4gbnVsbDtcbiAgfVxufVxuXG5leHBvcnQgZnVuY3Rpb24gZXZhbHVhdGVTaW1wbGVNYXRoKGV4cHJlc3Npb246IHN0cmluZyk6IG51bWJlciB8IG51bGwge1xuICB0cnkge1xuICAgIHJldHVybiBzYWZlRXZhbChleHByZXNzaW9uKTtcbiAgfSBjYXRjaCB7XG4gICAgcmV0dXJuIG51bGw7XG4gIH1cbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGZvcm1hdFJlc3VsdCh2YWx1ZTogbnVtYmVyIHwgbnVsbCB8IHVuZGVmaW5lZCk6IHN0cmluZyB7XG4gIGlmICh2YWx1ZSA9PT0gbnVsbCB8fCB2YWx1ZSA9PT0gdW5kZWZpbmVkIHx8IE51bWJlci5pc05hTih2YWx1ZSkpIHJldHVybiBcIlx1MjAxNFwiO1xuICBpZiAoIU51bWJlci5pc0Zpbml0ZSh2YWx1ZSkpIHJldHVybiBcIlx1MjIxRVwiO1xuICByZXR1cm4gcGFyc2VGbG9hdCh2YWx1ZS50b0ZpeGVkKDYpKS50b1N0cmluZygpO1xufVxuXG5pbnRlcmZhY2UgVG9rZW4ge1xuICB0eXBlOiBcIm51bWJlclwiIHwgXCJvcFwiIHwgXCJscGFyZW5cIiB8IFwicnBhcmVuXCI7XG4gIHZhbHVlOiBudW1iZXIgfCBzdHJpbmc7XG59XG5cbmludGVyZmFjZSBQYXJzZXIge1xuICB0b2tlbnM6IFRva2VuW107XG4gIHBvczogbnVtYmVyO1xufVxuXG5mdW5jdGlvbiBzYWZlRXZhbChleHByZXNzaW9uOiBzdHJpbmcpOiBudW1iZXIge1xuICBjb25zdCB0b2tlbnMgPSB0b2tlbml6ZShleHByZXNzaW9uKTtcbiAgY29uc3QgcGFyc2VyOiBQYXJzZXIgPSB7IHRva2VucywgcG9zOiAwIH07XG4gIGNvbnN0IHJlc3VsdCA9IHBhcnNlRXhwcihwYXJzZXIpO1xuICBpZiAocGFyc2VyLnBvcyA8IHBhcnNlci50b2tlbnMubGVuZ3RoKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKFwiVW5leHBlY3RlZCB0b2tlbjogXCIgKyBTdHJpbmcocGFyc2VyLnRva2Vuc1twYXJzZXIucG9zXS52YWx1ZSkpO1xuICB9XG4gIHJldHVybiByZXN1bHQ7XG59XG5cbmZ1bmN0aW9uIHRva2VuaXplKGV4cHI6IHN0cmluZyk6IFRva2VuW10ge1xuICBjb25zdCB0b2tlbnM6IFRva2VuW10gPSBbXTtcbiAgbGV0IGkgPSAwO1xuICBjb25zdCBzID0gZXhwci50cmltKCk7XG5cbiAgd2hpbGUgKGkgPCBzLmxlbmd0aCkge1xuICAgIGlmIChzW2ldID09PSBcIiBcIiB8fCBzW2ldID09PSBcIlxcdFwiKSB7XG4gICAgICBpKys7XG4gICAgICBjb250aW51ZTtcbiAgICB9XG5cbiAgICBpZiAoKHNbaV0gPj0gXCIwXCIgJiYgc1tpXSA8PSBcIjlcIikgfHwgKHNbaV0gPT09IFwiLlwiICYmIGkgKyAxIDwgcy5sZW5ndGggJiYgc1tpICsgMV0gPj0gXCIwXCIgJiYgc1tpICsgMV0gPD0gXCI5XCIpKSB7XG4gICAgICBsZXQgbnVtID0gXCJcIjtcbiAgICAgIHdoaWxlIChpIDwgcy5sZW5ndGggJiYgKChzW2ldID49IFwiMFwiICYmIHNbaV0gPD0gXCI5XCIpIHx8IHNbaV0gPT09IFwiLlwiKSkge1xuICAgICAgICBudW0gKz0gc1tpXTtcbiAgICAgICAgaSsrO1xuICAgICAgfVxuICAgICAgdG9rZW5zLnB1c2goeyB0eXBlOiBcIm51bWJlclwiLCB2YWx1ZTogcGFyc2VGbG9hdChudW0pIH0pO1xuICAgICAgY29udGludWU7XG4gICAgfVxuXG4gICAgaWYgKFwiKy0qLyVcIi5pbmNsdWRlcyhzW2ldKSkge1xuICAgICAgdG9rZW5zLnB1c2goeyB0eXBlOiBcIm9wXCIsIHZhbHVlOiBzW2ldIH0pO1xuICAgICAgaSsrO1xuICAgICAgY29udGludWU7XG4gICAgfVxuXG4gICAgaWYgKHNbaV0gPT09IFwiKFwiKSB7XG4gICAgICB0b2tlbnMucHVzaCh7IHR5cGU6IFwibHBhcmVuXCIsIHZhbHVlOiBcIihcIiB9KTtcbiAgICAgIGkrKztcbiAgICAgIGNvbnRpbnVlO1xuICAgIH1cbiAgICBpZiAoc1tpXSA9PT0gXCIpXCIpIHtcbiAgICAgIHRva2Vucy5wdXNoKHsgdHlwZTogXCJycGFyZW5cIiwgdmFsdWU6IFwiKVwiIH0pO1xuICAgICAgaSsrO1xuICAgICAgY29udGludWU7XG4gICAgfVxuXG4gICAgdGhyb3cgbmV3IEVycm9yKFwiVW5leHBlY3RlZCBjaGFyYWN0ZXI6IFwiICsgc1tpXSk7XG4gIH1cblxuICByZXR1cm4gdG9rZW5zO1xufVxuXG5mdW5jdGlvbiBwYXJzZUV4cHIocGFyc2VyOiBQYXJzZXIpOiBudW1iZXIge1xuICBsZXQgbGVmdCA9IHBhcnNlVGVybShwYXJzZXIpO1xuXG4gIHdoaWxlIChwYXJzZXIucG9zIDwgcGFyc2VyLnRva2Vucy5sZW5ndGgpIHtcbiAgICBjb25zdCB0b2sgPSBwYXJzZXIudG9rZW5zW3BhcnNlci5wb3NdO1xuICAgIGlmICh0b2sudHlwZSA9PT0gXCJvcFwiICYmICh0b2sudmFsdWUgPT09IFwiK1wiIHx8IHRvay52YWx1ZSA9PT0gXCItXCIpKSB7XG4gICAgICBwYXJzZXIucG9zKys7XG4gICAgICBjb25zdCByaWdodCA9IHBhcnNlVGVybShwYXJzZXIpO1xuICAgICAgbGVmdCA9IHRvay52YWx1ZSA9PT0gXCIrXCIgPyBsZWZ0ICsgcmlnaHQgOiBsZWZ0IC0gcmlnaHQ7XG4gICAgfSBlbHNlIHtcbiAgICAgIGJyZWFrO1xuICAgIH1cbiAgfVxuXG4gIHJldHVybiBsZWZ0O1xufVxuXG5mdW5jdGlvbiBwYXJzZVRlcm0ocGFyc2VyOiBQYXJzZXIpOiBudW1iZXIge1xuICBsZXQgbGVmdCA9IHBhcnNlVW5hcnkocGFyc2VyKTtcblxuICB3aGlsZSAocGFyc2VyLnBvcyA8IHBhcnNlci50b2tlbnMubGVuZ3RoKSB7XG4gICAgY29uc3QgdG9rID0gcGFyc2VyLnRva2Vuc1twYXJzZXIucG9zXTtcbiAgICBpZiAodG9rLnR5cGUgPT09IFwib3BcIiAmJiAodG9rLnZhbHVlID09PSBcIipcIiB8fCB0b2sudmFsdWUgPT09IFwiL1wiIHx8IHRvay52YWx1ZSA9PT0gXCIlXCIpKSB7XG4gICAgICBwYXJzZXIucG9zKys7XG4gICAgICBjb25zdCByaWdodCA9IHBhcnNlVW5hcnkocGFyc2VyKTtcbiAgICAgIGlmICh0b2sudmFsdWUgPT09IFwiKlwiKSBsZWZ0ID0gbGVmdCAqIHJpZ2h0O1xuICAgICAgZWxzZSBpZiAodG9rLnZhbHVlID09PSBcIi9cIikgbGVmdCA9IHJpZ2h0ID09PSAwID8gSW5maW5pdHkgOiBsZWZ0IC8gcmlnaHQ7XG4gICAgICBlbHNlIGxlZnQgPSBsZWZ0ICUgcmlnaHQ7XG4gICAgfSBlbHNlIHtcbiAgICAgIGJyZWFrO1xuICAgIH1cbiAgfVxuXG4gIHJldHVybiBsZWZ0O1xufVxuXG5mdW5jdGlvbiBwYXJzZVVuYXJ5KHBhcnNlcjogUGFyc2VyKTogbnVtYmVyIHtcbiAgaWYgKHBhcnNlci5wb3MgPCBwYXJzZXIudG9rZW5zLmxlbmd0aCkge1xuICAgIGNvbnN0IHRvayA9IHBhcnNlci50b2tlbnNbcGFyc2VyLnBvc107XG4gICAgaWYgKHRvay50eXBlID09PSBcIm9wXCIgJiYgdG9rLnZhbHVlID09PSBcIi1cIikge1xuICAgICAgcGFyc2VyLnBvcysrO1xuICAgICAgcmV0dXJuIC1wYXJzZVVuYXJ5KHBhcnNlcik7XG4gICAgfVxuICAgIGlmICh0b2sudHlwZSA9PT0gXCJvcFwiICYmIHRvay52YWx1ZSA9PT0gXCIrXCIpIHtcbiAgICAgIHBhcnNlci5wb3MrKztcbiAgICAgIHJldHVybiBwYXJzZVVuYXJ5KHBhcnNlcik7XG4gICAgfVxuICB9XG4gIHJldHVybiBwYXJzZVByaW1hcnkocGFyc2VyKTtcbn1cblxuZnVuY3Rpb24gcGFyc2VQcmltYXJ5KHBhcnNlcjogUGFyc2VyKTogbnVtYmVyIHtcbiAgaWYgKHBhcnNlci5wb3MgPj0gcGFyc2VyLnRva2Vucy5sZW5ndGgpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoXCJVbmV4cGVjdGVkIGVuZCBvZiBleHByZXNzaW9uXCIpO1xuICB9XG5cbiAgY29uc3QgdG9rID0gcGFyc2VyLnRva2Vuc1twYXJzZXIucG9zXTtcblxuICBpZiAodG9rLnR5cGUgPT09IFwibnVtYmVyXCIpIHtcbiAgICBwYXJzZXIucG9zKys7XG4gICAgcmV0dXJuIHRvay52YWx1ZSBhcyBudW1iZXI7XG4gIH1cblxuICBpZiAodG9rLnR5cGUgPT09IFwibHBhcmVuXCIpIHtcbiAgICBwYXJzZXIucG9zKys7XG4gICAgY29uc3QgcmVzdWx0ID0gcGFyc2VFeHByKHBhcnNlcik7XG4gICAgaWYgKHBhcnNlci5wb3MgPj0gcGFyc2VyLnRva2Vucy5sZW5ndGggfHwgcGFyc2VyLnRva2Vuc1twYXJzZXIucG9zXS50eXBlICE9PSBcInJwYXJlblwiKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoXCJNaXNzaW5nIGNsb3NpbmcgcGFyZW50aGVzaXNcIik7XG4gICAgfVxuICAgIHBhcnNlci5wb3MrKztcbiAgICByZXR1cm4gcmVzdWx0O1xuICB9XG5cbiAgdGhyb3cgbmV3IEVycm9yKFwiVW5leHBlY3RlZCB0b2tlbjogXCIgKyBTdHJpbmcodG9rLnZhbHVlKSk7XG59XG5cbmZ1bmN0aW9uIGVzY2FwZVJlZ2V4KHN0cjogc3RyaW5nKTogc3RyaW5nIHtcbiAgcmV0dXJuIHN0ci5yZXBsYWNlKC9bLiorP14ke30oKXxbXFxdXFxcXF0vZywgXCJcXFxcJCZcIik7XG59XG4iLCAiZXhwb3J0IGNvbnN0IExBQkVMX0NPTE9SUyA9IFtcbiAgXCIjNGFkZTgwXCIsXG4gIFwiIzYwYTVmYVwiLFxuICBcIiNmNDcyYjZcIixcbiAgXCIjZmI5MjNjXCIsXG4gIFwiI2E3OGJmYVwiLFxuICBcIiMzNGQzOTlcIixcbiAgXCIjZmJiZjI0XCIsXG4gIFwiI2Y4NzE3MVwiLFxuICBcIiMzOGJkZjhcIixcbiAgXCIjYzA4NGZjXCIsXG4gIFwiIzg2ZWZhY1wiLFxuICBcIiM2N2U4ZjlcIixcbiAgXCIjZmRiYTc0XCIsXG4gIFwiI2EzZTYzNVwiLFxuICBcIiNlODc5ZjlcIixcbiAgXCIjMjJkM2VlXCIsXG4gIFwiI2ZmNmI2YlwiLFxuICBcIiNmZmQ5M2RcIixcbiAgXCIjNmJjYjc3XCIsXG4gIFwiIzRkOTZmZlwiLFxuXTtcblxuZXhwb3J0IGZ1bmN0aW9uIGhhc2hTdHIoc3RyOiBzdHJpbmcpOiBudW1iZXIge1xuICBsZXQgaCA9IDUzODE7XG4gIGZvciAobGV0IGkgPSAwOyBpIDwgc3RyLmxlbmd0aDsgaSsrKSB7XG4gICAgaCA9IChoIDw8IDUpICsgaCBeIHN0ci5jaGFyQ29kZUF0KGkpO1xuICAgIGggPSBoID4+PiAwO1xuICB9XG4gIHJldHVybiBoO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gZ2V0TGFiZWxDb2xvcih2YWx1ZTogc3RyaW5nKTogc3RyaW5nIHtcbiAgcmV0dXJuIExBQkVMX0NPTE9SU1toYXNoU3RyKHZhbHVlLnRyaW0oKS50b0xvd2VyQ2FzZSgpKSAlIExBQkVMX0NPTE9SUy5sZW5ndGhdO1xufVxuIiwgImltcG9ydCB0eXBlIHsgQ29sdW1uVHlwZSB9IGZyb20gXCIuL21vZGVsXCI7XG5pbXBvcnQgeyBnZXRMYWJlbENvbG9yIH0gZnJvbSBcIi4vY29sb3JzXCI7XG5cbmV4cG9ydCB7IGdldExhYmVsQ29sb3IgfTtcblxuZXhwb3J0IGZ1bmN0aW9uIGdldFR5cGVJY29uKHR5cGU6IENvbHVtblR5cGUpOiBzdHJpbmcge1xuICBzd2l0Y2ggKHR5cGUua2luZCkge1xuICAgIGNhc2UgXCJ0b2dnbGVcIjpcbiAgICAgIHJldHVybiBcIlx1MkIxQ1wiO1xuICAgIGNhc2UgXCJzZWxlY3RcIjpcbiAgICAgIHJldHVybiBcIlx1MjVCRVwiO1xuICAgIGNhc2UgXCJtdWx0aS1zZWxlY3RcIjpcbiAgICAgIHJldHVybiBcIlx1RDgzQ1x1REZGN1x1RkUwRlwiO1xuICAgIGNhc2UgXCJsYWJlbFwiOlxuICAgICAgcmV0dXJuIFwiXHUyQjIxXCI7XG4gICAgY2FzZSBcIm51bWJlclwiOlxuICAgICAgcmV0dXJuIFwiI1wiO1xuICAgIGNhc2UgXCJkYXRlXCI6XG4gICAgICByZXR1cm4gXCJcdUQ4M0RcdURDQzVcIjtcbiAgICBjYXNlIFwiZm9ybXVsYVwiOlxuICAgICAgcmV0dXJuIFwiXHUwMTkyXCI7XG4gICAgZGVmYXVsdDpcbiAgICAgIHJldHVybiBcIlRcIjtcbiAgfVxufVxuXG5leHBvcnQgZnVuY3Rpb24gc2hvd1RvYXN0KG1lc3NhZ2U6IHN0cmluZyk6IHZvaWQge1xuICBjb25zdCB0b2FzdCA9IGNyZWF0ZURpdigpO1xuICB0b2FzdC5jbGFzc05hbWUgPSBcInppYmFzZS10b2FzdFwiO1xuICB0b2FzdC50ZXh0Q29udGVudCA9IG1lc3NhZ2U7XG4gIGRvY3VtZW50LmJvZHkuYXBwZW5kQ2hpbGQodG9hc3QpO1xuICB3aW5kb3cuc2V0VGltZW91dCgoKSA9PiB0b2FzdC5jbGFzc0xpc3QuYWRkKFwiemliYXNlLXRvYXN0LXNob3dcIiksIDEwKTtcbiAgd2luZG93LnNldFRpbWVvdXQoKCkgPT4ge1xuICAgIHRvYXN0LmNsYXNzTGlzdC5yZW1vdmUoXCJ6aWJhc2UtdG9hc3Qtc2hvd1wiKTtcbiAgICB3aW5kb3cuc2V0VGltZW91dCgoKSA9PiB0b2FzdC5yZW1vdmUoKSwgMzAwKTtcbiAgfSwgMjUwMCk7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBhdHRhY2hMaW5rVG9vbHRpcChhOiBIVE1MQW5jaG9yRWxlbWVudCk6IHZvaWQge1xuICBsZXQgdG9vbHRpcDogSFRNTEVsZW1lbnQgfCBudWxsID0gbnVsbDtcbiAgYS5hZGRFdmVudExpc3RlbmVyKFwibW91c2VlbnRlclwiLCAoKSA9PiB7XG4gICAgdG9vbHRpcCA9IGNyZWF0ZURpdigpO1xuICAgIHRvb2x0aXAuY2xhc3NOYW1lID0gXCJ6aWJhc2UtbGluay10b29sdGlwXCI7XG4gICAgdG9vbHRpcC50ZXh0Q29udGVudCA9IFwiQWx0K0NsaWNrIHRvIGVkaXRcIjtcbiAgICBkb2N1bWVudC5ib2R5LmFwcGVuZENoaWxkKHRvb2x0aXApO1xuICAgIGNvbnN0IHJlY3QgPSBhLmdldEJvdW5kaW5nQ2xpZW50UmVjdCgpO1xuICAgIHRvb2x0aXAuc2V0Q3NzU3R5bGVzKHsgdG9wOiBgJHtyZWN0LmJvdHRvbSArIHdpbmRvdy5zY3JvbGxZICsgNH1weGAgfSk7XG4gICAgdG9vbHRpcC5zZXRDc3NTdHlsZXMoeyBsZWZ0OiBgJHtyZWN0LmxlZnQgKyB3aW5kb3cuc2Nyb2xsWH1weGAgfSk7XG4gIH0pO1xuICBhLmFkZEV2ZW50TGlzdGVuZXIoXCJtb3VzZWxlYXZlXCIsICgpID0+IHtcbiAgICB0b29sdGlwPy5yZW1vdmUoKTtcbiAgICB0b29sdGlwID0gbnVsbDtcbiAgfSk7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBzdGFydExhYmVsRWRpdChcbiAgY2hpcDogSFRNTEVsZW1lbnQsXG4gIGN1cnJlbnQ6IHN0cmluZyxcbiAgb25DaGFuZ2U6ICh2YWx1ZTogc3RyaW5nKSA9PiBQcm9taXNlPHZvaWQ+IHwgdm9pZCxcbik6IHZvaWQge1xuICBjb25zdCBpbnB1dCA9IGNyZWF0ZUVsKFwiaW5wdXRcIik7XG4gIGlucHV0LmNsYXNzTmFtZSA9IFwiemliYXNlLWlubGluZS1pbnB1dFwiO1xuICBpbnB1dC52YWx1ZSA9IGN1cnJlbnQ7XG4gIGNoaXAucmVwbGFjZVdpdGgoaW5wdXQpO1xuICBpbnB1dC5mb2N1cygpO1xuICBpbnB1dC5zZWxlY3QoKTtcbiAgY29uc3QgY29tbWl0ID0gYXN5bmMgKCkgPT4ge1xuICAgIGNvbnN0IG5ld1ZhbCA9IGlucHV0LnZhbHVlLnRyaW0oKSB8fCBjdXJyZW50O1xuICAgIGF3YWl0IG9uQ2hhbmdlKG5ld1ZhbCk7XG4gICAgY2hpcC50ZXh0Q29udGVudCA9IG5ld1ZhbDtcbiAgICBjaGlwLnNldENzc1Byb3BzKHsgXCItLWxjXCI6IGdldExhYmVsQ29sb3IobmV3VmFsKSB9KTtcbiAgICBpbnB1dC5yZXBsYWNlV2l0aChjaGlwKTtcbiAgfTtcbiAgaW5wdXQuYWRkRXZlbnRMaXN0ZW5lcihcImJsdXJcIiwgKCkgPT4geyB2b2lkIGNvbW1pdCgpOyB9KTtcbiAgaW5wdXQuYWRkRXZlbnRMaXN0ZW5lcihcImtleWRvd25cIiwgKGUpID0+IHtcbiAgICBpZiAoZS5rZXkgPT09IFwiRW50ZXJcIikgdm9pZCBjb21taXQoKTtcbiAgICBpZiAoZS5rZXkgPT09IFwiRXNjYXBlXCIpIGlucHV0LnJlcGxhY2VXaXRoKGNoaXApO1xuICB9KTtcbn1cbiIsICJpbXBvcnQgeyBNb2RhbCwgdHlwZSBBcHAgfSBmcm9tIFwib2JzaWRpYW5cIjtcbmltcG9ydCB0eXBlIHsgQ29sdW1uIH0gZnJvbSBcIi4vbW9kZWxcIjtcblxuZXhwb3J0IGNsYXNzIFNlbGVjdE9wdGlvbnNNb2RhbCBleHRlbmRzIE1vZGFsIHtcbiAgY29sTmFtZTogc3RyaW5nO1xuICBjdXJyZW50T3B0aW9uczogc3RyaW5nW107XG4gIG9uU3VibWl0OiAob3B0aW9uczogc3RyaW5nW10pID0+IHZvaWQ7XG5cbiAgY29uc3RydWN0b3IoYXBwOiBBcHAsIGNvbE5hbWU6IHN0cmluZywgY3VycmVudE9wdGlvbnM6IHN0cmluZ1tdLCBvblN1Ym1pdDogKG9wdGlvbnM6IHN0cmluZ1tdKSA9PiB2b2lkKSB7XG4gICAgc3VwZXIoYXBwKTtcbiAgICB0aGlzLmNvbE5hbWUgPSBjb2xOYW1lO1xuICAgIHRoaXMuY3VycmVudE9wdGlvbnMgPSBbLi4uY3VycmVudE9wdGlvbnNdO1xuICAgIHRoaXMub25TdWJtaXQgPSBvblN1Ym1pdDtcbiAgfVxuXG4gIG9uT3BlbigpOiB2b2lkIHtcbiAgICBjb25zdCB7IGNvbnRlbnRFbCB9ID0gdGhpcztcbiAgICBjb250ZW50RWwuZW1wdHkoKTtcbiAgICBjb250ZW50RWwuYWRkQ2xhc3MoXCJ6aWJhc2UtbW9kYWxcIik7XG4gICAgY29udGVudEVsLmNyZWF0ZUVsKFwiaDNcIiwgeyB0ZXh0OiBgT3B0aW9ucyBmb3IgXCIke3RoaXMuY29sTmFtZX1cImAsIGNsczogXCJ6aWJhc2UtbW9kYWwtdGl0bGVcIiB9KTtcbiAgICBjb25zdCBjaGlwc1dyYXAgPSBjb250ZW50RWwuY3JlYXRlRGl2KFwiemliYXNlLW1vZGFsLWNoaXBzXCIpO1xuICAgIGNvbnN0IHJlbmRlckNoaXBzID0gKCkgPT4ge1xuICAgICAgY2hpcHNXcmFwLmVtcHR5KCk7XG4gICAgICB0aGlzLmN1cnJlbnRPcHRpb25zLmZvckVhY2goKG9wdCwgaSkgPT4ge1xuICAgICAgICBjb25zdCBjaGlwID0gY2hpcHNXcmFwLmNyZWF0ZURpdihcInppYmFzZS1tb2RhbC1jaGlwXCIpO1xuICAgICAgICBjaGlwLmNyZWF0ZVNwYW4oeyB0ZXh0OiBvcHQgfSk7XG4gICAgICAgIGNvbnN0IHggPSBjaGlwLmNyZWF0ZVNwYW4oeyB0ZXh0OiBcIlx1MDBEN1wiLCBjbHM6IFwiemliYXNlLWNoaXAtcmVtb3ZlXCIgfSk7XG4gICAgICAgIHguYWRkRXZlbnRMaXN0ZW5lcihcImNsaWNrXCIsICgpID0+IHtcbiAgICAgICAgICB0aGlzLmN1cnJlbnRPcHRpb25zLnNwbGljZShpLCAxKTtcbiAgICAgICAgICByZW5kZXJDaGlwcygpO1xuICAgICAgICB9KTtcbiAgICAgIH0pO1xuICAgIH07XG4gICAgcmVuZGVyQ2hpcHMoKTtcbiAgICBjb25zdCBpbnB1dFJvdyA9IGNvbnRlbnRFbC5jcmVhdGVEaXYoXCJ6aWJhc2UtbW9kYWwtaW5wdXQtcm93XCIpO1xuICAgIGNvbnN0IGlucHV0ID0gaW5wdXRSb3cuY3JlYXRlRWwoXCJpbnB1dFwiLCB7IHR5cGU6IFwidGV4dFwiLCBjbHM6IFwiemliYXNlLW1vZGFsLWlucHV0XCIgfSk7XG4gICAgaW5wdXQucGxhY2Vob2xkZXIgPSBcIkFkZCBvcHRpb25cdTIwMjZcIjtcbiAgICBjb25zdCBhZGRCdG4gPSBpbnB1dFJvdy5jcmVhdGVFbChcImJ1dHRvblwiLCB7IHRleHQ6IFwiQWRkXCIsIGNsczogXCJ6aWJhc2UtbW9kYWwtYWRkLWJ0blwiIH0pO1xuICAgIGNvbnN0IGFkZE9wdGlvbiA9ICgpID0+IHtcbiAgICAgIGNvbnN0IHZhbCA9IGlucHV0LnZhbHVlLnRyaW0oKTtcbiAgICAgIGlmICh2YWwgJiYgIXRoaXMuY3VycmVudE9wdGlvbnMuaW5jbHVkZXModmFsKSkge1xuICAgICAgICB0aGlzLmN1cnJlbnRPcHRpb25zLnB1c2godmFsKTtcbiAgICAgICAgcmVuZGVyQ2hpcHMoKTtcbiAgICAgICAgaW5wdXQudmFsdWUgPSBcIlwiO1xuICAgICAgICBpbnB1dC5mb2N1cygpO1xuICAgICAgfVxuICAgIH07XG4gICAgYWRkQnRuLmFkZEV2ZW50TGlzdGVuZXIoXCJjbGlja1wiLCBhZGRPcHRpb24pO1xuICAgIGlucHV0LmFkZEV2ZW50TGlzdGVuZXIoXCJrZXlkb3duXCIsIChlKSA9PiB7XG4gICAgICBpZiAoZS5rZXkgPT09IFwiRW50ZXJcIikge1xuICAgICAgICBlLnByZXZlbnREZWZhdWx0KCk7XG4gICAgICAgIGFkZE9wdGlvbigpO1xuICAgICAgfVxuICAgICAgaWYgKGUua2V5ID09PSBcIkVzY2FwZVwiKSB0aGlzLmNsb3NlKCk7XG4gICAgfSk7XG4gICAgY29uc3QgYXBwbHlCdG4gPSBjb250ZW50RWwuY3JlYXRlRWwoXCJidXR0b25cIiwgeyB0ZXh0OiBcIkFwcGx5XCIsIGNsczogXCJ6aWJhc2UtbW9kYWwtYXBwbHktYnRuXCIgfSk7XG4gICAgYXBwbHlCdG4uYWRkRXZlbnRMaXN0ZW5lcihcImNsaWNrXCIsICgpID0+IHtcbiAgICAgIGlmICh0aGlzLmN1cnJlbnRPcHRpb25zLmxlbmd0aCA+IDApIHtcbiAgICAgICAgdGhpcy5vblN1Ym1pdCh0aGlzLmN1cnJlbnRPcHRpb25zKTtcbiAgICAgICAgdGhpcy5jbG9zZSgpO1xuICAgICAgfVxuICAgIH0pO1xuICAgIHdpbmRvdy5zZXRUaW1lb3V0KCgpID0+IGlucHV0LmZvY3VzKCksIDUwKTtcbiAgfVxuXG4gIG9uQ2xvc2UoKTogdm9pZCB7XG4gICAgdGhpcy5jb250ZW50RWwuZW1wdHkoKTtcbiAgfVxufVxuXG5leHBvcnQgY2xhc3MgRm9ybXVsYUlucHV0TW9kYWwgZXh0ZW5kcyBNb2RhbCB7XG4gIGNvbE5hbWU6IHN0cmluZztcbiAgY3VycmVudEV4cHI6IHN0cmluZztcbiAgY29sdW1uczogQ29sdW1uW107XG4gIG9uU3VibWl0OiAoZXhwcjogc3RyaW5nKSA9PiB2b2lkO1xuXG4gIGNvbnN0cnVjdG9yKFxuICAgIGFwcDogQXBwLFxuICAgIGNvbE5hbWU6IHN0cmluZyxcbiAgICBjdXJyZW50RXhwcjogc3RyaW5nLFxuICAgIGNvbHVtbnM6IENvbHVtbltdLFxuICAgIG9uU3VibWl0OiAoZXhwcjogc3RyaW5nKSA9PiB2b2lkLFxuICApIHtcbiAgICBzdXBlcihhcHApO1xuICAgIHRoaXMuY29sTmFtZSA9IGNvbE5hbWU7XG4gICAgdGhpcy5jdXJyZW50RXhwciA9IGN1cnJlbnRFeHByO1xuICAgIHRoaXMuY29sdW1ucyA9IGNvbHVtbnM7XG4gICAgdGhpcy5vblN1Ym1pdCA9IG9uU3VibWl0O1xuICB9XG5cbiAgb25PcGVuKCk6IHZvaWQge1xuICAgIGNvbnN0IHsgY29udGVudEVsIH0gPSB0aGlzO1xuICAgIGNvbnRlbnRFbC5lbXB0eSgpO1xuICAgIGNvbnRlbnRFbC5hZGRDbGFzcyhcInppYmFzZS1tb2RhbFwiKTtcbiAgICBjb250ZW50RWwuY3JlYXRlRWwoXCJoM1wiLCB7IHRleHQ6IGBGb3JtdWxhIGZvciBcIiR7dGhpcy5jb2xOYW1lfVwiYCwgY2xzOiBcInppYmFzZS1tb2RhbC10aXRsZVwiIH0pO1xuICAgIGNvbnRlbnRFbC5jcmVhdGVFbChcInBcIiwge1xuICAgICAgdGV4dDogXCJVc2UgY29sdW1uIG5hbWVzIHRvIHJlZmVyZW5jZSB2YWx1ZXMuIENhc2UtaW5zZW5zaXRpdmUuXCIsXG4gICAgICBjbHM6IFwiemliYXNlLXNldHRpbmdzLWRlc2NcIixcbiAgICB9KTtcblxuICAgIGxldCBpbnB1dDogSFRNTElucHV0RWxlbWVudDtcbiAgICBjb25zdCBjb2xMaXN0ID0gY29udGVudEVsLmNyZWF0ZURpdihcInppYmFzZS1mb3JtdWxhLWNvbHNcIik7XG4gICAgY29sTGlzdC5jcmVhdGVTcGFuKHsgdGV4dDogXCJBdmFpbGFibGU6IFwiLCBjbHM6IFwiemliYXNlLWZvcm11bGEtY29scy1sYWJlbFwiIH0pO1xuICAgIHRoaXMuY29sdW1ucy5mb3JFYWNoKChjb2wpID0+IHtcbiAgICAgIGlmIChjb2wubmFtZSA9PT0gdGhpcy5jb2xOYW1lKSByZXR1cm47XG4gICAgICBjb25zdCBjaGlwID0gY29sTGlzdC5jcmVhdGVTcGFuKHsgdGV4dDogY29sLm5hbWUsIGNsczogXCJ6aWJhc2UtZm9ybXVsYS1jb2wtY2hpcFwiIH0pO1xuICAgICAgY2hpcC5hZGRFdmVudExpc3RlbmVyKFwiY2xpY2tcIiwgKCkgPT4ge1xuICAgICAgICBpbnB1dC52YWx1ZSArPSBjb2wubmFtZTtcbiAgICAgICAgaW5wdXQuZm9jdXMoKTtcbiAgICAgIH0pO1xuICAgIH0pO1xuXG4gICAgaW5wdXQgPSBjb250ZW50RWwuY3JlYXRlRWwoXCJpbnB1dFwiLCB7IHR5cGU6IFwidGV4dFwiLCBjbHM6IFwiemliYXNlLW1vZGFsLWlucHV0IHppYmFzZS1tb2RhbC1mb3JtdWxhLWlucHV0XCIgfSk7XG4gICAgaW5wdXQudmFsdWUgPSB0aGlzLmN1cnJlbnRFeHByO1xuICAgIGlucHV0LnBsYWNlaG9sZGVyID0gXCJlLmcuLCBQcmljZSAqIFF0eVwiO1xuXG4gICAgY29uc3QgYXBwbHlCdG4gPSBjb250ZW50RWwuY3JlYXRlRWwoXCJidXR0b25cIiwgeyB0ZXh0OiBcIkFwcGx5XCIsIGNsczogXCJ6aWJhc2UtbW9kYWwtYXBwbHktYnRuXCIgfSk7XG4gICAgY29uc3QgYXBwbHkgPSAoKSA9PiB7XG4gICAgICBjb25zdCBleHByID0gaW5wdXQudmFsdWUudHJpbSgpO1xuICAgICAgaWYgKGV4cHIpIHtcbiAgICAgICAgdGhpcy5vblN1Ym1pdChleHByKTtcbiAgICAgICAgdGhpcy5jbG9zZSgpO1xuICAgICAgfVxuICAgIH07XG4gICAgYXBwbHlCdG4uYWRkRXZlbnRMaXN0ZW5lcihcImNsaWNrXCIsIGFwcGx5KTtcbiAgICBpbnB1dC5hZGRFdmVudExpc3RlbmVyKFwia2V5ZG93blwiLCAoZSkgPT4ge1xuICAgICAgaWYgKGUua2V5ID09PSBcIkVudGVyXCIpIHtcbiAgICAgICAgZS5wcmV2ZW50RGVmYXVsdCgpO1xuICAgICAgICBhcHBseSgpO1xuICAgICAgfVxuICAgICAgaWYgKGUua2V5ID09PSBcIkVzY2FwZVwiKSB0aGlzLmNsb3NlKCk7XG4gICAgfSk7XG5cbiAgICB3aW5kb3cuc2V0VGltZW91dCgoKSA9PiB7XG4gICAgICBpbnB1dC5mb2N1cygpO1xuICAgICAgaW5wdXQuc2VsZWN0KCk7XG4gICAgfSwgNTApO1xuICB9XG5cbiAgb25DbG9zZSgpOiB2b2lkIHtcbiAgICB0aGlzLmNvbnRlbnRFbC5lbXB0eSgpO1xuICB9XG59XG4iLCAiZXhwb3J0IHR5cGUgQ29sdW1uS2luZCA9XG4gIHwgXCJ0ZXh0XCJcbiAgfCBcInRvZ2dsZVwiXG4gIHwgXCJzZWxlY3RcIlxuICB8IFwibGFiZWxcIlxuICB8IFwibXVsdGktc2VsZWN0XCJcbiAgfCBcIm51bWJlclwiXG4gIHwgXCJkYXRlXCJcbiAgfCBcImZvcm11bGFcIjtcblxuZXhwb3J0IHR5cGUgQ29sdW1uVHlwZSA9XG4gIHwgeyBraW5kOiBcInRleHRcIiB9XG4gIHwgeyBraW5kOiBcInRvZ2dsZVwiIH1cbiAgfCB7IGtpbmQ6IFwic2VsZWN0XCI7IG9wdGlvbnM6IHN0cmluZ1tdIH1cbiAgfCB7IGtpbmQ6IFwibGFiZWxcIiB9XG4gIHwgeyBraW5kOiBcIm11bHRpLXNlbGVjdFwiIH1cbiAgfCB7IGtpbmQ6IFwibnVtYmVyXCIgfVxuICB8IHsga2luZDogXCJkYXRlXCIgfVxuICB8IHsga2luZDogXCJmb3JtdWxhXCI7IGV4cHJlc3Npb246IHN0cmluZyB9O1xuXG5leHBvcnQgaW50ZXJmYWNlIENvbHVtbiB7XG4gIG5hbWU6IHN0cmluZztcbiAgdHlwZTogQ29sdW1uVHlwZTtcbiAgaW5kZXg6IG51bWJlcjtcbn1cblxuZXhwb3J0IGludGVyZmFjZSBUYWJsZVNjaGVtYSB7XG4gIGNvbHVtbnM6IENvbHVtbltdO1xuICBzY2hlbWFSb3dJbmRleDogbnVtYmVyIHwgbnVsbDtcbiAgZGF0YVN0YXJ0SW5kZXg6IG51bWJlcjtcbiAgaW5mZXJyZWQ6IGJvb2xlYW47XG59XG5cbmV4cG9ydCB0eXBlIFZpZXdOYW1lID0gXCJ0YWJsZVwiIHwgXCJrYW5iYW5cIiB8IFwiZ2FsbGVyeVwiIHwgXCJjYWxlbmRhclwiO1xuXG5leHBvcnQgaW50ZXJmYWNlIENvbHVtblJ1bGUge1xuICBuYW1lOiBzdHJpbmc7XG4gIHR5cGU6IHN0cmluZztcbn1cblxuZXhwb3J0IGludGVyZmFjZSBaaUJhc2VTZXR0aW5ncyB7XG4gIHJlbmRlckluUmVhZGluZ1ZpZXc6IGJvb2xlYW47XG4gIGluZmVyU2NoZW1hOiBib29sZWFuO1xuICBjb2x1bW5SdWxlczogQ29sdW1uUnVsZVtdO1xufVxuXG5leHBvcnQgY29uc3QgQ09MVU1OX1RZUEVfT1BUSU9OUzogQ29sdW1uS2luZFtdID0gW1xuICBcInRleHRcIixcbiAgXCJ0b2dnbGVcIixcbiAgXCJzZWxlY3RcIixcbiAgXCJsYWJlbFwiLFxuICBcIm11bHRpLXNlbGVjdFwiLFxuICBcIm51bWJlclwiLFxuICBcImRhdGVcIixcbiAgXCJmb3JtdWxhXCIsXG5dO1xuIiwgImltcG9ydCB7IENvbXBvbmVudCwgTWFya2Rvd25SZW5kZXJlciwgVEZpbGUsIHR5cGUgTWFya2Rvd25Qb3N0UHJvY2Vzc29yQ29udGV4dCwgdHlwZSBNYXJrZG93blNlY3Rpb25JbmZvcm1hdGlvbiB9IGZyb20gXCJvYnNpZGlhblwiO1xuaW1wb3J0IHsgZmlsdGVyRGF0YVJvd3MsIHNlcmlhbGl6ZVJvdywgc3BsaXRSb3cgfSBmcm9tIFwiLi4vc2NoZW1hXCI7XG5pbXBvcnQgdHlwZSB7IFRhYmxlU2NoZW1hLCBaaUJhc2VIb3N0IH0gZnJvbSBcIi4uL3R5cGVzXCI7XG5pbXBvcnQgeyBnZXRMYWJlbENvbG9yIH0gZnJvbSBcIi4uL3VpXCI7XG5cbmV4cG9ydCBmdW5jdGlvbiBidWlsZENhbGVuZGFyVmlldyhcbiAgaG9zdDogWmlCYXNlSG9zdCxcbiAgYm9keTogSFRNTEVsZW1lbnQsXG4gIHNjaGVtYTogVGFibGVTY2hlbWEsXG4gIGdldERhdGFSb3dzOiAoKSA9PiBzdHJpbmdbXSxcbiAgX3Jhd0RhdGFMaW5lczogc3RyaW5nW10sXG4gIGNvbnRleHQ6IE1hcmtkb3duUG9zdFByb2Nlc3NvckNvbnRleHQsXG4gIHNlY3Rpb25JbmZvOiBNYXJrZG93blNlY3Rpb25JbmZvcm1hdGlvbixcbiAgZmlsdGVyUXVlcnk6IHN0cmluZyxcbik6IHZvaWQge1xuICBjb25zdCBkYXRlQ29sID0gc2NoZW1hLmNvbHVtbnMuZmluZCgoYykgPT4gYy50eXBlLmtpbmQgPT09IFwiZGF0ZVwiKTtcbiAgaWYgKCFkYXRlQ29sKSB7XG4gICAgY29uc3Qgbm90aWNlID0gYm9keS5jcmVhdGVEaXYoXCJ6aWJhc2UtY2FsZW5kYXIgemliYXNlLWNhbGVuZGFyLW5vdGljZVwiKTtcbiAgICBub3RpY2UudGV4dENvbnRlbnQgPSBcIkNhbGVuZGFyIHJlcXVpcmVzIGEgRGF0ZSBjb2x1bW4uXCI7XG4gICAgcmV0dXJuO1xuICB9XG5cbiAgY29uc3QgY2FsZW5kYXIgPSBib2R5LmNyZWF0ZURpdihcInppYmFzZS1jYWxlbmRhclwiKTtcbiAgY29uc3Qgbm93ID0gbmV3IERhdGUoKTtcbiAgbGV0IGN1cnJlbnRNb250aCA9IG5vdy5nZXRNb250aCgpO1xuICBsZXQgY3VycmVudFllYXIgPSBub3cuZ2V0RnVsbFllYXIoKTtcblxuICBjb25zdCByZW5kZXJDYWxlbmRhciA9ICgpID0+IHtcbiAgICBjYWxlbmRhci5lbXB0eSgpO1xuXG4gICAgY29uc3QgbmF2ID0gY2FsZW5kYXIuY3JlYXRlRGl2KFwiemliYXNlLWNhbGVuZGFyLW5hdlwiKTtcbiAgICBjb25zdCBwcmV2QnRuID0gbmF2LmNyZWF0ZUVsKFwiYnV0dG9uXCIsIHsgdGV4dDogXCJcdTI1QzBcIiwgY2xzOiBcInppYmFzZS1jYWxlbmRhci1uYXYtYnRuXCIgfSk7XG4gICAgY29uc3QgbW9udGhMYWJlbCA9IG5hdi5jcmVhdGVTcGFuKHsgY2xzOiBcInppYmFzZS1jYWxlbmRhci1tb250aC1sYWJlbFwiIH0pO1xuICAgIG1vbnRoTGFiZWwudGV4dENvbnRlbnQgPSBuZXcgRGF0ZShjdXJyZW50WWVhciwgY3VycmVudE1vbnRoKS50b0xvY2FsZVN0cmluZyhcImRlZmF1bHRcIiwge1xuICAgICAgbW9udGg6IFwibG9uZ1wiLFxuICAgICAgeWVhcjogXCJudW1lcmljXCIsXG4gICAgfSk7XG4gICAgY29uc3QgbmV4dEJ0biA9IG5hdi5jcmVhdGVFbChcImJ1dHRvblwiLCB7IHRleHQ6IFwiXHUyNUI2XCIsIGNsczogXCJ6aWJhc2UtY2FsZW5kYXItbmF2LWJ0blwiIH0pO1xuXG4gICAgcHJldkJ0bi5hZGRFdmVudExpc3RlbmVyKFwiY2xpY2tcIiwgKCkgPT4ge1xuICAgICAgY3VycmVudE1vbnRoLS07XG4gICAgICBpZiAoY3VycmVudE1vbnRoIDwgMCkge1xuICAgICAgICBjdXJyZW50TW9udGggPSAxMTtcbiAgICAgICAgY3VycmVudFllYXItLTtcbiAgICAgIH1cbiAgICAgIHJlbmRlckNhbGVuZGFyKCk7XG4gICAgfSk7XG4gICAgbmV4dEJ0bi5hZGRFdmVudExpc3RlbmVyKFwiY2xpY2tcIiwgKCkgPT4ge1xuICAgICAgY3VycmVudE1vbnRoKys7XG4gICAgICBpZiAoY3VycmVudE1vbnRoID4gMTEpIHtcbiAgICAgICAgY3VycmVudE1vbnRoID0gMDtcbiAgICAgICAgY3VycmVudFllYXIrKztcbiAgICAgIH1cbiAgICAgIHJlbmRlckNhbGVuZGFyKCk7XG4gICAgfSk7XG5cbiAgICBjb25zdCBkYXlIZWFkZXJzID0gY2FsZW5kYXIuY3JlYXRlRGl2KFwiemliYXNlLWNhbGVuZGFyLWRheS1oZWFkZXJzXCIpO1xuICAgIFtcIk1vblwiLCBcIlR1ZVwiLCBcIldlZFwiLCBcIlRodVwiLCBcIkZyaVwiLCBcIlNhdFwiLCBcIlN1blwiXS5mb3JFYWNoKChkKSA9PiB7XG4gICAgICBkYXlIZWFkZXJzLmNyZWF0ZVNwYW4oeyB0ZXh0OiBkLCBjbHM6IFwiemliYXNlLWNhbGVuZGFyLWRheS1oZWFkZXJcIiB9KTtcbiAgICB9KTtcblxuICAgIGNvbnN0IGdyaWQgPSBjYWxlbmRhci5jcmVhdGVEaXYoXCJ6aWJhc2UtY2FsZW5kYXItZ3JpZFwiKTtcbiAgICBjb25zdCBmaXJzdERheSA9IG5ldyBEYXRlKGN1cnJlbnRZZWFyLCBjdXJyZW50TW9udGgsIDEpO1xuICAgIGNvbnN0IGxhc3REYXkgPSBuZXcgRGF0ZShjdXJyZW50WWVhciwgY3VycmVudE1vbnRoICsgMSwgMCk7XG4gICAgY29uc3QgdG90YWxEYXlzID0gbGFzdERheS5nZXREYXRlKCk7XG5cbiAgICBsZXQgc3RhcnREb3cgPSBmaXJzdERheS5nZXREYXkoKSAtIDE7XG4gICAgaWYgKHN0YXJ0RG93IDwgMCkgc3RhcnREb3cgPSA2O1xuXG4gICAgY29uc3QgZGF0YVJvd3MgPSBmaWx0ZXJEYXRhUm93cyhnZXREYXRhUm93cygpLCBmaWx0ZXJRdWVyeSk7XG4gICAgY29uc3QgZGF0ZU1hcCA9IG5ldyBNYXA8c3RyaW5nLCB7IHRpdGxlOiBzdHJpbmc7IGxhYmVsOiBzdHJpbmcgfCBudWxsOyBsaW5lOiBzdHJpbmcgfVtdPigpO1xuICAgIGRhdGFSb3dzLmZvckVhY2goKGxpbmUpID0+IHtcbiAgICAgIGNvbnN0IGNlbGxzID0gc3BsaXRSb3cobGluZSk7XG4gICAgICBjb25zdCBkYXRlU3RyID0gKGNlbGxzW2RhdGVDb2wuaW5kZXhdIHx8IFwiXCIpLnRyaW0oKTtcbiAgICAgIGlmICghZGF0ZVN0cikgcmV0dXJuO1xuICAgICAgaWYgKCFkYXRlTWFwLmhhcyhkYXRlU3RyKSkgZGF0ZU1hcC5zZXQoZGF0ZVN0ciwgW10pO1xuICAgICAgY29uc3QgdGl0bGVDb2wgPSBzY2hlbWEuY29sdW1ucy5maW5kKChjKSA9PiBjLnR5cGUua2luZCA9PT0gXCJ0ZXh0XCIpO1xuICAgICAgY29uc3QgdGl0bGUgPSB0aXRsZUNvbCA/IChjZWxsc1t0aXRsZUNvbC5pbmRleF0gfHwgXCJcIikudHJpbSgpIDogKGNlbGxzWzBdIHx8IFwiXCIpLnRyaW0oKTtcbiAgICAgIGNvbnN0IGxhYmVsQ29sID0gc2NoZW1hLmNvbHVtbnMuZmluZCgoYykgPT4gYy50eXBlLmtpbmQgPT09IFwibGFiZWxcIiB8fCBjLnR5cGUua2luZCA9PT0gXCJzZWxlY3RcIik7XG4gICAgICBjb25zdCBsYWJlbCA9IGxhYmVsQ29sID8gKGNlbGxzW2xhYmVsQ29sLmluZGV4XSB8fCBcIlwiKS50cmltKCkgOiBudWxsO1xuICAgICAgZGF0ZU1hcC5nZXQoZGF0ZVN0cikhLnB1c2goeyB0aXRsZSwgbGFiZWwsIGxpbmUgfSk7XG4gICAgfSk7XG5cbiAgICBjb25zdCB0b2RheSA9IG5ldyBEYXRlKCk7XG4gICAgY29uc3QgdG9kYXlTdHIgPSBgJHt0b2RheS5nZXRGdWxsWWVhcigpfS0ke1N0cmluZyh0b2RheS5nZXRNb250aCgpICsgMSkucGFkU3RhcnQoMiwgXCIwXCIpfS0ke1N0cmluZyh0b2RheS5nZXREYXRlKCkpLnBhZFN0YXJ0KDIsIFwiMFwiKX1gO1xuXG4gICAgZm9yIChsZXQgaSA9IDA7IGkgPCBzdGFydERvdzsgaSsrKSB7XG4gICAgICBncmlkLmNyZWF0ZURpdihcInppYmFzZS1jYWxlbmRhci1jZWxsIHppYmFzZS1jYWxlbmRhci1jZWxsLWVtcHR5XCIpO1xuICAgIH1cblxuICAgIGZvciAobGV0IGQgPSAxOyBkIDw9IHRvdGFsRGF5czsgZCsrKSB7XG4gICAgICBjb25zdCBkYXRlU3RyID0gYCR7Y3VycmVudFllYXJ9LSR7U3RyaW5nKGN1cnJlbnRNb250aCArIDEpLnBhZFN0YXJ0KDIsIFwiMFwiKX0tJHtTdHJpbmcoZCkucGFkU3RhcnQoMiwgXCIwXCIpfWA7XG4gICAgICBjb25zdCBjZWxsID0gZ3JpZC5jcmVhdGVEaXYoXCJ6aWJhc2UtY2FsZW5kYXItY2VsbFwiKTtcbiAgICAgIGlmIChkYXRlU3RyID09PSB0b2RheVN0cikgY2VsbC5jbGFzc0xpc3QuYWRkKFwiemliYXNlLWNhbGVuZGFyLXRvZGF5XCIpO1xuXG4gICAgICBjZWxsLmNyZWF0ZVNwYW4oeyB0ZXh0OiBTdHJpbmcoZCksIGNsczogXCJ6aWJhc2UtY2FsZW5kYXItZGF5LW51bVwiIH0pO1xuXG4gICAgICBjb25zdCBlbnRyaWVzID0gZGF0ZU1hcC5nZXQoZGF0ZVN0cikgfHwgW107XG4gICAgICBlbnRyaWVzLmZvckVhY2goKGVudHJ5KSA9PiB7XG4gICAgICAgIGNvbnN0IHBpbGwgPSBjZWxsLmNyZWF0ZURpdihcInppYmFzZS1jYWxlbmRhci1lbnRyeVwiKTtcbiAgICAgICAgdm9pZCBNYXJrZG93blJlbmRlcmVyLnJlbmRlcihob3N0LmFwcCwgZW50cnkudGl0bGUgfHwgXCJcdTIwMTRcIiwgcGlsbCwgY29udGV4dC5zb3VyY2VQYXRoLCBuZXcgQ29tcG9uZW50KCkpO1xuICAgICAgICBpZiAoZW50cnkubGFiZWwpIHtcbiAgICAgICAgICBwaWxsLnNldENzc1Byb3BzKHsgXCItLWxjXCI6IGdldExhYmVsQ29sb3IoZW50cnkubGFiZWwpIH0pO1xuICAgICAgICAgIHBpbGwuY2xhc3NMaXN0LmFkZChcInppYmFzZS1jYWxlbmRhci1lbnRyeS1jb2xvcmVkXCIpO1xuICAgICAgICB9XG4gICAgICB9KTtcblxuICAgICAgaWYgKGVudHJpZXMubGVuZ3RoID09PSAwKSB7XG4gICAgICAgIGNlbGwuYWRkRXZlbnRMaXN0ZW5lcihcImNsaWNrXCIsICgpID0+IHtcbiAgICAgICAgICB2b2lkIChhc3luYyAoKSA9PiB7XG4gICAgICAgICAgICBjb25zdCBmaWxlID0gaG9zdC5hcHAudmF1bHQuZ2V0QWJzdHJhY3RGaWxlQnlQYXRoKGNvbnRleHQuc291cmNlUGF0aCk7XG4gICAgICAgICAgICBpZiAoIShmaWxlIGluc3RhbmNlb2YgVEZpbGUpKSByZXR1cm47XG4gICAgICAgICAgICBhd2FpdCBob3N0LmFwcC52YXVsdC5wcm9jZXNzKGZpbGUsIChjb250ZW50KSA9PiB7XG4gICAgICAgICAgICAgIGNvbnN0IGFsbExpbmVzID0gY29udGVudC5zcGxpdChcIlxcblwiKTtcbiAgICAgICAgICAgICAgY29uc3QgbmV3Q2VsbHMgPSBzY2hlbWEuY29sdW1ucy5tYXAoKGNvbCkgPT4ge1xuICAgICAgICAgICAgICAgIGlmIChjb2wuaW5kZXggPT09IGRhdGVDb2wuaW5kZXgpIHJldHVybiBgICR7ZGF0ZVN0cn0gYDtcbiAgICAgICAgICAgICAgICByZXR1cm4gXCIgICBcIjtcbiAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgIGFsbExpbmVzLnNwbGljZShzZWN0aW9uSW5mby5saW5lRW5kICsgMSwgMCwgc2VyaWFsaXplUm93KG5ld0NlbGxzKSk7XG4gICAgICAgICAgICAgIHJldHVybiBhbGxMaW5lcy5qb2luKFwiXFxuXCIpO1xuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgfSkoKTtcbiAgICAgICAgfSk7XG4gICAgICAgIGNlbGwuY2xhc3NMaXN0LmFkZChcInppYmFzZS1jYWxlbmRhci1jZWxsLWNsaWNrYWJsZVwiKTtcbiAgICAgIH1cbiAgICB9XG4gIH07XG5cbiAgcmVuZGVyQ2FsZW5kYXIoKTtcbn1cbiIsICJpbXBvcnQgeyBDb21wb25lbnQsIE1hcmtkb3duUmVuZGVyZXIsIHR5cGUgTWFya2Rvd25Qb3N0UHJvY2Vzc29yQ29udGV4dCwgdHlwZSBNYXJrZG93blNlY3Rpb25JbmZvcm1hdGlvbiB9IGZyb20gXCJvYnNpZGlhblwiO1xuaW1wb3J0IHsgZmlsdGVyRGF0YVJvd3MsIHBhcnNlQm9vbCwgc3BsaXRSb3cgfSBmcm9tIFwiLi4vc2NoZW1hXCI7XG5pbXBvcnQgdHlwZSB7IFRhYmxlU2NoZW1hLCBaaUJhc2VIb3N0IH0gZnJvbSBcIi4uL3R5cGVzXCI7XG5pbXBvcnQgeyBnZXRMYWJlbENvbG9yIH0gZnJvbSBcIi4uL3VpXCI7XG5cbmV4cG9ydCBmdW5jdGlvbiBidWlsZEdhbGxlcnlWaWV3KFxuICBob3N0OiBaaUJhc2VIb3N0LFxuICBib2R5OiBIVE1MRWxlbWVudCxcbiAgc2NoZW1hOiBUYWJsZVNjaGVtYSxcbiAgZ2V0RGF0YVJvd3M6ICgpID0+IHN0cmluZ1tdLFxuICBfcmF3RGF0YUxpbmVzOiBzdHJpbmdbXSxcbiAgY29udGV4dDogTWFya2Rvd25Qb3N0UHJvY2Vzc29yQ29udGV4dCxcbiAgX3NlY3Rpb25JbmZvOiBNYXJrZG93blNlY3Rpb25JbmZvcm1hdGlvbixcbiAgZmlsdGVyUXVlcnk6IHN0cmluZyxcbik6IHZvaWQge1xuICBjb25zdCBnYWxsZXJ5ID0gYm9keS5jcmVhdGVEaXYoXCJ6aWJhc2UtZ2FsbGVyeVwiKTtcbiAgY29uc3QgZGF0YVJvd3MgPSBmaWx0ZXJEYXRhUm93cyhnZXREYXRhUm93cygpLCBmaWx0ZXJRdWVyeSk7XG5cbiAgaWYgKGRhdGFSb3dzLmxlbmd0aCA9PT0gMCkge1xuICAgIGNvbnN0IGVtcHR5ID0gZ2FsbGVyeS5jcmVhdGVEaXYoXCJ6aWJhc2UtZW1wdHlcIik7XG4gICAgZW1wdHkudGV4dENvbnRlbnQgPSBmaWx0ZXJRdWVyeSA/IFwiTm8gbWF0Y2hpbmcgcm93c1wiIDogXCJObyBkYXRhXCI7XG4gICAgcmV0dXJuO1xuICB9XG5cbiAgY29uc3QgZ3JpZCA9IGdhbGxlcnkuY3JlYXRlRGl2KFwiemliYXNlLWdhbGxlcnktZ3JpZFwiKTtcblxuICBkYXRhUm93cy5mb3JFYWNoKChsaW5lKSA9PiB7XG4gICAgY29uc3QgY2VsbHMgPSBzcGxpdFJvdyhsaW5lKTtcbiAgICBjb25zdCBjYXJkID0gZ3JpZC5jcmVhdGVEaXYoXCJ6aWJhc2UtZ2FsbGVyeS1jYXJkXCIpO1xuXG4gICAgY29uc3QgdGl0bGVDb2wgPSBzY2hlbWEuY29sdW1ucy5maW5kKChjKSA9PiBjLnR5cGUua2luZCA9PT0gXCJ0ZXh0XCIpO1xuICAgIGNvbnN0IHRpdGxlVmFsdWUgPSB0aXRsZUNvbCA/IChjZWxsc1t0aXRsZUNvbC5pbmRleF0gfHwgXCJcIikudHJpbSgpIDogKGNlbGxzWzBdIHx8IFwiXCIpLnRyaW0oKTtcbiAgICBjb25zdCB0aXRsZURpdiA9IGNhcmQuY3JlYXRlRGl2KHsgY2xzOiBcInppYmFzZS1nYWxsZXJ5LWNhcmQtdGl0bGVcIiB9KTtcbiAgICB2b2lkIE1hcmtkb3duUmVuZGVyZXIucmVuZGVyKGhvc3QuYXBwLCB0aXRsZVZhbHVlIHx8IFwiXHUyMDE0XCIsIHRpdGxlRGl2LCBjb250ZXh0LnNvdXJjZVBhdGgsIG5ldyBDb21wb25lbnQoKSk7XG5cbiAgICBjb25zdCBmaWVsZHNXcmFwID0gY2FyZC5jcmVhdGVEaXYoXCJ6aWJhc2UtZ2FsbGVyeS1jYXJkLWZpZWxkc1wiKTtcbiAgICBzY2hlbWEuY29sdW1ucy5mb3JFYWNoKChjb2wsIGNvbElkeCkgPT4ge1xuICAgICAgaWYgKHRpdGxlQ29sICYmIGNvbElkeCA9PT0gdGl0bGVDb2wuaW5kZXgpIHJldHVybjtcbiAgICAgIGNvbnN0IHJhd1ZhbHVlID0gKGNlbGxzW2NvbElkeF0gPz8gXCJcIikudHJpbSgpO1xuICAgICAgaWYgKCFyYXdWYWx1ZSAmJiBjb2wudHlwZS5raW5kICE9PSBcInRvZ2dsZVwiKSByZXR1cm47XG5cbiAgICAgIGNvbnN0IGZpZWxkID0gZmllbGRzV3JhcC5jcmVhdGVEaXYoXCJ6aWJhc2UtZ2FsbGVyeS1maWVsZFwiKTtcblxuICAgICAgaWYgKGNvbC50eXBlLmtpbmQgPT09IFwidG9nZ2xlXCIpIHtcbiAgICAgICAgZmllbGQuY3JlYXRlU3Bhbih7IHRleHQ6IHBhcnNlQm9vbChyYXdWYWx1ZSkgPyBcIlx1MjcwNVwiIDogXCJcdTJCMUNcIiB9KTtcbiAgICAgICAgZmllbGQuY3JlYXRlU3Bhbih7IHRleHQ6IFwiIFwiICsgY29sLm5hbWUsIGNsczogXCJ6aWJhc2UtZ2FsbGVyeS1maWVsZC1uYW1lXCIgfSk7XG4gICAgICB9IGVsc2UgaWYgKGNvbC50eXBlLmtpbmQgPT09IFwibGFiZWxcIikge1xuICAgICAgICBjb25zdCBjaGlwID0gZmllbGQuY3JlYXRlU3Bhbih7IHRleHQ6IHJhd1ZhbHVlLCBjbHM6IFwiemliYXNlLWxhYmVsXCIgfSk7XG4gICAgICAgIGNoaXAuc2V0Q3NzUHJvcHMoeyBcIi0tbGNcIjogZ2V0TGFiZWxDb2xvcihyYXdWYWx1ZSkgfSk7XG4gICAgICB9IGVsc2UgaWYgKGNvbC50eXBlLmtpbmQgPT09IFwic2VsZWN0XCIpIHtcbiAgICAgICAgZmllbGQuY3JlYXRlU3Bhbih7IHRleHQ6IHJhd1ZhbHVlLCBjbHM6IFwiemliYXNlLWdhbGxlcnktZmllbGQtc2VsZWN0XCIgfSk7XG4gICAgICB9IGVsc2UgaWYgKGNvbC50eXBlLmtpbmQgPT09IFwiZGF0ZVwiKSB7XG4gICAgICAgIGZpZWxkLmNyZWF0ZVNwYW4oeyB0ZXh0OiBcIlx1RDgzRFx1RENDNSBcIiwgY2xzOiBcInppYmFzZS1nYWxsZXJ5LWZpZWxkLWljb25cIiB9KTtcbiAgICAgICAgZmllbGQuY3JlYXRlU3Bhbih7IHRleHQ6IHJhd1ZhbHVlLCBjbHM6IFwiemliYXNlLWRhdGUtcmVuZGVyZWRcIiB9KTtcbiAgICAgIH0gZWxzZSBpZiAoY29sLnR5cGUua2luZCA9PT0gXCJudW1iZXJcIiB8fCBjb2wudHlwZS5raW5kID09PSBcImZvcm11bGFcIikge1xuICAgICAgICBmaWVsZC5jcmVhdGVTcGFuKHsgdGV4dDogY29sLm5hbWUgKyBcIjogXCIsIGNsczogXCJ6aWJhc2UtZ2FsbGVyeS1maWVsZC1uYW1lXCIgfSk7XG4gICAgICAgIGZpZWxkLmNyZWF0ZVNwYW4oeyB0ZXh0OiByYXdWYWx1ZSwgY2xzOiBcInppYmFzZS1nYWxsZXJ5LWZpZWxkLXZhbHVlXCIgfSk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBmaWVsZC5jcmVhdGVTcGFuKHsgdGV4dDogcmF3VmFsdWUsIGNsczogXCJ6aWJhc2UtZ2FsbGVyeS1maWVsZC12YWx1ZVwiIH0pO1xuICAgICAgfVxuICAgIH0pO1xuICB9KTtcbn1cbiIsICJpbXBvcnQgeyBDb21wb25lbnQsIE1hcmtkb3duUmVuZGVyZXIsIHR5cGUgTWFya2Rvd25Qb3N0UHJvY2Vzc29yQ29udGV4dCwgdHlwZSBNYXJrZG93blNlY3Rpb25JbmZvcm1hdGlvbiB9IGZyb20gXCJvYnNpZGlhblwiO1xuaW1wb3J0IHsgZmlsdGVyRGF0YVJvd3MsIHBhcnNlQm9vbCwgcGFyc2VNdWx0aVNlbGVjdCwgc3BsaXRSb3cgfSBmcm9tIFwiLi4vc2NoZW1hXCI7XG5pbXBvcnQgdHlwZSB7IFRhYmxlU2NoZW1hLCBaaUJhc2VIb3N0IH0gZnJvbSBcIi4uL3R5cGVzXCI7XG5pbXBvcnQgeyBnZXRMYWJlbENvbG9yIH0gZnJvbSBcIi4uL3VpXCI7XG5cbmV4cG9ydCBmdW5jdGlvbiBidWlsZEthbmJhblZpZXcoXG4gIGhvc3Q6IFppQmFzZUhvc3QsXG4gIGJvZHk6IEhUTUxFbGVtZW50LFxuICBzY2hlbWE6IFRhYmxlU2NoZW1hLFxuICBnZXREYXRhUm93czogKCkgPT4gc3RyaW5nW10sXG4gIHJhd0RhdGFMaW5lczogc3RyaW5nW10sXG4gIGNvbnRleHQ6IE1hcmtkb3duUG9zdFByb2Nlc3NvckNvbnRleHQsXG4gIHNlY3Rpb25JbmZvOiBNYXJrZG93blNlY3Rpb25JbmZvcm1hdGlvbixcbiAgZmlsdGVyUXVlcnk6IHN0cmluZyxcbik6IHZvaWQge1xuICBjb25zdCBncm91cENvbCA9IHNjaGVtYS5jb2x1bW5zLmZpbmQoXG4gICAgKGMpID0+IGMudHlwZS5raW5kID09PSBcInNlbGVjdFwiIHx8IGMudHlwZS5raW5kID09PSBcImxhYmVsXCIgfHwgYy50eXBlLmtpbmQgPT09IFwibXVsdGktc2VsZWN0XCIsXG4gICk7XG4gIGlmICghZ3JvdXBDb2wpIHtcbiAgICBjb25zdCBub3RpY2UgPSBib2R5LmNyZWF0ZURpdihcInppYmFzZS1rYW5iYW4gemliYXNlLWthbmJhbi1ub3RpY2VcIik7XG4gICAgbm90aWNlLnRleHRDb250ZW50ID0gXCJLYW5iYW4gcmVxdWlyZXMgYSBTZWxlY3Qgb3IgTGFiZWwgY29sdW1uIHRvIGdyb3VwIGJ5LlwiO1xuICAgIHJldHVybjtcbiAgfVxuXG4gIGNvbnN0IGthbmJhbiA9IGJvZHkuY3JlYXRlRGl2KFwiemliYXNlLWthbmJhblwiKTtcbiAgY29uc3QgZGF0YVJvd3MgPSBmaWx0ZXJEYXRhUm93cyhnZXREYXRhUm93cygpLCBmaWx0ZXJRdWVyeSk7XG5cbiAgY29uc3QgZ3JvdXBzID0gbmV3IE1hcDxzdHJpbmcsIHsgbGluZTogc3RyaW5nOyBjZWxsczogc3RyaW5nW10gfVtdPigpO1xuICBkYXRhUm93cy5mb3JFYWNoKChsaW5lKSA9PiB7XG4gICAgY29uc3QgY2VsbHMgPSBzcGxpdFJvdyhsaW5lKTtcbiAgICBjb25zdCByYXdHcm91cFZhbHVlID0gKGNlbGxzW2dyb3VwQ29sLmluZGV4XSA/PyBcIlwiKS50cmltKCkgfHwgXCJcdTIwMTRcIjtcbiAgICBsZXQgZ3JvdXBWYWx1ZXMgPSBbcmF3R3JvdXBWYWx1ZV07XG4gICAgaWYgKGdyb3VwQ29sLnR5cGUua2luZCA9PT0gXCJtdWx0aS1zZWxlY3RcIiAmJiByYXdHcm91cFZhbHVlICE9PSBcIlx1MjAxNFwiKSB7XG4gICAgICBncm91cFZhbHVlcyA9IHBhcnNlTXVsdGlTZWxlY3QocmF3R3JvdXBWYWx1ZSk7XG4gICAgICBpZiAoZ3JvdXBWYWx1ZXMubGVuZ3RoID09PSAwKSBncm91cFZhbHVlcyA9IFtcIlx1MjAxNFwiXTtcbiAgICB9XG4gICAgZ3JvdXBWYWx1ZXMuZm9yRWFjaCgoZ3YpID0+IHtcbiAgICAgIGlmICghZ3JvdXBzLmhhcyhndikpIGdyb3Vwcy5zZXQoZ3YsIFtdKTtcbiAgICAgIGdyb3Vwcy5nZXQoZ3YpIS5wdXNoKHsgbGluZSwgY2VsbHMgfSk7XG4gICAgfSk7XG4gIH0pO1xuXG4gIGxldCBncm91cEtleXM6IHN0cmluZ1tdO1xuICBpZiAoZ3JvdXBDb2wudHlwZS5raW5kID09PSBcInNlbGVjdFwiICYmIGdyb3VwQ29sLnR5cGUub3B0aW9ucykge1xuICAgIGdyb3VwS2V5cyA9IFsuLi5ncm91cENvbC50eXBlLm9wdGlvbnNdO1xuICAgIGZvciAoY29uc3Qga2V5IG9mIGdyb3Vwcy5rZXlzKCkpIHtcbiAgICAgIGlmICghZ3JvdXBLZXlzLmluY2x1ZGVzKGtleSkpIGdyb3VwS2V5cy5wdXNoKGtleSk7XG4gICAgfVxuICB9IGVsc2Uge1xuICAgIGdyb3VwS2V5cyA9IFsuLi5ncm91cHMua2V5cygpXTtcbiAgfVxuXG4gIGNvbnN0IGxhbmVDb250YWluZXIgPSBrYW5iYW4uY3JlYXRlRGl2KFwiemliYXNlLWthbmJhbi1sYW5lc1wiKTtcblxuICBncm91cEtleXMuZm9yRWFjaCgoZ3JvdXBWYWx1ZSkgPT4ge1xuICAgIGNvbnN0IGl0ZW1zID0gZ3JvdXBzLmdldChncm91cFZhbHVlKSB8fCBbXTtcbiAgICBjb25zdCBsYW5lID0gbGFuZUNvbnRhaW5lci5jcmVhdGVEaXYoXCJ6aWJhc2Uta2FuYmFuLWxhbmVcIik7XG4gICAgY29uc3QgY29sb3IgPSBnZXRMYWJlbENvbG9yKGdyb3VwVmFsdWUpO1xuXG4gICAgY29uc3QgaGVhZGVyID0gbGFuZS5jcmVhdGVEaXYoXCJ6aWJhc2Uta2FuYmFuLWxhbmUtaGVhZGVyXCIpO1xuICAgIGhlYWRlci5zZXRDc3NQcm9wcyh7IFwiLS1sYW5lLWNvbG9yXCI6IGNvbG9yIH0pO1xuICAgIGNvbnN0IGhlYWRlckxhYmVsID0gaGVhZGVyLmNyZWF0ZVNwYW4oeyB0ZXh0OiBncm91cFZhbHVlLCBjbHM6IFwiemliYXNlLWthbmJhbi1sYW5lLXRpdGxlXCIgfSk7XG4gICAgaGVhZGVyTGFiZWwuc2V0Q3NzU3R5bGVzKHsgY29sb3IgfSk7XG4gICAgaGVhZGVyLmNyZWF0ZVNwYW4oeyB0ZXh0OiBgJHtpdGVtcy5sZW5ndGh9YCwgY2xzOiBcInppYmFzZS1rYW5iYW4tbGFuZS1jb3VudFwiIH0pO1xuXG4gICAgY29uc3QgbGFuZUJvZHkgPSBsYW5lLmNyZWF0ZURpdihcInppYmFzZS1rYW5iYW4tbGFuZS1ib2R5XCIpO1xuICAgIGxhbmVCb2R5LmRhdGFzZXQuZ3JvdXAgPSBncm91cFZhbHVlO1xuXG4gICAgbGFuZUJvZHkuYWRkRXZlbnRMaXN0ZW5lcihcImRyYWdvdmVyXCIsIChlKSA9PiB7XG4gICAgICBlLnByZXZlbnREZWZhdWx0KCk7XG4gICAgICBsYW5lQm9keS5jbGFzc0xpc3QuYWRkKFwiemliYXNlLWthbmJhbi1sYW5lLWRyYWdvdmVyXCIpO1xuICAgIH0pO1xuICAgIGxhbmVCb2R5LmFkZEV2ZW50TGlzdGVuZXIoXCJkcmFnbGVhdmVcIiwgKCkgPT4ge1xuICAgICAgbGFuZUJvZHkuY2xhc3NMaXN0LnJlbW92ZShcInppYmFzZS1rYW5iYW4tbGFuZS1kcmFnb3ZlclwiKTtcbiAgICB9KTtcbiAgICBsYW5lQm9keS5hZGRFdmVudExpc3RlbmVyKFwiZHJvcFwiLCAoZSkgPT4ge1xuICAgICAgZS5wcmV2ZW50RGVmYXVsdCgpO1xuICAgICAgbGFuZUJvZHkuY2xhc3NMaXN0LnJlbW92ZShcInppYmFzZS1rYW5iYW4tbGFuZS1kcmFnb3ZlclwiKTtcbiAgICAgIGNvbnN0IGZyb21JZHhTdHIgPSBlLmRhdGFUcmFuc2Zlcj8uZ2V0RGF0YShcInRleHQva2FuYmFuLXJvd1wiKTtcbiAgICAgIGlmICghZnJvbUlkeFN0cikgcmV0dXJuO1xuICAgICAgY29uc3QgZnJvbUlkeCA9IHBhcnNlSW50KGZyb21JZHhTdHIsIDEwKTtcbiAgICAgIGxldCBuZXdWYWx1ZSA9IGdyb3VwVmFsdWU7XG4gICAgICBpZiAoZ3JvdXBDb2wudHlwZS5raW5kID09PSBcIm11bHRpLXNlbGVjdFwiKSB7XG4gICAgICAgIGNvbnN0IHJvd0xpbmUgPSByYXdEYXRhTGluZXNbZnJvbUlkeF07XG4gICAgICAgIGNvbnN0IHJvd0NlbGxzID0gc3BsaXRSb3cocm93TGluZSk7XG4gICAgICAgIGNvbnN0IGN1cnJlbnRSYXcgPSAocm93Q2VsbHNbZ3JvdXBDb2wuaW5kZXhdIHx8IFwiXCIpLnRyaW0oKTtcbiAgICAgICAgY29uc3QgdGFncyA9IHBhcnNlTXVsdGlTZWxlY3QoY3VycmVudFJhdyk7XG4gICAgICAgIGlmICghdGFncy5pbmNsdWRlcyhncm91cFZhbHVlKSkgdGFncy5wdXNoKGdyb3VwVmFsdWUpO1xuICAgICAgICBuZXdWYWx1ZSA9IHRhZ3Muam9pbihcIiwgXCIpO1xuICAgICAgfVxuICAgICAgdm9pZCBob3N0LndyaXRlQmFjayhjb250ZXh0LCBzZWN0aW9uSW5mbywgc2NoZW1hLmRhdGFTdGFydEluZGV4ICsgZnJvbUlkeCwgZ3JvdXBDb2wuaW5kZXgsIG5ld1ZhbHVlKTtcbiAgICB9KTtcblxuICAgIGl0ZW1zLmZvckVhY2goKHsgbGluZSwgY2VsbHMgfSkgPT4ge1xuICAgICAgY29uc3QgcmF3SWR4ID0gcmF3RGF0YUxpbmVzLmZpbmRJbmRleCgobCkgPT4gbCA9PT0gbGluZSk7XG4gICAgICBjb25zdCBjYXJkID0gbGFuZUJvZHkuY3JlYXRlRGl2KFwiemliYXNlLWthbmJhbi1jYXJkXCIpO1xuICAgICAgY2FyZC5kcmFnZ2FibGUgPSB0cnVlO1xuICAgICAgY2FyZC5hZGRFdmVudExpc3RlbmVyKFwiZHJhZ3N0YXJ0XCIsIChlKSA9PiB7XG4gICAgICAgIGUuZGF0YVRyYW5zZmVyPy5zZXREYXRhKFwidGV4dC9rYW5iYW4tcm93XCIsIHJhd0lkeC50b1N0cmluZygpKTtcbiAgICAgICAgY2FyZC5jbGFzc0xpc3QuYWRkKFwiemliYXNlLWthbmJhbi1jYXJkLWRyYWdnaW5nXCIpO1xuICAgICAgfSk7XG4gICAgICBjYXJkLmFkZEV2ZW50TGlzdGVuZXIoXCJkcmFnZW5kXCIsICgpID0+IHtcbiAgICAgICAgY2FyZC5jbGFzc0xpc3QucmVtb3ZlKFwiemliYXNlLWthbmJhbi1jYXJkLWRyYWdnaW5nXCIpO1xuICAgICAgfSk7XG5cbiAgICAgIHNjaGVtYS5jb2x1bW5zLmZvckVhY2goKGNvbCwgY29sSWR4KSA9PiB7XG4gICAgICAgIGlmIChjb2xJZHggPT09IGdyb3VwQ29sLmluZGV4KSByZXR1cm47XG4gICAgICAgIGNvbnN0IHJhd1ZhbHVlID0gKGNlbGxzW2NvbElkeF0gPz8gXCJcIikudHJpbSgpO1xuICAgICAgICBpZiAoIXJhd1ZhbHVlKSByZXR1cm47XG5cbiAgICAgICAgaWYgKGNvbC50eXBlLmtpbmQgPT09IFwidGV4dFwiKSB7XG4gICAgICAgICAgaWYgKCFjYXJkLnF1ZXJ5U2VsZWN0b3IoXCIuemliYXNlLWthbmJhbi1jYXJkLXRpdGxlXCIpKSB7XG4gICAgICAgICAgICBjb25zdCB0aXRsZUVsID0gY2FyZC5jcmVhdGVEaXYoXCJ6aWJhc2Uta2FuYmFuLWNhcmQtdGl0bGVcIik7XG4gICAgICAgICAgICB2b2lkIE1hcmtkb3duUmVuZGVyZXIucmVuZGVyKGhvc3QuYXBwLCByYXdWYWx1ZSwgdGl0bGVFbCwgY29udGV4dC5zb3VyY2VQYXRoLCBuZXcgQ29tcG9uZW50KCkpO1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIGNvbnN0IGZpZWxkID0gY2FyZC5jcmVhdGVEaXYoXCJ6aWJhc2Uta2FuYmFuLWNhcmQtZmllbGRcIik7XG4gICAgICAgIGZpZWxkLmNyZWF0ZVNwYW4oeyB0ZXh0OiBjb2wubmFtZSwgY2xzOiBcInppYmFzZS1rYW5iYW4tZmllbGQtbGFiZWxcIiB9KTtcblxuICAgICAgICBpZiAoY29sLnR5cGUua2luZCA9PT0gXCJsYWJlbFwiKSB7XG4gICAgICAgICAgY29uc3QgY2hpcCA9IGZpZWxkLmNyZWF0ZVNwYW4oeyB0ZXh0OiByYXdWYWx1ZSwgY2xzOiBcInppYmFzZS1sYWJlbCB6aWJhc2Uta2FuYmFuLWxhYmVsXCIgfSk7XG4gICAgICAgICAgY2hpcC5zZXRDc3NQcm9wcyh7IFwiLS1sY1wiOiBnZXRMYWJlbENvbG9yKHJhd1ZhbHVlKSB9KTtcbiAgICAgICAgfSBlbHNlIGlmIChjb2wudHlwZS5raW5kID09PSBcInRvZ2dsZVwiKSB7XG4gICAgICAgICAgZmllbGQuY3JlYXRlU3Bhbih7IHRleHQ6IHBhcnNlQm9vbChyYXdWYWx1ZSkgPyBcIlx1MjcwNVwiIDogXCJcdTJCMUNcIiwgY2xzOiBcInppYmFzZS1rYW5iYW4tZmllbGQtdmFsdWVcIiB9KTtcbiAgICAgICAgfSBlbHNlIGlmIChjb2wudHlwZS5raW5kID09PSBcIm51bWJlclwiIHx8IGNvbC50eXBlLmtpbmQgPT09IFwiZm9ybXVsYVwiKSB7XG4gICAgICAgICAgZmllbGQuY3JlYXRlU3Bhbih7IHRleHQ6IHJhd1ZhbHVlLCBjbHM6IFwiemliYXNlLWthbmJhbi1maWVsZC12YWx1ZVwiIH0pO1xuICAgICAgICB9IGVsc2UgaWYgKGNvbC50eXBlLmtpbmQgPT09IFwiZGF0ZVwiKSB7XG4gICAgICAgICAgZmllbGQuY3JlYXRlU3Bhbih7IHRleHQ6IHJhd1ZhbHVlLCBjbHM6IFwiemliYXNlLWthbmJhbi1maWVsZC12YWx1ZSB6aWJhc2UtZGF0ZS1yZW5kZXJlZFwiIH0pO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIGZpZWxkLmNyZWF0ZVNwYW4oeyB0ZXh0OiByYXdWYWx1ZSwgY2xzOiBcInppYmFzZS1rYW5iYW4tZmllbGQtdmFsdWVcIiB9KTtcbiAgICAgICAgfVxuICAgICAgfSk7XG5cbiAgICAgIGlmICghY2FyZC5xdWVyeVNlbGVjdG9yKFwiLnppYmFzZS1rYW5iYW4tY2FyZC10aXRsZVwiKSkge1xuICAgICAgICBjb25zdCB0aXRsZUVsID0gY3JlYXRlRGl2KCk7XG4gICAgICAgIHRpdGxlRWwuY2xhc3NOYW1lID0gXCJ6aWJhc2Uta2FuYmFuLWNhcmQtdGl0bGVcIjtcbiAgICAgICAgdm9pZCBNYXJrZG93blJlbmRlcmVyLnJlbmRlcihob3N0LmFwcCwgY2VsbHNbMF0gfHwgXCJcdTIwMTRcIiwgdGl0bGVFbCwgY29udGV4dC5zb3VyY2VQYXRoLCBuZXcgQ29tcG9uZW50KCkpO1xuICAgICAgICBjYXJkLmluc2VydEJlZm9yZSh0aXRsZUVsLCBjYXJkLmZpcnN0Q2hpbGQpO1xuICAgICAgfVxuICAgIH0pO1xuICB9KTtcbn1cbiIsICJpbXBvcnQgeyBURmlsZSwgdHlwZSBNYXJrZG93blBvc3RQcm9jZXNzb3JDb250ZXh0LCB0eXBlIE1hcmtkb3duU2VjdGlvbkluZm9ybWF0aW9uIH0gZnJvbSBcIm9ic2lkaWFuXCI7XG5pbXBvcnQgeyBmb3JtYXRSZXN1bHQgfSBmcm9tIFwiLi4vZm9ybXVsYVwiO1xuaW1wb3J0IHsgZmlsdGVyRGF0YVJvd3MsIHNlcmlhbGl6ZVJvdywgc3BsaXRSb3cgfSBmcm9tIFwiLi4vc2NoZW1hXCI7XG5pbXBvcnQgdHlwZSB7IFRhYmxlU2NoZW1hLCBaaUJhc2VIb3N0IH0gZnJvbSBcIi4uL3R5cGVzXCI7XG5pbXBvcnQgeyBnZXRUeXBlSWNvbiB9IGZyb20gXCIuLi91aVwiO1xuXG5pbnRlcmZhY2UgU3RhdFRoIGV4dGVuZHMgSFRNTFRhYmxlQ2VsbEVsZW1lbnQge1xuICBfdXBkYXRlU3RhdD86ICgpID0+IHZvaWQ7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBidWlsZFRhYmxlVmlldyhcbiAgaG9zdDogWmlCYXNlSG9zdCxcbiAgYm9keTogSFRNTEVsZW1lbnQsXG4gIHNjaGVtYTogVGFibGVTY2hlbWEsXG4gIGdldERhdGFSb3dzOiAoKSA9PiBzdHJpbmdbXSxcbiAgcmF3RGF0YUxpbmVzOiBzdHJpbmdbXSxcbiAgY29udGV4dDogTWFya2Rvd25Qb3N0UHJvY2Vzc29yQ29udGV4dCxcbiAgc2VjdGlvbkluZm86IE1hcmtkb3duU2VjdGlvbkluZm9ybWF0aW9uLFxuICBmaWx0ZXJRdWVyeTogc3RyaW5nLFxuICBzb3J0Q29sSWR4OiBudW1iZXIgfCBudWxsLFxuICBzb3J0QXNjOiBib29sZWFuLFxuICBiYWRnZTogSFRNTEVsZW1lbnQsXG4gIG9uU29ydENoYW5nZTogKGNvbDogbnVtYmVyLCBhc2M6IGJvb2xlYW4pID0+IHZvaWQsXG4pOiB2b2lkIHtcbiAgY29uc3QgdGFibGVFbCA9IGJvZHkuY3JlYXRlRWwoXCJ0YWJsZVwiLCB7IGNsczogXCJ6aWJhc2UtdGFibGVcIiB9KTtcbiAgY29uc3QgdGhlYWQgPSB0YWJsZUVsLmNyZWF0ZUVsKFwidGhlYWRcIik7XG4gIGNvbnN0IGhlYWRlclJvdyA9IHRoZWFkLmNyZWF0ZUVsKFwidHJcIik7XG4gIGNvbnN0IHN0YXRNb2RlczogUmVjb3JkPG51bWJlciwgc3RyaW5nPiA9IHt9O1xuXG4gIHNjaGVtYS5jb2x1bW5zLmZvckVhY2goKGNvbCwgY29sSWR4KSA9PiB7XG4gICAgY29uc3QgdGggPSBoZWFkZXJSb3cuY3JlYXRlRWwoXCJ0aFwiLCB7IGNsczogXCJ6aWJhc2UtdGhcIiB9KSBhcyBTdGF0VGg7XG4gICAgdGguZHJhZ2dhYmxlID0gdHJ1ZTtcbiAgICB0aC5hZGRFdmVudExpc3RlbmVyKFwiZHJhZ3N0YXJ0XCIsIChlKSA9PiB7XG4gICAgICBlLnN0b3BQcm9wYWdhdGlvbigpO1xuICAgICAgZS5kYXRhVHJhbnNmZXI/LnNldERhdGEoXCJ0ZXh0L2NvbFwiLCBjb2xJZHgudG9TdHJpbmcoKSk7XG4gICAgfSk7XG4gICAgdGguYWRkRXZlbnRMaXN0ZW5lcihcImRyYWdvdmVyXCIsIChlKSA9PiB7XG4gICAgICBlLnByZXZlbnREZWZhdWx0KCk7XG4gICAgICB0aC5jbGFzc0xpc3QuYWRkKFwiemliYXNlLXRoLWRyb3AtdGFyZ2V0XCIpO1xuICAgIH0pO1xuICAgIHRoLmFkZEV2ZW50TGlzdGVuZXIoXCJkcmFnbGVhdmVcIiwgKCkgPT4gdGguY2xhc3NMaXN0LnJlbW92ZShcInppYmFzZS10aC1kcm9wLXRhcmdldFwiKSk7XG4gICAgdGguYWRkRXZlbnRMaXN0ZW5lcihcImRyYWdlbmRcIiwgKCkgPT4ge1xuICAgICAgdGhlYWQucXVlcnlTZWxlY3RvckFsbChcIi56aWJhc2UtdGhcIikuZm9yRWFjaCgoZWwpID0+IGVsLmNsYXNzTGlzdC5yZW1vdmUoXCJ6aWJhc2UtdGgtZHJvcC10YXJnZXRcIikpO1xuICAgIH0pO1xuICAgIHRoLmFkZEV2ZW50TGlzdGVuZXIoXCJkcm9wXCIsIChlKSA9PiB7XG4gICAgICBlLnByZXZlbnREZWZhdWx0KCk7XG4gICAgICBlLnN0b3BQcm9wYWdhdGlvbigpO1xuICAgICAgdGguY2xhc3NMaXN0LnJlbW92ZShcInppYmFzZS10aC1kcm9wLXRhcmdldFwiKTtcbiAgICAgIGNvbnN0IGZyb21Db2xTdHIgPSBlLmRhdGFUcmFuc2Zlcj8uZ2V0RGF0YShcInRleHQvY29sXCIpO1xuICAgICAgaWYgKCFmcm9tQ29sU3RyKSByZXR1cm47XG4gICAgICBjb25zdCBmcm9tQ29sSWR4ID0gcGFyc2VJbnQoZnJvbUNvbFN0ciwgMTApO1xuICAgICAgaWYgKGZyb21Db2xJZHggPT09IGNvbElkeCkgcmV0dXJuO1xuICAgICAgdm9pZCAoYXN5bmMgKCkgPT4ge1xuICAgICAgICBjb25zdCBmaWxlID0gaG9zdC5hcHAudmF1bHQuZ2V0QWJzdHJhY3RGaWxlQnlQYXRoKGNvbnRleHQuc291cmNlUGF0aCk7XG4gICAgICAgIGlmICghKGZpbGUgaW5zdGFuY2VvZiBURmlsZSkpIHJldHVybjtcbiAgICAgICAgYXdhaXQgaG9zdC5hcHAudmF1bHQucHJvY2VzcyhmaWxlLCAoY29udGVudCkgPT4ge1xuICAgICAgICAgIGNvbnN0IGFsbExpbmVzID0gY29udGVudC5zcGxpdChcIlxcblwiKTtcbiAgICAgICAgICBmb3IgKGxldCBpID0gc2VjdGlvbkluZm8ubGluZVN0YXJ0OyBpIDw9IHNlY3Rpb25JbmZvLmxpbmVFbmQ7IGkrKykge1xuICAgICAgICAgICAgY29uc3QgbGluZSA9IGFsbExpbmVzW2ldO1xuICAgICAgICAgICAgaWYgKCFsaW5lLmluY2x1ZGVzKFwifFwiKSkgY29udGludWU7XG4gICAgICAgICAgICBjb25zdCBjZWxscyA9IHNwbGl0Um93KGxpbmUpO1xuICAgICAgICAgICAgaWYgKGNlbGxzLmxlbmd0aCA8PSBmcm9tQ29sSWR4IHx8IGNlbGxzLmxlbmd0aCA8PSBjb2xJZHgpIGNvbnRpbnVlO1xuICAgICAgICAgICAgY29uc3QgZHJhZ2dlZENlbGwgPSBjZWxscy5zcGxpY2UoZnJvbUNvbElkeCwgMSlbMF07XG4gICAgICAgICAgICBsZXQgaW5zZXJ0SWR4ID0gY29sSWR4O1xuICAgICAgICAgICAgaWYgKGZyb21Db2xJZHggPCBjb2xJZHgpIGluc2VydElkeC0tO1xuICAgICAgICAgICAgY2VsbHMuc3BsaWNlKGluc2VydElkeCwgMCwgZHJhZ2dlZENlbGwpO1xuICAgICAgICAgICAgYWxsTGluZXNbaV0gPSBzZXJpYWxpemVSb3coY2VsbHMpO1xuICAgICAgICAgIH1cbiAgICAgICAgICByZXR1cm4gYWxsTGluZXMuam9pbihcIlxcblwiKTtcbiAgICAgICAgfSk7XG4gICAgICB9KSgpO1xuICAgIH0pO1xuXG4gICAgY29uc3QgdGhJbm5lciA9IHRoLmNyZWF0ZURpdihcInppYmFzZS10aC1pbm5lclwiKTtcbiAgICB0aElubmVyLmNyZWF0ZVNwYW4oeyB0ZXh0OiBjb2wubmFtZSwgY2xzOiBcInppYmFzZS10aC1uYW1lXCIgfSk7XG4gICAgdGhJbm5lci5jcmVhdGVTcGFuKHsgdGV4dDogZ2V0VHlwZUljb24oY29sLnR5cGUpLCBjbHM6IFwiemliYXNlLXR5cGUtaWNvblwiIH0pO1xuICAgIHRoSW5uZXIuY3JlYXRlU3Bhbih7IGNsczogXCJ6aWJhc2Utc29ydC1hcnJvd1wiLCB0ZXh0OiBcIlx1MjE5NVwiIH0pO1xuXG4gICAgaWYgKGNvbC50eXBlLmtpbmQgPT09IFwibnVtYmVyXCIgfHwgY29sLnR5cGUua2luZCA9PT0gXCJmb3JtdWxhXCIpIHtcbiAgICAgIGlmICghc3RhdE1vZGVzW2NvbElkeF0pIHN0YXRNb2Rlc1tjb2xJZHhdID0gXCJTVU1cIjtcbiAgICAgIGNvbnN0IHN0YXRCYWRnZSA9IHRoLmNyZWF0ZURpdihcInppYmFzZS10aC1zdGF0XCIpO1xuXG4gICAgICBjb25zdCB1cGRhdGVUaFN0YXQgPSAoKSA9PiB7XG4gICAgICAgIGNvbnN0IGRhdGFSb3dzID0gZmlsdGVyRGF0YVJvd3MoZ2V0RGF0YVJvd3MoKSwgZmlsdGVyUXVlcnkpO1xuICAgICAgICBjb25zdCB2YWx1ZXMgPSBkYXRhUm93c1xuICAgICAgICAgIC5tYXAoKGxpbmUpID0+IHBhcnNlRmxvYXQoKHNwbGl0Um93KGxpbmUpW2NvbElkeF0gPz8gXCJcIikudHJpbSgpKSlcbiAgICAgICAgICAuZmlsdGVyKChuKSA9PiAhTnVtYmVyLmlzTmFOKG4pKTtcblxuICAgICAgICBpZiAodmFsdWVzLmxlbmd0aCA9PT0gMCkge1xuICAgICAgICAgIHN0YXRCYWRnZS50ZXh0Q29udGVudCA9IFwiXCI7XG4gICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG5cbiAgICAgICAgY29uc3QgbW9kZSA9IHN0YXRNb2Rlc1tjb2xJZHhdO1xuICAgICAgICBsZXQgcmVzdWx0ID0gMDtcbiAgICAgICAgc3dpdGNoIChtb2RlKSB7XG4gICAgICAgICAgY2FzZSBcIlNVTVwiOiByZXN1bHQgPSB2YWx1ZXMucmVkdWNlKChhLCBiKSA9PiBhICsgYiwgMCk7IGJyZWFrO1xuICAgICAgICAgIGNhc2UgXCJBVkdcIjogcmVzdWx0ID0gdmFsdWVzLnJlZHVjZSgoYSwgYikgPT4gYSArIGIsIDApIC8gdmFsdWVzLmxlbmd0aDsgYnJlYWs7XG4gICAgICAgICAgY2FzZSBcIk1JTlwiOiByZXN1bHQgPSBNYXRoLm1pbiguLi52YWx1ZXMpOyBicmVhaztcbiAgICAgICAgICBjYXNlIFwiTUFYXCI6IHJlc3VsdCA9IE1hdGgubWF4KC4uLnZhbHVlcyk7IGJyZWFrO1xuICAgICAgICAgIGRlZmF1bHQ6IHJlc3VsdCA9IDA7XG4gICAgICAgIH1cblxuICAgICAgICBzdGF0QmFkZ2UuZW1wdHkoKTtcbiAgICAgICAgc3RhdEJhZGdlLmNyZWF0ZVNwYW4oeyB0ZXh0OiBtb2RlLCBjbHM6IFwiemliYXNlLXRoLXN0YXQtbW9kZVwiIH0pO1xuICAgICAgICBzdGF0QmFkZ2UuY3JlYXRlU3Bhbih7IHRleHQ6IFwiIFwiICsgZm9ybWF0UmVzdWx0KHJlc3VsdCksIGNsczogXCJ6aWJhc2UtdGgtc3RhdC12YWx1ZVwiIH0pO1xuICAgICAgfTtcblxuICAgICAgc3RhdEJhZGdlLmFkZEV2ZW50TGlzdGVuZXIoXCJjbGlja1wiLCAoZSkgPT4ge1xuICAgICAgICBlLnN0b3BQcm9wYWdhdGlvbigpO1xuICAgICAgICBjb25zdCBtb2RlcyA9IFtcIlNVTVwiLCBcIkFWR1wiLCBcIk1JTlwiLCBcIk1BWFwiXTtcbiAgICAgICAgY29uc3QgY3VycmVudCA9IG1vZGVzLmluZGV4T2Yoc3RhdE1vZGVzW2NvbElkeF0pO1xuICAgICAgICBzdGF0TW9kZXNbY29sSWR4XSA9IG1vZGVzWyhjdXJyZW50ICsgMSkgJSBtb2Rlcy5sZW5ndGhdO1xuICAgICAgICB1cGRhdGVUaFN0YXQoKTtcbiAgICAgIH0pO1xuXG4gICAgICB0aC5fdXBkYXRlU3RhdCA9IHVwZGF0ZVRoU3RhdDtcbiAgICAgIHVwZGF0ZVRoU3RhdCgpO1xuICAgIH1cblxuICAgIHRoLmFkZEV2ZW50TGlzdGVuZXIoXCJjbGlja1wiLCAoKSA9PiB7XG4gICAgICBjb25zdCBuZXdBc2MgPSBzb3J0Q29sSWR4ID09PSBjb2xJZHggPyAhc29ydEFzYyA6IHRydWU7XG4gICAgICBvblNvcnRDaGFuZ2UoY29sSWR4LCBuZXdBc2MpO1xuICAgICAgdGhlYWQucXVlcnlTZWxlY3RvckFsbChcIi56aWJhc2Utc29ydC1hcnJvd1wiKS5mb3JFYWNoKChlbCwgaSkgPT4ge1xuICAgICAgICBlbC50ZXh0Q29udGVudCA9IGkgPT09IGNvbElkeCA/IChuZXdBc2MgPyBcIlx1MjE5MVwiIDogXCJcdTIxOTNcIikgOiBcIlx1MjE5NVwiO1xuICAgICAgICBlbC5jbGFzc0xpc3QudG9nZ2xlKFwiemliYXNlLXNvcnQtYWN0aXZlXCIsIGkgPT09IGNvbElkeCk7XG4gICAgICB9KTtcbiAgICAgIHJlbmRlclJvd3MoKTtcbiAgICAgIHRoZWFkLnF1ZXJ5U2VsZWN0b3JBbGwoXCIuemliYXNlLXRoXCIpLmZvckVhY2goKHRoRWwpID0+IHtcbiAgICAgICAgY29uc3Qgc3RhdFRoID0gdGhFbCBhcyBTdGF0VGg7XG4gICAgICAgIGlmIChzdGF0VGguX3VwZGF0ZVN0YXQpIHN0YXRUaC5fdXBkYXRlU3RhdCgpO1xuICAgICAgfSk7XG4gICAgfSk7XG4gICAgdGguYWRkRXZlbnRMaXN0ZW5lcihcImNvbnRleHRtZW51XCIsIChlKSA9PiB7XG4gICAgICBlLnByZXZlbnREZWZhdWx0KCk7XG4gICAgICBob3N0LnNob3dUeXBlTWVudShlLCBjb2xJZHgsIHNjaGVtYSwgY29udGV4dCwgc2VjdGlvbkluZm8sIHJhd0RhdGFMaW5lcywgYmFkZ2UpO1xuICAgIH0pO1xuICB9KTtcblxuICBjb25zdCB0Ym9keSA9IHRhYmxlRWwuY3JlYXRlRWwoXCJ0Ym9keVwiKTtcblxuICBjb25zdCByZW5kZXJSb3dzID0gKCkgPT4ge1xuICAgIHRib2R5LmVtcHR5KCk7XG4gICAgbGV0IGRhdGFSb3dzID0gZmlsdGVyRGF0YVJvd3MoZ2V0RGF0YVJvd3MoKSwgZmlsdGVyUXVlcnkpO1xuICAgIGlmIChzb3J0Q29sSWR4ICE9PSBudWxsKSB7XG4gICAgICBjb25zdCBpZHggPSBzb3J0Q29sSWR4O1xuICAgICAgY29uc3QgY29sVHlwZSA9IHNjaGVtYS5jb2x1bW5zW2lkeF0/LnR5cGUua2luZCA/PyBcInRleHRcIjtcbiAgICAgIGRhdGFSb3dzID0gWy4uLmRhdGFSb3dzXS5zb3J0KChhLCBiKSA9PiB7XG4gICAgICAgIGNvbnN0IGF2ID0gKHNwbGl0Um93KGEpW2lkeF0gPz8gXCJcIikudHJpbSgpO1xuICAgICAgICBjb25zdCBidiA9IChzcGxpdFJvdyhiKVtpZHhdID8/IFwiXCIpLnRyaW0oKTtcbiAgICAgICAgaWYgKGNvbFR5cGUgPT09IFwibnVtYmVyXCIgfHwgY29sVHlwZSA9PT0gXCJmb3JtdWxhXCIpIHtcbiAgICAgICAgICBjb25zdCBuYSA9IHBhcnNlRmxvYXQoYXYpO1xuICAgICAgICAgIGNvbnN0IG5iID0gcGFyc2VGbG9hdChidik7XG4gICAgICAgICAgaWYgKCFOdW1iZXIuaXNOYU4obmEpICYmICFOdW1iZXIuaXNOYU4obmIpKSByZXR1cm4gc29ydEFzYyA/IG5hIC0gbmIgOiBuYiAtIG5hO1xuICAgICAgICB9XG4gICAgICAgIGlmIChjb2xUeXBlID09PSBcImRhdGVcIikge1xuICAgICAgICAgIGNvbnN0IGRhID0gbmV3IERhdGUoYXYpLmdldFRpbWUoKTtcbiAgICAgICAgICBjb25zdCBkYiA9IG5ldyBEYXRlKGJ2KS5nZXRUaW1lKCk7XG4gICAgICAgICAgaWYgKCFOdW1iZXIuaXNOYU4oZGEpICYmICFOdW1iZXIuaXNOYU4oZGIpKSByZXR1cm4gc29ydEFzYyA/IGRhIC0gZGIgOiBkYiAtIGRhO1xuICAgICAgICB9XG4gICAgICAgIGlmIChjb2xUeXBlID09PSBcInRvZ2dsZVwiKSB7XG4gICAgICAgICAgY29uc3QgYmEgPSBhdi50b0xvd2VyQ2FzZSgpID09PSBcInRydWVcIiA/IDEgOiAwO1xuICAgICAgICAgIGNvbnN0IGJiID0gYnYudG9Mb3dlckNhc2UoKSA9PT0gXCJ0cnVlXCIgPyAxIDogMDtcbiAgICAgICAgICByZXR1cm4gc29ydEFzYyA/IGJhIC0gYmIgOiBiYiAtIGJhO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiBzb3J0QXNjID8gYXYubG9jYWxlQ29tcGFyZShidikgOiBidi5sb2NhbGVDb21wYXJlKGF2KTtcbiAgICAgIH0pO1xuICAgIH1cbiAgICBpZiAoZGF0YVJvd3MubGVuZ3RoID09PSAwKSB7XG4gICAgICBjb25zdCBlbXB0eVRkID0gdGJvZHkuY3JlYXRlRWwoXCJ0clwiKS5jcmVhdGVFbChcInRkXCIsIHsgY2xzOiBcInppYmFzZS1lbXB0eVwiIH0pO1xuICAgICAgZW1wdHlUZC5jb2xTcGFuID0gc2NoZW1hLmNvbHVtbnMubGVuZ3RoO1xuICAgICAgZW1wdHlUZC50ZXh0Q29udGVudCA9IGZpbHRlclF1ZXJ5ID8gXCJObyBtYXRjaGluZyByb3dzXCIgOiBcIk5vIGRhdGFcIjtcbiAgICAgIHJldHVybjtcbiAgICB9XG4gICAgZGF0YVJvd3MuZm9yRWFjaCgobGluZSkgPT4ge1xuICAgICAgY29uc3QgcmF3SWR4ID0gcmF3RGF0YUxpbmVzLmZpbmRJbmRleCgobCkgPT4gbCA9PT0gbGluZSk7XG4gICAgICBjb25zdCBjZWxscyA9IHNwbGl0Um93KGxpbmUpO1xuICAgICAgY29uc3QgdHIgPSB0Ym9keS5jcmVhdGVFbChcInRyXCIsIHsgY2xzOiBcInppYmFzZS1yb3dcIiB9KTtcbiAgICAgIHRyLmRyYWdnYWJsZSA9IHRydWU7XG4gICAgICB0ci5hZGRFdmVudExpc3RlbmVyKFwiZHJhZ3N0YXJ0XCIsIChlKSA9PiB7XG4gICAgICAgIGUuZGF0YVRyYW5zZmVyPy5zZXREYXRhKFwidGV4dC9yb3dcIiwgcmF3SWR4LnRvU3RyaW5nKCkpO1xuICAgICAgICB0ci5jbGFzc0xpc3QuYWRkKFwiemliYXNlLXJvdy1kcmFnZ2luZ1wiKTtcbiAgICAgIH0pO1xuICAgICAgdHIuYWRkRXZlbnRMaXN0ZW5lcihcImRyYWdlbmRcIiwgKCkgPT4ge1xuICAgICAgICB0ci5jbGFzc0xpc3QucmVtb3ZlKFwiemliYXNlLXJvdy1kcmFnZ2luZ1wiKTtcbiAgICAgICAgdGJvZHkucXVlcnlTZWxlY3RvckFsbChcIi56aWJhc2Utcm93XCIpLmZvckVhY2goKGVsKSA9PiBlbC5jbGFzc0xpc3QucmVtb3ZlKFwiemliYXNlLXJvdy1kcm9wLXRhcmdldFwiKSk7XG4gICAgICB9KTtcbiAgICAgIHRyLmFkZEV2ZW50TGlzdGVuZXIoXCJkcmFnb3ZlclwiLCAoZSkgPT4ge1xuICAgICAgICBlLnByZXZlbnREZWZhdWx0KCk7XG4gICAgICAgIHRyLmNsYXNzTGlzdC5hZGQoXCJ6aWJhc2Utcm93LWRyb3AtdGFyZ2V0XCIpO1xuICAgICAgfSk7XG4gICAgICB0ci5hZGRFdmVudExpc3RlbmVyKFwiZHJhZ2xlYXZlXCIsICgpID0+IHRyLmNsYXNzTGlzdC5yZW1vdmUoXCJ6aWJhc2Utcm93LWRyb3AtdGFyZ2V0XCIpKTtcbiAgICAgIHRyLmFkZEV2ZW50TGlzdGVuZXIoXCJkcm9wXCIsIChlKSA9PiB7XG4gICAgICAgIGUucHJldmVudERlZmF1bHQoKTtcbiAgICAgICAgZS5zdG9wUHJvcGFnYXRpb24oKTtcbiAgICAgICAgdHIuY2xhc3NMaXN0LnJlbW92ZShcInppYmFzZS1yb3ctZHJvcC10YXJnZXRcIik7XG4gICAgICAgIGNvbnN0IGZyb21JZHhTdHIgPSBlLmRhdGFUcmFuc2Zlcj8uZ2V0RGF0YShcInRleHQvcm93XCIpO1xuICAgICAgICBpZiAoIWZyb21JZHhTdHIpIHJldHVybjtcbiAgICAgICAgY29uc3QgZnJvbUlkeCA9IHBhcnNlSW50KGZyb21JZHhTdHIsIDEwKTtcbiAgICAgICAgY29uc3QgdG9JZHggPSByYXdJZHg7XG4gICAgICAgIGlmIChmcm9tSWR4ICE9PSB0b0lkeCkge1xuICAgICAgICAgIHZvaWQgKGFzeW5jICgpID0+IHtcbiAgICAgICAgICAgIGNvbnN0IGZpbGUgPSBob3N0LmFwcC52YXVsdC5nZXRBYnN0cmFjdEZpbGVCeVBhdGgoY29udGV4dC5zb3VyY2VQYXRoKTtcbiAgICAgICAgICAgIGlmICghKGZpbGUgaW5zdGFuY2VvZiBURmlsZSkpIHJldHVybjtcbiAgICAgICAgICAgIGF3YWl0IGhvc3QuYXBwLnZhdWx0LnByb2Nlc3MoZmlsZSwgKGNvbnRlbnQpID0+IHtcbiAgICAgICAgICAgICAgY29uc3QgYWxsTGluZXMgPSBjb250ZW50LnNwbGl0KFwiXFxuXCIpO1xuICAgICAgICAgICAgICBjb25zdCBmaWxlU3RhcnQgPSBzZWN0aW9uSW5mby5saW5lU3RhcnQgKyBzY2hlbWEuZGF0YVN0YXJ0SW5kZXg7XG4gICAgICAgICAgICAgIGNvbnN0IGRhdGFMaW5lcyA9IGFsbExpbmVzLnNsaWNlKGZpbGVTdGFydCwgZmlsZVN0YXJ0ICsgcmF3RGF0YUxpbmVzLmxlbmd0aCk7XG4gICAgICAgICAgICAgIGNvbnN0IGRyYWdnZWQgPSBkYXRhTGluZXMuc3BsaWNlKGZyb21JZHgsIDEpWzBdO1xuICAgICAgICAgICAgICBsZXQgaW5zZXJ0SWR4ID0gdG9JZHg7XG4gICAgICAgICAgICAgIGlmIChmcm9tSWR4IDwgdG9JZHgpIGluc2VydElkeC0tO1xuICAgICAgICAgICAgICBkYXRhTGluZXMuc3BsaWNlKGluc2VydElkeCwgMCwgZHJhZ2dlZCk7XG4gICAgICAgICAgICAgIGFsbExpbmVzLnNwbGljZShmaWxlU3RhcnQsIHJhd0RhdGFMaW5lcy5sZW5ndGgsIC4uLmRhdGFMaW5lcyk7XG4gICAgICAgICAgICAgIHJldHVybiBhbGxMaW5lcy5qb2luKFwiXFxuXCIpO1xuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgfSkoKTtcbiAgICAgICAgfVxuICAgICAgfSk7XG4gICAgICBzY2hlbWEuY29sdW1ucy5mb3JFYWNoKChjb2wsIGNvbElkeCkgPT4ge1xuICAgICAgICBjb25zdCB0ZCA9IHRyLmNyZWF0ZUVsKFwidGRcIiwgeyBjbHM6IFwiemliYXNlLXRkXCIgfSk7XG4gICAgICAgIGNvbnN0IHJhd1ZhbHVlID0gY2VsbHNbY29sSWR4XSA/PyBcIlwiO1xuICAgICAgICBob3N0LnJlbmRlckNlbGwodGQsIGNvbCwgcmF3VmFsdWUsIGNvbnRleHQsIHNjaGVtYSwgY2VsbHMsIChuZXdWYWx1ZSkgPT4ge1xuICAgICAgICAgIGlmIChyYXdJZHggIT09IC0xKSB7XG4gICAgICAgICAgICBjb25zdCB1cGRhdGVkQ2VsbHMgPSBzcGxpdFJvdyhyYXdEYXRhTGluZXNbcmF3SWR4XSk7XG4gICAgICAgICAgICB1cGRhdGVkQ2VsbHNbY29sSWR4XSA9IGAgJHtuZXdWYWx1ZX0gYDtcbiAgICAgICAgICAgIHJhd0RhdGFMaW5lc1tyYXdJZHhdID0gc2VyaWFsaXplUm93KHVwZGF0ZWRDZWxscyk7XG4gICAgICAgICAgfVxuICAgICAgICAgIHZvaWQgaG9zdC53cml0ZUJhY2soY29udGV4dCwgc2VjdGlvbkluZm8sIHNjaGVtYS5kYXRhU3RhcnRJbmRleCArIHJhd0lkeCwgY29sSWR4LCBuZXdWYWx1ZSk7XG4gICAgICAgIH0pO1xuICAgICAgfSk7XG4gICAgfSk7XG4gIH07XG4gIHJlbmRlclJvd3MoKTtcbn1cbiIsICJleHBvcnQgY29uc3QgUExVR0lOX1ZFUlNJT04gPSBcIjEuMi4zXCI7XG4iXSwKICAibWFwcGluZ3MiOiAiOzs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQSxJQUFBQSxtQkFBeUU7OztBQ0VsRSxJQUFNLGdCQUFnQjtBQUN0QixJQUFNLHFCQUFxQjtBQUMzQixJQUFNLFVBQVU7QUFDaEIsSUFBTSxZQUFZO0FBRWxCLElBQU0sdUJBQXFDO0FBQUEsRUFDaEQsRUFBRSxNQUFNLFVBQVUsTUFBTSxRQUFRO0FBQUEsRUFDaEMsRUFBRSxNQUFNLFlBQVksTUFBTSxRQUFRO0FBQUEsRUFDbEMsRUFBRSxNQUFNLE9BQU8sTUFBTSxRQUFRO0FBQUEsRUFDN0IsRUFBRSxNQUFNLFFBQVEsTUFBTSxlQUFlO0FBQUEsRUFDckMsRUFBRSxNQUFNLFFBQVEsTUFBTSxRQUFRO0FBQUEsRUFDOUIsRUFBRSxNQUFNLFNBQVMsTUFBTSxRQUFRO0FBQUEsRUFDL0IsRUFBRSxNQUFNLFVBQVUsTUFBTSxlQUFlO0FBQUEsRUFDdkMsRUFBRSxNQUFNLFFBQVEsTUFBTSxTQUFTO0FBQUEs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QUNELFVBQUksV0FBVyxFQUFFLE1BQU0sVUFBSyxLQUFLLG9CQUFvQixDQUFDO0FBQ3RELFlBQU0sYUFBYSxJQUFJLFNBQVMsVUFBVSxFQUFFLEtBQUssbUJBQW1CLENBQUM7QUFDckUsMEJBQW9CLFFBQVEsQ0FBQyxNQUFNO0FBQ2pDLGNBQU0sTUFBTSxXQUFXLFNBQVMsVUFBVSxFQUFFLE1BQU0sR0FBRyxPQUFPLEVBQUUsQ0FBQztBQUMvRCxZQUFJLE1BQU0sS0FBSztBQUFNLGNBQUksV0FBVztBQUFBLE1BQ3RDLENBQUM7QUFDRCxpQkFBVyxpQkFBaUIsVUFBVSxNQUFNO0FBQzFDLGNBQU0sWUFBWTtBQUNoQixlQUFLLE9BQU8sU0FBUyxZQUFZLEdBQUcsRUFBRSxPQUFPLFdBQVc7QUFDeEQsZ0JBQU0sS0FBSyxPQUFPLGFBQWE7QUFBQSxRQUNqQyxHQUFHO0FBQUEsTUFDTCxDQUFDO0FBQ0QsWUFBTSxZQUFZLElBQUksU0FBUyxVQUFVLEVBQUUsTUFBTSxRQUFLLEtBQUsscUJBQXFCLENBQUM7QUFDakYsZ0JBQVUsaUJBQWlCLFNBQVMsTUFBTTtBQUN4QyxjQUFNLFlBQVk7QUFDaEIsZUFBSyxPQUFPLFNBQVMsWUFBWSxPQUFPLEtBQUssQ0FBQztBQUM5QyxnQkFBTSxLQUFLLE9BQU8sYUFBYTtBQUMvQixlQUFLLFlBQVksU0FBUztBQUFBLFFBQzVCLEdBQUc7QUFBQSxNQUNMLENBQUM7QUFBQSxJQUNILENBQUM7QUFBQSxFQUNIO0FBQ0Y7IiwKICAibmFtZXMiOiBbImltcG9ydF9vYnNpZGlhbiIsICJjb2x1bW5zIiwgImltcG9ydF9vYnNpZGlhbiIsICJpbXBvcnRfb2JzaWRpYW4iLCAiaW1wb3J0X29ic2lkaWFuIiwgImltcG9ydF9vYnNpZGlhbiIsICJpbXBvcnRfb2JzaWRpYW4iLCAiaW1wb3J0X29ic2lkaWFuIiwgIl9hIiwgIl9iIiwgIl9hIiwgIl9iIl0KfQo=
