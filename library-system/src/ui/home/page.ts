import { getHomeMode, setHomeMode, toggleHomeMode, type HomeMode } from "./mode";
import { getHomeCard, onScanFailed } from "./viewModel";

export type HomePageState = {
  mode: HomeMode;
  cardTitle: string;
  primaryAction: string;
  secondaryAction?: string;
  fallbackMessage?: string;
};

export function getHomePageState(storage?: Pick<Storage, "getItem">): HomePageState {
  const mode = getHomeMode(storage);
  const card = getHomeCard(mode);
  return {
    mode,
    cardTitle: card.title,
    primaryAction: card.primaryAction,
    secondaryAction: card.secondaryAction
  };
}

export function switchMode(current: HomeMode, storage?: Pick<Storage, "setItem">): HomeMode {
  const next = toggleHomeMode(current);
  setHomeMode(next, storage);
  return next;
}

export function handleScanFailure(partialIsbn?: string): string {
  return onScanFailed(partialIsbn).message;
}
