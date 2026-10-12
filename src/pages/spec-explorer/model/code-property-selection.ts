import type { ExplorerClass } from "./specification-explorer";

/** Overrides belong to a class/property pair. Unchanged properties are included. */
export type CodePropertySelection = Record<string, Record<string, boolean>>;

export function selectCodeProperties(
  classes: ExplorerClass[],
  selection: CodePropertySelection,
): ExplorerClass[] {
  return classes.map((value) => ({
    ...value,
    properties: value.properties.filter(
      (property) => selection[value.iri]?.[property.iri] !== false,
    ),
  }));
}

export function setCodePropertyPreset(
  classes: ExplorerClass[],
  mandatoryOnly: boolean,
): CodePropertySelection {
  return Object.fromEntries(
    classes.map((value) => [
      value.iri,
      Object.fromEntries(
        value.properties.map((property) => [
          property.iri,
          !mandatoryOnly || property.requirement === "mandatory",
        ]),
      ),
    ]),
  );
}
