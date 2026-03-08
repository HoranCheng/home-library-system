import { getHomePageState, handleScanFailure } from "../ui/home/page";
import { createFromManual, getLibrarySummary } from "./state";

export function runDemoFlow() {
  const home = getHomePageState();
  const fallback = handleScanFailure("978");
  const created = createFromManual({ isbn: "9787121155352", title: "Demo Book", author: "Demo Author" });
  const summary = getLibrarySummary();
  return { home, fallback, createdOk: created.ok, summary };
}
