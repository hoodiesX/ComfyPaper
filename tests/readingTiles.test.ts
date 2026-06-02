import { describe, expect, it } from "vitest";
import { READING_OUTPUT_PROFILES } from "@/lib/pdf/readingProfiles";
import {
  calculateDrawPlacement,
  calculateProfileDrawPlacement,
  createReadingTilesForColumns,
  validateConsecutiveTiles
} from "@/lib/pdf/readingTiles";
import type { ColumnCrop } from "@/types/pdf";

const columns: ColumnCrop[] = [
  {
    sourcePageNumber: 2,
    column: "left",
    crop: { left: 0.06, top: 0.08, right: 0.52, bottom: 0.08 },
    gainPercent: 100
  },
  {
    sourcePageNumber: 2,
    column: "right",
    crop: { left: 0.52, top: 0.08, right: 0.06, bottom: 0.08 },
    gainPercent: 100
  }
];

describe("reading tiles", () => {
  it("splits tall columns into multiple tiles", () => {
    const tiles = createReadingTilesForColumns([
      {
        ...columns[0],
        breakFractions: [0.48],
        breakDetails: [{
          position: 0.48,
          inkDensity: 0.01,
          breakKind: "clean-whitespace",
          continuationMode: "clean-non-overlap",
          previousFinalBottom: 0.474,
          nextFinalTop: 0.486,
          corridorHeight: 0.012,
          finalBoundaryValid: true
        }]
      }
    ], READING_OUTPUT_PROFILES["kindle-ereader"]);

    expect(tiles.length).toBeGreaterThan(1);
    expect(tiles.length).toBeLessThanOrEqual(READING_OUTPUT_PROFILES["kindle-ereader"].maxTilesPerColumn);
    expect(tiles[0].paginationMode).toBe("multi-tile-safe");
  });

  it("keeps tile crops inside column bounds and in top-to-bottom order", () => {
    const tiles = createReadingTilesForColumns([
      {
        ...columns[0],
        breakFractions: [0.48],
        breakDetails: [{
          position: 0.48,
          inkDensity: 0.01,
          breakKind: "clean-whitespace",
          continuationMode: "clean-non-overlap",
          previousFinalBottom: 0.474,
          nextFinalTop: 0.486,
          corridorHeight: 0.012,
          finalBoundaryValid: true
        }]
      }
    ], READING_OUTPUT_PROFILES["kindle-ereader"]);

    expect(tiles[0].tileIndex).toBe(1);
    for (let index = 1; index < tiles.length; index += 1) {
      expect(tiles[index].crop.top).toBeGreaterThanOrEqual(tiles[index - 1].crop.top);
    }

    for (const tile of tiles) {
      expect(tile.crop.left).toBeLessThanOrEqual(columns[0].crop.left);
      expect(tile.crop.right).toBeLessThanOrEqual(columns[0].crop.right);
      expect(tile.crop.top + tile.crop.bottom).toBeLessThan(0.96);
    }
  });

  it("uses explicit last-resort pagination when break diagnostics are missing for a tall column", () => {
    const tiles = createReadingTilesForColumns([
      {
        ...columns[0],
        breakFractions: [0.48]
      }
    ], READING_OUTPUT_PROFILES["kindle-ereader"]);

    expect(tiles.length).toBeGreaterThan(1);
    expect(tiles[0].paginationMode).toBe("multi-tile-last-resort");
    expect(tiles[0].paginationReason).toBe("last-resort");
    expect(tiles[0].verticalBreakCount).toBeGreaterThan(0);
    expect(tiles[0].breakCoverageComplete).toBe(true);
  });

  it("does not expand tile crops across the center gutter guard", () => {
    const tiles = createReadingTilesForColumns(columns, READING_OUTPUT_PROFILES["kindle-ereader"]);
    const leftTiles = tiles.filter((tile) => tile.column === "left");
    const rightTiles = tiles.filter((tile) => tile.column === "right");

    for (const tile of leftTiles) {
      expect(1 - tile.crop.right).toBeLessThanOrEqual(0.5);
    }

    for (const tile of rightTiles) {
      expect(tile.crop.left).toBeGreaterThanOrEqual(0.5);
    }
  });

  it("orders left column tiles before right column tiles", () => {
    const tiles = createReadingTilesForColumns(columns, READING_OUTPUT_PROFILES["academic-reading"]);
    const firstRightIndex = tiles.findIndex((tile) => tile.column === "right");
    const lastLeftIndex = tiles.map((tile) => tile.column).lastIndexOf("left");

    expect(firstRightIndex).toBeGreaterThan(lastLeftIndex);
  });

  it("creates unique stable labels for multiple tiles from the same source page", () => {
    const tiles = createReadingTilesForColumns(columns, READING_OUTPUT_PROFILES["kindle-ereader"]);
    const ids = tiles.map((tile) => `${tile.sourcePageNumber}-column-${tile.column}-${tile.tileIndex}`);

    expect(new Set(ids).size).toBe(ids.length);
  });

  it("calculates uniform scale and centering without distortion", () => {
    const placement = calculateDrawPlacement(300, 500, 600, 800);

    expect(placement.scale).toBeCloseTo(1.6);
    expect(placement.width).toBeCloseTo(480);
    expect(placement.height).toBeCloseTo(800);
    expect(placement.x).toBeCloseTo(60);
    expect(placement.y).toBeCloseTo(0);
  });

  it("uses clean breaks with no overlap to avoid duplicated boundary lines", () => {
    const tiles = createReadingTilesForColumns([
      {
        ...columns[0],
        breakFractions: [0.48],
        breakDetails: [{
          position: 0.48,
          inkDensity: 0.01,
          breakKind: "clean-whitespace",
          continuationMode: "clean-non-overlap",
          previousFinalBottom: 0.474,
          nextFinalTop: 0.486,
          corridorHeight: 0.012,
          finalBoundaryValid: true
        }],
        breakStrategy: "smart"
      }
    ], READING_OUTPUT_PROFILES["academic-reading"]);

    expect(tiles).toHaveLength(2);
    expect(tiles[1].breakKind).toBe("clean-whitespace");
    expect(tiles[1].continuationMode).toBe("clean-non-overlap");
    expect(tiles[1].widthFitScale).toBeGreaterThan(tiles[1].singleColumnScale ?? 0);
    expect(tiles[1].contentFillRatio).toBeGreaterThan(0.5);
    expect(tiles[1].overlapRatio).toBe(0);
    expect(1 - tiles[0].crop.bottom).toBeCloseTo(0.474);
    expect(tiles[1].crop.top).toBeCloseTo(0.486);
    expect(validateConsecutiveTiles(tiles[0], tiles[1]).excessiveOverlap).toBe(false);
    expect(validateConsecutiveTiles(tiles[0], tiles[1]).duplicateBoundaryLikely).toBe(false);
  });

  it("keeps crop bounds progressing top-to-bottom without duplicate pages", () => {
    const tiles = createReadingTilesForColumns([
      {
        sourcePageNumber: 2,
        column: "left",
        crop: { left: 0.08, top: 0.04, right: 0.68, bottom: 0.04 },
        gainPercent: 100,
        breakFractions: [0.35, 0.62],
        breakDetails: [
          {
            position: 0.35,
            inkDensity: 0,
            breakKind: "paragraph-gap",
            continuationMode: "clean-non-overlap",
            previousFinalBottom: 0.344,
            nextFinalTop: 0.356,
            corridorHeight: 0.012,
            finalBoundaryValid: true
          },
          {
            position: 0.62,
            inkDensity: 0,
            breakKind: "paragraph-gap",
            continuationMode: "clean-non-overlap",
            previousFinalBottom: 0.614,
            nextFinalTop: 0.626,
            corridorHeight: 0.012,
            finalBoundaryValid: true
          }
        ]
      }
    ], READING_OUTPUT_PROFILES["academic-reading"]);

    expect(tiles).toHaveLength(3);
    expect(new Set(tiles.map((tile) => JSON.stringify(tile.crop))).size).toBe(3);
    expect(tiles[1].crop.top).toBeGreaterThan(tiles[0].crop.top);
    expect(tiles[2].crop.top).toBeGreaterThan(tiles[1].crop.top);
  });

  it("uses only micro overlap for line-gap breaks", () => {
    const profile = READING_OUTPUT_PROFILES["academic-reading"];
    const tiles = createReadingTilesForColumns([
      {
        ...columns[0],
        breakFractions: [0.48],
        breakDetails: [{
          position: 0.48,
          inkDensity: 0.035,
          breakKind: "line-gap",
          continuationMode: "clean-non-overlap",
          previousFinalBottom: 0.474,
          nextFinalTop: 0.486,
          corridorHeight: 0.012,
          finalBoundaryValid: true
        }],
        breakStrategy: "smart"
      }
    ], profile);

    expect(tiles[1].breakKind).toBe("line-gap");
    expect(tiles[1].continuationMode).toBe("clean-non-overlap");
    expect(tiles[1].overlapRatio).toBe(0);
    expect(1 - tiles[0].crop.bottom).toBeCloseTo(0.474);
    expect(tiles[1].crop.top).toBeCloseTo(0.486);
    expect(validateConsecutiveTiles(tiles[0], tiles[1], profile.maxOverlapRatio).duplicateBoundaryLikely).toBe(false);
  });

  it("uses explicit last-resort pagination when fallback breaks are not final-valid", () => {
    const profile = READING_OUTPUT_PROFILES["kindle-ereader"];
    const tiles = createReadingTilesForColumns([
      {
        ...columns[0],
        breakFractions: [0.48],
        breakDetails: [{
          position: 0.48,
          inkDensity: 0.3,
          breakKind: "fallback-dense",
          continuationMode: "emergency-overlap"
        }],
        breakStrategy: "fallback"
      }
    ], profile);

    expect(tiles.length).toBeGreaterThan(1);
    expect(tiles[0].paginationMode).toBe("multi-tile-last-resort");
    expect(tiles[0].paginationReason).toBe("last-resort");
  });

  it("uses output profile margins while preserving uniform placement", () => {
    const profile = READING_OUTPUT_PROFILES["academic-reading"];
    const placement = calculateProfileDrawPlacement(300, 500, profile);

    expect(placement.scale).toBeGreaterThan(0);
    expect(placement.x).toBeGreaterThan(profile.pageWidth * profile.outputSideMarginRatio - 0.001);
    expect(placement.y).toBeGreaterThanOrEqual(profile.pageHeight * profile.outputBottomMarginRatio - 0.001);
    expect(placement.x + placement.width).toBeLessThanOrEqual(
      profile.pageWidth * (1 - profile.outputSideMarginRatio) + 0.001
    );
    expect(placement.y + placement.height).toBeLessThanOrEqual(
      profile.pageHeight * (1 - profile.outputTopMarginRatio) + 0.001
    );
  });
});
