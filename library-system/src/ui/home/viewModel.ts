import type { HomeMode } from "./mode";

export type HomeCard = {
  title: string;
  primaryAction: string;
  secondaryAction?: string;
  hint?: string;
};

export function getHomeCard(mode: HomeMode): HomeCard {
  if (mode === "scan") {
    return {
      title: "扫码入库",
      primaryAction: "开始扫描",
      secondaryAction: "无条码？去手动录入",
      hint: "正在识别条码…"
    };
  }
  return {
    title: "手动录入",
    primaryAction: "保存图书",
    secondaryAction: "切换到扫码入库",
    hint: "输入 ISBN（可粘贴）"
  };
}

export type ScanFallback = {
  canRetry: boolean;
  canSwitchToManual: boolean;
  keepPartialInput: boolean;
  message: string;
};

export function onScanFailed(partialIsbn?: string): ScanFallback {
  return {
    canRetry: true,
    canSwitchToManual: true,
    keepPartialInput: !!partialIsbn,
    message: "没识别到条码，请对准后重试"
  };
}

export function offlineDraftHint(): string {
  return "当前无网络，已为你暂存，联网后可继续";
}
