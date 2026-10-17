import assert from "node:assert/strict";
import test from "node:test";
import {
  defaultClassSelection,
  showRequirementColumn,
  sortClassesByRole,
} from "./explorer-defaults";

test("selects main classes before supportive classes, preserving main source order", () => {
  assert.deepEqual(
    defaultClassSelection([
      { iri: "ResourceDescriptor", role: "supportive" },
      { iri: "TermProfile", role: "main" },
      { iri: "ClassProfile", role: "main" },
      { iri: "PropertyProfile", role: "main" },
    ]),
    ["TermProfile", "ClassProfile"],
  );
});

test("does not add supportive classes when only one main class exists; falls back when no main is declared", () => {
  assert.deepEqual(
    defaultClassSelection([
      { iri: "support", role: "supportive" },
      { iri: "main", role: "main" },
    ]),
    ["main"],
  );
  assert.deepEqual(defaultClassSelection([{ iri: "first" }, { iri: "second" }, { iri: "third" }]), [
    "first",
    "second",
  ]);
  assert.deepEqual(defaultClassSelection([]), []);
});

test("hides empty requirement columns unless explicitly enabled", () => {
  assert.equal(showRequirementColumn([{}, {}]), false);
  assert.equal(showRequirementColumn([]), false);
  assert.equal(showRequirementColumn([{}, {}], true), true);
  assert.equal(showRequirementColumn([{ requirement: "optional" }]), true);
  assert.equal(showRequirementColumn([{}, { requirement: "mandatory" }]), true);
  assert.equal(showRequirementColumn([{ requirement: "recommended" }], false), false);
});

test("sidebar ordering puts main before supportive and unclassified without mutating source order", () => {
  const classes: Array<{ iri: string; role?: "main" | "supportive" }> = [
    { iri: "unknown" },
    { iri: "support1", role: "supportive" },
    { iri: "main1", role: "main" },
    { iri: "support2", role: "supportive" },
    { iri: "main2", role: "main" },
    { iri: "unknown2" },
  ];
  const before = classes.map((value) => value.iri);
  assert.deepEqual(
    sortClassesByRole(classes).map((value) => value.iri),
    ["main1", "main2", "support1", "support2", "unknown", "unknown2"],
  );
  assert.deepEqual(
    classes.map((value) => value.iri),
    before,
  );
  assert.deepEqual(sortClassesByRole([]), []);
});
