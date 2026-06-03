import { describe, expect, it } from "vitest";
import { getCurrentFreeUsagePeriod, incrementFreeUsage, isFreeUsageLimitReached, readFreeUsage } from "@/lib/product/freeUsageLimit";

function memoryStorage(initial?: Record<string, string>) {
  const values = new Map(Object.entries(initial ?? {}));
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value)
  };
}

describe("free usage limit", () => {
  it("tracks free exports in the current monthly period", () => {
    const storage = memoryStorage();
    const period = "2026-06";

    expect(readFreeUsage(storage, period)).toEqual({ periodKey: period, exportCount: 0 });
    expect(incrementFreeUsage(storage, period)).toEqual({ periodKey: period, exportCount: 1 });
    expect(incrementFreeUsage(storage, period)).toEqual({ periodKey: period, exportCount: 2 });
  });

  it("resets when the month changes", () => {
    const storage = memoryStorage({
      "paperread-free-usage": JSON.stringify({ periodKey: "2026-05", exportCount: 3 })
    });

    expect(readFreeUsage(storage, "2026-06")).toEqual({ periodKey: "2026-06", exportCount: 0 });
  });

  it("detects the local beta limit", () => {
    expect(isFreeUsageLimitReached({ periodKey: "2026-06", exportCount: 2 }, 3)).toBe(false);
    expect(isFreeUsageLimitReached({ periodKey: "2026-06", exportCount: 3 }, 3)).toBe(true);
  });

  it("formats the current period as year and month", () => {
    expect(getCurrentFreeUsagePeriod(new Date("2026-06-02T12:00:00Z"))).toBe("2026-06");
  });
});
