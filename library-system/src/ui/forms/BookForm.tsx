export type BookFormField = {
  name: "title" | "isbn" | "author";
  required: boolean;
  placeholder: string;
};

export type BookFormValidation = { ok: true } | { ok: false; error: string };

const ISBN_PATTERN = /^\d{9}[\dXx]$|^\d{13}$/;

export function BookForm() {
  return {
    fields: [
      { name: "title", required: true, placeholder: "例如：计算机程序的构造和解释" },
      { name: "isbn", required: false, placeholder: "9787111128069" },
      { name: "author", required: false, placeholder: "例如：Harold Abelson" }
    ] satisfies BookFormField[],
    advancedCollapsed: true,
    keyboardAwareSubmit: true
  };
}

export function validateField(name: string, value: string): BookFormValidation {
  const trimmed = value.trim();
  if (name === "title" && !trimmed) {
    return { ok: false, error: "书名不能为空" };
  }
  if (name === "isbn" && trimmed) {
    const compact = trimmed.replace(/[-\s]/g, "");
    if (!ISBN_PATTERN.test(compact)) {
      return { ok: false, error: "ISBN 格式不正确（需要 10 位或 13 位数字）" };
    }
  }
  return { ok: true };
}
