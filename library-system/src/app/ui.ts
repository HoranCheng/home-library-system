import { getHomeMode, getBottomNavItems, setHomeMode, type HomeMode } from "../ui/home/mode";
import { getHomeCard } from "../ui/home/viewModel";
import { exportCsv, exportJson, validateImportJson } from "../services/data/backup";
import { loadState } from "../store/storage";
import { createFromManual, importState } from "./state";

export function buildHomeUiSnapshot(storage?: Pick<Storage, "getItem" | "setItem">) {
  const mode = getHomeMode(storage);
  const card = getHomeCard(mode);
  return {
    mode,
    nav: getBottomNavItems(),
    card
  };
}

export function switchHomeMode(mode: HomeMode, storage?: Pick<Storage, "setItem">) {
  setHomeMode(mode, storage);
  return mode;
}

export function handleManualEntrySubmit(
  data: { isbn?: string; title?: string; author?: string },
  storage?: Pick<Storage, "getItem" | "setItem">
) {
  return createFromManual(data, storage);
}

export function buildSettingsUiSnapshot(storage?: Pick<Storage, "getItem" | "setItem">) {
  const state = loadState(storage);
  return {
    exportJson: () => exportJson(state),
    exportCsv: () => exportCsv(state),
    validateImport: (raw: string) => validateImportJson(raw),
    importJson: (raw: string) => importState(raw, storage)
  };
}
