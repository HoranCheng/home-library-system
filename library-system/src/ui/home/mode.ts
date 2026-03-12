import { STORAGE_KEYS } from "../../store/schema";
import { getStorageAdapter } from "../../store/storage";

export type HomeMode = "scan" | "manual";

export function getHomeMode(storage?: Pick<Storage, "getItem">): HomeMode {
  const s = storage ?? getStorageAdapter();
  if (!s) return "scan";
  const v = s.getItem(STORAGE_KEYS.homeMode);
  return v === "manual" ? "manual" : "scan";
}

export function setHomeMode(mode: HomeMode, storage?: Pick<Storage, "setItem">): void {
  const s = storage ?? getStorageAdapter();
  if (!s) return;
  s.setItem(STORAGE_KEYS.homeMode, mode);
}

export function toggleHomeMode(current: HomeMode): HomeMode {
  return current === "scan" ? "manual" : "scan";
}

export function getBottomNavItems() {
  return ["scan", "search", "tidy"] as const;
}
