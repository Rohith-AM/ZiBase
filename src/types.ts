import type {
  App,
  MarkdownPostProcessorContext,
  MarkdownSectionInformation,
  Plugin,
} from "obsidian";
import type { Column, TableSchema, ZiBaseSettings } from "./model";

export type {
  Column,
  ColumnKind,
  ColumnRule,
  ColumnType,
  TableSchema,
  ViewName,
  ZiBaseSettings,
} from "./model";

export { COLUMN_TYPE_OPTIONS } from "./model";

export interface ZiBasePluginLike extends Plugin {
  settings: ZiBaseSettings;
  saveSettings(): Promise<void>;
}

export type CellChangeHandler = (newValue: string) => Promise<void>;

export interface ZiBaseHost {
  app: App;
  plugin: ZiBasePluginLike;
  renderCell(
    td: HTMLTableCellElement,
    col: Column,
    rawValue: string,
    context: MarkdownPostProcessorContext,
    schema: TableSchema,
    rowCells: string[],
    onChange: CellChangeHandler,
  ): void;
  writeBack(
    context: MarkdownPostProcessorContext,
    sectionInfo: MarkdownSectionInformation,
    tableRowIndex: number,
    colIndex: number,
    newValue: string,
  ): Promise<void>;
  showTypeMenu(
    e: MouseEvent,
    colIdx: number,
    schema: TableSchema,
    context: MarkdownPostProcessorContext,
    sectionInfo: MarkdownSectionInformation,
    rawDataLines: string[],
    badge: HTMLElement,
  ): void;
  addRow(
    context: MarkdownPostProcessorContext,
    sectionInfo: MarkdownSectionInformation,
    schema: TableSchema,
  ): Promise<void>;
  rerenderTextCell(
    td: HTMLElement,
    newRaw: string,
    context: MarkdownPostProcessorContext,
  ): Promise<void>;
}
