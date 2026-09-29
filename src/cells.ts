import { Component, MarkdownRenderChild, MarkdownRenderer, type MarkdownPostProcessorContext } from "obsidian";
import {
  evaluateFormula,
  evaluateSimpleMath,
  formatResult,
  isBackticked,
  isSimpleMath,
  stripBackticks,
} from "./formula";
import { parseBool, parseMultiSelect, serializeBool } from "./schema";
import type { CellChangeHandler, Column, TableSchema, ZiBaseHost } from "./types";
import { attachLinkTooltip, getLabelColor, startLabelEdit } from "./ui";

export function startMarkdownEdit(
  td: HTMLElement,
  rawValue: string,
  context: MarkdownPostProcessorContext,
  host: ZiBaseHost,
  onChange: CellChangeHandler,
): void {
  if (td.querySelector(".zibase-inline-input")) return;
  const displaySpan = td.querySelector<HTMLElement>(".zibase-text-rendered");
  if (displaySpan) displaySpan.setCssStyles({ display: "none" });
  const input = createEl("input");
  input.className = "zibase-inline-input";
  input.value = rawValue;
  td.appendChild(input);
  input.focus();
  input.select();
  const commit = async () => {
    const newVal = input.value;
    input.remove();
    if (displaySpan) displaySpan.setCssStyles({ display: "" });
    await onChange(newVal);
    await host.rerenderTextCell(td, newVal, context);
  };
  input.addEventListener("blur", () => { void commit(); });
  input.addEventListener("keydown", (e: KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      void commit();
    }
    if (e.key === "Escape") {
      input.remove();
      if (displaySpan) displaySpan.setCssStyles({ display: "" });
    }
  });
}

export function renderCell(
  host: ZiBaseHost,
  td: HTMLTableCellElement,
  col: Column,
  rawValue: string,
  context: MarkdownPostProcessorContext,
  schema: TableSchema,
  rowCells: string[],
  onChange: CellChangeHandler,
): void {
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
      select.createEl("option", { value: "", text: "—" });
      col.type.options.forEach((opt) => {
        const o = select.createEl("option", { text: opt, value: opt });
        if (opt === rawValue.trim()) o.selected = true;
      });
      if (!rawValue.trim()) select.options[0].selected = true;
      select.addEventListener("change", () => {
        void onChange(select.value);
      });
      break;
    }
    case "multi-select": {
      const wrap = td.createDiv("zibase-multi-select-wrap");
      const tags = parseMultiSelect(rawValue);
      if (tags.length === 0) {
        const empty = wrap.createSpan({ text: "—", cls: "zibase-text-empty" });
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
      const chip = td.createSpan({ text: rawValue.trim() || "—", cls: "zibase-label" });
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
      const displaySpan = td.createSpan({ text: val || "—", cls: val ? "zibase-date-rendered" : "zibase-text-empty" });
      td.addEventListener("click", () => {
        if (td.querySelector("input")) return;
        displaySpan.setCssStyles({ display: "none" });
        const input = td.createEl("input", { type: "date", cls: "zibase-date" });
        input.value = val;
        input.focus();
        const picker = input as HTMLInputElement & { showPicker?: () => void };
        if (typeof picker.showPicker === "function") {
          try { picker.showPicker(); } catch { /* ignored */ }
        }
        const commit = async () => {
          const newVal = input.value;
          input.remove();
          displaySpan.textContent = newVal || "—";
          displaySpan.className = newVal ? "zibase-date-rendered" : "zibase-text-empty";
          displaySpan.setCssStyles({ display: "" });
          await onChange(newVal);
        };
        input.addEventListener("blur", () => { void commit(); });
        input.addEventListener("keydown", (e) => {
          if (e.key === "Enter") void commit();
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
        const rowData: Record<string, string> = {};
        schema.columns.forEach((c, i) => {
          rowData[c.name] = (rowCells[i] ?? "").trim();
        });
        const result = evaluateFormula(col.type.expression, rowData);
        const displayVal = formatResult(result);
        const span = td.createSpan({ text: displayVal, cls: "zibase-formula-result" });
        span.title = `ƒ ${col.type.expression} = ${displayVal}`;
      } else {
        td.createSpan({ text: val || "ƒ", cls: "zibase-formula-empty" });
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
        const comp = new MarkdownRenderChild(displaySpan);
        context.addChild(comp);
        void MarkdownRenderer.render(host.app, val, displaySpan, context.sourcePath, comp).then(() => {
          displaySpan.querySelectorAll("a").forEach((a) => attachLinkTooltip(a));
          td.addEventListener("click", (e) => {
            if (e.altKey) {
              e.preventDefault();
              e.stopPropagation();
              startMarkdownEdit(td, td.dataset.raw || val, context, host, onChange);
              return;
            }
            const target = e.target as HTMLElement | null;
            if (target?.closest?.("a")) return;
            e.preventDefault();
            e.stopPropagation();
            startMarkdownEdit(td, td.dataset.raw || val, context, host, onChange);
          }, true);
        });
      } else {
        displaySpan.textContent = "—";
        displaySpan.classList.add("zibase-text-empty");
        td.addEventListener("click", (e) => {
          e.preventDefault();
          e.stopPropagation();
          startMarkdownEdit(td, td.dataset.raw ?? val, context, host, onChange);
        });
      }
      break;
    }
  }
}
