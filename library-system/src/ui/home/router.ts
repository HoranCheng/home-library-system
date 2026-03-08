export type HomeRoute = "scan" | "search" | "tidy";

export function resolveRoute(input: string): HomeRoute {
  if (input === "search") return "search";
  if (input === "tidy") return "tidy";
  return "scan";
}
