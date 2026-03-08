export function BookForm() {
  return {
    fields: ["title", "isbn", "author"],
    advancedCollapsed: true,
    keyboardAwareSubmit: true
  };
}
