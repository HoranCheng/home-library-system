export type HomeMode = "scan" | "manual";

export const HOME_MODE_KEY = "lib:home:mode:v1";

export function getHomeMode(storage?: Pick<Storage, "getItem">): HomeMode {
  const s = storage ?? (globalThis as any).localStorage;
  if (!s) return "scan";
  const v = s.getItem(HOME_MODE_KEY);
  return v === "manual" ? "manual" : "scan";
}

export function setHomeMode(mode: HomeMode, storage?: Pick<Storage, "setItem">): void {
  const s = storage ?? (globalThis as any).localStorage;
  if (!s) return;
  s.setItem(HOME_MODE_KEY, mode);
}

export function toggleHomeMode(current: HomeMode): HomeMode {
  return current === "scan" ? "manual" : "scan";
}

export function getBottomNavItems() {
  return ["scan", "search", "tidy"] as const;
}
