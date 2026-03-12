export type SubmitState = "idle" | "submitting" | "error" | "success";

export function shouldAllowSubmit(state: SubmitState): boolean {
  return state !== "submitting";
}

export function getSubmitButtonText(state: SubmitState): string {
  switch (state) {
    case "idle": return "保存图书";
    case "submitting": return "保存中…";
    case "error": return "重试";
    case "success": return "已保存";
  }
}
