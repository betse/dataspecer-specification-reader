import type { ExplorerClass, ExplorerProperty } from "./specification-explorer";

/** Main classes take precedence; unclassified vocabularies retain source order. */
export function defaultClassSelection(classes: Pick<ExplorerClass, "iri" | "role">[]): string[] {
  const main = classes.filter((value) => value.role === "main");
  return (main.length ? main : classes).slice(0, 2).map((value) => value.iri);
}

/** Evaluate all properties, not only the rows remaining after table filters. */
export function showRequirementColumn(
  properties: Pick<ExplorerProperty, "requirement">[],
  override?: boolean,
): boolean {
  return override ?? properties.some((property) => property.requirement !== undefined);
}

/** Stable role ordering without mutating the source model. */
export function sortClassesByRole<T extends Pick<ExplorerClass, "role">>(classes: T[]): T[] {
  const rank = (value: T) => (value.role === "main" ? 0 : value.role === "supportive" ? 1 : 2);
  return [...classes].sort((left, right) => rank(left) - rank(right));
}
