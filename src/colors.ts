export const LABEL_COLORS = [
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
  "#4d96ff",
];

export function hashStr(str: string): number {
  let h = 5381;
  for (let i = 0; i < str.length; i++) {
    h = (h << 5) + h ^ str.charCodeAt(i);
    h = h >>> 0;
  }
  return h;
}

export function getLabelColor(value: string): string {
  return LABEL_COLORS[hashStr(value.trim().toLowerCase()) % LABEL_COLORS.length];
}
