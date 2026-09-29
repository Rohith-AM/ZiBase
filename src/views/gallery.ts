import { Component, MarkdownRenderChild, MarkdownRenderer, type MarkdownPostProcessorContext, type MarkdownSectionInformation } from "obsidian";
import { filterDataRows, parseBool, splitRow } from "../schema";
import type { TableSchema, ZiBaseHost } from "../types";
import { getLabelColor } from "../ui";

export function buildGalleryView(
  host: ZiBaseHost,
  body: HTMLElement,
  schema: TableSchema,
  getDataRows: () => string[],
  _rawDataLines: string[],
  context: MarkdownPostProcessorContext,
  _sectionInfo: MarkdownSectionInformation,
  filterQuery: string,
): void {
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
    const comp = new MarkdownRenderChild(titleDiv);
    context.addChild(comp);
    void MarkdownRenderer.render(host.app, titleValue || "—", titleDiv, context.sourcePath, comp);

    const fieldsWrap = card.createDiv("zibase-gallery-card-fields");
    schema.columns.forEach((col, colIdx) => {
      if (titleCol && colIdx === titleCol.index) return;
      const rawValue = (cells[colIdx] ?? "").trim();
      if (!rawValue && col.type.kind !== "toggle") return;

      const field = fieldsWrap.createDiv("zibase-gallery-field");

      if (col.type.kind === "toggle") {
        field.createSpan({ text: parseBool(rawValue) ? "✅" : "⬜" });
        field.createSpan({ text: " " + col.name, cls: "zibase-gallery-field-name" });
      } else if (col.type.kind === "label") {
        const chip = field.createSpan({ text: rawValue, cls: "zibase-label" });
        chip.setCssProps({ "--lc": getLabelColor(rawValue) });
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
