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
function filterDataRows(rows, query, schema) {
  if (!query)
    return rows;
  const q = query.trim();
  const eqMatch = q.match(/^([A-Za-z0-9_\s]+)\s*(==|!=|>=|<=|>|<)\s*(.+)$/);
  if (eqMatch && schema) {
    const colName = eqMatch[1].trim().toLowerCase();
    const op = eqMatch[2];
    const targetVal = eqMatch[3].trim().toLowerCase();
    const colIdx = schema.columns.findIndex((c) => c.name.toLowerCase() === colName);
    if (colIdx !== -1) {
      return rows.filter((line) => {
        var _a;
        const cells = splitRow(line);
        const cellVal = ((_a = cells[colIdx]) != null ? _a : "").trim().toLowerCase();
        if (op === "==")
          return cellVal === targetVal;
        if (op === "!=")
          return cellVal !== targetVal;
        const numCell = parseFloat(cellVal);
        const numTarget = parseFloat(targetVal);
        if (!Number.isNaN(numCell) && !Number.isNaN(numTarget)) {
          if (op === ">")
            return numCell > numTarget;
          if (op === "<")
            return numCell < numTarget;
          if (op === ">=")
            return numCell >= numTarget;
          if (op === "<=")
            return numCell <= numTarget;
        }
        return false;
      });
    }
  }
  const lower = q.toLowerCase();
  return rows.filter((line) => splitRow(line).some((cell) => cell.toLowerCase().includes(lower)));
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
        const comp = new import_obsidian.MarkdownRenderChild(displaySpan);
        context.addChild(comp);
        void import_obsidian.MarkdownRenderer.render(host.app, val, displaySpan, context.sourcePath, comp).then(() => {
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

// src/codeblock.ts
function parseLinkedViewConfig(sourceText) {
  var _a;
  const lines = sourceText.split("\n");
  const configMap = /* @__PURE__ */ new Map();
  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#") || line.startsWith("//"))
      continue;
    const colonIdx = line.indexOf(":");
    if (colonIdx === -1)
      continue;
    const key = line.slice(0, colonIdx).trim().toLowerCase();
    const val = line.slice(colonIdx + 1).trim();
    if (key && val) {
      configMap.set(key, val);
    }
  }
  const sourceRaw = configMap.get("source") || configMap.get("from");
  if (!sourceRaw)
    return null;
  let notePath = sourceRaw;
  let subpath = void 0;
  const wikiMatch = sourceRaw.match(/^\[\[([^\]]+)\]\]$/);
  const targetStr = wikiMatch ? wikiMatch[1].trim() : sourceRaw;
  const hashIdx = targetStr.indexOf("#");
  if (hashIdx !== -1) {
    notePath = targetStr.slice(0, hashIdx).trim();
    subpath = targetStr.slice(hashIdx).trim();
  } else {
    notePath = targetStr;
  }
  const rawView = (configMap.get("view") || "table").toLowerCase();
  let view = "table";
  let groupBy = configMap.get("groupby") || configMap.get("group_by");
  if (rawView.startsWith("kanban")) {
    view = "kanban";
    if (rawView.includes(":")) {
      const parts = rawView.split(":");
      groupBy = groupBy || ((_a = parts[1]) == null ? void 0 : _a.trim());
    }
  } else if (rawView === "gallery") {
    view = "gallery";
  } else if (rawView === "calendar") {
    view = "calendar";
  } else {
    view = "table";
  }
  const tableIndexStr = configMap.get("table") || configMap.get("index");
  const parsedIndex = tableIndexStr ? parseInt(tableIndexStr, 10) : 1;
  const tableIndex = isNaN(parsedIndex) || parsedIndex < 1 ? 1 : parsedIndex;
  return {
    sourceRaw,
    notePath,
    subpath,
    view,
    groupBy,
    filter: configMap.get("filter"),
    sort: configMap.get("sort"),
    tableIndex
  };
}

// src/resolver.ts
function scanTables(contentLines) {
  const tables = [];
  let currentHeading = "";
  let inTable = false;
  let tableStart = -1;
  let currentTableLines = [];
  for (let i = 0; i < contentLines.length; i++) {
    const line = contentLines[i];
    const trimmed = line.trim();
    const headingMatch = trimmed.match(/^(#{1,6})\s+(.+)$/);
    if (headingMatch) {
      if (inTable) {
        tables.push({
          startLine: tableStart,
          endLine: i - 1,
          lines: [...currentTableLines],
          heading: currentHeading
        });
        inTable = false;
        currentTableLines = [];
      }
      currentHeading = headingMatch[2].trim();
      continue;
    }
    const isTableRow = trimmed.startsWith("|") && trimmed.endsWith("|") && trimmed.length > 1;
    if (isTableRow) {
      if (!inTable) {
        inTable = true;
        tableStart = i;
        currentTableLines = [line];
      } else {
        currentTableLines.push(line);
      }
    } else {
      if (inTable) {
        const blockIdMatch = trimmed.match(/^\^([a-zA-Z0-9_-]+)$/);
        let blockId = void 0;
        let endIdx = i - 1;
        if (blockIdMatch) {
          blockId = blockIdMatch[1];
          endIdx = i;
        }
        tables.push({
          startLine: tableStart,
          endLine: endIdx,
          lines: [...currentTableLines],
          heading: currentHeading,
          blockId
        });
        inTable = false;
        currentTableLines = [];
      }
    }
  }
  if (inTable && currentTableLines.length > 0) {
    tables.push({
      startLine: tableStart,
      endLine: contentLines.length - 1,
      lines: [...currentTableLines],
      heading: currentHeading
    });
  }
  return tables.filter((t) => {
    if (t.lines.length < 2)
      return false;
    const sep = t.lines[1].trim();
    return /^\|?\s*:?-+:?\s*(\|:?-+:?\s*)+\|?$/.test(sep);
  });
}
function resolveTargetTable(fileContent, options = {}) {
  var _a, _b, _c;
  const contentLines = fileContent.split("\n");
  const tables = scanTables(contentLines);
  if (tables.length === 0)
    return null;
  const subpath = (_a = options.subpath) == null ? void 0 : _a.trim();
  const tableIndex = (_b = options.tableIndex) != null ? _b : 1;
  if (subpath && subpath.startsWith("^")) {
    const rawId = subpath.slice(1).trim().toLowerCase();
    const found = tables.find((t) => {
      var _a2;
      return ((_a2 = t.blockId) == null ? void 0 : _a2.toLowerCase()) === rawId;
    });
    if (found) {
      return { table: found, allLines: contentLines };
    }
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
  if (subpath) {
    const cleanHeading = subpath.startsWith("#") ? subpath.replace(/^#+\s*/, "").trim() : subpath;
    const matchingHeadingTables = tables.filter(
      (t) => {
        var _a2;
        return ((_a2 = t.heading) == null ? void 0 : _a2.toLowerCase()) === cleanHeading.toLowerCase();
      }
    );
    if (matchingHeadingTables.length > 0) {
      const idx2 = Math.max(0, tableIndex - 1);
      const chosen = (_c = matchingHeadingTables[idx2]) != null ? _c : matchingHeadingTables[0];
      return { table: chosen, allLines: contentLines };
    }
  }
  const idx = Math.max(0, tableIndex - 1);
  if (idx < tables.length) {
    return { table: tables[idx], allLines: contentLines };
  }
  return null;
}

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
        const comp = new import_obsidian3.MarkdownRenderChild(pill);
        context.addChild(comp);
        void import_obsidian3.MarkdownRenderer.render(host.app, entry.title || "\u2014", pill, context.sourcePath, comp);
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
    const comp = new import_obsidian4.MarkdownRenderChild(titleDiv);
    context.addChild(comp);
    void import_obsidian4.MarkdownRenderer.render(host.app, titleValue || "\u2014", titleDiv, context.sourcePath, comp);
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
function buildKanbanView(host, body, schema, getDataRows, rawDataLines, context, sectionInfo, filterQuery, groupBy) {
  let groupCol = groupBy ? schema.columns.find((c) => c.name.toLowerCase() === groupBy.toLowerCase()) : void 0;
  if (!groupCol) {
    groupCol = schema.columns.find(
      (c) => c.type.kind === "select" || c.type.kind === "label" || c.type.kind === "multi-select"
    );
  }
  if (!groupCol) {
    const notice = body.createDiv("zibase-kanban zibase-kanban-notice");
    notice.textContent = groupBy ? `Kanban: Column "${groupBy}" not found.` : "Kanban requires a Select or Label column to group by.";
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
            const comp = new import_obsidian5.MarkdownRenderChild(titleEl);
            context.addChild(comp);
            void import_obsidian5.MarkdownRenderer.render(host.app, rawValue, titleEl, context.sourcePath, comp);
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
        const comp = new import_obsidian5.MarkdownRenderChild(titleEl);
        context.addChild(comp);
        void import_obsidian5.MarkdownRenderer.render(host.app, cells[0] || "\u2014", titleEl, context.sourcePath, comp);
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
  buildRichTable(schema, lines, context, sectionInfo, options) {
    var _a, _b;
    let currentView = (_a = options == null ? void 0 : options.initialView) != null ? _a : "table";
    let collapsed = false;
    let filterQuery = (_b = options == null ? void 0 : options.initialFilter) != null ? _b : "";
    let sortColIdx = null;
    let sortAsc = true;
    const rawDataLines = lines.slice(schema.dataStartIndex);
    if (!(options == null ? void 0 : options.initialView)) {
      const viewAnnotation = parseViewAnnotation(lines);
      if (viewAnnotation)
        currentView = viewAnnotation.view;
    }
    if (options == null ? void 0 : options.initialSort) {
      const parts = options.initialSort.split(/\s+/);
      const colName = parts[0];
      const dir = (parts[1] || "asc").toLowerCase();
      const idx = schema.columns.findIndex((c) => c.name.toLowerCase() === colName.toLowerCase());
      if (idx !== -1) {
        sortColIdx = idx;
        sortAsc = dir !== "desc";
      }
    }
    const getDataRows = () => filterDataRows(rawDataLines.filter(isDataRow), filterQuery, schema);
    const wrapper = createDiv();
    wrapper.className = "zibase-wrapper";
    const topbar = wrapper.createDiv("zibase-topbar");
    const collapseBtn = topbar.createEl("button", { cls: "zibase-collapse-btn" });
    (0, import_obsidian7.setIcon)(collapseBtn, "chevron-right");
    const topLeft = topbar.createDiv("zibase-topbar-left");
    topLeft.createSpan({ text: "\u27C1", cls: "zibase-logo" });
    const zibaseName = topLeft.createSpan({ text: "ZiBase", cls: "zibase-name zibase-name-btn" });
    let badge;
    if (options == null ? void 0 : options.linkedSource) {
      badge = topLeft.createSpan({ cls: "zibase-linked-badge" });
      badge.createSpan({ text: "\u26A1 linked: " });
      const linkEl = badge.createSpan({
        cls: "zibase-linked-source-link",
        text: `[[${options.linkedSource.notePath}${options.linkedSource.subpath || ""}]]`
      });
      linkEl.addEventListener("click", (e) => {
        e.stopPropagation();
        void this.app.workspace.openLinkText(
          `${options.linkedSource.notePath}${options.linkedSource.subpath || ""}`,
          context.sourcePath
        );
      });
    } else {
      badge = topLeft.createSpan({
        cls: schema.inferred ? "zibase-inferred-badge" : "zibase-annotated-badge",
        text: schema.inferred ? "inferred" : "annotated"
      });
    }
    const topRight = topbar.createDiv("zibase-topbar-right");
    const searchWrap = topRight.createDiv("zibase-search-wrap");
    const searchIcon = searchWrap.createSpan({ cls: "zibase-search-icon" });
    (0, import_obsidian7.setIcon)(searchIcon, "search");
    const searchInput = searchWrap.createEl("input", { cls: "zibase-search", type: "text" });
    searchInput.placeholder = "Filter\u2026";
    if (filterQuery)
      searchInput.value = filterQuery;
    zibaseName.addEventListener("click", (e) => {
      e.stopPropagation();
      this.showZiBaseMenu(
        e,
        schema,
        lines,
        context,
        sectionInfo,
        rawDataLines,
        badge,
        currentView,
        (newView) => {
          currentView = newView;
          renderViewContent();
        },
        Boolean(options == null ? void 0 : options.linkedSource)
      );
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
      const total = rawDataLines.filter(isDataRow).length;
      const visible = getDataRows().length;
      rowCount.textContent = filterQuery && visible !== total ? `${visible} / ${total} rows` : `${total} rows`;
    };
    const renderViewContent = () => {
      body.querySelectorAll(".zibase-table, .zibase-kanban, .zibase-gallery, .zibase-calendar").forEach((el) => el.remove());
      const viewContainer = createDiv();
      switch (currentView) {
        case "kanban":
          buildKanbanView(this, viewContainer, schema, getDataRows, rawDataLines, context, sectionInfo, filterQuery, options == null ? void 0 : options.groupBy);
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
  showZiBaseMenu(e, schema, lines, context, sectionInfo, _rawDataLines, _badge, currentView, onViewChange, isLinked = false) {
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
          if (!isLinked) {
            void this.persistViewAnnotation(context, sectionInfo, view);
          }
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
      const comp = new import_obsidian7.MarkdownRenderChild(displaySpan);
      context.addChild(comp);
      await import_obsidian7.MarkdownRenderer.render(this.app, newRaw, displaySpan, context.sourcePath, comp);
      window.setTimeout(() => {
        displaySpan.querySelectorAll("a").forEach((a) => attachLinkTooltip(a));
      }, 50);
      displaySpan.classList.remove("zibase-text-empty");
    } else {
      displaySpan.textContent = "\u2014";
      displaySpan.classList.add("zibase-text-empty");
    }
  }
  renderError(element, message) {
    element.empty();
    const errorDiv = element.createDiv("zibase-error");
    errorDiv.createSpan({ text: "\u26A0\uFE0F ZiBase: " + message });
  }
  async processCodeBlock(source, element, context) {
    const config = parseLinkedViewConfig(source);
    if (!config) {
      this.renderError(element, "Invalid block configuration. Expected 'source: [[Note#Table]]'");
      return;
    }
    const targetFile = this.app.metadataCache.getFirstLinkpathDest(config.notePath, context.sourcePath);
    if (!(targetFile instanceof import_obsidian7.TFile)) {
      this.renderError(element, `Source note "[[${config.notePath}]]" not found in vault.`);
      return;
    }
    const child = new import_obsidian7.MarkdownRenderChild(element);
    context.addChild(child);
    let isUpdating = false;
    const render = async () => {
      if (isUpdating)
        return;
      isUpdating = true;
      try {
        const content = await this.app.vault.read(targetFile);
        const resolved = resolveTargetTable(content, {
          subpath: config.subpath,
          tableIndex: config.tableIndex
        });
        if (!resolved) {
          const desc = config.subpath ? `under "${config.subpath}"` : `(table #${config.tableIndex})`;
          this.renderError(element, `Table not found in "${targetFile.basename}" ${desc}.`);
          return;
        }
        const schema = parseZiBaseSchema(resolved.table.lines, this.plugin.settings.columnRules);
        if (!schema) {
          this.renderError(element, `Unable to parse table schema in "${targetFile.basename}".`);
          return;
        }
        element.empty();
        const linkedSectionInfo = {
          text: content,
          lineStart: resolved.table.startLine,
          lineEnd: resolved.table.endLine
        };
        const linkedContext = {
          ...context,
          sourcePath: targetFile.path,
          getSectionInfo: () => linkedSectionInfo
        };
        const richTable = this.buildRichTable(
          schema,
          resolved.table.lines,
          linkedContext,
          linkedSectionInfo,
          {
            linkedSource: {
              file: targetFile,
              notePath: config.notePath,
              subpath: config.subpath,
              tableIndex: config.tableIndex
            },
            initialView: config.view,
            initialFilter: config.filter,
            initialSort: config.sort,
            groupBy: config.groupBy
          }
        );
        element.appendChild(richTable);
      } finally {
        isUpdating = false;
      }
    };
    await render();
    child.registerEvent(
      this.app.vault.on("modify", (file) => {
        if (file.path === targetFile.path) {
          if (element.contains(document.activeElement)) {
            return;
          }
          void render();
        }
      })
    );
  }
};

// src/version.ts
var PLUGIN_VERSION = "1.2.4";

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
    this.registerMarkdownCodeBlockProcessor("zibase", (source, el, ctx) => {
      void this.renderer.processCodeBlock(source, el, ctx);
    });
    this.addCommand({
      id: "insert-linked-view",
      name: "Insert linked view",
      editorCallback: (editor) => {
        const template = [
          "```zibase",
          "source: [[Projects#Sprint Tasks]]",
          "view: kanban",
          "groupBy: Status",
          "```"
        ].join("\n");
        editor.replaceSelection(template);
      }
    });
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
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsic3JjL21haW4udHMiLCAic3JjL3NjaGVtYS50cyIsICJzcmMvcmVuZGVyZXIudHMiLCAic3JjL2NlbGxzLnRzIiwgInNyYy9mb3JtdWxhLnRzIiwgInNyYy9jb2xvcnMudHMiLCAic3JjL3VpLnRzIiwgInNyYy9tb2RhbHMudHMiLCAic3JjL21vZGVsLnRzIiwgInNyYy9jb2RlYmxvY2sudHMiLCAic3JjL3Jlc29sdmVyLnRzIiwgInNyYy92aWV3cy9jYWxlbmRhci50cyIsICJzcmMvdmlld3MvZ2FsbGVyeS50cyIsICJzcmMvdmlld3Mva2FuYmFuLnRzIiwgInNyYy92aWV3cy90YWJsZS50cyIsICJzcmMvdmVyc2lvbi50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiaW1wb3J0IHsgUGx1Z2luLCBQbHVnaW5TZXR0aW5nVGFiLCBTZXR0aW5nLCB0eXBlIEFwcCwgdHlwZSBFZGl0b3IgfSBmcm9tIFwib2JzaWRpYW5cIjtcbmltcG9ydCB7IERFRkFVTFRfQ09MVU1OX1JVTEVTIH0gZnJvbSBcIi4vc2NoZW1hXCI7XG5pbXBvcnQgeyBaaUJhc2VUYWJsZVJlbmRlcmVyIH0gZnJvbSBcIi4vcmVuZGVyZXJcIjtcbmltcG9ydCB7IENPTFVNTl9UWVBFX09QVElPTlMsIHR5cGUgQ29sdW1uUnVsZSwgdHlwZSBaaUJhc2VTZXR0aW5ncyB9IGZyb20gXCIuL21vZGVsXCI7XG5pbXBvcnQgeyBQTFVHSU5fVkVSU0lPTiB9IGZyb20gXCIuL3ZlcnNpb25cIjtcblxuY29uc3QgREVGQVVMVF9TRVRUSU5HUzogWmlCYXNlU2V0dGluZ3MgPSB7XG4gIHJlbmRlckluUmVhZGluZ1ZpZXc6IHRydWUsXG4gIGluZmVyU2NoZW1hOiB0cnVlLFxuICBjb2x1bW5SdWxlczogWy4uLkRFRkFVTFRfQ09MVU1OX1JVTEVTXSxcbn07XG5cbmV4cG9ydCBkZWZhdWx0IGNsYXNzIFppQmFzZVBsdWdpbiBleHRlbmRzIFBsdWdpbiB7XG4gIHNldHRpbmdzOiBaaUJhc2VTZXR0aW5ncyA9IERFRkFVTFRfU0VUVElOR1M7XG4gIHJlbmRlcmVyITogWmlCYXNlVGFibGVSZW5kZXJlcjtcblxuICBhc3luYyBvbmxvYWQoKTogUHJvbWlzZTx2b2lkPiB7XG4gICAgYXdhaXQgdGhpcy5sb2FkU2V0dGluZ3MoKTtcbiAgICB0aGlzLnJlbmRlcmVyID0gbmV3IFppQmFzZVRhYmxlUmVuZGVyZXIodGhpcy5hcHAsIHRoaXMpO1xuICAgIGlmICh0aGlzLnNldHRpbmdzLnJlbmRlckluUmVhZGluZ1ZpZXcpIHtcbiAgICAgIHRoaXMucmVnaXN0ZXJNYXJrZG93blBvc3RQcm9jZXNzb3IoKGVsZW1lbnQsIGNvbnRleHQpID0+IHtcbiAgICAgICAgdGhpcy5yZW5kZXJlci5wcm9jZXNzUmVhZGluZ1ZpZXcoZWxlbWVudCwgY29udGV4dCk7XG4gICAgICB9KTtcbiAgICB9XG4gICAgdGhpcy5yZWdpc3Rlck1hcmtkb3duQ29kZUJsb2NrUHJvY2Vzc29yKFwiemliYXNlXCIsIChzb3VyY2UsIGVsLCBjdHgpID0+IHtcbiAgICAgIHZvaWQgdGhpcy5yZW5kZXJlci5wcm9jZXNzQ29kZUJsb2NrKHNvdXJjZSwgZWwsIGN0eCk7XG4gICAgfSk7XG4gICAgdGhpcy5hZGRDb21tYW5kKHtcbiAgICAgIGlkOiBcImluc2VydC1saW5rZWQtdmlld1wiLFxuICAgICAgbmFtZTogXCJJbnNlcnQgbGlua2VkIHZpZXdcIixcbiAgICAgIGVkaXRvckNhbGxiYWNrOiAoZWRpdG9yOiBFZGl0b3IpID0+IHtcbiAgICAgICAgY29uc3QgdGVtcGxhdGUgPSBbXG4gICAgICAgICAgXCJgYGB6aWJhc2VcIixcbiAgICAgICAgICBcInNvdXJjZTogW1tQcm9qZWN0cyNTcHJpbnQgVGFza3NdXVwiLFxuICAgICAgICAgIFwidmlldzoga2FuYmFuXCIsXG4gICAgICAgICAgXCJncm91cEJ5OiBTdGF0dXNcIixcbiAgICAgICAgICBcImBgYFwiLFxuICAgICAgICBdLmpvaW4oXCJcXG5cIik7XG4gICAgICAgIGVkaXRvci5yZXBsYWNlU2VsZWN0aW9uKHRlbXBsYXRlKTtcbiAgICAgIH0sXG4gICAgfSk7XG4gICAgdGhpcy5hZGRDb21tYW5kKHtcbiAgICAgIGlkOiBcImluc2VydC10YWJsZVwiLFxuICAgICAgbmFtZTogXCJJbnNlcnQgYW5ub3RhdGVkIHRhYmxlXCIsXG4gICAgICBlZGl0b3JDYWxsYmFjazogKGVkaXRvcjogRWRpdG9yKSA9PiB7XG4gICAgICAgIGNvbnN0IHRlbXBsYXRlID0gW1xuICAgICAgICAgIFwifCBOYW1lIHwgU3RhdHVzIHwgUHJpb3JpdHkgfCBUYWdzIHxcIixcbiAgICAgICAgICBcInwtLS0tLS18LS0tLS0tLS18LS0tLS0tLS0tLXwtLS0tLS18XCIsXG4gICAgICAgICAgXCJ8IDwhLS0gemliYXNlOiB0ZXh0IC0tPiB8IDwhLS0gemliYXNlOiB0b2dnbGUgLS0+IHwgPCEtLSB6aWJhc2U6IHNlbGVjdDpMb3csTWVkaXVtLEhpZ2ggLS0+IHwgPCEtLSB6aWJhc2U6IGxhYmVsIC0tPiB8XCIsXG4gICAgICAgICAgXCJ8IEl0ZW0gMSB8IHRydWUgfCBIaWdoIHwgYmlvbG9neSB8XCIsXG4gICAgICAgICAgXCJ8IEl0ZW0gMiB8IGZhbHNlIHwgTG93IHwgY2hlbWlzdHJ5IHxcIixcbiAgICAgICAgXS5qb2luKFwiXFxuXCIpO1xuICAgICAgICBlZGl0b3IucmVwbGFjZVNlbGVjdGlvbih0ZW1wbGF0ZSk7XG4gICAgICB9LFxuICAgIH0pO1xuICAgIHRoaXMuYWRkQ29tbWFuZCh7XG4gICAgICBpZDogXCJpbnNlcnQtcGxhaW4tdGFibGVcIixcbiAgICAgIG5hbWU6IFwiSW5zZXJ0IHBsYWluIHRhYmxlIChhdXRvLWluZmVycmVkKVwiLFxuICAgICAgZWRpdG9yQ2FsbGJhY2s6IChlZGl0b3I6IEVkaXRvcikgPT4ge1xuICAgICAgICBjb25zdCB0ZW1wbGF0ZSA9IFtcbiAgICAgICAgICBcInwgTmFtZSB8IERvbmUgfCBTY29yZSB8IENhdGVnb3J5IHxcIixcbiAgICAgICAgICBcInwtLS0tLS18LS0tLS0tfC0tLS0tLS18LS0tLS0tLS0tLXxcIixcbiAgICAgICAgICBcInwgVGFzayBBIHwgdHJ1ZSB8IDkwIHwgV29yayB8XCIsXG4gICAgICAgICAgXCJ8IFRhc2sgQiB8IGZhbHNlIHwgNzUgfCBXb3JrIHxcIixcbiAgICAgICAgICBcInwgVGFzayBDIHwgdHJ1ZSB8IDgyIHwgUGVyc29uYWwgfFwiLFxuICAgICAgICBdLmpvaW4oXCJcXG5cIik7XG4gICAgICAgIGVkaXRvci5yZXBsYWNlU2VsZWN0aW9uKHRlbXBsYXRlKTtcbiAgICAgIH0sXG4gICAgfSk7XG4gICAgdGhpcy5hZGRDb21tYW5kKHtcbiAgICAgIGlkOiBcImluc2VydC1mb3JtdWxhLXRhYmxlXCIsXG4gICAgICBuYW1lOiBcIkluc2VydCB0YWJsZSB3aXRoIGZvcm11bGEgY29sdW1uXCIsXG4gICAgICBlZGl0b3JDYWxsYmFjazogKGVkaXRvcjogRWRpdG9yKSA9PiB7XG4gICAgICAgIGNvbnN0IHRlbXBsYXRlID0gW1xuICAgICAgICAgIFwifCBJdGVtIHwgUHJpY2UgfCBRdHkgfCBUb3RhbCB8XCIsXG4gICAgICAgICAgXCJ8LS0tLS0tfC0tLS0tLS18LS0tLS18LS0tLS0tLXxcIixcbiAgICAgICAgICBcInwgPCEtLSB6aWJhc2U6IHRleHQgLS0+IHwgPCEtLSB6aWJhc2U6IG51bWJlciAtLT4gfCA8IS0tIHppYmFzZTogbnVtYmVyIC0tPiB8IDwhLS0gemliYXNlOiBmb3JtdWxhOlByaWNlICogUXR5IC0tPiB8XCIsXG4gICAgICAgICAgXCJ8IFBlbiB8IDEwIHwgNSB8ICB8XCIsXG4gICAgICAgICAgXCJ8IEJvb2sgfCAyNTAgfCAyIHwgIHxcIixcbiAgICAgICAgICBcInwgRXJhc2VyIHwgNSB8IDEwIHwgIHxcIixcbiAgICAgICAgXS5qb2luKFwiXFxuXCIpO1xuICAgICAgICBlZGl0b3IucmVwbGFjZVNlbGVjdGlvbih0ZW1wbGF0ZSk7XG4gICAgICB9LFxuICAgIH0pO1xuICAgIHRoaXMuYWRkU2V0dGluZ1RhYihuZXcgWmlCYXNlU2V0dGluZ1RhYih0aGlzLmFwcCwgdGhpcykpO1xuICB9XG5cbiAgYXN5bmMgbG9hZFNldHRpbmdzKCk6IFByb21pc2U8dm9pZD4ge1xuICAgIHRoaXMuc2V0dGluZ3MgPSBPYmplY3QuYXNzaWduKHt9LCBERUZBVUxUX1NFVFRJTkdTLCBhd2FpdCB0aGlzLmxvYWREYXRhKCkpIGFzIFppQmFzZVNldHRpbmdzO1xuICAgIGlmICghdGhpcy5zZXR0aW5ncy5jb2x1bW5SdWxlcyB8fCB0aGlzLnNldHRpbmdzLmNvbHVtblJ1bGVzLmxlbmd0aCA9PT0gMCkge1xuICAgICAgdGhpcy5zZXR0aW5ncy5jb2x1bW5SdWxlcyA9IFsuLi5ERUZBVUxUX0NPTFVNTl9SVUxFU107XG4gICAgfVxuICB9XG5cbiAgYXN5bmMgc2F2ZVNldHRpbmdzKCk6IFByb21pc2U8dm9pZD4ge1xuICAgIGF3YWl0IHRoaXMuc2F2ZURhdGEodGhpcy5zZXR0aW5ncyk7XG4gIH1cbn1cblxuY2xhc3MgWmlCYXNlU2V0dGluZ1RhYiBleHRlbmRzIFBsdWdpblNldHRpbmdUYWIge1xuICBwbHVnaW46IFppQmFzZVBsdWdpbjtcblxuICBjb25zdHJ1Y3RvcihhcHA6IEFwcCwgcGx1Z2luOiBaaUJhc2VQbHVnaW4pIHtcbiAgICBzdXBlcihhcHAsIHBsdWdpbik7XG4gICAgdGhpcy5wbHVnaW4gPSBwbHVnaW47XG4gIH1cblxuICBkaXNwbGF5KCk6IHZvaWQge1xuICAgIGNvbnN0IHsgY29udGFpbmVyRWwgfSA9IHRoaXM7XG4gICAgY29udGFpbmVyRWwuZW1wdHkoKTtcbiAgICBuZXcgU2V0dGluZyhjb250YWluZXJFbClcbiAgICAgIC5zZXROYW1lKFwiUmVuZGVyIGluIFJlYWRpbmcgVmlld1wiKVxuICAgICAgLnNldERlc2MoXCJTaG93IHJpY2ggVUkgd2hlbiB2aWV3aW5nIG5vdGVzIGluIHJlYWRpbmcgbW9kZS5cIilcbiAgICAgIC5hZGRUb2dnbGUoKHQpID0+XG4gICAgICAgIHQuc2V0VmFsdWUodGhpcy5wbHVnaW4uc2V0dGluZ3MucmVuZGVySW5SZWFkaW5nVmlldykub25DaGFuZ2UoKHYpID0+IHtcbiAgICAgICAgICB2b2lkIChhc3luYyAoKSA9PiB7XG4gICAgICAgICAgICB0aGlzLnBsdWdpbi5zZXR0aW5ncy5yZW5kZXJJblJlYWRpbmdWaWV3ID0gdjtcbiAgICAgICAgICAgIGF3YWl0IHRoaXMucGx1Z2luLnNhdmVTZXR0aW5ncygpO1xuICAgICAgICAgIH0pKCk7XG4gICAgICAgIH0pLFxuICAgICAgKTtcbiAgICBuZXcgU2V0dGluZyhjb250YWluZXJFbClcbiAgICAgIC5zZXROYW1lKFwiQXV0by1pbmZlciBzY2hlbWFcIilcbiAgICAgIC5zZXREZXNjKFwiQXV0b21hdGljYWxseSBkZXRlY3QgY29sdW1uIHR5cGVzIGZyb20gcGxhaW4gbWFya2Rvd24gdGFibGVzLiBUdXJuIG9mZiB0byBvbmx5IGVuaGFuY2UgYW5ub3RhdGVkIHRhYmxlcy5cIilcbiAgICAgIC5hZGRUb2dnbGUoKHQpID0+XG4gICAgICAgIHQuc2V0VmFsdWUodGhpcy5wbHVnaW4uc2V0dGluZ3MuaW5mZXJTY2hlbWEpLm9uQ2hhbmdlKCh2KSA9PiB7XG4gICAgICAgICAgdm9pZCAoYXN5bmMgKCkgPT4ge1xuICAgICAgICAgICAgdGhpcy5wbHVnaW4uc2V0dGluZ3MuaW5mZXJTY2hlbWEgPSB2O1xuICAgICAgICAgICAgYXdhaXQgdGhpcy5wbHVnaW4uc2F2ZVNldHRpbmdzKCk7XG4gICAgICAgICAgfSkoKTtcbiAgICAgICAgfSksXG4gICAgICApO1xuICAgIG5ldyBTZXR0aW5nKGNvbnRhaW5lckVsKS5zZXROYW1lKFwiQ29sdW1uIG5hbWUgcnVsZXNcIikuc2V0SGVhZGluZygpO1xuICAgIGNvbnRhaW5lckVsLmNyZWF0ZUVsKFwicFwiLCB7XG4gICAgICB0ZXh0OiBcIldoZW4gYSBjb2x1bW4gbmFtZSBtYXRjaGVzLCBhdXRvLWFzc2lnbiB0aGF0IHR5cGUuIEFwcGxpZWQgdG8gYWxsIGluZmVycmVkIHRhYmxlcy5cIixcbiAgICAgIGNsczogXCJ6aWJhc2Utc2V0dGluZ3MtZGVzY1wiLFxuICAgIH0pO1xuICAgIGNvbnN0IHJ1bGVzQ29udGFpbmVyID0gY29udGFpbmVyRWwuY3JlYXRlRGl2KFwiemliYXNlLXJ1bGVzLWNvbnRhaW5lclwiKTtcbiAgICB0aGlzLnJlbmRlclJ1bGVzKHJ1bGVzQ29udGFpbmVyKTtcbiAgICBuZXcgU2V0dGluZyhjb250YWluZXJFbCkuYWRkQnV0dG9uKChidG4pID0+XG4gICAgICBidG4uc2V0QnV0dG9uVGV4dChcIisgQWRkIHJ1bGVcIikuc2V0Q3RhKCkub25DbGljaygoKSA9PiB7XG4gICAgICAgIHZvaWQgKGFzeW5jICgpID0+IHtcbiAgICAgICAgICB0aGlzLnBsdWdpbi5zZXR0aW5ncy5jb2x1bW5SdWxlcy5wdXNoKHsgbmFtZTogXCJcIiwgdHlwZTogXCJsYWJlbFwiIH0pO1xuICAgICAgICAgIGF3YWl0IHRoaXMucGx1Z2luLnNhdmVTZXR0aW5ncygpO1xuICAgICAgICAgIHRoaXMucmVuZGVyUnVsZXMocnVsZXNDb250YWluZXIpO1xuICAgICAgICB9KSgpO1xuICAgICAgfSksXG4gICAgKTtcbiAgICBuZXcgU2V0dGluZyhjb250YWluZXJFbClcbiAgICAgIC5zZXROYW1lKFwiUmVzZXQgdG8gZGVmYXVsdHNcIilcbiAgICAgIC5zZXREZXNjKFwiUmVzdG9yZSB0aGUgb3JpZ2luYWwgY29sdW1uIG5hbWUgcnVsZXMuXCIpXG4gICAgICAuYWRkQnV0dG9uKChidG4pID0+IHtcbiAgICAgICAgYnRuLnNldEJ1dHRvblRleHQoXCJSZXNldFwiKS5vbkNsaWNrKCgpID0+IHtcbiAgICAgICAgICB2b2lkIChhc3luYyAoKSA9PiB7XG4gICAgICAgICAgICB0aGlzLnBsdWdpbi5zZXR0aW5ncy5jb2x1bW5SdWxlcyA9IFsuLi5ERUZBVUxUX0NPTFVNTl9SVUxFU107XG4gICAgICAgICAgICBhd2FpdCB0aGlzLnBsdWdpbi5zYXZlU2V0dGluZ3MoKTtcbiAgICAgICAgICAgIHRoaXMucmVuZGVyUnVsZXMocnVsZXNDb250YWluZXIpO1xuICAgICAgICAgIH0pKCk7XG4gICAgICAgIH0pO1xuICAgICAgICBidG4uYnV0dG9uRWwuYWRkQ2xhc3MoXCJtb2Qtd2FybmluZ1wiKTtcbiAgICAgIH0pO1xuICAgIG5ldyBTZXR0aW5nKGNvbnRhaW5lckVsKS5zZXROYW1lKFwiQWJvdXRcIikuc2V0SGVhZGluZygpO1xuICAgIGNvbnRhaW5lckVsLmNyZWF0ZUVsKFwicFwiLCB7IHRleHQ6IGBaaUJhc2UgdiR7UExVR0lOX1ZFUlNJT059IFx1MjAxNCBCdWlsdCBieSBSb2hpdGggQSAoWklZQUwpYCwgY2xzOiBcInppYmFzZS1zZXR0aW5ncy1kZXNjXCIgfSk7XG4gICAgY29udGFpbmVyRWwuY3JlYXRlRWwoXCJwXCIsIHsgdGV4dDogXCJNYXJrZG93bi1uYXRpdmUgZGF0YWJhc2UgcGx1Z2luLlwiLCBjbHM6IFwiemliYXNlLXNldHRpbmdzLWRlc2NcIiB9KTtcbiAgfVxuXG4gIHJlbmRlclJ1bGVzKGNvbnRhaW5lcjogSFRNTEVsZW1lbnQpOiB2b2lkIHtcbiAgICBjb250YWluZXIuZW1wdHkoKTtcbiAgICB0aGlzLnBsdWdpbi5zZXR0aW5ncy5jb2x1bW5SdWxlcy5mb3JFYWNoKChydWxlOiBDb2x1bW5SdWxlLCBpZHg6IG51bWJlcikgPT4ge1xuICAgICAgY29uc3Qgcm93ID0gY29udGFpbmVyLmNyZWF0ZURpdihcInppYmFzZS1ydWxlLXJvd1wiKTtcbiAgICAgIGNvbnN0IG5hbWVJbnB1dCA9IHJvdy5jcmVhdGVFbChcImlucHV0XCIsIHsgdHlwZTogXCJ0ZXh0XCIsIGNsczogXCJ6aWJhc2UtcnVsZS1uYW1lXCIsIHZhbHVlOiBydWxlLm5hbWUgfSk7XG4gICAgICBuYW1lSW5wdXQucGxhY2Vob2xkZXIgPSBcImNvbHVtbiBuYW1lXCI7XG4gICAgICBuYW1lSW5wdXQuYWRkRXZlbnRMaXN0ZW5lcihcImNoYW5nZVwiLCAoKSA9PiB7XG4gICAgICAgIHZvaWQgKGFzeW5jICgpID0+IHtcbiAgICAgICAgICB0aGlzLnBsdWdpbi5zZXR0aW5ncy5jb2x1bW5SdWxlc1tpZHhdLm5hbWUgPSBuYW1lSW5wdXQudmFsdWUudHJpbSgpO1xuICAgICAgICAgIGF3YWl0IHRoaXMucGx1Z2luLnNhdmVTZXR0aW5ncygpO1xuICAgICAgICB9KSgpO1xuICAgICAgfSk7XG4gICAgICByb3cuY3JlYXRlU3Bhbih7IHRleHQ6IFwiXHUyMTkyXCIsIGNsczogXCJ6aWJhc2UtcnVsZS1hcnJvd1wiIH0pO1xuICAgICAgY29uc3QgdHlwZVNlbGVjdCA9IHJvdy5jcmVhdGVFbChcInNlbGVjdFwiLCB7IGNsczogXCJ6aWJhc2UtcnVsZS10eXBlXCIgfSk7XG4gICAgICBDT0xVTU5fVFlQRV9PUFRJT05TLmZvckVhY2goKHQpID0+IHtcbiAgICAgICAgY29uc3Qgb3B0ID0gdHlwZVNlbGVjdC5jcmVhdGVFbChcIm9wdGlvblwiLCB7IHRleHQ6IHQsIHZhbHVlOiB0IH0pO1xuICAgICAgICBpZiAodCA9PT0gcnVsZS50eXBlKSBvcHQuc2VsZWN0ZWQgPSB0cnVlO1xuICAgICAgfSk7XG4gICAgICB0eXBlU2VsZWN0LmFkZEV2ZW50TGlzdGVuZXIoXCJjaGFuZ2VcIiwgKCkgPT4ge1xuICAgICAgICB2b2lkIChhc3luYyAoKSA9PiB7XG4gICAgICAgICAgdGhpcy5wbHVnaW4uc2V0dGluZ3MuY29sdW1uUnVsZXNbaWR4XS50eXBlID0gdHlwZVNlbGVjdC52YWx1ZTtcbiAgICAgICAgICBhd2FpdCB0aGlzLnBsdWdpbi5zYXZlU2V0dGluZ3MoKTtcbiAgICAgICAgfSkoKTtcbiAgICAgIH0pO1xuICAgICAgY29uc3QgcmVtb3ZlQnRuID0gcm93LmNyZWF0ZUVsKFwiYnV0dG9uXCIsIHsgdGV4dDogXCJcdTAwRDdcIiwgY2xzOiBcInppYmFzZS1ydWxlLXJlbW92ZVwiIH0pO1xuICAgICAgcmVtb3ZlQnRuLmFkZEV2ZW50TGlzdGVuZXIoXCJjbGlja1wiLCAoKSA9PiB7XG4gICAgICAgIHZvaWQgKGFzeW5jICgpID0+IHtcbiAgICAgICAgICB0aGlzLnBsdWdpbi5zZXR0aW5ncy5jb2x1bW5SdWxlcy5zcGxpY2UoaWR4LCAxKTtcbiAgICAgICAgICBhd2FpdCB0aGlzLnBsdWdpbi5zYXZlU2V0dGluZ3MoKTtcbiAgICAgICAgICB0aGlzLnJlbmRlclJ1bGVzKGNvbnRhaW5lcik7XG4gICAgICAgIH0pKCk7XG4gICAgICB9KTtcbiAgICB9KTtcbiAgfVxufVxuIiwgImltcG9ydCB0eXBlIHsgQ29sdW1uUnVsZSwgQ29sdW1uVHlwZSwgVGFibGVTY2hlbWEsIFZpZXdOYW1lIH0gZnJvbSBcIi4vbW9kZWxcIjtcblxuZXhwb3J0IGNvbnN0IEFOTk9UQVRJT05fUkUgPSAvPCEtLVxccyp6aWJhc2U6XFxzKihbXlxccz5dKyg/OlxccypbXlxccz5dKykqKVxccyotLT4vaTtcbmV4cG9ydCBjb25zdCBWSUVXX0FOTk9UQVRJT05fUkUgPSAvPCEtLVxccyp6aWJhc2UtdmlldzpcXHMqKFxcdyspKD86OihbXj5dKykpP1xccyotLT4vaTtcbmV4cG9ydCBjb25zdCBEQVRFX1JFID0gL15cXGR7NH0tXFxkezJ9LVxcZHsyfSQvO1xuZXhwb3J0IGNvbnN0IE5VTUJFUl9SRSA9IC9eLT9cXGQrKFxcLlxcZCspPyQvO1xuXG5leHBvcnQgY29uc3QgREVGQVVMVF9DT0xVTU5fUlVMRVM6IENvbHVtblJ1bGVbXSA9IFtcbiAgeyBuYW1lOiBcImRvbWFpblwiLCB0eXBlOiBcImxhYmVsXCIgfSxcbiAgeyBuYW1lOiBcImNhdGVnb3J5XCIsIHR5cGU6IFwibGFiZWxcIiB9LFxuICB7IG5hbWU6IFwidGFnXCIsIHR5cGU6IFwibGFiZWxcIiB9LFxuICB7IG5hbWU6IFwidGFnc1wiLCB0eXBlOiBcIm11bHRpLXNlbGVjdFwiIH0sXG4gIHsgbmFtZTogXCJ0eXBlXCIsIHR5cGU6IFwibGFiZWxcIiB9LFxuICB7IG5hbWU6IFwibGFiZWxcIiwgdHlwZTogXCJsYWJlbFwiIH0sXG4gIHsgbmFtZTogXCJsYWJlbHNcIiwgdHlwZTogXCJtdWx0aS1zZWxlY3RcIiB9LFxuICB7IG5hbWU6IFwiZG9uZVwiLCB0eXBlOiBcInRvZ2dsZVwiIH0sXG4gIHsgbmFtZTogXCJjb21wbGV0ZWRcIiwgdHlwZTogXCJ0b2dnbGVcIiB9LFxuICB7IG5hbWU6IFwic3RhdHVzXCIsIHR5cGU6IFwic2VsZWN0XCIgfSxcbl07XG5cbmV4cG9ydCBmdW5jdGlvbiBwYXJzZVppQmFzZVNjaGVtYShcbiAgbGluZXM6IHN0cmluZ1tdLFxuICBjb2x1bW5SdWxlczogQ29sdW1uUnVsZVtdID0gREVGQVVMVF9DT0xVTU5fUlVMRVMsXG4pOiBUYWJsZVNjaGVtYSB8IG51bGwge1xuICBpZiAobGluZXMubGVuZ3RoIDwgMikgcmV0dXJuIG51bGw7XG5cbiAgY29uc3QgaGVhZGVyQ2VsbHMgPSBzcGxpdFJvdyhsaW5lc1swXSk7XG4gIGlmIChoZWFkZXJDZWxscy5sZW5ndGggPT09IDApIHJldHVybiBudWxsO1xuXG4gIGlmIChsaW5lcy5sZW5ndGggPj0gMykge1xuICAgIGNvbnN0IHNjaGVtYUNlbGxzID0gc3BsaXRSb3cobGluZXNbMl0pO1xuICAgIGNvbnN0IGhhc0Fubm90YXRpb25zID0gc2NoZW1hQ2VsbHMuc29tZSgoYykgPT4gQU5OT1RBVElPTl9SRS50ZXN0KGMpKTtcbiAgICBpZiAoaGFzQW5ub3RhdGlvbnMpIHtcbiAgICAgIGNvbnN0IGNvbHVtbnMgPSBoZWFkZXJDZWxscy5tYXAoKG5hbWUsIGkpID0+IHtcbiAgICAgICAgY29uc3QgY2VsbCA9IHNjaGVtYUNlbGxzW2ldID8/IFwiXCI7XG4gICAgICAgIGNvbnN0IG1hdGNoID0gY2VsbC5tYXRjaChBTk5PVEFUSU9OX1JFKTtcbiAgICAgICAgY29uc3QgdHlwZVN0ciA9IG1hdGNoID8gbWF0Y2hbMV0gOiBcInRleHRcIjtcbiAgICAgICAgcmV0dXJuIHsgbmFtZTogbmFtZS50cmltKCksIHR5cGU6IHBhcnNlVHlwZSh0eXBlU3RyKSwgaW5kZXg6IGkgfTtcbiAgICAgIH0pO1xuICAgICAgcmV0dXJuIHsgY29sdW1ucywgc2NoZW1hUm93SW5kZXg6IDIsIGRhdGFTdGFydEluZGV4OiAzLCBpbmZlcnJlZDogZmFsc2UgfTtcbiAgICB9XG4gIH1cblxuICBpZiAobGluZXMubGVuZ3RoIDwgMykgcmV0dXJuIG51bGw7XG5cbiAgY29uc3QgZGF0YUxpbmVzID0gbGluZXMuc2xpY2UoMikuZmlsdGVyKChsKSA9PiBsLnRyaW0oKSAmJiBsLmluY2x1ZGVzKFwifFwiKSk7XG4gIGlmIChkYXRhTGluZXMubGVuZ3RoID09PSAwKSByZXR1cm4gbnVsbDtcblxuICBjb25zdCBjb2xWYWx1ZXM6IHN0cmluZ1tdW10gPSBoZWFkZXJDZWxscy5tYXAoKCkgPT4gW10pO1xuICBkYXRhTGluZXMuZm9yRWFjaCgobGluZSkgPT4ge1xuICAgIGNvbnN0IGNlbGxzID0gc3BsaXRSb3cobGluZSk7XG4gICAgaGVhZGVyQ2VsbHMuZm9yRWFjaCgoXywgaSkgPT4ge1xuICAgICAgY29uc3QgdiA9IChjZWxsc1tpXSA/PyBcIlwiKS50cmltKCk7XG4gICAgICBpZiAodikgY29sVmFsdWVzW2ldLnB1c2godik7XG4gICAgfSk7XG4gIH0pO1xuXG4gIGNvbnN0IGNvbHVtbnMgPSBoZWFkZXJDZWxscy5tYXAoKG5hbWUsIGkpID0+ICh7XG4gICAgbmFtZTogbmFtZS50cmltKCksXG4gICAgdHlwZTogaW5mZXJUeXBlKG5hbWUudHJpbSgpLCBjb2xWYWx1ZXNbaV0sIGNvbHVtblJ1bGVzKSxcbiAgICBpbmRleDogaSxcbiAgfSkpO1xuICByZXR1cm4geyBjb2x1bW5zLCBzY2hlbWFSb3dJbmRleDogbnVsbCwgZGF0YVN0YXJ0SW5kZXg6IDIsIGluZmVycmVkOiB0cnVlIH07XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBwYXJzZVZpZXdBbm5vdGF0aW9uKFxuICBsaW5lczogc3RyaW5nW10sXG4pOiB7IHZpZXc6IFZpZXdOYW1lOyBncm91cEJ5OiBzdHJpbmcgfCBudWxsIH0gfCBudWxsIHtcbiAgZm9yIChsZXQgaSA9IDA7IGkgPCBNYXRoLm1pbihsaW5lcy5sZW5ndGgsIDMpOyBpKyspIHtcbiAgICBjb25zdCBtYXRjaCA9IGxpbmVzW2ldLm1hdGNoKFZJRVdfQU5OT1RBVElPTl9SRSk7XG4gICAgaWYgKG1hdGNoKSB7XG4gICAgICByZXR1cm4geyB2aWV3OiBtYXRjaFsxXS50b0xvd2VyQ2FzZSgpIGFzIFZpZXdOYW1lLCBncm91cEJ5OiBtYXRjaFsyXSA/IG1hdGNoWzJdLnRyaW0oKSA6IG51bGwgfTtcbiAgICB9XG4gIH1cbiAgcmV0dXJuIG51bGw7XG59XG5cbmZ1bmN0aW9uIGluZmVyVHlwZShjb2xOYW1lOiBzdHJpbmcsIHZhbHVlczogc3RyaW5nW10sIGNvbHVtblJ1bGVzOiBDb2x1bW5SdWxlW10pOiBDb2x1bW5UeXBlIHtcbiAgaWYgKHZhbHVlcy5sZW5ndGggPT09IDApIHJldHVybiB7IGtpbmQ6IFwidGV4dFwiIH07XG4gIGlmICh2YWx1ZXMuZXZlcnkoKHYpID0+IHYudG9Mb3dlckNhc2UoKSA9PT0gXCJ0cnVlXCIgfHwgdi50b0xvd2VyQ2FzZSgpID09PSBcImZhbHNlXCIpKSB7XG4gICAgcmV0dXJuIHsga2luZDogXCJ0b2dnbGVcIiB9O1xuICB9XG4gIGlmICh2YWx1ZXMuZXZlcnkoKHYpID0+IERBVEVfUkUudGVzdCh2KSkpIHJldHVybiB7IGtpbmQ6IFwiZGF0ZVwiIH07XG4gIGlmICh2YWx1ZXMuZXZlcnkoKHYpID0+IE5VTUJFUl9SRS50ZXN0KHYpKSkgcmV0dXJuIHsga2luZDogXCJudW1iZXJcIiB9O1xuXG4gIGNvbnN0IHJ1bGUgPSBjb2x1bW5SdWxlcy5maW5kKChyKSA9PiByLm5hbWUudG9Mb3dlckNhc2UoKSA9PT0gY29sTmFtZS50b0xvd2VyQ2FzZSgpKTtcbiAgaWYgKHJ1bGUpIHJldHVybiBwYXJzZVR5cGUocnVsZS50eXBlKTtcblxuICBjb25zdCB1bmlxdWUgPSBbLi4ubmV3IFNldCh2YWx1ZXMubWFwKCh2KSA9PiB2LnRvTG93ZXJDYXNlKCkpKV07XG4gIGNvbnN0IGFsbFNob3J0ID0gdmFsdWVzLmV2ZXJ5KCh2KSA9PiB2Lmxlbmd0aCA8PSAyMCk7XG4gIGNvbnN0IGlzUmVwZWF0ZWQgPVxuICAgIHZhbHVlcy5sZW5ndGggPj0gMiAmJlxuICAgIHVuaXF1ZS5sZW5ndGggPD0gTWF0aC5tYXgoMiwgTWF0aC5mbG9vcih2YWx1ZXMubGVuZ3RoICogMC43NSkpICYmXG4gICAgdW5pcXVlLmxlbmd0aCA8PSAxMDtcbiAgaWYgKGlzUmVwZWF0ZWQgJiYgYWxsU2hvcnQpIHtcbiAgICBjb25zdCBzZWVuID0gbmV3IE1hcDxzdHJpbmcsIHN0cmluZz4oKTtcbiAgICB2YWx1ZXMuZm9yRWFjaCgodikgPT4ge1xuICAgICAgaWYgKCFzZWVuLmhhcyh2LnRvTG93ZXJDYXNlKCkpKSBzZWVuLnNldCh2LnRvTG93ZXJDYXNlKCksIHYpO1xuICAgIH0pO1xuICAgIHJldHVybiB7IGtpbmQ6IFwic2VsZWN0XCIsIG9wdGlvbnM6IFsuLi5zZWVuLnZhbHVlcygpXSB9O1xuICB9XG4gIHJldHVybiB7IGtpbmQ6IFwidGV4dFwiIH07XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBwYXJzZVR5cGUodHlwZVN0cjogc3RyaW5nKTogQ29sdW1uVHlwZSB7XG4gIGlmICh0eXBlU3RyLnN0YXJ0c1dpdGgoXCJzZWxlY3Q6XCIpKSB7XG4gICAgY29uc3Qgb3B0aW9ucyA9IHR5cGVTdHIuc2xpY2UoNykuc3BsaXQoXCIsXCIpLm1hcCgocykgPT4gcy50cmltKCkpO1xuICAgIHJldHVybiB7IGtpbmQ6IFwic2VsZWN0XCIsIG9wdGlvbnMgfTtcbiAgfVxuICBpZiAodHlwZVN0ci5zdGFydHNXaXRoKFwiZm9ybXVsYTpcIikpIHtcbiAgICBjb25zdCBleHByZXNzaW9uID0gdHlwZVN0ci5zbGljZSg4KS50cmltKCk7XG4gICAgcmV0dXJuIHsga2luZDogXCJmb3JtdWxhXCIsIGV4cHJlc3Npb24gfTtcbiAgfVxuICBzd2l0Y2ggKHR5cGVTdHIudG9Mb3dlckNhc2UoKSkge1xuICAgIGNhc2UgXCJ0b2dnbGVcIjpcbiAgICAgIHJldHVybiB7IGtpbmQ6IFwidG9nZ2xlXCIgfTtcbiAgICBjYXNlIFwibGFiZWxcIjpcbiAgICAgIHJldHVybiB7IGtpbmQ6IFwibGFiZWxcIiB9O1xuICAgIGNhc2UgXCJtdWx0aS1zZWxlY3RcIjpcbiAgICBjYXNlIFwidGFnc1wiOlxuICAgICAgcmV0dXJuIHsga2luZDogXCJtdWx0aS1zZWxlY3RcIiB9O1xuICAgIGNhc2UgXCJudW1iZXJcIjpcbiAgICAgIHJldHVybiB7IGtpbmQ6IFwibnVtYmVyXCIgfTtcbiAgICBjYXNlIFwiZGF0ZVwiOlxuICAgICAgcmV0dXJuIHsga2luZDogXCJkYXRlXCIgfTtcbiAgICBjYXNlIFwic2VsZWN0XCI6XG4gICAgICByZXR1cm4geyBraW5kOiBcInNlbGVjdFwiLCBvcHRpb25zOiBbXSB9O1xuICAgIGNhc2UgXCJmb3JtdWxhXCI6XG4gICAgICByZXR1cm4geyBraW5kOiBcImZvcm11bGFcIiwgZXhwcmVzc2lvbjogXCJcIiB9O1xuICAgIGRlZmF1bHQ6XG4gICAgICByZXR1cm4geyBraW5kOiBcInRleHRcIiB9O1xuICB9XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBzcGxpdFJvdyhyb3c6IHN0cmluZyk6IHN0cmluZ1tdIHtcbiAgY29uc3Qgc3RyaXBwZWQgPSByb3cucmVwbGFjZSgvXlxcfHxcXHwkL2csIFwiXCIpO1xuICBjb25zdCBjZWxsczogc3RyaW5nW10gPSBbXTtcbiAgbGV0IGN1cnJlbnQgPSBcIlwiO1xuICBmb3IgKGxldCBpID0gMDsgaSA8IHN0cmlwcGVkLmxlbmd0aDsgaSsrKSB7XG4gICAgaWYgKHN0cmlwcGVkW2ldID09PSBcIlxcXFxcIiAmJiBzdHJpcHBlZFtpICsgMV0gPT09IFwifFwiKSB7XG4gICAgICBjdXJyZW50ICs9IFwifFwiO1xuICAgICAgaSsrO1xuICAgIH0gZWxzZSBpZiAoc3RyaXBwZWRbaV0gPT09IFwifFwiKSB7XG4gICAgICBjZWxscy5wdXNoKGN1cnJlbnQudHJpbSgpKTtcbiAgICAgIGN1cnJlbnQgPSBcIlwiO1xuICAgIH0gZWxzZSB7XG4gICAgICBjdXJyZW50ICs9IHN0cmlwcGVkW2ldO1xuICAgIH1cbiAgfVxuICBjZWxscy5wdXNoKGN1cnJlbnQudHJpbSgpKTtcbiAgcmV0dXJuIGNlbGxzO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gc2VyaWFsaXplUm93KGNlbGxzOiBzdHJpbmdbXSk6IHN0cmluZyB7XG4gIHJldHVybiBcInwgXCIgKyBjZWxscy5qb2luKFwiIHwgXCIpICsgXCIgfFwiO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gcGFyc2VCb29sKHZhbDogc3RyaW5nKTogYm9vbGVhbiB7XG4gIHJldHVybiB2YWwudHJpbSgpLnRvTG93ZXJDYXNlKCkgPT09IFwidHJ1ZVwiO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gc2VyaWFsaXplQm9vbCh2YWw6IGJvb2xlYW4pOiBzdHJpbmcge1xuICByZXR1cm4gdmFsID8gXCJ0cnVlXCIgOiBcImZhbHNlXCI7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBwYXJzZU11bHRpU2VsZWN0KHZhbDogc3RyaW5nKTogc3RyaW5nW10ge1xuICBpZiAoIXZhbCkgcmV0dXJuIFtdO1xuICByZXR1cm4gdmFsLnNwbGl0KFwiLFwiKS5tYXAoKHMpID0+IHMudHJpbSgpKS5maWx0ZXIoKHMpID0+IHMubGVuZ3RoID4gMCk7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBpc0RhdGFSb3cobGluZTogc3RyaW5nKTogYm9vbGVhbiB7XG4gIHJldHVybiBCb29sZWFuKGxpbmUudHJpbSgpICYmIGxpbmUuaW5jbHVkZXMoXCJ8XCIpICYmICEvPCEtLVxccyp6aWJhc2U6Ly50ZXN0KGxpbmUpICYmICEvPCEtLVxccyp6aWJhc2UtdmlldzovLnRlc3QobGluZSkpO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gZmlsdGVyRGF0YVJvd3Mocm93czogc3RyaW5nW10sIHF1ZXJ5OiBzdHJpbmcsIHNjaGVtYT86IFRhYmxlU2NoZW1hKTogc3RyaW5nW10ge1xuICBpZiAoIXF1ZXJ5KSByZXR1cm4gcm93cztcbiAgY29uc3QgcSA9IHF1ZXJ5LnRyaW0oKTtcbiAgY29uc3QgZXFNYXRjaCA9IHEubWF0Y2goL14oW0EtWmEtejAtOV9cXHNdKylcXHMqKD09fCE9fD49fDw9fD58PClcXHMqKC4rKSQvKTtcbiAgaWYgKGVxTWF0Y2ggJiYgc2NoZW1hKSB7XG4gICAgY29uc3QgY29sTmFtZSA9IGVxTWF0Y2hbMV0udHJpbSgpLnRvTG93ZXJDYXNlKCk7XG4gICAgY29uc3Qgb3AgPSBlcU1hdGNoWzJdO1xuICAgIGNvbnN0IHRhcmdldFZhbCA9IGVxTWF0Y2hbM10udHJpbSgpLnRvTG93ZXJDYXNlKCk7XG4gICAgY29uc3QgY29sSWR4ID0gc2NoZW1hLmNvbHVtbnMuZmluZEluZGV4KChjKSA9PiBjLm5hbWUudG9Mb3dlckNhc2UoKSA9PT0gY29sTmFtZSk7XG4gICAgaWYgKGNvbElkeCAhPT0gLTEpIHtcbiAgICAgIHJldHVybiByb3dzLmZpbHRlcigobGluZSkgPT4ge1xuICAgICAgICBjb25zdCBjZWxscyA9IHNwbGl0Um93KGxpbmUpO1xuICAgICAgICBjb25zdCBjZWxsVmFsID0gKGNlbGxzW2NvbElkeF0gPz8gXCJcIikudHJpbSgpLnRvTG93ZXJDYXNlKCk7XG4gICAgICAgIGlmIChvcCA9PT0gXCI9PVwiKSByZXR1cm4gY2VsbFZhbCA9PT0gdGFyZ2V0VmFsO1xuICAgICAgICBpZiAob3AgPT09IFwiIT1cIikgcmV0dXJuIGNlbGxWYWwgIT09IHRhcmdldFZhbDtcbiAgICAgICAgY29uc3QgbnVtQ2VsbCA9IHBhcnNlRmxvYXQoY2VsbFZhbCk7XG4gICAgICAgIGNvbnN0IG51bVRhcmdldCA9IHBhcnNlRmxvYXQodGFyZ2V0VmFsKTtcbiAgICAgICAgaWYgKCFOdW1iZXIuaXNOYU4obnVtQ2VsbCkgJiYgIU51bWJlci5pc05hTihudW1UYXJnZXQpKSB7XG4gICAgICAgICAgaWYgKG9wID09PSBcIj5cIikgcmV0dXJuIG51bUNlbGwgPiBudW1UYXJnZXQ7XG4gICAgICAgICAgaWYgKG9wID09PSBcIjxcIikgcmV0dXJuIG51bUNlbGwgPCBudW1UYXJnZXQ7XG4gICAgICAgICAgaWYgKG9wID09PSBcIj49XCIpIHJldHVybiBudW1DZWxsID49IG51bVRhcmdldDtcbiAgICAgICAgICBpZiAob3AgPT09IFwiPD1cIikgcmV0dXJuIG51bUNlbGwgPD0gbnVtVGFyZ2V0O1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgIH0pO1xuICAgIH1cbiAgfVxuICBjb25zdCBsb3dlciA9IHEudG9Mb3dlckNhc2UoKTtcbiAgcmV0dXJuIHJvd3MuZmlsdGVyKChsaW5lKSA9PiBzcGxpdFJvdyhsaW5lKS5zb21lKChjZWxsKSA9PiBjZWxsLnRvTG93ZXJDYXNlKCkuaW5jbHVkZXMobG93ZXIpKSk7XG59XG4iLCAiaW1wb3J0IHtcbiAgQ29tcG9uZW50LFxuICBNYXJrZG93blJlbmRlckNoaWxkLFxuICBNYXJrZG93blJlbmRlcmVyLFxuICBzZXRJY29uLFxuICBURmlsZSxcbiAgdHlwZSBBcHAsXG4gIHR5cGUgTWFya2Rvd25Qb3N0UHJvY2Vzc29yQ29udGV4dCxcbiAgdHlwZSBNYXJrZG93blNlY3Rpb25JbmZvcm1hdGlvbixcbn0gZnJvbSBcIm9ic2lkaWFuXCI7XG5pbXBvcnQgeyByZW5kZXJDZWxsIH0gZnJvbSBcIi4vY2VsbHNcIjtcbmltcG9ydCB7IEZvcm11bGFJbnB1dE1vZGFsLCBTZWxlY3RPcHRpb25zTW9kYWwgfSBmcm9tIFwiLi9tb2RhbHNcIjtcbmltcG9ydCB7XG4gIGlzRGF0YVJvdyxcbiAgcGFyc2VaaUJhc2VTY2hlbWEsXG4gIHBhcnNlVmlld0Fubm90YXRpb24sXG4gIHNlcmlhbGl6ZVJvdyxcbiAgc3BsaXRSb3csXG4gIHBhcnNlQm9vbCxcbiAgZmlsdGVyRGF0YVJvd3MsXG4gIFZJRVdfQU5OT1RBVElPTl9SRSxcbn0gZnJvbSBcIi4vc2NoZW1hXCI7XG5pbXBvcnQgdHlwZSB7XG4gIENlbGxDaGFuZ2VIYW5kbGVyLFxuICBDb2x1bW4sXG4gIFRhYmxlU2NoZW1hLFxuICBWaWV3TmFtZSxcbiAgWmlCYXNlSG9zdCxcbiAgWmlCYXNlUGx1Z2luTGlrZSxcbn0gZnJvbSBcIi4vdHlwZXNcIjtcbmltcG9ydCB7IENPTFVNTl9UWVBFX09QVElPTlMgfSBmcm9tIFwiLi90eXBlc1wiO1xuaW1wb3J0IHsgYXR0YWNoTGlua1Rvb2x0aXAsIHNob3dUb2FzdCB9IGZyb20gXCIuL3VpXCI7XG5pbXBvcnQgeyBwYXJzZUxpbmtlZFZpZXdDb25maWcgfSBmcm9tIFwiLi9jb2RlYmxvY2tcIjtcbmltcG9ydCB7IHJlc29sdmVUYXJnZXRUYWJsZSB9IGZyb20gXCIuL3Jlc29sdmVyXCI7XG5pbXBvcnQgeyBidWlsZENhbGVuZGFyVmlldyB9IGZyb20gXCIuL3ZpZXdzL2NhbGVuZGFyXCI7XG5pbXBvcnQgeyBidWlsZEdhbGxlcnlWaWV3IH0gZnJvbSBcIi4vdmlld3MvZ2FsbGVyeVwiO1xuaW1wb3J0IHsgYnVpbGRLYW5iYW5WaWV3IH0gZnJvbSBcIi4vdmlld3Mva2FuYmFuXCI7XG5pbXBvcnQgeyBidWlsZFRhYmxlVmlldyB9IGZyb20gXCIuL3ZpZXdzL3RhYmxlXCI7XG5cbmV4cG9ydCBpbnRlcmZhY2UgUmljaFRhYmxlT3B0aW9ucyB7XG4gIGxpbmtlZFNvdXJjZT86IHtcbiAgICBmaWxlOiBURmlsZTtcbiAgICBub3RlUGF0aDogc3RyaW5nO1xuICAgIHN1YnBhdGg/OiBzdHJpbmc7XG4gICAgdGFibGVJbmRleD86IG51bWJlcjtcbiAgfTtcbiAgaW5pdGlhbFZpZXc/OiBWaWV3TmFtZTtcbiAgaW5pdGlhbEZpbHRlcj86IHN0cmluZztcbiAgaW5pdGlhbFNvcnQ/OiBzdHJpbmc7XG4gIGdyb3VwQnk/OiBzdHJpbmc7XG59XG5cbmludGVyZmFjZSBBcHBXaXRoU2V0dGluZ3MgZXh0ZW5kcyBBcHAge1xuICBzZXR0aW5nOiB7IG9wZW46ICgpID0+IHZvaWQ7IG9wZW5UYWJCeUlkOiAoaWQ6IHN0cmluZykgPT4gdm9pZCB9O1xufVxuXG5leHBvcnQgY2xhc3MgWmlCYXNlVGFibGVSZW5kZXJlciBpbXBsZW1lbnRzIFppQmFzZUhvc3Qge1xuICBhcHA6IEFwcDtcbiAgcGx1Z2luOiBaaUJhc2VQbHVnaW5MaWtlO1xuXG4gIGNvbnN0cnVjdG9yKGFwcDogQXBwLCBwbHVnaW46IFppQmFzZVBsdWdpbkxpa2UpIHtcbiAgICB0aGlzLmFwcCA9IGFwcDtcbiAgICB0aGlzLnBsdWdpbiA9IHBsdWdpbjtcbiAgfVxuXG4gIHByb2Nlc3NSZWFkaW5nVmlldyhlbGVtZW50OiBIVE1MRWxlbWVudCwgY29udGV4dDogTWFya2Rvd25Qb3N0UHJvY2Vzc29yQ29udGV4dCk6IHZvaWQge1xuICAgIGVsZW1lbnQucXVlcnlTZWxlY3RvckFsbChcInRhYmxlXCIpLmZvckVhY2goKHRhYmxlKSA9PiB0aGlzLnRyeVJlbmRlclRhYmxlKHRhYmxlLCBjb250ZXh0KSk7XG4gIH1cblxuICB0cnlSZW5kZXJUYWJsZSh0YWJsZTogSFRNTFRhYmxlRWxlbWVudCwgY29udGV4dDogTWFya2Rvd25Qb3N0UHJvY2Vzc29yQ29udGV4dCk6IHZvaWQge1xuICAgIGNvbnN0IHNlY3Rpb25JbmZvID0gY29udGV4dC5nZXRTZWN0aW9uSW5mbyh0YWJsZSk7XG4gICAgaWYgKCFzZWN0aW9uSW5mbykgcmV0dXJuO1xuICAgIGNvbnN0IGxpbmVzID0gc2VjdGlvbkluZm8udGV4dC5zcGxpdChcIlxcblwiKS5zbGljZShzZWN0aW9uSW5mby5saW5lU3RhcnQsIHNlY3Rpb25JbmZvLmxpbmVFbmQgKyAxKTtcbiAgICBjb25zdCBzY2hlbWEgPSBwYXJzZVppQmFzZVNjaGVtYShsaW5lcywgdGhpcy5wbHVnaW4uc2V0dGluZ3MuY29sdW1uUnVsZXMpO1xuICAgIGlmICghc2NoZW1hKSByZXR1cm47XG4gICAgaWYgKHNjaGVtYS5pbmZlcnJlZCAmJiAhdGhpcy5wbHVnaW4uc2V0dGluZ3MuaW5mZXJTY2hlbWEpIHJldHVybjtcbiAgICB0YWJsZS5yZXBsYWNlV2l0aCh0aGlzLmJ1aWxkUmljaFRhYmxlKHNjaGVtYSwgbGluZXMsIGNvbnRleHQsIHNlY3Rpb25JbmZvKSk7XG4gIH1cblxuICBidWlsZFJpY2hUYWJsZShcbiAgICBzY2hlbWE6IFRhYmxlU2NoZW1hLFxuICAgIGxpbmVzOiBzdHJpbmdbXSxcbiAgICBjb250ZXh0OiBNYXJrZG93blBvc3RQcm9jZXNzb3JDb250ZXh0LFxuICAgIHNlY3Rpb25JbmZvOiBNYXJrZG93blNlY3Rpb25JbmZvcm1hdGlvbixcbiAgICBvcHRpb25zPzogUmljaFRhYmxlT3B0aW9ucyxcbiAgKTogSFRNTEVsZW1lbnQge1xuICAgIGxldCBjdXJyZW50VmlldzogVmlld05hbWUgPSBvcHRpb25zPy5pbml0aWFsVmlldyA/PyBcInRhYmxlXCI7XG4gICAgbGV0IGNvbGxhcHNlZCA9IGZhbHNlO1xuICAgIGxldCBmaWx0ZXJRdWVyeSA9IG9wdGlvbnM/LmluaXRpYWxGaWx0ZXIgPz8gXCJcIjtcbiAgICBsZXQgc29ydENvbElkeDogbnVtYmVyIHwgbnVsbCA9IG51bGw7XG4gICAgbGV0IHNvcnRBc2MgPSB0cnVlO1xuICAgIGNvbnN0IHJhd0RhdGFMaW5lcyA9IGxpbmVzLnNsaWNlKHNjaGVtYS5kYXRhU3RhcnRJbmRleCk7XG5cbiAgICBpZiAoIW9wdGlvbnM/LmluaXRpYWxWaWV3KSB7XG4gICAgICBjb25zdCB2aWV3QW5ub3RhdGlvbiA9IHBhcnNlVmlld0Fubm90YXRpb24obGluZXMpO1xuICAgICAgaWYgKHZpZXdBbm5vdGF0aW9uKSBjdXJyZW50VmlldyA9IHZpZXdBbm5vdGF0aW9uLnZpZXc7XG4gICAgfVxuXG4gICAgaWYgKG9wdGlvbnM/LmluaXRpYWxTb3J0KSB7XG4gICAgICBjb25zdCBwYXJ0cyA9IG9wdGlvbnMuaW5pdGlhbFNvcnQuc3BsaXQoL1xccysvKTtcbiAgICAgIGNvbnN0IGNvbE5hbWUgPSBwYXJ0c1swXTtcbiAgICAgIGNvbnN0IGRpciA9IChwYXJ0c1sxXSB8fCBcImFzY1wiKS50b0xvd2VyQ2FzZSgpO1xuICAgICAgY29uc3QgaWR4ID0gc2NoZW1hLmNvbHVtbnMuZmluZEluZGV4KChjKSA9PiBjLm5hbWUudG9Mb3dlckNhc2UoKSA9PT0gY29sTmFtZS50b0xvd2VyQ2FzZSgpKTtcbiAgICAgIGlmIChpZHggIT09IC0xKSB7XG4gICAgICAgIHNvcnRDb2xJZHggPSBpZHg7XG4gICAgICAgIHNvcnRBc2MgPSBkaXIgIT09IFwiZGVzY1wiO1xuICAgICAgfVxuICAgIH1cblxuICAgIGNvbnN0IGdldERhdGFSb3dzID0gKCkgPT4gZmlsdGVyRGF0YVJvd3MocmF3RGF0YUxpbmVzLmZpbHRlcihpc0RhdGFSb3cpLCBmaWx0ZXJRdWVyeSwgc2NoZW1hKTtcbiAgICBjb25zdCB3cmFwcGVyID0gY3JlYXRlRGl2KCk7XG4gICAgd3JhcHBlci5jbGFzc05hbWUgPSBcInppYmFzZS13cmFwcGVyXCI7XG4gICAgY29uc3QgdG9wYmFyID0gd3JhcHBlci5jcmVhdGVEaXYoXCJ6aWJhc2UtdG9wYmFyXCIpO1xuICAgIGNvbnN0IGNvbGxhcHNlQnRuID0gdG9wYmFyLmNyZWF0ZUVsKFwiYnV0dG9uXCIsIHsgY2xzOiBcInppYmFzZS1jb2xsYXBzZS1idG5cIiB9KTtcbiAgICBzZXRJY29uKGNvbGxhcHNlQnRuLCBcImNoZXZyb24tcmlnaHRcIik7XG4gICAgY29uc3QgdG9wTGVmdCA9IHRvcGJhci5jcmVhdGVEaXYoXCJ6aWJhc2UtdG9wYmFyLWxlZnRcIik7XG4gICAgdG9wTGVmdC5jcmVhdGVTcGFuKHsgdGV4dDogXCJcdTI3QzFcIiwgY2xzOiBcInppYmFzZS1sb2dvXCIgfSk7XG4gICAgY29uc3QgemliYXNlTmFtZSA9IHRvcExlZnQuY3JlYXRlU3Bhbih7IHRleHQ6IFwiWmlCYXNlXCIsIGNsczogXCJ6aWJhc2UtbmFtZSB6aWJhc2UtbmFtZS1idG5cIiB9KTtcblxuICAgIGxldCBiYWRnZTogSFRNTEVsZW1lbnQ7XG4gICAgaWYgKG9wdGlvbnM/LmxpbmtlZFNvdXJjZSkge1xuICAgICAgYmFkZ2UgPSB0b3BMZWZ0LmNyZWF0ZVNwYW4oeyBjbHM6IFwiemliYXNlLWxpbmtlZC1iYWRnZVwiIH0pO1xuICAgICAgYmFkZ2UuY3JlYXRlU3Bhbih7IHRleHQ6IFwiXHUyNkExIGxpbmtlZDogXCIgfSk7XG4gICAgICBjb25zdCBsaW5rRWwgPSBiYWRnZS5jcmVhdGVTcGFuKHtcbiAgICAgICAgY2xzOiBcInppYmFzZS1saW5rZWQtc291cmNlLWxpbmtcIixcbiAgICAgICAgdGV4dDogYFtbJHtvcHRpb25zLmxpbmtlZFNvdXJjZS5ub3RlUGF0aH0ke29wdGlvbnMubGlua2VkU291cmNlLnN1YnBhdGggfHwgXCJcIn1dXWAsXG4gICAgICB9KTtcbiAgICAgIGxpbmtFbC5hZGRFdmVudExpc3RlbmVyKFwiY2xpY2tcIiwgKGUpID0+IHtcbiAgICAgICAgZS5zdG9wUHJvcGFnYXRpb24oKTtcbiAgICAgICAgdm9pZCB0aGlzLmFwcC53b3Jrc3BhY2Uub3BlbkxpbmtUZXh0KFxuICAgICAgICAgIGAke29wdGlvbnMubGlua2VkU291cmNlIS5ub3RlUGF0aH0ke29wdGlvbnMubGlua2VkU291cmNlIS5zdWJwYXRoIHx8IFwiXCJ9YCxcbiAgICAgICAgICBjb250ZXh0LnNvdXJjZVBhdGgsXG4gICAgICAgICk7XG4gICAgICB9KTtcbiAgICB9IGVsc2Uge1xuICAgICAgYmFkZ2UgPSB0b3BMZWZ0LmNyZWF0ZVNwYW4oe1xuICAgICAgICBjbHM6IHNjaGVtYS5pbmZlcnJlZCA/IFwiemliYXNlLWluZmVycmVkLWJhZGdlXCIgOiBcInppYmFzZS1hbm5vdGF0ZWQtYmFkZ2VcIixcbiAgICAgICAgdGV4dDogc2NoZW1hLmluZmVycmVkID8gXCJpbmZlcnJlZFwiIDogXCJhbm5vdGF0ZWRcIixcbiAgICAgIH0pO1xuICAgIH1cblxuICAgIGNvbnN0IHRvcFJpZ2h0ID0gdG9wYmFyLmNyZWF0ZURpdihcInppYmFzZS10b3BiYXItcmlnaHRcIik7XG4gICAgY29uc3Qgc2VhcmNoV3JhcCA9IHRvcFJpZ2h0LmNyZWF0ZURpdihcInppYmFzZS1zZWFyY2gtd3JhcFwiKTtcbiAgICBjb25zdCBzZWFyY2hJY29uID0gc2VhcmNoV3JhcC5jcmVhdGVTcGFuKHsgY2xzOiBcInppYmFzZS1zZWFyY2gtaWNvblwiIH0pO1xuICAgIHNldEljb24oc2VhcmNoSWNvbiwgXCJzZWFyY2hcIik7XG4gICAgY29uc3Qgc2VhcmNoSW5wdXQgPSBzZWFyY2hXcmFwLmNyZWF0ZUVsKFwiaW5wdXRcIiwgeyBjbHM6IFwiemliYXNlLXNlYXJjaFwiLCB0eXBlOiBcInRleHRcIiB9KTtcbiAgICBzZWFyY2hJbnB1dC5wbGFjZWhvbGRlciA9IFwiRmlsdGVyXHUyMDI2XCI7XG4gICAgaWYgKGZpbHRlclF1ZXJ5KSBzZWFyY2hJbnB1dC52YWx1ZSA9IGZpbHRlclF1ZXJ5O1xuXG4gICAgemliYXNlTmFtZS5hZGRFdmVudExpc3RlbmVyKFwiY2xpY2tcIiwgKGUpID0+IHtcbiAgICAgIGUuc3RvcFByb3BhZ2F0aW9uKCk7XG4gICAgICB0aGlzLnNob3daaUJhc2VNZW51KFxuICAgICAgICBlLFxuICAgICAgICBzY2hlbWEsXG4gICAgICAgIGxpbmVzLFxuICAgICAgICBjb250ZXh0LFxuICAgICAgICBzZWN0aW9uSW5mbyxcbiAgICAgICAgcmF3RGF0YUxpbmVzLFxuICAgICAgICBiYWRnZSxcbiAgICAgICAgY3VycmVudFZpZXcsXG4gICAgICAgIChuZXdWaWV3KSA9PiB7XG4gICAgICAgICAgY3VycmVudFZpZXcgPSBuZXdWaWV3O1xuICAgICAgICAgIHJlbmRlclZpZXdDb250ZW50KCk7XG4gICAgICAgIH0sXG4gICAgICAgIEJvb2xlYW4ob3B0aW9ucz8ubGlua2VkU291cmNlKSxcbiAgICAgICk7XG4gICAgfSk7XG4gICAgY29uc3QgYm9keSA9IHdyYXBwZXIuY3JlYXRlRGl2KFwiemliYXNlLWJvZHlcIik7XG5cbiAgICBjb25zdCBmb290ZXIgPSBib2R5LmNyZWF0ZURpdihcInppYmFzZS1mb290ZXJcIik7XG4gICAgY29uc3QgYWRkUm93QnRuID0gZm9vdGVyLmNyZWF0ZUVsKFwiYnV0dG9uXCIsIHsgY2xzOiBcInppYmFzZS1hZGQtcm93LWJ0blwiIH0pO1xuICAgIHNldEljb24oYWRkUm93QnRuLCBcInBsdXNcIik7XG4gICAgYWRkUm93QnRuLmFwcGVuZFRleHQoXCIgQWRkIHJvd1wiKTtcbiAgICBhZGRSb3dCdG4uYWRkRXZlbnRMaXN0ZW5lcihcImNsaWNrXCIsICgpID0+IHtcbiAgICAgIHZvaWQgdGhpcy5hZGRSb3coY29udGV4dCwgc2VjdGlvbkluZm8sIHNjaGVtYSk7XG4gICAgfSk7XG4gICAgY29uc3Qgcm93Q291bnQgPSBmb290ZXIuY3JlYXRlU3Bhbih7IGNsczogXCJ6aWJhc2Utcm93LWNvdW50XCIgfSk7XG4gICAgY29uc3QgdXBkYXRlQ291bnQgPSAoKSA9PiB7XG4gICAgICBjb25zdCB0b3RhbCA9IHJhd0RhdGFMaW5lcy5maWx0ZXIoaXNEYXRhUm93KS5sZW5ndGg7XG4gICAgICBjb25zdCB2aXNpYmxlID0gZ2V0RGF0YVJvd3MoKS5sZW5ndGg7XG4gICAgICByb3dDb3VudC50ZXh0Q29udGVudCA9IGZpbHRlclF1ZXJ5ICYmIHZpc2libGUgIT09IHRvdGFsID8gYCR7dmlzaWJsZX0gLyAke3RvdGFsfSByb3dzYCA6IGAke3RvdGFsfSByb3dzYDtcbiAgICB9O1xuXG4gICAgY29uc3QgcmVuZGVyVmlld0NvbnRlbnQgPSAoKSA9PiB7XG4gICAgICBib2R5LnF1ZXJ5U2VsZWN0b3JBbGwoXCIuemliYXNlLXRhYmxlLCAuemliYXNlLWthbmJhbiwgLnppYmFzZS1nYWxsZXJ5LCAuemliYXNlLWNhbGVuZGFyXCIpLmZvckVhY2goKGVsKSA9PiBlbC5yZW1vdmUoKSk7XG4gICAgICBjb25zdCB2aWV3Q29udGFpbmVyID0gY3JlYXRlRGl2KCk7XG4gICAgICBzd2l0Y2ggKGN1cnJlbnRWaWV3KSB7XG4gICAgICAgIGNhc2UgXCJrYW5iYW5cIjpcbiAgICAgICAgICBidWlsZEthbmJhblZpZXcodGhpcywgdmlld0NvbnRhaW5lciwgc2NoZW1hLCBnZXREYXRhUm93cywgcmF3RGF0YUxpbmVzLCBjb250ZXh0LCBzZWN0aW9uSW5mbywgZmlsdGVyUXVlcnksIG9wdGlvbnM/Lmdyb3VwQnkpO1xuICAgICAgICAgIGJyZWFrO1xuICAgICAgICBjYXNlIFwiZ2FsbGVyeVwiOlxuICAgICAgICAgIGJ1aWxkR2FsbGVyeVZpZXcodGhpcywgdmlld0NvbnRhaW5lciwgc2NoZW1hLCBnZXREYXRhUm93cywgcmF3RGF0YUxpbmVzLCBjb250ZXh0LCBzZWN0aW9uSW5mbywgZmlsdGVyUXVlcnkpO1xuICAgICAgICAgIGJyZWFrO1xuICAgICAgICBjYXNlIFwiY2FsZW5kYXJcIjpcbiAgICAgICAgICBidWlsZENhbGVuZGFyVmlldyh0aGlzLCB2aWV3Q29udGFpbmVyLCBzY2hlbWEsIGdldERhdGFSb3dzLCByYXdEYXRhTGluZXMsIGNvbnRleHQsIHNlY3Rpb25JbmZvLCBmaWx0ZXJRdWVyeSk7XG4gICAgICAgICAgYnJlYWs7XG4gICAgICAgIGRlZmF1bHQ6XG4gICAgICAgICAgYnVpbGRUYWJsZVZpZXcoXG4gICAgICAgICAgICB0aGlzLFxuICAgICAgICAgICAgdmlld0NvbnRhaW5lcixcbiAgICAgICAgICAgIHNjaGVtYSxcbiAgICAgICAgICAgIGdldERhdGFSb3dzLFxuICAgICAgICAgICAgcmF3RGF0YUxpbmVzLFxuICAgICAgICAgICAgY29udGV4dCxcbiAgICAgICAgICAgIHNlY3Rpb25JbmZvLFxuICAgICAgICAgICAgZmlsdGVyUXVlcnksXG4gICAgICAgICAgICBzb3J0Q29sSWR4LFxuICAgICAgICAgICAgc29ydEFzYyxcbiAgICAgICAgICAgIGJhZGdlLFxuICAgICAgICAgICAgKGNvbCwgYXNjKSA9PiB7XG4gICAgICAgICAgICAgIHNvcnRDb2xJZHggPSBjb2w7XG4gICAgICAgICAgICAgIHNvcnRBc2MgPSBhc2M7XG4gICAgICAgICAgICB9LFxuICAgICAgICAgICk7XG4gICAgICAgICAgYnJlYWs7XG4gICAgICB9XG4gICAgICB3aGlsZSAodmlld0NvbnRhaW5lci5maXJzdENoaWxkKSB7XG4gICAgICAgIGJvZHkuaW5zZXJ0QmVmb3JlKHZpZXdDb250YWluZXIuZmlyc3RDaGlsZCwgZm9vdGVyKTtcbiAgICAgIH1cbiAgICB9O1xuXG4gICAgcmVuZGVyVmlld0NvbnRlbnQoKTtcbiAgICB1cGRhdGVDb3VudCgpO1xuICAgIGNvbGxhcHNlQnRuLmFkZEV2ZW50TGlzdGVuZXIoXCJjbGlja1wiLCAoKSA9PiB7XG4gICAgICBjb2xsYXBzZWQgPSAhY29sbGFwc2VkO1xuICAgICAgYm9keS5jbGFzc0xpc3QudG9nZ2xlKFwiemliYXNlLWJvZHktY29sbGFwc2VkXCIsIGNvbGxhcHNlZCk7XG4gICAgICBjb2xsYXBzZUJ0bi5jbGFzc0xpc3QudG9nZ2xlKFwiemliYXNlLWNvbGxhcHNlZFwiLCBjb2xsYXBzZWQpO1xuICAgIH0pO1xuICAgIHNlYXJjaElucHV0LmFkZEV2ZW50TGlzdGVuZXIoXCJpbnB1dFwiLCAoKSA9PiB7XG4gICAgICBmaWx0ZXJRdWVyeSA9IHNlYXJjaElucHV0LnZhbHVlLnRyaW0oKTtcbiAgICAgIHJlbmRlclZpZXdDb250ZW50KCk7XG4gICAgICB1cGRhdGVDb3VudCgpO1xuICAgIH0pO1xuICAgIHJldHVybiB3cmFwcGVyO1xuICB9XG5cbiAgc2hvd1ppQmFzZU1lbnUoXG4gICAgZTogTW91c2VFdmVudCxcbiAgICBzY2hlbWE6IFRhYmxlU2NoZW1hLFxuICAgIGxpbmVzOiBzdHJpbmdbXSxcbiAgICBjb250ZXh0OiBNYXJrZG93blBvc3RQcm9jZXNzb3JDb250ZXh0LFxuICAgIHNlY3Rpb25JbmZvOiBNYXJrZG93blNlY3Rpb25JbmZvcm1hdGlvbixcbiAgICBfcmF3RGF0YUxpbmVzOiBzdHJpbmdbXSxcbiAgICBfYmFkZ2U6IEhUTUxFbGVtZW50LFxuICAgIGN1cnJlbnRWaWV3OiBWaWV3TmFtZSxcbiAgICBvblZpZXdDaGFuZ2U6ICh2aWV3OiBWaWV3TmFtZSkgPT4gdm9pZCxcbiAgICBpc0xpbmtlZCA9IGZhbHNlLFxuICApOiB2b2lkIHtcbiAgICBkb2N1bWVudC5xdWVyeVNlbGVjdG9yQWxsKFwiLnppYmFzZS1kcm9wZG93blwiKS5mb3JFYWNoKChtKSA9PiBtLnJlbW92ZSgpKTtcbiAgICBjb25zdCBtZW51ID0gY3JlYXRlRGl2KCk7XG4gICAgbWVudS5jbGFzc05hbWUgPSBcInppYmFzZS1kcm9wZG93blwiO1xuICAgIGNvbnN0IHRhcmdldCA9IGUudGFyZ2V0IGFzIEhUTUxFbGVtZW50O1xuICAgIGNvbnN0IHJlY3QgPSB0YXJnZXQuZ2V0Qm91bmRpbmdDbGllbnRSZWN0KCk7XG4gICAgbWVudS5zZXRDc3NTdHlsZXMoeyB0b3A6IGAke3JlY3QuYm90dG9tICsgd2luZG93LnNjcm9sbFkgKyA0fXB4YCB9KTtcbiAgICBtZW51LnNldENzc1N0eWxlcyh7IGxlZnQ6IGAke3JlY3QubGVmdCArIHdpbmRvdy5zY3JvbGxYfXB4YCB9KTtcbiAgICBjb25zdCBjb250cm9sbGVyID0gbmV3IEFib3J0Q29udHJvbGxlcigpO1xuICAgIGNvbnN0IGNsb3NlTWVudSA9ICgpID0+IHtcbiAgICAgIG1lbnUucmVtb3ZlKCk7XG4gICAgICBjb250cm9sbGVyLmFib3J0KCk7XG4gICAgfTtcblxuICAgIGNvbnN0IGV4cG9ydEl0ZW0gPSBtZW51LmNyZWF0ZURpdihcInppYmFzZS1kcm9wZG93bi1pdGVtIHppYmFzZS1kcm9wZG93bi1oYXMtc3ViXCIpO1xuICAgIGV4cG9ydEl0ZW0uY3JlYXRlU3Bhbih7IHRleHQ6IFwiRXhwb3J0XCIsIGNsczogXCJ6aWJhc2UtZHJvcGRvd24tbGFiZWxcIiB9KTtcbiAgICBleHBvcnRJdGVtLmNyZWF0ZVNwYW4oeyB0ZXh0OiBcIlx1MjVCNlwiLCBjbHM6IFwiemliYXNlLWRyb3Bkb3duLWFycm93XCIgfSk7XG4gICAgY29uc3QgZXhwb3J0U3ViID0gZXhwb3J0SXRlbS5jcmVhdGVEaXYoXCJ6aWJhc2UtZHJvcGRvd24tc3ViXCIpO1xuICAgIGNvbnN0IGV4cG9ydE9wdGlvbnMgPSBbXG4gICAgICB7IGljb246IFwiXHVEODNEXHVEQ0NCXCIsIGxhYmVsOiBcIkNvcHkgYXMgTWFya2Rvd25cIiwgYWN0aW9uOiAoKSA9PiB0aGlzLmNvcHlBc01hcmtkb3duKHNjaGVtYSwgbGluZXMpIH0sXG4gICAgICB7IGljb246IFwiXHVEODNEXHVEQ0U0XCIsIGxhYmVsOiBcIkV4cG9ydCBhcyBDU1ZcIiwgYWN0aW9uOiAoKSA9PiB2b2lkIHRoaXMuZXhwb3J0Q1NWKHNjaGVtYSwgbGluZXMsIGNvbnRleHQpIH0sXG4gICAgICB7IGljb246IFwiXHVEODNEXHVEREM0XHVGRTBGXCIsIGxhYmVsOiBcIkV4cG9ydCBhcyBKU09OXCIsIGFjdGlvbjogKCkgPT4gdm9pZCB0aGlzLmV4cG9ydEpTT04oc2NoZW1hLCBsaW5lcywgY29udGV4dCkgfSxcbiAgICBdO1xuICAgIGV4cG9ydE9wdGlvbnMuZm9yRWFjaCgoeyBpY29uLCBsYWJlbCwgYWN0aW9uIH0pID0+IHtcbiAgICAgIGNvbnN0IGl0ZW0gPSBleHBvcnRTdWIuY3JlYXRlRGl2KFwiemliYXNlLWRyb3Bkb3duLXN1Yml0ZW1cIik7XG4gICAgICBpdGVtLmNyZWF0ZVNwYW4oeyB0ZXh0OiBpY29uLCBjbHM6IFwiemliYXNlLWRyb3Bkb3duLWljb25cIiB9KTtcbiAgICAgIGl0ZW0uY3JlYXRlU3Bhbih7IHRleHQ6IGxhYmVsIH0pO1xuICAgICAgaXRlbS5hZGRFdmVudExpc3RlbmVyKFwiY2xpY2tcIiwgKCkgPT4ge1xuICAgICAgICBjbG9zZU1lbnUoKTtcbiAgICAgICAgYWN0aW9uKCk7XG4gICAgICB9KTtcbiAgICB9KTtcblxuICAgIGNvbnN0IHZpZXdJdGVtID0gbWVudS5jcmVhdGVEaXYoXCJ6aWJhc2UtZHJvcGRvd24taXRlbSB6aWJhc2UtZHJvcGRvd24taGFzLXN1YlwiKTtcbiAgICB2aWV3SXRlbS5jcmVhdGVTcGFuKHsgdGV4dDogXCJWaWV3XCIsIGNsczogXCJ6aWJhc2UtZHJvcGRvd24tbGFiZWxcIiB9KTtcbiAgICB2aWV3SXRlbS5jcmVhdGVTcGFuKHsgdGV4dDogXCJcdTI1QjZcIiwgY2xzOiBcInppYmFzZS1kcm9wZG93bi1hcnJvd1wiIH0pO1xuICAgIGNvbnN0IHZpZXdTdWIgPSB2aWV3SXRlbS5jcmVhdGVEaXYoXCJ6aWJhc2UtZHJvcGRvd24tc3ViXCIpO1xuICAgIGNvbnN0IHZpZXdPcHRpb25zOiB7IGljb246IHN0cmluZzsgbGFiZWw6IHN0cmluZzsgdmlldzogVmlld05hbWUgfVtdID0gW1xuICAgICAgeyBpY29uOiBcIlx1RDgzRFx1RENDQVwiLCBsYWJlbDogXCJUYWJsZVwiLCB2aWV3OiBcInRhYmxlXCIgfSxcbiAgICAgIHsgaWNvbjogXCJcdUQ4M0RcdURDQ0JcIiwgbGFiZWw6IFwiS2FuYmFuXCIsIHZpZXc6IFwia2FuYmFuXCIgfSxcbiAgICAgIHsgaWNvbjogXCJcdUQ4M0RcdUREQkNcdUZFMEZcIiwgbGFiZWw6IFwiR2FsbGVyeVwiLCB2aWV3OiBcImdhbGxlcnlcIiB9LFxuICAgICAgeyBpY29uOiBcIlx1RDgzRFx1RENDNVwiLCBsYWJlbDogXCJDYWxlbmRhclwiLCB2aWV3OiBcImNhbGVuZGFyXCIgfSxcbiAgICBdO1xuICAgIHZpZXdPcHRpb25zLmZvckVhY2goKHsgaWNvbiwgbGFiZWwsIHZpZXcgfSkgPT4ge1xuICAgICAgY29uc3QgaXRlbSA9IHZpZXdTdWIuY3JlYXRlRGl2KFwiemliYXNlLWRyb3Bkb3duLXN1Yml0ZW1cIik7XG4gICAgICBpdGVtLmNyZWF0ZVNwYW4oeyB0ZXh0OiBpY29uLCBjbHM6IFwiemliYXNlLWRyb3Bkb3duLWljb25cIiB9KTtcbiAgICAgIGl0ZW0uY3JlYXRlU3Bhbih7IHRleHQ6IGxhYmVsIH0pO1xuICAgICAgaWYgKGN1cnJlbnRWaWV3ID09PSB2aWV3KSB7XG4gICAgICAgIGl0ZW0uY2xhc3NMaXN0LmFkZChcInppYmFzZS1tZW51LWFjdGl2ZVwiKTtcbiAgICAgICAgaXRlbS5jcmVhdGVTcGFuKHsgdGV4dDogXCIgXHUyNzEzXCIsIGNsczogXCJ6aWJhc2Utdmlldy1jaGVja1wiIH0pO1xuICAgICAgfVxuICAgICAgaXRlbS5hZGRFdmVudExpc3RlbmVyKFwiY2xpY2tcIiwgKCkgPT4ge1xuICAgICAgICBjbG9zZU1lbnUoKTtcbiAgICAgICAgaWYgKGN1cnJlbnRWaWV3ICE9PSB2aWV3KSB7XG4gICAgICAgICAgb25WaWV3Q2hhbmdlKHZpZXcpO1xuICAgICAgICAgIGlmICghaXNMaW5rZWQpIHtcbiAgICAgICAgICAgIHZvaWQgdGhpcy5wZXJzaXN0Vmlld0Fubm90YXRpb24oY29udGV4dCwgc2VjdGlvbkluZm8sIHZpZXcpO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfSk7XG4gICAgfSk7XG5cbiAgICBjb25zdCBydWxlc0l0ZW0gPSBtZW51LmNyZWF0ZURpdihcInppYmFzZS1kcm9wZG93bi1pdGVtIHppYmFzZS1kcm9wZG93bi1oYXMtc3ViXCIpO1xuICAgIHJ1bGVzSXRlbS5jcmVhdGVTcGFuKHsgdGV4dDogXCJDb2x1bW4gTmFtZSBSdWxlc1wiLCBjbHM6IFwiemliYXNlLWRyb3Bkb3duLWxhYmVsXCIgfSk7XG4gICAgcnVsZXNJdGVtLmNyZWF0ZVNwYW4oeyB0ZXh0OiBcIlx1MjVCNlwiLCBjbHM6IFwiemliYXNlLWRyb3Bkb3duLWFycm93XCIgfSk7XG4gICAgY29uc3QgcnVsZXNTdWIgPSBydWxlc0l0ZW0uY3JlYXRlRGl2KFwiemliYXNlLWRyb3Bkb3duLXN1YiB6aWJhc2UtcnVsZXMtc3ViXCIpO1xuICAgIHRoaXMucmVuZGVyUnVsZXNQYW5lbChydWxlc1N1Yik7XG5cbiAgICBjb25zdCBzZXR0aW5nc0l0ZW0gPSBtZW51LmNyZWF0ZURpdihcInppYmFzZS1kcm9wZG93bi1pdGVtXCIpO1xuICAgIHNldHRpbmdzSXRlbS5jcmVhdGVTcGFuKHsgdGV4dDogXCJcdTI2OTlcdUZFMEZcIiwgY2xzOiBcInppYmFzZS1kcm9wZG93bi1pY29uXCIgfSk7XG4gICAgc2V0dGluZ3NJdGVtLmNyZWF0ZVNwYW4oeyB0ZXh0OiBcIk9wZW4gU2V0dGluZ3NcIiwgY2xzOiBcInppYmFzZS1kcm9wZG93bi1sYWJlbFwiIH0pO1xuICAgIHNldHRpbmdzSXRlbS5hZGRFdmVudExpc3RlbmVyKFwiY2xpY2tcIiwgKCkgPT4ge1xuICAgICAgY2xvc2VNZW51KCk7XG4gICAgICBjb25zdCBhcHAgPSB0aGlzLmFwcCBhcyBBcHBXaXRoU2V0dGluZ3M7XG4gICAgICBhcHAuc2V0dGluZy5vcGVuKCk7XG4gICAgICBhcHAuc2V0dGluZy5vcGVuVGFiQnlJZChcInppYmFzZVwiKTtcbiAgICB9KTtcbiAgICBkb2N1bWVudC5ib2R5LmFwcGVuZENoaWxkKG1lbnUpO1xuICAgIHdpbmRvdy5zZXRUaW1lb3V0KCgpID0+IHtcbiAgICAgIGRvY3VtZW50LmFkZEV2ZW50TGlzdGVuZXIoXCJjbGlja1wiLCAoZXYpID0+IHtcbiAgICAgICAgaWYgKCFtZW51LmNvbnRhaW5zKGV2LnRhcmdldCBhcyBOb2RlKSkgY2xvc2VNZW51KCk7XG4gICAgICB9LCB7IHNpZ25hbDogY29udHJvbGxlci5zaWduYWwgfSk7XG4gICAgfSwgMTApO1xuICB9XG5cbiAgYXN5bmMgcGVyc2lzdFZpZXdBbm5vdGF0aW9uKFxuICAgIGNvbnRleHQ6IE1hcmtkb3duUG9zdFByb2Nlc3NvckNvbnRleHQsXG4gICAgc2VjdGlvbkluZm86IE1hcmtkb3duU2VjdGlvbkluZm9ybWF0aW9uLFxuICAgIHZpZXc6IHN0cmluZyxcbiAgKTogUHJvbWlzZTx2b2lkPiB7XG4gICAgY29uc3QgZmlsZSA9IHRoaXMuYXBwLnZhdWx0LmdldEFic3RyYWN0RmlsZUJ5UGF0aChjb250ZXh0LnNvdXJjZVBhdGgpO1xuICAgIGlmICghKGZpbGUgaW5zdGFuY2VvZiBURmlsZSkpIHJldHVybjtcbiAgICBhd2FpdCB0aGlzLmFwcC52YXVsdC5wcm9jZXNzKGZpbGUsIChjb250ZW50KSA9PiB7XG4gICAgICBjb25zdCBhbGxMaW5lcyA9IGNvbnRlbnQuc3BsaXQoXCJcXG5cIik7XG4gICAgICBjb25zdCBzZWFyY2hTdGFydCA9IE1hdGgubWF4KDAsIHNlY3Rpb25JbmZvLmxpbmVTdGFydCAtIDEpO1xuICAgICAgZm9yIChsZXQgaSA9IHNlYXJjaFN0YXJ0OyBpIDw9IE1hdGgubWluKHNlY3Rpb25JbmZvLmxpbmVTdGFydCwgYWxsTGluZXMubGVuZ3RoIC0gMSk7IGkrKykge1xuICAgICAgICBpZiAoVklFV19BTk5PVEFUSU9OX1JFLnRlc3QoYWxsTGluZXNbaV0pKSB7XG4gICAgICAgICAgaWYgKHZpZXcgPT09IFwidGFibGVcIikgYWxsTGluZXMuc3BsaWNlKGksIDEpO1xuICAgICAgICAgIGVsc2UgYWxsTGluZXNbaV0gPSBgPCEtLSB6aWJhc2UtdmlldzogJHt2aWV3fSAtLT5gO1xuICAgICAgICAgIHJldHVybiBhbGxMaW5lcy5qb2luKFwiXFxuXCIpO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgICBpZiAodmlldyAhPT0gXCJ0YWJsZVwiKSB7XG4gICAgICAgIGFsbExpbmVzLnNwbGljZShzZWN0aW9uSW5mby5saW5lU3RhcnQsIDAsIGA8IS0tIHppYmFzZS12aWV3OiAke3ZpZXd9IC0tPmApO1xuICAgICAgfVxuICAgICAgcmV0dXJuIGFsbExpbmVzLmpvaW4oXCJcXG5cIik7XG4gICAgfSk7XG4gIH1cblxuICByZW5kZXJSdWxlc1BhbmVsKGNvbnRhaW5lcjogSFRNTEVsZW1lbnQpOiB2b2lkIHtcbiAgICBjb250YWluZXIuZW1wdHkoKTtcbiAgICBjb25zdCB0aXRsZSA9IGNvbnRhaW5lci5jcmVhdGVEaXYoXCJ6aWJhc2UtcnVsZXMtdGl0bGVcIik7XG4gICAgdGl0bGUudGV4dENvbnRlbnQgPSBcIkNvbHVtbiBcdTIxOTIgVHlwZSBydWxlc1wiO1xuICAgIHRoaXMucGx1Z2luLnNldHRpbmdzLmNvbHVtblJ1bGVzLmZvckVhY2goKHJ1bGUsIGlkeCkgPT4ge1xuICAgICAgY29uc3Qgcm93ID0gY29udGFpbmVyLmNyZWF0ZURpdihcInppYmFzZS1ydWxlcy1yb3dcIik7XG4gICAgICBjb25zdCBuYW1lSW5wdXQgPSByb3cuY3JlYXRlRWwoXCJpbnB1dFwiLCB7IHR5cGU6IFwidGV4dFwiLCBjbHM6IFwiemliYXNlLXJ1bGVzLW5hbWVcIiwgdmFsdWU6IHJ1bGUubmFtZSB9KTtcbiAgICAgIG5hbWVJbnB1dC5wbGFjZWhvbGRlciA9IFwibmFtZVwiO1xuICAgICAgbmFtZUlucHV0LmFkZEV2ZW50TGlzdGVuZXIoXCJjaGFuZ2VcIiwgKCkgPT4ge1xuICAgICAgICB2b2lkIChhc3luYyAoKSA9PiB7XG4gICAgICAgICAgdGhpcy5wbHVnaW4uc2V0dGluZ3MuY29sdW1uUnVsZXNbaWR4XS5uYW1lID0gbmFtZUlucHV0LnZhbHVlLnRyaW0oKTtcbiAgICAgICAgICBhd2FpdCB0aGlzLnBsdWdpbi5zYXZlU2V0dGluZ3MoKTtcbiAgICAgICAgfSkoKTtcbiAgICAgIH0pO1xuICAgICAgcm93LmNyZWF0ZVNwYW4oeyB0ZXh0OiBcIlx1MjE5MlwiLCBjbHM6IFwiemliYXNlLXJ1bGVzLWFycm93XCIgfSk7XG4gICAgICBjb25zdCB0eXBlU2VsZWN0ID0gcm93LmNyZWF0ZUVsKFwic2VsZWN0XCIsIHsgY2xzOiBcInppYmFzZS1ydWxlcy10eXBlXCIgfSk7XG4gICAgICBDT0xVTU5fVFlQRV9PUFRJT05TLmZvckVhY2goKHQpID0+IHtcbiAgICAgICAgY29uc3Qgb3B0ID0gdHlwZVNlbGVjdC5jcmVhdGVFbChcIm9wdGlvblwiLCB7IHRleHQ6IHQsIHZhbHVlOiB0IH0pO1xuICAgICAgICBpZiAodCA9PT0gcnVsZS50eXBlKSBvcHQuc2VsZWN0ZWQgPSB0cnVlO1xuICAgICAgfSk7XG4gICAgICB0eXBlU2VsZWN0LmFkZEV2ZW50TGlzdGVuZXIoXCJjaGFuZ2VcIiwgKCkgPT4ge1xuICAgICAgICB2b2lkIChhc3luYyAoKSA9PiB7XG4gICAgICAgICAgdGhpcy5wbHVnaW4uc2V0dGluZ3MuY29sdW1uUnVsZXNbaWR4XS50eXBlID0gdHlwZVNlbGVjdC52YWx1ZTtcbiAgICAgICAgICBhd2FpdCB0aGlzLnBsdWdpbi5zYXZlU2V0dGluZ3MoKTtcbiAgICAgICAgfSkoKTtcbiAgICAgIH0pO1xuICAgICAgY29uc3QgcmVtb3ZlQnRuID0gcm93LmNyZWF0ZUVsKFwiYnV0dG9uXCIsIHsgdGV4dDogXCJcdTAwRDdcIiwgY2xzOiBcInppYmFzZS1ydWxlcy1yZW1vdmVcIiB9KTtcbiAgICAgIHJlbW92ZUJ0bi5hZGRFdmVudExpc3RlbmVyKFwiY2xpY2tcIiwgKCkgPT4ge1xuICAgICAgICB2b2lkIChhc3luYyAoKSA9PiB7XG4gICAgICAgICAgdGhpcy5wbHVnaW4uc2V0dGluZ3MuY29sdW1uUnVsZXMuc3BsaWNlKGlkeCwgMSk7XG4gICAgICAgICAgYXdhaXQgdGhpcy5wbHVnaW4uc2F2ZVNldHRpbmdzKCk7XG4gICAgICAgICAgdGhpcy5yZW5kZXJSdWxlc1BhbmVsKGNvbnRhaW5lcik7XG4gICAgICAgIH0pKCk7XG4gICAgICB9KTtcbiAgICB9KTtcbiAgICBjb25zdCBhZGRSb3cgPSBjb250YWluZXIuY3JlYXRlRGl2KFwiemliYXNlLXJ1bGVzLWFkZFwiKTtcbiAgICBjb25zdCBhZGRCdG4gPSBhZGRSb3cuY3JlYXRlRWwoXCJidXR0b25cIiwgeyB0ZXh0OiBcIisgQWRkIHJ1bGVcIiwgY2xzOiBcInppYmFzZS1ydWxlcy1hZGQtYnRuXCIgfSk7XG4gICAgYWRkQnRuLmFkZEV2ZW50TGlzdGVuZXIoXCJjbGlja1wiLCAoKSA9PiB7XG4gICAgICB2b2lkIChhc3luYyAoKSA9PiB7XG4gICAgICAgIHRoaXMucGx1Z2luLnNldHRpbmdzLmNvbHVtblJ1bGVzLnB1c2goeyBuYW1lOiBcIlwiLCB0eXBlOiBcImxhYmVsXCIgfSk7XG4gICAgICAgIGF3YWl0IHRoaXMucGx1Z2luLnNhdmVTZXR0aW5ncygpO1xuICAgICAgICB0aGlzLnJlbmRlclJ1bGVzUGFuZWwoY29udGFpbmVyKTtcbiAgICAgIH0pKCk7XG4gICAgfSk7XG4gIH1cblxuICBjb3B5QXNNYXJrZG93bihzY2hlbWE6IFRhYmxlU2NoZW1hLCBsaW5lczogc3RyaW5nW10pOiB2b2lkIHtcbiAgICBjb25zdCBkYXRhUm93cyA9IGxpbmVzLnNsaWNlKHNjaGVtYS5kYXRhU3RhcnRJbmRleCkuZmlsdGVyKGlzRGF0YVJvdyk7XG4gICAgY29uc3QgaGVhZGVyID0gXCJ8IFwiICsgc2NoZW1hLmNvbHVtbnMubWFwKChjKSA9PiBjLm5hbWUpLmpvaW4oXCIgfCBcIikgKyBcIiB8XCI7XG4gICAgY29uc3Qgc2VwYXJhdG9yID0gXCJ8IFwiICsgc2NoZW1hLmNvbHVtbnMubWFwKCgpID0+IFwiLS0tXCIpLmpvaW4oXCIgfCBcIikgKyBcIiB8XCI7XG4gICAgY29uc3Qgcm93cyA9IGRhdGFSb3dzLm1hcCgobGluZSkgPT4ge1xuICAgICAgY29uc3QgY2VsbHMgPSBzcGxpdFJvdyhsaW5lKTtcbiAgICAgIHJldHVybiBcInwgXCIgKyBzY2hlbWEuY29sdW1ucy5tYXAoKF8sIGkpID0+IGNlbGxzW2ldID8/IFwiXCIpLmpvaW4oXCIgfCBcIikgKyBcIiB8XCI7XG4gICAgfSk7XG4gICAgdm9pZCBuYXZpZ2F0b3IuY2xpcGJvYXJkLndyaXRlVGV4dChbaGVhZGVyLCBzZXBhcmF0b3IsIC4uLnJvd3NdLmpvaW4oXCJcXG5cIikpO1xuICAgIHNob3dUb2FzdChcIlx1RDgzRFx1RENDQiBDb3BpZWQgYXMgTWFya2Rvd24hXCIpO1xuICB9XG5cbiAgYXN5bmMgZXhwb3J0Q1NWKHNjaGVtYTogVGFibGVTY2hlbWEsIGxpbmVzOiBzdHJpbmdbXSwgY29udGV4dDogTWFya2Rvd25Qb3N0UHJvY2Vzc29yQ29udGV4dCk6IFByb21pc2U8dm9pZD4ge1xuICAgIGNvbnN0IGRhdGFSb3dzID0gbGluZXMuc2xpY2Uoc2NoZW1hLmRhdGFTdGFydEluZGV4KS5maWx0ZXIoaXNEYXRhUm93KTtcbiAgICBjb25zdCBlc2NhcGUgPSAodjogc3RyaW5nKSA9PiBgXCIke3YucmVwbGFjZSgvXCIvZywgJ1wiXCInKX1cImA7XG4gICAgY29uc3QgaGVhZGVyID0gc2NoZW1hLmNvbHVtbnMubWFwKChjKSA9PiBlc2NhcGUoYy5uYW1lKSkuam9pbihcIixcIik7XG4gICAgY29uc3Qgcm93cyA9IGRhdGFSb3dzLm1hcCgobGluZSkgPT4ge1xuICAgICAgY29uc3QgY2VsbHMgPSBzcGxpdFJvdyhsaW5lKTtcbiAgICAgIHJldHVybiBzY2hlbWEuY29sdW1ucy5tYXAoKF8sIGkpID0+IGVzY2FwZSgoY2VsbHNbaV0gPz8gXCJcIikudHJpbSgpKSkuam9pbihcIixcIik7XG4gICAgfSk7XG4gICAgY29uc3Qgbm90ZU5hbWUgPSBjb250ZXh0LnNvdXJjZVBhdGgucmVwbGFjZSgvXFwubWQkLywgXCJcIik7XG4gICAgYXdhaXQgdGhpcy5zYXZlRmlsZShub3RlTmFtZSArIFwiLmNzdlwiLCBbaGVhZGVyLCAuLi5yb3dzXS5qb2luKFwiXFxuXCIpLCBjb250ZXh0KTtcbiAgICBzaG93VG9hc3QoXCJcdUQ4M0RcdURDRTQgRXhwb3J0ZWQgYXMgQ1NWIVwiKTtcbiAgfVxuXG4gIGFzeW5jIGV4cG9ydEpTT04oc2NoZW1hOiBUYWJsZVNjaGVtYSwgbGluZXM6IHN0cmluZ1tdLCBjb250ZXh0OiBNYXJrZG93blBvc3RQcm9jZXNzb3JDb250ZXh0KTogUHJvbWlzZTx2b2lkPiB7XG4gICAgY29uc3QgZGF0YVJvd3MgPSBsaW5lcy5zbGljZShzY2hlbWEuZGF0YVN0YXJ0SW5kZXgpLmZpbHRlcihpc0RhdGFSb3cpO1xuICAgIGNvbnN0IHJlY29yZHMgPSBkYXRhUm93cy5tYXAoKGxpbmUpID0+IHtcbiAgICAgIGNvbnN0IGNlbGxzID0gc3BsaXRSb3cobGluZSk7XG4gICAgICBjb25zdCBvYmo6IFJlY29yZDxzdHJpbmcsIHN0cmluZyB8IGJvb2xlYW4gfCBudW1iZXIgfCBudWxsPiA9IHt9O1xuICAgICAgc2NoZW1hLmNvbHVtbnMuZm9yRWFjaCgoY29sLCBpKSA9PiB7XG4gICAgICAgIGNvbnN0IHJhdyA9IChjZWxsc1tpXSA/PyBcIlwiKS50cmltKCk7XG4gICAgICAgIGlmIChjb2wudHlwZS5raW5kID09PSBcInRvZ2dsZVwiKSBvYmpbY29sLm5hbWVdID0gcGFyc2VCb29sKHJhdyk7XG4gICAgICAgIGVsc2UgaWYgKGNvbC50eXBlLmtpbmQgPT09IFwibnVtYmVyXCIpIG9ialtjb2wubmFtZV0gPSByYXcgPyBwYXJzZUZsb2F0KHJhdykgOiBudWxsO1xuICAgICAgICBlbHNlIG9ialtjb2wubmFtZV0gPSByYXc7XG4gICAgICB9KTtcbiAgICAgIHJldHVybiBvYmo7XG4gICAgfSk7XG4gICAgY29uc3Qgbm90ZU5hbWUgPSBjb250ZXh0LnNvdXJjZVBhdGgucmVwbGFjZSgvXFwubWQkLywgXCJcIik7XG4gICAgYXdhaXQgdGhpcy5zYXZlRmlsZShub3RlTmFtZSArIFwiLmpzb25cIiwgSlNPTi5zdHJpbmdpZnkocmVjb3JkcywgbnVsbCwgMiksIGNvbnRleHQpO1xuICAgIHNob3dUb2FzdChcIlx1RDgzRFx1RERDNFx1RkUwRiBFeHBvcnRlZCBhcyBKU09OIVwiKTtcbiAgfVxuXG4gIGFzeW5jIHNhdmVGaWxlKGZpbGVuYW1lOiBzdHJpbmcsIGNvbnRlbnQ6IHN0cmluZywgY29udGV4dDogTWFya2Rvd25Qb3N0UHJvY2Vzc29yQ29udGV4dCk6IFByb21pc2U8dm9pZD4ge1xuICAgIGNvbnN0IGZpbGUgPSB0aGlzLmFwcC52YXVsdC5nZXRBYnN0cmFjdEZpbGVCeVBhdGgoY29udGV4dC5zb3VyY2VQYXRoKTtcbiAgICBpZiAoIShmaWxlIGluc3RhbmNlb2YgVEZpbGUpKSByZXR1cm47XG4gICAgY29uc3QgZm9sZGVyID0gZmlsZS5wYXJlbnQ/LnBhdGggPz8gXCJcIjtcbiAgICBjb25zdCBiYXNlTmFtZSA9IGZpbGVuYW1lLnNwbGl0KFwiL1wiKS5wb3AoKSA/PyBmaWxlbmFtZTtcbiAgICBjb25zdCBmdWxsUGF0aCA9IGZvbGRlciA/IGAke2ZvbGRlcn0vJHtiYXNlTmFtZX1gIDogYmFzZU5hbWU7XG4gICAgY29uc3QgZXhpc3RpbmcgPSB0aGlzLmFwcC52YXVsdC5nZXRBYnN0cmFjdEZpbGVCeVBhdGgoZnVsbFBhdGgpO1xuICAgIGlmIChleGlzdGluZyBpbnN0YW5jZW9mIFRGaWxlKSBhd2FpdCB0aGlzLmFwcC52YXVsdC5tb2RpZnkoZXhpc3RpbmcsIGNvbnRlbnQpO1xuICAgIGVsc2UgYXdhaXQgdGhpcy5hcHAudmF1bHQuY3JlYXRlKGZ1bGxQYXRoLCBjb250ZW50KTtcbiAgfVxuXG4gIHNob3dUeXBlTWVudShcbiAgICBlOiBNb3VzZUV2ZW50LFxuICAgIGNvbElkeDogbnVtYmVyLFxuICAgIHNjaGVtYTogVGFibGVTY2hlbWEsXG4gICAgY29udGV4dDogTWFya2Rvd25Qb3N0UHJvY2Vzc29yQ29udGV4dCxcbiAgICBzZWN0aW9uSW5mbzogTWFya2Rvd25TZWN0aW9uSW5mb3JtYXRpb24sXG4gICAgX3Jhd0RhdGFMaW5lczogc3RyaW5nW10sXG4gICAgYmFkZ2U6IEhUTUxFbGVtZW50LFxuICApOiB2b2lkIHtcbiAgICBkb2N1bWVudC5xdWVyeVNlbGVjdG9yQWxsKFwiLnppYmFzZS1jb250ZXh0LW1lbnVcIikuZm9yRWFjaCgobSkgPT4gbS5yZW1vdmUoKSk7XG4gICAgY29uc3QgbWVudSA9IGNyZWF0ZURpdigpO1xuICAgIG1lbnUuY2xhc3NOYW1lID0gXCJ6aWJhc2UtY29udGV4dC1tZW51XCI7XG4gICAgY29uc3QgeCA9IE1hdGgubWluKGUuY2xpZW50WCwgd2luZG93LmlubmVyV2lkdGggLSAxNjApO1xuICAgIG1lbnUuc2V0Q3NzU3R5bGVzKHsgdG9wOiBgJHtlLmNsaWVudFkgKyB3aW5kb3cuc2Nyb2xsWX1weGAgfSk7XG4gICAgbWVudS5zZXRDc3NTdHlsZXMoeyBsZWZ0OiBgJHt4fXB4YCB9KTtcbiAgICBjb25zdCB0eXBlcyA9IFtcbiAgICAgIHsgbGFiZWw6IFwiVGV4dFwiLCBpY29uOiBcIlRcIiwga2luZDogXCJ0ZXh0XCIgfSxcbiAgICAgIHsgbGFiZWw6IFwiVG9nZ2xlXCIsIGljb246IFwiXHUyQjFDXCIsIGtpbmQ6IFwidG9nZ2xlXCIgfSxcbiAgICAgIHsgbGFiZWw6IFwiU2VsZWN0XCIsIGljb246IFwiXHUyNUJFXCIsIGtpbmQ6IFwic2VsZWN0XCIgfSxcbiAgICAgIHsgbGFiZWw6IFwiTGFiZWxcIiwgaWNvbjogXCJcdTJCMjFcIiwga2luZDogXCJsYWJlbFwiIH0sXG4gICAgICB7IGxhYmVsOiBcIk11bHRpLXNlbGVjdFwiLCBpY29uOiBcIlx1RDgzQ1x1REZGN1x1RkUwRlwiLCBraW5kOiBcIm11bHRpLXNlbGVjdFwiIH0sXG4gICAgICB7IGxhYmVsOiBcIk51bWJlclwiLCBpY29uOiBcIiNcIiwga2luZDogXCJudW1iZXJcIiB9LFxuICAgICAgeyBsYWJlbDogXCJEYXRlXCIsIGljb246IFwiXHVEODNEXHVEQ0M1XCIsIGtpbmQ6IFwiZGF0ZVwiIH0sXG4gICAgICB7IGxhYmVsOiBcIkZvcm11bGFcIiwgaWNvbjogXCJcdTAxOTJcIiwga2luZDogXCJmb3JtdWxhXCIgfSxcbiAgICBdIGFzIGNvbnN0O1xuICAgIG1lbnUuY3JlYXRlRGl2KFwiemliYXNlLW1lbnUtdGl0bGVcIikudGV4dENvbnRlbnQgPSBzY2hlbWEuY29sdW1uc1tjb2xJZHhdPy5uYW1lID8/IFwiQ29sdW1uXCI7XG4gICAgY29uc3QgY29udHJvbGxlciA9IG5ldyBBYm9ydENvbnRyb2xsZXIoKTtcbiAgICBjb25zdCBjbG9zZU1lbnUgPSAoKSA9PiB7XG4gICAgICBtZW51LnJlbW92ZSgpO1xuICAgICAgY29udHJvbGxlci5hYm9ydCgpO1xuICAgIH07XG4gICAgdHlwZXMuZm9yRWFjaCgoeyBsYWJlbCwgaWNvbiwga2luZCB9KSA9PiB7XG4gICAgICBjb25zdCBpdGVtID0gbWVudS5jcmVhdGVEaXYoXCJ6aWJhc2UtbWVudS1pdGVtXCIpO1xuICAgICAgaXRlbS5jcmVhdGVTcGFuKHsgdGV4dDogaWNvbiwgY2xzOiBcInppYmFzZS1tZW51LWljb25cIiB9KTtcbiAgICAgIGl0ZW0uY3JlYXRlU3Bhbih7IHRleHQ6IGxhYmVsLCBjbHM6IFwiemliYXNlLW1lbnUtbGFiZWxcIiB9KTtcbiAgICAgIGlmIChzY2hlbWEuY29sdW1uc1tjb2xJZHhdPy50eXBlLmtpbmQgPT09IGtpbmQpIGl0ZW0uY2xhc3NMaXN0LmFkZChcInppYmFzZS1tZW51LWFjdGl2ZVwiKTtcbiAgICAgIGl0ZW0uYWRkRXZlbnRMaXN0ZW5lcihcImNsaWNrXCIsICgpID0+IHtcbiAgICAgICAgY2xvc2VNZW51KCk7XG4gICAgICAgIGlmIChraW5kID09PSBcInNlbGVjdFwiKSB7XG4gICAgICAgICAgY29uc3QgY3VycmVudE9wdHMgPSBzY2hlbWEuY29sdW1uc1tjb2xJZHhdPy50eXBlLmtpbmQgPT09IFwic2VsZWN0XCIgPyBzY2hlbWEuY29sdW1uc1tjb2xJZHhdLnR5cGUub3B0aW9ucyA6IFtdO1xuICAgICAgICAgIG5ldyBTZWxlY3RPcHRpb25zTW9kYWwoXG4gICAgICAgICAgICB0aGlzLmFwcCxcbiAgICAgICAgICAgIHNjaGVtYS5jb2x1bW5zW2NvbElkeF0/Lm5hbWUgPz8gXCJDb2x1bW5cIixcbiAgICAgICAgICAgIGN1cnJlbnRPcHRzLFxuICAgICAgICAgICAgKG9wdHMpID0+IHtcbiAgICAgICAgICAgICAgdm9pZCB0aGlzLndyaXRlQ29sdW1uVHlwZShjb250ZXh0LCBzZWN0aW9uSW5mbywgc2NoZW1hLCBjb2xJZHgsIGBzZWxlY3Q6JHtvcHRzLmpvaW4oXCIsXCIpfWAsIGJhZGdlKTtcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgKS5vcGVuKCk7XG4gICAgICAgIH0gZWxzZSBpZiAoa2luZCA9PT0gXCJmb3JtdWxhXCIpIHtcbiAgICAgICAgICBjb25zdCBjb2xOYW1lID0gc2NoZW1hLmNvbHVtbnNbY29sSWR4XT8ubmFtZTtcbiAgICAgICAgICBjb25zdCBjdXJyZW50RXhwciA9IHNjaGVtYS5jb2x1bW5zW2NvbElkeF0/LnR5cGUua2luZCA9PT0gXCJmb3JtdWxhXCIgPyBzY2hlbWEuY29sdW1uc1tjb2xJZHhdLnR5cGUuZXhwcmVzc2lvbiA6IFwiXCI7XG4gICAgICAgICAgbmV3IEZvcm11bGFJbnB1dE1vZGFsKHRoaXMuYXBwLCBjb2xOYW1lIHx8IFwiQ29sdW1uXCIsIGN1cnJlbnRFeHByLCBzY2hlbWEuY29sdW1ucywgKGV4cHIpID0+IHtcbiAgICAgICAgICAgIHZvaWQgdGhpcy53cml0ZUNvbHVtblR5cGUoY29udGV4dCwgc2VjdGlvbkluZm8sIHNjaGVtYSwgY29sSWR4LCBgZm9ybXVsYToke2V4cHJ9YCwgYmFkZ2UpO1xuICAgICAgICAgIH0pLm9wZW4oKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICB2b2lkIHRoaXMud3JpdGVDb2x1bW5UeXBlKGNvbnRleHQsIHNlY3Rpb25JbmZvLCBzY2hlbWEsIGNvbElkeCwga2luZCwgYmFkZ2UpO1xuICAgICAgICB9XG4gICAgICB9KTtcbiAgICB9KTtcbiAgICBkb2N1bWVudC5ib2R5LmFwcGVuZENoaWxkKG1lbnUpO1xuICAgIHdpbmRvdy5zZXRUaW1lb3V0KCgpID0+IHtcbiAgICAgIGRvY3VtZW50LmFkZEV2ZW50TGlzdGVuZXIoXCJjbGlja1wiLCAoZXYpID0+IHtcbiAgICAgICAgaWYgKCFtZW51LmNvbnRhaW5zKGV2LnRhcmdldCBhcyBOb2RlKSkgY2xvc2VNZW51KCk7XG4gICAgICB9LCB7IHNpZ25hbDogY29udHJvbGxlci5zaWduYWwgfSk7XG4gICAgfSwgMTApO1xuICB9XG5cbiAgYXN5bmMgd3JpdGVDb2x1bW5UeXBlKFxuICAgIGNvbnRleHQ6IE1hcmtkb3duUG9zdFByb2Nlc3NvckNvbnRleHQsXG4gICAgc2VjdGlvbkluZm86IE1hcmtkb3duU2VjdGlvbkluZm9ybWF0aW9uLFxuICAgIHNjaGVtYTogVGFibGVTY2hlbWEsXG4gICAgY29sSWR4OiBudW1iZXIsXG4gICAgdHlwZVN0cjogc3RyaW5nLFxuICAgIGJhZGdlOiBIVE1MRWxlbWVudCxcbiAgKTogUHJvbWlzZTx2b2lkPiB7XG4gICAgY29uc3QgZmlsZSA9IHRoaXMuYXBwLnZhdWx0LmdldEFic3RyYWN0RmlsZUJ5UGF0aChjb250ZXh0LnNvdXJjZVBhdGgpO1xuICAgIGlmICghKGZpbGUgaW5zdGFuY2VvZiBURmlsZSkpIHJldHVybjtcbiAgICBhd2FpdCB0aGlzLmFwcC52YXVsdC5wcm9jZXNzKGZpbGUsIChjb250ZW50KSA9PiB7XG4gICAgICBjb25zdCBhbGxMaW5lcyA9IGNvbnRlbnQuc3BsaXQoXCJcXG5cIik7XG4gICAgICBpZiAoc2NoZW1hLmluZmVycmVkKSB7XG4gICAgICAgIGNvbnN0IGFubm90YXRpb25DZWxscyA9IHNjaGVtYS5jb2x1bW5zLm1hcCgoY29sLCBpKSA9PiB7XG4gICAgICAgICAgaWYgKGkgPT09IGNvbElkeCkgcmV0dXJuIGAgPCEtLSB6aWJhc2U6ICR7dHlwZVN0cn0gLS0+IGA7XG4gICAgICAgICAgaWYgKGNvbC50eXBlLmtpbmQgPT09IFwiZm9ybXVsYVwiKSByZXR1cm4gYCA8IS0tIHppYmFzZTogZm9ybXVsYToke2NvbC50eXBlLmV4cHJlc3Npb259IC0tPiBgO1xuICAgICAgICAgIHJldHVybiBgIDwhLS0gemliYXNlOiAke2NvbC50eXBlLmtpbmR9IC0tPiBgO1xuICAgICAgICB9KTtcbiAgICAgICAgYWxsTGluZXMuc3BsaWNlKHNlY3Rpb25JbmZvLmxpbmVTdGFydCArIDIsIDAsIFwifCBcIiArIGFubm90YXRpb25DZWxscy5qb2luKFwiIHwgXCIpICsgXCIgfFwiKTtcbiAgICAgICAgd2luZG93LnNldFRpbWVvdXQoKCkgPT4ge1xuICAgICAgICAgIGJhZGdlLnRleHRDb250ZW50ID0gXCJhbm5vdGF0ZWRcIjtcbiAgICAgICAgICBiYWRnZS5jbGFzc05hbWUgPSBcInppYmFzZS1hbm5vdGF0ZWQtYmFkZ2VcIjtcbiAgICAgICAgfSwgNTApO1xuICAgICAgfSBlbHNlIGlmIChzY2hlbWEuc2NoZW1hUm93SW5kZXggIT09IG51bGwpIHtcbiAgICAgICAgY29uc3QgY2VsbHMgPSBzcGxpdFJvdyhhbGxMaW5lc1tzZWN0aW9uSW5mby5saW5lU3RhcnQgKyBzY2hlbWEuc2NoZW1hUm93SW5kZXhdKTtcbiAgICAgICAgY2VsbHNbY29sSWR4XSA9IGAgPCEtLSB6aWJhc2U6ICR7dHlwZVN0cn0gLS0+IGA7XG4gICAgICAgIGFsbExpbmVzW3NlY3Rpb25JbmZvLmxpbmVTdGFydCArIHNjaGVtYS5zY2hlbWFSb3dJbmRleF0gPSBzZXJpYWxpemVSb3coY2VsbHMpO1xuICAgICAgfVxuICAgICAgcmV0dXJuIGFsbExpbmVzLmpvaW4oXCJcXG5cIik7XG4gICAgfSk7XG4gIH1cblxuICByZW5kZXJDZWxsKFxuICAgIHRkOiBIVE1MVGFibGVDZWxsRWxlbWVudCxcbiAgICBjb2w6IENvbHVtbixcbiAgICByYXdWYWx1ZTogc3RyaW5nLFxuICAgIGNvbnRleHQ6IE1hcmtkb3duUG9zdFByb2Nlc3NvckNvbnRleHQsXG4gICAgc2NoZW1hOiBUYWJsZVNjaGVtYSxcbiAgICByb3dDZWxsczogc3RyaW5nW10sXG4gICAgb25DaGFuZ2U6IENlbGxDaGFuZ2VIYW5kbGVyLFxuICApOiB2b2lkIHtcbiAgICByZW5kZXJDZWxsKHRoaXMsIHRkLCBjb2wsIHJhd1ZhbHVlLCBjb250ZXh0LCBzY2hlbWEsIHJvd0NlbGxzLCBvbkNoYW5nZSk7XG4gIH1cblxuICBhc3luYyB3cml0ZUJhY2soXG4gICAgY29udGV4dDogTWFya2Rvd25Qb3N0UHJvY2Vzc29yQ29udGV4dCxcbiAgICBzZWN0aW9uSW5mbzogTWFya2Rvd25TZWN0aW9uSW5mb3JtYXRpb24sXG4gICAgdGFibGVSb3dJbmRleDogbnVtYmVyLFxuICAgIGNvbEluZGV4OiBudW1iZXIsXG4gICAgbmV3VmFsdWU6IHN0cmluZyxcbiAgKTogUHJvbWlzZTx2b2lkPiB7XG4gICAgY29uc3QgZmlsZSA9IHRoaXMuYXBwLnZhdWx0LmdldEFic3RyYWN0RmlsZUJ5UGF0aChjb250ZXh0LnNvdXJjZVBhdGgpO1xuICAgIGlmICghKGZpbGUgaW5zdGFuY2VvZiBURmlsZSkpIHJldHVybjtcbiAgICBhd2FpdCB0aGlzLmFwcC52YXVsdC5wcm9jZXNzKGZpbGUsIChjb250ZW50KSA9PiB7XG4gICAgICBjb25zdCBhbGxMaW5lcyA9IGNvbnRlbnQuc3BsaXQoXCJcXG5cIik7XG4gICAgICBjb25zdCBmaWxlTGluZUluZGV4ID0gc2VjdGlvbkluZm8ubGluZVN0YXJ0ICsgdGFibGVSb3dJbmRleDtcbiAgICAgIGNvbnN0IHRhcmdldExpbmUgPSBhbGxMaW5lc1tmaWxlTGluZUluZGV4XTtcbiAgICAgIGlmICghdGFyZ2V0TGluZSkgcmV0dXJuIGNvbnRlbnQ7XG4gICAgICBjb25zdCBjZWxscyA9IHNwbGl0Um93KHRhcmdldExpbmUpO1xuICAgICAgY2VsbHNbY29sSW5kZXhdID0gYCAke25ld1ZhbHVlfSBgO1xuICAgICAgYWxsTGluZXNbZmlsZUxpbmVJbmRleF0gPSBzZXJpYWxpemVSb3coY2VsbHMpO1xuICAgICAgcmV0dXJuIGFsbExpbmVzLmpvaW4oXCJcXG5cIik7XG4gICAgfSk7XG4gIH1cblxuICBhc3luYyBhZGRSb3coXG4gICAgY29udGV4dDogTWFya2Rvd25Qb3N0UHJvY2Vzc29yQ29udGV4dCxcbiAgICBzZWN0aW9uSW5mbzogTWFya2Rvd25TZWN0aW9uSW5mb3JtYXRpb24sXG4gICAgc2NoZW1hOiBUYWJsZVNjaGVtYSxcbiAgKTogUHJvbWlzZTx2b2lkPiB7XG4gICAgY29uc3QgZmlsZSA9IHRoaXMuYXBwLnZhdWx0LmdldEFic3RyYWN0RmlsZUJ5UGF0aChjb250ZXh0LnNvdXJjZVBhdGgpO1xuICAgIGlmICghKGZpbGUgaW5zdGFuY2VvZiBURmlsZSkpIHJldHVybjtcbiAgICBhd2FpdCB0aGlzLmFwcC52YXVsdC5wcm9jZXNzKGZpbGUsIChjb250ZW50KSA9PiB7XG4gICAgICBjb25zdCBhbGxMaW5lcyA9IGNvbnRlbnQuc3BsaXQoXCJcXG5cIik7XG4gICAgICBhbGxMaW5lcy5zcGxpY2Uoc2VjdGlvbkluZm8ubGluZUVuZCArIDEsIDAsIHNlcmlhbGl6ZVJvdyhzY2hlbWEuY29sdW1ucy5tYXAoKCkgPT4gXCIgICBcIikpKTtcbiAgICAgIHJldHVybiBhbGxMaW5lcy5qb2luKFwiXFxuXCIpO1xuICAgIH0pO1xuICB9XG5cbiAgYXN5bmMgcmVyZW5kZXJUZXh0Q2VsbCh0ZDogSFRNTEVsZW1lbnQsIG5ld1Jhdzogc3RyaW5nLCBjb250ZXh0OiBNYXJrZG93blBvc3RQcm9jZXNzb3JDb250ZXh0KTogUHJvbWlzZTx2b2lkPiB7XG4gICAgdGQuZGF0YXNldC5yYXcgPSBuZXdSYXc7XG4gICAgY29uc3QgZGlzcGxheVNwYW4gPSB0ZC5xdWVyeVNlbGVjdG9yKFwiLnppYmFzZS10ZXh0LXJlbmRlcmVkXCIpO1xuICAgIGlmICghZGlzcGxheVNwYW4pIHJldHVybjtcbiAgICBkaXNwbGF5U3Bhbi5lbXB0eSgpO1xuICAgIGlmIChuZXdSYXcpIHtcbiAgICAgIGNvbnN0IGNvbXAgPSBuZXcgTWFya2Rvd25SZW5kZXJDaGlsZChkaXNwbGF5U3BhbiBhcyBIVE1MRWxlbWVudCk7XG4gICAgICBjb250ZXh0LmFkZENoaWxkKGNvbXApO1xuICAgICAgYXdhaXQgTWFya2Rvd25SZW5kZXJlci5yZW5kZXIodGhpcy5hcHAsIG5ld1JhdywgZGlzcGxheVNwYW4gYXMgSFRNTEVsZW1lbnQsIGNvbnRleHQuc291cmNlUGF0aCwgY29tcCk7XG4gICAgICB3aW5kb3cuc2V0VGltZW91dCgoKSA9PiB7XG4gICAgICAgIGRpc3BsYXlTcGFuLnF1ZXJ5U2VsZWN0b3JBbGwoXCJhXCIpLmZvckVhY2goKGEpID0+IGF0dGFjaExpbmtUb29sdGlwKGEpKTtcbiAgICAgIH0sIDUwKTtcbiAgICAgIGRpc3BsYXlTcGFuLmNsYXNzTGlzdC5yZW1vdmUoXCJ6aWJhc2UtdGV4dC1lbXB0eVwiKTtcbiAgICB9IGVsc2Uge1xuICAgICAgZGlzcGxheVNwYW4udGV4dENvbnRlbnQgPSBcIlx1MjAxNFwiO1xuICAgICAgZGlzcGxheVNwYW4uY2xhc3NMaXN0LmFkZChcInppYmFzZS10ZXh0LWVtcHR5XCIpO1xuICAgIH1cbiAgfVxuXG4gIHJlbmRlckVycm9yKGVsZW1lbnQ6IEhUTUxFbGVtZW50LCBtZXNzYWdlOiBzdHJpbmcpOiB2b2lkIHtcbiAgICBlbGVtZW50LmVtcHR5KCk7XG4gICAgY29uc3QgZXJyb3JEaXYgPSBlbGVtZW50LmNyZWF0ZURpdihcInppYmFzZS1lcnJvclwiKTtcbiAgICBlcnJvckRpdi5jcmVhdGVTcGFuKHsgdGV4dDogXCJcdTI2QTBcdUZFMEYgWmlCYXNlOiBcIiArIG1lc3NhZ2UgfSk7XG4gIH1cblxuICBhc3luYyBwcm9jZXNzQ29kZUJsb2NrKFxuICAgIHNvdXJjZTogc3RyaW5nLFxuICAgIGVsZW1lbnQ6IEhUTUxFbGVtZW50LFxuICAgIGNvbnRleHQ6IE1hcmtkb3duUG9zdFByb2Nlc3NvckNvbnRleHQsXG4gICk6IFByb21pc2U8dm9pZD4ge1xuICAgIGNvbnN0IGNvbmZpZyA9IHBhcnNlTGlua2VkVmlld0NvbmZpZyhzb3VyY2UpO1xuICAgIGlmICghY29uZmlnKSB7XG4gICAgICB0aGlzLnJlbmRlckVycm9yKGVsZW1lbnQsIFwiSW52YWxpZCBibG9jayBjb25maWd1cmF0aW9uLiBFeHBlY3RlZCAnc291cmNlOiBbW05vdGUjVGFibGVdXSdcIik7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgY29uc3QgdGFyZ2V0RmlsZSA9IHRoaXMuYXBwLm1ldGFkYXRhQ2FjaGUuZ2V0Rmlyc3RMaW5rcGF0aERlc3QoY29uZmlnLm5vdGVQYXRoLCBjb250ZXh0LnNvdXJjZVBhdGgpO1xuICAgIGlmICghKHRhcmdldEZpbGUgaW5zdGFuY2VvZiBURmlsZSkpIHtcbiAgICAgIHRoaXMucmVuZGVyRXJyb3IoZWxlbWVudCwgYFNvdXJjZSBub3RlIFwiW1ske2NvbmZpZy5ub3RlUGF0aH1dXVwiIG5vdCBmb3VuZCBpbiB2YXVsdC5gKTtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICBjb25zdCBjaGlsZCA9IG5ldyBNYXJrZG93blJlbmRlckNoaWxkKGVsZW1lbnQpO1xuICAgIGNvbnRleHQuYWRkQ2hpbGQoY2hpbGQpO1xuXG4gICAgbGV0IGlzVXBkYXRpbmcgPSBmYWxzZTtcblxuICAgIGNvbnN0IHJlbmRlciA9IGFzeW5jICgpID0+IHtcbiAgICAgIGlmIChpc1VwZGF0aW5nKSByZXR1cm47XG4gICAgICBpc1VwZGF0aW5nID0gdHJ1ZTtcbiAgICAgIHRyeSB7XG4gICAgICAgIGNvbnN0IGNvbnRlbnQgPSBhd2FpdCB0aGlzLmFwcC52YXVsdC5yZWFkKHRhcmdldEZpbGUpO1xuICAgICAgICBjb25zdCByZXNvbHZlZCA9IHJlc29sdmVUYXJnZXRUYWJsZShjb250ZW50LCB7XG4gICAgICAgICAgc3VicGF0aDogY29uZmlnLnN1YnBhdGgsXG4gICAgICAgICAgdGFibGVJbmRleDogY29uZmlnLnRhYmxlSW5kZXgsXG4gICAgICAgIH0pO1xuXG4gICAgICAgIGlmICghcmVzb2x2ZWQpIHtcbiAgICAgICAgICBjb25zdCBkZXNjID0gY29uZmlnLnN1YnBhdGggPyBgdW5kZXIgXCIke2NvbmZpZy5zdWJwYXRofVwiYCA6IGAodGFibGUgIyR7Y29uZmlnLnRhYmxlSW5kZXh9KWA7XG4gICAgICAgICAgdGhpcy5yZW5kZXJFcnJvcihlbGVtZW50LCBgVGFibGUgbm90IGZvdW5kIGluIFwiJHt0YXJnZXRGaWxlLmJhc2VuYW1lfVwiICR7ZGVzY30uYCk7XG4gICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG5cbiAgICAgICAgY29uc3Qgc2NoZW1hID0gcGFyc2VaaUJhc2VTY2hlbWEocmVzb2x2ZWQudGFibGUubGluZXMsIHRoaXMucGx1Z2luLnNldHRpbmdzLmNvbHVtblJ1bGVzKTtcbiAgICAgICAgaWYgKCFzY2hlbWEpIHtcbiAgICAgICAgICB0aGlzLnJlbmRlckVycm9yKGVsZW1lbnQsIGBVbmFibGUgdG8gcGFyc2UgdGFibGUgc2NoZW1hIGluIFwiJHt0YXJnZXRGaWxlLmJhc2VuYW1lfVwiLmApO1xuICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuXG4gICAgICAgIGVsZW1lbnQuZW1wdHkoKTtcblxuICAgICAgICBjb25zdCBsaW5rZWRTZWN0aW9uSW5mbzogTWFya2Rvd25TZWN0aW9uSW5mb3JtYXRpb24gPSB7XG4gICAgICAgICAgdGV4dDogY29udGVudCxcbiAgICAgICAgICBsaW5lU3RhcnQ6IHJlc29sdmVkLnRhYmxlLnN0YXJ0TGluZSxcbiAgICAgICAgICBsaW5lRW5kOiByZXNvbHZlZC50YWJsZS5lbmRMaW5lLFxuICAgICAgICB9O1xuXG4gICAgICAgIGNvbnN0IGxpbmtlZENvbnRleHQ6IE1hcmtkb3duUG9zdFByb2Nlc3NvckNvbnRleHQgPSB7XG4gICAgICAgICAgLi4uY29udGV4dCxcbiAgICAgICAgICBzb3VyY2VQYXRoOiB0YXJnZXRGaWxlLnBhdGgsXG4gICAgICAgICAgZ2V0U2VjdGlvbkluZm86ICgpID0+IGxpbmtlZFNlY3Rpb25JbmZvLFxuICAgICAgICB9O1xuXG4gICAgICAgIGNvbnN0IHJpY2hUYWJsZSA9IHRoaXMuYnVpbGRSaWNoVGFibGUoXG4gICAgICAgICAgc2NoZW1hLFxuICAgICAgICAgIHJlc29sdmVkLnRhYmxlLmxpbmVzLFxuICAgICAgICAgIGxpbmtlZENvbnRleHQsXG4gICAgICAgICAgbGlua2VkU2VjdGlvbkluZm8sXG4gICAgICAgICAge1xuICAgICAgICAgICAgbGlua2VkU291cmNlOiB7XG4gICAgICAgICAgICAgIGZpbGU6IHRhcmdldEZpbGUsXG4gICAgICAgICAgICAgIG5vdGVQYXRoOiBjb25maWcubm90ZVBhdGgsXG4gICAgICAgICAgICAgIHN1YnBhdGg6IGNvbmZpZy5zdWJwYXRoLFxuICAgICAgICAgICAgICB0YWJsZUluZGV4OiBjb25maWcudGFibGVJbmRleCxcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICBpbml0aWFsVmlldzogY29uZmlnLnZpZXcsXG4gICAgICAgICAgICBpbml0aWFsRmlsdGVyOiBjb25maWcuZmlsdGVyLFxuICAgICAgICAgICAgaW5pdGlhbFNvcnQ6IGNvbmZpZy5zb3J0LFxuICAgICAgICAgICAgZ3JvdXBCeTogY29uZmlnLmdyb3VwQnksXG4gICAgICAgICAgfSxcbiAgICAgICAgKTtcblxuICAgICAgICBlbGVtZW50LmFwcGVuZENoaWxkKHJpY2hUYWJsZSk7XG4gICAgICB9IGZpbmFsbHkge1xuICAgICAgICBpc1VwZGF0aW5nID0gZmFsc2U7XG4gICAgICB9XG4gICAgfTtcblxuICAgIGF3YWl0IHJlbmRlcigpO1xuXG4gICAgY2hpbGQucmVnaXN0ZXJFdmVudChcbiAgICAgIHRoaXMuYXBwLnZhdWx0Lm9uKFwibW9kaWZ5XCIsIChmaWxlKSA9PiB7XG4gICAgICAgIGlmIChmaWxlLnBhdGggPT09IHRhcmdldEZpbGUucGF0aCkge1xuICAgICAgICAgIGlmIChlbGVtZW50LmNvbnRhaW5zKGRvY3VtZW50LmFjdGl2ZUVsZW1lbnQpKSB7XG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgfVxuICAgICAgICAgIHZvaWQgcmVuZGVyKCk7XG4gICAgICAgIH1cbiAgICAgIH0pLFxuICAgICk7XG4gIH1cbn1cbiIsICJpbXBvcnQgeyBDb21wb25lbnQsIE1hcmtkb3duUmVuZGVyQ2hpbGQsIE1hcmtkb3duUmVuZGVyZXIsIHR5cGUgTWFya2Rvd25Qb3N0UHJvY2Vzc29yQ29udGV4dCB9IGZyb20gXCJvYnNpZGlhblwiO1xuaW1wb3J0IHtcbiAgZXZhbHVhdGVGb3JtdWxhLFxuICBldmFsdWF0ZVNpbXBsZU1hdGgsXG4gIGZvcm1hdFJlc3VsdCxcbiAgaXNCYWNrdGlja2VkLFxuICBpc1NpbXBsZU1hdGgsXG4gIHN0cmlwQmFja3RpY2tzLFxufSBmcm9tIFwiLi9mb3JtdWxhXCI7XG5pbXBvcnQgeyBwYXJzZUJvb2wsIHBhcnNlTXVsdGlTZWxlY3QsIHNlcmlhbGl6ZUJvb2wgfSBmcm9tIFwiLi9zY2hlbWFcIjtcbmltcG9ydCB0eXBlIHsgQ2VsbENoYW5nZUhhbmRsZXIsIENvbHVtbiwgVGFibGVTY2hlbWEsIFppQmFzZUhvc3QgfSBmcm9tIFwiLi90eXBlc1wiO1xuaW1wb3J0IHsgYXR0YWNoTGlua1Rvb2x0aXAsIGdldExhYmVsQ29sb3IsIHN0YXJ0TGFiZWxFZGl0IH0gZnJvbSBcIi4vdWlcIjtcblxuZXhwb3J0IGZ1bmN0aW9uIHN0YXJ0TWFya2Rvd25FZGl0KFxuICB0ZDogSFRNTEVsZW1lbnQsXG4gIHJhd1ZhbHVlOiBzdHJpbmcsXG4gIGNvbnRleHQ6IE1hcmtkb3duUG9zdFByb2Nlc3NvckNvbnRleHQsXG4gIGhvc3Q6IFppQmFzZUhvc3QsXG4gIG9uQ2hhbmdlOiBDZWxsQ2hhbmdlSGFuZGxlcixcbik6IHZvaWQge1xuICBpZiAodGQucXVlcnlTZWxlY3RvcihcIi56aWJhc2UtaW5saW5lLWlucHV0XCIpKSByZXR1cm47XG4gIGNvbnN0IGRpc3BsYXlTcGFuID0gdGQucXVlcnlTZWxlY3RvcjxIVE1MRWxlbWVudD4oXCIuemliYXNlLXRleHQtcmVuZGVyZWRcIik7XG4gIGlmIChkaXNwbGF5U3BhbikgZGlzcGxheVNwYW4uc2V0Q3NzU3R5bGVzKHsgZGlzcGxheTogXCJub25lXCIgfSk7XG4gIGNvbnN0IGlucHV0ID0gY3JlYXRlRWwoXCJpbnB1dFwiKTtcbiAgaW5wdXQuY2xhc3NOYW1lID0gXCJ6aWJhc2UtaW5saW5lLWlucHV0XCI7XG4gIGlucHV0LnZhbHVlID0gcmF3VmFsdWU7XG4gIHRkLmFwcGVuZENoaWxkKGlucHV0KTtcbiAgaW5wdXQuZm9jdXMoKTtcbiAgaW5wdXQuc2VsZWN0KCk7XG4gIGNvbnN0IGNvbW1pdCA9IGFzeW5jICgpID0+IHtcbiAgICBjb25zdCBuZXdWYWwgPSBpbnB1dC52YWx1ZTtcbiAgICBpbnB1dC5yZW1vdmUoKTtcbiAgICBpZiAoZGlzcGxheVNwYW4pIGRpc3BsYXlTcGFuLnNldENzc1N0eWxlcyh7IGRpc3BsYXk6IFwiXCIgfSk7XG4gICAgYXdhaXQgb25DaGFuZ2UobmV3VmFsKTtcbiAgICBhd2FpdCBob3N0LnJlcmVuZGVyVGV4dENlbGwodGQsIG5ld1ZhbCwgY29udGV4dCk7XG4gIH07XG4gIGlucHV0LmFkZEV2ZW50TGlzdGVuZXIoXCJibHVyXCIsICgpID0+IHsgdm9pZCBjb21taXQoKTsgfSk7XG4gIGlucHV0LmFkZEV2ZW50TGlzdGVuZXIoXCJrZXlkb3duXCIsIChlOiBLZXlib2FyZEV2ZW50KSA9PiB7XG4gICAgaWYgKGUua2V5ID09PSBcIkVudGVyXCIpIHtcbiAgICAgIGUucHJldmVudERlZmF1bHQoKTtcbiAgICAgIHZvaWQgY29tbWl0KCk7XG4gICAgfVxuICAgIGlmIChlLmtleSA9PT0gXCJFc2NhcGVcIikge1xuICAgICAgaW5wdXQucmVtb3ZlKCk7XG4gICAgICBpZiAoZGlzcGxheVNwYW4pIGRpc3BsYXlTcGFuLnNldENzc1N0eWxlcyh7IGRpc3BsYXk6IFwiXCIgfSk7XG4gICAgfVxuICB9KTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIHJlbmRlckNlbGwoXG4gIGhvc3Q6IFppQmFzZUhvc3QsXG4gIHRkOiBIVE1MVGFibGVDZWxsRWxlbWVudCxcbiAgY29sOiBDb2x1bW4sXG4gIHJhd1ZhbHVlOiBzdHJpbmcsXG4gIGNvbnRleHQ6IE1hcmtkb3duUG9zdFByb2Nlc3NvckNvbnRleHQsXG4gIHNjaGVtYTogVGFibGVTY2hlbWEsXG4gIHJvd0NlbGxzOiBzdHJpbmdbXSxcbiAgb25DaGFuZ2U6IENlbGxDaGFuZ2VIYW5kbGVyLFxuKTogdm9pZCB7XG4gIHN3aXRjaCAoY29sLnR5cGUua2luZCkge1xuICAgIGNhc2UgXCJ0b2dnbGVcIjoge1xuICAgICAgY29uc3QgY2hlY2tlZCA9IHBhcnNlQm9vbChyYXdWYWx1ZSk7XG4gICAgICBjb25zdCBsYWJlbCA9IHRkLmNyZWF0ZUVsKFwibGFiZWxcIiwgeyBjbHM6IFwiemliYXNlLXRvZ2dsZS1sYWJlbFwiIH0pO1xuICAgICAgY29uc3QgaW5wdXQgPSBsYWJlbC5jcmVhdGVFbChcImlucHV0XCIsIHsgdHlwZTogXCJjaGVja2JveFwiIH0pO1xuICAgICAgaW5wdXQuY2hlY2tlZCA9IGNoZWNrZWQ7XG4gICAgICBpbnB1dC5jbGFzc05hbWUgPSBcInppYmFzZS10b2dnbGUtaW5wdXRcIjtcbiAgICAgIGxhYmVsLmNyZWF0ZURpdihcInppYmFzZS10b2dnbGUtdHJhY2tcIikuY3JlYXRlRGl2KFwiemliYXNlLXRvZ2dsZS10aHVtYlwiKTtcbiAgICAgIGlucHV0LmFkZEV2ZW50TGlzdGVuZXIoXCJjaGFuZ2VcIiwgKCkgPT4ge1xuICAgICAgICB2b2lkIG9uQ2hhbmdlKHNlcmlhbGl6ZUJvb2woaW5wdXQuY2hlY2tlZCkpO1xuICAgICAgfSk7XG4gICAgICBicmVhaztcbiAgICB9XG4gICAgY2FzZSBcInNlbGVjdFwiOiB7XG4gICAgICBjb25zdCBzZWxlY3QgPSB0ZC5jcmVhdGVFbChcInNlbGVjdFwiLCB7IGNsczogXCJ6aWJhc2Utc2VsZWN0XCIgfSk7XG4gICAgICBzZWxlY3QuY3JlYXRlRWwoXCJvcHRpb25cIiwgeyB2YWx1ZTogXCJcIiwgdGV4dDogXCJcdTIwMTRcIiB9KTtcbiAgICAgIGNvbC50eXBlLm9wdGlvbnMuZm9yRWFjaCgob3B0KSA9PiB7XG4gICAgICAgIGNvbnN0IG8gPSBzZWxlY3QuY3JlYXRlRWwoXCJvcHRpb25cIiwgeyB0ZXh0OiBvcHQsIHZhbHVlOiBvcHQgfSk7XG4gICAgICAgIGlmIChvcHQgPT09IHJhd1ZhbHVlLnRyaW0oKSkgby5zZWxlY3RlZCA9IHRydWU7XG4gICAgICB9KTtcbiAgICAgIGlmICghcmF3VmFsdWUudHJpbSgpKSBzZWxlY3Qub3B0aW9uc1swXS5zZWxlY3RlZCA9IHRydWU7XG4gICAgICBzZWxlY3QuYWRkRXZlbnRMaXN0ZW5lcihcImNoYW5nZVwiLCAoKSA9PiB7XG4gICAgICAgIHZvaWQgb25DaGFuZ2Uoc2VsZWN0LnZhbHVlKTtcbiAgICAgIH0pO1xuICAgICAgYnJlYWs7XG4gICAgfVxuICAgIGNhc2UgXCJtdWx0aS1zZWxlY3RcIjoge1xuICAgICAgY29uc3Qgd3JhcCA9IHRkLmNyZWF0ZURpdihcInppYmFzZS1tdWx0aS1zZWxlY3Qtd3JhcFwiKTtcbiAgICAgIGNvbnN0IHRhZ3MgPSBwYXJzZU11bHRpU2VsZWN0KHJhd1ZhbHVlKTtcbiAgICAgIGlmICh0YWdzLmxlbmd0aCA9PT0gMCkge1xuICAgICAgICBjb25zdCBlbXB0eSA9IHdyYXAuY3JlYXRlU3Bhbih7IHRleHQ6IFwiXHUyMDE0XCIsIGNsczogXCJ6aWJhc2UtdGV4dC1lbXB0eVwiIH0pO1xuICAgICAgICBlbXB0eS5hZGRFdmVudExpc3RlbmVyKFwiY2xpY2tcIiwgKCkgPT4gc3RhcnRMYWJlbEVkaXQod3JhcCwgcmF3VmFsdWUsIG9uQ2hhbmdlKSk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICB0YWdzLmZvckVhY2goKHRhZykgPT4ge1xuICAgICAgICAgIGNvbnN0IGNoaXAgPSB3cmFwLmNyZWF0ZVNwYW4oeyB0ZXh0OiB0YWcsIGNsczogXCJ6aWJhc2UtbGFiZWxcIiB9KTtcbiAgICAgICAgICBjaGlwLnNldENzc1Byb3BzKHsgXCItLWxjXCI6IGdldExhYmVsQ29sb3IodGFnKSB9KTtcbiAgICAgICAgICBjaGlwLmFkZEV2ZW50TGlzdGVuZXIoXCJjbGlja1wiLCAoZSkgPT4ge1xuICAgICAgICAgICAgZS5zdG9wUHJvcGFnYXRpb24oKTtcbiAgICAgICAgICAgIHN0YXJ0TGFiZWxFZGl0KHdyYXAsIHJhd1ZhbHVlLCBvbkNoYW5nZSk7XG4gICAgICAgICAgfSk7XG4gICAgICAgIH0pO1xuICAgICAgICB3cmFwLmFkZEV2ZW50TGlzdGVuZXIoXCJjbGlja1wiLCAoKSA9PiBzdGFydExhYmVsRWRpdCh3cmFwLCByYXdWYWx1ZSwgb25DaGFuZ2UpKTtcbiAgICAgIH1cbiAgICAgIGJyZWFrO1xuICAgIH1cbiAgICBjYXNlIFwibGFiZWxcIjoge1xuICAgICAgY29uc3QgY2hpcCA9IHRkLmNyZWF0ZVNwYW4oeyB0ZXh0OiByYXdWYWx1ZS50cmltKCkgfHwgXCJcdTIwMTRcIiwgY2xzOiBcInppYmFzZS1sYWJlbFwiIH0pO1xuICAgICAgY2hpcC5zZXRDc3NQcm9wcyh7IFwiLS1sY1wiOiBnZXRMYWJlbENvbG9yKHJhd1ZhbHVlLnRyaW0oKSkgfSk7XG4gICAgICBjaGlwLmFkZEV2ZW50TGlzdGVuZXIoXCJjbGlja1wiLCAoKSA9PiBzdGFydExhYmVsRWRpdChjaGlwLCByYXdWYWx1ZS50cmltKCksIG9uQ2hhbmdlKSk7XG4gICAgICBicmVhaztcbiAgICB9XG4gICAgY2FzZSBcIm51bWJlclwiOiB7XG4gICAgICBjb25zdCBpbnB1dCA9IHRkLmNyZWF0ZUVsKFwiaW5wdXRcIiwgeyB0eXBlOiBcIm51bWJlclwiLCBjbHM6IFwiemliYXNlLW51bWJlclwiIH0pO1xuICAgICAgaW5wdXQudmFsdWUgPSByYXdWYWx1ZS50cmltKCk7XG4gICAgICBsZXQgZGVib3VuY2UgPSAwO1xuICAgICAgaW5wdXQuYWRkRXZlbnRMaXN0ZW5lcihcImlucHV0XCIsICgpID0+IHtcbiAgICAgICAgd2luZG93LmNsZWFyVGltZW91dChkZWJvdW5jZSk7XG4gICAgICAgIGRlYm91bmNlID0gd2luZG93LnNldFRpbWVvdXQoKCkgPT4ge1xuICAgICAgICAgIHZvaWQgb25DaGFuZ2UoaW5wdXQudmFsdWUpO1xuICAgICAgICB9LCA0MDApO1xuICAgICAgfSk7XG4gICAgICBicmVhaztcbiAgICB9XG4gICAgY2FzZSBcImRhdGVcIjoge1xuICAgICAgY29uc3QgdmFsID0gcmF3VmFsdWUudHJpbSgpO1xuICAgICAgY29uc3QgZGlzcGxheVNwYW4gPSB0ZC5jcmVhdGVTcGFuKHsgdGV4dDogdmFsIHx8IFwiXHUyMDE0XCIsIGNsczogdmFsID8gXCJ6aWJhc2UtZGF0ZS1yZW5kZXJlZFwiIDogXCJ6aWJhc2UtdGV4dC1lbXB0eVwiIH0pO1xuICAgICAgdGQuYWRkRXZlbnRMaXN0ZW5lcihcImNsaWNrXCIsICgpID0+IHtcbiAgICAgICAgaWYgKHRkLnF1ZXJ5U2VsZWN0b3IoXCJpbnB1dFwiKSkgcmV0dXJuO1xuICAgICAgICBkaXNwbGF5U3Bhbi5zZXRDc3NTdHlsZXMoeyBkaXNwbGF5OiBcIm5vbmVcIiB9KTtcbiAgICAgICAgY29uc3QgaW5wdXQgPSB0ZC5jcmVhdGVFbChcImlucHV0XCIsIHsgdHlwZTogXCJkYXRlXCIsIGNsczogXCJ6aWJhc2UtZGF0ZVwiIH0pO1xuICAgICAgICBpbnB1dC52YWx1ZSA9IHZhbDtcbiAgICAgICAgaW5wdXQuZm9jdXMoKTtcbiAgICAgICAgY29uc3QgcGlja2VyID0gaW5wdXQgYXMgSFRNTElucHV0RWxlbWVudCAmIHsgc2hvd1BpY2tlcj86ICgpID0+IHZvaWQgfTtcbiAgICAgICAgaWYgKHR5cGVvZiBwaWNrZXIuc2hvd1BpY2tlciA9PT0gXCJmdW5jdGlvblwiKSB7XG4gICAgICAgICAgdHJ5IHsgcGlja2VyLnNob3dQaWNrZXIoKTsgfSBjYXRjaCB7IC8qIGlnbm9yZWQgKi8gfVxuICAgICAgICB9XG4gICAgICAgIGNvbnN0IGNvbW1pdCA9IGFzeW5jICgpID0+IHtcbiAgICAgICAgICBjb25zdCBuZXdWYWwgPSBpbnB1dC52YWx1ZTtcbiAgICAgICAgICBpbnB1dC5yZW1vdmUoKTtcbiAgICAgICAgICBkaXNwbGF5U3Bhbi50ZXh0Q29udGVudCA9IG5ld1ZhbCB8fCBcIlx1MjAxNFwiO1xuICAgICAgICAgIGRpc3BsYXlTcGFuLmNsYXNzTmFtZSA9IG5ld1ZhbCA/IFwiemliYXNlLWRhdGUtcmVuZGVyZWRcIiA6IFwiemliYXNlLXRleHQtZW1wdHlcIjtcbiAgICAgICAgICBkaXNwbGF5U3Bhbi5zZXRDc3NTdHlsZXMoeyBkaXNwbGF5OiBcIlwiIH0pO1xuICAgICAgICAgIGF3YWl0IG9uQ2hhbmdlKG5ld1ZhbCk7XG4gICAgICAgIH07XG4gICAgICAgIGlucHV0LmFkZEV2ZW50TGlzdGVuZXIoXCJibHVyXCIsICgpID0+IHsgdm9pZCBjb21taXQoKTsgfSk7XG4gICAgICAgIGlucHV0LmFkZEV2ZW50TGlzdGVuZXIoXCJrZXlkb3duXCIsIChlKSA9PiB7XG4gICAgICAgICAgaWYgKGUua2V5ID09PSBcIkVudGVyXCIpIHZvaWQgY29tbWl0KCk7XG4gICAgICAgICAgaWYgKGUua2V5ID09PSBcIkVzY2FwZVwiKSB7XG4gICAgICAgICAgICBpbnB1dC5yZW1vdmUoKTtcbiAgICAgICAgICAgIGRpc3BsYXlTcGFuLnNldENzc1N0eWxlcyh7IGRpc3BsYXk6IFwiXCIgfSk7XG4gICAgICAgICAgfVxuICAgICAgICB9KTtcbiAgICAgIH0pO1xuICAgICAgYnJlYWs7XG4gICAgfVxuICAgIGNhc2UgXCJmb3JtdWxhXCI6IHtcbiAgICAgIGNvbnN0IHZhbCA9IHJhd1ZhbHVlLnRyaW0oKTtcbiAgICAgIGlmIChpc0JhY2t0aWNrZWQodmFsKSkge1xuICAgICAgICB0ZC5jcmVhdGVTcGFuKHsgdGV4dDogc3RyaXBCYWNrdGlja3ModmFsKSwgY2xzOiBcInppYmFzZS1mb3JtdWxhLXNvdXJjZVwiIH0pO1xuICAgICAgICBicmVhaztcbiAgICAgIH1cbiAgICAgIGlmIChpc1NpbXBsZU1hdGgodmFsKSkge1xuICAgICAgICBjb25zdCByZXN1bHQgPSBldmFsdWF0ZVNpbXBsZU1hdGgodmFsKTtcbiAgICAgICAgY29uc3Qgc3BhbiA9IHRkLmNyZWF0ZVNwYW4oeyB0ZXh0OiBmb3JtYXRSZXN1bHQocmVzdWx0KSwgY2xzOiBcInppYmFzZS1mb3JtdWxhLXJlc3VsdFwiIH0pO1xuICAgICAgICBzcGFuLnRpdGxlID0gdmFsO1xuICAgICAgICBicmVhaztcbiAgICAgIH1cbiAgICAgIGlmIChjb2wudHlwZS5leHByZXNzaW9uKSB7XG4gICAgICAgIGNvbnN0IHJvd0RhdGE6IFJlY29yZDxzdHJpbmcsIHN0cmluZz4gPSB7fTtcbiAgICAgICAgc2NoZW1hLmNvbHVtbnMuZm9yRWFjaCgoYywgaSkgPT4ge1xuICAgICAgICAgIHJvd0RhdGFbYy5uYW1lXSA9IChyb3dDZWxsc1tpXSA/PyBcIlwiKS50cmltKCk7XG4gICAgICAgIH0pO1xuICAgICAgICBjb25zdCByZXN1bHQgPSBldmFsdWF0ZUZvcm11bGEoY29sLnR5cGUuZXhwcmVzc2lvbiwgcm93RGF0YSk7XG4gICAgICAgIGNvbnN0IGRpc3BsYXlWYWwgPSBmb3JtYXRSZXN1bHQocmVzdWx0KTtcbiAgICAgICAgY29uc3Qgc3BhbiA9IHRkLmNyZWF0ZVNwYW4oeyB0ZXh0OiBkaXNwbGF5VmFsLCBjbHM6IFwiemliYXNlLWZvcm11bGEtcmVzdWx0XCIgfSk7XG4gICAgICAgIHNwYW4udGl0bGUgPSBgXHUwMTkyICR7Y29sLnR5cGUuZXhwcmVzc2lvbn0gPSAke2Rpc3BsYXlWYWx9YDtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHRkLmNyZWF0ZVNwYW4oeyB0ZXh0OiB2YWwgfHwgXCJcdTAxOTJcIiwgY2xzOiBcInppYmFzZS1mb3JtdWxhLWVtcHR5XCIgfSk7XG4gICAgICB9XG4gICAgICBicmVhaztcbiAgICB9XG4gICAgZGVmYXVsdDoge1xuICAgICAgY29uc3QgdmFsID0gcmF3VmFsdWUudHJpbSgpO1xuICAgICAgdGQuZGF0YXNldC5yYXcgPSB2YWw7XG5cbiAgICAgIGlmIChpc1NpbXBsZU1hdGgodmFsKSkge1xuICAgICAgICBjb25zdCByZXN1bHQgPSBldmFsdWF0ZVNpbXBsZU1hdGgodmFsKTtcbiAgICAgICAgY29uc3Qgc3BhbiA9IHRkLmNyZWF0ZVNwYW4oeyB0ZXh0OiBmb3JtYXRSZXN1bHQocmVzdWx0KSwgY2xzOiBcInppYmFzZS1mb3JtdWxhLXJlc3VsdCB6aWJhc2UtdGV4dC1yZW5kZXJlZFwiIH0pO1xuICAgICAgICBzcGFuLnRpdGxlID0gdmFsO1xuICAgICAgICB0ZC5hZGRFdmVudExpc3RlbmVyKFwiY2xpY2tcIiwgKGUpID0+IHtcbiAgICAgICAgICBlLnByZXZlbnREZWZhdWx0KCk7XG4gICAgICAgICAgZS5zdG9wUHJvcGFnYXRpb24oKTtcbiAgICAgICAgICBzdGFydE1hcmtkb3duRWRpdCh0ZCwgdGQuZGF0YXNldC5yYXcgfHwgdmFsLCBjb250ZXh0LCBob3N0LCBvbkNoYW5nZSk7XG4gICAgICAgIH0pO1xuICAgICAgICBicmVhaztcbiAgICAgIH1cblxuICAgICAgaWYgKGlzQmFja3RpY2tlZCh2YWwpKSB7XG4gICAgICAgIHRkLmNyZWF0ZVNwYW4oeyB0ZXh0OiBzdHJpcEJhY2t0aWNrcyh2YWwpLCBjbHM6IFwiemliYXNlLWZvcm11bGEtc291cmNlIHppYmFzZS10ZXh0LXJlbmRlcmVkXCIgfSk7XG4gICAgICAgIHRkLmFkZEV2ZW50TGlzdGVuZXIoXCJjbGlja1wiLCAoZSkgPT4ge1xuICAgICAgICAgIGUucHJldmVudERlZmF1bHQoKTtcbiAgICAgICAgICBlLnN0b3BQcm9wYWdhdGlvbigpO1xuICAgICAgICAgIHN0YXJ0TWFya2Rvd25FZGl0KHRkLCB0ZC5kYXRhc2V0LnJhdyB8fCB2YWwsIGNvbnRleHQsIGhvc3QsIG9uQ2hhbmdlKTtcbiAgICAgICAgfSk7XG4gICAgICAgIGJyZWFrO1xuICAgICAgfVxuXG4gICAgICBjb25zdCBkaXNwbGF5U3BhbiA9IHRkLmNyZWF0ZVNwYW4oeyBjbHM6IFwiemliYXNlLXRleHQtcmVuZGVyZWRcIiB9KTtcbiAgICAgIGlmICh2YWwpIHtcbiAgICAgICAgY29uc3QgY29tcCA9IG5ldyBNYXJrZG93blJlbmRlckNoaWxkKGRpc3BsYXlTcGFuKTtcbiAgICAgICAgY29udGV4dC5hZGRDaGlsZChjb21wKTtcbiAgICAgICAgdm9pZCBNYXJrZG93blJlbmRlcmVyLnJlbmRlcihob3N0LmFwcCwgdmFsLCBkaXNwbGF5U3BhbiwgY29udGV4dC5zb3VyY2VQYXRoLCBjb21wKS50aGVuKCgpID0+IHtcbiAgICAgICAgICBkaXNwbGF5U3Bhbi5xdWVyeVNlbGVjdG9yQWxsKFwiYVwiKS5mb3JFYWNoKChhKSA9PiBhdHRhY2hMaW5rVG9vbHRpcChhKSk7XG4gICAgICAgICAgdGQuYWRkRXZlbnRMaXN0ZW5lcihcImNsaWNrXCIsIChlKSA9PiB7XG4gICAgICAgICAgICBpZiAoZS5hbHRLZXkpIHtcbiAgICAgICAgICAgICAgZS5wcmV2ZW50RGVmYXVsdCgpO1xuICAgICAgICAgICAgICBlLnN0b3BQcm9wYWdhdGlvbigpO1xuICAgICAgICAgICAgICBzdGFydE1hcmtkb3duRWRpdCh0ZCwgdGQuZGF0YXNldC5yYXcgfHwgdmFsLCBjb250ZXh0LCBob3N0LCBvbkNoYW5nZSk7XG4gICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGNvbnN0IHRhcmdldCA9IGUudGFyZ2V0IGFzIEhUTUxFbGVtZW50IHwgbnVsbDtcbiAgICAgICAgICAgIGlmICh0YXJnZXQ/LmNsb3Nlc3Q/LihcImFcIikpIHJldHVybjtcbiAgICAgICAgICAgIGUucHJldmVudERlZmF1bHQoKTtcbiAgICAgICAgICAgIGUuc3RvcFByb3BhZ2F0aW9uKCk7XG4gICAgICAgICAgICBzdGFydE1hcmtkb3duRWRpdCh0ZCwgdGQuZGF0YXNldC5yYXcgfHwgdmFsLCBjb250ZXh0LCBob3N0LCBvbkNoYW5nZSk7XG4gICAgICAgICAgfSwgdHJ1ZSk7XG4gICAgICAgIH0pO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgZGlzcGxheVNwYW4udGV4dENvbnRlbnQgPSBcIlx1MjAxNFwiO1xuICAgICAgICBkaXNwbGF5U3Bhbi5jbGFzc0xpc3QuYWRkKFwiemliYXNlLXRleHQtZW1wdHlcIik7XG4gICAgICAgIHRkLmFkZEV2ZW50TGlzdGVuZXIoXCJjbGlja1wiLCAoZSkgPT4ge1xuICAgICAgICAgIGUucHJldmVudERlZmF1bHQoKTtcbiAgICAgICAgICBlLnN0b3BQcm9wYWdhdGlvbigpO1xuICAgICAgICAgIHN0YXJ0TWFya2Rvd25FZGl0KHRkLCB0ZC5kYXRhc2V0LnJhdyA/PyB2YWwsIGNvbnRleHQsIGhvc3QsIG9uQ2hhbmdlKTtcbiAgICAgICAgfSk7XG4gICAgICB9XG4gICAgICBicmVhaztcbiAgICB9XG4gIH1cbn1cbiIsICJjb25zdCBGT1JNVUxBX05VTUJFUl9SRSA9IC9eLT9cXGQrKFxcLlxcZCspPyQvO1xuXG5leHBvcnQgZnVuY3Rpb24gaXNCYWNrdGlja2VkKHJhdzogc3RyaW5nKTogYm9vbGVhbiB7XG4gIGNvbnN0IHRyaW1tZWQgPSByYXcudHJpbSgpO1xuICByZXR1cm4gdHJpbW1lZC5zdGFydHNXaXRoKFwiYFwiKSAmJiB0cmltbWVkLmVuZHNXaXRoKFwiYFwiKSAmJiB0cmltbWVkLmxlbmd0aCA+PSAyO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gc3RyaXBCYWNrdGlja3MocmF3OiBzdHJpbmcpOiBzdHJpbmcge1xuICBjb25zdCB0cmltbWVkID0gcmF3LnRyaW0oKTtcbiAgcmV0dXJuIHRyaW1tZWQuc2xpY2UoMSwgLTEpO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gaXNTaW1wbGVNYXRoKHJhdzogc3RyaW5nKTogYm9vbGVhbiB7XG4gIGNvbnN0IHRyaW1tZWQgPSByYXcudHJpbSgpO1xuICBpZiAoIXRyaW1tZWQpIHJldHVybiBmYWxzZTtcbiAgaWYgKEZPUk1VTEFfTlVNQkVSX1JFLnRlc3QodHJpbW1lZCkpIHJldHVybiBmYWxzZTtcbiAgaWYgKCEvXltcXGRcXHMrXFwtKi8lKCkuXSskLy50ZXN0KHRyaW1tZWQpKSByZXR1cm4gZmFsc2U7XG4gIGlmICghL1srXFwtKi8lXS8udGVzdCh0cmltbWVkKSkgcmV0dXJuIGZhbHNlO1xuICBpZiAoL15bKyovJV0vLnRlc3QodHJpbW1lZCkpIHJldHVybiBmYWxzZTtcbiAgcmV0dXJuIHRydWU7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBldmFsdWF0ZUZvcm11bGEoZXhwcmVzc2lvbjogc3RyaW5nLCByb3dEYXRhOiBSZWNvcmQ8c3RyaW5nLCBzdHJpbmc+KTogbnVtYmVyIHwgbnVsbCB7XG4gIGlmICghZXhwcmVzc2lvbiB8fCAhZXhwcmVzc2lvbi50cmltKCkpIHJldHVybiBudWxsO1xuXG4gIGxldCByZXNvbHZlZCA9IGV4cHJlc3Npb247XG4gIGNvbnN0IGNvbE5hbWVzID0gT2JqZWN0LmtleXMocm93RGF0YSkuc29ydCgoYSwgYikgPT4gYi5sZW5ndGggLSBhLmxlbmd0aCk7XG5cbiAgZm9yIChjb25zdCBjb2xOYW1lIG9mIGNvbE5hbWVzKSB7XG4gICAgY29uc3QgcmVnZXggPSBuZXcgUmVnRXhwKFwiXFxcXGJcIiArIGVzY2FwZVJlZ2V4KGNvbE5hbWUpICsgXCJcXFxcYlwiLCBcImdpXCIpO1xuICAgIGlmICghcmVnZXgudGVzdChyZXNvbHZlZCkpIGNvbnRpbnVlO1xuICAgIHJlZ2V4Lmxhc3RJbmRleCA9IDA7XG5cbiAgICBjb25zdCByYXdWYWwgPSByb3dEYXRhW2NvbE5hbWVdO1xuICAgIGNvbnN0IG51bVZhbCA9IHBhcnNlRmxvYXQocmF3VmFsKTtcbiAgICBpZiAoTnVtYmVyLmlzTmFOKG51bVZhbCkpIHJldHVybiBudWxsO1xuXG4gICAgcmVzb2x2ZWQgPSByZXNvbHZlZC5yZXBsYWNlKHJlZ2V4LCBudW1WYWwudG9TdHJpbmcoKSk7XG4gIH1cblxuICB0cnkge1xuICAgIHJldHVybiBzYWZlRXZhbChyZXNvbHZlZCk7XG4gIH0gY2F0Y2gge1xuICAgIHJldHVybiBudWxsO1xuICB9XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBldmFsdWF0ZVNpbXBsZU1hdGgoZXhwcmVzc2lvbjogc3RyaW5nKTogbnVtYmVyIHwgbnVsbCB7XG4gIHRyeSB7XG4gICAgcmV0dXJuIHNhZmVFdmFsKGV4cHJlc3Npb24pO1xuICB9IGNhdGNoIHtcbiAgICByZXR1cm4gbnVsbDtcbiAgfVxufVxuXG5leHBvcnQgZnVuY3Rpb24gZm9ybWF0UmVzdWx0KHZhbHVlOiBudW1iZXIgfCBudWxsIHwgdW5kZWZpbmVkKTogc3RyaW5nIHtcbiAgaWYgKHZhbHVlID09PSBudWxsIHx8IHZhbHVlID09PSB1bmRlZmluZWQgfHwgTnVtYmVyLmlzTmFOKHZhbHVlKSkgcmV0dXJuIFwiXHUyMDE0XCI7XG4gIGlmICghTnVtYmVyLmlzRmluaXRlKHZhbHVlKSkgcmV0dXJuIFwiXHUyMjFFXCI7XG4gIHJldHVybiBwYXJzZUZsb2F0KHZhbHVlLnRvRml4ZWQoNikpLnRvU3RyaW5nKCk7XG59XG5cbmludGVyZmFjZSBUb2tlbiB7XG4gIHR5cGU6IFwibnVtYmVyXCIgfCBcIm9wXCIgfCBcImxwYXJlblwiIHwgXCJycGFyZW5cIjtcbiAgdmFsdWU6IG51bWJlciB8IHN0cmluZztcbn1cblxuaW50ZXJmYWNlIFBhcnNlciB7XG4gIHRva2VuczogVG9rZW5bXTtcbiAgcG9zOiBudW1iZXI7XG59XG5cbmZ1bmN0aW9uIHNhZmVFdmFsKGV4cHJlc3Npb246IHN0cmluZyk6IG51bWJlciB7XG4gIGNvbnN0IHRva2VucyA9IHRva2VuaXplKGV4cHJlc3Npb24pO1xuICBjb25zdCBwYXJzZXI6IFBhcnNlciA9IHsgdG9rZW5zLCBwb3M6IDAgfTtcbiAgY29uc3QgcmVzdWx0ID0gcGFyc2VFeHByKHBhcnNlcik7XG4gIGlmIChwYXJzZXIucG9zIDwgcGFyc2VyLnRva2Vucy5sZW5ndGgpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoXCJVbmV4cGVjdGVkIHRva2VuOiBcIiArIFN0cmluZyhwYXJzZXIudG9rZW5zW3BhcnNlci5wb3NdLnZhbHVlKSk7XG4gIH1cbiAgcmV0dXJuIHJlc3VsdDtcbn1cblxuZnVuY3Rpb24gdG9rZW5pemUoZXhwcjogc3RyaW5nKTogVG9rZW5bXSB7XG4gIGNvbnN0IHRva2VuczogVG9rZW5bXSA9IFtdO1xuICBsZXQgaSA9IDA7XG4gIGNvbnN0IHMgPSBleHByLnRyaW0oKTtcblxuICB3aGlsZSAoaSA8IHMubGVuZ3RoKSB7XG4gICAgaWYgKHNbaV0gPT09IFwiIFwiIHx8IHNbaV0gPT09IFwiXFx0XCIpIHtcbiAgICAgIGkrKztcbiAgICAgIGNvbnRpbnVlO1xuICAgIH1cblxuICAgIGlmICgoc1tpXSA+PSBcIjBcIiAmJiBzW2ldIDw9IFwiOVwiKSB8fCAoc1tpXSA9PT0gXCIuXCIgJiYgaSArIDEgPCBzLmxlbmd0aCAmJiBzW2kgKyAxXSA+PSBcIjBcIiAmJiBzW2kgKyAxXSA8PSBcIjlcIikpIHtcbiAgICAgIGxldCBudW0gPSBcIlwiO1xuICAgICAgd2hpbGUgKGkgPCBzLmxlbmd0aCAmJiAoKHNbaV0gPj0gXCIwXCIgJiYgc1tpXSA8PSBcIjlcIikgfHwgc1tpXSA9PT0gXCIuXCIpKSB7XG4gICAgICAgIG51bSArPSBzW2ldO1xuICAgICAgICBpKys7XG4gICAgICB9XG4gICAgICB0b2tlbnMucHVzaCh7IHR5cGU6IFwibnVtYmVyXCIsIHZhbHVlOiBwYXJzZUZsb2F0KG51bSkgfSk7XG4gICAgICBjb250aW51ZTtcbiAgICB9XG5cbiAgICBpZiAoXCIrLSovJVwiLmluY2x1ZGVzKHNbaV0pKSB7XG4gICAgICB0b2tlbnMucHVzaCh7IHR5cGU6IFwib3BcIiwgdmFsdWU6IHNbaV0gfSk7XG4gICAgICBpKys7XG4gICAgICBjb250aW51ZTtcbiAgICB9XG5cbiAgICBpZiAoc1tpXSA9PT0gXCIoXCIpIHtcbiAgICAgIHRva2Vucy5wdXNoKHsgdHlwZTogXCJscGFyZW5cIiwgdmFsdWU6IFwiKFwiIH0pO1xuICAgICAgaSsrO1xuICAgICAgY29udGludWU7XG4gICAgfVxuICAgIGlmIChzW2ldID09PSBcIilcIikge1xuICAgICAgdG9rZW5zLnB1c2goeyB0eXBlOiBcInJwYXJlblwiLCB2YWx1ZTogXCIpXCIgfSk7XG4gICAgICBpKys7XG4gICAgICBjb250aW51ZTtcbiAgICB9XG5cbiAgICB0aHJvdyBuZXcgRXJyb3IoXCJVbmV4cGVjdGVkIGNoYXJhY3RlcjogXCIgKyBzW2ldKTtcbiAgfVxuXG4gIHJldHVybiB0b2tlbnM7XG59XG5cbmZ1bmN0aW9uIHBhcnNlRXhwcihwYXJzZXI6IFBhcnNlcik6IG51bWJlciB7XG4gIGxldCBsZWZ0ID0gcGFyc2VUZXJtKHBhcnNlcik7XG5cbiAgd2hpbGUgKHBhcnNlci5wb3MgPCBwYXJzZXIudG9rZW5zLmxlbmd0aCkge1xuICAgIGNvbnN0IHRvayA9IHBhcnNlci50b2tlbnNbcGFyc2VyLnBvc107XG4gICAgaWYgKHRvay50eXBlID09PSBcIm9wXCIgJiYgKHRvay52YWx1ZSA9PT0gXCIrXCIgfHwgdG9rLnZhbHVlID09PSBcIi1cIikpIHtcbiAgICAgIHBhcnNlci5wb3MrKztcbiAgICAgIGNvbnN0IHJpZ2h0ID0gcGFyc2VUZXJtKHBhcnNlcik7XG4gICAgICBsZWZ0ID0gdG9rLnZhbHVlID09PSBcIitcIiA/IGxlZnQgKyByaWdodCA6IGxlZnQgLSByaWdodDtcbiAgICB9IGVsc2Uge1xuICAgICAgYnJlYWs7XG4gICAgfVxuICB9XG5cbiAgcmV0dXJuIGxlZnQ7XG59XG5cbmZ1bmN0aW9uIHBhcnNlVGVybShwYXJzZXI6IFBhcnNlcik6IG51bWJlciB7XG4gIGxldCBsZWZ0ID0gcGFyc2VVbmFyeShwYXJzZXIpO1xuXG4gIHdoaWxlIChwYXJzZXIucG9zIDwgcGFyc2VyLnRva2Vucy5sZW5ndGgpIHtcbiAgICBjb25zdCB0b2sgPSBwYXJzZXIudG9rZW5zW3BhcnNlci5wb3NdO1xuICAgIGlmICh0b2sudHlwZSA9PT0gXCJvcFwiICYmICh0b2sudmFsdWUgPT09IFwiKlwiIHx8IHRvay52YWx1ZSA9PT0gXCIvXCIgfHwgdG9rLnZhbHVlID09PSBcIiVcIikpIHtcbiAgICAgIHBhcnNlci5wb3MrKztcbiAgICAgIGNvbnN0IHJpZ2h0ID0gcGFyc2VVbmFyeShwYXJzZXIpO1xuICAgICAgaWYgKHRvay52YWx1ZSA9PT0gXCIqXCIpIGxlZnQgPSBsZWZ0ICogcmlnaHQ7XG4gICAgICBlbHNlIGlmICh0b2sudmFsdWUgPT09IFwiL1wiKSBsZWZ0ID0gcmlnaHQgPT09IDAgPyBJbmZpbml0eSA6IGxlZnQgLyByaWdodDtcbiAgICAgIGVsc2UgbGVmdCA9IGxlZnQgJSByaWdodDtcbiAgICB9IGVsc2Uge1xuICAgICAgYnJlYWs7XG4gICAgfVxuICB9XG5cbiAgcmV0dXJuIGxlZnQ7XG59XG5cbmZ1bmN0aW9uIHBhcnNlVW5hcnkocGFyc2VyOiBQYXJzZXIpOiBudW1iZXIge1xuICBpZiAocGFyc2VyLnBvcyA8IHBhcnNlci50b2tlbnMubGVuZ3RoKSB7XG4gICAgY29uc3QgdG9rID0gcGFyc2VyLnRva2Vuc1twYXJzZXIucG9zXTtcbiAgICBpZiAodG9rLnR5cGUgPT09IFwib3BcIiAmJiB0b2sudmFsdWUgPT09IFwiLVwiKSB7XG4gICAgICBwYXJzZXIucG9zKys7XG4gICAgICByZXR1cm4gLXBhcnNlVW5hcnkocGFyc2VyKTtcbiAgICB9XG4gICAgaWYgKHRvay50eXBlID09PSBcIm9wXCIgJiYgdG9rLnZhbHVlID09PSBcIitcIikge1xuICAgICAgcGFyc2VyLnBvcysrO1xuICAgICAgcmV0dXJuIHBhcnNlVW5hcnkocGFyc2VyKTtcbiAgICB9XG4gIH1cbiAgcmV0dXJuIHBhcnNlUHJpbWFyeShwYXJzZXIpO1xufVxuXG5mdW5jdGlvbiBwYXJzZVByaW1hcnkocGFyc2VyOiBQYXJzZXIpOiBudW1iZXIge1xuICBpZiAocGFyc2VyLnBvcyA+PSBwYXJzZXIudG9rZW5zLmxlbmd0aCkge1xuICAgIHRocm93IG5ldyBFcnJvcihcIlVuZXhwZWN0ZWQgZW5kIG9mIGV4cHJlc3Npb25cIik7XG4gIH1cblxuICBjb25zdCB0b2sgPSBwYXJzZXIudG9rZW5zW3BhcnNlci5wb3NdO1xuXG4gIGlmICh0b2sudHlwZSA9PT0gXCJudW1iZXJcIikge1xuICAgIHBhcnNlci5wb3MrKztcbiAgICByZXR1cm4gdG9rLnZhbHVlIGFzIG51bWJlcjtcbiAgfVxuXG4gIGlmICh0b2sudHlwZSA9PT0gXCJscGFyZW5cIikge1xuICAgIHBhcnNlci5wb3MrKztcbiAgICBjb25zdCByZXN1bHQgPSBwYXJzZUV4cHIocGFyc2VyKTtcbiAgICBpZiAocGFyc2VyLnBvcyA+PSBwYXJzZXIudG9rZW5zLmxlbmd0aCB8fCBwYXJzZXIudG9rZW5zW3BhcnNlci5wb3NdLnR5cGUgIT09IFwicnBhcmVuXCIpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihcIk1pc3NpbmcgY2xvc2luZyBwYXJlbnRoZXNpc1wiKTtcbiAgICB9XG4gICAgcGFyc2VyLnBvcysrO1xuICAgIHJldHVybiByZXN1bHQ7XG4gIH1cblxuICB0aHJvdyBuZXcgRXJyb3IoXCJVbmV4cGVjdGVkIHRva2VuOiBcIiArIFN0cmluZyh0b2sudmFsdWUpKTtcbn1cblxuZnVuY3Rpb24gZXNjYXBlUmVnZXgoc3RyOiBzdHJpbmcpOiBzdHJpbmcge1xuICByZXR1cm4gc3RyLnJlcGxhY2UoL1suKis/XiR7fSgpfFtcXF1cXFxcXS9nLCBcIlxcXFwkJlwiKTtcbn1cbiIsICJleHBvcnQgY29uc3QgTEFCRUxfQ09MT1JTID0gW1xuICBcIiM0YWRlODBcIixcbiAgXCIjNjBhNWZhXCIsXG4gIFwiI2Y0NzJiNlwiLFxuICBcIiNmYjkyM2NcIixcbiAgXCIjYTc4YmZhXCIsXG4gIFwiIzM0ZDM5OVwiLFxuICBcIiNmYmJmMjRcIixcbiAgXCIjZjg3MTcxXCIsXG4gIFwiIzM4YmRmOFwiLFxuICBcIiNjMDg0ZmNcIixcbiAgXCIjODZlZmFjXCIsXG4gIFwiIzY3ZThmOVwiLFxuICBcIiNmZGJhNzRcIixcbiAgXCIjYTNlNjM1XCIsXG4gIFwiI2U4NzlmOVwiLFxuICBcIiMyMmQzZWVcIixcbiAgXCIjZmY2YjZiXCIsXG4gIFwiI2ZmZDkzZFwiLFxuICBcIiM2YmNiNzdcIixcbiAgXCIjNGQ5NmZmXCIsXG5dO1xuXG5leHBvcnQgZnVuY3Rpb24gaGFzaFN0cihzdHI6IHN0cmluZyk6IG51bWJlciB7XG4gIGxldCBoID0gNTM4MTtcbiAgZm9yIChsZXQgaSA9IDA7IGkgPCBzdHIubGVuZ3RoOyBpKyspIHtcbiAgICBoID0gKGggPDwgNSkgKyBoIF4gc3RyLmNoYXJDb2RlQXQoaSk7XG4gICAgaCA9IGggPj4+IDA7XG4gIH1cbiAgcmV0dXJuIGg7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBnZXRMYWJlbENvbG9yKHZhbHVlOiBzdHJpbmcpOiBzdHJpbmcge1xuICByZXR1cm4gTEFCRUxfQ09MT1JTW2hhc2hTdHIodmFsdWUudHJpbSgpLnRvTG93ZXJDYXNlKCkpICUgTEFCRUxfQ09MT1JTLmxlbmd0aF07XG59XG4iLCAiaW1wb3J0IHR5cGUgeyBDb2x1bW5UeXBlIH0gZnJvbSBcIi4vbW9kZWxcIjtcbmltcG9ydCB7IGdldExhYmVsQ29sb3IgfSBmcm9tIFwiLi9jb2xvcnNcIjtcblxuZXhwb3J0IHsgZ2V0TGFiZWxDb2xvciB9O1xuXG5leHBvcnQgZnVuY3Rpb24gZ2V0VHlwZUljb24odHlwZTogQ29sdW1uVHlwZSk6IHN0cmluZyB7XG4gIHN3aXRjaCAodHlwZS5raW5kKSB7XG4gICAgY2FzZSBcInRvZ2dsZVwiOlxuICAgICAgcmV0dXJuIFwiXHUyQjFDXCI7XG4gICAgY2FzZSBcInNlbGVjdFwiOlxuICAgICAgcmV0dXJuIFwiXHUyNUJFXCI7XG4gICAgY2FzZSBcIm11bHRpLXNlbGVjdFwiOlxuICAgICAgcmV0dXJuIFwiXHVEODNDXHVERkY3XHVGRTBGXCI7XG4gICAgY2FzZSBcImxhYmVsXCI6XG4gICAgICByZXR1cm4gXCJcdTJCMjFcIjtcbiAgICBjYXNlIFwibnVtYmVyXCI6XG4gICAgICByZXR1cm4gXCIjXCI7XG4gICAgY2FzZSBcImRhdGVcIjpcbiAgICAgIHJldHVybiBcIlx1RDgzRFx1RENDNVwiO1xuICAgIGNhc2UgXCJmb3JtdWxhXCI6XG4gICAgICByZXR1cm4gXCJcdTAxOTJcIjtcbiAgICBkZWZhdWx0OlxuICAgICAgcmV0dXJuIFwiVFwiO1xuICB9XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBzaG93VG9hc3QobWVzc2FnZTogc3RyaW5nKTogdm9pZCB7XG4gIGNvbnN0IHRvYXN0ID0gY3JlYXRlRGl2KCk7XG4gIHRvYXN0LmNsYXNzTmFtZSA9IFwiemliYXNlLXRvYXN0XCI7XG4gIHRvYXN0LnRleHRDb250ZW50ID0gbWVzc2FnZTtcbiAgZG9jdW1lbnQuYm9keS5hcHBlbmRDaGlsZCh0b2FzdCk7XG4gIHdpbmRvdy5zZXRUaW1lb3V0KCgpID0+IHRvYXN0LmNsYXNzTGlzdC5hZGQoXCJ6aWJhc2UtdG9hc3Qtc2hvd1wiKSwgMTApO1xuICB3aW5kb3cuc2V0VGltZW91dCgoKSA9PiB7XG4gICAgdG9hc3QuY2xhc3NMaXN0LnJlbW92ZShcInppYmFzZS10b2FzdC1zaG93XCIpO1xuICAgIHdpbmRvdy5zZXRUaW1lb3V0KCgpID0+IHRvYXN0LnJlbW92ZSgpLCAzMDApO1xuICB9LCAyNTAwKTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGF0dGFjaExpbmtUb29sdGlwKGE6IEhUTUxBbmNob3JFbGVtZW50KTogdm9pZCB7XG4gIGxldCB0b29sdGlwOiBIVE1MRWxlbWVudCB8IG51bGwgPSBudWxsO1xuICBhLmFkZEV2ZW50TGlzdGVuZXIoXCJtb3VzZWVudGVyXCIsICgpID0+IHtcbiAgICB0b29sdGlwID0gY3JlYXRlRGl2KCk7XG4gICAgdG9vbHRpcC5jbGFzc05hbWUgPSBcInppYmFzZS1saW5rLXRvb2x0aXBcIjtcbiAgICB0b29sdGlwLnRleHRDb250ZW50ID0gXCJBbHQrQ2xpY2sgdG8gZWRpdFwiO1xuICAgIGRvY3VtZW50LmJvZHkuYXBwZW5kQ2hpbGQodG9vbHRpcCk7XG4gICAgY29uc3QgcmVjdCA9IGEuZ2V0Qm91bmRpbmdDbGllbnRSZWN0KCk7XG4gICAgdG9vbHRpcC5zZXRDc3NTdHlsZXMoeyB0b3A6IGAke3JlY3QuYm90dG9tICsgd2luZG93LnNjcm9sbFkgKyA0fXB4YCB9KTtcbiAgICB0b29sdGlwLnNldENzc1N0eWxlcyh7IGxlZnQ6IGAke3JlY3QubGVmdCArIHdpbmRvdy5zY3JvbGxYfXB4YCB9KTtcbiAgfSk7XG4gIGEuYWRkRXZlbnRMaXN0ZW5lcihcIm1vdXNlbGVhdmVcIiwgKCkgPT4ge1xuICAgIHRvb2x0aXA/LnJlbW92ZSgpO1xuICAgIHRvb2x0aXAgPSBudWxsO1xuICB9KTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIHN0YXJ0TGFiZWxFZGl0KFxuICBjaGlwOiBIVE1MRWxlbWVudCxcbiAgY3VycmVudDogc3RyaW5nLFxuICBvbkNoYW5nZTogKHZhbHVlOiBzdHJpbmcpID0+IFByb21pc2U8dm9pZD4gfCB2b2lkLFxuKTogdm9pZCB7XG4gIGNvbnN0IGlucHV0ID0gY3JlYXRlRWwoXCJpbnB1dFwiKTtcbiAgaW5wdXQuY2xhc3NOYW1lID0gXCJ6aWJhc2UtaW5saW5lLWlucHV0XCI7XG4gIGlucHV0LnZhbHVlID0gY3VycmVudDtcbiAgY2hpcC5yZXBsYWNlV2l0aChpbnB1dCk7XG4gIGlucHV0LmZvY3VzKCk7XG4gIGlucHV0LnNlbGVjdCgpO1xuICBjb25zdCBjb21taXQgPSBhc3luYyAoKSA9PiB7XG4gICAgY29uc3QgbmV3VmFsID0gaW5wdXQudmFsdWUudHJpbSgpIHx8IGN1cnJlbnQ7XG4gICAgYXdhaXQgb25DaGFuZ2UobmV3VmFsKTtcbiAgICBjaGlwLnRleHRDb250ZW50ID0gbmV3VmFsO1xuICAgIGNoaXAuc2V0Q3NzUHJvcHMoeyBcIi0tbGNcIjogZ2V0TGFiZWxDb2xvcihuZXdWYWwpIH0pO1xuICAgIGlucHV0LnJlcGxhY2VXaXRoKGNoaXApO1xuICB9O1xuICBpbnB1dC5hZGRFdmVudExpc3RlbmVyKFwiYmx1clwiLCAoKSA9PiB7IHZvaWQgY29tbWl0KCk7IH0pO1xuICBpbnB1dC5hZGRFdmVudExpc3RlbmVyKFwia2V5ZG93blwiLCAoZSkgPT4ge1xuICAgIGlmIChlLmtleSA9PT0gXCJFbnRlclwiKSB2b2lkIGNvbW1pdCgpO1xuICAgIGlmIChlLmtleSA9PT0gXCJFc2NhcGVcIikgaW5wdXQucmVwbGFjZVdpdGgoY2hpcCk7XG4gIH0pO1xufVxuIiwgImltcG9ydCB7IE1vZGFsLCB0eXBlIEFwcCB9IGZyb20gXCJvYnNpZGlhblwiO1xuaW1wb3J0IHR5cGUgeyBDb2x1bW4gfSBmcm9tIFwiLi9tb2RlbFwiO1xuXG5leHBvcnQgY2xhc3MgU2VsZWN0T3B0aW9uc01vZGFsIGV4dGVuZHMgTW9kYWwge1xuICBjb2xOYW1lOiBzdHJpbmc7XG4gIGN1cnJlbnRPcHRpb25zOiBzdHJpbmdbXTtcbiAgb25TdWJtaXQ6IChvcHRpb25zOiBzdHJpbmdbXSkgPT4gdm9pZDtcblxuICBjb25zdHJ1Y3RvcihhcHA6IEFwcCwgY29sTmFtZTogc3RyaW5nLCBjdXJyZW50T3B0aW9uczogc3RyaW5nW10sIG9uU3VibWl0OiAob3B0aW9uczogc3RyaW5nW10pID0+IHZvaWQpIHtcbiAgICBzdXBlcihhcHApO1xuICAgIHRoaXMuY29sTmFtZSA9IGNvbE5hbWU7XG4gICAgdGhpcy5jdXJyZW50T3B0aW9ucyA9IFsuLi5jdXJyZW50T3B0aW9uc107XG4gICAgdGhpcy5vblN1Ym1pdCA9IG9uU3VibWl0O1xuICB9XG5cbiAgb25PcGVuKCk6IHZvaWQge1xuICAgIGNvbnN0IHsgY29udGVudEVsIH0gPSB0aGlzO1xuICAgIGNvbnRlbnRFbC5lbXB0eSgpO1xuICAgIGNvbnRlbnRFbC5hZGRDbGFzcyhcInppYmFzZS1tb2RhbFwiKTtcbiAgICBjb250ZW50RWwuY3JlYXRlRWwoXCJoM1wiLCB7IHRleHQ6IGBPcHRpb25zIGZvciBcIiR7dGhpcy5jb2xOYW1lfVwiYCwgY2xzOiBcInppYmFzZS1tb2RhbC10aXRsZVwiIH0pO1xuICAgIGNvbnN0IGNoaXBzV3JhcCA9IGNvbnRlbnRFbC5jcmVhdGVEaXYoXCJ6aWJhc2UtbW9kYWwtY2hpcHNcIik7XG4gICAgY29uc3QgcmVuZGVyQ2hpcHMgPSAoKSA9PiB7XG4gICAgICBjaGlwc1dyYXAuZW1wdHkoKTtcbiAgICAgIHRoaXMuY3VycmVudE9wdGlvbnMuZm9yRWFjaCgob3B0LCBpKSA9PiB7XG4gICAgICAgIGNvbnN0IGNoaXAgPSBjaGlwc1dyYXAuY3JlYXRlRGl2KFwiemliYXNlLW1vZGFsLWNoaXBcIik7XG4gICAgICAgIGNoaXAuY3JlYXRlU3Bhbih7IHRleHQ6IG9wdCB9KTtcbiAgICAgICAgY29uc3QgeCA9IGNoaXAuY3JlYXRlU3Bhbih7IHRleHQ6IFwiXHUwMEQ3XCIsIGNsczogXCJ6aWJhc2UtY2hpcC1yZW1vdmVcIiB9KTtcbiAgICAgICAgeC5hZGRFdmVudExpc3RlbmVyKFwiY2xpY2tcIiwgKCkgPT4ge1xuICAgICAgICAgIHRoaXMuY3VycmVudE9wdGlvbnMuc3BsaWNlKGksIDEpO1xuICAgICAgICAgIHJlbmRlckNoaXBzKCk7XG4gICAgICAgIH0pO1xuICAgICAgfSk7XG4gICAgfTtcbiAgICByZW5kZXJDaGlwcygpO1xuICAgIGNvbnN0IGlucHV0Um93ID0gY29udGVudEVsLmNyZWF0ZURpdihcInppYmFzZS1tb2RhbC1pbnB1dC1yb3dcIik7XG4gICAgY29uc3QgaW5wdXQgPSBpbnB1dFJvdy5jcmVhdGVFbChcImlucHV0XCIsIHsgdHlwZTogXCJ0ZXh0XCIsIGNsczogXCJ6aWJhc2UtbW9kYWwtaW5wdXRcIiB9KTtcbiAgICBpbnB1dC5wbGFjZWhvbGRlciA9IFwiQWRkIG9wdGlvblx1MjAyNlwiO1xuICAgIGNvbnN0IGFkZEJ0biA9IGlucHV0Um93LmNyZWF0ZUVsKFwiYnV0dG9uXCIsIHsgdGV4dDogXCJBZGRcIiwgY2xzOiBcInppYmFzZS1tb2RhbC1hZGQtYnRuXCIgfSk7XG4gICAgY29uc3QgYWRkT3B0aW9uID0gKCkgPT4ge1xuICAgICAgY29uc3QgdmFsID0gaW5wdXQudmFsdWUudHJpbSgpO1xuICAgICAgaWYgKHZhbCAmJiAhdGhpcy5jdXJyZW50T3B0aW9ucy5pbmNsdWRlcyh2YWwpKSB7XG4gICAgICAgIHRoaXMuY3VycmVudE9wdGlvbnMucHVzaCh2YWwpO1xuICAgICAgICByZW5kZXJDaGlwcygpO1xuICAgICAgICBpbnB1dC52YWx1ZSA9IFwiXCI7XG4gICAgICAgIGlucHV0LmZvY3VzKCk7XG4gICAgICB9XG4gICAgfTtcbiAgICBhZGRCdG4uYWRkRXZlbnRMaXN0ZW5lcihcImNsaWNrXCIsIGFkZE9wdGlvbik7XG4gICAgaW5wdXQuYWRkRXZlbnRMaXN0ZW5lcihcImtleWRvd25cIiwgKGUpID0+IHtcbiAgICAgIGlmIChlLmtleSA9PT0gXCJFbnRlclwiKSB7XG4gICAgICAgIGUucHJldmVudERlZmF1bHQoKTtcbiAgICAgICAgYWRkT3B0aW9uKCk7XG4gICAgICB9XG4gICAgICBpZiAoZS5rZXkgPT09IFwiRXNjYXBlXCIpIHRoaXMuY2xvc2UoKTtcbiAgICB9KTtcbiAgICBjb25zdCBhcHBseUJ0biA9IGNvbnRlbnRFbC5jcmVhdGVFbChcImJ1dHRvblwiLCB7IHRleHQ6IFwiQXBwbHlcIiwgY2xzOiBcInppYmFzZS1tb2RhbC1hcHBseS1idG5cIiB9KTtcbiAgICBhcHBseUJ0bi5hZGRFdmVudExpc3RlbmVyKFwiY2xpY2tcIiwgKCkgPT4ge1xuICAgICAgaWYgKHRoaXMuY3VycmVudE9wdGlvbnMubGVuZ3RoID4gMCkge1xuICAgICAgICB0aGlzLm9uU3VibWl0KHRoaXMuY3VycmVudE9wdGlvbnMpO1xuICAgICAgICB0aGlzLmNsb3NlKCk7XG4gICAgICB9XG4gICAgfSk7XG4gICAgd2luZG93LnNldFRpbWVvdXQoKCkgPT4gaW5wdXQuZm9jdXMoKSwgNTApO1xuICB9XG5cbiAgb25DbG9zZSgpOiB2b2lkIHtcbiAgICB0aGlzLmNvbnRlbnRFbC5lbXB0eSgpO1xuICB9XG59XG5cbmV4cG9ydCBjbGFzcyBGb3JtdWxhSW5wdXRNb2RhbCBleHRlbmRzIE1vZGFsIHtcbiAgY29sTmFtZTogc3RyaW5nO1xuICBjdXJyZW50RXhwcjogc3RyaW5nO1xuICBjb2x1bW5zOiBDb2x1bW5bXTtcbiAgb25TdWJtaXQ6IChleHByOiBzdHJpbmcpID0+IHZvaWQ7XG5cbiAgY29uc3RydWN0b3IoXG4gICAgYXBwOiBBcHAsXG4gICAgY29sTmFtZTogc3RyaW5nLFxuICAgIGN1cnJlbnRFeHByOiBzdHJpbmcsXG4gICAgY29sdW1uczogQ29sdW1uW10sXG4gICAgb25TdWJtaXQ6IChleHByOiBzdHJpbmcpID0+IHZvaWQsXG4gICkge1xuICAgIHN1cGVyKGFwcCk7XG4gICAgdGhpcy5jb2xOYW1lID0gY29sTmFtZTtcbiAgICB0aGlzLmN1cnJlbnRFeHByID0gY3VycmVudEV4cHI7XG4gICAgdGhpcy5jb2x1bW5zID0gY29sdW1ucztcbiAgICB0aGlzLm9uU3VibWl0ID0gb25TdWJtaXQ7XG4gIH1cblxuICBvbk9wZW4oKTogdm9pZCB7XG4gICAgY29uc3QgeyBjb250ZW50RWwgfSA9IHRoaXM7XG4gICAgY29udGVudEVsLmVtcHR5KCk7XG4gICAgY29udGVudEVsLmFkZENsYXNzKFwiemliYXNlLW1vZGFsXCIpO1xuICAgIGNvbnRlbnRFbC5jcmVhdGVFbChcImgzXCIsIHsgdGV4dDogYEZvcm11bGEgZm9yIFwiJHt0aGlzLmNvbE5hbWV9XCJgLCBjbHM6IFwiemliYXNlLW1vZGFsLXRpdGxlXCIgfSk7XG4gICAgY29udGVudEVsLmNyZWF0ZUVsKFwicFwiLCB7XG4gICAgICB0ZXh0OiBcIlVzZSBjb2x1bW4gbmFtZXMgdG8gcmVmZXJlbmNlIHZhbHVlcy4gQ2FzZS1pbnNlbnNpdGl2ZS5cIixcbiAgICAgIGNsczogXCJ6aWJhc2Utc2V0dGluZ3MtZGVzY1wiLFxuICAgIH0pO1xuXG4gICAgbGV0IGlucHV0OiBIVE1MSW5wdXRFbGVtZW50O1xuICAgIGNvbnN0IGNvbExpc3QgPSBjb250ZW50RWwuY3JlYXRlRGl2KFwiemliYXNlLWZvcm11bGEtY29sc1wiKTtcbiAgICBjb2xMaXN0LmNyZWF0ZVNwYW4oeyB0ZXh0OiBcIkF2YWlsYWJsZTogXCIsIGNsczogXCJ6aWJhc2UtZm9ybXVsYS1jb2xzLWxhYmVsXCIgfSk7XG4gICAgdGhpcy5jb2x1bW5zLmZvckVhY2goKGNvbCkgPT4ge1xuICAgICAgaWYgKGNvbC5uYW1lID09PSB0aGlzLmNvbE5hbWUpIHJldHVybjtcbiAgICAgIGNvbnN0IGNoaXAgPSBjb2xMaXN0LmNyZWF0ZVNwYW4oeyB0ZXh0OiBjb2wubmFtZSwgY2xzOiBcInppYmFzZS1mb3JtdWxhLWNvbC1jaGlwXCIgfSk7XG4gICAgICBjaGlwLmFkZEV2ZW50TGlzdGVuZXIoXCJjbGlja1wiLCAoKSA9PiB7XG4gICAgICAgIGlucHV0LnZhbHVlICs9IGNvbC5uYW1lO1xuICAgICAgICBpbnB1dC5mb2N1cygpO1xuICAgICAgfSk7XG4gICAgfSk7XG5cbiAgICBpbnB1dCA9IGNvbnRlbnRFbC5jcmVhdGVFbChcImlucHV0XCIsIHsgdHlwZTogXCJ0ZXh0XCIsIGNsczogXCJ6aWJhc2UtbW9kYWwtaW5wdXQgemliYXNlLW1vZGFsLWZvcm11bGEtaW5wdXRcIiB9KTtcbiAgICBpbnB1dC52YWx1ZSA9IHRoaXMuY3VycmVudEV4cHI7XG4gICAgaW5wdXQucGxhY2Vob2xkZXIgPSBcImUuZy4sIFByaWNlICogUXR5XCI7XG5cbiAgICBjb25zdCBhcHBseUJ0biA9IGNvbnRlbnRFbC5jcmVhdGVFbChcImJ1dHRvblwiLCB7IHRleHQ6IFwiQXBwbHlcIiwgY2xzOiBcInppYmFzZS1tb2RhbC1hcHBseS1idG5cIiB9KTtcbiAgICBjb25zdCBhcHBseSA9ICgpID0+IHtcbiAgICAgIGNvbnN0IGV4cHIgPSBpbnB1dC52YWx1ZS50cmltKCk7XG4gICAgICBpZiAoZXhwcikge1xuICAgICAgICB0aGlzLm9uU3VibWl0KGV4cHIpO1xuICAgICAgICB0aGlzLmNsb3NlKCk7XG4gICAgICB9XG4gICAgfTtcbiAgICBhcHBseUJ0bi5hZGRFdmVudExpc3RlbmVyKFwiY2xpY2tcIiwgYXBwbHkpO1xuICAgIGlucHV0LmFkZEV2ZW50TGlzdGVuZXIoXCJrZXlkb3duXCIsIChlKSA9PiB7XG4gICAgICBpZiAoZS5rZXkgPT09IFwiRW50ZXJcIikge1xuICAgICAgICBlLnByZXZlbnREZWZhdWx0KCk7XG4gICAgICAgIGFwcGx5KCk7XG4gICAgICB9XG4gICAgICBpZiAoZS5rZXkgPT09IFwiRXNjYXBlXCIpIHRoaXMuY2xvc2UoKTtcbiAgICB9KTtcblxuICAgIHdpbmRvdy5zZXRUaW1lb3V0KCgpID0+IHtcbiAgICAgIGlucHV0LmZvY3VzKCk7XG4gICAgICBpbnB1dC5zZWxlY3QoKTtcbiAgICB9LCA1MCk7XG4gIH1cblxuICBvbkNsb3NlKCk6IHZvaWQge1xuICAgIHRoaXMuY29udGVudEVsLmVtcHR5KCk7XG4gIH1cbn1cbiIsICJleHBvcnQgdHlwZSBDb2x1bW5LaW5kID1cbiAgfCBcInRleHRcIlxuICB8IFwidG9nZ2xlXCJcbiAgfCBcInNlbGVjdFwiXG4gIHwgXCJsYWJlbFwiXG4gIHwgXCJtdWx0aS1zZWxlY3RcIlxuICB8IFwibnVtYmVyXCJcbiAgfCBcImRhdGVcIlxuICB8IFwiZm9ybXVsYVwiO1xuXG5leHBvcnQgdHlwZSBDb2x1bW5UeXBlID1cbiAgfCB7IGtpbmQ6IFwidGV4dFwiIH1cbiAgfCB7IGtpbmQ6IFwidG9nZ2xlXCIgfVxuICB8IHsga2luZDogXCJzZWxlY3RcIjsgb3B0aW9uczogc3RyaW5nW10gfVxuICB8IHsga2luZDogXCJsYWJlbFwiIH1cbiAgfCB7IGtpbmQ6IFwibXVsdGktc2VsZWN0XCIgfVxuICB8IHsga2luZDogXCJudW1iZXJcIiB9XG4gIHwgeyBraW5kOiBcImRhdGVcIiB9XG4gIHwgeyBraW5kOiBcImZvcm11bGFcIjsgZXhwcmVzc2lvbjogc3RyaW5nIH07XG5cbmV4cG9ydCBpbnRlcmZhY2UgQ29sdW1uIHtcbiAgbmFtZTogc3RyaW5nO1xuICB0eXBlOiBDb2x1bW5UeXBlO1xuICBpbmRleDogbnVtYmVyO1xufVxuXG5leHBvcnQgaW50ZXJmYWNlIFRhYmxlU2NoZW1hIHtcbiAgY29sdW1uczogQ29sdW1uW107XG4gIHNjaGVtYVJvd0luZGV4OiBudW1iZXIgfCBudWxsO1xuICBkYXRhU3RhcnRJbmRleDogbnVtYmVyO1xuICBpbmZlcnJlZDogYm9vbGVhbjtcbn1cblxuZXhwb3J0IHR5cGUgVmlld05hbWUgPSBcInRhYmxlXCIgfCBcImthbmJhblwiIHwgXCJnYWxsZXJ5XCIgfCBcImNhbGVuZGFyXCI7XG5cbmV4cG9ydCBpbnRlcmZhY2UgQ29sdW1uUnVsZSB7XG4gIG5hbWU6IHN0cmluZztcbiAgdHlwZTogc3RyaW5nO1xufVxuXG5leHBvcnQgaW50ZXJmYWNlIFppQmFzZVNldHRpbmdzIHtcbiAgcmVuZGVySW5SZWFkaW5nVmlldzogYm9vbGVhbjtcbiAgaW5mZXJTY2hlbWE6IGJvb2xlYW47XG4gIGNvbHVtblJ1bGVzOiBDb2x1bW5SdWxlW107XG59XG5cbmV4cG9ydCBjb25zdCBDT0xVTU5fVFlQRV9PUFRJT05TOiBDb2x1bW5LaW5kW10gPSBbXG4gIFwidGV4dFwiLFxuICBcInRvZ2dsZVwiLFxuICBcInNlbGVjdFwiLFxuICBcImxhYmVsXCIsXG4gIFwibXVsdGktc2VsZWN0XCIsXG4gIFwibnVtYmVyXCIsXG4gIFwiZGF0ZVwiLFxuICBcImZvcm11bGFcIixcbl07XG4iLCAiaW1wb3J0IHR5cGUgeyBWaWV3TmFtZSB9IGZyb20gXCIuL3R5cGVzXCI7XG5cbmV4cG9ydCBpbnRlcmZhY2UgTGlua2VkVmlld0NvbmZpZyB7XG4gIHNvdXJjZVJhdzogc3RyaW5nO1xuICBub3RlUGF0aDogc3RyaW5nO1xuICBzdWJwYXRoPzogc3RyaW5nO1xuICB2aWV3OiBWaWV3TmFtZTtcbiAgZ3JvdXBCeT86IHN0cmluZztcbiAgZmlsdGVyPzogc3RyaW5nO1xuICBzb3J0Pzogc3RyaW5nO1xuICB0YWJsZUluZGV4OiBudW1iZXI7XG59XG5cbi8qKlxuICogUGFyc2VzIGEgYGBgemliYXNlIGNvZGVibG9jayBjb25maWd1cmF0aW9uLlxuICogQWNjZXB0cyBZQU1MLXN0eWxlIGtleS12YWx1ZXM6XG4gKiBzb3VyY2U6IFtbUHJvamVjdHMjU3ByaW50IFRhc2tzXV1cbiAqIHZpZXc6IGthbmJhblxuICogZ3JvdXBCeTogU3RhdHVzXG4gKiBmaWx0ZXI6IFByaW9yaXR5ID09IEhpZ2hcbiAqIHNvcnQ6IFNjb3JlIGRlc2NcbiAqIHRhYmxlOiAxXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBwYXJzZUxpbmtlZFZpZXdDb25maWcoc291cmNlVGV4dDogc3RyaW5nKTogTGlua2VkVmlld0NvbmZpZyB8IG51bGwge1xuICBjb25zdCBsaW5lcyA9IHNvdXJjZVRleHQuc3BsaXQoXCJcXG5cIik7XG4gIGNvbnN0IGNvbmZpZ01hcCA9IG5ldyBNYXA8c3RyaW5nLCBzdHJpbmc+KCk7XG5cbiAgZm9yIChjb25zdCByYXdMaW5lIG9mIGxpbmVzKSB7XG4gICAgY29uc3QgbGluZSA9IHJhd0xpbmUudHJpbSgpO1xuICAgIGlmICghbGluZSB8fCBsaW5lLnN0YXJ0c1dpdGgoXCIjXCIpIHx8IGxpbmUuc3RhcnRzV2l0aChcIi8vXCIpKSBjb250aW51ZTtcblxuICAgIGNvbnN0IGNvbG9uSWR4ID0gbGluZS5pbmRleE9mKFwiOlwiKTtcbiAgICBpZiAoY29sb25JZHggPT09IC0xKSBjb250aW51ZTtcblxuICAgIGNvbnN0IGtleSA9IGxpbmUuc2xpY2UoMCwgY29sb25JZHgpLnRyaW0oKS50b0xvd2VyQ2FzZSgpO1xuICAgIGNvbnN0IHZhbCA9IGxpbmUuc2xpY2UoY29sb25JZHggKyAxKS50cmltKCk7XG4gICAgaWYgKGtleSAmJiB2YWwpIHtcbiAgICAgIGNvbmZpZ01hcC5zZXQoa2V5LCB2YWwpO1xuICAgIH1cbiAgfVxuXG4gIC8vIFwic291cmNlXCIgb3IgXCJmcm9tXCIgYXJlIGFjY2VwdGVkXG4gIGNvbnN0IHNvdXJjZVJhdyA9IGNvbmZpZ01hcC5nZXQoXCJzb3VyY2VcIikgfHwgY29uZmlnTWFwLmdldChcImZyb21cIik7XG4gIGlmICghc291cmNlUmF3KSByZXR1cm4gbnVsbDtcblxuICAvLyBFeHRyYWN0IG5vdGVQYXRoIGFuZCBzdWJwYXRoIGZyb20gW1tOb3RlI1N1YnBhdGhdXSBvciBOb3RlI1N1YnBhdGhcbiAgbGV0IG5vdGVQYXRoID0gc291cmNlUmF3O1xuICBsZXQgc3VicGF0aDogc3RyaW5nIHwgdW5kZWZpbmVkID0gdW5kZWZpbmVkO1xuXG4gIGNvbnN0IHdpa2lNYXRjaCA9IHNvdXJjZVJhdy5tYXRjaCgvXlxcW1xcWyhbXlxcXV0rKVxcXVxcXSQvKTtcbiAgY29uc3QgdGFyZ2V0U3RyID0gd2lraU1hdGNoID8gd2lraU1hdGNoWzFdLnRyaW0oKSA6IHNvdXJjZVJhdztcblxuICAvLyBDaGVjayBpZiB0YXJnZXRTdHIgY29udGFpbnMgI1xuICBjb25zdCBoYXNoSWR4ID0gdGFyZ2V0U3RyLmluZGV4T2YoXCIjXCIpO1xuICBpZiAoaGFzaElkeCAhPT0gLTEpIHtcbiAgICBub3RlUGF0aCA9IHRhcmdldFN0ci5zbGljZSgwLCBoYXNoSWR4KS50cmltKCk7XG4gICAgc3VicGF0aCA9IHRhcmdldFN0ci5zbGljZShoYXNoSWR4KS50cmltKCk7IC8vIGluY2x1ZGVzICcjJyBvciAnI14nXG4gIH0gZWxzZSB7XG4gICAgbm90ZVBhdGggPSB0YXJnZXRTdHI7XG4gIH1cblxuICAvLyBQYXJzZSB2aWV3ICh0YWJsZSwga2FuYmFuLCBnYWxsZXJ5LCBjYWxlbmRhcilcbiAgY29uc3QgcmF3VmlldyA9IChjb25maWdNYXAuZ2V0KFwidmlld1wiKSB8fCBcInRhYmxlXCIpLnRvTG93ZXJDYXNlKCk7XG4gIGxldCB2aWV3OiBWaWV3TmFtZSA9IFwidGFibGVcIjtcbiAgbGV0IGdyb3VwQnkgPSBjb25maWdNYXAuZ2V0KFwiZ3JvdXBieVwiKSB8fCBjb25maWdNYXAuZ2V0KFwiZ3JvdXBfYnlcIik7XG5cbiAgaWYgKHJhd1ZpZXcuc3RhcnRzV2l0aChcImthbmJhblwiKSkge1xuICAgIHZpZXcgPSBcImthbmJhblwiO1xuICAgIGlmIChyYXdWaWV3LmluY2x1ZGVzKFwiOlwiKSkge1xuICAgICAgY29uc3QgcGFydHMgPSByYXdWaWV3LnNwbGl0KFwiOlwiKTtcbiAgICAgIGdyb3VwQnkgPSBncm91cEJ5IHx8IHBhcnRzWzFdPy50cmltKCk7XG4gICAgfVxuICB9IGVsc2UgaWYgKHJhd1ZpZXcgPT09IFwiZ2FsbGVyeVwiKSB7XG4gICAgdmlldyA9IFwiZ2FsbGVyeVwiO1xuICB9IGVsc2UgaWYgKHJhd1ZpZXcgPT09IFwiY2FsZW5kYXJcIikge1xuICAgIHZpZXcgPSBcImNhbGVuZGFyXCI7XG4gIH0gZWxzZSB7XG4gICAgdmlldyA9IFwidGFibGVcIjtcbiAgfVxuXG4gIGNvbnN0IHRhYmxlSW5kZXhTdHIgPSBjb25maWdNYXAuZ2V0KFwidGFibGVcIikgfHwgY29uZmlnTWFwLmdldChcImluZGV4XCIpO1xuICBjb25zdCBwYXJzZWRJbmRleCA9IHRhYmxlSW5kZXhTdHIgPyBwYXJzZUludCh0YWJsZUluZGV4U3RyLCAxMCkgOiAxO1xuICBjb25zdCB0YWJsZUluZGV4ID0gaXNOYU4ocGFyc2VkSW5kZXgpIHx8IHBhcnNlZEluZGV4IDwgMSA/IDEgOiBwYXJzZWRJbmRleDtcblxuICByZXR1cm4ge1xuICAgIHNvdXJjZVJhdyxcbiAgICBub3RlUGF0aCxcbiAgICBzdWJwYXRoLFxuICAgIHZpZXcsXG4gICAgZ3JvdXBCeSxcbiAgICBmaWx0ZXI6IGNvbmZpZ01hcC5nZXQoXCJmaWx0ZXJcIiksXG4gICAgc29ydDogY29uZmlnTWFwLmdldChcInNvcnRcIiksXG4gICAgdGFibGVJbmRleCxcbiAgfTtcbn1cbiIsICJleHBvcnQgaW50ZXJmYWNlIERldGVjdGVkVGFibGUge1xuICBzdGFydExpbmU6IG51bWJlcjtcbiAgZW5kTGluZTogbnVtYmVyO1xuICBsaW5lczogc3RyaW5nW107XG4gIGJsb2NrSWQ/OiBzdHJpbmc7XG4gIGhlYWRpbmc/OiBzdHJpbmc7XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgUmVzb2x2ZVRhYmxlT3B0aW9ucyB7XG4gIHN1YnBhdGg/OiBzdHJpbmc7IC8vIGUuZy4gXCJec3ByaW50LXRhc2tzXCIgb3IgXCIjU3ByaW50IFRhc2tzXCJcbiAgdGFibGVJbmRleD86IG51bWJlcjsgLy8gMS1iYXNlZCBpbmRleCAoZS5nLiAxLCAyLCAuLi4pXG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgUmVzb2x2ZWRUYWJsZSB7XG4gIHRhYmxlOiBEZXRlY3RlZFRhYmxlO1xuICBhbGxMaW5lczogc3RyaW5nW107XG59XG5cbi8qKlxuICogU2NhbiBhbGwgbWFya2Rvd24gdGFibGVzIGZyb20gdGhlIGZpbGUgbGluZXMuXG4gKiBBc3NvY2lhdGVzIGVhY2ggdGFibGUgd2l0aCBpdHMgbmVhcmVzdCBwcmVjZWRpbmcgaGVhZGluZyBhbmQgdHJhaWxpbmcgYmxvY2sgSUQgaWYgYW55LlxuICovXG5leHBvcnQgZnVuY3Rpb24gc2NhblRhYmxlcyhjb250ZW50TGluZXM6IHN0cmluZ1tdKTogRGV0ZWN0ZWRUYWJsZVtdIHtcbiAgY29uc3QgdGFibGVzOiBEZXRlY3RlZFRhYmxlW10gPSBbXTtcbiAgbGV0IGN1cnJlbnRIZWFkaW5nID0gXCJcIjtcbiAgbGV0IGluVGFibGUgPSBmYWxzZTtcbiAgbGV0IHRhYmxlU3RhcnQgPSAtMTtcbiAgbGV0IGN1cnJlbnRUYWJsZUxpbmVzOiBzdHJpbmdbXSA9IFtdO1xuXG4gIGZvciAobGV0IGkgPSAwOyBpIDwgY29udGVudExpbmVzLmxlbmd0aDsgaSsrKSB7XG4gICAgY29uc3QgbGluZSA9IGNvbnRlbnRMaW5lc1tpXTtcbiAgICBjb25zdCB0cmltbWVkID0gbGluZS50cmltKCk7XG5cbiAgICAvLyBUcmFjayBoZWFkaW5nXG4gICAgY29uc3QgaGVhZGluZ01hdGNoID0gdHJpbW1lZC5tYXRjaCgvXigjezEsNn0pXFxzKyguKykkLyk7XG4gICAgaWYgKGhlYWRpbmdNYXRjaCkge1xuICAgICAgaWYgKGluVGFibGUpIHtcbiAgICAgICAgLy8gQ2xvc2UgdGFibGUgYmVmb3JlIGhlYWRpbmdcbiAgICAgICAgdGFibGVzLnB1c2goe1xuICAgICAgICAgIHN0YXJ0TGluZTogdGFibGVTdGFydCxcbiAgICAgICAgICBlbmRMaW5lOiBpIC0gMSxcbiAgICAgICAgICBsaW5lczogWy4uLmN1cnJlbnRUYWJsZUxpbmVzXSxcbiAgICAgICAgICBoZWFkaW5nOiBjdXJyZW50SGVhZGluZyxcbiAgICAgICAgfSk7XG4gICAgICAgIGluVGFibGUgPSBmYWxzZTtcbiAgICAgICAgY3VycmVudFRhYmxlTGluZXMgPSBbXTtcbiAgICAgIH1cbiAgICAgIGN1cnJlbnRIZWFkaW5nID0gaGVhZGluZ01hdGNoWzJdLnRyaW0oKTtcbiAgICAgIGNvbnRpbnVlO1xuICAgIH1cblxuICAgIC8vIENoZWNrIGlmIGxpbmUgbG9va3MgbGlrZSBhIHRhYmxlIHJvdzogc3RhcnRzIGFuZCBlbmRzIHdpdGggJ3wnIG9yIGNvbnRhaW5zICd8J1xuICAgIGNvbnN0IGlzVGFibGVSb3cgPSB0cmltbWVkLnN0YXJ0c1dpdGgoXCJ8XCIpICYmIHRyaW1tZWQuZW5kc1dpdGgoXCJ8XCIpICYmIHRyaW1tZWQubGVuZ3RoID4gMTtcblxuICAgIGlmIChpc1RhYmxlUm93KSB7XG4gICAgICBpZiAoIWluVGFibGUpIHtcbiAgICAgICAgLy8gTmVlZCB0byBjaGVjayBpZiBuZXh0IGxpbmUgaXMgYSBzZXBhcmF0b3Igb3IgaWYgdGhpcyBpcyBwYXJ0IG9mIHRhYmxlXG4gICAgICAgIC8vIE9yIGlmIGFscmVhZHkgc3RhcnRlZFxuICAgICAgICBpblRhYmxlID0gdHJ1ZTtcbiAgICAgICAgdGFibGVTdGFydCA9IGk7XG4gICAgICAgIGN1cnJlbnRUYWJsZUxpbmVzID0gW2xpbmVdO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgY3VycmVudFRhYmxlTGluZXMucHVzaChsaW5lKTtcbiAgICAgIH1cbiAgICB9IGVsc2Uge1xuICAgICAgaWYgKGluVGFibGUpIHtcbiAgICAgICAgLy8gQ2hlY2sgaWYgdGhpcyBsaW5lIGlzIGFuIE9ic2lkaWFuIGJsb2NrIHJlZmVyZW5jZSwgZS5nLiBebXktdGFibGVcbiAgICAgICAgY29uc3QgYmxvY2tJZE1hdGNoID0gdHJpbW1lZC5tYXRjaCgvXlxcXihbYS16QS1aMC05Xy1dKykkLyk7XG4gICAgICAgIGxldCBibG9ja0lkOiBzdHJpbmcgfCB1bmRlZmluZWQgPSB1bmRlZmluZWQ7XG4gICAgICAgIGxldCBlbmRJZHggPSBpIC0gMTtcblxuICAgICAgICBpZiAoYmxvY2tJZE1hdGNoKSB7XG4gICAgICAgICAgYmxvY2tJZCA9IGJsb2NrSWRNYXRjaFsxXTtcbiAgICAgICAgICBlbmRJZHggPSBpOyAvLyBpbmNsdWRlIGJsb2NrIElEIGxpbmUgaW4gdGFibGUgYm91bmRzXG4gICAgICAgIH1cblxuICAgICAgICB0YWJsZXMucHVzaCh7XG4gICAgICAgICAgc3RhcnRMaW5lOiB0YWJsZVN0YXJ0LFxuICAgICAgICAgIGVuZExpbmU6IGVuZElkeCxcbiAgICAgICAgICBsaW5lczogWy4uLmN1cnJlbnRUYWJsZUxpbmVzXSxcbiAgICAgICAgICBoZWFkaW5nOiBjdXJyZW50SGVhZGluZyxcbiAgICAgICAgICBibG9ja0lkLFxuICAgICAgICB9KTtcblxuICAgICAgICBpblRhYmxlID0gZmFsc2U7XG4gICAgICAgIGN1cnJlbnRUYWJsZUxpbmVzID0gW107XG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgLy8gSWYgZmlsZSBlbmRzIHdoaWxlIGluc2lkZSBhIHRhYmxlXG4gIGlmIChpblRhYmxlICYmIGN1cnJlbnRUYWJsZUxpbmVzLmxlbmd0aCA+IDApIHtcbiAgICB0YWJsZXMucHVzaCh7XG4gICAgICBzdGFydExpbmU6IHRhYmxlU3RhcnQsXG4gICAgICBlbmRMaW5lOiBjb250ZW50TGluZXMubGVuZ3RoIC0gMSxcbiAgICAgIGxpbmVzOiBbLi4uY3VycmVudFRhYmxlTGluZXNdLFxuICAgICAgaGVhZGluZzogY3VycmVudEhlYWRpbmcsXG4gICAgfSk7XG4gIH1cblxuICAvLyBGaWx0ZXIgb3V0IGFueSBmYWxzZSBwb3NpdGl2ZSAxLWxpbmUgdGFibGVzIHRoYXQgZG9uJ3QgaGF2ZSBoZWFkZXIgc2VwYXJhdG9yXG4gIHJldHVybiB0YWJsZXMuZmlsdGVyKCh0KSA9PiB7XG4gICAgaWYgKHQubGluZXMubGVuZ3RoIDwgMikgcmV0dXJuIGZhbHNlO1xuICAgIGNvbnN0IHNlcCA9IHQubGluZXNbMV0udHJpbSgpO1xuICAgIHJldHVybiAvXlxcfD9cXHMqOj8tKzo/XFxzKihcXHw6Py0rOj9cXHMqKStcXHw/JC8udGVzdChzZXApO1xuICB9KTtcbn1cblxuLyoqXG4gKiBSZXNvbHZlcyBhIHNwZWNpZmljIHRhYmxlIGZyb20gcmF3IG1hcmtkb3duIGNvbnRlbnQgdXNpbmc6XG4gKiAxLiBCbG9jayBJRCAoXmlkKVxuICogMi4gSGVhZGluZyAoI0hlYWRpbmcpXG4gKiAzLiBUYWJsZSBJbmRleCAodGFibGU6IDEsIHRhYmxlOiAyKVxuICovXG5leHBvcnQgZnVuY3Rpb24gcmVzb2x2ZVRhcmdldFRhYmxlKFxuICBmaWxlQ29udGVudDogc3RyaW5nLFxuICBvcHRpb25zOiBSZXNvbHZlVGFibGVPcHRpb25zID0ge30sXG4pOiBSZXNvbHZlZFRhYmxlIHwgbnVsbCB7XG4gIGNvbnN0IGNvbnRlbnRMaW5lcyA9IGZpbGVDb250ZW50LnNwbGl0KFwiXFxuXCIpO1xuICBjb25zdCB0YWJsZXMgPSBzY2FuVGFibGVzKGNvbnRlbnRMaW5lcyk7XG5cbiAgaWYgKHRhYmxlcy5sZW5ndGggPT09IDApIHJldHVybiBudWxsO1xuXG4gIGNvbnN0IHN1YnBhdGggPSBvcHRpb25zLnN1YnBhdGg/LnRyaW0oKTtcbiAgY29uc3QgdGFibGVJbmRleCA9IG9wdGlvbnMudGFibGVJbmRleCA/PyAxO1xuXG4gIC8vIENhc2UgMTogU3VicGF0aCBpcyBhIEJsb2NrIElEICheaWQpXG4gIGlmIChzdWJwYXRoICYmIHN1YnBhdGguc3RhcnRzV2l0aChcIl5cIikpIHtcbiAgICBjb25zdCByYXdJZCA9IHN1YnBhdGguc2xpY2UoMSkudHJpbSgpLnRvTG93ZXJDYXNlKCk7XG4gICAgY29uc3QgZm91bmQgPSB0YWJsZXMuZmluZCgodCkgPT4gdC5ibG9ja0lkPy50b0xvd2VyQ2FzZSgpID09PSByYXdJZCk7XG4gICAgaWYgKGZvdW5kKSB7XG4gICAgICByZXR1cm4geyB0YWJsZTogZm91bmQsIGFsbExpbmVzOiBjb250ZW50TGluZXMgfTtcbiAgICB9XG4gICAgLy8gQWxzbyBjaGVjayBpZiBhbnkgbGluZSBpbiB0YWJsZSBjb250YWlucyA8IS0tIHppYmFzZS1pZDogaWQgLS0+XG4gICAgZm9yIChjb25zdCB0IG9mIHRhYmxlcykge1xuICAgICAgZm9yIChjb25zdCBsaW5lIG9mIHQubGluZXMpIHtcbiAgICAgICAgY29uc3QgY29tbWVudE1hdGNoID0gbGluZS5tYXRjaCgvPCEtLVxccyp6aWJhc2UtaWQ6XFxzKihbYS16QS1aMC05Xy1dKylcXHMqLS0+L2kpO1xuICAgICAgICBpZiAoY29tbWVudE1hdGNoICYmIGNvbW1lbnRNYXRjaFsxXS50b0xvd2VyQ2FzZSgpID09PSByYXdJZCkge1xuICAgICAgICAgIHJldHVybiB7IHRhYmxlOiB0LCBhbGxMaW5lczogY29udGVudExpbmVzIH07XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIG51bGw7XG4gIH1cblxuICAvLyBDYXNlIDI6IFN1YnBhdGggaXMgYSBIZWFkaW5nICgjSGVhZGluZyBvciBIZWFkaW5nKVxuICBpZiAoc3VicGF0aCkge1xuICAgIGNvbnN0IGNsZWFuSGVhZGluZyA9IHN1YnBhdGguc3RhcnRzV2l0aChcIiNcIikgPyBzdWJwYXRoLnJlcGxhY2UoL14jK1xccyovLCBcIlwiKS50cmltKCkgOiBzdWJwYXRoO1xuICAgIGNvbnN0IG1hdGNoaW5nSGVhZGluZ1RhYmxlcyA9IHRhYmxlcy5maWx0ZXIoKHQpID0+XG4gICAgICB0LmhlYWRpbmc/LnRvTG93ZXJDYXNlKCkgPT09IGNsZWFuSGVhZGluZy50b0xvd2VyQ2FzZSgpLFxuICAgICk7XG5cbiAgICBpZiAobWF0Y2hpbmdIZWFkaW5nVGFibGVzLmxlbmd0aCA+IDApIHtcbiAgICAgIGNvbnN0IGlkeCA9IE1hdGgubWF4KDAsIHRhYmxlSW5kZXggLSAxKTtcbiAgICAgIGNvbnN0IGNob3NlbiA9IG1hdGNoaW5nSGVhZGluZ1RhYmxlc1tpZHhdID8/IG1hdGNoaW5nSGVhZGluZ1RhYmxlc1swXTtcbiAgICAgIHJldHVybiB7IHRhYmxlOiBjaG9zZW4sIGFsbExpbmVzOiBjb250ZW50TGluZXMgfTtcbiAgICB9XG4gIH1cblxuICAvLyBDYXNlIDM6IFRhYmxlIGluZGV4IC8gRGVmYXVsdCBmaXJzdCB0YWJsZVxuICBjb25zdCBpZHggPSBNYXRoLm1heCgwLCB0YWJsZUluZGV4IC0gMSk7XG4gIGlmIChpZHggPCB0YWJsZXMubGVuZ3RoKSB7XG4gICAgcmV0dXJuIHsgdGFibGU6IHRhYmxlc1tpZHhdLCBhbGxMaW5lczogY29udGVudExpbmVzIH07XG4gIH1cblxuICByZXR1cm4gbnVsbDtcbn1cbiIsICJpbXBvcnQgeyBDb21wb25lbnQsIE1hcmtkb3duUmVuZGVyQ2hpbGQsIE1hcmtkb3duUmVuZGVyZXIsIFRGaWxlLCB0eXBlIE1hcmtkb3duUG9zdFByb2Nlc3NvckNvbnRleHQsIHR5cGUgTWFya2Rvd25TZWN0aW9uSW5mb3JtYXRpb24gfSBmcm9tIFwib2JzaWRpYW5cIjtcbmltcG9ydCB7IGZpbHRlckRhdGFSb3dzLCBzZXJpYWxpemVSb3csIHNwbGl0Um93IH0gZnJvbSBcIi4uL3NjaGVtYVwiO1xuaW1wb3J0IHR5cGUgeyBUYWJsZVNjaGVtYSwgWmlCYXNlSG9zdCB9IGZyb20gXCIuLi90eXBlc1wiO1xuaW1wb3J0IHsgZ2V0TGFiZWxDb2xvciB9IGZyb20gXCIuLi91aVwiO1xuXG5leHBvcnQgZnVuY3Rpb24gYnVpbGRDYWxlbmRhclZpZXcoXG4gIGhvc3Q6IFppQmFzZUhvc3QsXG4gIGJvZHk6IEhUTUxFbGVtZW50LFxuICBzY2hlbWE6IFRhYmxlU2NoZW1hLFxuICBnZXREYXRhUm93czogKCkgPT4gc3RyaW5nW10sXG4gIF9yYXdEYXRhTGluZXM6IHN0cmluZ1tdLFxuICBjb250ZXh0OiBNYXJrZG93blBvc3RQcm9jZXNzb3JDb250ZXh0LFxuICBzZWN0aW9uSW5mbzogTWFya2Rvd25TZWN0aW9uSW5mb3JtYXRpb24sXG4gIGZpbHRlclF1ZXJ5OiBzdHJpbmcsXG4pOiB2b2lkIHtcbiAgY29uc3QgZGF0ZUNvbCA9IHNjaGVtYS5jb2x1bW5zLmZpbmQoKGMpID0+IGMudHlwZS5raW5kID09PSBcImRhdGVcIik7XG4gIGlmICghZGF0ZUNvbCkge1xuICAgIGNvbnN0IG5vdGljZSA9IGJvZHkuY3JlYXRlRGl2KFwiemliYXNlLWNhbGVuZGFyIHppYmFzZS1jYWxlbmRhci1ub3RpY2VcIik7XG4gICAgbm90aWNlLnRleHRDb250ZW50ID0gXCJDYWxlbmRhciByZXF1aXJlcyBhIERhdGUgY29sdW1uLlwiO1xuICAgIHJldHVybjtcbiAgfVxuXG4gIGNvbnN0IGNhbGVuZGFyID0gYm9keS5jcmVhdGVEaXYoXCJ6aWJhc2UtY2FsZW5kYXJcIik7XG4gIGNvbnN0IG5vdyA9IG5ldyBEYXRlKCk7XG4gIGxldCBjdXJyZW50TW9udGggPSBub3cuZ2V0TW9udGgoKTtcbiAgbGV0IGN1cnJlbnRZZWFyID0gbm93LmdldEZ1bGxZZWFyKCk7XG5cbiAgY29uc3QgcmVuZGVyQ2FsZW5kYXIgPSAoKSA9PiB7XG4gICAgY2FsZW5kYXIuZW1wdHkoKTtcblxuICAgIGNvbnN0IG5hdiA9IGNhbGVuZGFyLmNyZWF0ZURpdihcInppYmFzZS1jYWxlbmRhci1uYXZcIik7XG4gICAgY29uc3QgcHJldkJ0biA9IG5hdi5jcmVhdGVFbChcImJ1dHRvblwiLCB7IHRleHQ6IFwiXHUyNUMwXCIsIGNsczogXCJ6aWJhc2UtY2FsZW5kYXItbmF2LWJ0blwiIH0pO1xuICAgIGNvbnN0IG1vbnRoTGFiZWwgPSBuYXYuY3JlYXRlU3Bhbih7IGNsczogXCJ6aWJhc2UtY2FsZW5kYXItbW9udGgtbGFiZWxcIiB9KTtcbiAgICBtb250aExhYmVsLnRleHRDb250ZW50ID0gbmV3IERhdGUoY3VycmVudFllYXIsIGN1cnJlbnRNb250aCkudG9Mb2NhbGVTdHJpbmcoXCJkZWZhdWx0XCIsIHtcbiAgICAgIG1vbnRoOiBcImxvbmdcIixcbiAgICAgIHllYXI6IFwibnVtZXJpY1wiLFxuICAgIH0pO1xuICAgIGNvbnN0IG5leHRCdG4gPSBuYXYuY3JlYXRlRWwoXCJidXR0b25cIiwgeyB0ZXh0OiBcIlx1MjVCNlwiLCBjbHM6IFwiemliYXNlLWNhbGVuZGFyLW5hdi1idG5cIiB9KTtcblxuICAgIHByZXZCdG4uYWRkRXZlbnRMaXN0ZW5lcihcImNsaWNrXCIsICgpID0+IHtcbiAgICAgIGN1cnJlbnRNb250aC0tO1xuICAgICAgaWYgKGN1cnJlbnRNb250aCA8IDApIHtcbiAgICAgICAgY3VycmVudE1vbnRoID0gMTE7XG4gICAgICAgIGN1cnJlbnRZZWFyLS07XG4gICAgICB9XG4gICAgICByZW5kZXJDYWxlbmRhcigpO1xuICAgIH0pO1xuICAgIG5leHRCdG4uYWRkRXZlbnRMaXN0ZW5lcihcImNsaWNrXCIsICgpID0+IHtcbiAgICAgIGN1cnJlbnRNb250aCsrO1xuICAgICAgaWYgKGN1cnJlbnRNb250aCA+IDExKSB7XG4gICAgICAgIGN1cnJlbnRNb250aCA9IDA7XG4gICAgICAgIGN1cnJlbnRZZWFyKys7XG4gICAgICB9XG4gICAgICByZW5kZXJDYWxlbmRhcigpO1xuICAgIH0pO1xuXG4gICAgY29uc3QgZGF5SGVhZGVycyA9IGNhbGVuZGFyLmNyZWF0ZURpdihcInppYmFzZS1jYWxlbmRhci1kYXktaGVhZGVyc1wiKTtcbiAgICBbXCJNb25cIiwgXCJUdWVcIiwgXCJXZWRcIiwgXCJUaHVcIiwgXCJGcmlcIiwgXCJTYXRcIiwgXCJTdW5cIl0uZm9yRWFjaCgoZCkgPT4ge1xuICAgICAgZGF5SGVhZGVycy5jcmVhdGVTcGFuKHsgdGV4dDogZCwgY2xzOiBcInppYmFzZS1jYWxlbmRhci1kYXktaGVhZGVyXCIgfSk7XG4gICAgfSk7XG5cbiAgICBjb25zdCBncmlkID0gY2FsZW5kYXIuY3JlYXRlRGl2KFwiemliYXNlLWNhbGVuZGFyLWdyaWRcIik7XG4gICAgY29uc3QgZmlyc3REYXkgPSBuZXcgRGF0ZShjdXJyZW50WWVhciwgY3VycmVudE1vbnRoLCAxKTtcbiAgICBjb25zdCBsYXN0RGF5ID0gbmV3IERhdGUoY3VycmVudFllYXIsIGN1cnJlbnRNb250aCArIDEsIDApO1xuICAgIGNvbnN0IHRvdGFsRGF5cyA9IGxhc3REYXkuZ2V0RGF0ZSgpO1xuXG4gICAgbGV0IHN0YXJ0RG93ID0gZmlyc3REYXkuZ2V0RGF5KCkgLSAxO1xuICAgIGlmIChzdGFydERvdyA8IDApIHN0YXJ0RG93ID0gNjtcblxuICAgIGNvbnN0IGRhdGFSb3dzID0gZmlsdGVyRGF0YVJvd3MoZ2V0RGF0YVJvd3MoKSwgZmlsdGVyUXVlcnkpO1xuICAgIGNvbnN0IGRhdGVNYXAgPSBuZXcgTWFwPHN0cmluZywgeyB0aXRsZTogc3RyaW5nOyBsYWJlbDogc3RyaW5nIHwgbnVsbDsgbGluZTogc3RyaW5nIH1bXT4oKTtcbiAgICBkYXRhUm93cy5mb3JFYWNoKChsaW5lKSA9PiB7XG4gICAgICBjb25zdCBjZWxscyA9IHNwbGl0Um93KGxpbmUpO1xuICAgICAgY29uc3QgZGF0ZVN0ciA9IChjZWxsc1tkYXRlQ29sLmluZGV4XSB8fCBcIlwiKS50cmltKCk7XG4gICAgICBpZiAoIWRhdGVTdHIpIHJldHVybjtcbiAgICAgIGlmICghZGF0ZU1hcC5oYXMoZGF0ZVN0cikpIGRhdGVNYXAuc2V0KGRhdGVTdHIsIFtdKTtcbiAgICAgIGNvbnN0IHRpdGxlQ29sID0gc2NoZW1hLmNvbHVtbnMuZmluZCgoYykgPT4gYy50eXBlLmtpbmQgPT09IFwidGV4dFwiKTtcbiAgICAgIGNvbnN0IHRpdGxlID0gdGl0bGVDb2wgPyAoY2VsbHNbdGl0bGVDb2wuaW5kZXhdIHx8IFwiXCIpLnRyaW0oKSA6IChjZWxsc1swXSB8fCBcIlwiKS50cmltKCk7XG4gICAgICBjb25zdCBsYWJlbENvbCA9IHNjaGVtYS5jb2x1bW5zLmZpbmQoKGMpID0+IGMudHlwZS5raW5kID09PSBcImxhYmVsXCIgfHwgYy50eXBlLmtpbmQgPT09IFwic2VsZWN0XCIpO1xuICAgICAgY29uc3QgbGFiZWwgPSBsYWJlbENvbCA/IChjZWxsc1tsYWJlbENvbC5pbmRleF0gfHwgXCJcIikudHJpbSgpIDogbnVsbDtcbiAgICAgIGRhdGVNYXAuZ2V0KGRhdGVTdHIpIS5wdXNoKHsgdGl0bGUsIGxhYmVsLCBsaW5lIH0pO1xuICAgIH0pO1xuXG4gICAgY29uc3QgdG9kYXkgPSBuZXcgRGF0ZSgpO1xuICAgIGNvbnN0IHRvZGF5U3RyID0gYCR7dG9kYXkuZ2V0RnVsbFllYXIoKX0tJHtTdHJpbmcodG9kYXkuZ2V0TW9udGgoKSArIDEpLnBhZFN0YXJ0KDIsIFwiMFwiKX0tJHtTdHJpbmcodG9kYXkuZ2V0RGF0ZSgpKS5wYWRTdGFydCgyLCBcIjBcIil9YDtcblxuICAgIGZvciAobGV0IGkgPSAwOyBpIDwgc3RhcnREb3c7IGkrKykge1xuICAgICAgZ3JpZC5jcmVhdGVEaXYoXCJ6aWJhc2UtY2FsZW5kYXItY2VsbCB6aWJhc2UtY2FsZW5kYXItY2VsbC1lbXB0eVwiKTtcbiAgICB9XG5cbiAgICBmb3IgKGxldCBkID0gMTsgZCA8PSB0b3RhbERheXM7IGQrKykge1xuICAgICAgY29uc3QgZGF0ZVN0ciA9IGAke2N1cnJlbnRZZWFyfS0ke1N0cmluZyhjdXJyZW50TW9udGggKyAxKS5wYWRTdGFydCgyLCBcIjBcIil9LSR7U3RyaW5nKGQpLnBhZFN0YXJ0KDIsIFwiMFwiKX1gO1xuICAgICAgY29uc3QgY2VsbCA9IGdyaWQuY3JlYXRlRGl2KFwiemliYXNlLWNhbGVuZGFyLWNlbGxcIik7XG4gICAgICBpZiAoZGF0ZVN0ciA9PT0gdG9kYXlTdHIpIGNlbGwuY2xhc3NMaXN0LmFkZChcInppYmFzZS1jYWxlbmRhci10b2RheVwiKTtcblxuICAgICAgY2VsbC5jcmVhdGVTcGFuKHsgdGV4dDogU3RyaW5nKGQpLCBjbHM6IFwiemliYXNlLWNhbGVuZGFyLWRheS1udW1cIiB9KTtcblxuICAgICAgY29uc3QgZW50cmllcyA9IGRhdGVNYXAuZ2V0KGRhdGVTdHIpIHx8IFtdO1xuICAgICAgZW50cmllcy5mb3JFYWNoKChlbnRyeSkgPT4ge1xuICAgICAgICBjb25zdCBwaWxsID0gY2VsbC5jcmVhdGVEaXYoXCJ6aWJhc2UtY2FsZW5kYXItZW50cnlcIik7XG4gICAgICAgIGNvbnN0IGNvbXAgPSBuZXcgTWFya2Rvd25SZW5kZXJDaGlsZChwaWxsKTtcbiAgICAgICAgY29udGV4dC5hZGRDaGlsZChjb21wKTtcbiAgICAgICAgdm9pZCBNYXJrZG93blJlbmRlcmVyLnJlbmRlcihob3N0LmFwcCwgZW50cnkudGl0bGUgfHwgXCJcdTIwMTRcIiwgcGlsbCwgY29udGV4dC5zb3VyY2VQYXRoLCBjb21wKTtcbiAgICAgICAgaWYgKGVudHJ5LmxhYmVsKSB7XG4gICAgICAgICAgcGlsbC5zZXRDc3NQcm9wcyh7IFwiLS1sY1wiOiBnZXRMYWJlbENvbG9yKGVudHJ5LmxhYmVsKSB9KTtcbiAgICAgICAgICBwaWxsLmNsYXNzTGlzdC5hZGQoXCJ6aWJhc2UtY2FsZW5kYXItZW50cnktY29sb3JlZFwiKTtcbiAgICAgICAgfVxuICAgICAgfSk7XG5cbiAgICAgIGlmIChlbnRyaWVzLmxlbmd0aCA9PT0gMCkge1xuICAgICAgICBjZWxsLmFkZEV2ZW50TGlzdGVuZXIoXCJjbGlja1wiLCAoKSA9PiB7XG4gICAgICAgICAgdm9pZCAoYXN5bmMgKCkgPT4ge1xuICAgICAgICAgICAgY29uc3QgZmlsZSA9IGhvc3QuYXBwLnZhdWx0LmdldEFic3RyYWN0RmlsZUJ5UGF0aChjb250ZXh0LnNvdXJjZVBhdGgpO1xuICAgICAgICAgICAgaWYgKCEoZmlsZSBpbnN0YW5jZW9mIFRGaWxlKSkgcmV0dXJuO1xuICAgICAgICAgICAgYXdhaXQgaG9zdC5hcHAudmF1bHQucHJvY2VzcyhmaWxlLCAoY29udGVudCkgPT4ge1xuICAgICAgICAgICAgICBjb25zdCBhbGxMaW5lcyA9IGNvbnRlbnQuc3BsaXQoXCJcXG5cIik7XG4gICAgICAgICAgICAgIGNvbnN0IG5ld0NlbGxzID0gc2NoZW1hLmNvbHVtbnMubWFwKChjb2wpID0+IHtcbiAgICAgICAgICAgICAgICBpZiAoY29sLmluZGV4ID09PSBkYXRlQ29sLmluZGV4KSByZXR1cm4gYCAke2RhdGVTdHJ9IGA7XG4gICAgICAgICAgICAgICAgcmV0dXJuIFwiICAgXCI7XG4gICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICBhbGxMaW5lcy5zcGxpY2Uoc2VjdGlvbkluZm8ubGluZUVuZCArIDEsIDAsIHNlcmlhbGl6ZVJvdyhuZXdDZWxscykpO1xuICAgICAgICAgICAgICByZXR1cm4gYWxsTGluZXMuam9pbihcIlxcblwiKTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgIH0pKCk7XG4gICAgICAgIH0pO1xuICAgICAgICBjZWxsLmNsYXNzTGlzdC5hZGQoXCJ6aWJhc2UtY2FsZW5kYXItY2VsbC1jbGlja2FibGVcIik7XG4gICAgICB9XG4gICAgfVxuICB9O1xuXG4gIHJlbmRlckNhbGVuZGFyKCk7XG59XG4iLCAiaW1wb3J0IHsgQ29tcG9uZW50LCBNYXJrZG93blJlbmRlckNoaWxkLCBNYXJrZG93blJlbmRlcmVyLCB0eXBlIE1hcmtkb3duUG9zdFByb2Nlc3NvckNvbnRleHQsIHR5cGUgTWFya2Rvd25TZWN0aW9uSW5mb3JtYXRpb24gfSBmcm9tIFwib2JzaWRpYW5cIjtcbmltcG9ydCB7IGZpbHRlckRhdGFSb3dzLCBwYXJzZUJvb2wsIHNwbGl0Um93IH0gZnJvbSBcIi4uL3NjaGVtYVwiO1xuaW1wb3J0IHR5cGUgeyBUYWJsZVNjaGVtYSwgWmlCYXNlSG9zdCB9IGZyb20gXCIuLi90eXBlc1wiO1xuaW1wb3J0IHsgZ2V0TGFiZWxDb2xvciB9IGZyb20gXCIuLi91aVwiO1xuXG5leHBvcnQgZnVuY3Rpb24gYnVpbGRHYWxsZXJ5VmlldyhcbiAgaG9zdDogWmlCYXNlSG9zdCxcbiAgYm9keTogSFRNTEVsZW1lbnQsXG4gIHNjaGVtYTogVGFibGVTY2hlbWEsXG4gIGdldERhdGFSb3dzOiAoKSA9PiBzdHJpbmdbXSxcbiAgX3Jhd0RhdGFMaW5lczogc3RyaW5nW10sXG4gIGNvbnRleHQ6IE1hcmtkb3duUG9zdFByb2Nlc3NvckNvbnRleHQsXG4gIF9zZWN0aW9uSW5mbzogTWFya2Rvd25TZWN0aW9uSW5mb3JtYXRpb24sXG4gIGZpbHRlclF1ZXJ5OiBzdHJpbmcsXG4pOiB2b2lkIHtcbiAgY29uc3QgZ2FsbGVyeSA9IGJvZHkuY3JlYXRlRGl2KFwiemliYXNlLWdhbGxlcnlcIik7XG4gIGNvbnN0IGRhdGFSb3dzID0gZmlsdGVyRGF0YVJvd3MoZ2V0RGF0YVJvd3MoKSwgZmlsdGVyUXVlcnkpO1xuXG4gIGlmIChkYXRhUm93cy5sZW5ndGggPT09IDApIHtcbiAgICBjb25zdCBlbXB0eSA9IGdhbGxlcnkuY3JlYXRlRGl2KFwiemliYXNlLWVtcHR5XCIpO1xuICAgIGVtcHR5LnRleHRDb250ZW50ID0gZmlsdGVyUXVlcnkgPyBcIk5vIG1hdGNoaW5nIHJvd3NcIiA6IFwiTm8gZGF0YVwiO1xuICAgIHJldHVybjtcbiAgfVxuXG4gIGNvbnN0IGdyaWQgPSBnYWxsZXJ5LmNyZWF0ZURpdihcInppYmFzZS1nYWxsZXJ5LWdyaWRcIik7XG5cbiAgZGF0YVJvd3MuZm9yRWFjaCgobGluZSkgPT4ge1xuICAgIGNvbnN0IGNlbGxzID0gc3BsaXRSb3cobGluZSk7XG4gICAgY29uc3QgY2FyZCA9IGdyaWQuY3JlYXRlRGl2KFwiemliYXNlLWdhbGxlcnktY2FyZFwiKTtcblxuICAgIGNvbnN0IHRpdGxlQ29sID0gc2NoZW1hLmNvbHVtbnMuZmluZCgoYykgPT4gYy50eXBlLmtpbmQgPT09IFwidGV4dFwiKTtcbiAgICBjb25zdCB0aXRsZVZhbHVlID0gdGl0bGVDb2wgPyAoY2VsbHNbdGl0bGVDb2wuaW5kZXhdIHx8IFwiXCIpLnRyaW0oKSA6IChjZWxsc1swXSB8fCBcIlwiKS50cmltKCk7XG4gICAgY29uc3QgdGl0bGVEaXYgPSBjYXJkLmNyZWF0ZURpdih7IGNsczogXCJ6aWJhc2UtZ2FsbGVyeS1jYXJkLXRpdGxlXCIgfSk7XG4gICAgY29uc3QgY29tcCA9IG5ldyBNYXJrZG93blJlbmRlckNoaWxkKHRpdGxlRGl2KTtcbiAgICBjb250ZXh0LmFkZENoaWxkKGNvbXApO1xuICAgIHZvaWQgTWFya2Rvd25SZW5kZXJlci5yZW5kZXIoaG9zdC5hcHAsIHRpdGxlVmFsdWUgfHwgXCJcdTIwMTRcIiwgdGl0bGVEaXYsIGNvbnRleHQuc291cmNlUGF0aCwgY29tcCk7XG5cbiAgICBjb25zdCBmaWVsZHNXcmFwID0gY2FyZC5jcmVhdGVEaXYoXCJ6aWJhc2UtZ2FsbGVyeS1jYXJkLWZpZWxkc1wiKTtcbiAgICBzY2hlbWEuY29sdW1ucy5mb3JFYWNoKChjb2wsIGNvbElkeCkgPT4ge1xuICAgICAgaWYgKHRpdGxlQ29sICYmIGNvbElkeCA9PT0gdGl0bGVDb2wuaW5kZXgpIHJldHVybjtcbiAgICAgIGNvbnN0IHJhd1ZhbHVlID0gKGNlbGxzW2NvbElkeF0gPz8gXCJcIikudHJpbSgpO1xuICAgICAgaWYgKCFyYXdWYWx1ZSAmJiBjb2wudHlwZS5raW5kICE9PSBcInRvZ2dsZVwiKSByZXR1cm47XG5cbiAgICAgIGNvbnN0IGZpZWxkID0gZmllbGRzV3JhcC5jcmVhdGVEaXYoXCJ6aWJhc2UtZ2FsbGVyeS1maWVsZFwiKTtcblxuICAgICAgaWYgKGNvbC50eXBlLmtpbmQgPT09IFwidG9nZ2xlXCIpIHtcbiAgICAgICAgZmllbGQuY3JlYXRlU3Bhbih7IHRleHQ6IHBhcnNlQm9vbChyYXdWYWx1ZSkgPyBcIlx1MjcwNVwiIDogXCJcdTJCMUNcIiB9KTtcbiAgICAgICAgZmllbGQuY3JlYXRlU3Bhbih7IHRleHQ6IFwiIFwiICsgY29sLm5hbWUsIGNsczogXCJ6aWJhc2UtZ2FsbGVyeS1maWVsZC1uYW1lXCIgfSk7XG4gICAgICB9IGVsc2UgaWYgKGNvbC50eXBlLmtpbmQgPT09IFwibGFiZWxcIikge1xuICAgICAgICBjb25zdCBjaGlwID0gZmllbGQuY3JlYXRlU3Bhbih7IHRleHQ6IHJhd1ZhbHVlLCBjbHM6IFwiemliYXNlLWxhYmVsXCIgfSk7XG4gICAgICAgIGNoaXAuc2V0Q3NzUHJvcHMoeyBcIi0tbGNcIjogZ2V0TGFiZWxDb2xvcihyYXdWYWx1ZSkgfSk7XG4gICAgICB9IGVsc2UgaWYgKGNvbC50eXBlLmtpbmQgPT09IFwic2VsZWN0XCIpIHtcbiAgICAgICAgZmllbGQuY3JlYXRlU3Bhbih7IHRleHQ6IHJhd1ZhbHVlLCBjbHM6IFwiemliYXNlLWdhbGxlcnktZmllbGQtc2VsZWN0XCIgfSk7XG4gICAgICB9IGVsc2UgaWYgKGNvbC50eXBlLmtpbmQgPT09IFwiZGF0ZVwiKSB7XG4gICAgICAgIGZpZWxkLmNyZWF0ZVNwYW4oeyB0ZXh0OiBcIlx1RDgzRFx1RENDNSBcIiwgY2xzOiBcInppYmFzZS1nYWxsZXJ5LWZpZWxkLWljb25cIiB9KTtcbiAgICAgICAgZmllbGQuY3JlYXRlU3Bhbih7IHRleHQ6IHJhd1ZhbHVlLCBjbHM6IFwiemliYXNlLWRhdGUtcmVuZGVyZWRcIiB9KTtcbiAgICAgIH0gZWxzZSBpZiAoY29sLnR5cGUua2luZCA9PT0gXCJudW1iZXJcIiB8fCBjb2wudHlwZS5raW5kID09PSBcImZvcm11bGFcIikge1xuICAgICAgICBmaWVsZC5jcmVhdGVTcGFuKHsgdGV4dDogY29sLm5hbWUgKyBcIjogXCIsIGNsczogXCJ6aWJhc2UtZ2FsbGVyeS1maWVsZC1uYW1lXCIgfSk7XG4gICAgICAgIGZpZWxkLmNyZWF0ZVNwYW4oeyB0ZXh0OiByYXdWYWx1ZSwgY2xzOiBcInppYmFzZS1nYWxsZXJ5LWZpZWxkLXZhbHVlXCIgfSk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBmaWVsZC5jcmVhdGVTcGFuKHsgdGV4dDogcmF3VmFsdWUsIGNsczogXCJ6aWJhc2UtZ2FsbGVyeS1maWVsZC12YWx1ZVwiIH0pO1xuICAgICAgfVxuICAgIH0pO1xuICB9KTtcbn1cbiIsICJpbXBvcnQgeyBDb21wb25lbnQsIE1hcmtkb3duUmVuZGVyQ2hpbGQsIE1hcmtkb3duUmVuZGVyZXIsIHR5cGUgTWFya2Rvd25Qb3N0UHJvY2Vzc29yQ29udGV4dCwgdHlwZSBNYXJrZG93blNlY3Rpb25JbmZvcm1hdGlvbiB9IGZyb20gXCJvYnNpZGlhblwiO1xuaW1wb3J0IHsgZmlsdGVyRGF0YVJvd3MsIHBhcnNlQm9vbCwgcGFyc2VNdWx0aVNlbGVjdCwgc3BsaXRSb3cgfSBmcm9tIFwiLi4vc2NoZW1hXCI7XG5pbXBvcnQgdHlwZSB7IFRhYmxlU2NoZW1hLCBaaUJhc2VIb3N0IH0gZnJvbSBcIi4uL3R5cGVzXCI7XG5pbXBvcnQgeyBnZXRMYWJlbENvbG9yIH0gZnJvbSBcIi4uL3VpXCI7XG5cbmV4cG9ydCBmdW5jdGlvbiBidWlsZEthbmJhblZpZXcoXG4gIGhvc3Q6IFppQmFzZUhvc3QsXG4gIGJvZHk6IEhUTUxFbGVtZW50LFxuICBzY2hlbWE6IFRhYmxlU2NoZW1hLFxuICBnZXREYXRhUm93czogKCkgPT4gc3RyaW5nW10sXG4gIHJhd0RhdGFMaW5lczogc3RyaW5nW10sXG4gIGNvbnRleHQ6IE1hcmtkb3duUG9zdFByb2Nlc3NvckNvbnRleHQsXG4gIHNlY3Rpb25JbmZvOiBNYXJrZG93blNlY3Rpb25JbmZvcm1hdGlvbixcbiAgZmlsdGVyUXVlcnk6IHN0cmluZyxcbiAgZ3JvdXBCeT86IHN0cmluZyxcbik6IHZvaWQge1xuICBsZXQgZ3JvdXBDb2wgPSBncm91cEJ5XG4gICAgPyBzY2hlbWEuY29sdW1ucy5maW5kKChjKSA9PiBjLm5hbWUudG9Mb3dlckNhc2UoKSA9PT0gZ3JvdXBCeS50b0xvd2VyQ2FzZSgpKVxuICAgIDogdW5kZWZpbmVkO1xuICBpZiAoIWdyb3VwQ29sKSB7XG4gICAgZ3JvdXBDb2wgPSBzY2hlbWEuY29sdW1ucy5maW5kKFxuICAgICAgKGMpID0+IGMudHlwZS5raW5kID09PSBcInNlbGVjdFwiIHx8IGMudHlwZS5raW5kID09PSBcImxhYmVsXCIgfHwgYy50eXBlLmtpbmQgPT09IFwibXVsdGktc2VsZWN0XCIsXG4gICAgKTtcbiAgfVxuICBpZiAoIWdyb3VwQ29sKSB7XG4gICAgY29uc3Qgbm90aWNlID0gYm9keS5jcmVhdGVEaXYoXCJ6aWJhc2Uta2FuYmFuIHppYmFzZS1rYW5iYW4tbm90aWNlXCIpO1xuICAgIG5vdGljZS50ZXh0Q29udGVudCA9IGdyb3VwQnlcbiAgICAgID8gYEthbmJhbjogQ29sdW1uIFwiJHtncm91cEJ5fVwiIG5vdCBmb3VuZC5gXG4gICAgICA6IFwiS2FuYmFuIHJlcXVpcmVzIGEgU2VsZWN0IG9yIExhYmVsIGNvbHVtbiB0byBncm91cCBieS5cIjtcbiAgICByZXR1cm47XG4gIH1cblxuICBjb25zdCBrYW5iYW4gPSBib2R5LmNyZWF0ZURpdihcInppYmFzZS1rYW5iYW5cIik7XG4gIGNvbnN0IGRhdGFSb3dzID0gZmlsdGVyRGF0YVJvd3MoZ2V0RGF0YVJvd3MoKSwgZmlsdGVyUXVlcnkpO1xuXG4gIGNvbnN0IGdyb3VwcyA9IG5ldyBNYXA8c3RyaW5nLCB7IGxpbmU6IHN0cmluZzsgY2VsbHM6IHN0cmluZ1tdIH1bXT4oKTtcbiAgZGF0YVJvd3MuZm9yRWFjaCgobGluZSkgPT4ge1xuICAgIGNvbnN0IGNlbGxzID0gc3BsaXRSb3cobGluZSk7XG4gICAgY29uc3QgcmF3R3JvdXBWYWx1ZSA9IChjZWxsc1tncm91cENvbC5pbmRleF0gPz8gXCJcIikudHJpbSgpIHx8IFwiXHUyMDE0XCI7XG4gICAgbGV0IGdyb3VwVmFsdWVzID0gW3Jhd0dyb3VwVmFsdWVdO1xuICAgIGlmIChncm91cENvbC50eXBlLmtpbmQgPT09IFwibXVsdGktc2VsZWN0XCIgJiYgcmF3R3JvdXBWYWx1ZSAhPT0gXCJcdTIwMTRcIikge1xuICAgICAgZ3JvdXBWYWx1ZXMgPSBwYXJzZU11bHRpU2VsZWN0KHJhd0dyb3VwVmFsdWUpO1xuICAgICAgaWYgKGdyb3VwVmFsdWVzLmxlbmd0aCA9PT0gMCkgZ3JvdXBWYWx1ZXMgPSBbXCJcdTIwMTRcIl07XG4gICAgfVxuICAgIGdyb3VwVmFsdWVzLmZvckVhY2goKGd2KSA9PiB7XG4gICAgICBpZiAoIWdyb3Vwcy5oYXMoZ3YpKSBncm91cHMuc2V0KGd2LCBbXSk7XG4gICAgICBncm91cHMuZ2V0KGd2KSEucHVzaCh7IGxpbmUsIGNlbGxzIH0pO1xuICAgIH0pO1xuICB9KTtcblxuICBsZXQgZ3JvdXBLZXlzOiBzdHJpbmdbXTtcbiAgaWYgKGdyb3VwQ29sLnR5cGUua2luZCA9PT0gXCJzZWxlY3RcIiAmJiBncm91cENvbC50eXBlLm9wdGlvbnMpIHtcbiAgICBncm91cEtleXMgPSBbLi4uZ3JvdXBDb2wudHlwZS5vcHRpb25zXTtcbiAgICBmb3IgKGNvbnN0IGtleSBvZiBncm91cHMua2V5cygpKSB7XG4gICAgICBpZiAoIWdyb3VwS2V5cy5pbmNsdWRlcyhrZXkpKSBncm91cEtleXMucHVzaChrZXkpO1xuICAgIH1cbiAgfSBlbHNlIHtcbiAgICBncm91cEtleXMgPSBbLi4uZ3JvdXBzLmtleXMoKV07XG4gIH1cblxuICBjb25zdCBsYW5lQ29udGFpbmVyID0ga2FuYmFuLmNyZWF0ZURpdihcInppYmFzZS1rYW5iYW4tbGFuZXNcIik7XG5cbiAgZ3JvdXBLZXlzLmZvckVhY2goKGdyb3VwVmFsdWUpID0+IHtcbiAgICBjb25zdCBpdGVtcyA9IGdyb3Vwcy5nZXQoZ3JvdXBWYWx1ZSkgfHwgW107XG4gICAgY29uc3QgbGFuZSA9IGxhbmVDb250YWluZXIuY3JlYXRlRGl2KFwiemliYXNlLWthbmJhbi1sYW5lXCIpO1xuICAgIGNvbnN0IGNvbG9yID0gZ2V0TGFiZWxDb2xvcihncm91cFZhbHVlKTtcblxuICAgIGNvbnN0IGhlYWRlciA9IGxhbmUuY3JlYXRlRGl2KFwiemliYXNlLWthbmJhbi1sYW5lLWhlYWRlclwiKTtcbiAgICBoZWFkZXIuc2V0Q3NzUHJvcHMoeyBcIi0tbGFuZS1jb2xvclwiOiBjb2xvciB9KTtcbiAgICBjb25zdCBoZWFkZXJMYWJlbCA9IGhlYWRlci5jcmVhdGVTcGFuKHsgdGV4dDogZ3JvdXBWYWx1ZSwgY2xzOiBcInppYmFzZS1rYW5iYW4tbGFuZS10aXRsZVwiIH0pO1xuICAgIGhlYWRlckxhYmVsLnNldENzc1N0eWxlcyh7IGNvbG9yIH0pO1xuICAgIGhlYWRlci5jcmVhdGVTcGFuKHsgdGV4dDogYCR7aXRlbXMubGVuZ3RofWAsIGNsczogXCJ6aWJhc2Uta2FuYmFuLWxhbmUtY291bnRcIiB9KTtcblxuICAgIGNvbnN0IGxhbmVCb2R5ID0gbGFuZS5jcmVhdGVEaXYoXCJ6aWJhc2Uta2FuYmFuLWxhbmUtYm9keVwiKTtcbiAgICBsYW5lQm9keS5kYXRhc2V0Lmdyb3VwID0gZ3JvdXBWYWx1ZTtcblxuICAgIGxhbmVCb2R5LmFkZEV2ZW50TGlzdGVuZXIoXCJkcmFnb3ZlclwiLCAoZSkgPT4ge1xuICAgICAgZS5wcmV2ZW50RGVmYXVsdCgpO1xuICAgICAgbGFuZUJvZHkuY2xhc3NMaXN0LmFkZChcInppYmFzZS1rYW5iYW4tbGFuZS1kcmFnb3ZlclwiKTtcbiAgICB9KTtcbiAgICBsYW5lQm9keS5hZGRFdmVudExpc3RlbmVyKFwiZHJhZ2xlYXZlXCIsICgpID0+IHtcbiAgICAgIGxhbmVCb2R5LmNsYXNzTGlzdC5yZW1vdmUoXCJ6aWJhc2Uta2FuYmFuLWxhbmUtZHJhZ292ZXJcIik7XG4gICAgfSk7XG4gICAgbGFuZUJvZHkuYWRkRXZlbnRMaXN0ZW5lcihcImRyb3BcIiwgKGUpID0+IHtcbiAgICAgIGUucHJldmVudERlZmF1bHQoKTtcbiAgICAgIGxhbmVCb2R5LmNsYXNzTGlzdC5yZW1vdmUoXCJ6aWJhc2Uta2FuYmFuLWxhbmUtZHJhZ292ZXJcIik7XG4gICAgICBjb25zdCBmcm9tSWR4U3RyID0gZS5kYXRhVHJhbnNmZXI/LmdldERhdGEoXCJ0ZXh0L2thbmJhbi1yb3dcIik7XG4gICAgICBpZiAoIWZyb21JZHhTdHIpIHJldHVybjtcbiAgICAgIGNvbnN0IGZyb21JZHggPSBwYXJzZUludChmcm9tSWR4U3RyLCAxMCk7XG4gICAgICBsZXQgbmV3VmFsdWUgPSBncm91cFZhbHVlO1xuICAgICAgaWYgKGdyb3VwQ29sLnR5cGUua2luZCA9PT0gXCJtdWx0aS1zZWxlY3RcIikge1xuICAgICAgICBjb25zdCByb3dMaW5lID0gcmF3RGF0YUxpbmVzW2Zyb21JZHhdO1xuICAgICAgICBjb25zdCByb3dDZWxscyA9IHNwbGl0Um93KHJvd0xpbmUpO1xuICAgICAgICBjb25zdCBjdXJyZW50UmF3ID0gKHJvd0NlbGxzW2dyb3VwQ29sLmluZGV4XSB8fCBcIlwiKS50cmltKCk7XG4gICAgICAgIGNvbnN0IHRhZ3MgPSBwYXJzZU11bHRpU2VsZWN0KGN1cnJlbnRSYXcpO1xuICAgICAgICBpZiAoIXRhZ3MuaW5jbHVkZXMoZ3JvdXBWYWx1ZSkpIHRhZ3MucHVzaChncm91cFZhbHVlKTtcbiAgICAgICAgbmV3VmFsdWUgPSB0YWdzLmpvaW4oXCIsIFwiKTtcbiAgICAgIH1cbiAgICAgIHZvaWQgaG9zdC53cml0ZUJhY2soY29udGV4dCwgc2VjdGlvbkluZm8sIHNjaGVtYS5kYXRhU3RhcnRJbmRleCArIGZyb21JZHgsIGdyb3VwQ29sLmluZGV4LCBuZXdWYWx1ZSk7XG4gICAgfSk7XG5cbiAgICBpdGVtcy5mb3JFYWNoKCh7IGxpbmUsIGNlbGxzIH0pID0+IHtcbiAgICAgIGNvbnN0IHJhd0lkeCA9IHJhd0RhdGFMaW5lcy5maW5kSW5kZXgoKGwpID0+IGwgPT09IGxpbmUpO1xuICAgICAgY29uc3QgY2FyZCA9IGxhbmVCb2R5LmNyZWF0ZURpdihcInppYmFzZS1rYW5iYW4tY2FyZFwiKTtcbiAgICAgIGNhcmQuZHJhZ2dhYmxlID0gdHJ1ZTtcbiAgICAgIGNhcmQuYWRkRXZlbnRMaXN0ZW5lcihcImRyYWdzdGFydFwiLCAoZSkgPT4ge1xuICAgICAgICBlLmRhdGFUcmFuc2Zlcj8uc2V0RGF0YShcInRleHQva2FuYmFuLXJvd1wiLCByYXdJZHgudG9TdHJpbmcoKSk7XG4gICAgICAgIGNhcmQuY2xhc3NMaXN0LmFkZChcInppYmFzZS1rYW5iYW4tY2FyZC1kcmFnZ2luZ1wiKTtcbiAgICAgIH0pO1xuICAgICAgY2FyZC5hZGRFdmVudExpc3RlbmVyKFwiZHJhZ2VuZFwiLCAoKSA9PiB7XG4gICAgICAgIGNhcmQuY2xhc3NMaXN0LnJlbW92ZShcInppYmFzZS1rYW5iYW4tY2FyZC1kcmFnZ2luZ1wiKTtcbiAgICAgIH0pO1xuXG4gICAgICBzY2hlbWEuY29sdW1ucy5mb3JFYWNoKChjb2wsIGNvbElkeCkgPT4ge1xuICAgICAgICBpZiAoY29sSWR4ID09PSBncm91cENvbC5pbmRleCkgcmV0dXJuO1xuICAgICAgICBjb25zdCByYXdWYWx1ZSA9IChjZWxsc1tjb2xJZHhdID8/IFwiXCIpLnRyaW0oKTtcbiAgICAgICAgaWYgKCFyYXdWYWx1ZSkgcmV0dXJuO1xuXG4gICAgICAgIGlmIChjb2wudHlwZS5raW5kID09PSBcInRleHRcIikge1xuICAgICAgICAgIGlmICghY2FyZC5xdWVyeVNlbGVjdG9yKFwiLnppYmFzZS1rYW5iYW4tY2FyZC10aXRsZVwiKSkge1xuICAgICAgICAgICAgY29uc3QgdGl0bGVFbCA9IGNhcmQuY3JlYXRlRGl2KFwiemliYXNlLWthbmJhbi1jYXJkLXRpdGxlXCIpO1xuICAgICAgICAgICAgY29uc3QgY29tcCA9IG5ldyBNYXJrZG93blJlbmRlckNoaWxkKHRpdGxlRWwpO1xuICAgICAgICAgICAgY29udGV4dC5hZGRDaGlsZChjb21wKTtcbiAgICAgICAgICAgIHZvaWQgTWFya2Rvd25SZW5kZXJlci5yZW5kZXIoaG9zdC5hcHAsIHJhd1ZhbHVlLCB0aXRsZUVsLCBjb250ZXh0LnNvdXJjZVBhdGgsIGNvbXApO1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIGNvbnN0IGZpZWxkID0gY2FyZC5jcmVhdGVEaXYoXCJ6aWJhc2Uta2FuYmFuLWNhcmQtZmllbGRcIik7XG4gICAgICAgIGZpZWxkLmNyZWF0ZVNwYW4oeyB0ZXh0OiBjb2wubmFtZSwgY2xzOiBcInppYmFzZS1rYW5iYW4tZmllbGQtbGFiZWxcIiB9KTtcblxuICAgICAgICBpZiAoY29sLnR5cGUua2luZCA9PT0gXCJsYWJlbFwiKSB7XG4gICAgICAgICAgY29uc3QgY2hpcCA9IGZpZWxkLmNyZWF0ZVNwYW4oeyB0ZXh0OiByYXdWYWx1ZSwgY2xzOiBcInppYmFzZS1sYWJlbCB6aWJhc2Uta2FuYmFuLWxhYmVsXCIgfSk7XG4gICAgICAgICAgY2hpcC5zZXRDc3NQcm9wcyh7IFwiLS1sY1wiOiBnZXRMYWJlbENvbG9yKHJhd1ZhbHVlKSB9KTtcbiAgICAgICAgfSBlbHNlIGlmIChjb2wudHlwZS5raW5kID09PSBcInRvZ2dsZVwiKSB7XG4gICAgICAgICAgZmllbGQuY3JlYXRlU3Bhbih7IHRleHQ6IHBhcnNlQm9vbChyYXdWYWx1ZSkgPyBcIlx1MjcwNVwiIDogXCJcdTJCMUNcIiwgY2xzOiBcInppYmFzZS1rYW5iYW4tZmllbGQtdmFsdWVcIiB9KTtcbiAgICAgICAgfSBlbHNlIGlmIChjb2wudHlwZS5raW5kID09PSBcIm51bWJlclwiIHx8IGNvbC50eXBlLmtpbmQgPT09IFwiZm9ybXVsYVwiKSB7XG4gICAgICAgICAgZmllbGQuY3JlYXRlU3Bhbih7IHRleHQ6IHJhd1ZhbHVlLCBjbHM6IFwiemliYXNlLWthbmJhbi1maWVsZC12YWx1ZVwiIH0pO1xuICAgICAgICB9IGVsc2UgaWYgKGNvbC50eXBlLmtpbmQgPT09IFwiZGF0ZVwiKSB7XG4gICAgICAgICAgZmllbGQuY3JlYXRlU3Bhbih7IHRleHQ6IHJhd1ZhbHVlLCBjbHM6IFwiemliYXNlLWthbmJhbi1maWVsZC12YWx1ZSB6aWJhc2UtZGF0ZS1yZW5kZXJlZFwiIH0pO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIGZpZWxkLmNyZWF0ZVNwYW4oeyB0ZXh0OiByYXdWYWx1ZSwgY2xzOiBcInppYmFzZS1rYW5iYW4tZmllbGQtdmFsdWVcIiB9KTtcbiAgICAgICAgfVxuICAgICAgfSk7XG5cbiAgICAgIGlmICghY2FyZC5xdWVyeVNlbGVjdG9yKFwiLnppYmFzZS1rYW5iYW4tY2FyZC10aXRsZVwiKSkge1xuICAgICAgICBjb25zdCB0aXRsZUVsID0gY3JlYXRlRGl2KCk7XG4gICAgICAgIHRpdGxlRWwuY2xhc3NOYW1lID0gXCJ6aWJhc2Uta2FuYmFuLWNhcmQtdGl0bGVcIjtcbiAgICAgICAgY29uc3QgY29tcCA9IG5ldyBNYXJrZG93blJlbmRlckNoaWxkKHRpdGxlRWwpO1xuICAgICAgICBjb250ZXh0LmFkZENoaWxkKGNvbXApO1xuICAgICAgICB2b2lkIE1hcmtkb3duUmVuZGVyZXIucmVuZGVyKGhvc3QuYXBwLCBjZWxsc1swXSB8fCBcIlx1MjAxNFwiLCB0aXRsZUVsLCBjb250ZXh0LnNvdXJjZVBhdGgsIGNvbXApO1xuICAgICAgICBjYXJkLmluc2VydEJlZm9yZSh0aXRsZUVsLCBjYXJkLmZpcnN0Q2hpbGQpO1xuICAgICAgfVxuICAgIH0pO1xuICB9KTtcbn1cbiIsICJpbXBvcnQgeyBURmlsZSwgdHlwZSBNYXJrZG93blBvc3RQcm9jZXNzb3JDb250ZXh0LCB0eXBlIE1hcmtkb3duU2VjdGlvbkluZm9ybWF0aW9uIH0gZnJvbSBcIm9ic2lkaWFuXCI7XG5pbXBvcnQgeyBmb3JtYXRSZXN1bHQgfSBmcm9tIFwiLi4vZm9ybXVsYVwiO1xuaW1wb3J0IHsgZmlsdGVyRGF0YVJvd3MsIHNlcmlhbGl6ZVJvdywgc3BsaXRSb3cgfSBmcm9tIFwiLi4vc2NoZW1hXCI7XG5pbXBvcnQgdHlwZSB7IFRhYmxlU2NoZW1hLCBaaUJhc2VIb3N0IH0gZnJvbSBcIi4uL3R5cGVzXCI7XG5pbXBvcnQgeyBnZXRUeXBlSWNvbiB9IGZyb20gXCIuLi91aVwiO1xuXG5pbnRlcmZhY2UgU3RhdFRoIGV4dGVuZHMgSFRNTFRhYmxlQ2VsbEVsZW1lbnQge1xuICBfdXBkYXRlU3RhdD86ICgpID0+IHZvaWQ7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBidWlsZFRhYmxlVmlldyhcbiAgaG9zdDogWmlCYXNlSG9zdCxcbiAgYm9keTogSFRNTEVsZW1lbnQsXG4gIHNjaGVtYTogVGFibGVTY2hlbWEsXG4gIGdldERhdGFSb3dzOiAoKSA9PiBzdHJpbmdbXSxcbiAgcmF3RGF0YUxpbmVzOiBzdHJpbmdbXSxcbiAgY29udGV4dDogTWFya2Rvd25Qb3N0UHJvY2Vzc29yQ29udGV4dCxcbiAgc2VjdGlvbkluZm86IE1hcmtkb3duU2VjdGlvbkluZm9ybWF0aW9uLFxuICBmaWx0ZXJRdWVyeTogc3RyaW5nLFxuICBzb3J0Q29sSWR4OiBudW1iZXIgfCBudWxsLFxuICBzb3J0QXNjOiBib29sZWFuLFxuICBiYWRnZTogSFRNTEVsZW1lbnQsXG4gIG9uU29ydENoYW5nZTogKGNvbDogbnVtYmVyLCBhc2M6IGJvb2xlYW4pID0+IHZvaWQsXG4pOiB2b2lkIHtcbiAgY29uc3QgdGFibGVFbCA9IGJvZHkuY3JlYXRlRWwoXCJ0YWJsZVwiLCB7IGNsczogXCJ6aWJhc2UtdGFibGVcIiB9KTtcbiAgY29uc3QgdGhlYWQgPSB0YWJsZUVsLmNyZWF0ZUVsKFwidGhlYWRcIik7XG4gIGNvbnN0IGhlYWRlclJvdyA9IHRoZWFkLmNyZWF0ZUVsKFwidHJcIik7XG4gIGNvbnN0IHN0YXRNb2RlczogUmVjb3JkPG51bWJlciwgc3RyaW5nPiA9IHt9O1xuXG4gIHNjaGVtYS5jb2x1bW5zLmZvckVhY2goKGNvbCwgY29sSWR4KSA9PiB7XG4gICAgY29uc3QgdGggPSBoZWFkZXJSb3cuY3JlYXRlRWwoXCJ0aFwiLCB7IGNsczogXCJ6aWJhc2UtdGhcIiB9KSBhcyBTdGF0VGg7XG4gICAgdGguZHJhZ2dhYmxlID0gdHJ1ZTtcbiAgICB0aC5hZGRFdmVudExpc3RlbmVyKFwiZHJhZ3N0YXJ0XCIsIChlKSA9PiB7XG4gICAgICBlLnN0b3BQcm9wYWdhdGlvbigpO1xuICAgICAgZS5kYXRhVHJhbnNmZXI/LnNldERhdGEoXCJ0ZXh0L2NvbFwiLCBjb2xJZHgudG9TdHJpbmcoKSk7XG4gICAgfSk7XG4gICAgdGguYWRkRXZlbnRMaXN0ZW5lcihcImRyYWdvdmVyXCIsIChlKSA9PiB7XG4gICAgICBlLnByZXZlbnREZWZhdWx0KCk7XG4gICAgICB0aC5jbGFzc0xpc3QuYWRkKFwiemliYXNlLXRoLWRyb3AtdGFyZ2V0XCIpO1xuICAgIH0pO1xuICAgIHRoLmFkZEV2ZW50TGlzdGVuZXIoXCJkcmFnbGVhdmVcIiwgKCkgPT4gdGguY2xhc3NMaXN0LnJlbW92ZShcInppYmFzZS10aC1kcm9wLXRhcmdldFwiKSk7XG4gICAgdGguYWRkRXZlbnRMaXN0ZW5lcihcImRyYWdlbmRcIiwgKCkgPT4ge1xuICAgICAgdGhlYWQucXVlcnlTZWxlY3RvckFsbChcIi56aWJhc2UtdGhcIikuZm9yRWFjaCgoZWwpID0+IGVsLmNsYXNzTGlzdC5yZW1vdmUoXCJ6aWJhc2UtdGgtZHJvcC10YXJnZXRcIikpO1xuICAgIH0pO1xuICAgIHRoLmFkZEV2ZW50TGlzdGVuZXIoXCJkcm9wXCIsIChlKSA9PiB7XG4gICAgICBlLnByZXZlbnREZWZhdWx0KCk7XG4gICAgICBlLnN0b3BQcm9wYWdhdGlvbigpO1xuICAgICAgdGguY2xhc3NMaXN0LnJlbW92ZShcInppYmFzZS10aC1kcm9wLXRhcmdldFwiKTtcbiAgICAgIGNvbnN0IGZyb21Db2xTdHIgPSBlLmRhdGFUcmFuc2Zlcj8uZ2V0RGF0YShcInRleHQvY29sXCIpO1xuICAgICAgaWYgKCFmcm9tQ29sU3RyKSByZXR1cm47XG4gICAgICBjb25zdCBmcm9tQ29sSWR4ID0gcGFyc2VJbnQoZnJvbUNvbFN0ciwgMTApO1xuICAgICAgaWYgKGZyb21Db2xJZHggPT09IGNvbElkeCkgcmV0dXJuO1xuICAgICAgdm9pZCAoYXN5bmMgKCkgPT4ge1xuICAgICAgICBjb25zdCBmaWxlID0gaG9zdC5hcHAudmF1bHQuZ2V0QWJzdHJhY3RGaWxlQnlQYXRoKGNvbnRleHQuc291cmNlUGF0aCk7XG4gICAgICAgIGlmICghKGZpbGUgaW5zdGFuY2VvZiBURmlsZSkpIHJldHVybjtcbiAgICAgICAgYXdhaXQgaG9zdC5hcHAudmF1bHQucHJvY2VzcyhmaWxlLCAoY29udGVudCkgPT4ge1xuICAgICAgICAgIGNvbnN0IGFsbExpbmVzID0gY29udGVudC5zcGxpdChcIlxcblwiKTtcbiAgICAgICAgICBmb3IgKGxldCBpID0gc2VjdGlvbkluZm8ubGluZVN0YXJ0OyBpIDw9IHNlY3Rpb25JbmZvLmxpbmVFbmQ7IGkrKykge1xuICAgICAgICAgICAgY29uc3QgbGluZSA9IGFsbExpbmVzW2ldO1xuICAgICAgICAgICAgaWYgKCFsaW5lLmluY2x1ZGVzKFwifFwiKSkgY29udGludWU7XG4gICAgICAgICAgICBjb25zdCBjZWxscyA9IHNwbGl0Um93KGxpbmUpO1xuICAgICAgICAgICAgaWYgKGNlbGxzLmxlbmd0aCA8PSBmcm9tQ29sSWR4IHx8IGNlbGxzLmxlbmd0aCA8PSBjb2xJZHgpIGNvbnRpbnVlO1xuICAgICAgICAgICAgY29uc3QgZHJhZ2dlZENlbGwgPSBjZWxscy5zcGxpY2UoZnJvbUNvbElkeCwgMSlbMF07XG4gICAgICAgICAgICBsZXQgaW5zZXJ0SWR4ID0gY29sSWR4O1xuICAgICAgICAgICAgaWYgKGZyb21Db2xJZHggPCBjb2xJZHgpIGluc2VydElkeC0tO1xuICAgICAgICAgICAgY2VsbHMuc3BsaWNlKGluc2VydElkeCwgMCwgZHJhZ2dlZENlbGwpO1xuICAgICAgICAgICAgYWxsTGluZXNbaV0gPSBzZXJpYWxpemVSb3coY2VsbHMpO1xuICAgICAgICAgIH1cbiAgICAgICAgICByZXR1cm4gYWxsTGluZXMuam9pbihcIlxcblwiKTtcbiAgICAgICAgfSk7XG4gICAgICB9KSgpO1xuICAgIH0pO1xuXG4gICAgY29uc3QgdGhJbm5lciA9IHRoLmNyZWF0ZURpdihcInppYmFzZS10aC1pbm5lclwiKTtcbiAgICB0aElubmVyLmNyZWF0ZVNwYW4oeyB0ZXh0OiBjb2wubmFtZSwgY2xzOiBcInppYmFzZS10aC1uYW1lXCIgfSk7XG4gICAgdGhJbm5lci5jcmVhdGVTcGFuKHsgdGV4dDogZ2V0VHlwZUljb24oY29sLnR5cGUpLCBjbHM6IFwiemliYXNlLXR5cGUtaWNvblwiIH0pO1xuICAgIHRoSW5uZXIuY3JlYXRlU3Bhbih7IGNsczogXCJ6aWJhc2Utc29ydC1hcnJvd1wiLCB0ZXh0OiBcIlx1MjE5NVwiIH0pO1xuXG4gICAgaWYgKGNvbC50eXBlLmtpbmQgPT09IFwibnVtYmVyXCIgfHwgY29sLnR5cGUua2luZCA9PT0gXCJmb3JtdWxhXCIpIHtcbiAgICAgIGlmICghc3RhdE1vZGVzW2NvbElkeF0pIHN0YXRNb2Rlc1tjb2xJZHhdID0gXCJTVU1cIjtcbiAgICAgIGNvbnN0IHN0YXRCYWRnZSA9IHRoLmNyZWF0ZURpdihcInppYmFzZS10aC1zdGF0XCIpO1xuXG4gICAgICBjb25zdCB1cGRhdGVUaFN0YXQgPSAoKSA9PiB7XG4gICAgICAgIGNvbnN0IGRhdGFSb3dzID0gZmlsdGVyRGF0YVJvd3MoZ2V0RGF0YVJvd3MoKSwgZmlsdGVyUXVlcnkpO1xuICAgICAgICBjb25zdCB2YWx1ZXMgPSBkYXRhUm93c1xuICAgICAgICAgIC5tYXAoKGxpbmUpID0+IHBhcnNlRmxvYXQoKHNwbGl0Um93KGxpbmUpW2NvbElkeF0gPz8gXCJcIikudHJpbSgpKSlcbiAgICAgICAgICAuZmlsdGVyKChuKSA9PiAhTnVtYmVyLmlzTmFOKG4pKTtcblxuICAgICAgICBpZiAodmFsdWVzLmxlbmd0aCA9PT0gMCkge1xuICAgICAgICAgIHN0YXRCYWRnZS50ZXh0Q29udGVudCA9IFwiXCI7XG4gICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG5cbiAgICAgICAgY29uc3QgbW9kZSA9IHN0YXRNb2Rlc1tjb2xJZHhdO1xuICAgICAgICBsZXQgcmVzdWx0ID0gMDtcbiAgICAgICAgc3dpdGNoIChtb2RlKSB7XG4gICAgICAgICAgY2FzZSBcIlNVTVwiOiByZXN1bHQgPSB2YWx1ZXMucmVkdWNlKChhLCBiKSA9PiBhICsgYiwgMCk7IGJyZWFrO1xuICAgICAgICAgIGNhc2UgXCJBVkdcIjogcmVzdWx0ID0gdmFsdWVzLnJlZHVjZSgoYSwgYikgPT4gYSArIGIsIDApIC8gdmFsdWVzLmxlbmd0aDsgYnJlYWs7XG4gICAgICAgICAgY2FzZSBcIk1JTlwiOiByZXN1bHQgPSBNYXRoLm1pbiguLi52YWx1ZXMpOyBicmVhaztcbiAgICAgICAgICBjYXNlIFwiTUFYXCI6IHJlc3VsdCA9IE1hdGgubWF4KC4uLnZhbHVlcyk7IGJyZWFrO1xuICAgICAgICAgIGRlZmF1bHQ6IHJlc3VsdCA9IDA7XG4gICAgICAgIH1cblxuICAgICAgICBzdGF0QmFkZ2UuZW1wdHkoKTtcbiAgICAgICAgc3RhdEJhZGdlLmNyZWF0ZVNwYW4oeyB0ZXh0OiBtb2RlLCBjbHM6IFwiemliYXNlLXRoLXN0YXQtbW9kZVwiIH0pO1xuICAgICAgICBzdGF0QmFkZ2UuY3JlYXRlU3Bhbih7IHRleHQ6IFwiIFwiICsgZm9ybWF0UmVzdWx0KHJlc3VsdCksIGNsczogXCJ6aWJhc2UtdGgtc3RhdC12YWx1ZVwiIH0pO1xuICAgICAgfTtcblxuICAgICAgc3RhdEJhZGdlLmFkZEV2ZW50TGlzdGVuZXIoXCJjbGlja1wiLCAoZSkgPT4ge1xuICAgICAgICBlLnN0b3BQcm9wYWdhdGlvbigpO1xuICAgICAgICBjb25zdCBtb2RlcyA9IFtcIlNVTVwiLCBcIkFWR1wiLCBcIk1JTlwiLCBcIk1BWFwiXTtcbiAgICAgICAgY29uc3QgY3VycmVudCA9IG1vZGVzLmluZGV4T2Yoc3RhdE1vZGVzW2NvbElkeF0pO1xuICAgICAgICBzdGF0TW9kZXNbY29sSWR4XSA9IG1vZGVzWyhjdXJyZW50ICsgMSkgJSBtb2Rlcy5sZW5ndGhdO1xuICAgICAgICB1cGRhdGVUaFN0YXQoKTtcbiAgICAgIH0pO1xuXG4gICAgICB0aC5fdXBkYXRlU3RhdCA9IHVwZGF0ZVRoU3RhdDtcbiAgICAgIHVwZGF0ZVRoU3RhdCgpO1xuICAgIH1cblxuICAgIHRoLmFkZEV2ZW50TGlzdGVuZXIoXCJjbGlja1wiLCAoKSA9PiB7XG4gICAgICBjb25zdCBuZXdBc2MgPSBzb3J0Q29sSWR4ID09PSBjb2xJZHggPyAhc29ydEFzYyA6IHRydWU7XG4gICAgICBvblNvcnRDaGFuZ2UoY29sSWR4LCBuZXdBc2MpO1xuICAgICAgdGhlYWQucXVlcnlTZWxlY3RvckFsbChcIi56aWJhc2Utc29ydC1hcnJvd1wiKS5mb3JFYWNoKChlbCwgaSkgPT4ge1xuICAgICAgICBlbC50ZXh0Q29udGVudCA9IGkgPT09IGNvbElkeCA/IChuZXdBc2MgPyBcIlx1MjE5MVwiIDogXCJcdTIxOTNcIikgOiBcIlx1MjE5NVwiO1xuICAgICAgICBlbC5jbGFzc0xpc3QudG9nZ2xlKFwiemliYXNlLXNvcnQtYWN0aXZlXCIsIGkgPT09IGNvbElkeCk7XG4gICAgICB9KTtcbiAgICAgIHJlbmRlclJvd3MoKTtcbiAgICAgIHRoZWFkLnF1ZXJ5U2VsZWN0b3JBbGwoXCIuemliYXNlLXRoXCIpLmZvckVhY2goKHRoRWwpID0+IHtcbiAgICAgICAgY29uc3Qgc3RhdFRoID0gdGhFbCBhcyBTdGF0VGg7XG4gICAgICAgIGlmIChzdGF0VGguX3VwZGF0ZVN0YXQpIHN0YXRUaC5fdXBkYXRlU3RhdCgpO1xuICAgICAgfSk7XG4gICAgfSk7XG4gICAgdGguYWRkRXZlbnRMaXN0ZW5lcihcImNvbnRleHRtZW51XCIsIChlKSA9PiB7XG4gICAgICBlLnByZXZlbnREZWZhdWx0KCk7XG4gICAgICBob3N0LnNob3dUeXBlTWVudShlLCBjb2xJZHgsIHNjaGVtYSwgY29udGV4dCwgc2VjdGlvbkluZm8sIHJhd0RhdGFMaW5lcywgYmFkZ2UpO1xuICAgIH0pO1xuICB9KTtcblxuICBjb25zdCB0Ym9keSA9IHRhYmxlRWwuY3JlYXRlRWwoXCJ0Ym9keVwiKTtcblxuICBjb25zdCByZW5kZXJSb3dzID0gKCkgPT4ge1xuICAgIHRib2R5LmVtcHR5KCk7XG4gICAgbGV0IGRhdGFSb3dzID0gZmlsdGVyRGF0YVJvd3MoZ2V0RGF0YVJvd3MoKSwgZmlsdGVyUXVlcnkpO1xuICAgIGlmIChzb3J0Q29sSWR4ICE9PSBudWxsKSB7XG4gICAgICBjb25zdCBpZHggPSBzb3J0Q29sSWR4O1xuICAgICAgY29uc3QgY29sVHlwZSA9IHNjaGVtYS5jb2x1bW5zW2lkeF0/LnR5cGUua2luZCA/PyBcInRleHRcIjtcbiAgICAgIGRhdGFSb3dzID0gWy4uLmRhdGFSb3dzXS5zb3J0KChhLCBiKSA9PiB7XG4gICAgICAgIGNvbnN0IGF2ID0gKHNwbGl0Um93KGEpW2lkeF0gPz8gXCJcIikudHJpbSgpO1xuICAgICAgICBjb25zdCBidiA9IChzcGxpdFJvdyhiKVtpZHhdID8/IFwiXCIpLnRyaW0oKTtcbiAgICAgICAgaWYgKGNvbFR5cGUgPT09IFwibnVtYmVyXCIgfHwgY29sVHlwZSA9PT0gXCJmb3JtdWxhXCIpIHtcbiAgICAgICAgICBjb25zdCBuYSA9IHBhcnNlRmxvYXQoYXYpO1xuICAgICAgICAgIGNvbnN0IG5iID0gcGFyc2VGbG9hdChidik7XG4gICAgICAgICAgaWYgKCFOdW1iZXIuaXNOYU4obmEpICYmICFOdW1iZXIuaXNOYU4obmIpKSByZXR1cm4gc29ydEFzYyA/IG5hIC0gbmIgOiBuYiAtIG5hO1xuICAgICAgICB9XG4gICAgICAgIGlmIChjb2xUeXBlID09PSBcImRhdGVcIikge1xuICAgICAgICAgIGNvbnN0IGRhID0gbmV3IERhdGUoYXYpLmdldFRpbWUoKTtcbiAgICAgICAgICBjb25zdCBkYiA9IG5ldyBEYXRlKGJ2KS5nZXRUaW1lKCk7XG4gICAgICAgICAgaWYgKCFOdW1iZXIuaXNOYU4oZGEpICYmICFOdW1iZXIuaXNOYU4oZGIpKSByZXR1cm4gc29ydEFzYyA/IGRhIC0gZGIgOiBkYiAtIGRhO1xuICAgICAgICB9XG4gICAgICAgIGlmIChjb2xUeXBlID09PSBcInRvZ2dsZVwiKSB7XG4gICAgICAgICAgY29uc3QgYmEgPSBhdi50b0xvd2VyQ2FzZSgpID09PSBcInRydWVcIiA/IDEgOiAwO1xuICAgICAgICAgIGNvbnN0IGJiID0gYnYudG9Mb3dlckNhc2UoKSA9PT0gXCJ0cnVlXCIgPyAxIDogMDtcbiAgICAgICAgICByZXR1cm4gc29ydEFzYyA/IGJhIC0gYmIgOiBiYiAtIGJhO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiBzb3J0QXNjID8gYXYubG9jYWxlQ29tcGFyZShidikgOiBidi5sb2NhbGVDb21wYXJlKGF2KTtcbiAgICAgIH0pO1xuICAgIH1cbiAgICBpZiAoZGF0YVJvd3MubGVuZ3RoID09PSAwKSB7XG4gICAgICBjb25zdCBlbXB0eVRkID0gdGJvZHkuY3JlYXRlRWwoXCJ0clwiKS5jcmVhdGVFbChcInRkXCIsIHsgY2xzOiBcInppYmFzZS1lbXB0eVwiIH0pO1xuICAgICAgZW1wdHlUZC5jb2xTcGFuID0gc2NoZW1hLmNvbHVtbnMubGVuZ3RoO1xuICAgICAgZW1wdHlUZC50ZXh0Q29udGVudCA9IGZpbHRlclF1ZXJ5ID8gXCJObyBtYXRjaGluZyByb3dzXCIgOiBcIk5vIGRhdGFcIjtcbiAgICAgIHJldHVybjtcbiAgICB9XG4gICAgZGF0YVJvd3MuZm9yRWFjaCgobGluZSkgPT4ge1xuICAgICAgY29uc3QgcmF3SWR4ID0gcmF3RGF0YUxpbmVzLmZpbmRJbmRleCgobCkgPT4gbCA9PT0gbGluZSk7XG4gICAgICBjb25zdCBjZWxscyA9IHNwbGl0Um93KGxpbmUpO1xuICAgICAgY29uc3QgdHIgPSB0Ym9keS5jcmVhdGVFbChcInRyXCIsIHsgY2xzOiBcInppYmFzZS1yb3dcIiB9KTtcbiAgICAgIHRyLmRyYWdnYWJsZSA9IHRydWU7XG4gICAgICB0ci5hZGRFdmVudExpc3RlbmVyKFwiZHJhZ3N0YXJ0XCIsIChlKSA9PiB7XG4gICAgICAgIGUuZGF0YVRyYW5zZmVyPy5zZXREYXRhKFwidGV4dC9yb3dcIiwgcmF3SWR4LnRvU3RyaW5nKCkpO1xuICAgICAgICB0ci5jbGFzc0xpc3QuYWRkKFwiemliYXNlLXJvdy1kcmFnZ2luZ1wiKTtcbiAgICAgIH0pO1xuICAgICAgdHIuYWRkRXZlbnRMaXN0ZW5lcihcImRyYWdlbmRcIiwgKCkgPT4ge1xuICAgICAgICB0ci5jbGFzc0xpc3QucmVtb3ZlKFwiemliYXNlLXJvdy1kcmFnZ2luZ1wiKTtcbiAgICAgICAgdGJvZHkucXVlcnlTZWxlY3RvckFsbChcIi56aWJhc2Utcm93XCIpLmZvckVhY2goKGVsKSA9PiBlbC5jbGFzc0xpc3QucmVtb3ZlKFwiemliYXNlLXJvdy1kcm9wLXRhcmdldFwiKSk7XG4gICAgICB9KTtcbiAgICAgIHRyLmFkZEV2ZW50TGlzdGVuZXIoXCJkcmFnb3ZlclwiLCAoZSkgPT4ge1xuICAgICAgICBlLnByZXZlbnREZWZhdWx0KCk7XG4gICAgICAgIHRyLmNsYXNzTGlzdC5hZGQoXCJ6aWJhc2Utcm93LWRyb3AtdGFyZ2V0XCIpO1xuICAgICAgfSk7XG4gICAgICB0ci5hZGRFdmVudExpc3RlbmVyKFwiZHJhZ2xlYXZlXCIsICgpID0+IHRyLmNsYXNzTGlzdC5yZW1vdmUoXCJ6aWJhc2Utcm93LWRyb3AtdGFyZ2V0XCIpKTtcbiAgICAgIHRyLmFkZEV2ZW50TGlzdGVuZXIoXCJkcm9wXCIsIChlKSA9PiB7XG4gICAgICAgIGUucHJldmVudERlZmF1bHQoKTtcbiAgICAgICAgZS5zdG9wUHJvcGFnYXRpb24oKTtcbiAgICAgICAgdHIuY2xhc3NMaXN0LnJlbW92ZShcInppYmFzZS1yb3ctZHJvcC10YXJnZXRcIik7XG4gICAgICAgIGNvbnN0IGZyb21JZHhTdHIgPSBlLmRhdGFUcmFuc2Zlcj8uZ2V0RGF0YShcInRleHQvcm93XCIpO1xuICAgICAgICBpZiAoIWZyb21JZHhTdHIpIHJldHVybjtcbiAgICAgICAgY29uc3QgZnJvbUlkeCA9IHBhcnNlSW50KGZyb21JZHhTdHIsIDEwKTtcbiAgICAgICAgY29uc3QgdG9JZHggPSByYXdJZHg7XG4gICAgICAgIGlmIChmcm9tSWR4ICE9PSB0b0lkeCkge1xuICAgICAgICAgIHZvaWQgKGFzeW5jICgpID0+IHtcbiAgICAgICAgICAgIGNvbnN0IGZpbGUgPSBob3N0LmFwcC52YXVsdC5nZXRBYnN0cmFjdEZpbGVCeVBhdGgoY29udGV4dC5zb3VyY2VQYXRoKTtcbiAgICAgICAgICAgIGlmICghKGZpbGUgaW5zdGFuY2VvZiBURmlsZSkpIHJldHVybjtcbiAgICAgICAgICAgIGF3YWl0IGhvc3QuYXBwLnZhdWx0LnByb2Nlc3MoZmlsZSwgKGNvbnRlbnQpID0+IHtcbiAgICAgICAgICAgICAgY29uc3QgYWxsTGluZXMgPSBjb250ZW50LnNwbGl0KFwiXFxuXCIpO1xuICAgICAgICAgICAgICBjb25zdCBmaWxlU3RhcnQgPSBzZWN0aW9uSW5mby5saW5lU3RhcnQgKyBzY2hlbWEuZGF0YVN0YXJ0SW5kZXg7XG4gICAgICAgICAgICAgIGNvbnN0IGRhdGFMaW5lcyA9IGFsbExpbmVzLnNsaWNlKGZpbGVTdGFydCwgZmlsZVN0YXJ0ICsgcmF3RGF0YUxpbmVzLmxlbmd0aCk7XG4gICAgICAgICAgICAgIGNvbnN0IGRyYWdnZWQgPSBkYXRhTGluZXMuc3BsaWNlKGZyb21JZHgsIDEpWzBdO1xuICAgICAgICAgICAgICBsZXQgaW5zZXJ0SWR4ID0gdG9JZHg7XG4gICAgICAgICAgICAgIGlmIChmcm9tSWR4IDwgdG9JZHgpIGluc2VydElkeC0tO1xuICAgICAgICAgICAgICBkYXRhTGluZXMuc3BsaWNlKGluc2VydElkeCwgMCwgZHJhZ2dlZCk7XG4gICAgICAgICAgICAgIGFsbExpbmVzLnNwbGljZShmaWxlU3RhcnQsIHJhd0RhdGFMaW5lcy5sZW5ndGgsIC4uLmRhdGFMaW5lcyk7XG4gICAgICAgICAgICAgIHJldHVybiBhbGxMaW5lcy5qb2luKFwiXFxuXCIpO1xuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgfSkoKTtcbiAgICAgICAgfVxuICAgICAgfSk7XG4gICAgICBzY2hlbWEuY29sdW1ucy5mb3JFYWNoKChjb2wsIGNvbElkeCkgPT4ge1xuICAgICAgICBjb25zdCB0ZCA9IHRyLmNyZWF0ZUVsKFwidGRcIiwgeyBjbHM6IFwiemliYXNlLXRkXCIgfSk7XG4gICAgICAgIGNvbnN0IHJhd1ZhbHVlID0gY2VsbHNbY29sSWR4XSA/PyBcIlwiO1xuICAgICAgICBob3N0LnJlbmRlckNlbGwodGQsIGNvbCwgcmF3VmFsdWUsIGNvbnRleHQsIHNjaGVtYSwgY2VsbHMsIChuZXdWYWx1ZSkgPT4ge1xuICAgICAgICAgIGlmIChyYXdJZHggIT09IC0xKSB7XG4gICAgICAgICAgICBjb25zdCB1cGRhdGVkQ2VsbHMgPSBzcGxpdFJvdyhyYXdEYXRhTGluZXNbcmF3SWR4XSk7XG4gICAgICAgICAgICB1cGRhdGVkQ2VsbHNbY29sSWR4XSA9IGAgJHtuZXdWYWx1ZX0gYDtcbiAgICAgICAgICAgIHJhd0RhdGFMaW5lc1tyYXdJZHhdID0gc2VyaWFsaXplUm93KHVwZGF0ZWRDZWxscyk7XG4gICAgICAgICAgfVxuICAgICAgICAgIHZvaWQgaG9zdC53cml0ZUJhY2soY29udGV4dCwgc2VjdGlvbkluZm8sIHNjaGVtYS5kYXRhU3RhcnRJbmRleCArIHJhd0lkeCwgY29sSWR4LCBuZXdWYWx1ZSk7XG4gICAgICAgIH0pO1xuICAgICAgfSk7XG4gICAgfSk7XG4gIH07XG4gIHJlbmRlclJvd3MoKTtcbn1cbiIsICJleHBvcnQgY29uc3QgUExVR0lOX1ZFUlNJT04gPSBcIjEuMi40XCI7XG4iXSwKICAibWFwcGluZ3MiOiAiOzs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQSxJQUFBQSxtQkFBeUU7OztBQ0VsRSxJQUFNLGdCQUFnQjtBQUN0QixJQUFNLHFCQUFxQjtBQUMzQixJQUFNLFVBQVU7QUFDaEIsSUFBTSxZQUFZO0FBRWxCLElBQU0sdUJBQXFDO0FBQUEsRUFDaEQsRUFBRSxNQUFNLFVBQVUsTUFBTSxRQUFRO0FBQUEsRUFDaEMsRUFBRSxNQUFNLFlBQVksTUFBTSxRQUFRO0FBQUEsRUFDbEMsRUFBRSxNQUFNLE9BQU8sTUFBTSxRQUFRO0FBQUEsRUFDN0IsRUFBRSxNQUFNLFFBQVEsTUFBTSxl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LE1BQU0sS0FBSztBQUNsRSxnQkFBTSxLQUFLLE9BQU8sYUFBYTtBQUFBLFFBQ2pDLEdBQUc7QUFBQSxNQUNMLENBQUM7QUFDRCxVQUFJLFdBQVcsRUFBRSxNQUFNLFVBQUssS0FBSyxvQkFBb0IsQ0FBQztBQUN0RCxZQUFNLGFBQWEsSUFBSSxTQUFTLFVBQVUsRUFBRSxLQUFLLG1CQUFtQixDQUFDO0FBQ3JFLDBCQUFvQixRQUFRLENBQUMsTUFBTTtBQUNqQyxjQUFNLE1BQU0sV0FBVyxTQUFTLFVBQVUsRUFBRSxNQUFNLEdBQUcsT0FBTyxFQUFFLENBQUM7QUFDL0QsWUFBSSxNQUFNLEtBQUs7QUFBTSxjQUFJLFdBQVc7QUFBQSxNQUN0QyxDQUFDO0FBQ0QsaUJBQVcsaUJBQWlCLFVBQVUsTUFBTTtBQUMxQyxjQUFNLFlBQVk7QUFDaEIsZUFBSyxPQUFPLFNBQVMsWUFBWSxHQUFHLEVBQUUsT0FBTyxXQUFXO0FBQ3hELGdCQUFNLEtBQUssT0FBTyxhQUFhO0FBQUEsUUFDakMsR0FBRztBQUFBLE1BQ0wsQ0FBQztBQUNELFlBQU0sWUFBWSxJQUFJLFNBQVMsVUFBVSxFQUFFLE1BQU0sUUFBSyxLQUFLLHFCQUFxQixDQUFDO0FBQ2pGLGdCQUFVLGlCQUFpQixTQUFTLE1BQU07QUFDeEMsY0FBTSxZQUFZO0FBQ2hCLGVBQUssT0FBTyxTQUFTLFlBQVksT0FBTyxLQUFLLENBQUM7QUFDOUMsZ0JBQU0sS0FBSyxPQUFPLGFBQWE7QUFDL0IsZUFBSyxZQUFZLFNBQVM7QUFBQSxRQUM1QixHQUFHO0FBQUEsTUFDTCxDQUFDO0FBQUEsSUFDSCxDQUFDO0FBQUEsRUFDSDtBQUNGOyIsCiAgIm5hbWVzIjogWyJpbXBvcnRfb2JzaWRpYW4iLCAiY29sdW1ucyIsICJpbXBvcnRfb2JzaWRpYW4iLCAiaW1wb3J0X29ic2lkaWFuIiwgIl9hIiwgImlkeCIsICJpbXBvcnRfb2JzaWRpYW4iLCAiaW1wb3J0X29ic2lkaWFuIiwgImltcG9ydF9vYnNpZGlhbiIsICJpbXBvcnRfb2JzaWRpYW4iLCAiX2EiLCAiX2IiLCAiX2EiLCAiX2IiXQp9Cg==
