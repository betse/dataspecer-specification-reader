import type { ExplorerClass } from "./specification-explorer";

/** Follows object ranges in loaded data, preserving selection and handling cycles. */
export function collectReferencedClasses(classes: ExplorerClass[], selectedIris: string[]) {
  const byIri = new Map(classes.map((value) => [value.iri, value]));
  const selected = new Set(selectedIris);
  const missing = new Set<string>();
  const queue = [...selected];
  for (let index = 0; index < queue.length; index++) {
    const value = byIri.get(queue[index]!);
    if (!value) continue;
    for (const property of value.properties) {
      if (property.kind === "datatype") continue;
      for (const iri of property.rangeIris) {
        if (!byIri.has(iri)) {
          missing.add(iri);
        } else if (!selected.has(iri)) {
          selected.add(iri);
          queue.push(iri);
        }
      }
    }
  }
  return { classIris: [...selected], missingIris: [...missing] };
}
