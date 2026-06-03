export type FreeUsageState = {
  periodKey: string;
  exportCount: number;
};

const STORAGE_KEY = "paperread-free-usage";

export function getCurrentFreeUsagePeriod(date = new Date()): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

export function readFreeUsage(storage: Pick<Storage, "getItem">, periodKey = getCurrentFreeUsagePeriod()): FreeUsageState {
  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (!raw) return { periodKey, exportCount: 0 };
    const parsed = JSON.parse(raw) as Partial<FreeUsageState>;
    if (parsed.periodKey !== periodKey) return { periodKey, exportCount: 0 };
    return {
      periodKey,
      exportCount: Math.max(0, Number(parsed.exportCount) || 0)
    };
  } catch {
    return { periodKey, exportCount: 0 };
  }
}

export function writeFreeUsage(storage: Pick<Storage, "setItem">, state: FreeUsageState) {
  storage.setItem(STORAGE_KEY, JSON.stringify(state));
}

export function incrementFreeUsage(storage: Pick<Storage, "getItem" | "setItem">, periodKey = getCurrentFreeUsagePeriod()): FreeUsageState {
  const current = readFreeUsage(storage, periodKey);
  const next = {
    periodKey,
    exportCount: current.exportCount + 1
  };
  writeFreeUsage(storage, next);
  return next;
}

export function isFreeUsageLimitReached(state: FreeUsageState, limit: number): boolean {
  return state.exportCount >= limit;
}
