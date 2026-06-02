import { describe, expect, it } from "vitest";
import { READING_OUTPUT_PROFILES } from "@/lib/pdf/readingProfiles";
import { extractTextRowsFromContent, findTextLayerTileBreaks } from "@/lib/pdf/textLineModel";

function makeTextContent(rows: number[]) {
  return {
    items: rows.flatMap((y, rowIndex) => [
      {
        str: `row ${rowIndex} a`,
        transform: [1, 0, 0, 10, 80, y],
        width: 90,
        height: 10
      },
      {
        str: `row ${rowIndex} b`,
        transform: [1, 0, 0, 10, 180, y],
        width: 80,
        height: 10
      }
    ])
  };
}

describe("text line model", () => {
  it("groups text items into rows", () => {
    const rows = extractTextRowsFromContent(makeTextContent([720, 700, 640]), [0, 0, 300, 800]);

    expect(rows).toHaveLength(3);
    expect(rows[0].itemCount).toBe(2);
    expect(rows[0].top).toBeLessThan(rows[0].bottom);
  });

  it("selects text-layer breaks between rows", () => {
    const rows = extractTextRowsFromContent(
      makeTextContent([720, 700, 680, 560, 540, 520, 400, 380, 360, 240, 220]),
      [0, 0, 300, 800]
    );
    const result = findTextLayerTileBreaks(
      rows,
      { left: 0.2, top: 0.08, right: 0.2, bottom: 0.08 },
      {
        ...READING_OUTPUT_PROFILES["academic-reading"],
        maxTilesPerColumn: 3,
        breakSearchWindowRatio: 0.4,
        aspectRatio: 1.5
      }
    );

    expect(result.breaks.length).toBeGreaterThan(0);
    expect(result.details.every((detail) => detail.breakSource === "text-layer")).toBe(true);
    expect(result.details.every((detail) => detail.finalBoundaryValid)).toBe(true);
    expect(result.details.every((detail) => detail.previousFinalBottom! < detail.nextFinalTop!)).toBe(true);
  });
});
