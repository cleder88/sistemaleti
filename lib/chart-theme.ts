export const chartColors = {
  brand: "#F5B544",
  brandSoft: "#FBBF24",
  teal: "#2DD4BF",
  violet: "#A78BFA",
  coral: "#FB7185",
  blue: "#60A5FA",
  green: "#34D399",
  muted: "#94A3B8",
  grid: "rgba(245, 181, 68, 0.12)",
  axis: "rgba(245, 181, 68, 0.22)",
  tooltipBackground: "#1E1E24",
  tooltipBorder: "rgba(245, 181, 68, 0.35)",
  tick: "#A1A1AA",
} as const;

export const chartPalette = [
  chartColors.brand,
  chartColors.teal,
  chartColors.violet,
  chartColors.coral,
  chartColors.blue,
  chartColors.green,
  chartColors.brandSoft,
  chartColors.muted,
] as const;

export function chartColor(index: number) {
  return chartPalette[index % chartPalette.length];
}
