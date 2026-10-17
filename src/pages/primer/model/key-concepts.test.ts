import assert from "node:assert/strict";
import test from "node:test";
import { selectKeyConcepts } from "./key-concepts";

test("prioritizes Main concepts even when supportive concepts appear first in the diagram", () => {
  const concepts = [
    { iri: "support", role: "supportive" as const },
    { iri: "main1", role: "main" as const },
    { iri: "main2", role: "main" as const },
    { iri: "other" },
  ];
  assert.deepEqual(
    selectKeyConcepts(concepts, ["support", "main2"], 2).map((c) => c.iri),
    ["main2", "main1"],
  );
  assert.deepEqual(
    selectKeyConcepts(concepts, [], 3).map((c) => c.iri),
    ["main1", "main2", "support"],
  );
  assert.equal(concepts[0]!.iri, "support");
});

test("without roles uses diagram then source order, skips unknown IDs and removes duplicates", () => {
  const concepts = [{ iri: "a" }, { iri: "b" }, { iri: "c" }];
  assert.deepEqual(
    selectKeyConcepts(concepts, ["c", "missing", "c"], 8).map((c) => c.iri),
    ["c", "a", "b"],
  );
  assert.deepEqual(
    selectKeyConcepts(concepts, [], 2).map((c) => c.iri),
    ["a", "b"],
  );
  assert.deepEqual(selectKeyConcepts(concepts, [], 0), []);
  assert.deepEqual(selectKeyConcepts([], ["missing"], 8), []);
});
