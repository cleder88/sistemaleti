import { describe, expect, it } from "vitest";
import { chartColor, chartPalette } from "@/lib/chart-theme";

describe("chart theme", () => {
  it("returns colors from the palette", () => {
    expect(chartColor(0)).toBe(chartPalette[0]);
    expect(chartColor(chartPalette.length)).toBe(chartPalette[0]);
    expect(chartColor(1)).not.toBe(chartColor(0));
  });
});
