export function MobileShell({ children }: { children: unknown }) {
  return {
    type: "mobile-shell",
    safeAreaBottom: true,
    children
  };
}
