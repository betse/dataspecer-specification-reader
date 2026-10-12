import assert from "node:assert/strict";
import test from "node:test";
import { selectCodeProperties, setCodePropertyPreset } from "./code-property-selection";
import { collectReferencedClasses } from "./referenced-classes";
import type { ExplorerClass, ExplorerProperty } from "./specification-explorer";

// Small controlled models isolate selection behavior from parsing and network access.
function entity(iri: string): ExplorerClass {
  const property = (
    label: string,
    requirement?: ExplorerProperty["requirement"],
  ): ExplorerProperty => ({
    iri: label,
    label,
    requirement,
    kind: "object",
    rangeIris: ["Distribution"],
    rangeLabels: ["Distribution"],
    profiledPropertyIris: [],
    profileOfIris: [],
    specializationIris: [],
    parentPropertyIris: [],
  });
  return {
    iri,
    label: iri,
    kind: "vocabulary-class",
    profiledClassIris: [],
    profileOfIris: [],
    specializationIris: [],
    parentClassIris: [],
    hierarchy: [],
    backwardsAssociations: [],
    properties: [
      property("title", "mandatory"),
      property("distribution", "optional"),
      property("unknown"),
    ],
  };
}

test("includes every property by default and keeps overrides scoped to the class", () => {
  const classes = [entity("Dataset"), entity("Catalog")];
  assert.deepEqual(selectCodeProperties(classes, {}), classes);
  const result = selectCodeProperties(classes, { Dataset: { title: false } });
  assert.deepEqual(
    result[0]!.properties.map((p) => p.label),
    ["distribution", "unknown"],
  );
  assert.equal(result[1]!.properties.length, 3);
  assert.equal(classes[0]!.properties.length, 3);
});

test("mandatory-only and include-all presets use the full class, including unspecified properties", () => {
  const classes = [entity("Dataset")];
  const mandatory = selectCodeProperties(classes, setCodePropertyPreset(classes, true));
  assert.deepEqual(
    mandatory[0]!.properties.map((p) => p.label),
    ["title"],
  );
  assert.deepEqual(selectCodeProperties(classes, setCodePropertyPreset(classes, false)), classes);
  assert.deepEqual(
    selectCodeProperties(classes, {
      Dataset: { title: false, distribution: false, unknown: false },
    })[0]!.properties,
    [],
  );
});

test("reference discovery ignores excluded properties without changing source classes", () => {
  const dataset = entity("Dataset");
  dataset.properties = dataset.properties.filter((p) => p.label === "distribution");
  const distribution = { ...entity("Distribution"), properties: [] };
  const classes = [dataset, distribution];
  assert.deepEqual(
    collectReferencedClasses(selectCodeProperties(classes, { Dataset: { distribution: false } }), [
      "Dataset",
    ]).classIris,
    ["Dataset"],
  );
  assert.deepEqual(
    collectReferencedClasses(selectCodeProperties(classes, {}), ["Dataset"]).classIris,
    ["Dataset", "Distribution"],
  );
});
