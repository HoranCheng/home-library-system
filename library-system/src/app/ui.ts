import { getHomeMode, getBottomNavItems, setHomeMode, type HomeMode } from "../ui/home/mode";
import { getHomeCard } from "../ui/home/viewModel";
import { exportCsv, exportJson, validateImportJson } from "../services/data/backup";
import { loadState } from "../store/storage";

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

export function buildSettingsUiSnapshot() {
  const state = loadState();
  return {
    exportJson: () => exportJson(state),
    exportCsv: () => exportCsv(state),
    validateImport: (raw: string) => validateImportJson(raw)
  };
}
