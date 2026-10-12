import assert from "node:assert/strict";
import test from "node:test";
import { collectReferencedClasses } from "./referenced-classes";
import type { ExplorerClass, ExplorerProperty } from "./specification-explorer";

function entity(
  iri: string,
  ranges: string[],
  kind: ExplorerProperty["kind"] = "object",
): ExplorerClass {
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
      {
        iri: iri + "/property",
        label: "property",
        kind,
        rangeIris: ranges,
        rangeLabels: ranges,
        profiledPropertyIris: [],
        specializationIris: [],
        profileOfIris: [],
        parentPropertyIris: [],
      },
    ],
  };
}

test("includes transitive dependencies once and terminates on circular references", () => {
  const classes = [
    entity("Dataset", ["Agent", "Distribution"]),
    entity("Agent", ["Organization"]),
    entity("Organization", ["Dataset"]),
    entity("Distribution", ["Agent"]),
    entity("Unrelated", []),
  ];
  assert.deepEqual(collectReferencedClasses(classes, ["Dataset"]), {
    classIris: ["Dataset", "Agent", "Distribution", "Organization"],
    missingIris: [],
  });
});

test("reports unavailable ranges once without selecting them or treating datatypes as classes", () => {
  const classes = [
    entity("Dataset", ["External", "Agent"]),
    entity("Agent", ["External"]),
    entity("Record", ["http://www.w3.org/2001/XMLSchema#string"], "datatype"),
  ];
  assert.deepEqual(collectReferencedClasses(classes, ["Dataset", "Record"]), {
    classIris: ["Dataset", "Record", "Agent"],
    missingIris: ["External"],
  });
  assert.deepEqual(collectReferencedClasses(classes, []), { classIris: [], missingIris: [] });
});
